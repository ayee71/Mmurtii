import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Language } from '../i18n/translations';
import { Search, FilePlus2, Save, Printer, Compass, Keyboard, X, ArrowRight } from 'lucide-react';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  activeTab?: string;
  onNavigateTab?: (tab: string) => void;
  onOpenSearch?: () => void;
  onNewDocument?: () => void;
  onTriggerSave?: () => void;
  onTriggerPrint?: () => void;
  onToggleReadingMode?: () => void;
}

interface ShortcutItem {
  id: string;
  keys: string[];
  altKeys?: string[];
  label: string;
  desc: string;
  tabId?: string;
  onExecute?: () => void;
}

interface ShortcutGroup {
  id: string;
  title: string;
  shortcuts: ShortcutItem[];
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  activeTab,
  onNavigateTab,
  onOpenSearch,
  onNewDocument,
  onTriggerSave,
  onTriggerPrint,
  onToggleReadingMode,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const filterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFilterQuery('');
      const timer = setTimeout(() => {
        filterInputRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const isMac =
    typeof navigator !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const triggerAndClose = (fn?: () => void) => {
    onClose();
    if (fn) {
      setTimeout(() => fn(), 0);
    }
  };

  const navigateAndClose = (tab: string) => {
    onClose();
    if (onNavigateTab) {
      setTimeout(() => onNavigateTab(tab), 0);
    } else {
      window.dispatchEvent(new CustomEvent('seera:navigate_tab', { detail: { tab } }));
    }
  };

  const shortcutGroups = useMemo<ShortcutGroup[]>(() => {
    return [
      {
        id: 'search_command',
        title:
          currentLang === 'om'
            ? '🔍 Barbaacha & Tarkaanfiiwwan Ijoo (Search & Actions)'
            : currentLang === 'am'
              ? '🔍 ፍለጋ እና ዋና እርምጃዎች'
              : '🔍 Global Search & Common Actions',
        shortcuts: [
          {
            id: 'action-search',
            keys: [modKey, 'K'],
            altKeys: ['/'],
            label:
              currentLang === 'om'
                ? 'Barbaacha Waliigalaa (Global Search & Command)'
                : currentLang === 'am'
                  ? 'አጠቃላይ ፍለጋ እና ትዕዛዝ (Search)'
                  : 'Open Search & Command Palette',
            desc:
              currentLang === 'om'
                ? 'Seera, murtii ijibbaataa, meeshaalee fi unkaalee bakka jirtanitti barbaadaa.'
                : currentLang === 'am'
                  ? 'ሕጎችን፣ የሰበር ውሳኔዎችን እና መሳሪያዎችን በፍጥነት ይፈልጉ።'
                  : 'Search tools, cassation precedents, statutes, and templates anywhere.',
            onExecute: () => triggerAndClose(onOpenSearch),
          },
          {
            id: 'action-new-doc',
            keys: ['Alt', 'N'],
            label:
              currentLang === 'om'
                ? 'Sanada Haaraa Qopheessi (New Document)'
                : currentLang === 'am'
                  ? 'አዲስ ሰነድ ፍጠር (New Document)'
                  : 'New Legal Document Draft',
            desc:
              currentLang === 'om'
                ? 'Waliigaltee, iyyannoo ykn sanada seeraa haaraa battalumatti jalqabi.'
                : currentLang === 'am'
                  ? 'አዲስ የሕግ ሰነድ፣ ውል ወይም ማመልከቻ በፍጥነት ይጀምሩ።'
                  : 'Start a fresh legal draft, contract, or court petition immediately.',
            tabId: 'create',
            onExecute: () =>
              triggerAndClose(() => {
                if (onNewDocument) {
                  onNewDocument();
                } else {
                  navigateAndClose('create');
                  window.dispatchEvent(new CustomEvent('seera:new_document'));
                }
              }),
          },
          {
            id: 'action-save',
            keys: [modKey, 'S'],
            label:
              currentLang === 'om'
                ? 'Sanada Ammaa Kuusi (Save Document)'
                : currentLang === 'am'
                  ? 'ሰነዱን በቅጽበት አስቀምጥ (Save)'
                  : 'Save Active Legal Document',
            desc:
              currentLang === 'om'
                ? 'Wixinee ykn qorannoo baname kuusaa keessatti olkaa\'i.'
                : currentLang === 'am'
                  ? 'የተከፈተውን ረቂቅ ወይም ትንተና በማህደር ያስቀምጡ።'
                  : 'Save open draft, analysis, or legal findings to storage.',
            onExecute: () =>
              triggerAndClose(
                onTriggerSave ||
                  (() => window.dispatchEvent(new CustomEvent('seera:save_current_document')))
              ),
          },
          {
            id: 'action-print',
            keys: [modKey, 'P'],
            label:
              currentLang === 'om'
                ? 'Maxxansi ykn PDF Baasi (Print / PDF)'
                : currentLang === 'am'
                  ? 'አትም ወይም ፒዲኤፍ አውርድ (Print)'
                  : 'Print / Export Legal Document to PDF',
            desc:
              currentLang === 'om'
                ? 'Sanada qophaa\'e bifa seeraatiin maxxansi ykn PDF buusi.'
                : currentLang === 'am'
                  ? 'ሰነዱን በሕጋዊ ቅርጽ ያትሙ ወይም በፒዲኤፍ ያውርዱ።'
                  : 'Trigger official legal layout printing or PDF export.',
            onExecute: () =>
              triggerAndClose(
                onTriggerPrint ||
                  (() => window.dispatchEvent(new CustomEvent('seera:print_current_document')))
              ),
          },
          {
            id: 'action-reading-mode',
            keys: ['Alt', 'R'],
            label:
              currentLang === 'om'
                ? 'Haala Dubbisaa Bani/Cufi (Reading Mode)'
                : currentLang === 'am'
                  ? 'የንባብ ሁኔታ (Reading Mode)'
                  : 'Toggle Distraction-Free Reading Mode',
            desc:
              currentLang === 'om'
                ? 'Sidebar fi navigation dhoksee barruu seeraa fuula guutuutti dhiyeessa.'
                : currentLang === 'am'
                  ? 'የጎን መቃንና አሰሳን ደብቆ ሰነዱን በሙሉ ስክሪን ያሳያል።'
                  : 'Hide sidebar and navigation for full-screen legal reading.',
            onExecute: () => triggerAndClose(onToggleReadingMode),
          },
          {
            id: 'action-help',
            keys: [modKey, '/'],
            altKeys: ['?'],
            label:
              currentLang === 'om'
                ? 'Paanaalii Qaxxaamura Qubee (Shortcuts Panel)'
                : currentLang === 'am'
                  ? 'የቁልፍ ሰሌዳ አቋራጮች መመሪያ'
                  : 'Toggle Keyboard Shortcuts Panel',
            desc:
              currentLang === 'om'
                ? 'Paanaalii kana yeroo kamiyyuu banuuf ykn cufuuf.'
                : currentLang === 'am'
                  ? 'ይህንን የአቋራጭ ቁልፎች ዝርዝር ይክፈቱ ወይም ይዝጉ።'
                  : 'Open or close this interactive shortcuts panel.',
            onExecute: onClose,
          },
          {
            id: 'action-esc',
            keys: ['Esc'],
            label:
              currentLang === 'om'
                ? 'Modal ykn Palette Cufi (Close)'
                : currentLang === 'am'
                  ? 'መስኮት ዝጋ (Close)'
                  : 'Close Active Modal or Dialog',
            desc:
              currentLang === 'om'
                ? 'Foddaa baname kamiyyuu cufi.'
                : currentLang === 'am'
                  ? 'የተከፈተውን መስኮት ይዝጉ።'
                  : 'Dismiss any active dialog, command palette, or overlay.',
            onExecute: onClose,
          },
        ],
      },
      {
        id: 'view_navigation',
        title:
          currentLang === 'om'
            ? '🏛️ Adeemsa Fuulotaa (View Navigation)'
            : currentLang === 'am'
              ? '🏛️ ፈጣን የገጽ አሰሳ (Views)'
              : '🏛️ Navigate Between Views',
        shortcuts: [
          {
            id: 'nav-home',
            keys: ['Alt', '1'],
            tabId: 'home',
            label: currentLang === 'om' ? 'Fuula Duraa (Home)' : currentLang === 'am' ? 'ዋና ገጽ (Home)' : 'Home Dashboard',
            desc: 'Main legal portal & @seeraai_ethio live updates.',
            onExecute: () => navigateAndClose('home'),
          },
          {
            id: 'nav-explain',
            keys: ['Alt', '2'],
            tabId: 'explainLaw',
            label: currentLang === 'om' ? 'Ibsa Seeraa (Explain Law AI)' : currentLang === 'am' ? 'ሕግ አብራራ (Explain Law)' : 'Explain Law AI',
            desc: 'Grounded Ethiopian & Oromia statutory explanations.',
            onExecute: () => navigateAndClose('explainLaw'),
          },
          {
            id: 'nav-cassation',
            keys: ['Alt', '3'],
            tabId: 'cassation',
            label: currentLang === 'om' ? 'Kuusaa Dhaddacha Ijoo (Cassation)' : currentLang === 'am' ? 'የሰበር ውሳኔዎች (Cassation)' : 'Cassation Precedents',
            desc: 'Binding Federal Supreme Court Cassation database & citation map.',
            onExecute: () => navigateAndClose('cassation'),
          },
          {
            id: 'nav-docanalysis',
            keys: ['Alt', '4'],
            tabId: 'docAnalysis',
            label: currentLang === 'om' ? 'Qorannoo Sanadaa (Doc Analysis)' : currentLang === 'am' ? 'የሰነድ ምርመራ (Doc Analysis)' : 'Document Analysis',
            desc: 'Contract, pleading & court ruling OCR and risk analysis.',
            onExecute: () => navigateAndClose('docAnalysis'),
          },
          {
            id: 'nav-create',
            keys: ['Alt', '5'],
            tabId: 'create',
            label: currentLang === 'om' ? 'Sanada Qopheessi (Create Draft)' : currentLang === 'am' ? 'ሰነድ አዘጋጅ (Draft)' : 'Legal Document Drafter',
            desc: 'Compose contracts, court petitions & official pleadings.',
            onExecute: () => navigateAndClose('create'),
          },
          {
            id: 'nav-translate',
            keys: ['Alt', '6'],
            tabId: 'translate',
            label: currentLang === 'om' ? 'Hiikkaa Seeraa (Translate Law)' : currentLang === 'am' ? 'የሕግ ትርጉም (Translate)' : 'Trilingual Legal Translator',
            desc: 'Legal-precision translation across Oromo, Amharic & English.',
            onExecute: () => navigateAndClose('translate'),
          },
          {
            id: 'nav-mycontent',
            keys: ['Alt', '7'],
            tabId: 'myContent',
            label: currentLang === 'om' ? 'Sanadoota Kiyya (My Content)' : currentLang === 'am' ? 'የእኔ ሰነዶች (My Content)' : 'My Saved Library',
            desc: 'Saved drafts, analyses, citations & offline documents.',
            onExecute: () => navigateAndClose('myContent'),
          },
          {
            id: 'nav-courtroom',
            keys: ['Alt', '8'],
            tabId: 'courtroomAssistant',
            label: currentLang === 'om' ? 'Gargaaraa Dhaddachaa (Courtroom)' : currentLang === 'am' ? 'የችሎት ረዳት (Courtroom)' : 'Courtroom Assistant',
            desc: 'Live hearing support, witness logs & court tools.',
            onExecute: () => navigateAndClose('courtroomAssistant'),
          },
          {
            id: 'nav-library',
            keys: ['Alt', '9'],
            tabId: 'library',
            label: currentLang === 'om' ? 'Mana Kitaabaa Seeraa (Library)' : currentLang === 'am' ? 'የሕግ ቤተ-መጽሐፍት (Library)' : 'Legal Library',
            desc: 'Proclamations, codes & constitutional collections.',
            onExecute: () => navigateAndClose('library'),
          },
          {
            id: 'nav-analytics',
            keys: ['Alt', '0'],
            tabId: 'inquiryAnalytics',
            label: currentLang === 'om' ? 'Istaatistiksii Gaaffilee (Analytics)' : currentLang === 'am' ? 'የጥያቄዎች ትንተና (Analytics)' : 'Legal Inquiries Analytics',
            desc: 'Your personal legal query frequency & domain trends.',
            onExecute: () => navigateAndClose('inquiryAnalytics'),
          },
          {
            id: 'nav-settings',
            keys: ['Alt', 'S'],
            tabId: 'settings',
            label: currentLang === 'om' ? 'Qindaa\'ina (Settings)' : currentLang === 'am' ? 'ቅንብሮች (Settings)' : 'Settings & Telegram Sync',
            desc: 'Manage language, offline storage & @seeraai_ethio sync.',
            onExecute: () => navigateAndClose('settings'),
          },
        ],
      },
    ];
  }, [currentLang, modKey, onOpenSearch, onNewDocument, onTriggerSave, onTriggerPrint, onToggleReadingMode, onClose]);

  const filteredGroups = useMemo(() => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return shortcutGroups;

    return shortcutGroups
      .map((group) => ({
        ...group,
        shortcuts: group.shortcuts.filter(
          (sc) =>
            sc.label.toLowerCase().includes(q) ||
            sc.desc.toLowerCase().includes(q) ||
            sc.keys.join('+').toLowerCase().includes(q) ||
            (sc.altKeys && sc.altKeys.join(' ').toLowerCase().includes(q)) ||
            (sc.tabId && sc.tabId.toLowerCase().includes(q))
        ),
      }))
      .filter((group) => group.shortcuts.length > 0);
  }, [shortcutGroups, filterQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 font-bold border border-amber-400 shadow-md flex items-center justify-center">
              <Keyboard className="w-5 h-5" />
            </span>
            <div>
              <h3
                id="keyboard-shortcuts-title"
                className="text-lg sm:text-xl font-bold font-serif-legal text-slate-100"
              >
                {currentLang === 'om'
                  ? 'Paanaalii Qaxxaamura Qubee (Keyboard Shortcuts)'
                  : currentLang === 'am'
                    ? 'የቁልፍ ሰሌዳ አቋራጮች (Keyboard Shortcuts)'
                    : 'Keyboard Shortcuts Panel'}
              </h3>
              <p className="text-xs text-slate-400">
                {currentLang === 'om'
                  ? 'Qubee qaxxaamuraa fayyadami ykn tuquun kallattiin tarkaanfii fudhadhu.'
                  : currentLang === 'am'
                    ? 'በቁልፍ ሰሌዳ አቋራጭ ይጠቀሙ ወይም በመጫን ቀጥታ ወደ ገጹ ይሂዱ።'
                    : 'Press key combinations anytime or click any shortcut below to execute immediately.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Keyboard Shortcuts Panel"
            className="text-slate-400 hover:text-slate-200 p-2 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Filter + One-Click Power Actions */}
        <div className="space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={filterInputRef}
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={
                currentLang === 'om'
                  ? 'Qaxxaamura barbaadi (fkn: Search, New Document, Cassation, Alt+3)...'
                  : currentLang === 'am'
                    ? 'አቋራጭ ፈልግ (ምሳሌ፡ Search, New Document, Alt+3)...'
                    : 'Filter shortcuts (e.g. Search, New Document, Cassation, Alt+3)...'
              }
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Instant Action Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => triggerAndClose(onOpenSearch)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold cursor-pointer transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{currentLang === 'om' ? 'Barbaadi' : currentLang === 'am' ? 'ፈልግ' : 'Search'}</span>
              <kbd className="ml-1 px-1.5 py-0.5 rounded bg-slate-950 text-[10px] font-mono border border-slate-700">
                {modKey}+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerAndClose(() => {
                  if (onNewDocument) {
                    onNewDocument();
                  } else {
                    navigateAndClose('create');
                    window.dispatchEvent(new CustomEvent('seera:new_document'));
                  }
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer transition-all"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>
                {currentLang === 'om'
                  ? 'Sanada Haaraa'
                  : currentLang === 'am'
                    ? 'አዲስ ሰነድ'
                    : 'New Document'}
              </span>
              <kbd className="ml-1 px-1.5 py-0.5 rounded bg-slate-950 text-[10px] font-mono border border-slate-700">
                Alt+N
              </kbd>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerAndClose(
                  onTriggerSave ||
                    (() => window.dispatchEvent(new CustomEvent('seera:save_current_document')))
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-bold cursor-pointer transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{currentLang === 'om' ? 'Kuusi' : currentLang === 'am' ? 'አስቀምጥ' : 'Save'}</span>
              <kbd className="ml-1 px-1.5 py-0.5 rounded bg-slate-950 text-[10px] font-mono border border-slate-700">
                {modKey}+S
              </kbd>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerAndClose(
                  onTriggerPrint ||
                    (() => window.dispatchEvent(new CustomEvent('seera:print_current_document')))
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 text-xs font-bold cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{currentLang === 'om' ? 'Maxxansi' : currentLang === 'am' ? 'አትም' : 'Print'}</span>
              <kbd className="ml-1 px-1.5 py-0.5 rounded bg-slate-950 text-[10px] font-mono border border-slate-700">
                {modKey}+P
              </kbd>
            </button>
          </div>
        </div>

        {/* Shortcut Groups */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1">
          {filteredGroups.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-xs text-slate-400">
              {currentLang === 'om'
                ? `Qaxxaamurri "${filterQuery}" wajjin walsimu hin argamne.`
                : currentLang === 'am'
                  ? `ከ"${filterQuery}" ጋር የሚዛመድ አቋራጭ አልተገኘም።`
                  : `No shortcuts matching "${filterQuery}".`}
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id} className="space-y-2.5">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  <span>{group.title}</span>
                </h4>
                <div className="bg-slate-950 rounded-2xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                  {group.shortcuts.map((sc) => {
                    const isCurrentView = Boolean(sc.tabId && activeTab === sc.tabId);
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={sc.onExecute}
                        className={`w-full text-left p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group ${
                          isCurrentView
                            ? 'bg-amber-500/10 hover:bg-amber-500/15'
                            : 'hover:bg-slate-900/90'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-bold text-slate-200 group-hover:text-amber-300 transition-colors flex items-center gap-2 flex-wrap">
                            <span>{sc.label}</span>
                            {isCurrentView && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono">
                                {currentLang === 'om' ? 'Amma' : currentLang === 'am' ? 'አሁን' : 'Active'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{sc.desc}</div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {sc.keys.map((k, kIdx) => (
                            <React.Fragment key={kIdx}>
                              {kIdx > 0 && <span className="text-slate-600 text-[10px]">+</span>}
                              <kbd className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold text-[11px] shadow-xs min-w-[28px] text-center">
                                {k}
                              </kbd>
                            </React.Fragment>
                          ))}
                          {sc.altKeys && sc.altKeys.length > 0 && (
                            <span className="text-slate-500 text-[10px] font-mono ml-1">
                              ({sc.altKeys.join(', ')})
                            </span>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors ml-1 hidden sm:block" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <span>
            💡{' '}
            {currentLang === 'om' ? (
              <>
                Qubee <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">/</kbd> barbaachaaf ykn{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">Esc</kbd> cufuuf tuqaa.
              </>
            ) : currentLang === 'am' ? (
              <>
                ለፍለጋ <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">/</kbd> ወይም ለመዝጋት{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">Esc</kbd> ይጫኑ።
              </>
            ) : (
              <>
                Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">/</kbd> to search or{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">Esc</kbd> to close.
              </>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-sm shrink-0"
          >
            {currentLang === 'om' ? 'Cufi (Close)' : currentLang === 'am' ? 'ዝጋ (Close)' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
