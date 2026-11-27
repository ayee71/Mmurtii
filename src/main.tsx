import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerPrecedentServiceWorker } from './services/precedentOfflineSync';

import { AuthProvider } from './context/AuthContext.tsx';
import { BookmarkProvider } from './context/BookmarkContext.tsx';
import { ReadingModeProvider } from './context/ReadingModeContext.tsx';

// Safe detection of iframe environment without cross-origin access violations
const isInIframeSafe = (): boolean => {
  try {
    return typeof window !== 'undefined' && (window.location.hostname.includes('aistudio.google.com') || window.self !== window.top);
  } catch {
    return true;
  }
};

// Handle Vite dynamic import chunk preload failures across new deployments
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite Preload] Failed to load dynamic chunk, auto-refreshing page to sync latest bundle:', event);
    const lastReload = Number(sessionStorage.getItem('last_vite_preload_ts') || '0');
    if (Date.now() - lastReload > 15000) {
      sessionStorage.setItem('last_vite_preload_ts', String(Date.now()));
      window.location.reload();
    }
  });

  // Global unhandled rejection shield for transient network/offline events
  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event?.reason || '');
    if (
      reason.includes('Firestore') ||
      reason.includes('backend') ||
      reason.includes('offline') ||
      reason.includes('Network')
    ) {
      event.preventDefault();
    }
  });
}

// Clean up any rogue or dev service workers safely so Vite dev chunks never go stale
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    if (isInIframeSafe() || import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().catch(() => {});
        }
      }).catch(() => {});
    } else {
      registerPrecedentServiceWorker().catch(() => {});
    }
  } catch {
    // Guard against restricted iframe sandbox contexts
  }
}


createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <BookmarkProvider>
      <ReadingModeProvider>
        <App />
      </ReadingModeProvider>
    </BookmarkProvider>
  </AuthProvider>
);
