/**
 * App Update & Link Entrance Synchronization Service
 * Ensures all users accessing the app (especially visitors opening shared links)
 * automatically detect and receive the newest version while preserving deep-link params.
 */

export const CURRENT_APP_VERSION = '4.2.1-PRO';
export const CURRENT_APP_BUILD_TIME = '2026-11-24T01:30:00Z';
export const APP_VERSION_STORAGE_KEY = 'seera_active_app_version';
export const APP_BUILD_TIME_STORAGE_KEY = 'seera_active_app_build_time';
export const LAST_UPDATE_CHECK_KEY = 'seera_last_update_check_ts';
const LINK_AUTO_UPDATE_GUARD_KEY = 'seera_auto_updated_target';

export interface AppUpdateInfo {
  isUpdateAvailable: boolean;
  isMandatory?: boolean;
  isLinkEntryUpdate?: boolean;
  currentVersion: string;
  latestVersion: string;
  buildTime?: string;
  releaseNotes?: string;
  features?: string[];
  autoUpdateCountdown?: number;
}

let activeUpdateInfo: AppUpdateInfo | null = null;
let updateListeners: ((info: AppUpdateInfo) => void)[] = [];
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;
let updateInFlight = false;

/**
 * Detects whether the visitor entered via a shared link or deep-link URL.
 */
export function isSharedLinkEntry(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const sp = new URLSearchParams(window.location.search);
    return Boolean(
      sp.get('by') ||
      sp.get('creator') ||
      sp.get('ref') ||
      sp.get('tab') ||
      sp.get('q') ||
      sp.get('query') ||
      sp.get('caseId') ||
      sp.get('case') ||
      sp.get('s') ||
      sp.get('state') ||
      sp.get('room') ||
      sp.get('meeting') ||
      sp.get('courtLink')
    );
  } catch {
    return false;
  }
}

/**
 * Register a listener for update availability
 */
export function onAppUpdateAvailable(listener: (info: AppUpdateInfo) => void): () => void {
  updateListeners.push(listener);
  if (activeUpdateInfo && activeUpdateInfo.isUpdateAvailable) {
    listener(activeUpdateInfo);
  }
  return () => {
    updateListeners = updateListeners.filter((l) => l !== listener);
  };
}

function notifyUpdateListeners(info: AppUpdateInfo) {
  activeUpdateInfo = info;
  updateListeners.forEach((listener) => {
    try {
      listener(info);
    } catch (e) {
      console.warn('Error notifying update listener:', e);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('seera:app_update_available', {
        detail: info,
      })
    );
  }
}

/**
 * Check if remote server or service worker has a newer version or buildTime.
 * Always calls reg.update() when checking from a link entry or manual trigger.
 */
export async function checkForAppUpdate(isManualOrLinkTrigger: boolean = false): Promise<AppUpdateInfo> {
  const currentVersion = CURRENT_APP_VERSION;
  const currentBuildTime = CURRENT_APP_BUILD_TIME;
  const enteredViaLink = isSharedLinkEntry();

  if (typeof window !== 'undefined') {
    if (!localStorage.getItem(APP_VERSION_STORAGE_KEY)) {
      localStorage.setItem(APP_VERSION_STORAGE_KEY, currentVersion);
    }
    if (!localStorage.getItem(APP_BUILD_TIME_STORAGE_KEY)) {
      localStorage.setItem(APP_BUILD_TIME_STORAGE_KEY, currentBuildTime);
    }
    localStorage.setItem(LAST_UPDATE_CHECK_KEY, String(Date.now()));
  }

  const storedVersion = typeof window !== 'undefined' ? localStorage.getItem(APP_VERSION_STORAGE_KEY) : null;

  // 1. Check with Service Worker for any waiting or newly-available worker
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        if (isManualOrLinkTrigger || enteredViaLink) {
          await reg.update().catch(() => {});
        }
        if (reg.waiting) {
          const info: AppUpdateInfo = {
            isUpdateAvailable: true,
            isMandatory: true,
            isLinkEntryUpdate: enteredViaLink,
            currentVersion: storedVersion || currentVersion,
            latestVersion: currentVersion,
            buildTime: currentBuildTime,
            autoUpdateCountdown: enteredViaLink ? 3 : 8,
            releaseNotes: 'Version haarawaan qophaa\'eera. Link kanaan yeroo seentan battalatti haaromfama.',
          };
          notifyUpdateListeners(info);
          return info;
        }
      }
    } catch (err) {
      console.warn('SW update check warning:', err);
    }
  }

  // 2. Always fetch live /version.json bypassing all HTTP/SW caches
  try {
    const timestamp = Date.now();
    const response = await fetch(`/version.json?_t=${timestamp}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const serverVersion = String(data.version || currentVersion);
      const serverBuildTime = typeof data.buildTime === 'string' ? data.buildTime : '';

      const isVersionDifferent = serverVersion !== currentVersion;
      const isBuildDifferent = Boolean(serverBuildTime && serverBuildTime !== currentBuildTime);
      const isServerAhead = isVersionDifferent || isBuildDifferent;
      const isMandatory = (Boolean(data.forceUpdate) || enteredViaLink) && isServerAhead;

      // User's currently loaded JS bundle matches server version & buildTime -> up to date!
      if (!isServerAhead) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(APP_VERSION_STORAGE_KEY, serverVersion);
          if (serverBuildTime) {
            localStorage.setItem(APP_BUILD_TIME_STORAGE_KEY, serverBuildTime);
          }
        }
        return {
          isUpdateAvailable: false,
          isMandatory: false,
          isLinkEntryUpdate: enteredViaLink,
          currentVersion,
          latestVersion: serverVersion,
          buildTime: serverBuildTime || currentBuildTime,
          releaseNotes: data.releaseNotes,
          features: Array.isArray(data.features) ? data.features : [],
        };
      }

      const targetSignature = `${serverVersion}:${serverBuildTime}`;
      const alreadyAutoUpdatedThisSession =
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem(LINK_AUTO_UPDATE_GUARD_KEY) === targetSignature;

      // Prevent repeated non-mandatory toast spam within the same browser session
      const alreadyNotified =
        typeof sessionStorage !== 'undefined' && sessionStorage.getItem('seera_update_notified') === 'true';

      const updateInfo: AppUpdateInfo = {
        isUpdateAvailable: true,
        isMandatory,
        isLinkEntryUpdate: enteredViaLink,
        currentVersion: storedVersion || currentVersion,
        latestVersion: serverVersion,
        buildTime: serverBuildTime,
        autoUpdateCountdown: enteredViaLink ? 3 : 10,
        releaseNotes:
          data.releaseNotes ||
          'Moodeelota AI, sirna hojii mana murtii fi seerota haaromfaman.',
        features: Array.isArray(data.features) ? data.features : [],
      };

      // When a user opens a shared link with a stale cached bundle, automatically apply update immediately (once per target version)
      if (enteredViaLink && isMandatory && !alreadyAutoUpdatedThisSession && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(LINK_AUTO_UPDATE_GUARD_KEY, targetSignature);
        notifyUpdateListeners(updateInfo);
        await applyAppUpdate();
        return updateInfo;
      }

      if (isManualOrLinkTrigger || isMandatory || !alreadyNotified) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('seera_update_notified', 'true');
        }
        notifyUpdateListeners(updateInfo);
      }

      return updateInfo;
    }
  } catch (err) {
    console.warn('Live version.json check failed:', err);
  }

  return {
    isUpdateAvailable: false,
    isLinkEntryUpdate: enteredViaLink,
    currentVersion: storedVersion || currentVersion,
    latestVersion: currentVersion,
    buildTime: currentBuildTime,
  };
}

/**
 * Execute hard update: evicts old caches, notifies SW, records latest version, reloads preserving URL & deep-link params
 */
export async function applyAppUpdate(): Promise<void> {
  if (typeof window === 'undefined' || updateInFlight) return;
  updateInFlight = true;

  try {
    // 1. Clear all CacheStorage entries
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // 2. Ask any ServiceWorker to update & skipWaiting, briefly awaiting activation
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update().catch(() => {});
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    // 3. Mark updated version and buildTime in storage
    const targetVersion = activeUpdateInfo?.latestVersion || CURRENT_APP_VERSION;
    const targetBuildTime = activeUpdateInfo?.buildTime || CURRENT_APP_BUILD_TIME;
    localStorage.setItem(APP_VERSION_STORAGE_KEY, targetVersion);
    localStorage.setItem(APP_BUILD_TIME_STORAGE_KEY, targetBuildTime);
    localStorage.setItem('seera_last_updated_at', new Date().toISOString());
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('seera_update_notified');
    }

    // 4. Reload page preserving all search queries (?tab, ?q, ?caseId, ?by, ?lang), hash, and route state
    const currentUrl = window.location.href;
    const urlObj = new URL(currentUrl);
    urlObj.searchParams.set('_v', String(Date.now())); // bust HTTP cache while preserving deep-link params
    window.location.replace(urlObj.toString());
  } catch (e) {
    console.error('Failed to apply app update, forcing reload:', e);
    window.location.reload();
  } finally {
    updateInFlight = false;
  }
}

/**
 * Initialize automatic update listening on app start.
 * Runs immediately when visitors arrive via shared links so stale bundles update right away.
 */
export function initAppUpdateEngine(): () => void {
  if (typeof window === 'undefined') return () => {};

  if (!localStorage.getItem(APP_VERSION_STORAGE_KEY)) {
    localStorage.setItem(APP_VERSION_STORAGE_KEY, CURRENT_APP_VERSION);
  }
  if (!localStorage.getItem(APP_BUILD_TIME_STORAGE_KEY)) {
    localStorage.setItem(APP_BUILD_TIME_STORAGE_KEY, CURRENT_APP_BUILD_TIME);
  }

  const enteredViaLink = isSharedLinkEntry();

  // 1. Check immediately on shared-link entry, or after 500ms on normal navigation
  const initialTimer = setTimeout(() => {
    void checkForAppUpdate(enteredViaLink);
  }, enteredViaLink ? 0 : 500);

  // 2. Listen to ServiceWorker activation/update messages
  const handleSwMessage = (event: MessageEvent) => {
    if (!event.data) return;
    if (event.data.type === 'SEERA_SW_ACTIVATED' || event.data.type === 'APP_UPDATE_AVAILABLE') {
      const swVer = event.data.version || CURRENT_APP_VERSION;
      const storedVer = localStorage.getItem(APP_VERSION_STORAGE_KEY);
      if (swVer !== CURRENT_APP_VERSION || (storedVer && storedVer !== swVer)) {
        const info: AppUpdateInfo = {
          isUpdateAvailable: true,
          isMandatory: true,
          isLinkEntryUpdate: isSharedLinkEntry(),
          currentVersion: storedVer || CURRENT_APP_VERSION,
          latestVersion: swVer,
          autoUpdateCountdown: isSharedLinkEntry() ? 3 : 8,
          releaseNotes: 'Service Worker haaromfameera. Version haaraa argachuuf amma haaromsi.',
        };
        notifyUpdateListeners(info);
      } else {
        void checkForAppUpdate(isSharedLinkEntry());
      }
    }
  };

  const handleControllerChange = () => {
    void checkForAppUpdate(true);
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
  }

  // 3. Check whenever tab comes into focus / visibilitychange
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void checkForAppUpdate(isSharedLinkEntry());
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleVisibilityChange);

  // 4. Periodic background update check every 5 minutes
  updateCheckTimer = setInterval(() => {
    void checkForAppUpdate();
  }, 5 * 60 * 1000);

  return () => {
    clearTimeout(initialTimer);
    if (updateCheckTimer) clearInterval(updateCheckTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleVisibilityChange);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    }
  };
}
