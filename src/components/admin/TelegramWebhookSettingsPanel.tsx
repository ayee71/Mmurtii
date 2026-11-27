import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Key,
  Link2,
  RefreshCw,
  Rocket,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wand2,
  AlertTriangle,
} from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Language } from '../../i18n/translations';
import { logAdminAction } from '../../services/adminActivityLogService';
import {
  generateRandomWebhookSecret,
  SYSTEM_SETTINGS_COLLECTION,
  TELEGRAM_SETTINGS_DOC_ID,
  TELEGRAM_WEBHOOK_PATH,
  validateTelegramWebhookUrl,
  type WebhookIndicatorColor,
  type WebhookReachabilityResult,
} from '../../services/telegramWebhookConfig';

interface TelegramWebhookSettingsPanelProps {
  currentLang: Language;
  backendWebhookUrl?: string;
  onStatusUpdated?: () => void;
}

interface ValidationResponsePayload {
  ok: boolean;
  configured?: boolean;
  configuredWebhookUrl?: string;
  configuredWebhookUrlSource?: string;
  webhookReachability?: WebhookReachabilityResult;
  bot?: { id: number; username?: string; name: string } | null;
  webhook?: {
    url: string;
    pendingUpdateCount: number;
    lastErrorMessage: string | null;
  } | null;
  validatedAt?: string;
  error?: string;
}

const INDICATOR_STYLES: Record<
  WebhookIndicatorColor,
  { badge: string; border: string; dot: string; label: string }
> = {
  green: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    border: 'border-emerald-500/40 bg-emerald-950/20',
    dot: 'bg-emerald-400',
    label: 'GREEN • Publicly Reachable & Verified',
  },
  yellow: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    border: 'border-amber-500/40 bg-amber-950/20',
    dot: 'bg-amber-400',
    label: 'YELLOW • Partial / Auth Gate or Sync Warning',
  },
  red: {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    border: 'border-rose-500/40 bg-rose-950/20',
    dot: 'bg-rose-400',
    label: 'RED • Unreachable or Misconfigured',
  },
};

export const TelegramWebhookSettingsPanel: React.FC<TelegramWebhookSettingsPanelProps> = ({
  currentLang,
  backendWebhookUrl,
  onStatusUpdated,
}) => {
  const { user } = useAuth();

  // --- 1. Firestore system_settings state ---
  const [settingsUrlInput, setSettingsUrlInput] = useState<string>('');
  const [savedSettingMeta, setSavedSettingMeta] = useState<{
    telegramWebhookUrl?: string;
    updatedByEmail?: string;
    lastValidationStatus?: WebhookIndicatorColor;
    lastValidatedAt?: string;
    lastValidationMessage?: string;
  } | null>(null);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [validatingEngine, setValidatingEngine] = useState<boolean>(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResponsePayload | null>(null);

  // --- 2. Automated Webhook Setup Wizard state ---
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [generatedSecret, setGeneratedSecret] = useState<string>('');
  const [showGeneratedSecret, setShowGeneratedSecret] = useState<boolean>(false);
  const [copiedSecret, setCopiedSecret] = useState<boolean>(false);
  const [setupHeaderSecret, setSetupHeaderSecret] = useState<string>('');
  const [applySecretToSetup, setApplySecretToSetup] = useState<boolean>(true);
  const [wizardWebhookUrl, setWizardWebhookUrl] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin.replace(/\/+$/, '')}${TELEGRAM_WEBHOOK_PATH}`;
    }
    return '';
  });
  const [runningSetup, setRunningSetup] = useState<boolean>(false);
  const [setupResponse, setSetupResponse] = useState<any>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  const settingsValidation = validateTelegramWebhookUrl(settingsUrlInput);
  const wizardUrlValidation = validateTelegramWebhookUrl(wizardWebhookUrl);

  const getBearerHeaders = async (extra: Record<string, string> = {}): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    const activeUser = auth.currentUser || user;
    if (activeUser) {
      const idToken = await activeUser.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    }
    return headers;
  };

  // Load existing Firestore system_settings/telegram_config on mount
  useEffect(() => {
    let mounted = true;
    const loadSystemSettings = async () => {
      setLoadingSettings(true);
      setSettingsError(null);
      const settingsPath = `${SYSTEM_SETTINGS_COLLECTION}/${TELEGRAM_SETTINGS_DOC_ID}`;
      try {
        const snap = await getDoc(doc(db, SYSTEM_SETTINGS_COLLECTION, TELEGRAM_SETTINGS_DOC_ID));
        if (!mounted) return;
        if (snap.exists()) {
          const data = snap.data() as any;
          setSavedSettingMeta({
            telegramWebhookUrl: data.telegramWebhookUrl,
            updatedByEmail: data.updatedByEmail,
            lastValidationStatus: data.lastValidationStatus,
            lastValidatedAt: data.lastValidatedAt,
            lastValidationMessage: data.lastValidationMessage,
          });
          if (typeof data.telegramWebhookUrl === 'string' && data.telegramWebhookUrl.trim()) {
            setSettingsUrlInput(data.telegramWebhookUrl.trim());
          } else if (backendWebhookUrl) {
            setSettingsUrlInput(backendWebhookUrl);
          }
        } else if (backendWebhookUrl) {
          setSettingsUrlInput(backendWebhookUrl);
        } else if (typeof window !== 'undefined' && window.location?.origin) {
          setSettingsUrlInput(`${window.location.origin.replace(/\/+$/, '')}${TELEGRAM_WEBHOOK_PATH}`);
        }
      } catch (err: any) {
        if (!mounted) return;
        handleFirestoreError(err, OperationType.GET, settingsPath);
        setSettingsError(
          `Could not read Firestore ${settingsPath}: ${err?.message || 'Insufficient permissions or offline'}`
        );
      } finally {
        if (mounted) setLoadingSettings(false);
      }

      if (mounted && (auth.currentUser || user)) {
        try {
          const headers = await getBearerHeaders();
          const res = await fetch('/api/telegram/validate-config', {
            method: 'POST',
            headers,
            body: JSON.stringify({}),
          });
          if (res.ok) {
            const data: ValidationResponsePayload = await res.json();
            if (mounted && data.ok) {
              setValidationResult(data);
              setSettingsUrlInput((prev) => prev || data.configuredWebhookUrl || '');
            }
          }
        } catch {
          // Non-fatal on initial mount
        }
      }
    };

    loadSystemSettings();
    return () => {
      mounted = false;
    };
  }, [backendWebhookUrl, user]);

  const runBotEngineValidation = async (targetUrl?: string): Promise<ValidationResponsePayload | null> => {
    setValidatingEngine(true);
    try {
      const headers = await getBearerHeaders();
      const res = await fetch('/api/telegram/validate-config', {
        method: 'POST',
        headers,
        body: JSON.stringify(targetUrl ? { webhookUrl: targetUrl } : {}),
      });
      const data: ValidationResponsePayload = await res.json();
      setValidationResult(data);
      if (!res.ok || !data.ok) {
        setSettingsError(data.error || `Validation failed with HTTP ${res.status}`);
        return null;
      }
      onStatusUpdated?.();
      return data;
    } catch (err: any) {
      setSettingsError(`Bot engine validation error: ${err?.message || 'Network failure'}`);
      return null;
    } finally {
      setValidatingEngine(false);
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);

    if (!settingsValidation.valid || !settingsValidation.normalizedUrl) {
      setSettingsError(settingsValidation.reason || 'Please enter a valid public HTTPS webhook URL.');
      return;
    }

    const activeUser = auth.currentUser || user;
    if (!activeUser?.uid || !activeUser?.email) {
      setSettingsError('Verified SeeraAI Administrator sign-in is required to write to system_settings.');
      return;
    }

    const normalizedUrl = settingsValidation.normalizedUrl;
    const settingsPath = `${SYSTEM_SETTINGS_COLLECTION}/${TELEGRAM_SETTINGS_DOC_ID}`;
    setSavingSettings(true);

    try {
      await setDoc(
        doc(db, SYSTEM_SETTINGS_COLLECTION, TELEGRAM_SETTINGS_DOC_ID),
        {
          settingId: TELEGRAM_SETTINGS_DOC_ID,
          telegramWebhookUrl: normalizedUrl,
          updatedBy: activeUser.uid,
          updatedByEmail: activeUser.email,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, settingsPath);
      setSavingSettings(false);
      setSettingsError(
        `Failed to save to Firestore "${settingsPath}": ${err?.message || 'Permission denied. Verify admin claims & Firestore rules.'}`
      );
      return;
    }

    setSettingsUrlInput(normalizedUrl);
    setWizardWebhookUrl(normalizedUrl);
    setSavingSettings(false);

    // Immediately trigger bot engine validation check after saving to Firestore
    const validation = await runBotEngineValidation(normalizedUrl);
    const reach = validation?.webhookReachability;

    if (reach) {
      try {
        await setDoc(
          doc(db, SYSTEM_SETTINGS_COLLECTION, TELEGRAM_SETTINGS_DOC_ID),
          {
            settingId: TELEGRAM_SETTINGS_DOC_ID,
            telegramWebhookUrl: normalizedUrl,
            updatedBy: activeUser.uid,
            updatedByEmail: activeUser.email,
            updatedAt: serverTimestamp(),
            lastValidationStatus: reach.indicator,
            lastValidatedAt: reach.checkedAt,
            lastValidationMessage: reach.reason.slice(0, 480),
          },
          { merge: true }
        );
      } catch (metaErr) {
        handleFirestoreError(metaErr, OperationType.UPDATE, settingsPath);
      }
      setSavedSettingMeta({
        telegramWebhookUrl: normalizedUrl,
        updatedByEmail: activeUser.email,
        lastValidationStatus: reach.indicator,
        lastValidatedAt: reach.checkedAt,
        lastValidationMessage: reach.reason,
      });
    }

    await logAdminAction({
      actionType: 'config_update',
      target: 'Firestore system_settings/telegram_config',
      details: `Saved TELEGRAM_WEBHOOK_URL=${normalizedUrl} & ran validation (${reach?.indicator?.toUpperCase() || 'COMPLETED'})`,
      metadata: { telegramWebhookUrl: normalizedUrl, indicator: reach?.indicator || null },
    }).catch(() => {});

    setSettingsSuccess(
      currentLang === 'om'
        ? `TELEGRAM_WEBHOOK_URL gara Firestore "${settingsPath}" tti ol-kaawwamee bot engine irratti mirkanaa'eera.`
        : `Saved TELEGRAM_WEBHOOK_URL to Firestore "${settingsPath}" and completed bot engine validation.`
    );
  };

  const handleGenerateSecret = () => {
    const secret = generateRandomWebhookSecret(32);
    setGeneratedSecret(secret);
    setCopiedSecret(false);
    setSetupError(null);
  };

  const handleCopyGeneratedSecret = async () => {
    if (!generatedSecret) return;
    try {
      await navigator.clipboard.writeText(generatedSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleAutoPopulateCurrentDomain = () => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setWizardWebhookUrl(`${window.location.origin.replace(/\/+$/, '')}${TELEGRAM_WEBHOOK_PATH}`);
    }
  };

  const handleExecuteAutomatedSetup = async () => {
    setSetupError(null);
    setSetupResponse(null);

    if (!wizardUrlValidation.valid || !wizardUrlValidation.normalizedUrl) {
      setSetupError(wizardUrlValidation.reason || 'Valid public HTTPS webhook URL is required.');
      return;
    }

    setRunningSetup(true);
    try {
      const extraHeaders: Record<string, string> = {};
      if (setupHeaderSecret.trim()) {
        extraHeaders['x-telegram-setup-secret'] = setupHeaderSecret.trim();
      }
      const headers = await getBearerHeaders(extraHeaders);

      const bodyPayload: Record<string, any> = {
        webhookUrl: wizardUrlValidation.normalizedUrl,
      };
      if (applySecretToSetup && generatedSecret.length === 32) {
        bodyPayload.secretToken = generatedSecret;
      }

      const res = await fetch('/api/telegram/setup-webhook', {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      setSetupResponse(data);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Setup request failed with HTTP ${res.status}`);
      }

      if (data.webhookReachability) {
        setValidationResult({
          ok: true,
          configured: true,
          configuredWebhookUrl: data.webhookUrl,
          webhookReachability: data.webhookReachability,
          bot: data.bot,
          webhook: data.webhook,
        });
      }

      await logAdminAction({
        actionType: 'config_update',
        target: 'Telegram Automated Webhook Setup',
        details: `Executed /api/telegram/setup-webhook for ${data.webhookUrl}`,
        metadata: { webhookUrl: data.webhookUrl, indicator: data.webhookReachability?.indicator || null },
      }).catch(() => {});

      onStatusUpdated?.();
    } catch (err: any) {
      setSetupError(err?.message || 'Automated webhook setup failed.');
    } finally {
      setRunningSetup(false);
    }
  };

  const activeReachability = validationResult?.webhookReachability;
  const activeStyle = activeReachability ? INDICATOR_STYLES[activeReachability.indicator] : null;

  return (
    <div className="space-y-8">
      {/* =========================================================================
          1. SECURE ADMIN SETTINGS INTERFACE (Firestore system_settings)
          ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Firestore system_settings • Admin Only</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              {currentLang === 'om'
                ? 'Qindaa\'ina TELEGRAM_WEBHOOK_URL (Firestore system_settings)'
                : 'TELEGRAM_WEBHOOK_URL Admin Settings (Firestore system_settings)'}
            </h3>
            <p className="text-xs text-slate-400">
              Save the public HTTPS <code className="text-sky-300">TELEGRAM_WEBHOOK_URL</code> directly into{' '}
              <code className="text-amber-300">system_settings/{TELEGRAM_SETTINGS_DOC_ID}</code> and run an automated bot engine validation check.
            </p>
          </div>

          {savedSettingMeta?.lastValidationStatus && (
            <span
              className={`px-3 py-1.5 rounded-full border text-xs font-mono font-bold inline-flex items-center gap-2 shrink-0 ${
                INDICATOR_STYLES[savedSettingMeta.lastValidationStatus].badge
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  INDICATOR_STYLES[savedSettingMeta.lastValidationStatus].dot
                }`}
              />
              <span>Last Saved: {savedSettingMeta.lastValidationStatus.toUpperCase()}</span>
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSystemSettings} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>TELEGRAM_WEBHOOK_URL (Public HTTPS Endpoint)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.location?.origin) {
                    setSettingsUrlInput(`${window.location.origin.replace(/\/+$/, '')}${TELEGRAM_WEBHOOK_PATH}`);
                  }
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
              >
                Use Current Origin
              </button>
            </div>
            <input
              type="url"
              value={settingsUrlInput}
              onChange={(e) => {
                setSettingsUrlInput(e.target.value);
                setSettingsError(null);
              }}
              disabled={loadingSettings || savingSettings}
              placeholder="https://your-public-cloud-run-url.run.app/api/telegram/webhook"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-sky-200 focus:outline-none focus:border-amber-500"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              {settingsUrlInput.trim() ? (
                settingsValidation.valid ? (
                  <span className="text-emerald-400 font-mono">
                    ✓ Normalized: {settingsValidation.normalizedUrl}
                  </span>
                ) : (
                  <span className="text-rose-400 font-medium">
                    ⚠️ {settingsValidation.reason}
                  </span>
                )
              ) : (
                <span className="text-slate-500">
                  Must use public HTTPS ending in {TELEGRAM_WEBHOOK_PATH} (no localhost or private IPs).
                </span>
              )}
              {savedSettingMeta?.updatedByEmail && (
                <span className="text-slate-500 font-mono">
                  Saved by: {savedSettingMeta.updatedByEmail}
                </span>
              )}
            </div>
          </div>

          {settingsError && (
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{settingsError}</span>
            </div>
          )}

          {settingsSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{settingsSuccess}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingSettings || validatingEngine || loadingSettings || !settingsValidation.valid}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              {savingSettings || validatingEngine ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>
                {savingSettings
                  ? 'Saving to Firestore...'
                  : validatingEngine
                    ? 'Validating Bot Engine...'
                    : 'Save to Firestore & Validate Bot Engine'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => runBotEngineValidation(settingsValidation.normalizedUrl || undefined)}
              disabled={validatingEngine}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${validatingEngine ? 'animate-spin' : ''}`} />
              <span>Run Validation Check Only</span>
            </button>
          </div>
        </form>

        {/* Bot Engine Validation Results */}
        {activeReachability && activeStyle && (
          <div className={`p-5 rounded-2xl border space-y-4 ${activeStyle.border}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className={`px-3 py-1 rounded-full border text-xs font-mono font-bold inline-flex items-center gap-2 w-fit ${activeStyle.badge}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${activeStyle.dot}`} />
                <span>{activeStyle.label}</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Checked: {new Date(activeReachability.checkedAt).toLocaleTimeString()}
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">{activeReachability.reason}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {activeReachability.checks.map((chk) => (
                <div
                  key={chk.key}
                  className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-start gap-2.5 text-xs"
                >
                  {chk.status === 'pass' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : chk.status === 'warn' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-white text-[11px]">{chk.label}</div>
                    <div className="text-[11px] text-slate-400 break-words">{chk.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. AUTOMATED WEBHOOK SETUP WIZARD
          ========================================================================= */}
      <div className="bg-slate-900/90 border border-sky-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] font-mono font-bold uppercase tracking-wider">
              <Wand2 className="w-3.5 h-3.5" />
              <span>3-Step Guided Wizard</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Automated Webhook Setup
            </h3>
            <p className="text-xs text-slate-400">
              Generate a cryptographically random 32-character secret, auto-populate your domain webhook URL, and register it with Telegram via <code className="text-sky-300">/api/telegram/setup-webhook</code>.
            </p>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center gap-2 text-xs font-mono">
            {[1, 2, 3].map((stepNum) => (
              <button
                key={stepNum}
                type="button"
                onClick={() => setWizardStep(stepNum as 1 | 2 | 3)}
                className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                  wizardStep === stepNum
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : wizardStep > stepNum
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Step {stepNum}
              </button>
            ))}
          </div>
        </div>

        {/* Step 1: Generate Random 32-Character Secret */}
        <div
          className={`p-5 rounded-2xl border space-y-4 transition-all ${
            wizardStep === 1 ? 'bg-slate-950 border-sky-500/40' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Step 1: Generate 32-Character Webhook Secret</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Creates a CSPRNG 32-character alphanumeric token for <code className="text-amber-300">TELEGRAM_WEBHOOK_SECRET</code>. Save it in Server Secrets before production deploys.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateSecret}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{generatedSecret ? 'Regenerate 32-Char Secret' : 'Generate 32-Char Secret'}</span>
            </button>
          </div>

          {generatedSecret && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-xs text-emerald-300 flex items-center justify-between gap-2">
                  <span className="truncate">
                    {showGeneratedSecret ? generatedSecret : '•'.repeat(32)}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {generatedSecret.length} chars
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGeneratedSecret((prev) => !prev)}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {showGeneratedSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showGeneratedSecret ? 'Hide' : 'Reveal'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyGeneratedSecret}
                  className="px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSecret ? 'Copied' : 'Copy Secret'}</span>
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applySecretToSetup}
                  onChange={(e) => setApplySecretToSetup(e.target.checked)}
                  className="w-4 h-4 accent-sky-500 rounded"
                />
                <span>
                  Send this generated secret as <code className="text-sky-300">secretToken</code> in Step 3 setup (remember to also store it in Server Secrets as <code className="text-amber-300">TELEGRAM_WEBHOOK_SECRET</code>)
                </span>
              </label>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <label className="block text-[11px] font-mono text-slate-400">
              Optional: <code className="text-sky-300">x-telegram-setup-secret</code> Header (Admin Firebase Bearer token is always sent automatically)
            </label>
            <input
              type="password"
              value={setupHeaderSecret}
              onChange={(e) => setSetupHeaderSecret(e.target.value)}
              placeholder="Optional TELEGRAM_SETUP_SECRET header override..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          {wizardStep === 1 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Next: Auto-Populate URL →
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Auto-Populate URL from Current Domain */}
        <div
          className={`p-5 rounded-2xl border space-y-4 transition-all ${
            wizardStep === 2 ? 'bg-slate-950 border-sky-500/40' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-sky-400" />
                <span>Step 2: Auto-Populate Webhook URL</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Auto-populated from the current domain (<code className="text-sky-300">{typeof window !== 'undefined' ? window.location.origin : 'https://...'}</code>). Edit if targeting a separate public Cloud Run URL.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAutoPopulateCurrentDomain}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-bold cursor-pointer shrink-0"
            >
              Auto-Populate Current Domain
            </button>
          </div>

          <input
            type="url"
            value={wizardWebhookUrl}
            onChange={(e) => setWizardWebhookUrl(e.target.value)}
            placeholder="https://<cloud-run-service>.run.app/api/telegram/webhook"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-sky-200 focus:outline-none focus:border-sky-500"
          />

          <div className="text-[11px] font-mono">
            {wizardUrlValidation.valid ? (
              <span className="text-emerald-400">
                ✓ Ready: {wizardUrlValidation.normalizedUrl}
              </span>
            ) : (
              <span className="text-rose-400">
                ⚠️ {wizardUrlValidation.reason}
              </span>
            )}
          </div>

          {wizardStep === 2 && (
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Next: Review & Configure →
              </button>
            </div>
          )}
        </div>

        {/* Step 3: Call /api/telegram/setup-webhook */}
        <div
          className={`p-5 rounded-2xl border space-y-4 transition-all ${
            wizardStep === 3 ? 'bg-slate-950 border-sky-500/40' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Rocket className="w-4 h-4 text-emerald-400" />
                <span>Step 3: Execute Setup via /api/telegram/setup-webhook</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Calls <code className="text-sky-300">POST /api/telegram/setup-webhook</code> with verified Admin Bearer headers and verifies Telegram&apos;s live webhook registration.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExecuteAutomatedSetup}
              disabled={runningSetup || !wizardUrlValidation.valid}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 shrink-0"
            >
              {runningSetup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              <span>{runningSetup ? 'Configuring Webhook...' : 'Configure Telegram Webhook'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
            <div className="text-slate-400 uppercase text-[10px] font-bold">Request Headers Preview</div>
            <div>Content-Type: application/json</div>
            <div>Authorization: Bearer &lt;Firebase Admin ID Token&gt;</div>
            {setupHeaderSecret.trim() && <div>x-telegram-setup-secret: ••••••••</div>}
            <div className="pt-1 text-sky-300">
              Payload: {JSON.stringify({ webhookUrl: wizardUrlValidation.normalizedUrl || wizardWebhookUrl, ...(applySecretToSetup && generatedSecret ? { secretToken: '[32-char CSPRNG secret]' } : {}) })}
            </div>
          </div>

          {setupError && (
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{setupError}</span>
            </div>
          )}

          {setupResponse?.ok && (
            <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/40 text-xs space-y-2">
              <div className="font-bold text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{setupResponse.message}</span>
              </div>
              <div className="font-mono text-[11px] text-slate-300">
                Bot: @{setupResponse.bot?.username} • Registered URL: {setupResponse.webhook?.url}
              </div>
              {setupResponse.secretSyncNotice && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px]">
                  ⚠️ {setupResponse.secretSyncNotice}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
