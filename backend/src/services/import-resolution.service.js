const prisma = require('./db');

/**
 * Resolves anomalies and imports the approved expenses/settlements for an ImportJob.
 */
async function resolveAndImport(importJobId, resolvedRows) {
  const job = await prisma.importJob.findUnique({
    where: { id: importJobId }
  });

  if (!job) {
    throw new Error('Import job not found.');
  }

  if (job.status === 'COMPLETED') {
    throw new Error('This import job has already been completed.');
  }

  // We will run the entire import inside a database transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    let importedExpensesCount = 0;
    let importedSettlementsCount = 0;
    let skippedCount = 0;

    for (const row of resolvedRows) {
      const { rowIndex, action, data } = row;

      if (action === 'SKIP') {
        skippedCount++;
        continue;
      }

      if (action === 'IMPORT_EXPENSE') {
        const {
          date,
          description,
          paidById,
          amount,
          currency,
          exchangeRate,
          splitType,
          splits,
          notes
        } = data;

        // Validations
        if (!date || !description || !paidById || !amount || !splitType || !splits || splits.length === 0) {
          throw new Error(`Row ${rowIndex}: Missing required fields for expense import.`);
        }

        const parsedAmount = parseFloat(amount);
        const parsedRate = parseFloat(exchangeRate) || 1.0;
        const totalAmountInInr = parsedAmount * parsedRate;

        // Create the Expense
        const expense = await tx.expense.create({
          data: {
            groupId: job.groupId,
            paidById,
            amount: parsedAmount,
            currency: currency || 'INR',
            exchangeRate: parsedRate,
            amountInInr: totalAmountInInr,
            description,
            date: new Date(date),
            splitType: splitType.toUpperCase(),
            notes: notes || null,
            importJobId: job.id
          }
        });

        // Calculate split values
        let computedShares = [];
        if (splitType.toUpperCase() === 'EQUAL') {
          const splitShareAmount = totalAmountInInr / splits.length;
          computedShares = splits.map(s => ({
            userId: s.userId,
            shareValue: 1.0,
            amountInInr: splitShareAmount
          }));
        } else if (splitType.toUpperCase() === 'PERCENTAGE') {
          let percentageSum = 0;
          computedShares = splits.map(s => {
            const pct = parseFloat(s.shareValue);
            percentageSum += pct;
            return {
              userId: s.userId,
              shareValue: pct,
              amountInInr: totalAmountInInr * (pct / 100)
            };
          });

          if (Math.abs(percentageSum - 100) > 0.05) {
            throw new Error(`Row ${rowIndex}: Split percentages must sum to 100%. Got ${percentageSum}%`);
          }
        } else if (splitType.toUpperCase() === 'EXACT') {
          let exactSum = 0;
          computedShares = splits.map(s => {
            const amt = parseFloat(s.shareValue);
            exactSum += amt;
            return {
              userId: s.userId,
              shareValue: amt,
              amountInInr: amt // Exact split amounts are already in INR
            };
          });

          if (Math.abs(exactSum - totalAmountInInr) > 0.1) {
            throw new Error(`Row ${rowIndex}: Split exact amounts must sum to total expense amount in INR (${totalAmountInInr}). Got ${exactSum}`);
          }
        } else if (splitType.toUpperCase() === 'SHARE') {
          const totalSharesSum = splits.reduce((sum, s) => sum + parseFloat(s.shareValue), 0);
          if (totalSharesSum <= 0) {
            throw new Error(`Row ${rowIndex}: Sum of share ratios must be greater than zero.`);
          }
          computedShares = splits.map(s => {
            const ratio = parseFloat(s.shareValue);
            return {
              userId: s.userId,
              shareValue: ratio,
              amountInInr: totalAmountInInr * (ratio / totalSharesSum)
            };
          });
        }

        // Insert Expense Shares
        for (const share of computedShares) {
          await tx.expenseShare.create({
            data: {
              expenseId: expense.id,
              userId: share.userId,
              shareValue: share.shareValue,
              amountInInr: share.amountInInr
            }
          });
        }

        importedExpensesCount++;
      } else if (action === 'IMPORT_SETTLEMENT') {
        const {
          date,
          fromUserId,
          toUserId,
          amount,
          notes
        } = data;

        if (!date || !fromUserId || !toUserId || !amount) {
          throw new Error(`Row ${rowIndex}: Missing required fields for settlement import.`);
        }

        const parsedAmount = parseFloat(amount);

        // Create the Settlement
        await tx.settlement.create({
          data: {
            groupId: job.groupId,
            fromUserId,
            toUserId,
            amount: parsedAmount,
            date: new Date(date),
            notes: notes || null,
            importJobId: job.id
          }
        });

        importedSettlementsCount++;
      }
    }

    // Mark all anomalies as resolved for this job
    await tx.importAnomaly.updateMany({
      where: { importJobId: job.id },
      data: { isResolved: true }
    });

    // Update ImportJob status to COMPLETED
    await tx.importJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED' }
    });

    return {
      importedExpenses: importedExpensesCount,
      importedSettlements: importedSettlementsCount,
      skipped: skippedCount
    };
  });

  return result;
}

module.exports = {
  resolveAndImport
};
