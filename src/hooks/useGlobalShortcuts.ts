import { useEffect, useCallback } from 'react';

export interface ShortcutHandlers {
  onOpenSearch: () => void;
  onNewDocument?: () => void;
  onSave: () => void;
  onPrint: () => void;
  onOpenHelp: () => void;
  onCloseModals: () => void;
  onNavigateTab: (tab: string) => void;
  onToggleReadingMode?: () => void;
}

export function useGlobalShortcuts(handlers: ShortcutHandlers) {
  const {
    onOpenSearch,
    onNewDocument,
    onSave,
    onPrint,
    onOpenHelp,
    onCloseModals,
    onNavigateTab,
    onToggleReadingMode,
  } = handlers;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMac =
        typeof navigator !== 'undefined' &&
        navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isMod = isMac ? e.metaKey : e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isInput =
        Boolean(target) &&
        (target!.tagName === 'INPUT' ||
          target!.tagName === 'TEXTAREA' ||
          target!.tagName === 'SELECT' ||
          target!.isContentEditable ||
          target!.getAttribute('role') === 'textbox');

      // 1. Ctrl+K or Cmd+K: Open Search / Command Palette (Global everywhere)
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        e.stopPropagation();
        onOpenSearch();
        return;
      }

      // 2. Ctrl+S or Cmd+S: Quick Save (Global everywhere, prevent browser "Save Page As HTML")
      if (isMod && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        onSave();
        return;
      }

      // 3. Ctrl+P or Cmd+P: Quick Print / PDF Export (Global everywhere, trigger legal print)
      if (isMod && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        onPrint();
        return;
      }

      // 4. Ctrl+/ or Cmd+/: Open Keyboard Shortcuts Help Cheat Sheet
      if (isMod && e.key === '/') {
        e.preventDefault();
        e.stopPropagation();
        onOpenHelp();
        return;
      }

      // 5. Escape: Close open modals / dialogs / palette (or exit Reading Mode)
      if (e.key === 'Escape') {
        onCloseModals();
        return;
      }

      // 6. Alt+N: New Legal Document draft (safe across browsers without conflicting with Ctrl+N)
      if (e.altKey && !isMod && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (onNewDocument) {
          onNewDocument();
        } else {
          onNavigateTab('create');
        }
        return;
      }

      // 7. Alt+R: Toggle Distraction-Free Reading Mode
      if (e.altKey && !isMod && !e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (onToggleReadingMode) {
          onToggleReadingMode();
        }
        return;
      }

      // 8. Alt+S: Quick open Settings
      if (e.altKey && !isMod && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onNavigateTab('settings');
        return;
      }

      // 9. Alt+1 through Alt+0: Fast tab navigation
      if (e.altKey && !isMod) {
        const keyMap: Record<string, string> = {
          '1': 'home',
          '2': 'explainLaw',
          '3': 'cassation',
          '4': 'docAnalysis',
          '5': 'create',
          '6': 'translate',
          '7': 'myContent',
          '8': 'courtroomAssistant',
          '9': 'library',
          '0': 'inquiryAnalytics',
        };

        if (keyMap[e.key]) {
          e.preventDefault();
          onNavigateTab(keyMap[e.key]);
          return;
        }
      }

      // 10. '/' when NOT focused on an input: Quick Global Search
      if (!isInput && e.key === '/' && !isMod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      // 11. '?' key when NOT focused on an input: Show shortcuts cheat sheet
      if (!isInput && e.key === '?' && !isMod && !e.altKey) {
        e.preventDefault();
        onOpenHelp();
        return;
      }
    },
    [onOpenSearch, onNewDocument, onSave, onPrint, onOpenHelp, onCloseModals, onNavigateTab, onToggleReadingMode]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
