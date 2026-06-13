import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Users, FolderKanban, MessageSquare, ArrowRight, X } from 'lucide-react';

const Dashboard = ({ onSelectGroup }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await axios.get('/api/groups');
      setGroups(res.data.groups);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!name) return;
    setCreating(true);
    setError('');

    try {
      const res = await axios.post('/api/groups', { name, description });
      setGroups([...groups, res.data.group]);
      setShowModal(false);
      setName('');
      setDescription('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 p-8 rounded-3xl backdrop-blur-md">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight font-display">Shared Expenses</h1>
          <p className="text-slate-400 mt-1">Manage shared bills, resolve spreadsheets, and track balances transparently.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3.5 rounded-2xl font-semibold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all self-start md:self-auto"
        >
          <Plus className="w-5 h-5" />
          Create Group
        </button>
      </div>

      {/* Group List */}
      <div>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-indigo-400" />
          Your Active Groups
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-slate-900/20 border border-slate-800/60 h-48 rounded-3xl animate-pulse"></div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/10 border border-slate-800/40 rounded-3xl border-dashed">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300">No Groups Found</h3>
            <p className="text-slate-500 text-sm mt-1 mb-6">Create a group to start logging expenses and splitting bills.</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 px-5 py-2.5 rounded-2xl font-semibold transition-colors"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group.id)}
                className="group cursor-pointer bg-slate-900/30 hover:bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 p-6 rounded-3xl transition-all shadow-xl hover:-translate-y-1 duration-300 relative overflow-hidden"
              >
                {/* Accent glow on hover */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/10 rounded-full filter blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center justify-between">
                  {group.name}
                  <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </h3>
                
                <p className="text-slate-400 text-sm mt-2 line-clamp-2 min-h-[40px]">
                  {group.description || 'No description provided.'}
                </p>

                <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="flex -space-x-2 overflow-hidden">
                    {group.memberships.slice(0, 4).map((m) => (
                      <div
                        key={m.id}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 text-xs font-bold text-slate-300"
                        title={m.user.name}
                      >
                        {m.user.name.charAt(0)}
                      </div>
                    ))}
                    {group.memberships.length > 4 && (
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-800 text-[10px] font-bold text-indigo-400">
                        +{group.memberships.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-slate-500 text-xs font-medium">
                    {group.memberships.length} member{group.memberships.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative animate-scaleUp">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">Create New Group</h3>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat Shared Expenses"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Description</label>
                <textarea
                  placeholder="Describe your group's budget or split goals..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              {error && <p className="text-rose-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={creating}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-3.5 font-semibold transition-colors shadow-lg shadow-indigo-600/15"
              >
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
