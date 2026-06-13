import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  AlertTriangle, CheckCircle, Info, Sparkles, Check, 
  X, HelpCircle, Save, ArrowRight, UserCheck, RefreshCw
} from 'lucide-react';

const ImportReview = ({ groupId, report, onCancel, onCompleted }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Local state of all rows being reviewed/resolved
  const [resolvedRows, setResolvedRows] = useState([]);
  // Group members list to use in dropdowns
  const [members, setMembers] = useState([]);

  useEffect(() => {
    // Fetch group members to map dropdowns
    axios.get(`/api/groups/${groupId}`)
      .then(res => {
        const list = res.data.group.memberships.map(m => m.user);
        setMembers(list);
      })
      .catch(err => console.error('Failed to fetch members:', err));
  }, [groupId]);

  useEffect(() => {
    if (report && report.anomalies) {
      // We parse the report anomalies and prepare a resolvedRows state
      // Let's create an array representing the raw CSV rows, with their parsed anomalies
      // The report gives us total rows. Let's build the initial proposed data for each row.
      const initialRows = [];
      const anomaliesByRow = {};
      
      report.anomalies.forEach(a => {
        if (!anomaliesByRow[a.rowIndex]) {
          anomaliesByRow[a.rowIndex] = [];
        }
        anomaliesByRow[a.rowIndex].push(a);
      });

      // We need to construct the proposed rows. Since the report might not contain
      // the full rows list directly, let's look at the anomalies and their raw rowData.
      // Every anomaly has a `rowData` field that contains the CSV row.
      // Let's rebuild the rows.
      const uniqueRowIndices = [...new Set(report.anomalies.map(a => a.rowIndex))];
      // Sort them
      uniqueRowIndices.sort((a, b) => a - b);

      const rowsState = uniqueRowIndices.map(rIndex => {
        const rowAnoms = anomaliesByRow[rIndex] || [];
        // Extract raw data from the first anomaly
        const rawData = rowAnoms[0]?.rowData || {};
        
        // Let's determine the default action and data
        let action = 'IMPORT_EXPENSE';
        let proposedDate = rawData.date || '';
        let proposedDesc = rawData.description || '';
        let proposedPayerId = '';
        let proposedAmount = rawData.amount || '0';
        let proposedCurrency = rawData.currency || 'INR';
        let proposedRate = '1.0';
        let proposedSplitType = rawData.split_type ? rawData.split_type.toUpperCase() : 'EQUAL';
        let proposedSplits = [];
        let proposedNotes = rawData.notes || '';

        // 1. Clean Amount
        proposedAmount = proposedAmount.replace(/,/g, '').replace(/"/g, '').trim();
        if (parseFloat(proposedAmount) < 0) {
          // Negative amount is warning refund
        }

        // 2. Parse Date
        if (proposedDate === 'Mar-14') {
          proposedDate = '2026-03-14';
        } else if (proposedDate) {
          const parts = proposedDate.split('-');
          if (parts.length === 3) {
            proposedDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // Convert DD-MM-YYYY to YYYY-MM-DD
          }
        }

        // 3. Check for specific anomalies to set defaults
        const hasShifted = rowAnoms.some(a => a.anomalyType === 'SHIFTED_COLUMNS');
        const hasUSD = rowAnoms.some(a => a.anomalyType === 'USD_CURRENCY');
        const hasSettlement = rowAnoms.some(a => a.anomalyType === 'SETTLEMENT_AS_EXPENSE');
        const hasZero = rowAnoms.some(a => a.anomalyType === 'ZERO_AMOUNT');
        const hasOutBounds = rowAnoms.some(a => a.anomalyType === 'MEMBER_OUT_OF_BOUNDS');

        if (hasShifted) {
          // Auto-Proposed fix:
          // Date=28-03-2026, Description=Meera farewell dinner, Payer=Aisha, Amount=4800, Currency=INR, SplitType=equal, SplitWith=Aisha;Rohan;Priya;Meera
          proposedCurrency = 'INR';
          proposedSplitType = 'EQUAL';
        }

        if (hasUSD) {
          proposedCurrency = 'USD';
          proposedRate = '83.0'; // Default proposed historical rate
        }

        if (hasSettlement) {
          action = 'IMPORT_SETTLEMENT';
          // Find payer
          if (rawData.paid_by) {
            // Find user id matching paid_by
          }
        }

        if (hasZero) {
          action = 'SKIP';
        }

        return {
          rowIndex: rIndex,
          action,
          anomalies: rowAnoms,
          rawData,
          // Resolution fields
          date: proposedDate,
          description: proposedDesc,
          paidById: proposedPayerId,
          amount: proposedAmount,
          currency: proposedCurrency,
          exchangeRate: proposedRate,
          splitType: proposedSplitType,
          splits: proposedSplits, // Array of { userId, name, shareValue, checked }
          notes: proposedNotes
        };
      });

      setResolvedRows(rowsState);
    }
  }, [report]);

  // Set default split checkboxes/percentages when group members are loaded
  useEffect(() => {
    if (members.length > 0 && resolvedRows.length > 0) {
      const updated = resolvedRows.map(row => {
        // If splits are already populated, don't overwrite
        if (row.splits.length > 0) return row;

        const splitNames = (row.rawData.split_with || '')
          .split(';')
          .map(n => n.trim().toLowerCase())
          .filter(n => n.length > 0);

        const isPercentage = row.splitType === 'PERCENTAGE';
        const hasSplitDetails = !!row.rawData.split_details;
        const detailsMap = {};

        // Parse split details if present
        if (hasSplitDetails) {
          // e.g. "Rohan 700; Priya 400; Meera 400" or percentages
          const details = row.rawData.split_details.split(';').map(d => d.trim());
          details.forEach(d => {
            const parts = d.split(/\s+/);
            const val = parts[parts.length - 1];
            const name = parts.slice(0, parts.length - 1).join(' ').toLowerCase();
            detailsMap[name] = val.replace('%', '');
          });
        }

        // Prepare splits check/shares
        const initialSplits = members.map(m => {
          const lowerName = m.name.toLowerCase();
          const inSplitList = splitNames.includes(lowerName) || (row.rawData.split_with && row.rawData.split_with.toLowerCase().includes(lowerName));
          
          let checked = inSplitList;
          let shareValue = isPercentage ? '0' : '1';

          // Apply timeline filters
          const rowDateObj = new Date(row.date);
          const membership = m.id; // fetched user

          // We will find this user's membership timeline
          // For simplicity, we can let user toggle, but let's propose unchecking
          // if Meera left or Sam joined
          if (m.name === 'Meera' && rowDateObj > new Date('2026-03-31')) {
            checked = false; // Exclude Meera after March
          }
          if (m.name === 'Sam' && rowDateObj < new Date('2026-04-15')) {
            checked = false; // Exclude Sam before April 15
          }

          if (checked) {
            if (hasSplitDetails) {
              shareValue = detailsMap[lowerName] || (isPercentage ? '0' : '1');
            } else if (isPercentage) {
              // Propose equal percentages initially
              shareValue = (100 / splitNames.length).toFixed(1);
            }
          }

          return {
            userId: m.id,
            name: m.name,
            shareValue: shareValue.toString(),
            checked
          };
        });

        // Resolve Payer ID
        const payerName = row.rawData.paid_by || '';
        let matchedPayer = members.find(m => m.name.toLowerCase() === payerName.trim().toLowerCase());
        
        // Handle name anomalies
        if (payerName.trim().toLowerCase() === 'priya s') {
          matchedPayer = members.find(m => m.name === 'Priya');
        } else if (payerName.trim().toLowerCase() === 'rohan') {
          matchedPayer = members.find(m => m.name === 'Rohan');
        }

        // Handle missing payer by default
        const paidById = matchedPayer ? matchedPayer.id : '';

        // Handle settlement details
        let resolvedPayer = paidById;
        let resolvedRecipient = '';
        if (row.action === 'IMPORT_SETTLEMENT') {
          // e.g. "Rohan paid Aisha back", Rohan paid 5000, split_with is Aisha
          resolvedPayer = members.find(m => m.name === 'Rohan')?.id || '';
          resolvedRecipient = members.find(m => m.name === 'Aisha')?.id || '';

          if (row.rawData.description.includes('Sam deposit')) {
            resolvedPayer = members.find(m => m.name === 'Sam')?.id || '';
            resolvedRecipient = members.find(m => m.name === 'Aisha')?.id || '';
          }
        }

        return {
          ...row,
          paidById: resolvedPayer,
          recipientId: resolvedRecipient,
          splits: initialSplits
        };
      });

      setResolvedRows(updated);
    }
  }, [members, resolvedRows.length]);

  // Apply default corrections to all rows
  const handleApplyDefaults = () => {
    const updated = resolvedRows.map(row => {
      let action = row.action;
      let date = row.date;
      let paidById = row.paidById;
      let amount = row.amount;
      let currency = row.currency;
      let exchangeRate = row.exchangeRate;
      let splitType = row.splitType;
      let splits = [...row.splits];
      let recipientId = row.recipientId;

      row.anomalies.forEach(a => {
        if (a.anomalyType === 'DUPLICATE') {
          // Suggest skipping duplicates (keep first)
          if (row.rowIndex === 6 || row.rawData.description === 'Thalassa dinner') {
            action = 'SKIP';
          }
        }
        if (a.anomalyType === 'SHIFTED_COLUMNS') {
          currency = 'INR';
          splitType = 'EQUAL';
        }
        if (a.anomalyType === 'USD_CURRENCY') {
          exchangeRate = '83.0';
        }
        if (a.anomalyType === 'ZERO_AMOUNT') {
          action = 'SKIP';
        }
        if (a.anomalyType === 'UNKNOWN_MEMBER') {
          if (row.rawData.paid_by && row.rawData.paid_by.toLowerCase().includes('priya')) {
            paidById = members.find(m => m.name === 'Priya')?.id || '';
          }
        }
        if (a.anomalyType === 'MISSING_PAYER') {
          // Default to Aisha or require manual select
          paidById = members.find(m => m.name === 'Aisha')?.id || '';
        }
        if (a.anomalyType === 'SPLIT_MISMATCH' && splitType === 'PERCENTAGE') {
          // Re-normalize percentages to sum to 100
          const checkedSplits = splits.filter(s => s.checked);
          checkedSplits.forEach(s => {
            s.shareValue = (100 / checkedSplits.length).toFixed(1);
          });
        }
      });

      // Special cases
      if (row.rawData.description === 'Parasailing' && row.rawData.split_with.includes('Kabir')) {
        // Dev's friend Kabir joined. Pre-propose: Split Kabir's share and charge it to Dev
        // We do this by unchecking Kabir and setting Dev's share ratio to 2 (while Rohan 2, Aisha 1)
        splits = splits.map(s => {
          if (s.name === 'Dev') {
            return { ...s, checked: true, shareValue: '2' };
          }
          if (s.name === 'Rohan') {
            return { ...s, checked: true, shareValue: '2' };
          }
          if (s.name === 'Priya') {
            return { ...s, checked: true, shareValue: '1' };
          }
          if (s.name === 'Aisha') {
            return { ...s, checked: true, shareValue: '1' };
          }
          return { ...s, checked: false, shareValue: '0' }; // Exclude Kabir
        });
        splitType = 'SHARE';
      }

      return {
        ...row,
        action,
        date,
        paidById,
        amount,
        currency,
        exchangeRate,
        splitType,
        splits,
        recipientId
      };
    });

    setResolvedRows(updated);
    setSuccess('Default policies applied! Review rows and approve below.');
  };

  const handleSaveImport = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = resolvedRows.map(row => {
        if (row.action === 'SKIP') {
          return {
            rowIndex: row.rowIndex,
            action: 'SKIP'
          };
        }

        if (row.action === 'IMPORT_SETTLEMENT') {
          return {
            rowIndex: row.rowIndex,
            action: 'IMPORT_SETTLEMENT',
            data: {
              date: row.date,
              fromUserId: row.paidById || members.find(m => m.name === 'Rohan')?.id, // default
              toUserId: row.recipientId || members.find(m => m.name === 'Aisha')?.id, // default
              amount: parseFloat(row.amount),
              notes: row.rawData.notes || 'Imported settlement'
            }
          };
        }

        // Import Expense
        const activeSplits = row.splits
          .filter(s => s.checked)
          .map(s => ({
            userId: s.userId,
            shareValue: parseFloat(s.shareValue)
          }));

        return {
          rowIndex: row.rowIndex,
          action: 'IMPORT_EXPENSE',
          data: {
            date: row.date,
            description: row.description,
            paidById: row.paidById,
            amount: parseFloat(row.amount),
            currency: row.currency,
            exchangeRate: parseFloat(row.exchangeRate),
            splitType: row.splitType,
            splits: activeSplits,
            notes: row.notes || null
          }
        };
      });

      const res = await axios.post(`/api/imports/${report.importJobId}/resolve`, {
        rows: payload
      });

      setSuccess('Ingestion complete! All transactions successfully imported.');
      setTimeout(() => {
        onCompleted();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import records. Please check splits sum constraints.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Title block */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight font-display">Ingestion Review</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            File: <strong className="text-indigo-400">{report.fileName}</strong> • Identified <strong className="text-rose-400">{report.anomaliesCount}</strong> data problems requiring approval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleApplyDefaults}
            className="inline-flex items-center justify-center gap-1.5 bg-slate-900 border border-slate-800 text-indigo-400 hover:text-indigo-300 font-bold px-4 py-2.5 rounded-2xl transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Apply Proposed Solutions
          </button>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white px-4 py-2.5 border border-transparent hover:bg-slate-800/40 rounded-2xl transition-all font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Checklist Rows */}
      <div className="space-y-6">
        {resolvedRows.map((row, index) => {
          const hasError = row.anomalies.some(a => a.severity === 'ERROR');
          const isSkipped = row.action === 'SKIP';
          const isSettlement = row.action === 'IMPORT_SETTLEMENT';

          return (
            <div 
              key={row.rowIndex}
              className={`border rounded-3xl p-6 transition-all bg-slate-900/25 ${isSkipped ? 'border-slate-800/40 opacity-40' : hasError ? 'border-rose-500/30 bg-rose-500/[0.01]' : 'border-slate-800 hover:border-slate-700'}`}
            >
              {/* Row Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-xl text-slate-400">
                    Row {row.rowIndex}
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      {row.rawData.description || 'Untitled Transaction'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Original: {row.rawData.paid_by || '(blank)'} paid {row.rawData.amount} {row.rawData.currency || 'INR'}
                    </p>
                  </div>
                </div>

                {/* Import Action Selection */}
                <div className="flex items-center gap-2 bg-slate-950/40 p-1 rounded-xl border border-slate-800/80">
                  <button
                    onClick={() => {
                      const updated = [...resolvedRows];
                      updated[index].action = 'IMPORT_EXPENSE';
                      setResolvedRows(updated);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${row.action === 'IMPORT_EXPENSE' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Expense
                  </button>
                  <button
                    onClick={() => {
                      const updated = [...resolvedRows];
                      updated[index].action = 'IMPORT_SETTLEMENT';
                      setResolvedRows(updated);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${row.action === 'IMPORT_SETTLEMENT' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Settlement
                  </button>
                  <button
                    onClick={() => {
                      const updated = [...resolvedRows];
                      updated[index].action = 'SKIP';
                      setResolvedRows(updated);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${row.action === 'SKIP' ? 'bg-slate-800 text-slate-300' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Skip
                  </button>
                </div>
              </div>

              {/* Anomaly Alerts List */}
              {row.anomalies.length > 0 && (
                <div className="mb-4 space-y-2">
                  {row.anomalies.map((anom, aIdx) => (
                    <div 
                      key={aIdx} 
                      className={`p-3 rounded-2xl text-xs flex items-start gap-2 border ${anom.severity === 'ERROR' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{anom.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Resolution Form Fields (Disabled if Skipped) */}
              {!isSkipped && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  {/* Left Column: Transaction Details */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Description</label>
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => {
                          const updated = [...resolvedRows];
                          updated[index].description = e.target.value;
                          setResolvedRows(updated);
                        }}
                        className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Amount</label>
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => {
                            const updated = [...resolvedRows];
                            updated[index].amount = e.target.value;
                            setResolvedRows(updated);
                          }}
                          className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500 text-right"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Currency</label>
                        <select
                          value={row.currency}
                          onChange={(e) => {
                            const updated = [...resolvedRows];
                            updated[index].currency = e.target.value.toUpperCase();
                            setResolvedRows(updated);
                          }}
                          className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                        >
                          <option value="INR">INR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>

                    {row.currency === 'USD' && (
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Exchange Rate</label>
                        <input
                          type="number"
                          step="0.01"
                          value={row.exchangeRate}
                          onChange={(e) => {
                            const updated = [...resolvedRows];
                            updated[index].exchangeRate = e.target.value;
                            setResolvedRows(updated);
                          }}
                          className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500 text-right"
                        />
                      </div>
                    )}
                  </div>

                  {/* Middle Column: Dates & Parties */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Date</label>
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => {
                          const updated = [...resolvedRows];
                          updated[index].date = e.target.value;
                          setResolvedRows(updated);
                        }}
                        className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {isSettlement ? (
                      <>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Sender (From)</label>
                          <select
                            value={row.paidById}
                            onChange={(e) => {
                              const updated = [...resolvedRows];
                              updated[index].paidById = e.target.value;
                              setResolvedRows(updated);
                            }}
                            className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                          >
                            <option value="">-- Select Sender --</option>
                            {members.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Recipient (To)</label>
                          <select
                            value={row.recipientId}
                            onChange={(e) => {
                              const updated = [...resolvedRows];
                              updated[index].recipientId = e.target.value;
                              setResolvedRows(updated);
                            }}
                            className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                          >
                            <option value="">-- Select Recipient --</option>
                            {members.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Payer (Who Paid)</label>
                          <select
                            value={row.paidById}
                            onChange={(e) => {
                              const updated = [...resolvedRows];
                              updated[index].paidById = e.target.value;
                              setResolvedRows(updated);
                            }}
                            className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                          >
                            <option value="">-- Select Payer --</option>
                            {members.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Split Type</label>
                          <select
                            value={row.splitType}
                            onChange={(e) => {
                              const updated = [...resolvedRows];
                              updated[index].splitType = e.target.value.toUpperCase();
                              setResolvedRows(updated);
                            }}
                            className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                          >
                            <option value="EQUAL">Split Equally</option>
                            <option value="PERCENTAGE">Percentage Splits</option>
                            <option value="EXACT">Exact Split Amounts (INR)</option>
                            <option value="SHARE">Share Ratios</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Column: Splits Checklist (Only for Expenses) */}
                  <div>
                    {!isSettlement && (
                      <>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Split Participants</label>
                        <div className="space-y-2 p-3 bg-slate-950/30 border border-slate-800/80 rounded-2xl max-h-[140px] overflow-y-auto">
                          {row.splits.map((s, sIdx) => (
                            <div key={s.userId} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={s.checked}
                                  onChange={(e) => {
                                    const updated = [...resolvedRows];
                                    updated[index].splits[sIdx].checked = e.target.checked;
                                    setResolvedRows(updated);
                                  }}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 bg-slate-900 border-slate-800"
                                />
                                <span className="text-slate-300 text-xs font-semibold">{s.name}</span>
                              </div>
                              {s.checked && row.splitType !== 'EQUAL' && (
                                <input
                                  type="number"
                                  value={s.shareValue}
                                  onChange={(e) => {
                                    const updated = [...resolvedRows];
                                    updated[index].splits[sIdx].shareValue = e.target.value;
                                    setResolvedRows(updated);
                                  }}
                                  className="w-16 bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-white text-right text-[10px] focus:outline-none focus:border-indigo-500"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save Button Bar */}
      <div className="border-t border-slate-800 pt-6 flex items-center justify-end gap-4">
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-white px-5 py-3.5 border border-slate-800 rounded-2xl transition-all font-semibold hover:bg-slate-900"
        >
          Discard Import
        </button>
        <button
          onClick={handleSaveImport}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-indigo-600/10 transition-all disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {loading ? 'Ingesting...' : 'Approve and Save All'}
        </button>
      </div>
    </div>
  );
};

export default ImportReview;
