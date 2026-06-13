import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  ArrowLeft, Users, Calendar, Plus, Upload, Receipt, 
  ArrowRightLeft, AlertCircle, ChevronDown, Check, X, 
  Sparkles, ListCollapse, UserCheck
} from 'lucide-react';
import Balances from './Balances';

const GroupDetails = ({ groupId, onBack, onOpenImportReview }) => {
  const [group, setGroup] = useState(null);
  const [ledger, setLedger] = useState({ expenses: [], settlements: [] });
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  
  // Member Form
  const [memberEmail, setMemberEmail] = useState('');
  const [memberJoinDate, setMemberJoinDate] = useState('2026-02-01');
  const [memberLeaveDate, setMemberLeaveDate] = useState('');
  const [memberError, setMemberError] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Expense Form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCurrency, setExpCurrency] = useState('INR');
  const [expRate, setExpRate] = useState('1.0');
  const [expDate, setExpDate] = useState('2026-04-16');
  const [expSplitType, setExpSplitType] = useState('EQUAL');
  const [expShares, setExpShares] = useState({}); // { [userId]: shareValue }
  const [expNotes, setExpNotes] = useState('');
  const [expError, setExpError] = useState('');
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Settlement Form
  const [setRecipientId, setSetRecipientId] = useState('');
  const [setAmount, setSetAmount] = useState('');
  const [setDate, setSetDate] = useState('2026-04-20');
  const [setNotes, setSetNotes] = useState('');
  const [setErrorSet, setSetError] = useState('');
  const [submittingSettlement, setSubmittingSettlement] = useState(false);

  // Navigation
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' or 'balances'
  
  // CSV File Upload
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const groupRes = await axios.get(`/api/groups/${groupId}`);
      const ledgerRes = await axios.get(`/api/groups/${groupId}/ledger`);
      setGroup(groupRes.data.group);
      setLedger(ledgerRes.data);
    } catch (err) {
      console.error('Failed to load group details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  // Set default split values when memberships change
  useEffect(() => {
    if (group) {
      const initialShares = {};
      group.memberships.forEach(m => {
        initialShares[m.userId] = expSplitType === 'PERCENTAGE' ? '0' : '1';
      });
      setExpShares(initialShares);
    }
  }, [group, expSplitType]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setAddingMember(true);
    setMemberError('');

    try {
      await axios.post(`/api/groups/${groupId}/members`, {
        email: memberEmail,
        joinedAt: memberJoinDate || undefined,
        leftAt: memberLeaveDate || undefined
      });
      setShowMemberModal(false);
      setMemberEmail('');
      setMemberLeaveDate('');
      fetchData();
    } catch (err) {
      setMemberError(err.response?.data?.error || 'Failed to add member.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleMarkMemberLeft = async (userId, leftDate) => {
    try {
      await axios.put(`/api/groups/${groupId}/members/${userId}/leave`, {
        leftAt: leftDate
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update membership.');
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setSubmittingExpense(true);
    setExpError('');

    try {
      const selectedSplits = Object.keys(expShares)
        .filter(uid => parseFloat(expShares[uid]) > 0)
        .map(uid => ({
          userId: uid,
          shareValue: parseFloat(expShares[uid])
        }));

      if (selectedSplits.length === 0) {
        throw new Error('Please allocate splits to at least one member.');
      }

      await axios.post(`/api/groups/${groupId}/expenses`, {
        description: expDesc,
        amount: parseFloat(expAmount),
        currency: expCurrency,
        exchangeRate: parseFloat(expRate),
        date: expDate,
        splitType: expSplitType,
        splits: selectedSplits,
        notes: expNotes || undefined
      });

      setShowExpenseModal(false);
      setExpDesc('');
      setExpAmount('');
      setExpNotes('');
      fetchData();
    } catch (err) {
      setExpError(err.response?.data?.error || err.message || 'Failed to create expense.');
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleCreateSettlement = async (e) => {
    e.preventDefault();
    setSubmittingSettlement(true);
    setSetError('');

    try {
      await axios.post(`/api/groups/${groupId}/settlements`, {
        toUserId: setRecipientId,
        amount: parseFloat(setAmount),
        date: setDate,
        notes: setNotes || undefined
      });

      setShowSettlementModal(false);
      setSetRecipientId('');
      setSetAmount('');
      setSetNotes('');
      fetchData();
    } catch (err) {
      setSetError(err.response?.data?.error || 'Failed to create settlement.');
    } finally {
      setSubmittingSettlement(false);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    setUploadError('');

    try {
      const res = await axios.post(`/api/groups/${groupId}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { report } = res.data;
      onOpenImportReview(report);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'CSV upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (loading || !group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm">Loading group timeline and ledgers...</p>
      </div>
    );
  }

  // Combine expenses and settlements chronologically
  const ledgerItems = [
    ...ledger.expenses.map(e => ({ ...e, ledgerType: 'expense' })),
    ...ledger.settlements.map(s => ({ ...s, ledgerType: 'settlement' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 rounded-2xl text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">{group.name}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{group.description || 'Flatmate bills ledger'}</p>
          </div>
        </div>

        {/* CSV Import */}
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleCSVUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-indigo-400 hover:text-indigo-300 font-semibold px-4 py-2.5 rounded-2xl transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Processing...' : 'Import CSV'}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Details Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Members Timeline Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/20 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider text-slate-400">
                <Users className="w-4 h-4 text-indigo-400" />
                Members
              </h3>
              <button
                onClick={() => setShowMemberModal(true)}
                className="p-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-lg transition-colors"
                title="Add Member"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Member List with Timelines */}
            <div className="space-y-4">
              {group.memberships.map((m) => {
                const isInactive = !!m.leftAt;
                const joinStr = new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                const leaveStr = m.leftAt 
                  ? new Date(m.leftAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : 'Active';

                return (
                  <div key={m.id} className={`p-3.5 rounded-2xl border ${isInactive ? 'bg-slate-950/20 border-slate-900/50 opacity-50' : 'bg-slate-900/40 border-slate-800/50'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold text-sm ${isInactive ? 'text-slate-500 line-through' : 'text-white'}`}>
                        {m.user.name}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                        {isInactive ? 'Left' : 'Active'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-2">
                      <Calendar className="w-3 h-3 text-slate-600" />
                      <span>{joinStr} - {leaveStr}</span>
                    </div>

                    {!isInactive && m.user.name === 'Meera' && (
                      <button
                        onClick={() => handleMarkMemberLeft(m.userId, '2026-03-31')}
                        className="mt-2 text-[10px] font-bold text-rose-400/80 hover:text-rose-400 flex items-center gap-1 transition-colors"
                      >
                        Set move out (Mar 31)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main View Column */}
        <div className="lg:col-span-3 space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-slate-800/80">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`pb-4 px-6 font-bold text-sm border-b-2 transition-all ${activeTab === 'ledger' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              Ledger Timeline
            </button>
            <button
              onClick={() => setActiveTab('balances')}
              className={`pb-4 px-6 font-bold text-sm border-b-2 transition-all ${activeTab === 'balances' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              Balances Summary
            </button>
          </div>

          {/* Ledger Tab View */}
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-3 rounded-2xl transition-all shadow-lg shadow-indigo-600/10"
                >
                  <Receipt className="w-4 h-4" />
                  Add Expense
                </button>
                <button
                  onClick={() => setShowSettlementModal(true)}
                  className="flex items-center justify-center gap-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold px-5 py-3 rounded-2xl transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Record Payment
                </button>
              </div>

              {/* Ledger List */}
              <div className="space-y-4">
                {ledgerItems.length === 0 ? (
                  <div className="text-center py-16 bg-slate-900/10 border border-slate-800/40 rounded-3xl">
                    <Receipt className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-300">No Transactions Found</h3>
                    <p className="text-slate-500 text-sm mt-1">Record a manual expense or upload your CSV spreadsheet above.</p>
                  </div>
                ) : (
                  ledgerItems.map((item) => {
                    const isExpense = item.ledgerType === 'expense';
                    const dateStr = new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

                    if (isExpense) {
                      return (
                        <div
                          key={item.id}
                          className="bg-slate-900/30 border border-slate-800/80 p-5 rounded-3xl flex flex-col md:flex-row md:items-start justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2.5">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600/15 text-indigo-400">
                                <Receipt className="w-4 h-4" />
                              </span>
                              <div>
                                <h4 className="font-bold text-white text-base">{item.description}</h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Paid by <strong className="text-slate-300">{item.payer.name}</strong> • {dateStr}
                                </p>
                              </div>
                            </div>

                            {/* Show splits breakdown on expand / detailed view */}
                            <div className="mt-4 flex flex-wrap gap-2">
                              {item.shares.map((share) => (
                                <span
                                  key={share.id}
                                  className="text-[10px] font-semibold bg-slate-800/50 border border-slate-800 px-2.5 py-1 rounded-full text-slate-400"
                                >
                                  {share.user.name}: ₹{parseFloat(share.amountInInr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-end shrink-0 self-start md:self-auto">
                            <span className="text-lg font-black text-white font-display">
                              ₹{parseFloat(item.amountInInr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                            {item.currency !== 'INR' && (
                              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                                {item.amount} {item.currency} @ {item.exchangeRate}
                              </span>
                            )}
                            {item.notes && (
                              <span className="text-[10px] italic text-slate-500 mt-2 block max-w-[200px] truncate" title={item.notes}>
                                "{item.notes}"
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      // Settlement
                      return (
                        <div
                          key={item.id}
                          className="bg-slate-900/20 border border-slate-800/60 p-4 rounded-3xl flex items-center justify-between gap-4 border-l-4 border-l-emerald-500/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400">
                              <ArrowRightLeft className="w-4 h-4" />
                            </span>
                            <div>
                              <h4 className="font-semibold text-slate-300 text-sm">
                                <strong>{item.fromUser.name}</strong> paid <strong>{item.toUser.name}</strong>
                              </h4>
                              <p className="text-[10px] text-slate-500 mt-0.5">{dateStr}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-sm font-extrabold text-emerald-400">
                              ₹{parseFloat(item.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      );
                    }
                  })
                )}
              </div>
            </div>
          )}

          {/* Balances Tab View */}
          {activeTab === 'balances' && (
            <Balances groupId={groupId} />
          )}

        </div>
      </div>

      {/* Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative animate-scaleUp">
            <button
              onClick={() => setShowMemberModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">Add Group Member</h3>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sam@example.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Join Date</label>
                  <input
                    type="date"
                    value={memberJoinDate}
                    onChange={(e) => setMemberJoinDate(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Leave Date (Optional)</label>
                  <input
                    type="date"
                    value={memberLeaveDate}
                    onChange={(e) => setMemberLeaveDate(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {memberError && <p className="text-rose-400 text-sm">{memberError}</p>}

              <button
                type="submit"
                disabled={addingMember}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-3.5 font-semibold transition-colors shadow-lg shadow-indigo-600/15"
              >
                {addingMember ? 'Adding...' : 'Add Member'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowExpenseModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">Add Expense</h3>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Groceries BigBasket"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Currency</label>
                  <select
                    value={expCurrency}
                    onChange={(e) => setExpCurrency(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {expCurrency === 'USD' && (
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Exchange Rate (USD to INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="83.00"
                    value={expRate}
                    onChange={(e) => setExpRate(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Date</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Split Type</label>
                  <select
                    value={expSplitType}
                    onChange={(e) => setExpSplitType(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="EQUAL">Split Equally</option>
                    <option value="PERCENTAGE">Percentage splits</option>
                    <option value="EXACT">Exact split amounts (INR)</option>
                    <option value="SHARE">Share ratios</option>
                  </select>
                </div>
              </div>

              {/* Splits Selection */}
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Split Details</label>
                <div className="space-y-3 p-4 bg-slate-950/30 border border-slate-800/80 rounded-2xl">
                  {group.memberships.map((m) => {
                    const isSelected = expShares[m.userId] !== undefined && parseFloat(expShares[m.userId]) > 0;
                    
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setExpShares({
                                ...expShares,
                                [m.userId]: checked ? (expSplitType === 'PERCENTAGE' ? '25' : '1') : '0'
                              });
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-900 border-slate-800"
                          />
                          <span className="text-slate-300 text-sm font-semibold">{m.user.name}</span>
                        </div>

                        {expSplitType !== 'EQUAL' && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={expShares[m.userId] || '0'}
                              onChange={(e) => setExpShares({
                                ...expShares,
                                [m.userId]: e.target.value
                              })}
                              className="w-24 bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-3 text-white focus:outline-none focus:border-indigo-500 text-right text-xs"
                            />
                            <span className="text-slate-500 text-xs font-semibold">
                              {expSplitType === 'PERCENTAGE' ? '%' : expSplitType === 'EXACT' ? 'INR' : 'shares'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Notes</label>
                <input
                  type="text"
                  placeholder="Additional contexts..."
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {expError && <p className="text-rose-400 text-sm">{expError}</p>}

              <button
                type="submit"
                disabled={submittingExpense}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-3.5 font-semibold transition-colors shadow-lg shadow-indigo-600/15"
              >
                {submittingExpense ? 'Creating...' : 'Create Expense'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {showSettlementModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative animate-scaleUp">
            <button
              onClick={() => setShowSettlementModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">Record Payment</h3>

            <form onSubmit={handleCreateSettlement} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Pay To</label>
                <select
                  required
                  value={setRecipientId}
                  onChange={(e) => setSetRecipientId(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="">-- Select Recipient --</option>
                  {group.memberships.map((m) => (
                    <option key={m.id} value={m.userId}>{m.user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={setAmount}
                  onChange={(e) => setSetAmount(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Date</label>
                <input
                  type="date"
                  value={setDate}
                  onChange={(e) => setSetDate(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Settle grocery dues"
                  value={setNotes}
                  onChange={(e) => setSetNotes(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {setErrorSet && <p className="text-rose-400 text-sm">{setErrorSet}</p>}

              <button
                type="submit"
                disabled={submittingSettlement}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-3.5 font-semibold transition-colors shadow-lg shadow-indigo-600/15"
              >
                {submittingSettlement ? 'Recording...' : 'Record Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default GroupDetails;
