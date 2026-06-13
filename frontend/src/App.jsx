import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GroupDetails from './pages/GroupDetails';
import ImportReview from './pages/ImportReview';
import { LogOut, Coins, ShieldCheck, HelpCircle } from 'lucide-react';

const AppContent = () => {
  const { isAuthenticated, loading, user, logout } = useAuth();
  
  // State router
  const [view, setView] = useState('DASHBOARD'); // DASHBOARD, GROUP_DETAILS, IMPORT_REVIEW
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [importReport, setImportReport] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm">Restoring session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Premium Navigation Header */}
      <header className="bg-slate-950/40 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-4 flex items-center justify-between">
          <div 
            onClick={() => setView('DASHBOARD')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/15 group-hover:scale-105 transition-all">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-white text-lg tracking-tight font-display">
              Split<span className="text-indigo-400">Safe</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/40 border border-slate-800/60 py-1.5 px-3 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-xs">
                {user?.name?.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-slate-300">{user?.name}</span>
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center justify-center p-2.5 bg-slate-900/40 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/30 text-slate-400 hover:text-rose-400 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'DASHBOARD' && (
          <Dashboard
            onSelectGroup={(gid) => {
              setSelectedGroupId(gid);
              setView('GROUP_DETAILS');
            }}
          />
        )}

        {view === 'GROUP_DETAILS' && (
          <GroupDetails
            groupId={selectedGroupId}
            onBack={() => setView('DASHBOARD')}
            onOpenImportReview={(report) => {
              setImportReport(report);
              setView('IMPORT_REVIEW');
            }}
          />
        )}

        {view === 'IMPORT_REVIEW' && (
          <ImportReview
            groupId={selectedGroupId}
            report={importReport}
            onCancel={() => setView('GROUP_DETAILS')}
            onCompleted={() => setView('GROUP_DETAILS')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950/20 border-t border-slate-900/80 py-6 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 SplitSafe • Relational Ledger Ingestion Tool</span>
          <div className="flex items-center gap-1 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>PostgreSQL Financial Precision Guaranteed</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
