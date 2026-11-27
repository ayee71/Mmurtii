import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Search,
  BookOpen,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Layers,
  CheckCircle2,
  XCircle,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Award,
  GraduationCap,
  Scale,
  Plus,
  Edit3,
  History,
  ShieldCheck,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import { LEGAL_GLOSSARY_DATA } from '../data/legalGlossary';
import { lookupLegalTerm, DictionaryResponse } from '../services/api';
import { RecentSearches } from '../components/RecentSearches';
import { saveRecentSearch } from '../services/storage';
import { analyticsService } from '../services/analytics';
import { WebsterDictionaryExplorer } from '../components/WebsterDictionaryExplorer';
import { COURT_TERMINOLOGY_CATALOG } from '../data/courts/courtTerminologyCatalog';
import { useAuth } from '../context/AuthContext';
import {
  GLOSSARY_DOMAINS,
  GLOSSARY_JURISDICTIONS,
  GlossaryDomain,
  GlossaryEntryRecord,
  GlossaryLanguage,
  GlossarySubmissionRecord,
  RankedGlossaryResult,
} from '../shared/legalGlossarySchema';
import { fetchGlossaryEntries, fetchGlossarySubmissions } from '../services/glossaryApi';
import { GlossarySubmissionModal } from '../components/GlossarySubmissionModal';
import { GlossaryEntryDetailModal } from '../components/GlossaryEntryDetailModal';
import { GlossaryReviewerPanel } from '../components/GlossaryReviewerPanel';

interface GlossaryViewProps {
  currentLang: Language;
  initialQuery?: string;
  initialTab?: 'dictionary' | 'webster' | 'terminology' | 'flashcards' | 'quiz';
  onQueryChange?: (query: string) => void;
}

const LANG_DISPLAY: Record<GlossaryLanguage, { name: string; fontClass: string }> = {
  om: { name: 'AFAAN OROMOO', fontClass: '' },
  am: { name: 'አማርኛ', fontClass: 'font-ethiopic' },
  en: { name: 'ENGLISH', fontClass: '' },
};

export const GlossaryView: React.FC<GlossaryViewProps> = ({
  currentLang,
  initialQuery = '',
  initialTab = 'dictionary',
  onQueryChange,
}) => {
  const t = translations[currentLang];
  const { authClaims } = useAuth();

  const [activeTab, setActiveTab] = useState<'dictionary' | 'webster' | 'terminology' | 'flashcards' | 'quiz'>(initialTab);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [primaryLang, setPrimaryLang] = useState<GlossaryLanguage>(currentLang);
  const [selectedDomain, setSelectedDomain] = useState<GlossaryDomain | 'all'>('all');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'approved' | 'archived' | 'all'>('approved');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Backend glossary search state
  const [rankedResults, setRankedResults] = useState<RankedGlossaryResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchMethod, setSearchMethod] = useState('');
  const [searchLimitations, setSearchLimitations] = useState('');
  const [isLoadingGlossary, setIsLoadingGlossary] = useState(true);
  const [glossaryError, setGlossaryError] = useState<string | null>(null);
  const [serverPermissions, setServerPermissions] = useState<{
    canSubmit: boolean;
    canReview: boolean;
  }>({ canSubmit: false, canReview: false });

  // Modals & workflow drawers
  const [detailTermId, setDetailTermId] = useState<string | null>(null);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<GlossaryEntryRecord | null>(null);
  const [aiDraftPrefill, setAiDraftPrefill] = useState<{
    sourceLanguage: GlossaryLanguage;
    om?: { term: string; definition: string; usage?: string };
    am?: { term: string; definition: string; usage?: string };
    en?: { term: string; definition: string; usage?: string };
    primaryProclamationOrCode?: string;
  } | null>(null);

  const [showMySubmissions, setShowMySubmissions] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<GlossarySubmissionRecord[]>([]);
  const [loadingMySubmissions, setLoadingMySubmissions] = useState(false);
  const [showReviewerQueue, setShowReviewerQueue] = useState(false);

  // Terminology, flashcards, quiz state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [termQuery, setTermQuery] = useState<string>('');
  const [termCategory, setTermCategory] = useState<string>('all');
  const [copiedTermId, setCopiedTermId] = useState<string | null>(null);
  const [recentKey, setRecentKey] = useState(0);

  // Flashcards state
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCardIds, setKnownCardIds] = useState<Set<string>>(new Set());

  // Quiz state
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnsweredCount, setQuizAnsweredCount] = useState(0);
  const [quizSeed, setQuizSeed] = useState(0);

  // AI online lookup state (explicitly unverified AI draft)
  const [aiTermResult, setAiTermResult] = useState<DictionaryResponse | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    setPrimaryLang(currentLang);
  }, [currentLang]);

  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
      if (onQueryChange) onQueryChange(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Derived permission guards (authoritative enforcement remains on backend API & Firestore rules)
  const isAuditorOrReadOnly = (authClaims.courtRole || '').toLowerCase() === 'auditor';
  const canSubmit =
    serverPermissions.canSubmit ||
    (authClaims.isEmailVerified && !authClaims.isAnonymous && !isAuditorOrReadOnly);
  const canReview =
    serverPermissions.canReview ||
    (authClaims.isEmailVerified &&
      !authClaims.isAnonymous &&
      (authClaims.isTrustedAdmin ||
        ['judge', 'legal_expert', 'court_admin', 'superadmin'].includes(
          (authClaims.courtRole || '').toLowerCase()
        )));

  const loadGlossary = useCallback(async () => {
    setIsLoadingGlossary(true);
    setGlossaryError(null);
    try {
      const res = await fetchGlossaryEntries({
        query: searchQuery.trim(),
        domain: selectedDomain,
        jurisdiction: selectedJurisdiction,
        status: canReview ? selectedStatus : 'approved',
        page,
        pageSize,
      });
      setRankedResults(res.items || []);
      setTotalResults(res.total || 0);
      setHasMore(Boolean(res.hasMore));
      setSearchMethod(res.searchMethod || '');
      setSearchLimitations(res.searchLimitations || '');
      if (res.permissions) {
        setServerPermissions(res.permissions);
      }
    } catch (err: any) {
      setGlossaryError(err?.message || 'Unable to load Legal Glossary entries.');
    } finally {
      setIsLoadingGlossary(false);
    }
  }, [searchQuery, selectedDomain, selectedJurisdiction, selectedStatus, page, canReview]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadGlossary();
    }, 180);
    return () => clearTimeout(timer);
  }, [loadGlossary]);

  const loadMySubmissions = useCallback(async () => {
    if (!canSubmit) return;
    setLoadingMySubmissions(true);
    try {
      const res = await fetchGlossarySubmissions({ mineOnly: true });
      setMySubmissions(res.submissions || []);
    } catch {
      setMySubmissions([]);
    } finally {
      setLoadingMySubmissions(false);
    }
  }, [canSubmit]);

  useEffect(() => {
    if (showMySubmissions && canSubmit) {
      loadMySubmissions();
    }
  }, [showMySubmissions, canSubmit, loadMySubmissions]);

  // Debounced save for glossary search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 3) {
      const timer = setTimeout(() => {
        saveRecentSearch(trimmed, 'glossary');
        setRecentKey((k) => k + 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  const orderedLanguages = useMemo<GlossaryLanguage[]>(() => {
    return [
      primaryLang,
      ...(['om', 'am', 'en'] as GlossaryLanguage[]).filter((l) => l !== primaryLang),
    ];
  }, [primaryLang]);

  const categories = [
    { id: 'all', label: t.glossaryView.categoryAll },
    { id: 'constitutional', label: t.glossaryView.categoryConstitutional },
    { id: 'labor', label: t.glossaryView.categoryLabor },
    { id: 'commercial', label: t.glossaryView.categoryCommercial },
    { id: 'civilCourt', label: t.glossaryView.categoryCivilCourt },
  ];

  // Flashcards & Quiz baseline data (mapped cleanly without losing existing learning modes)
  const localFilteredForStudy = useMemo(() => {
    return LEGAL_GLOSSARY_DATA.filter((entry) => {
      const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        entry.om.term.toLowerCase().includes(q) ||
        entry.om.definition.toLowerCase().includes(q) ||
        entry.am.term.toLowerCase().includes(q) ||
        entry.am.definition.toLowerCase().includes(q) ||
        entry.en.term.toLowerCase().includes(q) ||
        entry.en.definition.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery]);

  const flashcardList = localFilteredForStudy.length > 0 ? localFilteredForStudy : LEGAL_GLOSSARY_DATA;
  const currentCard = flashcardList[cardIndex % flashcardList.length];

  const currentQuiz = useMemo(() => {
    if (flashcardList.length === 0) return null;
    const item = flashcardList[quizQuestionIndex % flashcardList.length];
    const correctDef = item[currentLang]?.definition || item.om.definition;
    const correctTerm = item[currentLang]?.term || item.om.term;
    const otherEntries = LEGAL_GLOSSARY_DATA.filter((e) => e.id !== item.id);
    const shuffledOthers = [...otherEntries].sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [
      { text: correctDef, isCorrect: true, termRef: correctTerm },
      ...shuffledOthers.map((o) => ({
        text: o[currentLang]?.definition || o.om.definition,
        isCorrect: false,
        termRef: o[currentLang]?.term || o.om.term,
      })),
    ].sort(() => 0.5 - Math.random());

    return {
      term: correctTerm,
      category: item.category,
      source: item.sourceReference,
      options,
    };
  }, [flashcardList, quizQuestionIndex, currentLang, quizSeed]);

  const handleNextCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev + 1) % flashcardList.length);
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev - 1 + flashcardList.length) % flashcardList.length);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setCardIndex(Math.floor(Math.random() * flashcardList.length));
  };

  const toggleKnownCard = (id: string) => {
    const updated = new Set(knownCardIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setKnownCardIds(updated);
  };

  const handleAnswerQuiz = (optionIndex: number, isCorrect: boolean) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(optionIndex);
    setQuizAnsweredCount((prev) => prev + 1);
    if (isCorrect) setQuizScore((prev) => prev + 1);
  };

  const handleNextQuiz = () => {
    setSelectedAnswer(null);
    setQuizQuestionIndex((prev) => prev + 1);
    setQuizSeed((s) => s + 1);
  };

  const handleOnlineLookup = async () => {
    if (!searchQuery.trim()) return;
    setIsLookingUp(true);
    setLookupError(null);
    saveRecentSearch(searchQuery.trim(), 'glossary');
    setRecentKey((k) => k + 1);

    try {
      const data = await lookupLegalTerm(searchQuery.trim());
      setAiTermResult(data);
      analyticsService.trackGlossaryTerm(searchQuery.trim());
    } catch (e: any) {
      setLookupError(e.message || 'Lookup failed');
    } finally {
      setIsLookingUp(false);
    }
  };

  const openNewTermModal = () => {
    setRevisionTarget(null);
    setAiDraftPrefill(null);
    setIsSubmissionModalOpen(true);
  };

  const openCorrectionModal = (entry: GlossaryEntryRecord) => {
    setAiDraftPrefill(null);
    setRevisionTarget(entry);
    setIsSubmissionModalOpen(true);
  };

  const openAiDraftToReviewModal = () => {
    if (!aiTermResult) return;
    setRevisionTarget(null);
    setAiDraftPrefill({
      sourceLanguage: primaryLang,
      om: aiTermResult.om,
      am: aiTermResult.am,
      en: aiTermResult.en,
      primaryProclamationOrCode: aiTermResult.primaryProclamationOrCode,
    });
    setIsSubmissionModalOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));

  return (
    <div className="space-y-8 pb-16">
      {/* Title & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif-legal font-bold text-slate-100 flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-amber-400" />
            <span>{t.glossaryView.title}</span>
          </h1>
          <p className="mt-1 text-slate-400 text-xs sm:text-sm">{t.glossaryView.subtitle}</p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shrink-0 self-start md:self-auto flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('dictionary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dictionary'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{t.nav.glossary}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('webster')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'webster'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>📖</span>
            <span>Webster's Law Dictionary</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 font-mono font-bold">
              PDF
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terminology')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'terminology'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Court Terminology</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('flashcards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'flashcards'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Flashcards</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 font-mono">
              {flashcardList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Quiz Mode</span>
          </button>
        </div>
      </div>

      {/* TAB 1: TRILINGUAL VERIFIED LEGAL GLOSSARY */}
      {activeTab === 'dictionary' && (
        <div className="space-y-6">
          {/* Action & Auth Governance Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-300">
                {t.glossaryView.primaryLanguageLabel || 'Primary Language First'}:
              </span>
              {(['om', 'am', 'en'] as GlossaryLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setPrimaryLang(lang)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    primaryLang === lang
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {lang === 'om' ? 'Afaan Oromoo' : lang === 'am' ? 'አማርኛ' : 'English'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canSubmit ? (
                <>
                  <button
                    type="button"
                    onClick={openNewTermModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold cursor-pointer shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.glossaryView.addTermButton || 'Add Term'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMySubmissions((v) => !v)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.glossaryView.mySubmissions || 'My Submissions'}</span>
                  </button>
                </>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
                  {isAuditorOrReadOnly
                    ? 'Read-only auditor role: proposing or editing glossary entries is disabled.'
                    : 'Sign in with a verified email account to propose terms or corrections.'}
                </span>
              )}

              {canReview && (
                <button
                  type="button"
                  onClick={() => setShowReviewerQueue((v) => !v)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold cursor-pointer border ${
                    showReviewerQueue
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t.glossaryView.reviewerQueue || 'Reviewer Queue & Audit'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Reviewer Queue Panel (only mounted/accessible for authorized reviewers) */}
          {canReview && showReviewerQueue && (
            <GlossaryReviewerPanel currentLang={currentLang} onEntriesUpdated={loadGlossary} />
          )}

          {/* My Submissions Panel */}
          {canSubmit && showMySubmissions && (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-slate-100">My Glossary Proposals & Corrections</h3>
                <button
                  type="button"
                  onClick={loadMySubmissions}
                  className="text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                >
                  Refresh
                </button>
              </div>
              {loadingMySubmissions ? (
                <div className="text-slate-400">Loading your submissions...</div>
              ) : mySubmissions.length === 0 ? (
                <div className="text-slate-400">You have not submitted any glossary proposals yet.</div>
              ) : (
                <div className="space-y-2">
                  {mySubmissions.map((sub) => {
                    const headline =
                      sub.proposedEntry.terms[sub.proposedEntry.sourceLanguage].preferred ||
                      sub.proposedEntry.terms.en.preferred ||
                      sub.proposedEntry.terms.om.preferred ||
                      sub.submissionId;
                    return (
                      <div
                        key={sub.submissionId}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-bold text-slate-100 mr-2">{headline}</span>
                          <span className="text-slate-400">{sub.proposedEntry.domain}</span>
                          {sub.incompleteLanguages.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                              Incomplete: {sub.incompleteLanguages.join(', ')}
                            </span>
                          )}
                          {sub.aiAssistedDraft && (
                            <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/15 text-amber-200 font-semibold">
                              AI draft
                            </span>
                          )}
                          {sub.reviewerNote && (
                            <div className="text-slate-300 mt-1">
                              Reviewer Note: <span className="italic">{sub.reviewerNote}</span>
                            </div>
                          )}
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-lg font-mono font-bold uppercase ${
                            sub.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : sub.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Simultaneous Trilingual Search & Domain/Jurisdiction Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    setPage(1);
                    if (onQueryChange) onQueryChange(val);
                  }}
                  placeholder={t.glossaryView.searchPlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/70 transition-all"
                />
              </div>

              <button
                onClick={handleOnlineLookup}
                disabled={isLookingUp || !searchQuery.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm tracking-wide shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLookingUp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t.common.loading}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{t.glossaryView.lookupButton} (AI Draft)</span>
                  </>
                )}
              </button>
            </div>

            {/* Domain, Jurisdiction & Status Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  {t.glossaryView.domainLabel || 'Legal Domain'}
                </label>
                <select
                  value={selectedDomain}
                  onChange={(e) => {
                    setSelectedDomain(e.target.value as GlossaryDomain | 'all');
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="all">{t.glossaryView.categoryAll}</option>
                  {GLOSSARY_DOMAINS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.labels[currentLang] || d.labels.en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  {t.glossaryView.jurisdictionLabel || 'Jurisdiction'}
                </label>
                <select
                  value={selectedJurisdiction}
                  onChange={(e) => {
                    setSelectedJurisdiction(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="all">{t.glossaryView.categoryAll}</option>
                  {GLOSSARY_JURISDICTIONS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>

              {canReview && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Entry Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value as 'approved' | 'archived' | 'all');
                      setPage(1);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="approved">Approved Only</option>
                    <option value="archived">Archived Only</option>
                    <option value="all">All (Approved + Archived)</option>
                  </select>
                </div>
              )}
            </div>

            <RecentSearches
              currentLang={currentLang}
              category="glossary"
              onSelectSearch={(query) => {
                setSearchQuery(query);
                setPage(1);
              }}
              mode="under-search"
              refreshTrigger={recentKey}
            />
          </div>

          {/* Lookup Error Banner */}
          {lookupError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{lookupError}</span>
            </div>
          )}

          {/* AI Term Lookup Result Box — STRICTLY LABELED AI DRAFT — UNVERIFIED */}
          {aiTermResult && (
            <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>{t.glossaryView.aiDraftBadge || 'AI draft — unverified'}:</strong>{' '}
                    {aiTermResult.disclaimer ||
                      'Generated by AI and NOT yet verified by a qualified legal reviewer.'}
                  </span>
                </div>
                {canSubmit && (
                  <button
                    type="button"
                    onClick={openAiDraftToReviewModal}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold cursor-pointer"
                  >
                    Send to Pending Human Review
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="font-bold text-base text-slate-100">
                    AI Draft Preview: <span className="text-amber-400 underline">{aiTermResult.term}</span>
                  </h3>
                </div>
                {aiTermResult.primaryProclamationOrCode && (
                  <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-amber-300 font-mono border border-slate-700">
                    {aiTermResult.primaryProclamationOrCode}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                {orderedLanguages.map((lang) => {
                  const block = aiTermResult[lang];
                  return (
                    <div
                      key={lang}
                      className={`p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 ${LANG_DISPLAY[lang].fontClass}`}
                    >
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider font-sans">
                        {LANG_DISPLAY[lang].name}
                      </div>
                      <div className="text-sm font-semibold text-slate-100">{block?.term || '-'}</div>
                      <p className="text-xs text-slate-300 leading-relaxed">{block?.definition || '-'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Glossary Results State: Loading / Error / Empty / List */}
          {isLoadingGlossary ? (
            <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>{t.common.loading}</span>
            </div>
          ) : glossaryError ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-rose-500/40 text-center space-y-3 text-xs">
              <div className="text-rose-300 font-semibold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{glossaryError}</span>
              </div>
              <button
                type="button"
                onClick={loadGlossary}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold cursor-pointer"
              >
                {t.glossaryView.retryButton || 'Retry'}
              </button>
            </div>
          ) : rankedResults.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3 text-xs">
              <p className="text-slate-300 font-semibold">
                {t.glossaryView.noResultsText || 'No verified legal glossary entries matched your search.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {(searchQuery || selectedDomain !== 'all' || selectedJurisdiction !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedDomain('all');
                      setSelectedJurisdiction('all');
                      setPage(1);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
                {canSubmit && (
                  <button
                    type="button"
                    onClick={openNewTermModal}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold cursor-pointer"
                  >
                    Propose Missing Term
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Count & Search Method Info */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
                <span>
                  Showing <strong className="text-slate-200">{rankedResults.length}</strong> of{' '}
                  <strong className="text-slate-200">{totalResults}</strong> verified terms (Page {page} / {totalPages})
                </span>
                {searchMethod && (
                  <span className="text-[11px] font-mono text-slate-500" title={searchLimitations}>
                    {searchMethod}
                  </span>
                )}
              </div>

              {rankedResults.map(({ entry, matchReasons }) => {
                const domainLabel =
                  GLOSSARY_DOMAINS.find((d) => d.id === entry.domain)?.labels[currentLang] ||
                  entry.domain;

                return (
                  <div
                    key={entry.termId}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all shadow-md space-y-4"
                  >
                    {/* Entry Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold">
                          {domainLabel}
                        </span>
                        {entry.jurisdiction.map((jur) => (
                          <span
                            key={jur}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300"
                          >
                            {jur}
                          </span>
                        ))}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          v{entry.version}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {entry.sourceReferences?.[0] && (
                          <span className="font-mono text-amber-400/90 font-semibold">
                            {entry.sourceReferences[0].title}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setDetailTermId(entry.termId)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-amber-400" />
                          <span>Details & History</span>
                        </button>
                        {canSubmit && (
                          <button
                            type="button"
                            onClick={() => openCorrectionModal(entry)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{t.glossaryView.suggestCorrection || 'Suggest Correction'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Why it matched badges */}
                    {matchReasons.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400 font-semibold">Matched:</span>
                        {matchReasons.slice(0, 4).map((reason, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200 font-mono"
                          >
                            {reason.language} • {reason.field}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Trilingual Side-by-Side Cards Ordered with Primary Language First */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {orderedLanguages.map((lang) => {
                        const termBlock = entry.terms[lang];
                        const noExact = entry.noExactEquivalent?.[lang];
                        return (
                          <div
                            key={lang}
                            className={`space-y-1.5 p-3.5 rounded-xl border ${
                              lang === primaryLang
                                ? 'bg-slate-950 border-amber-500/40'
                                : 'bg-slate-950/60 border-slate-800/80'
                            } ${LANG_DISPLAY[lang].fontClass}`}
                          >
                            <div className="flex items-center justify-between font-sans">
                              <div className="text-[11px] font-bold text-amber-400">
                                {LANG_DISPLAY[lang].name}
                              </div>
                              {lang === primaryLang && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">
                                  Primary
                                </span>
                              )}
                            </div>

                            <div className="text-sm font-bold text-slate-100">
                              {termBlock.preferred}
                            </div>

                            {termBlock.synonyms.length > 0 && (
                              <div className="flex flex-wrap gap-1 font-sans">
                                {termBlock.synonyms.map((syn) => (
                                  <span
                                    key={syn}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300"
                                  >
                                    ≈ {syn}
                                  </span>
                                ))}
                              </div>
                            )}

                            <p className="text-xs text-slate-300 leading-relaxed">
                              {entry.definitions[lang]}
                            </p>

                            {entry.usageNotes?.[lang] && (
                              <p className="text-[11px] text-slate-500 italic pt-1">
                                {entry.usageNotes[lang]}
                              </p>
                            )}

                            {noExact && (
                              <div className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-sans inline-block">
                                No exact equivalent
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Pagination Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
                <span className="text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    disabled={!hasMore}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next Page</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WEBSTER'S NEW WORLD LAW DICTIONARY */}
      {activeTab === 'webster' && (
        <WebsterDictionaryExplorer
          currentLang={currentLang}
          initialSearchQuery={searchQuery}
          onSelectTerm={(term) => setSearchQuery(term)}
        />
      )}

      {/* TAB 3: INTERACTIVE FLASHCARDS MODE */}
      {activeTab === 'flashcards' && currentCard && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedCategory(c.id);
                  setCardIndex(0);
                }}
                className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap font-bold transition-all cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400">
                Card {(cardIndex % flashcardList.length) + 1} / {flashcardList.length}
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-400">{currentCard.category}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShuffle}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle</span>
              </button>

              <button
                type="button"
                onClick={() => toggleKnownCard(currentCard.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  knownCardIds.has(currentCard.id)
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{knownCardIds.has(currentCard.id) ? 'Known' : 'Mark Known'}</span>
              </button>
            </div>
          </div>

          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="min-h-[340px] bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/40 hover:border-amber-400 rounded-3xl p-8 shadow-2xl flex flex-col justify-between cursor-pointer transition-all select-none"
          >
            <div className="flex items-center justify-between text-xs text-amber-400/90 font-mono">
              <span className="flex items-center gap-1.5">
                <Scale className="w-4 h-4" />
                <span>{currentCard.sourceReference}</span>
              </span>
              <span className="text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-amber-300">
                {isFlipped ? 'Definition' : 'Term'}
              </span>
            </div>

            {!isFlipped ? (
              <div className="py-12 text-center space-y-4">
                <h2 className="text-3xl sm:text-4xl font-serif-legal font-bold text-amber-300 tracking-wide">
                  {currentCard[currentLang]?.term || currentCard.om.term}
                </h2>
                <div className="flex items-center justify-center gap-4 text-sm text-slate-400 pt-2">
                  <span>{currentCard.om.term}</span>
                  <span>•</span>
                  <span className="font-ethiopic">{currentCard.am.term}</span>
                  <span>•</span>
                  <span>{currentCard.en.term}</span>
                </div>
                <p className="text-xs text-slate-500 pt-4 flex items-center justify-center gap-1">
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Click card to reveal trilingual definitions</span>
                </p>
              </div>
            ) : (
              <div className="py-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 block uppercase">Afaan Oromoo</span>
                    <h4 className="text-xs font-bold text-slate-200">{currentCard.om.term}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{currentCard.om.definition}</p>
                  </div>
                  <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1 font-ethiopic">
                    <span className="text-[10px] font-bold text-amber-400 block uppercase font-sans">አማርኛ</span>
                    <h4 className="text-xs font-bold text-slate-200">{currentCard.am.term}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{currentCard.am.definition}</p>
                  </div>
                  <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 block uppercase">English</span>
                    <h4 className="text-xs font-bold text-slate-200">{currentCard.en.term}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{currentCard.en.definition}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 pt-3">
              <span>Click to flip</span>
              <span>{knownCardIds.size} / {flashcardList.length} known</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handlePrevCard}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFlipped(!isFlipped)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>Flip</span>
            </button>
            <button
              type="button"
              onClick={handleNextCard}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: QUIZ MODE */}
      {activeTab === 'quiz' && currentQuiz && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-slate-200">
                Score: {quizScore} / {quizAnsweredCount}
              </span>
            </div>
            <div className="text-slate-400 font-mono">Question {quizQuestionIndex + 1}</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider">
                {currentQuiz.category}
              </span>
              <span className="text-xs font-mono text-slate-400">{currentQuiz.source}</span>
            </div>

            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-2">
                What is the verified legal definition of:
              </span>
              <h3 className="text-2xl sm:text-3xl font-serif-legal font-bold text-amber-300">
                "{currentQuiz.term}"
              </h3>
            </div>

            <div className="space-y-3">
              {currentQuiz.options.map((opt, idx) => {
                const isSelected = selectedAnswer === idx;
                let btnStyle = 'bg-slate-950/70 border-slate-800 text-slate-200 hover:border-amber-500/50';
                if (selectedAnswer !== null) {
                  if (opt.isCorrect) {
                    btnStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/60 font-semibold';
                  } else if (isSelected) {
                    btnStyle = 'bg-red-950/60 border-red-500 text-red-200 ring-1 ring-red-500/60';
                  } else {
                    btnStyle = 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-60';
                  }
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAnswerQuiz(idx, opt.isCorrect)}
                    disabled={selectedAnswer !== null}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${btnStyle}`}
                  >
                    <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0 mt-0.5">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-xs sm:text-sm leading-relaxed flex-1">{opt.text}</span>
                    {selectedAnswer !== null && opt.isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    {selectedAnswer !== null && isSelected && !opt.isCorrect && (
                      <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedAnswer !== null && (
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                <div className="text-xs">
                  {currentQuiz.options[selectedAnswer].isCorrect ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Correct</span>
                    </span>
                  ) : (
                    <span className="text-red-400 font-bold flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" />
                      <span>Incorrect. See highlighted definition.</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleNextQuiz}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-2"
                >
                  <span>Next Question</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: COURT TERMINOLOGY */}
      {activeTab === 'terminology' && (() => {
        const filteredTerminology = COURT_TERMINOLOGY_CATALOG.filter((item) => {
          const matchesCategory = termCategory === 'all' || item.category === termCategory;
          if (!matchesCategory) return false;
          if (!termQuery.trim()) return true;
          const q = termQuery.toLowerCase();
          return (
            item.title.om.toLowerCase().includes(q) ||
            item.title.am.toLowerCase().includes(q) ||
            item.title.en.toLowerCase().includes(q) ||
            item.definition.om.toLowerCase().includes(q) ||
            item.definition.am.toLowerCase().includes(q) ||
            item.definition.en.toLowerCase().includes(q) ||
            item.keywords.some((k) => k.toLowerCase().includes(q)) ||
            item.lawRef.en.toLowerCase().includes(q)
          );
        });

        return (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-amber-500/30 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold font-serif-legal text-white">
                    Trilingual Court Terminology & Proceedings
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Explore Ethiopian courtroom procedures and terms across Afaan Oromoo, Amharic, and English.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs text-amber-400 font-mono">
                  <span>{COURT_TERMINOLOGY_CATALOG.length} Core Concepts</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={termQuery}
                    onChange={(e) => setTermQuery(e.target.value)}
                    placeholder="Search court proceedings or statutory references..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/70"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 no-scrollbar">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'proceedings', label: 'Proceedings' },
                    { id: 'principles', label: 'Principles' },
                    { id: 'commercial_property', label: 'Commercial/Property' },
                    { id: 'criminal_constitutional', label: 'Criminal/Constitutional' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setTermCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                        termCategory === cat.id
                          ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredTerminology.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                No court terminology matched "{termQuery}".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredTerminology.map((item) => {
                  const isCopied = copiedTermId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold uppercase">
                          {item.lawRef.en}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(
                              `${item.title.om} | ${item.title.am} | ${item.title.en}\n${item.definition.om}\n${item.definition.am}\n${item.definition.en}`
                            );
                            setCopiedTermId(item.id);
                            setTimeout(() => setCopiedTermId(null), 2000);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                        >
                          {isCopied ? 'Copied ✓' : 'Copy'}
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <span className="text-[10px] text-amber-400 uppercase font-bold">Afaan Oromoo</span>
                          <h3 className="text-sm font-bold text-white">{item.title.om}</h3>
                          <p className="text-xs text-slate-300 leading-relaxed">{item.definition.om}</p>
                        </div>
                        <div className="pt-2 border-t border-slate-800/80 font-ethiopic">
                          <span className="text-[10px] text-amber-400 uppercase font-bold font-sans">አማርኛ</span>
                          <h3 className="text-sm font-bold text-white">{item.title.am}</h3>
                          <p className="text-xs text-slate-300 leading-relaxed">{item.definition.am}</p>
                        </div>
                        <div className="pt-2 border-t border-slate-800/80">
                          <span className="text-[10px] text-indigo-400 uppercase font-bold">English</span>
                          <h3 className="text-sm font-bold text-white">{item.title.en}</h3>
                          <p className="text-xs text-slate-300 leading-relaxed">{item.definition.en}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Entry Detail & Version History Modal */}
      <GlossaryEntryDetailModal
        termId={detailTermId}
        currentLang={currentLang}
        primaryLang={primaryLang}
        canSubmit={canSubmit}
        canReview={canReview}
        onClose={() => setDetailTermId(null)}
        onSuggestCorrection={openCorrectionModal}
        onArchived={loadGlossary}
      />

      {/* New Term / Suggest Correction Modal */}
      <GlossarySubmissionModal
        isOpen={isSubmissionModalOpen}
        onClose={() => setIsSubmissionModalOpen(false)}
        currentLang={currentLang}
        revisionTarget={revisionTarget}
        aiDraftPrefill={aiDraftPrefill}
        onSubmitted={() => {
          setShowMySubmissions(true);
          loadMySubmissions();
          if (canReview) loadGlossary();
        }}
      />
    </div>
  );
};
