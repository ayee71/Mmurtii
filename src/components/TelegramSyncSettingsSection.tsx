import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Radio,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import type { Language } from '../i18n/translations';
import {
  TELEGRAM_AUTO_SYNC_FREQUENCY_OPTIONS,
  TELEGRAM_FEED_CHANNEL_OPTIONS,
  TelegramAutoSyncFrequency,
  TelegramFeedChannelId,
  TelegramSyncSettings,
  getTelegramSyncSettings,
  onTelegramSyncSettingsUpdated,
  saveTelegramSyncSettings,
  syncTelegramSettingsToUserProfile,
} from '../services/telegramSyncSettings';
import {
  getLastTelegramSyncTimestamp,
  onTelegramLiveFeedUpdated,
  syncLiveTelegramFeedCache,
} from '../services/telegramLiveFeedSync';

export interface TelegramSyncSettingsSectionProps {
  currentLang: Language;
  variant?: 'indigo' | 'amber' | 'cyan';
  defaultExpanded?: boolean;
  onSyncCompleted?: () => void;
  onSettingsChange?: (settings: TelegramSyncSettings) => void;
}

export const TelegramSyncSettingsSection: React.FC<TelegramSyncSettingsSectionProps> = ({
  currentLang,
  variant = 'indigo',
  defaultExpanded = false,
  onSyncCompleted,
  onSettingsChange,
}) => {
  const langKey = String(currentLang || 'om').toLowerCase().startsWith('am')
    ? 'am'
    : String(currentLang || 'om').toLowerCase().startsWith('en')
      ? 'en'
      : 'om';

  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [settings, setSettings] = useState<TelegramSyncSettings>(() => getTelegramSyncSettings());
  const [lastSyncedMs, setLastSyncedMs] = useState<number>(() => getLastTelegramSyncTimestamp());
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<'local' | 'cloud' | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const unsubSettings = onTelegramSyncSettingsUpdated((updated) => {
      setSettings(updated);
      onSettingsChange?.(updated);
    });
    const unsubFeed = onTelegramLiveFeedUpdated(() => {
      setLastSyncedMs(getLastTelegramSyncTimestamp() || Date.now());
    });
    return () => {
      unsubSettings();
      unsubFeed();
    };
  }, [onSettingsChange]);

  const labels = useMemo(() => {
    if (langKey === 'am') {
      return {
        title: 'የማመሳሰል ቅንብሮች (Sync Settings)',
        subtitle: 'የአካባቢ የሕግ መረጃ ቻናሎችን እና የራስ-ሰር ማመሳሰል ድግግሞሽን ይቆጣጠሩ',
        channelsHeading: 'የቴሌግራም የሕግ ቻናሎች',
        frequencyHeading: 'ራስ-ሰር የማመሳሰል ድግግሞሽ (Auto-Sync Frequency)',
        frequencyLabel: 'ድግግሞሽ ይምረጡ',
        syncNow: 'አሁን አመሳስል',
        syncing: 'በማመሳሰል ላይ...',
        lastSynced: 'መጨረሻ የተመሳሰለበት',
        neverSynced: 'ገና አልተመሳሰለም',
        noChannelsWarning:
          'ምንም ቻናል አልተመረጠም። የአካባቢ የሕግ መረጃዎችን ለመቀበል ቢያንስ @seeraai_ethio ወይም @wakolegalstudio ያብሩ።',
        savedLocal: 'ቅንብሮች ተቀምጠዋል',
        savedCloud: 'ቅንብሮች በመለያዎ ተቀምጠዋል',
        syncFailed: 'ማመሳሰል አልተቻለም። እባክዎ ኢንተርኔትዎን ያረጋግጡ።',
        activeCount: `${settings.enabledChannels.length}/${TELEGRAM_FEED_CHANNEL_OPTIONS.length} ቻናሎች`,
        configure: 'ቅንብሮች',
      };
    }

    if (langKey === 'en') {
      return {
        title: 'Sync Settings',
        subtitle: 'Toggle Telegram legal channels and set auto-sync frequency for your local legal feed',
        channelsHeading: 'Monitored Telegram Channels',
        frequencyHeading: 'Auto-Sync Frequency',
        frequencyLabel: 'Sync Schedule',
        syncNow: 'Sync Now',
        syncing: 'Syncing...',
        lastSynced: 'Last synced',
        neverSynced: 'Not synced yet',
        noChannelsWarning:
          'No channels enabled. Turn on @seeraai_ethio or @wakolegalstudio to populate your local legal feed.',
        savedLocal: 'Saved to local preferences',
        savedCloud: 'Synced to account & device',
        syncFailed: 'Sync failed. Check your connection and try again.',
        activeCount: `${settings.enabledChannels.length}/${TELEGRAM_FEED_CHANNEL_OPTIONS.length} Channels`,
        configure: 'Sync Settings',
      };
    }

    return {
      title: "Qindaa'ina Walsimsiisaa (Sync Settings)",
      subtitle: 'Chaanaloota seeraa Telegram filadhu fi saffisa walsimsiisa ofummaa kuusaa dhihoo murteessi',
      channelsHeading: 'Chaanaloota Seeraa Telegram',
      frequencyHeading: 'Yeroo Walsimsiisa Ofummaa (Auto-Sync Frequency)',
      frequencyLabel: 'Sagantaa Walsimsiisaa',
      syncNow: 'Amma Walsimsiisi',
      syncing: 'Walsimsiisaa jira...',
      lastSynced: 'Yeroo dhihoo walsime',
      neverSynced: 'Ammaaf hin walsimne',
      noChannelsWarning:
        'Chaanaalli tokkollee hin filatamne. Oduu seeraa dhihoo argachuuf yoo xiqqaate @seeraai_ethio ykn @wakolegalstudio bani.',
      savedLocal: 'Qindaa’inni kuufameera',
      savedCloud: 'Qindaa’inni akkawuntii fi meeshaa irratti kuufameera',
      syncFailed: 'Walsimsiisuun hin milkoofne. Qunnamtii interneetii mirkaneeffadhu.',
      activeCount: `Chaanaloota ${settings.enabledChannels.length}/${TELEGRAM_FEED_CHANNEL_OPTIONS.length}`,
      configure: 'Sync Settings',
    };
  }, [langKey, settings.enabledChannels.length]);

  const activeFrequencyLabel = useMemo(() => {
    const found = TELEGRAM_AUTO_SYNC_FREQUENCY_OPTIONS.find(
      (opt) => opt.id === settings.autoSyncFrequency,
    );
    return found ? found.label[langKey] : settings.autoSyncFrequency;
  }, [langKey, settings.autoSyncFrequency]);

  const lastSyncedLabel = useMemo(() => {
    if (!lastSyncedMs) return labels.neverSynced;
    try {
      return new Intl.DateTimeFormat(
        langKey === 'am' ? 'am-ET' : langKey === 'en' ? 'en-US' : 'om-ET',
        {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        },
      ).format(new Date(lastSyncedMs));
    } catch {
      return new Date(lastSyncedMs).toLocaleTimeString();
    }
  }, [lastSyncedMs, langKey, labels.neverSynced]);

  const palette = useMemo(() => {
    if (variant === 'amber') {
      return {
        container: 'border-amber-500/30 bg-slate-900/90',
        accentText: 'text-amber-300',
        accentBorder: 'border-amber-500/40',
        activeToggle: 'bg-amber-500',
        activeCard: 'border-amber-500/50 bg-amber-950/30',
        button: 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
      };
    }
    if (variant === 'cyan') {
      return {
        container: 'border-cyan-500/30 bg-slate-950/90',
        accentText: 'text-cyan-300',
        accentBorder: 'border-cyan-500/40',
        activeToggle: 'bg-cyan-500',
        activeCard: 'border-cyan-500/50 bg-cyan-950/30',
        button: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25',
      };
    }
    return {
      container: 'border-indigo-500/30 bg-slate-950/85',
      accentText: 'text-indigo-300',
      accentBorder: 'border-indigo-500/40',
      activeToggle: 'bg-indigo-600',
      activeCard: 'border-indigo-500/50 bg-indigo-950/40',
      button: 'border-indigo-500/40 bg-indigo-600/20 text-indigo-200 hover:bg-indigo-600/30',
    };
  }, [variant]);

  const persistUpdate = async (patch: Partial<TelegramSyncSettings>, triggerSyncNow: boolean) => {
    setSyncError(null);
    const next = saveTelegramSyncSettings(patch);
    setSettings(next);
    onSettingsChange?.(next);

    const cloudRes = await syncTelegramSettingsToUserProfile(next);
    setSavedNotice(cloudRes.savedToCloud ? 'cloud' : 'local');
    setTimeout(() => {
      setSavedNotice((curr) => (curr ? null : curr));
    }, 2500);

    if (triggerSyncNow) {
      setIsManualSyncing(true);
      try {
        await syncLiveTelegramFeedCache({ force: true });
        setLastSyncedMs(getLastTelegramSyncTimestamp() || Date.now());
        onSyncCompleted?.();
      } catch {
        setSyncError(labels.syncFailed);
      } finally {
        setIsManualSyncing(false);
      }
    }
  };

  const handleToggleChannel = (channelId: TelegramFeedChannelId) => {
    const exists = settings.enabledChannels.includes(channelId);
    const enabledChannels = exists
      ? settings.enabledChannels.filter((id) => id !== channelId)
      : [...settings.enabledChannels, channelId];
    void persistUpdate({ enabledChannels }, true);
  };

  const handleFrequencyChange = (autoSyncFrequency: TelegramAutoSyncFrequency) => {
    void persistUpdate({ autoSyncFrequency }, false);
  };

  const handleManualSyncNow = async () => {
    setSyncError(null);
    setIsManualSyncing(true);
    try {
      const detail = await syncLiveTelegramFeedCache({ force: true });
      if (!detail) {
        setSyncError(labels.syncFailed);
      } else {
        setLastSyncedMs(getLastTelegramSyncTimestamp() || Date.now());
        onSyncCompleted?.();
      }
    } catch {
      setSyncError(labels.syncFailed);
    } finally {
      setIsManualSyncing(false);
    }
  };

  return (
    <section
      aria-label={labels.title}
      className={`rounded-2xl border ${palette.container} transition-all`}
    >
      {/* Compact Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex flex-1 min-w-0 items-center justify-between gap-3 text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Sliders className={`h-4 w-4 shrink-0 ${palette.accentText}`} aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-100">{labels.title}</span>
                <span className={`font-mono text-[10px] font-semibold ${palette.accentText}`}>
                  {labels.activeCount} • {activeFrequencyLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {labels.lastSynced}: {lastSyncedLabel}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 group-hover:text-white shrink-0">
            <span>{labels.configure}</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => void handleManualSyncNow()}
          disabled={isManualSyncing || settings.enabledChannels.length === 0}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shrink-0 ${palette.button}`}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isManualSyncing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{isManualSyncing ? labels.syncing : labels.syncNow}</span>
        </button>
      </div>

      {/* Expanded Configuration Panel */}
      {isExpanded && (
        <div className="border-t border-slate-800/90 px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">{labels.subtitle}</p>
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{savedNotice === 'cloud' ? labels.savedCloud : labels.savedLocal}</span>
              </span>
            )}
          </div>

          {syncError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
              <span>{syncError}</span>
            </div>
          )}

          {settings.enabledChannels.length === 0 && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
              <span>{labels.noChannelsWarning}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Channel Toggles (@seeraai_ethio vs @wakolegalstudio) */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                <Radio className={`h-3.5 w-3.5 ${palette.accentText}`} aria-hidden="true" />
                <span>{labels.channelsHeading}</span>
              </div>

              <div className="space-y-2">
                {TELEGRAM_FEED_CHANNEL_OPTIONS.map((ch) => {
                  const isEnabled = settings.enabledChannels.includes(ch.id);
                  return (
                    <div
                      key={ch.id}
                      className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors ${
                        isEnabled
                          ? palette.activeCard
                          : 'border-slate-800 bg-slate-900/60 opacity-80'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {ch.handle}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-300">
                            {ch.title[langKey]}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-400">
                          {ch.description[langKey]}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isEnabled}
                        aria-label={`Toggle ${ch.handle}`}
                        onClick={() => handleToggleChannel(ch.id)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          isEnabled ? palette.activeToggle : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Auto-Sync Frequency Controls */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                <Clock className={`h-3.5 w-3.5 ${palette.accentText}`} aria-hidden="true" />
                <span>{labels.frequencyHeading}</span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-3">
                <div>
                  <label
                    htmlFor={`telegram-sync-freq-${variant}`}
                    className="block text-[11px] font-semibold text-slate-300 mb-1.5"
                  >
                    {labels.frequencyLabel}
                  </label>
                  <select
                    id={`telegram-sync-freq-${variant}`}
                    value={settings.autoSyncFrequency}
                    onChange={(e) =>
                      handleFrequencyChange(e.target.value as TelegramAutoSyncFrequency)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100 focus:border-indigo-400 focus:outline-none cursor-pointer"
                  >
                    {TELEGRAM_AUTO_SYNC_FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label[langKey]}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  role="radiogroup"
                  aria-label={labels.frequencyHeading}
                  className="grid grid-cols-2 sm:grid-cols-3 gap-1.5"
                >
                  {TELEGRAM_AUTO_SYNC_FREQUENCY_OPTIONS.map((opt) => {
                    const isSelected = settings.autoSyncFrequency === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleFrequencyChange(opt.id)}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer text-left truncate ${
                          isSelected
                            ? `${palette.activeCard} ${palette.accentText} font-bold`
                            : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {opt.label[langKey]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
