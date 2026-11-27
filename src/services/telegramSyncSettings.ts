import { doc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export type TelegramFeedChannelId = 'seeraai_ethio' | 'wakolegalstudio';

export type TelegramAutoSyncFrequency = 'manual' | '5m' | '15m' | '30m' | '1h' | '6h';

export interface TelegramFeedChannelDefinition {
  id: TelegramFeedChannelId;
  handle: string;
  url: string;
  title: { om: string; am: string; en: string };
  description: { om: string; am: string; en: string };
}

export interface TelegramSyncFrequencyOption {
  id: TelegramAutoSyncFrequency;
  intervalMs: number | null;
  label: { om: string; am: string; en: string };
}

export interface TelegramSyncSettings {
  enabledChannels: TelegramFeedChannelId[];
  autoSyncFrequency: TelegramAutoSyncFrequency;
  updatedAt: string;
}

export const TELEGRAM_SYNC_SETTINGS_STORAGE_KEY = 'seera_telegram_sync_settings_v1';
export const TELEGRAM_SYNC_SETTINGS_UPDATED_EVENT = 'seera:telegram_sync_settings_updated';

export const TELEGRAM_FEED_CHANNEL_OPTIONS: readonly TelegramFeedChannelDefinition[] = [
  {
    id: 'seeraai_ethio',
    handle: '@seeraai_ethio',
    url: 'https://t.me/seeraai_ethio',
    title: {
      om: 'SeeraAI Master Legal Channel',
      am: 'SeeraAI ዋና የሕግ ቻናል',
      en: 'SeeraAI Master Legal Channel',
    },
    description: {
      om: 'Labsiilee haaraa, dambiiwwan, qajeelfamoota fi murtiiwwan dhaddacha ijibbaataa yeroo yeroo.',
      am: 'አዲስ አዋጆች፣ ደንቦች፣ መመሪያዎች እና የሰበር ችሎት ውሳኔዎች በቀጥታ።',
      en: 'Proclamations, court directives, legal briefings, and Supreme Court updates.',
    },
  },
  {
    id: 'wakolegalstudio',
    handle: '@wakolegalstudio',
    url: 'https://t.me/wakolegalstudio',
    title: {
      om: 'Wako Legal Studio Archive',
      am: 'ዋኮ የሕግ ስቱዲዮ ማህደር',
      en: 'Wako Legal Studio Archive',
    },
    description: {
      om: 'Kuusaa galmeelee seeraa 1,500+ fi murtiiwwan dhaddacha ijibbaataa MMWF dirqisiisoo.',
      am: 'ከ1,500+ በላይ የሕግ ሰነዶችና አስገዳጅ የፌዴራል ሰበር ውሳኔዎች ማህደር።',
      en: '1,500+ curated Ethiopian legal files and binding FSC Cassation precedents.',
    },
  },
] as const;

export const TELEGRAM_AUTO_SYNC_FREQUENCY_OPTIONS: readonly TelegramSyncFrequencyOption[] = [
  {
    id: 'manual',
    intervalMs: null,
    label: {
      om: 'Harkaan qofa (Manual / Off)',
      am: 'በእጅ ብቻ (Manual / Off)',
      en: 'Manual Only (Off)',
    },
  },
  {
    id: '5m',
    intervalMs: 5 * 60 * 1000,
    label: {
      om: 'Daqiiqaa 5 hunda',
      am: 'በየ5 ደቂቃው',
      en: 'Every 5 minutes',
    },
  },
  {
    id: '15m',
    intervalMs: 15 * 60 * 1000,
    label: {
      om: 'Daqiiqaa 15 hunda',
      am: 'በየ15 ደቂቃው',
      en: 'Every 15 minutes',
    },
  },
  {
    id: '30m',
    intervalMs: 30 * 60 * 1000,
    label: {
      om: 'Daqiiqaa 30 hunda (Idilee)',
      am: 'በየ30 ደቂቃው (መደበኛ)',
      en: 'Every 30 minutes (Default)',
    },
  },
  {
    id: '1h',
    intervalMs: 60 * 60 * 1000,
    label: {
      om: 'Sa\'aatii 1 hunda',
      am: 'በየ1 ሰዓቱ',
      en: 'Every 1 hour',
    },
  },
  {
    id: '6h',
    intervalMs: 6 * 60 * 60 * 1000,
    label: {
      om: 'Sa\'aatii 6 hunda',
      am: 'በየ6 ሰዓቱ',
      en: 'Every 6 hours',
    },
  },
] as const;

const VALID_CHANNEL_SET = new Set<TelegramFeedChannelId>(['seeraai_ethio', 'wakolegalstudio']);
const VALID_FREQUENCY_SET = new Set<TelegramAutoSyncFrequency>([
  'manual',
  '5m',
  '15m',
  '30m',
  '1h',
  '6h',
]);

export function getDefaultTelegramSyncSettings(): TelegramSyncSettings {
  return {
    enabledChannels: ['seeraai_ethio', 'wakolegalstudio'],
    autoSyncFrequency: '30m',
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeTelegramChannelId(value: unknown): TelegramFeedChannelId | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/t\.me\//, '')
    .replace(/^@/, '')
    .split('/')[0]
    .trim();
  if (VALID_CHANNEL_SET.has(cleaned as TelegramFeedChannelId)) {
    return cleaned as TelegramFeedChannelId;
  }
  return null;
}

export function sanitizeTelegramSyncSettings(input: unknown): TelegramSyncSettings {
  const defaults = getDefaultTelegramSyncSettings();
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return defaults;
  }

  const record = input as Record<string, unknown>;

  let enabledChannels: TelegramFeedChannelId[] = defaults.enabledChannels;
  if (Array.isArray(record.enabledChannels)) {
    const normalized: TelegramFeedChannelId[] = [];
    for (const entry of record.enabledChannels) {
      const ch = normalizeTelegramChannelId(entry);
      if (ch && !normalized.includes(ch)) {
        normalized.push(ch);
      }
    }
    // Respect empty array if user explicitly disabled all channels
    enabledChannels = normalized;
  }

  const freqCandidate =
    typeof record.autoSyncFrequency === 'string'
      ? (record.autoSyncFrequency.trim() as TelegramAutoSyncFrequency)
      : defaults.autoSyncFrequency;
  const autoSyncFrequency: TelegramAutoSyncFrequency = VALID_FREQUENCY_SET.has(freqCandidate)
    ? freqCandidate
    : defaults.autoSyncFrequency;

  const updatedAt =
    typeof record.updatedAt === 'string' && record.updatedAt.trim()
      ? record.updatedAt
      : new Date().toISOString();

  return {
    enabledChannels,
    autoSyncFrequency,
    updatedAt,
  };
}

export function getAutoSyncIntervalMs(frequency: TelegramAutoSyncFrequency): number | null {
  const found = TELEGRAM_AUTO_SYNC_FREQUENCY_OPTIONS.find((opt) => opt.id === frequency);
  return found ? found.intervalMs : 30 * 60 * 1000;
}

export function buildChannelFeedQueryParam(enabledChannels: TelegramFeedChannelId[]): string {
  if (!Array.isArray(enabledChannels) || enabledChannels.length === 0) {
    return 'none';
  }
  if (enabledChannels.length >= TELEGRAM_FEED_CHANNEL_OPTIONS.length) {
    return 'all';
  }
  return enabledChannels[0];
}

export function buildChannelsCsvParam(enabledChannels: TelegramFeedChannelId[]): string {
  if (!Array.isArray(enabledChannels) || enabledChannels.length === 0) {
    return 'none';
  }
  return enabledChannels.join(',');
}

export function getTelegramSyncSettings(): TelegramSyncSettings {
  if (typeof window === 'undefined') {
    return getDefaultTelegramSyncSettings();
  }
  try {
    const raw = window.localStorage.getItem(TELEGRAM_SYNC_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return getDefaultTelegramSyncSettings();
    }
    return sanitizeTelegramSyncSettings(JSON.parse(raw));
  } catch {
    return getDefaultTelegramSyncSettings();
  }
}

export function saveTelegramSyncSettings(
  patch: Partial<TelegramSyncSettings>,
): TelegramSyncSettings {
  const current = getTelegramSyncSettings();
  const next = sanitizeTelegramSyncSettings({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(TELEGRAM_SYNC_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota or private browsing errors
    }

    window.dispatchEvent(
      new CustomEvent<TelegramSyncSettings>(TELEGRAM_SYNC_SETTINGS_UPDATED_EVENT, {
        detail: next,
      }),
    );
  }

  return next;
}

export function toggleTelegramSyncChannel(channelId: TelegramFeedChannelId): TelegramSyncSettings {
  const current = getTelegramSyncSettings();
  const exists = current.enabledChannels.includes(channelId);
  const enabledChannels = exists
    ? current.enabledChannels.filter((id) => id !== channelId)
    : [...current.enabledChannels, channelId];
  return saveTelegramSyncSettings({ enabledChannels });
}

export function onTelegramSyncSettingsUpdated(
  listener: (settings: TelegramSyncSettings) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<TelegramSyncSettings>;
    if (customEvent.detail) {
      listener(sanitizeTelegramSyncSettings(customEvent.detail));
    } else {
      listener(getTelegramSyncSettings());
    }
  };

  const storageHandler = (event: StorageEvent) => {
    if (event.key === TELEGRAM_SYNC_SETTINGS_STORAGE_KEY) {
      listener(getTelegramSyncSettings());
    }
  };

  window.addEventListener(TELEGRAM_SYNC_SETTINGS_UPDATED_EVENT, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(TELEGRAM_SYNC_SETTINGS_UPDATED_EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
}

/**
 * Persists user Telegram sync preferences to Firestore when an authenticated
 * non-anonymous user is active. Fails non-destructively if offline/unauthenticated.
 */
export async function syncTelegramSettingsToUserProfile(
  settings: TelegramSyncSettings,
): Promise<{ savedToCloud: boolean }> {
  const currentUser = auth?.currentUser;
  if (!db || !currentUser || currentUser.isAnonymous) {
    return { savedToCloud: false };
  }

  const path = `users/${currentUser.uid}`;
  try {
    await setDoc(
      doc(db, 'users', currentUser.uid),
      {
        telegramSyncSettings: {
          enabledChannels: settings.enabledChannels,
          autoSyncFrequency: settings.autoSyncFrequency,
          updatedAt: settings.updatedAt,
        },
      },
      { merge: true },
    );
    return { savedToCloud: true };
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } catch {
      // Do not crash UI if network/permissions prevent cloud preference mirror; local persistence remains active.
    }
    return { savedToCloud: false };
  }
}
