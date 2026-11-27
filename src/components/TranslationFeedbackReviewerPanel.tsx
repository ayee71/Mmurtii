import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Download,
  Filter,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import {
  exportCuratedTranslationFeedbackApi,
  fetchReviewTranslationFeedbackApi,
  fetchTranslationFeedbackAuditLogsApi,
  fetchTranslationQualityMetricsApi,
  moderateTranslationFeedbackApi,
  TranslationFeedbackFilterParams,
} from '../services/translationFeedbackApi';
import type { TranslationQualityMetricsSummary } from '../server/legal/translationFeedbackService';
import {
  TERMINOLOGY_REVIEW_OUTCOMES,
  TerminologyReviewOutcome,
  TRANSLATION_FEEDBACK_STATUSES,
  TRANSLATION_ISSUE_CATEGORIES,
  TranslationFeedbackAuditRecord,
  TranslationFeedbackRecord,
  TranslationFeedbackStatus,
  TranslationIssueCategory,
  TranslationLanguage,
} from '../shared/translationFeedbackSchema';

interface TranslationFeedbackReviewerPanelProps {
  currentLang: Language;
}

export const TranslationFeedbackReviewerPanel: React.FC<TranslationFeedbackReviewerPanelProps> = ({
  currentLang,
}) => {
  const t = translations[currentLang];
  const tf = t.translationFeedback;

  const [items, setItems] = useState<TranslationFeedbackRecord[]>([]);
  const [metrics, setMetrics] = useState<TranslationQualityMetricsSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<TranslationFeedbackAuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Search & Filter states
  const [translationIdFilter, setTranslationIdFilter] = useState('');
  const [sourceLangFilter, setSourceLangFilter] = useState<TranslationLanguage | 'all'>('all');
  const [targetLangFilter, setTargetLangFilter] = useState<TranslationLanguage | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TranslationFeedbackStatus | 'all'>('all');
  const [issueCategoryFilter, setIssueCategoryFilter] = useState<TranslationIssueCategory | 'all'>('all');
  const [minRatingFilter, setMinRatingFilter] = useState<string>('');
  const [maxRatingFilter, setMaxRatingFilter] = useState<string>('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [termQueryFilter, setTermQueryFilter] = useState('');
  const [modelVersionFilter, setModelVersionFilter] = useState('');

  // Selected feedback moderation state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Exclude<TranslationFeedbackStatus, 'submitted'>>('under_review');
  const [decisionReason, setDecisionReason] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [terminologyOutcome, setTerminologyOutcome] = useState<TerminologyReviewOutcome | ''>('');
  const [escalateToGlossary, setEscalateToGlossary] = useState(false);
  const [moderating, setModerating] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const buildFilters = (): TranslationFeedbackFilterParams => ({
    ...(translationIdFilter.trim() ? { translationId: translationIdFilter.trim() } : {}),
    sourceLanguage: sourceLangFilter,
    targetLanguage: targetLangFilter,
    status: statusFilter,
    issueCategory: issueCategoryFilter,
    ...(minRatingFilter ? { minRating: Number(minRatingFilter) } : {}),
    ...(maxRatingFilter ? { maxRating: Number(maxRatingFilter) } : {}),
    ...(dateFromFilter ? { dateFrom: dateFromFilter } : {}),
    ...(dateToFilter ? { dateTo: `${dateToFilter}T23:59:59.999Z` } : {}),
    ...(termQueryFilter.trim() ? { termQuery: termQueryFilter.trim() } : {}),
    ...(modelVersionFilter.trim() ? { modelVersion: modelVersionFilter.trim() } : {}),
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = buildFilters();
      const [queueRes, metricsRes, auditRes] = await Promise.all([
        fetchReviewTranslationFeedbackApi(filters),
        fetchTranslationQualityMetricsApi(filters),
        fetchTranslationFeedbackAuditLogsApi(),
      ]);
      setItems(queueRes.items || []);
      setMetrics(metricsRes.metrics || null);
      setAuditLogs(auditRes.logs || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load translation feedback queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedItem = items.find((i) => i.feedbackId === selectedId) || null;

  const selectFeedback = (rec: TranslationFeedbackRecord) => {
    setSelectedId(rec.feedbackId);
    setDecision(rec.status === 'submitted' ? 'under_review' : rec.status);
    setDecisionReason(rec.decisionReason || '');
    setReviewerNotes(rec.reviewerNotes || '');
    setTerminologyOutcome(rec.terminologyOutcome || '');
    setEscalateToGlossary(false);
    setError(null);
  };

  const handleModerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!decisionReason.trim()) {
      setError('A decision reason is required to record this moderation action.');
      return;
    }

    setModerating(true);
    setError(null);
    try {
      const res = await moderateTranslationFeedbackApi({
        feedbackId: selectedItem.feedbackId,
        decision,
        decisionReason: decisionReason.trim(),
        reviewerNotes: reviewerNotes.trim(),
        ...(terminologyOutcome ? { terminologyOutcome } : {}),
        escalateToGlossary: escalateToGlossary && Boolean(selectedItem.terminologyCorrection),
      });
      setToast(
        res.escalatedGlossarySubmissionId
          ? `Moderation saved & terminology escalated to Glossary Queue (${res.escalatedGlossarySubmissionId}).`
          : `Feedback ${selectedItem.feedbackId} updated to ${decision}.`
      );
      setTimeout(() => setToast(null), 5000);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Moderation failed.');
    } finally {
      setModerating(false);
    }
  };

  const handleExport = async (format: 'jsonl' | 'csv') => {
    setExporting(true);
    setError(null);
    try {
      const res = await exportCuratedTranslationFeedbackApi(format, buildFilters());
      const blob = new Blob([res.content || ''], {
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/x-ndjson;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seeraai_curated_translation_feedback.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast(`Exported ${res.count} accepted & consented records (${format.toUpperCase()}).`);
      setTimeout(() => setToast(null), 5000);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Protected Export Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            <span>Trilingual Translation Feedback & Quality Review</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Only verified reviewers/admins may inspect evaluations, moderate status, forward terminology proposals, and export accepted + consented records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('jsonl')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export JSONL</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAudit((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold"
          >
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Audit ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate Quality Indicators (with sample size n) */}
      {metrics && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span>Aggregate Quality Indicators (n = {metrics.totalFeedbackCount})</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Curated Export Eligible (Accepted & Consented):{' '}
              <strong className="text-emerald-300">{metrics.consentedAcceptedCount}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Average Rating</div>
              <div className="text-xl font-bold text-amber-300 mt-1">
                {metrics.averageOverallRating !== null ? `${metrics.averageOverallRating} / 5` : '—'}
              </div>
              <div className="text-[10px] text-slate-500">n = {metrics.totalFeedbackCount}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Submitted / Under Review</div>
              <div className="text-xl font-bold text-slate-100 mt-1">
                {(metrics.byStatus.submitted || 0) + (metrics.byStatus.under_review || 0)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Accepted</div>
              <div className="text-xl font-bold text-emerald-300 mt-1">
                {metrics.byStatus.accepted || 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] text-slate-400">Rejected / Clarify</div>
              <div className="text-xl font-bold text-rose-300 mt-1">
                {(metrics.byStatus.rejected || 0) + (metrics.byStatus.needs_clarification || 0)}
              </div>
            </div>
          </div>

          {metrics.byDirection.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300">By Language Direction</div>
                <div className="space-y-1.5">
                  {metrics.byDirection.map((d) => (
                    <div key={d.direction} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-200">{d.direction.toUpperCase()}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-300 font-semibold">{d.averageRating}/5</span>
                        <span className="text-slate-400">(n={d.count})</span>
                        {d.lowSampleSize && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                            Low n
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300">By Model Version & Top Issues</div>
                <div className="space-y-1.5">
                  {metrics.byModel.map((m) => (
                    <div key={m.model} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-200">{m.model}</span>
                      <span className="text-slate-300">
                        {m.averageRating}/5 <span className="text-slate-400">(n={m.count})</span>
                      </span>
                    </div>
                  ))}
                  {metrics.byIssueCategory.slice(0, 4).map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{tf.categories[c.category]}</span>
                      <span>n={c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>Search & Filter Evaluations</span>
          </span>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{loading ? 'Loading...' : 'Apply Filters'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <input
            type="text"
            value={translationIdFilter}
            onChange={(e) => setTranslationIdFilter(e.target.value)}
            placeholder="Translation ID (trn_...)"
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
          />
          <input
            type="text"
            value={termQueryFilter}
            onChange={(e) => setTermQueryFilter(e.target.value)}
            placeholder="Search legal term / comment..."
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
          />
          <select
            value={sourceLangFilter}
            onChange={(e) => setSourceLangFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
          >
            <option value="all">All Source Languages</option>
            <option value="om">Afaan Oromoo (om)</option>
            <option value="am">Amharic (am)</option>
            <option value="en">English (en)</option>
          </select>
          <select
            value={targetLangFilter}
            onChange={(e) => setTargetLangFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
          >
            <option value="all">All Target Languages</option>
            <option value="om">Afaan Oromoo (om)</option>
            <option value="am">Amharic (am)</option>
            <option value="en">English (en)</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
          >
            <option value="all">All Statuses</option>
            {TRANSLATION_FEEDBACK_STATUSES.map((st) => (
              <option key={st} value={st}>
                {tf.statuses[st]}
              </option>
            ))}
          </select>
          <select
            value={issueCategoryFilter}
            onChange={(e) => setIssueCategoryFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
          >
            <option value="all">All Issue Categories</option>
            {TRANSLATION_ISSUE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {tf.categories[cat]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={modelVersionFilter}
            onChange={(e) => setModelVersionFilter(e.target.value)}
            placeholder="Model (e.g. gemini-4-hydrogen)"
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
          />
          <div className="flex gap-1.5">
            <input
              type="number"
              min={1}
              max={5}
              value={minRatingFilter}
              onChange={(e) => setMinRatingFilter(e.target.value)}
              placeholder="Min ★"
              className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-slate-200"
            />
            <input
              type="number"
              min={1}
              max={5}
              value={maxRatingFilter}
              onChange={(e) => setMaxRatingFilter(e.target.value)}
              placeholder="Max ★"
              className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-slate-200"
            />
          </div>
          <input
            type="date"
            value={dateFromFilter}
            onChange={(e) => setDateFromFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
          />
          <input
            type="date"
            value={dateToFilter}
            onChange={(e) => setDateToFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
          />
        </div>
      </div>

      {/* Queue List + Moderation Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 max-h-[540px] overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Evaluation Queue ({items.length})
          </h3>
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No matching feedback records.</p>
          ) : (
            items.map((rec) => {
              const active = rec.feedbackId === selectedId;
              return (
                <button
                  key={rec.feedbackId}
                  type="button"
                  onClick={() => selectFeedback(rec)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all space-y-1.5 ${
                    active
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-100">
                      {rec.direction.toUpperCase()} • ★ {rec.overallRating}/5
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                      {tf.statuses[rec.status]}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {rec.translationId} • {rec.model}
                  </div>
                  {rec.comment && (
                    <p className="text-xs text-slate-300 line-clamp-2">{rec.comment}</p>
                  )}
                  {rec.terminologyCorrection && (
                    <div className="text-[11px] text-amber-300">
                      Term: {rec.terminologyCorrection.sourceTerm} → {rec.terminologyCorrection.suggestedTargetTerm}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Selected Feedback Moderation Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          {!selectedItem ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-16">
              <RefreshCw className="w-7 h-7 mb-2 opacity-40" aria-hidden="true" />
              <span>Select a feedback entry to inspect metadata & record moderation decision.</span>
            </div>
          ) : (
            <form onSubmit={handleModerate} className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Feedback {selectedItem.feedbackId}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Translation: {selectedItem.translationId} | {selectedItem.direction.toUpperCase()}
                  </p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  Consent: {selectedItem.consentToCuratedDataset ? 'Yes' : 'No'}
                </span>
              </div>

              {/* Minimal Permitted Context */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 grid grid-cols-2 gap-1.5">
                <div>Provider: {selectedItem.provider}</div>
                <div>Model: {selectedItem.model}</div>
                <div>Prompt: {selectedItem.promptVersion}</div>
                <div>Glossary: {selectedItem.glossaryVersion}</div>
                <div>Module: {selectedItem.module}</div>
                <div>App: {selectedItem.appVersion}</div>
              </div>

              {selectedItem.comment && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap">
                  {selectedItem.comment}
                </div>
              )}

              {selectedItem.terminologyCorrection && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Terminology Correction Proposal</span>
                  </div>
                  <div className="text-slate-200">
                    Source: <strong>{selectedItem.terminologyCorrection.sourceTerm}</strong>
                  </div>
                  <div className="text-slate-300">
                    Current: {selectedItem.terminologyCorrection.currentTargetTerm} → Suggested:{' '}
                    <strong className="text-emerald-300">
                      {selectedItem.terminologyCorrection.suggestedTargetTerm}
                    </strong>
                  </div>
                  {selectedItem.terminologyCorrection.legalReference && (
                    <div className="text-slate-300">
                      Reference: {selectedItem.terminologyCorrection.legalReference}
                    </div>
                  )}
                  {selectedItem.terminologyCorrection.glossaryTermId && (
                    <div className="text-[11px] font-mono text-emerald-300">
                      Linked Glossary ID: {selectedItem.terminologyCorrection.glossaryTermId}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Moderation Status</label>
                  <select
                    value={decision}
                    onChange={(e) => setDecision(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                  >
                    <option value="under_review">Under review</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="needs_clarification">Needs clarification</option>
                  </select>
                </div>

                {selectedItem.terminologyCorrection && (
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Terminology Decision</label>
                    <select
                      value={terminologyOutcome}
                      onChange={(e) => setTerminologyOutcome(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                    >
                      <option value="">— Optional —</option>
                      {TERMINOLOGY_REVIEW_OUTCOMES.map((out) => (
                        <option key={out} value={out}>
                          {out}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">
                  Decision Reason <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Reason for acceptance, rejection, or clarification..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">
                  Private Reviewer-Only Notes (hidden from ordinary users)
                </label>
                <textarea
                  rows={2}
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100"
                />
              </div>

              {selectedItem.terminologyCorrection && !selectedItem.escalatedGlossarySubmissionId && (
                <label className="flex items-center gap-2 text-xs text-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={escalateToGlossary}
                    onChange={(e) => setEscalateToGlossary(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-amber-500"
                  />
                  <span>Forward terminology correction to Glossary pending review queue (never auto-publishes)</span>
                </label>
              )}

              {selectedItem.escalatedGlossarySubmissionId && (
                <div className="text-[11px] text-emerald-300 font-mono">
                  Escalated Glossary Submission: {selectedItem.escalatedGlossarySubmissionId}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={moderating}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold disabled:opacity-50"
                >
                  {moderating ? 'Saving...' : 'Record Decision'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Audit Trail Drawer */}
      {showAudit && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 max-h-72 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Immutable Feedback & Export Audit Trail
          </h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400">No audit events recorded yet.</p>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.auditId}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-amber-300">{log.action}</span>{' '}
                  {log.feedbackId && <span className="font-mono">({log.feedbackId})</span>}{' '}
                  {log.decisionReason && <span>— {log.decisionReason}</span>}
                  {log.exportFormat && (
                    <span>
                      — {log.exportFormat.toUpperCase()} ({log.exportedCount ?? 0} rows)
                    </span>
                  )}
                </div>
                <span className="text-slate-500 font-mono">
                  {log.actorUid} • {log.timestamp}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
