const prisma = require('./db');

/**
 * Parses a Date string in multiple formats:
 * - DD-MM-YYYY (e.g. 01-02-2026)
 * - MMM-DD (e.g. Mar-14)
 * Returns a valid Date object or null if parsing fails.
 */
function parseCSVDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();

  // Try format DD-MM-YYYY
  const dmyRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  const dmyMatch = cleaned.match(dmyRegex);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed month
    const year = parseInt(dmyMatch[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // Try format MMM-DD (e.g., Mar-14)
  const mmmDdRegex = /^([A-Za-z]{3})-(\d{1,2})$/;
  const mmmDdMatch = cleaned.match(mmmDdRegex);
  if (mmmDdMatch) {
    const monthStr = mmmDdMatch[1].toLowerCase();
    const day = parseInt(mmmDdMatch[2], 10);

    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };

    const month = monthMap[monthStr];
    if (month !== undefined) {
      // Default to year 2026 as per our database seeder/spreadsheet range
      return new Date(Date.UTC(2026, month, day));
    }
  }

  // Fallback to JS standard Date parsing
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Parses a single CSV line, handling quotes and commas.
 */
function parseCSVLine(line) {
  if (!line) return [];
  // Split by comma only when not inside double quotes
  const fields = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  return fields.map(field => {
    let cleaned = field.trim();
    // Strip surrounding quotes
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.substring(1, cleaned.length - 1);
    }
    return cleaned.trim();
  });
}

/**
 * Normalizes user names to match database records case-insensitively
 */
function findUserByName(usersList, name) {
  if (!name) return null;
  const cleanedName = name.trim().toLowerCase();
  return usersList.find(u => u.name.toLowerCase() === cleanedName) || null;
}

/**
 * Analyzes CSV content and saves results as an ImportJob with its anomalies.
 */
async function processCSVImport(groupId, csvContentString) {
  // Fetch users and memberships to validate against
  const allUsers = await prisma.user.findMany();
  const groupMemberships = await prisma.groupMembership.findMany({
    where: { groupId },
    include: { user: true }
  });

  const lines = csvContentString.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV is empty or missing data rows.');
  }

  // Parse Header
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const expectedHeaders = ['date', 'description', 'paid_by', 'amount', 'currency', 'split_type', 'split_with', 'split_details', 'notes'];

  // Basic structure verification
  const hasMinHeaders = ['date', 'description', 'amount'].every(h => headers.includes(h));
  if (!hasMinHeaders) {
    throw new Error('CSV is missing required headers: date, description, or amount.');
  }

  // Create an ImportJob
  const importJob = await prisma.importJob.create({
    data: {
      groupId,
      fileName: 'expenses_export.csv',
      status: 'PENDING_REVIEW'
    }
  });

  const parsedRows = [];
  const anomaliesList = [];

  // Parse each row (line index 1 is Row #2 in spreadsheet)
  for (let i = 1; i < lines.length; i++) {
    const rawFields = parseCSVLine(lines[i]);
    if (rawFields.length === 0 || (rawFields.length === 1 && rawFields[0] === '')) {
      continue;
    }

    // Map fields to headers
    const row = {};
    headers.forEach((header, index) => {
      row[header] = rawFields[index] || '';
    });

    const rowIndex = i + 1; // 1-indexed spreadsheet row index
    const rowAnomalies = [];

    // 1. Column Shift Detection
    let isShifted = false;
    const splitTypes = ['equal', 'percentage', 'share', 'unequal', 'exact'];
    if (row.currency && splitTypes.includes(row.currency.toLowerCase())) {
      isShifted = true;
      rowAnomalies.push({
        anomalyType: 'SHIFTED_COLUMNS',
        severity: 'ERROR',
        description: `Columns appear shifted. The currency column contains split type: '${row.currency}'.`
      });
    }

    // 2. Date parsing and validation
    const parsedDate = parseCSVDate(row.date);
    if (!parsedDate) {
      rowAnomalies.push({
        anomalyType: 'INVALID_DATE',
        severity: 'ERROR',
        description: `Invalid date format: '${row.date}'. Expected DD-MM-YYYY or MMM-DD.`
      });
    }

    // 3. Amount parsing and validation
    let rawAmount = row.amount || '';
    // Strip commas and quotes
    rawAmount = rawAmount.replace(/,/g, '').replace(/"/g, '').trim();
    const parsedAmount = parseFloat(rawAmount);

    if (isNaN(parsedAmount)) {
      rowAnomalies.push({
        anomalyType: 'INVALID_AMOUNT',
        severity: 'ERROR',
        description: `Invalid expense amount: '${row.amount}'.`
      });
    } else {
      if (parsedAmount === 0) {
        rowAnomalies.push({
          anomalyType: 'ZERO_AMOUNT',
          severity: 'WARNING',
          description: `Transaction amount is 0.`
        });
      } else if (parsedAmount < 0) {
        // Refund detected
        rowAnomalies.push({
          anomalyType: 'INVALID_AMOUNT',
          severity: 'WARNING',
          description: `Negative amount detected (${parsedAmount}); representing a refund/credit.`
        });
      }

      // Check decimal precision (e.g. 899.995 has 3 decimal places)
      const decimalPart = rawAmount.split('.')[1];
      if (decimalPart && decimalPart.length > 2) {
        rowAnomalies.push({
          anomalyType: 'INVALID_AMOUNT',
          severity: 'WARNING',
          description: `Amount has non-standard decimal places: '${rawAmount}' (3+ decimals).`
        });
      }
    }

    // 4. Currency Validation
    let currency = row.currency ? row.currency.trim().toUpperCase() : '';
    if (isShifted) {
      // Shuffled rows mean currency is missing or blank
      currency = '';
    }
    if (!currency) {
      rowAnomalies.push({
        anomalyType: 'SHIFTED_COLUMNS', // or currency missing
        severity: 'WARNING',
        description: `Currency is blank; defaulting to INR.`
      });
      currency = 'INR';
    } else if (currency === 'USD') {
      rowAnomalies.push({
        anomalyType: 'USD_CURRENCY',
        severity: 'WARNING',
        description: `USD currency transaction; requires conversion to INR (Proposed rate: 1 USD = 83 INR).`
      });
    }

    // 5. Payer Validation
    let payerName = row.paid_by ? row.paid_by.trim() : '';
    let dbPayer = null;
    if (!payerName) {
      rowAnomalies.push({
        anomalyType: 'MISSING_PAYER',
        severity: 'ERROR',
        description: `Payer field ('paid_by') is empty.`
      });
    } else {
      dbPayer = findUserByName(allUsers, payerName);
      if (!dbPayer) {
        rowAnomalies.push({
          anomalyType: 'UNKNOWN_MEMBER',
          severity: 'ERROR',
          description: `Payer '${payerName}' is not a registered user.`
        });
      } else {
        // Check if name has casing issues
        if (dbPayer.name !== payerName) {
          rowAnomalies.push({
            anomalyType: 'UNKNOWN_MEMBER',
            severity: 'WARNING',
            description: `Payer name casing mismatch: '${payerName}' mapped to '${dbPayer.name}'.`
          });
        }
      }
    }

    // 6. Split Details and Split Type Validation
    const splitType = row.split_type ? row.split_type.trim().toLowerCase() : '';
    const splitWithStr = row.split_with || '';
    const splitWithNames = splitWithStr.split(';').map(n => n.trim()).filter(n => n.length > 0);

    // Validate percentage total
    if (splitType === 'percentage') {
      const splitDetailsStr = row.split_details || '';
      const shares = splitDetailsStr.split(';').map(s => s.trim()).filter(s => s.length > 0);
      let percentageSum = 0;
      shares.forEach(share => {
        const parts = share.split(/\s+/);
        const pctStr = parts[parts.length - 1];
        if (pctStr && pctStr.endsWith('%')) {
          percentageSum += parseFloat(pctStr.replace('%', ''));
        }
      });

      if (Math.abs(percentageSum - 100) > 0.01) {
        rowAnomalies.push({
          anomalyType: 'SPLIT_MISMATCH',
          severity: 'ERROR',
          description: `Percentages in split_details sum to ${percentageSum}% (Expected 100%).`
        });
      }
    }

    // Check if split type is equal but split details are provided
    if (splitType === 'equal' && row.split_details) {
      rowAnomalies.push({
        anomalyType: 'SPLIT_MISMATCH',
        severity: 'WARNING',
        description: `Split type is 'equal' but shares/ratios are defined in split_details.`
      });
    }

    // 7. Dynamic Membership Timeline & Boundary Checks
    if (parsedDate && splitWithNames.length > 0) {
      splitWithNames.forEach(name => {
        const user = findUserByName(allUsers, name);
        if (!user) {
          rowAnomalies.push({
            anomalyType: 'UNKNOWN_MEMBER',
            severity: 'ERROR',
            description: `Split member '${name}' is not a registered user.`
          });
        } else {
          // Check membership timeline
          const membership = groupMemberships.find(m => m.userId === user.id);
          if (!membership) {
            rowAnomalies.push({
              anomalyType: 'MEMBER_OUT_OF_BOUNDS',
              severity: 'ERROR',
              description: `'${user.name}' is in split but is not a member of this group.`
            });
          } else {
            const joinedAt = new Date(membership.joinedAt);
            const leftAt = membership.leftAt ? new Date(membership.leftAt) : null;

            if (parsedDate < joinedAt) {
              rowAnomalies.push({
                anomalyType: 'MEMBER_OUT_OF_BOUNDS',
                severity: 'WARNING',
                description: `'${user.name}' split is dated (${parsedDate.toISOString().split('T')[0]}) before joining date (${joinedAt.toISOString().split('T')[0]}).`
              });
            } else if (leftAt && parsedDate > leftAt) {
              rowAnomalies.push({
                anomalyType: 'MEMBER_OUT_OF_BOUNDS',
                severity: 'ERROR',
                description: `'${user.name}' split is dated (${parsedDate.toISOString().split('T')[0]}) after leaving date (${leftAt.toISOString().split('T')[0]}).`
              });
            }
          }
        }
      });
    }

    // 8. Settlement Disguised as Expense
    const isSettlementStr = (row.notes || '') + ' ' + (row.description || '');
    const containsSettlementKeywords = /paid\s+back|settle|returned|refund|repay|deposit/i.test(isSettlementStr);
    const hasSingleSplitWith = splitWithNames.length === 1;
    if (containsSettlementKeywords || (!splitType && hasSingleSplitWith)) {
      rowAnomalies.push({
        anomalyType: 'SETTLEMENT_AS_EXPENSE',
        severity: 'WARNING',
        description: `Transaction appears to be a direct settlement payment rather than a shared expense.`
      });
    }

    // Collect parsed row details
    parsedRows.push({
      rowIndex,
      date: row.date,
      description: row.description,
      paid_by: row.paid_by,
      amount: row.amount,
      currency: row.currency,
      split_type: row.split_type,
      split_with: row.split_with,
      split_details: row.split_details,
      notes: row.notes,
      anomaliesCount: rowAnomalies.length
    });

    // Save anomalies to database
    for (const anomaly of rowAnomalies) {
      await prisma.importAnomaly.create({
        data: {
          importJobId: importJob.id,
          rowIndex,
          rowData: row,
          anomalyType: anomaly.anomalyType,
          description: anomaly.description,
          severity: anomaly.severity,
          isResolved: false
        }
      });
      anomaliesList.push({
        rowIndex,
        ...anomaly
      });
    }
  }

  // 9. Duplicate Transaction detection (across the file and database)
  // Let's run a duplicate pass
  for (let idx = 0; idx < parsedRows.length; idx++) {
    const rowA = parsedRows[idx];
    const dateA = parseCSVDate(rowA.date);
    const amountA = parseFloat((rowA.amount || '').replace(/,/g, '').replace(/"/g, ''));
    if (!dateA || isNaN(amountA)) continue;

    // A. Check duplicates within the file itself
    for (let j = idx + 1; j < parsedRows.length; j++) {
      const rowB = parsedRows[j];
      const dateB = parseCSVDate(rowB.date);
      const amountB = parseFloat((rowB.amount || '').replace(/,/g, '').replace(/"/g, ''));
      if (!dateB || isNaN(amountB)) continue;

      if (dateA.getTime() === dateB.getTime() && amountA === amountB && rowA.paid_by === rowB.paid_by) {
        const descMatch = rowA.description.toLowerCase().trim() === rowB.description.toLowerCase().trim();
        const anomalyDesc = descMatch 
          ? `Exact duplicate entry within the CSV file (matches line ${rowA.rowIndex}).`
          : `Potential duplicate/conflicting entry within the CSV file (similar amount/date as line ${rowA.rowIndex}).`;

        const newAnomaly = await prisma.importAnomaly.create({
          data: {
            importJobId: importJob.id,
            rowIndex: rowB.rowIndex,
            rowData: { ...rowB },
            anomalyType: 'DUPLICATE',
            description: anomalyDesc,
            severity: 'WARNING',
            isResolved: false
          }
        });
        anomaliesList.push({
          rowIndex: rowB.rowIndex,
          id: newAnomaly.id,
          anomalyType: 'DUPLICATE',
          severity: 'WARNING',
          description: anomalyDesc
        });
      }
    }

    // B. Check duplicates against existing database records
    const dbDuplicates = await prisma.expense.findMany({
      where: {
        groupId,
        date: dateA,
        amount: amountA,
      }
    });

    if (dbDuplicates.length > 0) {
      const dbAnomalyDesc = `Potential duplicate with existing database expense: '${dbDuplicates[0].description}' on ${rowA.date}.`;
      const newAnomaly = await prisma.importAnomaly.create({
        data: {
          importJobId: importJob.id,
          rowIndex: rowA.rowIndex,
          rowData: { ...rowA },
          anomalyType: 'DUPLICATE',
          description: dbAnomalyDesc,
          severity: 'WARNING',
          isResolved: false
        }
      });
      anomaliesList.push({
        rowIndex: rowA.rowIndex,
        id: newAnomaly.id,
        anomalyType: 'DUPLICATE',
        severity: 'WARNING',
        description: dbAnomalyDesc
      });
    }
  }

  // Update job status if no anomalies exist (though our CSV has plenty!)
  const totalAnomalies = await prisma.importAnomaly.count({
    where: { importJobId: importJob.id }
  });

  if (totalAnomalies === 0) {
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: { status: 'COMPLETED' }
    });
  }

  return {
    importJobId: importJob.id,
    fileName: importJob.fileName,
    status: totalAnomalies === 0 ? 'COMPLETED' : 'PENDING_REVIEW',
    totalRows: parsedRows.length,
    anomaliesCount: totalAnomalies,
    anomalies: anomaliesList
  };
}

module.exports = {
  processCSVImport
};
