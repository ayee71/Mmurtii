import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, AlertCircle, CheckCircle2, Terminal, Activity, Search } from 'lucide-react';
import { Language } from '../i18n/translations';
import { db } from '../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

interface AdminLogsViewProps {
  currentLang: Language;
}

export const AdminLogsView: React.FC<AdminLogsViewProps> = ({ currentLang }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'TelegramActivity' | 'SystemActivity'>('all');

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      setLoading(true);
      const q = collection(db, 'telegram_logs');
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
            const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
            const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
            return timeB - timeA;
          });
          setLogs(list);
          setLoading(false);
        },
        (err) => {
          console.warn('[AdminLogsView] Error syncing telegram_logs:', err);
          setLoading(false);
        }
      );
    } catch (e) {
      console.warn('[AdminLogsView] Listener setup notice:', e);
      setLoading(false);
    }

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filterStatus === 'success' && log.status !== 'success' && log.ok !== true) return false;
    if (filterStatus === 'error' && log.status !== 'error' && log.status !== 'failed' && log.ok !== false) return false;

    if (filterCategory === 'TelegramActivity') {
      const isTelegram = Boolean(
        log.chatId ||
        log.telegramUserId ||
        log.updateType ||
        log.mode ||
        String(log.action || '').toLowerCase().includes('telegram') ||
        String(log.event || '').toLowerCase().includes('telegram')
      );
      if (!isTelegram) return false;
    } else if (filterCategory === 'SystemActivity') {
      const isTelegram = Boolean(
        log.chatId ||
        log.telegramUserId ||
        log.updateType ||
        log.mode ||
        String(log.action || '').toLowerCase().includes('telegram') ||
        String(log.event || '').toLowerCase().includes('telegram')
      );
      if (isTelegram) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAction = (log.action || log.event || log.updateType || '').toLowerCase().includes(q);
      const matchUser = (log.username || log.userId || log.sender || '').toLowerCase().includes(q);
      const matchSummary = JSON.stringify(log).toLowerCase().includes(q);
      if (!matchAction && !matchUser && !matchSummary) return false;
    }
    return true;
  });

  const [statusModal, setStatusModal] = useState<{ open: boolean; loading: boolean; data?: any; error?: string }>({ open: false, loading: false });

  const handleTestStatus = async () => {
    setStatusModal({ open: true, loading: true });
    try {
      const { auth } = await import('../services/firebase');
      const idToken = await auth.currentUser?.getIdToken().catch(() => '');
      const r = await fetch('/api/telegram/status', {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });
      const d = await r.json();
      setStatusModal({ open: true, loading: false, data: d });
    } catch (e: any) {
      setStatusModal({ open: true, loading: false, error: e.message });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold uppercase">
            <Shield className="w-3.5 h-3.5" />
            <span>SuperAdmin Security &amp; Audit Trail</span>
          </div>
          <h2 className="text-2xl font-black text-white">
            {currentLang === 'om' ? 'Galmee Dogoggoraa & Telegram Logs (Admin Logs)' : 'የቴሌግራም እና ሲስተም ምዝግብ ማስታወሻዎች'}
          </h2>
          <p className="text-xs text-slate-400">
            Real-time troubleshooting &amp; webhook audit trail fetched directly from Firestore &apos;telegram_logs&apos;.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestStatus}
            disabled={statusModal.loading}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow"
          >
            <Activity className={`w-4 h-4 ${statusModal.loading ? 'animate-spin' : ''}`} />
            <span>{statusModal.loading ? 'Checking...' : 'Test Telegram Status'}</span>
          </button>
        </div>
      </div>

      {/* Inline Telegram Status Modal */}
      {statusModal.open && (
        <div className="bg-slate-900 border border-sky-500/40 rounded-2xl p-4 shadow-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-sky-200">Telegram Status Inspection</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusModal({ open: false, loading: false })}
              className="text-xs font-mono px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              Close ✕
            </button>
          </div>
          {statusModal.loading ? (
            <div className="text-xs text-slate-400 flex items-center gap-2 py-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
              <span>Fetching status from /api/telegram/status...</span>
            </div>
          ) : statusModal.error ? (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 font-mono">
              Error checking status: {statusModal.error}
            </div>
          ) : (
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-60">
              {JSON.stringify(statusModal.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action, username, or payload details..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 pl-9 font-mono"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                filterStatus === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              All Status ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('success')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                filterStatus === 'success'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Success
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('error')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                filterStatus === 'error'
                  ? 'bg-rose-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Errors
            </button>
          </div>
        </div>

        {/* Activity Type Filters: TelegramActivity & SystemActivity */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mr-2">Activity Filter:</span>
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              filterCategory === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            All Activity
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('TelegramActivity')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              filterCategory === 'TelegramActivity'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-lg'
                : 'bg-slate-950 text-sky-300 border border-slate-800 hover:border-sky-500/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>TelegramActivity</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('SystemActivity')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              filterCategory === 'SystemActivity'
                ? 'bg-indigo-500 text-white font-bold shadow-lg'
                : 'bg-slate-950 text-indigo-300 border border-slate-800 hover:border-indigo-500/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>SystemActivity</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p>Loading real-time audit logs from Firestore...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs space-y-3">
            <Terminal className="w-10 h-10 text-slate-600 mx-auto" />
            <p>No activity logs found matching your filter criteria.</p>
            <p className="text-[10px] text-slate-500">
              Webhook requests sent to /api/telegram/webhook will be recorded here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Action / Event</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Sender / User</th>
                  <th className="p-3.5">Summary / Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredLogs.map((log, idx) => {
                  const isErr = log.status === 'error' || log.status === 'failed' || log.ok === false;
                  const displayTime =
                    log.timestamp || log.createdAt
                      ? new Date(log.timestamp || log.createdAt).toLocaleString()
                      : 'Recent';

                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 text-slate-400 text-[11px] whitespace-nowrap">{displayTime}</td>
                      <td className="p-3.5 font-bold text-amber-400">
                        {log.action || log.event || log.updateType || 'Webhook Update'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isErr
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          {isErr ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          <span>{log.status || (isErr ? 'ERROR' : 'SUCCESS')}</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300 text-[11px]">
                        @{log.username || log.sender || log.userId || 'System'}
                      </td>
                      <td className="p-3.5 text-slate-300 text-[11px] max-w-md truncate">
                        {log.error || log.summary || log.bodySummary || JSON.stringify(log.body || log)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLogsView;
