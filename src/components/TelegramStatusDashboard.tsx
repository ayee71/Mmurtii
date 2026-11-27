import React, { useState, useEffect } from 'react';
import { Language } from '../i18n/translations';
import {
  RefreshCw, CheckCircle2, AlertTriangle, Shield, Send, Activity, Terminal, Play, Radio,
  MessageSquare, Zap, Cpu, Copy, Check, Globe, Save, Rocket, Link2, X, Code, ExternalLink,
  Clock, ArrowUpRight, CheckCheck, FileText, CornerDownRight
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../services/firebase';
import { getAppBaseUrl } from '../services/shareUrl';
import {
  SYSTEM_SETTINGS_COLLECTION,
  TELEGRAM_SETTINGS_DOC_ID,
  TELEGRAM_WEBHOOK_PATH,
  validateTelegramWebhookUrl,
} from '../services/telegramWebhookConfig';

interface TelegramStatusDashboardProps {
  currentLang: Language;
}

export const TelegramStatusDashboard: React.FC<TelegramStatusDashboardProps> = ({ currentLang }) => {
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [pollingStarting, setPollingStarting] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [miniAppTesting, setMiniAppTesting] = useState(false);
  const [miniAppTestResult, setMiniAppTestResult] = useState<any>(null);
  const [bridgeTestToken, setBridgeTestToken] = useState('');
  const [copiedEndpoint, setCopiedEndpoint] = useState<'webhook' | 'bridge' | 'configuredWebhook' | null>(null);
  const [validatingReachability, setValidatingReachability] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const lastCheckedErrorIdRef = React.useRef<string | null>(null);
  const liveBaseUrl = getAppBaseUrl().replace(/\/+$/, '');
  const webhookEndpointUrl = `${liveBaseUrl}/api/telegram/webhook`;
  const bridgeEndpointUrl = `${liveBaseUrl}/api/miniapp/legal-ask`;
  const [manualWebhookUrl, setManualWebhookUrl] = useState<string>(() => webhookEndpointUrl);
  const [manualWebhookUrlTouched, setManualWebhookUrlTouched] = useState<boolean>(false);
  const [isSavingAndReconfiguring, setIsSavingAndReconfiguring] = useState<boolean>(false);

  // --- Webhook Test Fetch Modal State ---
  const [testingFetch, setTestingFetch] = useState(false);
  const [testFetchResult, setTestFetchResult] = useState<any>(null);
  const [testFetchModalOpen, setTestFetchModalOpen] = useState(false);
  const [copiedRawBody, setCopiedRawBody] = useState(false);
  const [showRawHeaders, setShowRawHeaders] = useState(false);
  const [copiedUrlToClipboard, setCopiedUrlToClipboard] = useState(false);

  // --- Last 5 Webhook Connection Attempts State (from 'telegram_logs') ---
  const [connectionAttempts, setConnectionAttempts] = useState<any[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  const handleCopyEndpoint = async (type: 'webhook' | 'bridge' | 'configuredWebhook', url: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedEndpoint(type);
      setTimeout(() => setCopiedEndpoint(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCopyUrlToClipboard = async (url: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrlToClipboard(true);
      setToastMessage({
        text:
          currentLang === 'om'
            ? `✓ Webhook URL clipboard irratti garagalfameera: ${url}`
            : `✓ Webhook URL copied to clipboard: ${url}`,
        type: 'success',
      });
      setTimeout(() => setCopiedUrlToClipboard(false), 2500);
    } catch {
      // ignore
    }
  };

  const getAuthHeaders = async (includeJson = false): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    } catch {
      // Ignore if unauthenticated
    }
    return headers;
  };

  const fetchConnectionAttempts = async (latestLogs?: any[]) => {
    setLoadingAttempts(true);
    try {
      let attempts: any[] = [];
      if (db) {
        try {
          const logsRef = collection(db, 'telegram_logs');
          const q = query(logsRef, orderBy('timestamp', 'desc'), limit(20));
          const snap = await getDocs(q);
          snap.forEach((docSnap) => {
            attempts.push({ id: docSnap.id, ...docSnap.data() });
          });
        } catch (dbErr: any) {
          try {
            handleFirestoreError(dbErr, OperationType.LIST, 'telegram_logs');
          } catch {
            // non-fatal
          }
        }
      }

      if (attempts.length === 0 && latestLogs && Array.isArray(latestLogs)) {
        attempts = [...latestLogs];
      } else if (attempts.length === 0 && statusData?.recentLogs && Array.isArray(statusData.recentLogs)) {
        attempts = [...statusData.recentLogs];
      }

      const webhookAttempts = attempts
        .filter((l: any) =>
          l.mode === 'webhook' ||
          String(l.action || '').toLowerCase().includes('webhook') ||
          String(l.updateType || '').toLowerCase().includes('webhook') ||
          l.updateType === 'admin_test_fetch' ||
          l.updateType === 'get_probe'
        )
        .slice(0, 5)
        .map((l: any) => {
          const rawStatus = l.status || 'unknown';
          const code =
            l.statusCode ??
            l.httpStatus ??
            (rawStatus === 'success'
              ? 200
              : String(l.error || '').toLowerCase().includes('unauthorized')
                ? 401
                : String(l.error || '').toLowerCase().includes('bad request')
                  ? 400
                  : String(l.error || '').toLowerCase().includes('method not allowed')
                    ? 405
                    : 500);
          return {
            ...l,
            statusCode: code,
            httpStatus: code,
          };
        });

      setConnectionAttempts(webhookAttempts);
    } catch (err) {
      console.warn('Failed to load webhook connection attempts:', err);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleTriggerTestFetch = async () => {
    const targetUrl = statusData?.configuredWebhookUrl || manualWebhookUrl || webhookEndpointUrl;
    setTestingFetch(true);
    try {
      const res = await fetch('/api/telegram/test-webhook-fetch', {
        method: 'POST',
        headers: await getAuthHeaders(true),
        body: JSON.stringify({ targetUrl }),
      });
      const data = await res.json();
      setTestFetchResult(data);
      setTestFetchModalOpen(true);
      void fetchStatus();
      void fetchConnectionAttempts();
    } catch (err: any) {
      setTestFetchResult({
        ok: false,
        testedUrl: targetUrl,
        httpStatus: 0,
        httpStatusText: 'Network / Client Error',
        headers: {},
        rawBody: err?.message || 'Failed to call /api/telegram/test-webhook-fetch',
        roundtripMs: 0,
        timestamp: new Date().toISOString(),
        explanation: 'Could not connect to the backend test probe endpoint.',
      });
      setTestFetchModalOpen(true);
    } finally {
      setTestingFetch(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/telegram/status', { headers: await getAuthHeaders(false) });
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
        if (data.recentLogs) {
          void fetchConnectionAttempts(data.recentLogs);
        }

        // Check for new error logs in recentLogs
        if (data.recentLogs && data.recentLogs.length > 0) {
          const latestError = data.recentLogs.find((log: any) => log.status === 'error' || log.status === 'failed');
          if (latestError && latestError.id !== lastCheckedErrorIdRef.current) {
            lastCheckedErrorIdRef.current = latestError.id;
            setToastMessage({
              text: currentLang === 'om' 
                ? `⚠️ Dogoggorri Telegram Bot uumameera: ${latestError.error}` 
                : `⚠️ Telegram webhook error detected: ${latestError.error}`,
              type: 'error'
            });
            setTimeout(() => setToastMessage(null), 6000);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch Telegram status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchConnectionAttempts();
    const interval = setInterval(fetchStatus, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const loadSavedWebhookSetting = async () => {
      try {
        if (!db) return;
        const snap = await getDoc(doc(db, SYSTEM_SETTINGS_COLLECTION, TELEGRAM_SETTINGS_DOC_ID));
        if (active && snap.exists()) {
          const data = snap.data();
          if (data?.telegramWebhookUrl && typeof data.telegramWebhookUrl === 'string') {
            setManualWebhookUrl(data.telegramWebhookUrl.trim());
            setManualWebhookUrlTouched(true);
          }
        }
      } catch (err) {
        // Non-blocking read fallback
      }
    };
    void loadSavedWebhookSetting();
    return () => {
      active = false;
    };
  }, []);

  const handleSaveAndReconfigureWebhook = async () => {
    const val = validateTelegramWebhookUrl(manualWebhookUrl);
    if (!val.valid) {
      setToastMessage({
        text: `⚠️ ${val.reason || 'Invalid webhook URL'}`,
        type: 'error',
      });
      return;
    }

    const targetUrl = val.normalizedUrl || manualWebhookUrl.trim();
    setIsSavingAndReconfiguring(true);

    try {
      // 1. Save directly into Firestore 'system_settings' collection
      const userEmail = auth.currentUser?.email || 'admin';
      const userUid = auth.currentUser?.uid || 'admin';
      const docPath = `${SYSTEM_SETTINGS_COLLECTION}/${TELEGRAM_SETTINGS_DOC_ID}`;

      if (db) {
        try {
          await setDoc(
            doc(db, SYSTEM_SETTINGS_COLLECTION, TELEGRAM_SETTINGS_DOC_ID),
            {
              telegramWebhookUrl: targetUrl,
              updatedByUid: userUid,
              updatedByEmail: userEmail,
              updatedAt: serverTimestamp(),
              lastValidationStatus: 'yellow',
              lastValidationMessage: 'Manual update from TelegramStatusDashboard',
            },
            { merge: true }
          );
        } catch (dbErr: any) {
          console.warn('Firestore write warning:', dbErr);
          try {
            handleFirestoreError(dbErr, OperationType.WRITE, docPath);
          } catch {
            // continue to backend update
          }
        }
      }

      // 2. Trigger webhook re-registration on backend with secret headers
      const headers = await getAuthHeaders(true);
      if (bridgeTestToken.trim()) {
        headers['x-telegram-setup-secret'] = bridgeTestToken.trim();
      }
      await fetch('/api/telegram/setup-webhook', {
        method: 'POST',
        headers,
        body: JSON.stringify({ webhookUrl: targetUrl }),
      });

      // 3. Trigger validation check against the bot engine
      const valRes = await fetch('/api/telegram/validate-config', {
        method: 'POST',
        headers: await getAuthHeaders(true),
        body: JSON.stringify({ webhookUrl: targetUrl }),
      });
      const valData = await valRes.json();

      await fetchStatus();

      const indicator = valData?.webhookReachability?.indicator || 'yellow';
      setToastMessage({
        text:
          currentLang === 'om'
            ? `✓ TELEGRAM_WEBHOOK_URL Firestore 'system_settings' keessatti kuufamee, Bot Engine haaromfameera! (${indicator.toUpperCase()})`
            : `✓ TELEGRAM_WEBHOOK_URL saved to Firestore 'system_settings' and Bot Engine reconfigured! (${indicator.toUpperCase()})`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Save & Reconfigure error:', err);
      setToastMessage({
        text: `⚠️ Save & Reconfigure failed: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsSavingAndReconfiguring(false);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  const handleStartPolling = async () => {
    setPollingStarting(true);
    try {
      const res = await fetch('/api/telegram/start-polling', { method: 'POST', headers: await getAuthHeaders(false) });
      const data = await res.json();
      if (res.ok && data.ok) {
        setToastMessage({
          text: currentLang === 'om'
            ? '✓ Sirni Long-Polling eegalameera! Bot @AyebeBot amma kallattiin deebisa.'
            : '✓ Telegram Long-Polling started! @AyebeBot is now actively answering.',
          type: 'success'
        });
        fetchStatus();
      } else {
        throw new Error(data.error || 'Failed to start polling');
      }
    } catch (err: any) {
      setToastMessage({
        text: `⚠️ ${err.message}`,
        type: 'error'
      });
    } finally {
      setPollingStarting(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleTestConnectivity = async () => {
    setTestingConn(true);
    try {
      const res = await fetch('/api/telegram/test-connectivity', { headers: await getAuthHeaders(false) });
      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage({
          text: currentLang === 'om'
            ? `✓ Bot Telegram @${data.bot?.username || 'AyebeBot'} waliin walqunnamtiin mirkanaa'eera!`
            : `✓ Successfully verified connectivity with @${data.bot?.username || 'AyebeBot'}!`,
          type: 'success'
        });
        fetchStatus();
      } else {
        throw new Error(data.message || 'Connectivity check failed');
      }
    } catch (err: any) {
      setToastMessage({
        text: `⚠️ Connectivity test error: ${err.message}`,
        type: 'error'
      });
    } finally {
      setTestingConn(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleRecheckReachability = async () => {
    setValidatingReachability(true);
    try {
      const res = await fetch('/api/telegram/validate-config', {
        method: 'POST',
        headers: await getAuthHeaders(true),
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatusData((prev: any) => ({
          ...(prev || {}),
          configuredWebhookUrl: data.configuredWebhookUrl,
          configuredWebhookUrlSource: data.configuredWebhookUrlSource,
          webhookUrls: data.webhookUrls,
          webhookReachability: data.webhookReachability,
          bot: data.bot || prev?.bot,
          webhook: data.webhook || prev?.webhook
        }));
        const ind = data.webhookReachability?.indicator;
        setToastMessage({
          text:
            ind === 'green'
              ? '✓ TELEGRAM_WEBHOOK_URL is publicly reachable (HTTP 200) and matched with Telegram!'
              : `⚠️ Reachability status: ${String(ind || 'unknown').toUpperCase()} — ${data.webhookReachability?.reason || 'Check diagnostics below.'}`,
          type: ind === 'green' ? 'success' : 'error'
        });
      } else {
        throw new Error(data.error || 'Reachability validation failed');
      }
    } catch (err: any) {
      setToastMessage({
        text: `⚠️ Validation error: ${err.message}`,
        type: 'error'
      });
    } finally {
      setValidatingReachability(false);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  const handleResyncWebhook = async () => {
    setResyncing(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      } catch {
        // Ignore token lookup error when signed out
      }
      if (bridgeTestToken.trim()) {
        headers['x-telegram-setup-secret'] = bridgeTestToken.trim();
      }
      const webhookPayload: Record<string, any> = {};
      if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
        webhookPayload.webhookUrl = `${window.location.origin}/api/telegram/webhook`;
      }
      const res = await fetch('/api/telegram/setup-webhook', {
        method: 'POST',
        headers,
        body: JSON.stringify(webhookPayload)
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setToastMessage({
          text: currentLang === 'om'
            ? '✓ Serverless Webhook Bot milkaa\'inaan haaromfamee mirkanaa\'eera!'
            : '✓ Telegram Serverless Webhook configured & verified!',
          type: 'success'
        });
        fetchStatus();
      } else {
        throw new Error(data.error || 'Failed to resync webhook');
      }
    } catch (err: any) {
      setToastMessage({
        text: `⚠️ Webhook Setup: ${err.message}`,
        type: 'error'
      });
    } finally {
      setResyncing(false);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  const handleTestMiniAppBridge = async () => {
    setMiniAppTesting(true);
    setMiniAppTestResult(null);
    try {
      const res = await fetch('/api/telegram/test-miniapp-bridge', {
        method: 'POST',
        headers: await getAuthHeaders(true),
        body: JSON.stringify({
          question: 'Labsii hojjataa lakk 1156/2019 waa\'ee mirga boqonnaa maal jedha?',
          language: currentLang,
          telegramUserId: 99887766,
          ...(bridgeTestToken.trim() ? { bridgeToken: bridgeTestToken.trim() } : {})
        })
      });

      const data = await res.json();
      setMiniAppTestResult(data);
      if (res.ok && data.ok) {
        setToastMessage({
          text: currentLang === 'om'
            ? '✓ Qorannoon Mini App Bridge milkaa\'eera! Deebiin AI argameera.'
            : '✓ Mini App Bridge API test succeeded! AI legal response retrieved.',
          type: 'success'
        });
      } else {
        throw new Error(data.error || 'Request failed');
      }
    } catch (err: any) {
      setToastMessage({
        text: `⚠️ MiniApp Bridge test failed: ${err.message}`,
        type: 'error'
      });
    } finally {
      setMiniAppTesting(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const isPolling = Boolean(statusData?.pollingActive || statusData?.mode === 'polling');

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-24 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border animate-in slide-in-from-top-3 ${
          toastMessage.type === 'error' 
            ? 'bg-rose-950/90 border-rose-500/50 text-rose-200' 
            : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
        }`}>
          <span>{toastMessage.type === 'error' ? '⚠️' : '✨'}</span>
          <span className="text-xs font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono font-bold uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>Telegram Bot Monitoring & Mini App Gateway</span>
          </div>
          <h2 className="text-2xl font-black text-white">
            {currentLang === 'om' ? 'To\'annoo Bot Telegram & Mini App API' : 'የቴሌግራም ቦት እና ሚኒ አፕ ሁኔታ መቆጣጠሪያ'}
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            {currentLang === 'om' 
              ? 'Haala qunnamtii @AyebeBot, sirna long-polling, webhook, fi API Mini App (/api/miniapp/legal-ask) asitti hordofaa.' 
              : 'የ @AyebeBot ግንኙነት፣ የሎንግ ፖሊንግ ሁኔታ፣ ዌብሁክ እና የሚኒ አፕ ኤፒአይን እዚህ ይቆጣጠሩ።'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleStartPolling}
            disabled={pollingStarting}
            className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50 ${
              isPolling
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${pollingStarting ? 'animate-spin' : ''}`} />
            <span>{pollingStarting ? 'Starting...' : isPolling ? 'Polling Active (Restart)' : 'Activate Polling'}</span>
          </button>

          <button
            type="button"
            onClick={handleTestConnectivity}
            disabled={testingConn}
            className="px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Radio className={`w-3.5 h-3.5 ${testingConn ? 'animate-spin' : ''}`} />
            <span>{testingConn ? 'Testing...' : 'Test Bot Connection'}</span>
          </button>

          <button
            type="button"
            onClick={handleResyncWebhook}
            disabled={resyncing}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resyncing ? 'animate-spin' : ''}`} />
            <span>{resyncing ? 'Re-syncing...' : 'Re-sync Webhook'}</span>
          </button>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bot Profile & Mode */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">Bot Profile</span>
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-white">@{statusData?.bot?.username || 'AyebeBot'}</div>
            <div className="text-xs text-slate-400">{statusData?.bot?.name || 'Ayeledha'}</div>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Engine Mode:</span>
            <span className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
              isPolling
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : statusData?.mode === 'webhook'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {isPolling
                ? '● Long-Polling (Live)'
                : statusData?.mode === 'webhook'
                  ? '● Serverless Webhook'
                  : 'Stopped'}
            </span>
          </div>
        </div>

        {/* Webhook & Pending Updates */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">Gateway Status</span>
            <Terminal className="w-5 h-5 text-sky-400" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-mono text-amber-300 truncate bg-slate-950 p-2.5 rounded-xl border border-slate-800" title={statusData?.webhook?.url || ''}>
              {isPolling
                ? 'Long-Polling Outbound (Active)'
                : statusData?.webhook?.url || 'No HTTPS webhook registered yet'}
            </div>
            <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
              <span>Pending Updates:</span>
              <span className="text-white font-bold">{statusData?.webhook?.pendingUpdateCount ?? 0}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>{statusData?.serverless ? 'Serverless Secret Token' : 'Direct Connection'}</span>
            <span className="text-emerald-400 font-bold">
              {statusData?.webhookSecretConfigured ? 'SHA-256 Verified' : 'Verified Outbound'}
            </span>
          </div>
        </div>

        {/* Last Error Status */}
        <div className={`border rounded-3xl p-6 space-y-4 shadow-xl ${
          statusData?.engineStatus?.lastError || statusData?.webhook?.lastErrorMessage
            ? 'bg-rose-950/20 border-rose-500/40' 
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">Health Status</span>
            {statusData?.engineStatus?.lastError || statusData?.webhook?.lastErrorMessage ? (
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-white">
              {statusData?.engineStatus?.lastError ? (
                <span className="text-rose-300">{statusData.engineStatus.lastError}</span>
              ) : statusData?.webhook?.lastErrorMessage ? (
                <span className="text-rose-300">{statusData.webhook.lastErrorMessage}</span>
              ) : (
                <span className="text-emerald-400">System Healthy & Operational</span>
              )}
            </div>
            {(statusData?.engineStatus?.lastErrorDate || statusData?.webhook?.lastErrorDate) && (
              <div className="text-[10px] text-slate-500 font-mono">
                {statusData?.engineStatus?.lastErrorDate || statusData?.webhook?.lastErrorDate}
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
            Auto-refresh every 10s
          </div>
        </div>
      </div>

      {/* Exact Backend TELEGRAM_WEBHOOK_URL & Green/Yellow/Red Reachability Card */}
      {(() => {
        const reach = statusData?.webhookReachability;
        const indicator: 'green' | 'yellow' | 'red' = reach?.indicator || (statusData?.configuredWebhookUrl ? 'yellow' : 'red');
        const configuredUrl = statusData?.configuredWebhookUrl || '';
        const sourceLabelMap: Record<string, string> = {
          env: 'Server Env (TELEGRAM_WEBHOOK_URL)',
          firestore_system_settings: 'Firestore system_settings',
          telegram_live: 'Live Telegram getWebhookInfo',
          derived: 'Derived from Request Host',
          override: 'Admin Validation Override',
          unset: 'Not Configured',
        };
        const sourceLabel = sourceLabelMap[statusData?.configuredWebhookUrlSource || 'unset'] || 'Backend';

        const cardStyle =
          indicator === 'green'
            ? 'border-emerald-500/40 bg-emerald-950/15'
            : indicator === 'yellow'
              ? 'border-amber-500/40 bg-amber-950/15'
              : 'border-rose-500/40 bg-rose-950/15';

        const badgeStyle =
          indicator === 'green'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
            : indicator === 'yellow'
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : 'bg-rose-500/15 text-rose-300 border-rose-500/40';

        const dotStyle =
          indicator === 'green'
            ? 'bg-emerald-400'
            : indicator === 'yellow'
              ? 'bg-amber-400'
              : 'bg-rose-400';

        const indicatorLabel =
          indicator === 'green'
            ? 'GREEN • Publicly Reachable & Configured'
            : indicator === 'yellow'
              ? 'YELLOW • Auth Gate / Sync Warning'
              : 'RED • Unreachable or Unset';

        return (
          <div className={`border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 ${cardStyle}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1 rounded-full border text-xs font-mono font-bold inline-flex items-center gap-2 ${badgeStyle}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${dotStyle}`} />
                    <span>{indicatorLabel}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-300">
                    Source: {sourceLabel}
                  </span>
                  {reach?.httpStatus !== null && reach?.httpStatus !== undefined && (
                    <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-mono text-sky-300">
                      Health HTTP: {reach.httpStatus}
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Current Backend TELEGRAM_WEBHOOK_URL
                </h3>
              </div>

              <button
                type="button"
                onClick={handleRecheckReachability}
                disabled={validatingReachability}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${validatingReachability ? 'animate-spin' : ''}`} />
                <span>{validatingReachability ? 'Checking...' : 'Check Reachability'}</span>
              </button>
            </div>

            {/* Exact Configured URL Readout */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Exact Active TELEGRAM_WEBHOOK_URL Value (from Backend)
                </div>
                <div className="text-xs sm:text-sm font-mono text-amber-300 break-all select-all">
                  {loading ? 'Loading from backend...' : configuredUrl || 'Unset — no public HTTPS TELEGRAM_WEBHOOK_URL configured'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyUrlToClipboard(configuredUrl || webhookEndpointUrl)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/80 text-xs font-bold text-slate-200 hover:text-amber-300 inline-flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
                  title="Copy URL to Clipboard"
                >
                  {copiedUrlToClipboard ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-300" />
                      <span>Copy URL to Clipboard</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleTriggerTestFetch}
                  disabled={testingFetch}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95 disabled:opacity-50"
                  title="Trigger a test fetch to TELEGRAM_WEBHOOK_URL and display raw status code and body in a modal"
                >
                  <Radio className={`w-3.5 h-3.5 ${testingFetch ? 'animate-spin' : ''}`} />
                  <span>{testingFetch ? 'Probing Webhook...' : 'Test Fetch Webhook URL'}</span>
                </button>
              </div>
            </div>

            {/* Manual Update Input Field & Save & Reconfigure Button */}
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-400" />
                  <label
                    htmlFor="manual-telegram-webhook-url-input"
                    className="text-xs font-bold text-white uppercase tracking-wider"
                  >
                    {currentLang === 'om'
                      ? 'TELEGRAM_WEBHOOK_URL Haaromsaa (Admin Input)'
                      : 'Update TELEGRAM_WEBHOOK_URL (Admin Input)'}
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setManualWebhookUrlTouched(true);
                    setManualWebhookUrl(webhookEndpointUrl);
                  }}
                  className="text-[11px] font-mono text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                >
                  <Link2 className="w-3 h-3" />
                  <span>Use Current Origin ({liveBaseUrl})</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                <div className="relative flex-1">
                  <input
                    id="manual-telegram-webhook-url-input"
                    type="url"
                    value={manualWebhookUrl}
                    onChange={(e) => {
                      setManualWebhookUrlTouched(true);
                      setManualWebhookUrl(e.target.value);
                    }}
                    placeholder="https://<your-public-domain>/api/telegram/webhook"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveAndReconfigureWebhook}
                  disabled={isSavingAndReconfiguring}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 shrink-0"
                >
                  <Save className={`w-3.5 h-3.5 ${isSavingAndReconfiguring ? 'animate-spin' : ''}`} />
                  <span>{isSavingAndReconfiguring ? 'Saving & Reconfiguring...' : 'Save & Reconfigure'}</span>
                </button>
              </div>

              {/* Validation helper text */}
              {manualWebhookUrl.trim() && (() => {
                const val = validateTelegramWebhookUrl(manualWebhookUrl);
                return (
                  <div className="text-[11px] font-mono flex items-center gap-2">
                    {val.valid ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Valid: {val.normalizedUrl}</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{val.reason}</span>
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {reach?.reason && (
              <p className="text-xs text-slate-200 leading-relaxed">{reach.reason}</p>
            )}

            {Array.isArray(reach?.checks) && reach.checks.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {reach.checks.map((chk: any) => (
                  <div
                    key={chk.key}
                    className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-start gap-2.5 text-xs"
                  >
                    {chk.status === 'pass' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : chk.status === 'warn' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Shield className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-white text-[11px]">{chk.label}</div>
                      <div className="text-[11px] text-slate-400 break-words">{chk.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Small Table: Last 5 Connection Attempts from Telegram Servers to Our Webhook (retrieved from 'telegram_logs') */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h3 className="text-base sm:text-lg font-bold text-white">
                {currentLang === 'om'
                  ? 'Qunnamtiiwwan Webhook Dhiyoo 5 (telegram_logs)'
                  : 'Last 5 Webhook Connection Attempts'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono text-amber-300 border border-slate-700 font-semibold">
                telegram_logs
              </span>
            </div>
            <p className="text-xs text-slate-300">
              {currentLang === 'om'
                ? 'Qunnamtiiwwan Telegram servers fi test probes gara webhook keenyaatti taasisan Firestore telegram_logs irraa:'
                : 'Last 5 connection attempts from Telegram servers to our webhook, including status codes and timestamps retrieved from telegram_logs:'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                fetchStatus();
                fetchConnectionAttempts();
              }}
              disabled={loadingAttempts}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAttempts ? 'animate-spin' : ''}`} />
              <span>{loadingAttempts ? 'Refreshing...' : 'Refresh Logs'}</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerTestFetch}
              disabled={testingFetch}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow disabled:opacity-50"
            >
              <Radio className={`w-3.5 h-3.5 ${testingFetch ? 'animate-spin' : ''}`} />
              <span>{testingFetch ? 'Probing...' : 'Test Fetch Webhook URL'}</span>
            </button>
          </div>
        </div>

        {/* Small Responsive Connection Attempts Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4 font-bold">Status Code</th>
                <th className="py-3 px-4 font-bold">Timestamp</th>
                <th className="py-3 px-4 font-bold">Action / Event</th>
                <th className="py-3 px-4 font-bold">Source / Client IP</th>
                <th className="py-3 px-4 font-bold">Summary / Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {loadingAttempts && connectionAttempts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans text-xs">
                    Loading connection attempts from 'telegram_logs' collection...
                  </td>
                </tr>
              ) : connectionAttempts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans text-xs space-y-2">
                    <div>No webhook connection attempts found in 'telegram_logs' yet.</div>
                    <button
                      type="button"
                      onClick={handleTriggerTestFetch}
                      className="text-amber-400 hover:text-amber-300 font-bold underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Trigger a test fetch now to verify connectivity</span>
                    </button>
                  </td>
                </tr>
              ) : (
                connectionAttempts.map((attempt, idx) => {
                  const code = attempt.statusCode ?? attempt.httpStatus ?? 200;
                  const codeBadgeStyle =
                    code >= 200 && code < 300
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : code === 401
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : code === 400 || code === 405
                          ? 'bg-orange-500/15 text-orange-300 border-orange-500/40'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/40';

                  const codeLabel =
                    code === 200
                      ? '200 OK'
                      : code === 401
                        ? '401 Unauthorized'
                        : code === 400
                          ? '400 Bad Request'
                          : code === 405
                            ? '405 Method Not Allowed'
                            : code === 503
                              ? '503 Unavailable'
                              : `HTTP ${code}`;

                  const formattedDate =
                    attempt.timestamp && !isNaN(new Date(attempt.timestamp).getTime())
                      ? new Date(attempt.timestamp).toLocaleString()
                      : 'Recent';

                  return (
                    <tr key={attempt.id || idx} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${codeBadgeStyle}`}>
                          {codeLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 whitespace-nowrap text-[11px]">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4 text-white font-semibold whitespace-nowrap text-[11px]">
                        {attempt.action || (attempt.mode === 'webhook' ? 'Serverless Webhook' : 'Webhook Update')}
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                        {attempt.clientSource || attempt.ip || (attempt.updateType === 'admin_test_fetch' ? 'Admin Probe' : 'Telegram Server')}
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-sm truncate text-[11px]">
                        {attempt.error ? (
                          <span className="text-rose-300 font-semibold">{attempt.error}</span>
                        ) : attempt.bodySummary ? (
                          attempt.bodySummary
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mini App Bridge API Interactive Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase">
              <Zap className="w-3.5 h-3.5" />
              <span>Telegram Mini App Bridge Endpoint</span>
            </div>
            <h3 className="text-lg font-bold text-white">
              Serverless Telegram Endpoints
            </h3>
            <p className="text-xs text-slate-400 max-w-2xl">
              {currentLang === 'om'
                ? 'Telegram Bot Webhook (TELEGRAM_WEBHOOK_URL) fi Serverless Access / Mini App Bridge endpoint guutuu:'
                : 'Full HTTPS endpoints for Telegram Bot Webhook (TELEGRAM_WEBHOOK_URL) and Serverless Access / Mini App Bridge:'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestMiniAppBridge}
            disabled={miniAppTesting}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Cpu className={`w-4 h-4 ${miniAppTesting ? 'animate-spin' : ''}`} />
            <span>{miniAppTesting ? 'Calling AI Bridge...' : 'Test Mini App Bridge API'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                1. Telegram Bot Webhook (TELEGRAM_WEBHOOK_URL)
              </span>
              <button
                type="button"
                onClick={() => handleCopyUrlToClipboard(webhookEndpointUrl)}
                className="text-[11px] text-slate-300 hover:text-amber-400 inline-flex items-center gap-1.5 cursor-pointer px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800"
                title="Copy URL to Clipboard"
              >
                {copiedUrlToClipboard ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied to Clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL to Clipboard</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[11px] font-mono text-sky-300 break-all select-all">
              {webhookEndpointUrl}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                2. Serverless Access / Mini App Bridge (POST)
              </span>
              <button
                type="button"
                onClick={() => handleCopyEndpoint('bridge', bridgeEndpointUrl)}
                className="text-[11px] text-slate-300 hover:text-amber-400 inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedEndpoint === 'bridge' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEndpoint === 'bridge' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="text-[11px] font-mono text-amber-300 break-all select-all">
              {bridgeEndpointUrl}
            </div>
          </div>
        </div>

        {/* Optional Secret Token Verification Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="password"
            value={bridgeTestToken}
            onChange={(e) => setBridgeTestToken(e.target.value)}
            placeholder={
              currentLang === 'om'
                ? 'Yoo barbaaddan MINIAPP_BRIDGE_SECRET keessan mirkaneessuuf asitti galchaa (optional)...'
                : 'Optional: enter your MINIAPP_BRIDGE_SECRET to verify token match...'
            }
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        {/* Settings -> Secrets Readiness Checklist */}
        {statusData?.secretsStatus && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {currentLang === 'om' ? 'Haala Secrets Server (Settings → Secrets)' : 'Server Secrets Readiness'}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Mode: {statusData.secretsStatus.TELEGRAM_BOT_MODE}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {[
                { key: 'GEMINI_API_KEY', label: 'GEMINI_API_KEY', required: true },
                { key: 'TELEGRAM_BOT_TOKEN', label: 'TELEGRAM_BOT_TOKEN', required: true },
                { key: 'TELEGRAM_WEBHOOK_URL', label: 'TELEGRAM_WEBHOOK_URL', required: true },
                { key: 'MINIAPP_BRIDGE_SECRET', label: 'MINIAPP_BRIDGE_SECRET', required: true },
                { key: 'TELEGRAM_WEBHOOK_SECRET', label: 'TELEGRAM_WEBHOOK_SECRET', required: false },
                { key: 'TELEGRAM_SETUP_SECRET', label: 'TELEGRAM_SETUP_SECRET', required: false },
                { key: 'TELEGRAM_SERVERLESS_TOKEN', label: 'TELEGRAM_SERVERLESS_TOKEN', required: false },
                { key: 'OPENAI_API_KEY', label: 'OPENAI_API_KEY', required: false },
              ].map((item) => {
                const isSet = Boolean(statusData.secretsStatus[item.key]);
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <span className="font-mono text-[11px] text-slate-300 truncate">{item.label}</span>
                    <span
                      className={`text-[10px] font-mono font-semibold shrink-0 ${
                        isSet
                          ? 'text-emerald-400'
                          : item.required
                            ? 'text-amber-400'
                            : 'text-slate-500'
                      }`}
                    >
                      {isSet ? 'Configured' : item.required ? 'Recommended' : 'Optional'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Endpoint Specs Snippet */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono space-y-2">
            <div className="text-slate-400 font-bold uppercase text-[10px]">Request Headers</div>
            <div className="text-sky-300">Content-Type: application/json</div>
            <div className="text-amber-300">Authorization: Bearer &lt;YOUR_MINIAPP_BRIDGE_SECRET&gt;</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono space-y-2">
            <div className="text-slate-400 font-bold uppercase text-[10px]">Request Body JSON</div>
            <div className="text-slate-300">
              {'{'}
              <br />
              &nbsp;&nbsp;"question": "Gaaffii seeraa keessan...",
              <br />
              &nbsp;&nbsp;"language": "om",
              <br />
              &nbsp;&nbsp;"telegramUserId": 12345
              <br />
              {'}'}
            </div>
          </div>
        </div>

        {/* Live Test Result */}
        {miniAppTestResult && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 text-xs space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-amber-300 font-bold">
              <span>Live Bridge Response (Status: OK)</span>
              <span className="text-[10px] text-slate-400 font-mono">Model: {miniAppTestResult.metadata?.modelUsed}</span>
            </div>
            <div className="text-slate-200 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {miniAppTestResult.answer}
            </div>
            {miniAppTestResult.sources && miniAppTestResult.sources.length > 0 && (
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <span className="font-bold text-slate-300">Maddoota Seeraa:</span>
                <span>{miniAppTestResult.sources.join(' • ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Activity / Telegram Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">
              {currentLang === 'om' ? 'Galmeewwan Telegram (telegram_logs)' : 'የቴሌግራም የምዝግብ ማስታወሻዎች'}
            </h3>
            <p className="text-xs text-slate-400">Firestore telegram_logs collection audit trail</p>
          </div>
          <button
            type="button"
            onClick={fetchStatus}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {loading ? (
            <div className="text-center py-8 text-xs text-slate-500">Loading Telegram audit logs...</div>
          ) : !statusData?.recentLogs || statusData.recentLogs.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">No logs recorded in Firestore yet. Send a message to @AyebeBot to test!</div>
          ) : (
            statusData.recentLogs.map((log: any) => {
              const isErr = log.status === 'error' || log.status === 'failed';
              const displayTime = log.timestamp && !isNaN(new Date(log.timestamp).getTime())
                ? new Date(log.timestamp).toLocaleTimeString()
                : 'Recent';
              return (
                <div
                  key={log.id}
                  className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isErr
                      ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                        isErr ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {log.status}
                      </span>
                      {log.mode && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/20">
                          {log.mode}
                        </span>
                      )}
                      <span className="font-mono text-slate-400 text-[11px]">User: @{log.username || log.sender || 'Anonymous'}</span>
                    </div>
                    {log.error && (
                      <div className="text-rose-300 font-mono text-[11px] pt-1">Error: {log.error}</div>
                    )}
                    {(log.bodySummary || log.textSummary) && (
                      <div className="text-slate-400 text-[11px] font-mono truncate max-w-xl">Query: {log.bodySummary || log.textSummary}</div>
                    )}
                    {log.answerSummary && (
                      <div className="text-emerald-400/80 text-[11px] font-mono truncate max-w-xl">Deebii: {log.answerSummary}</div>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 shrink-0">
                    {displayTime}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Webhook Connectivity Test Fetch Result Modal */}
      {testFetchModalOpen && testFetchResult && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setTestFetchModalOpen(false)}
        >
          <div
            className="max-w-2xl w-full bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-sky-400 uppercase">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>Webhook Endpoint Connectivity Test</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  TELEGRAM_WEBHOOK_URL Test Fetch Result
                </h3>
                <p className="text-xs text-slate-400">
                  Raw HTTP status code, latency, headers, and body from live probe
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTestFetchModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                aria-label="Close Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Code & Metrics Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Raw Status Code</div>
                <div
                  className={`text-base font-black ${
                    testFetchResult.httpStatus >= 200 && testFetchResult.httpStatus < 300
                      ? 'text-emerald-400'
                      : testFetchResult.httpStatus === 401
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }`}
                >
                  {testFetchResult.httpStatus ?? 0}
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Status Text</div>
                <div className="text-xs font-bold text-slate-200 truncate">
                  {testFetchResult.httpStatusText || (testFetchResult.httpStatus === 200 ? 'OK' : 'Response Received')}
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Roundtrip</div>
                <div className="text-xs font-bold text-sky-300">
                  {testFetchResult.roundtripMs ?? 0} ms
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Timestamp</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {testFetchResult.timestamp ? new Date(testFetchResult.timestamp).toLocaleTimeString() : 'Now'}
                </div>
              </div>
            </div>

            {/* Tested URL */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Tested Endpoint URL
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-sky-300 break-all select-all">
                {testFetchResult.testedUrl || 'Unset'}
              </div>
            </div>

            {/* Diagnostic Explanation */}
            {testFetchResult.explanation && (
              <div
                className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1 ${
                  testFetchResult.httpStatus === 200
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                    : testFetchResult.httpStatus === 401
                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                      : 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Connectivity & Verification Analysis:</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {testFetchResult.explanation}
                </p>
              </div>
            )}

            {/* Raw Response Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Raw Response Body
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!testFetchResult.rawBody) return;
                    await navigator.clipboard.writeText(testFetchResult.rawBody);
                    setCopiedRawBody(true);
                    setTimeout(() => setCopiedRawBody(false), 2000);
                  }}
                  className="text-[11px] text-slate-400 hover:text-amber-400 inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedRawBody ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRawBody ? 'Copied' : 'Copy Raw Body'}</span>
                </button>
              </div>

              <div className="max-h-52 overflow-y-auto bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-amber-200 whitespace-pre-wrap select-all break-all">
                {testFetchResult.rawBody || '(Empty response body)'}
              </div>
            </div>

            {/* Optional Response Headers */}
            {testFetchResult.headers && Object.keys(testFetchResult.headers).length > 0 && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setShowRawHeaders(!showRawHeaders)}
                  className="text-[11px] font-mono text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Code className="w-3 h-3" />
                  <span>
                    {showRawHeaders
                      ? 'Hide Response Headers'
                      : `Show Response Headers (${Object.keys(testFetchResult.headers).length})`}
                  </span>
                </button>

                {showRawHeaders && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-36 overflow-y-auto space-y-1 text-[11px] font-mono">
                    {Object.entries(testFetchResult.headers).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-2">
                        <span className="text-slate-400 font-bold shrink-0">{k}:</span>
                        <span className="text-slate-200 break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleTriggerTestFetch}
                disabled={testingFetch}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Radio className={`w-3.5 h-3.5 ${testingFetch ? 'animate-spin' : ''}`} />
                <span>{testingFetch ? 'Re-probing...' : 'Re-run Test Fetch'}</span>
              </button>

              <button
                type="button"
                onClick={() => setTestFetchModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
