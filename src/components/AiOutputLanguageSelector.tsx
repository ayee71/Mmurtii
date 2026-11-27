import React, { useEffect, useState } from 'react';
import { Globe, CheckCircle2, AlertCircle } from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import {
  AiOutputLanguage,
  AI_OUTPUT_LANGUAGE_OPTIONS,
  getAiOutputLanguageShortLabel,
  getLocalizedSaveFallbackMessage,
  normalizeAiOutputLanguage,
} from '../shared/aiOutputLanguage';
import { getStoredAiOutputLanguage } from '../services/storage';
import { useAuth } from '../context/AuthContext';

interface AiOutputLanguageSelectorProps {
  currentLang: Language;
  value?: AiOutputLanguage;
  onChange?: (nextLang: AiOutputLanguage) => void;
  variant?: 'card' | 'compact';
  showDescription?: boolean;
  className?: string;
}

export const AiOutputLanguageSelector: React.FC<AiOutputLanguageSelectorProps> = ({
  currentLang,
  value,
  onChange,
  variant = 'compact',
  showDescription = true,
  className = '',
}) => {
  const { persistAiOutputLanguage } = useAuth();
  const t = translations[currentLang] || translations.om;

  const [selectedLang, setSelectedLang] = useState<AiOutputLanguage>(() =>
    value ? normalizeAiOutputLanguage(value).language : getStoredAiOutputLanguage()
  );
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (value) {
      const normalized = normalizeAiOutputLanguage(value).language;
      setSelectedLang(normalized);
    }
  }, [value]);

  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ defaultOutputLanguage?: unknown }>;
      const next = normalizeAiOutputLanguage(
        custom.detail?.defaultOutputLanguage ?? getStoredAiOutputLanguage()
      ).language;
      setSelectedLang(next);
      if (onChange && next !== value) {
        onChange(next);
      }
    };

    window.addEventListener('seera_user_settings_updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('seera_user_settings_updated', handleSettingsUpdated);
    };
  }, [onChange, value]);

  const handleSelect = async (nextLang: AiOutputLanguage) => {
    const validNext = normalizeAiOutputLanguage(nextLang).language;
    setSelectedLang(validNext);
    setSyncNotice(null);
    setIsSyncing(true);

    if (onChange) {
      onChange(validNext);
    }

    try {
      const res = await persistAiOutputLanguage(validNext);
      if (!res.remoteSaved && res.reason === 'firestore_error') {
        setSyncNotice(getLocalizedSaveFallbackMessage(validNext));
      }
    } catch {
      setSyncNotice(getLocalizedSaveFallbackMessage(validNext));
    } finally {
      setIsSyncing(false);
    }
  };

  const titleText = t.settingsView?.aiOutputLangLabel || 'AI Output Language';
  const descText =
    t.settingsView?.defaultOutputLangDesc ||
    'Choose the single language SEERAAI uses for AI responses.';

  if (variant === 'card') {
    return (
      <div className={`space-y-3 ${className}`} data-testid="ai-output-language-card">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Globe className="w-4 h-4 text-amber-400" />
            <span>{titleText}</span>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
            {getAiOutputLanguageShortLabel(selectedLang)}
          </span>
        </div>

        {showDescription && (
          <p className="text-xs text-slate-400">{descText}</p>
        )}

        <div
          role="radiogroup"
          aria-label="AI Output Language"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
        >
          {AI_OUTPUT_LANGUAGE_OPTIONS.map((option) => {
            const isSelected = selectedLang === option.code;
            return (
              <button
                key={option.code}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`ai-output-lang-option-${option.code}`}
                onClick={() => void handleSelect(option.code)}
                disabled={isSyncing && isSelected}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-400 text-amber-200 font-bold shadow-sm'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="text-sm leading-tight">{option.label}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
                    {option.code}
                  </div>
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {syncNotice && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl bg-amber-950/50 border border-amber-500/40 px-3 py-2 text-xs text-amber-200"
          >
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{syncNotice}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`} data-testid="ai-output-language-compact">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
          <Globe className="w-3.5 h-3.5 text-amber-400" />
          {titleText}:
        </span>
        <div
          role="radiogroup"
          aria-label="AI Output Language"
          className="inline-flex flex-wrap items-center gap-1.5"
        >
          {AI_OUTPUT_LANGUAGE_OPTIONS.map((option) => {
            const isSelected = selectedLang === option.code;
            return (
              <button
                key={option.code}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`ai-output-lang-option-${option.code}`}
                onClick={() => void handleSelect(option.code)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {syncNotice && (
        <div
          role="status"
          className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg px-2.5 py-1"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{syncNotice}</span>
        </div>
      )}
    </div>
  );
};
