import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Minimize2,
  Maximize2,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { Language } from '../i18n/translations';
import {
  useReadingMode,
  ReadingThemeOption,
  ReadingWidthOption,
} from '../context/ReadingModeContext';

interface ReadingModeBarProps {
  currentLang: Language;
}

export const ReadingModeBar: React.FC<ReadingModeBarProps> = ({ currentLang }) => {
  const {
    isReadingMode,
    readingTheme,
    readingWidth,
    fontScale,
    isBarCollapsed,
    exitReadingMode,
    setReadingTheme,
    setReadingWidth,
    increaseFontScale,
    decreaseFontScale,
    resetFontScale,
    setBarCollapsed,
  } = useReadingMode();

  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onFullscreenChange = () => {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  if (!isReadingMode) return null;

  const toggleBrowserFullscreen = async () => {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Safe no-op inside restricted iframes
    }
  };

  const labels = {
    exit:
      currentLang === 'om'
        ? "Haala Dubbisaa Ba'i"
        : currentLang === 'am'
          ? 'ከንባብ ሁኔታ ውጣ'
          : 'Exit Reading Mode',
    badge:
      currentLang === 'om'
        ? 'Haala Dubbisaa'
        : currentLang === 'am'
          ? 'የንባብ ሁኔታ'
          : 'Reading Mode',
    narrow: currentLang === 'om' ? 'Dhiphaa' : currentLang === 'am' ? 'ጠባብ' : 'Narrow',
    standard: currentLang === 'om' ? 'Idilee' : currentLang === 'am' ? 'መደበኛ' : 'Standard',
    wide: currentLang === 'om' ? 'Bal’aa' : currentLang === 'am' ? 'ሰፊ' : 'Wide',
    fullscreen:
      currentLang === 'om'
        ? 'Fuula Guutuu'
        : currentLang === 'am'
          ? 'ሙሉ ስክሪን'
          : 'Fullscreen',
  };

  const isLightSurface = readingTheme === 'paper' || readingTheme === 'sepia';
  const dockSurface = isLightSurface
    ? 'bg-[#FFFDF9]/95 border-[#D6CEBE] text-[#1C1917] shadow-lg'
    : 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-2xl';
  const subtleBtn = isLightSurface
    ? 'bg-[#EFE9DC] hover:bg-[#E4DCCB] text-[#292524] border border-[#D6CEBE]'
    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700';
  const activeBtn = isLightSurface
    ? 'bg-[#1C1917] text-[#FBF9F5] border border-[#1C1917] font-semibold'
    : 'bg-amber-500 text-slate-950 border border-amber-400 font-semibold';

  if (isBarCollapsed) {
    return (
      <div
        role="region"
        aria-label={labels.badge}
        className="fixed top-3 right-3 z-50 flex items-center gap-1.5 no-print"
      >
        <button
          type="button"
          onClick={() => setBarCollapsed(false)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium backdrop-blur-md transition-colors cursor-pointer min-h-[40px] whitespace-nowrap shrink-0 ${dockSurface}`}
          title={labels.badge}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={exitReadingMode}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs backdrop-blur-md transition-colors cursor-pointer min-h-[40px] whitespace-nowrap shrink-0 ${activeBtn}`}
          title={`${labels.exit} (Esc / Alt+R)`}
        >
          <X className="w-3.5 h-3.5" />
          <span>{labels.exit}</span>
        </button>
      </div>
    );
  }

  const themes: { id: ReadingThemeOption; label: string }[] = [
    { id: 'default', label: currentLang === 'om' ? 'Seera' : currentLang === 'am' ? 'መደበኛ' : 'Court' },
    { id: 'night', label: currentLang === 'om' ? 'Halkan' : currentLang === 'am' ? 'ጨለማ' : 'Night' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'paper', label: currentLang === 'om' ? 'Waraqaa' : currentLang === 'am' ? 'ወረቀት' : 'Paper' },
  ];

  const widths: { id: ReadingWidthOption; label: string }[] = [
    { id: 'narrow', label: labels.narrow },
    { id: 'standard', label: labels.standard },
    { id: 'wide', label: labels.wide },
  ];

  return (
    <div
      role="toolbar"
      aria-label={labels.badge}
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[96vw] overflow-x-auto no-scrollbar rounded-2xl border px-3 py-2 backdrop-blur-md flex items-center gap-2.5 no-print ${dockSurface}`}
    >
      {/* Mode Identifier */}
      <div className="flex items-center gap-2 pr-2 border-r border-current/15 shrink-0">
        <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-xs font-semibold whitespace-nowrap">{labels.badge}</span>
      </div>

      {/* Text Scale Controls */}
      <div className="flex items-center gap-1 shrink-0" aria-label="Font size controls">
        <button
          type="button"
          onClick={decreaseFontScale}
          disabled={fontScale <= 0.9}
          aria-label="Decrease reading font size"
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${subtleBtn}`}
        >
          A-
        </button>
        <button
          type="button"
          onClick={resetFontScale}
          aria-label="Reset reading font size"
          className={`px-2 py-1.5 rounded-lg text-[11px] font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap shrink-0 ${subtleBtn}`}
        >
          {Math.round(fontScale * 100)}%
        </button>
        <button
          type="button"
          onClick={increaseFontScale}
          disabled={fontScale >= 1.35}
          aria-label="Increase reading font size"
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${subtleBtn}`}
        >
          A+
        </button>
      </div>

      {/* Column Width Controls */}
      <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-current/15 shrink-0" aria-label="Reading width">
        {widths.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setReadingWidth(w.id)}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              readingWidth === w.id ? activeBtn : subtleBtn
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Surface Theme Controls */}
      <div className="hidden md:flex items-center gap-1 pl-2 border-l border-current/15 shrink-0" aria-label="Reading theme">
        {themes.map((th) => (
          <button
            key={th.id}
            type="button"
            onClick={() => setReadingTheme(th.id)}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              readingTheme === th.id ? activeBtn : subtleBtn
            }`}
          >
            {th.label}
          </button>
        ))}
      </div>

      {/* Browser Fullscreen & Collapse */}
      <div className="flex items-center gap-1 pl-2 border-l border-current/15 shrink-0">
        <button
          type="button"
          onClick={toggleBrowserFullscreen}
          className={`p-2 rounded-lg text-xs transition-colors cursor-pointer shrink-0 ${subtleBtn}`}
          title={labels.fullscreen}
          aria-label={labels.fullscreen}
        >
          {isBrowserFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => setBarCollapsed(true)}
          className={`p-2 rounded-lg text-xs transition-colors cursor-pointer shrink-0 ${subtleBtn}`}
          title="Minimize toolbar"
          aria-label="Minimize reading toolbar"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Exit Reading Mode Primary Action */}
      <button
        type="button"
        onClick={exitReadingMode}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[36px] ${activeBtn}`}
        title={`${labels.exit} (Esc / Alt+R)`}
      >
        <X className="w-3.5 h-3.5 shrink-0" />
        <span>{labels.exit}</span>
      </button>
    </div>
  );
};

export default ReadingModeBar;
