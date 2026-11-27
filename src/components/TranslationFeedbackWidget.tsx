import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  MessageSquarePlus,
  RefreshCw,
  Shield,
  Star,
  XCircle,
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import { fetchGlossaryEntries } from '../services/glossaryApi';
import type { GlossaryEntryRecord } from '../shared/legalGlossarySchema';
import {
  fetchMyTranslationFeedbackApi,
  submitTranslationFeedbackApi,
} from '../services/translationFeedbackApi';
import {
  hasTerminologyIssueCategory,
  requiresCommentForSubmission,
  TRANSLATION_FEEDBACK_LIMITS,
  TRANSLATION_ISSUE_CATEGORIES,
  TranslationFeedbackStatus,
  TranslationIssueCategory,
  TranslationLanguage,
  UserVisibleTranslationFeedback,
} from '../shared/translationFeedbackSchema';

interface TranslationFeedbackWidgetProps {
  currentLang: Language;
  translationId?: string;
  sourceLang: TranslationLanguage;
  targetLang: TranslationLanguage;
  isRewrite: boolean;
}

const STATUS_BADGE_MAP: Record<
  TranslationFeedbackStatus,
  { icon: React.ReactNode; classes: string }
> = {
  submitted: {
    icon: <Clock className="w-3.5 h-3.5" aria-hidden="true" />,
    classes: 'bg-slate-800 text-slate-200 border-slate-700',
  },
  under_review: {
    icon: <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />,
    classes: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  },
  accepted: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
    classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  },
  rejected: {
    icon: <XCircle className="w-3.5 h-3.5" aria-hidden="true" />,
    classes: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  },
  needs_clarification: {
    icon: <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />,
    classes: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
  },
};

export const TranslationFeedbackWidget: React.FC<TranslationFeedbackWidgetProps> = ({
  currentLang,
  translationId,
  sourceLang,
  targetLang,
  isRewrite,
}) => {
  const t = translations[currentLang];
  const tf = t.translationFeedback;
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [showMyHistory, setShowMyHistory] = useState(false);

  const [overallRating, setOverallRating] = useState<number>(0);
  const [accuracyRating, setAccuracyRating] = useState<number | undefined>(undefined);
  const [terminologyRating, setTerminologyRating] = useState<number | undefined>(undefined);
  const [completenessRating, setCompletenessRating] = useState<number | undefined>(undefined);
  const [readabilityRating, setReadabilityRating] = useState<number | undefined>(undefined);
  const [showDetailedRatings, setShowDetailedRatings] = useState(false);

  const [issueCategories, setIssueCategories] = useState<TranslationIssueCategory[]>([]);
  const [comment, setComment] = useState('');

  // Conditional Terminology Correction fields
  const [showTerminologySection, setShowTerminologySection] = useState(false);
  const [sourceTerm, setSourceTerm] = useState('');
  const [currentTargetTerm, setCurrentTargetTerm] = useState('');
  const [suggestedTargetTerm, setSuggestedTargetTerm] = useState('');
  const [termExplanation, setTermExplanation] = useState('');
  const [legalReference, setLegalReference] = useState('');
  const [glossarySearchQuery, setGlossarySearchQuery] = useState('');
  const [glossaryMatches, setGlossaryMatches] = useState<GlossaryEntryRecord[]>([]);
  const [selectedGlossaryTermId, setSelectedGlossaryTermId] = useState<string>('');

  // Consent checkbox MUST be unchecked by default
  const [consentToCuratedDataset, setConsentToCuratedDataset] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedForTranslationIds, setSubmittedForTranslationIds] = useState<Record<string, boolean>>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [myFeedback, setMyFeedback] = useState<UserVisibleTranslationFeedback[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  const isAuthenticatedVerified =
    Boolean(user) && !user?.isAnonymous && user?.emailVerified !== false;

  // Reset form cleanly when a new translationId arrives
  useEffect(() => {
    setOverallRating(0);
    setAccuracyRating(undefined);
    setTerminologyRating(undefined);
    setCompletenessRating(undefined);
    setReadabilityRating(undefined);
    setIssueCategories([]);
    setComment('');
    setSourceTerm('');
    setCurrentTargetTerm('');
    setSuggestedTargetTerm('');
    setTermExplanation('');
    setLegalReference('');
    setSelectedGlossaryTermId('');
    setConsentToCuratedDataset(false);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, [translationId]);

  // Automatically reveal terminology correction section when a terminology issue category is flagged
  useEffect(() => {
    if (hasTerminologyIssueCategory(issueCategories)) {
      setShowTerminologySection(true);
    }
  }, [issueCategories]);

  // Lightweight glossary term suggestions for linking concept IDs
  useEffect(() => {
    if (!showTerminologySection || !glossarySearchQuery.trim()) {
      setGlossaryMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetchGlossaryEntries({
          query: glossarySearchQuery.trim(),
          status: 'approved',
          page: 1,
          pageSize: 5,
        });
        if (!cancelled) {
          setGlossaryMatches((res.items || []).map((r) => r.entry));
        }
      } catch {
        if (!cancelled) setGlossaryMatches([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [glossarySearchQuery, showTerminologySection]);

  const loadMyFeedback = async () => {
    if (!isAuthenticatedVerified) return;
    setLoadingMine(true);
    try {
      const res = await fetchMyTranslationFeedbackApi();
      setMyFeedback(res.items || []);
      const alreadyDone: Record<string, boolean> = {};
      for (const item of res.items || []) {
        alreadyDone[item.translationId] = true;
      }
      setSubmittedForTranslationIds((prev) => ({ ...prev, ...alreadyDone }));
    } catch {
      // Non-blocking: feedback status lookup must never break TranslateView
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => {
    if (showMyHistory && isAuthenticatedVerified) {
      loadMyFeedback();
    }
  }, [showMyHistory, isAuthenticatedVerified]);

  if (isRewrite || sourceLang === targetLang) {
    return null;
  }

  const alreadySubmittedThis =
    Boolean(translationId && submittedForTranslationIds[translationId]) || submitSuccess;

  const toggleCategory = (cat: TranslationIssueCategory) => {
    setIssueCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const renderRatingScale = (
    label: string,
    value: number | undefined,
    onChange: (n: number) => void,
    required = false,
    description?: string
  ) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-200">
          {label} {required && <span className="text-rose-400">*</span>}
        </span>
        {value ? (
          <span className="text-[11px] text-amber-300 font-medium">
            {tf.ratingScaleLabels[String(value) as '1' | '2' | '3' | '4' | '5']}
          </span>
        ) : null}
      </div>
      {description && <p className="text-[11px] text-slate-400">{description}</p>}
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {([1, 2, 3, 4, 5] as const).map((score) => {
          const active = value === score;
          const scoreLabel = tf.ratingScaleLabels[String(score) as '1' | '2' | '3' | '4' | '5'];
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={scoreLabel}
              onClick={() => onChange(score)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                active
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
              }`}
            >
              <Star
                className={`w-3.5 h-3.5 ${active ? 'fill-slate-950' : 'text-amber-400'}`}
                aria-hidden="true"
              />
              <span>{score}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const commentNeedsText =
    requiresCommentForSubmission(issueCategories) ||
    (issueCategories.length === 0 && overallRating > 0 && overallRating <= 2);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitError(null);

    if (!translationId) {
      setSubmitError('Missing translation identifier. Please re-run translation first.');
      return;
    }
    if (!isAuthenticatedVerified) {
      setSubmitError(tf.signInRequired);
      return;
    }
    if (alreadySubmittedThis) {
      setSubmitError(tf.duplicateNotice);
      return;
    }
    if (overallRating < 1 || overallRating > 5) {
      setSubmitError(tf.overallRatingLabel);
      return;
    }

    const trimmedComment = comment.trim();
    if (commentNeedsText && !trimmedComment) {
      setSubmitError(tf.commentRequiredNotice);
      return;
    }

    const hasAnyTermField =
      sourceTerm.trim() || currentTargetTerm.trim() || suggestedTargetTerm.trim();
    if (hasAnyTermField && (!sourceTerm.trim() || !currentTargetTerm.trim() || !suggestedTargetTerm.trim())) {
      setSubmitError(
        `${tf.sourceTermLabel}, ${tf.currentTermLabel}, & ${tf.suggestedTermLabel} are all required when adding a terminology correction.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitTranslationFeedbackApi({
        translationId,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        overallRating,
        ...(accuracyRating ? { accuracyRating } : {}),
        ...(terminologyRating ? { terminologyRating } : {}),
        ...(completenessRating ? { completenessRating } : {}),
        ...(readabilityRating ? { readabilityRating } : {}),
        issueCategories,
        comment: trimmedComment,
        ...(hasAnyTermField
          ? {
              terminologyCorrection: {
                sourceTerm: sourceTerm.trim(),
                currentTargetTerm: currentTargetTerm.trim(),
                suggestedTargetTerm: suggestedTargetTerm.trim(),
                ...(termExplanation.trim() ? { explanation: termExplanation.trim() } : {}),
                ...(legalReference.trim() ? { legalReference: legalReference.trim() } : {}),
                ...(selectedGlossaryTermId ? { glossaryTermId: selectedGlossaryTermId } : {}),
              },
            }
          : {}),
        consentToCuratedDataset,
      });

      setSubmitSuccess(true);
      setSubmittedForTranslationIds((prev) => ({ ...prev, [translationId]: true }));
      setMyFeedback((prev) => [res.feedback, ...prev.filter((i) => i.feedbackId !== res.feedback.feedbackId)]);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit translation feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {translationId && (
            <button
              type="button"
              onClick={() => setIsOpen((v) => !v)}
              aria-expanded={isOpen}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
              <span>{isOpen ? tf.hideForm : tf.rateButton}</span>
              {isOpen ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          )}

          {translationId && (
            <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              ID: {translationId}
            </span>
          )}
        </div>

        {isAuthenticatedVerified && (
          <button
            type="button"
            onClick={() => setShowMyHistory((v) => !v)}
            aria-expanded={showMyHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>{tf.myFeedbackTitle}</span>
          </button>
        )}
      </div>

      {/* Collapsible Evaluation Form */}
      {isOpen && translationId && (
        <form
          onSubmit={handleSubmit}
          className="pt-3 border-t border-slate-800 space-y-5"
          aria-label={tf.formTitle}
        >
          <div>
            <h3 className="text-sm font-bold text-slate-100">{tf.formTitle}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{tf.formSubtitle}</p>
          </div>

          {!isAuthenticatedVerified ? (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" aria-hidden="true" />
              <span>{tf.signInRequired}</span>
            </div>
          ) : alreadySubmittedThis ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>{submitSuccess ? tf.submittedSuccess : tf.duplicateNotice}</span>
            </div>
          ) : (
            <>
              {/* Required Overall Rating */}
              {renderRatingScale(tf.overallRatingLabel, overallRating || undefined, setOverallRating, true)}

              {/* Optional Separate Dimension Ratings */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowDetailedRatings((v) => !v)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white"
                  aria-expanded={showDetailedRatings}
                >
                  <span>{tf.optionalRatingsTitle}</span>
                  {showDetailedRatings ? (
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
                {showDetailedRatings && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                    {renderRatingScale(tf.accuracyLabel, accuracyRating, setAccuracyRating, false, tf.accuracyDesc)}
                    {renderRatingScale(tf.terminologyLabel, terminologyRating, setTerminologyRating, false, tf.terminologyDesc)}
                    {renderRatingScale(tf.completenessLabel, completenessRating, setCompletenessRating, false, tf.completenessDesc)}
                    {renderRatingScale(tf.readabilityLabel, readabilityRating, setReadabilityRating, false, tf.readabilityDesc)}
                  </div>
                )}
              </div>

              {/* Issue Categories */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-200">
                  {tf.issueCategoriesLabel}
                </span>
                <div className="flex flex-wrap gap-2">
                  {TRANSLATION_ISSUE_CATEGORIES.map((cat) => {
                    const selected = issueCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                          selected
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {tf.categories[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comment Field with Counter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="tf-comment" className="text-xs font-semibold text-slate-200">
                    {tf.commentLabel} {commentNeedsText && <span className="text-rose-400">*</span>}
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {comment.length} / {TRANSLATION_FEEDBACK_LIMITS.maxCommentLength}
                  </span>
                </div>
                {commentNeedsText && (
                  <p className="text-[11px] text-amber-300">{tf.commentRequiredNotice}</p>
                )}
                <textarea
                  id="tf-comment"
                  rows={3}
                  maxLength={TRANSLATION_FEEDBACK_LIMITS.maxCommentLength}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={tf.commentPlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Legal Terminology Correction Section */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowTerminologySection((v) => !v)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-amber-300"
                  aria-expanded={showTerminologySection}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" aria-hidden="true" />
                    <span>{tf.terminologySectionTitle}</span>
                  </span>
                  {showTerminologySection ? (
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>

                {showTerminologySection && (
                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="tf-src-term" className="block text-[11px] text-slate-300 mb-1">
                          {tf.sourceTermLabel} ({sourceLang.toUpperCase()})
                        </label>
                        <input
                          id="tf-src-term"
                          type="text"
                          maxLength={TRANSLATION_FEEDBACK_LIMITS.maxTermLength}
                          value={sourceTerm}
                          onChange={(e) => setSourceTerm(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                        />
                      </div>
                      <div>
                        <label htmlFor="tf-cur-term" className="block text-[11px] text-slate-300 mb-1">
                          {tf.currentTermLabel}
                        </label>
                        <input
                          id="tf-cur-term"
                          type="text"
                          maxLength={TRANSLATION_FEEDBACK_LIMITS.maxTermLength}
                          value={currentTargetTerm}
                          onChange={(e) => setCurrentTargetTerm(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                        />
                      </div>
                      <div>
                        <label htmlFor="tf-sug-term" className="block text-[11px] text-slate-300 mb-1">
                          {tf.suggestedTermLabel} ({targetLang.toUpperCase()})
                        </label>
                        <input
                          id="tf-sug-term"
                          type="text"
                          maxLength={TRANSLATION_FEEDBACK_LIMITS.maxTermLength}
                          value={suggestedTargetTerm}
                          onChange={(e) => setSuggestedTargetTerm(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="tf-term-expl" className="block text-[11px] text-slate-300 mb-1">
                          {tf.termExplanationLabel}
                        </label>
                        <input
                          id="tf-term-expl"
                          type="text"
                          maxLength={TRANSLATION_FEEDBACK_LIMITS.maxExplanationLength}
                          value={termExplanation}
                          onChange={(e) => setTermExplanation(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                        />
                      </div>
                      <div>
                        <label htmlFor="tf-legal-ref" className="block text-[11px] text-slate-300 mb-1">
                          {tf.legalReferenceLabel}
                        </label>
                        <input
                          id="tf-legal-ref"
                          type="text"
                          maxLength={TRANSLATION_FEEDBACK_LIMITS.maxLegalReferenceLength}
                          value={legalReference}
                          onChange={(e) => setLegalReference(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                        />
                      </div>
                    </div>

                    {/* Optional Glossary Term Link */}
                    <div>
                      <label htmlFor="tf-glossary-link" className="block text-[11px] text-slate-300 mb-1">
                        {tf.linkGlossaryTermLabel}
                      </label>
                      <input
                        id="tf-glossary-link"
                        type="text"
                        value={glossarySearchQuery}
                        onChange={(e) => setGlossarySearchQuery(e.target.value)}
                        placeholder={tf.linkGlossaryPlaceholder}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                      />
                      {glossaryMatches.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {glossaryMatches.map((entry) => {
                            const active = selectedGlossaryTermId === entry.termId;
                            return (
                              <button
                                key={entry.termId}
                                type="button"
                                onClick={() =>
                                  setSelectedGlossaryTermId(active ? '' : entry.termId)
                                }
                                className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                                  active
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                                }`}
                              >
                                {entry.terms.om.preferred} / {entry.terms.am.preferred} / {entry.terms.en.preferred}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {selectedGlossaryTermId && (
                        <div className="mt-1 text-[11px] text-emerald-300">
                          Linked Glossary ID: <span className="font-mono">{selectedGlossaryTermId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Opt-in Curated Dataset Consent (Unchecked by default) */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={consentToCuratedDataset}
                    onChange={(e) => setConsentToCuratedDataset(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                  />
                  <span>{tf.consentLabel}</span>
                </label>
                <p className="text-[11px] text-slate-400 pl-6">{tf.consentDesc}</p>
              </div>

              <div className="flex items-start gap-2 text-[11px] text-slate-400">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{tf.privacyNote}</span>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-200 text-xs flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                    <span>{submitError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[11px] font-semibold"
                  >
                    {tf.retryButton}
                  </button>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || overallRating < 1}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-slate-950 text-xs font-bold shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      <span>{tf.submitting}</span>
                    </>
                  ) : (
                    <span>{tf.submitButton}</span>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* Ordinary User's Own Feedback Status Tracking */}
      {showMyHistory && isAuthenticatedVerified && (
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {tf.myFeedbackTitle}
            </h4>
            <button
              type="button"
              onClick={loadMyFeedback}
              disabled={loadingMine}
              className="inline-flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200"
            >
              <RefreshCw className={`w-3 h-3 ${loadingMine ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{tf.refreshStatus}</span>
            </button>
          </div>

          {myFeedback.length === 0 ? (
            <p className="text-xs text-slate-400">{tf.myFeedbackEmpty}</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {myFeedback.map((item) => {
                const badge = STATUS_BADGE_MAP[item.status] || STATUS_BADGE_MAP.submitted;
                return (
                  <div
                    key={item.feedbackId}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-200">
                          {item.sourceLanguage.toUpperCase()} → {item.targetLanguage.toUpperCase()}
                        </span>
                        <span className="text-[11px] text-amber-300 font-semibold">
                          ★ {item.overallRating}/5
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {item.translationId}
                        </span>
                      </div>
                      {item.comment && (
                        <p className="text-xs text-slate-300 line-clamp-2">{item.comment}</p>
                      )}
                      {item.terminologyCorrection && (
                        <p className="text-[11px] text-emerald-300">
                          {item.terminologyCorrection.sourceTerm}: &ldquo;{item.terminologyCorrection.currentTargetTerm}&rdquo; → &ldquo;{item.terminologyCorrection.suggestedTargetTerm}&rdquo;
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${badge.classes}`}
                    >
                      {badge.icon}
                      <span>{tf.statuses[item.status]}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
