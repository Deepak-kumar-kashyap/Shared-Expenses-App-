import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  DollarSign, Sparkles, HelpCircle, Receipt, ArrowRightLeft, 
  ChevronDown, ChevronUp, User, Coins
} from 'lucide-react';

const Balances = ({ groupId }) => {
  const [balancesData, setBalancesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDebts, setExpandedDebts] = useState({}); // { [debtIndex]: boolean }
  const [balanceSubTab, setBalanceSubTab] = useState('minimized'); // 'minimized' or 'detailed'

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/groups/${groupId}/balances`);
      setBalancesData(res.data.balances);
    } catch (err) {
      console.error('Failed to fetch group balances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [groupId]);

  const toggleExpandDebt = (idx) => {
    setExpandedDebts(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  if (loading || !balancesData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-2">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-xs">Computing group balances and ledgers...</p>
      </div>
    );
  }

  const { individualBalances, pairwiseDebts, minimizedSettlements } = balancesData;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Individual Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {individualBalances.map((user) => {
          const isCreditor = user.netBalance > 0;
          const isDebtor = user.netBalance < 0;
          return (
            <div key={user.id} className="bg-slate-900/30 border border-slate-800/80 p-4 rounded-3xl text-center backdrop-blur-sm">
              <span className="text-slate-400 font-semibold text-xs block truncate" title={user.name}>{user.name}</span>
              <span className={`text-base font-black font-display block mt-2 ${isCreditor ? 'text-emerald-400' : isDebtor ? 'text-rose-400' : 'text-slate-400'}`}>
                {isCreditor ? '+' : ''}₹{user.netBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[9px] text-slate-500 font-semibold">
                <div>
                  <span className="block text-left">Paid</span>
                  <span className="block text-slate-300">₹{user.totalPaid}</span>
                </div>
                <div>
                  <span className="block text-right">Owes</span>
                  <span className="block text-slate-300">₹{user.totalOwed}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Balance Sub-Navigation */}
      <div className="flex bg-slate-950/40 p-1.5 rounded-2xl border border-slate-800/60 max-w-sm">
        <button
          onClick={() => setBalanceSubTab('minimized')}
          className={`flex-1 text-center py-2 px-4 font-bold text-xs rounded-xl transition-all ${balanceSubTab === 'minimized' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Aisha's View (Who Pays Whom)
        </button>
        <button
          onClick={() => setBalanceSubTab('detailed')}
          className={`flex-1 text-center py-2 px-4 font-bold text-xs rounded-xl transition-all ${balanceSubTab === 'detailed' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Rohan's View (Detailed Audit)
        </button>
      </div>

      {/* Aisha's View: Minimized Settlements */}
      {balanceSubTab === 'minimized' && (
        <div className="space-y-4">
          <div className="bg-slate-900/10 border border-slate-800/80 p-5 rounded-3xl">
            <h3 className="font-extrabold text-white text-base mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Optimal Settlement Plan
            </h3>
            <p className="text-slate-400 text-xs">Aisha's Request: Collapsed group debts into the minimum number of payments.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {minimizedSettlements.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-slate-900/10 border border-slate-800/40 rounded-3xl border-dashed">
                <Coins className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <h4 className="font-bold text-slate-400 text-sm">All Settled Up!</h4>
                <p className="text-slate-500 text-xs mt-1">No pending debts between members in this group.</p>
              </div>
            ) : (
              minimizedSettlements.map((settlement, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-900/30 border border-slate-800 p-5 rounded-3xl flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs">
                      {settlement.fromUser.name.charAt(0)}
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Debtor</span>
                      <span className="font-extrabold text-white text-sm">{settlement.fromUser.name}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      pays
                    </span>
                    <span className="text-base font-black text-white font-display mt-2">
                      ₹{settlement.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Creditor</span>
                      <span className="font-extrabold text-white text-sm">{settlement.toUser.name}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs">
                      {settlement.toUser.name.charAt(0)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Rohan's View: Detailed Pairwise Ledgers */}
      {balanceSubTab === 'detailed' && (
        <div className="space-y-4">
          <div className="bg-slate-900/10 border border-slate-800/80 p-5 rounded-3xl">
            <h3 className="font-extrabold text-white text-base mb-1 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-400" />
              Detailed Peer-to-Peer Audit Trail
            </h3>
            <p className="text-slate-400 text-xs">Rohan's Request: Expand any balance to see the exact expense items and splits making it up.</p>
          </div>

          <div className="space-y-3">
            {pairwiseDebts.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/10 border border-slate-800/40 rounded-3xl border-dashed">
                <Coins className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <h4 className="font-bold text-slate-400 text-sm">No Audit Records</h4>
                <p className="text-slate-500 text-xs mt-1">No pairwise liabilities exist.</p>
              </div>
            ) : (
              pairwiseDebts.map((debt, idx) => {
                const isExpanded = !!expandedDebts[idx];
                return (
                  <div 
                    key={idx} 
                    className="bg-slate-900/20 border border-slate-800/60 rounded-3xl overflow-hidden transition-all duration-300"
                  >
                    {/* Header trigger */}
                    <div 
                      onClick={() => toggleExpandDebt(idx)}
                      className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-200">
                          <strong>{debt.fromUser.name}</strong> owes <strong>{debt.toUser.name}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-extrabold text-white text-base font-display">
                          ₹{debt.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                    </div>

                    {/* Collapsible details */}
                    {isExpanded && (
                      <div className="border-t border-slate-800/50 bg-slate-950/30 p-5 space-y-4">
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Audit Ledger</h5>
                        <div className="space-y-3.5">
                          {debt.ledger.map((item, lIdx) => {
                            const isEx = item.type === 'expense';
                            const amt = parseFloat(item.amountInInr);
                            const direction = item.direction; // 'sent' or 'received'

                            return (
                              <div key={lIdx} className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 bg-slate-900/30 border border-slate-800/40 rounded-2xl">
                                <div className="flex items-start gap-2.5">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs mt-0.5 ${isEx ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    {isEx ? <Receipt className="w-3.5 h-3.5" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                                  </span>
                                  <div>
                                    <span className="font-bold text-white text-xs block">{item.description}</span>
                                    <span className="text-[10px] text-slate-500 block mt-0.5">
                                      {new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                      {isEx && (
                                        <> • Total: {item.originalCurrency !== 'INR' ? `${item.originalAmount} ${item.originalCurrency}` : `₹${item.originalAmount}`}</>
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className={`text-xs font-black font-display block ${direction === 'sent' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {direction === 'sent' ? '+' : ''}₹{amt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                  </span>
                                  <span className="text-[9px] text-slate-500 uppercase font-semibold">
                                    {direction === 'sent' ? `Owed to ${debt.toUser.name}` : `Settlement offset`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Balances;
