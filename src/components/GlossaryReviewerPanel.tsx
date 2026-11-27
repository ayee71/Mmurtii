import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Edit3,
  ShieldAlert,
  RefreshCw,
  Sparkles,
  History,
} from 'lucide-react';
import type { Language } from '../i18n/translations';
import {
  GlossaryAuditRecord,
  GlossarySubmissionProposedEntry,
  GlossarySubmissionRecord,
} from '../shared/legalGlossarySchema';
import {
  fetchGlossaryAuditLogs,
  fetchGlossarySubmissions,
  reviewGlossarySubmissionApi,
} from '../services/glossaryApi';
import { lookupLegalTerm } from '../services/api';

interface GlossaryReviewerPanelProps {
  currentLang: Language;
  onEntriesUpdated: () => void;
}

export const GlossaryReviewerPanel: React.FC<GlossaryReviewerPanelProps> = ({
  onEntriesUpdated,
}) => {
  const [submissions, setSubmissions] = useState<GlossarySubmissionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<GlossaryAuditRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'needs_changes' | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edited, setEdited] = useState<GlossarySubmissionProposedEntry | null>(null);
  const [reviewerNote, setReviewerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiAssisting, setAiAssisting] = useState(false);
  const [aiDraftWarning, setAiDraftWarning] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, auditRes] = await Promise.all([
        fetchGlossarySubmissions({ status: statusFilter }),
        fetchGlossaryAuditLogs(),
      ]);
      setSubmissions(subRes.submissions || []);
      setAuditLogs(auditRes.logs || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load reviewer queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [statusFilter]);

  const activeSub = submissions.find((s) => s.submissionId === selectedId) || null;

  const selectSubmission = (sub: GlossarySubmissionRecord) => {
    setSelectedId(sub.submissionId);
    setEdited(JSON.parse(JSON.stringify(sub.proposedEntry)));
    setReviewerNote('');
    setAiDraftWarning(Boolean(sub.aiAssistedDraft));
    setError(null);
  };

  const handleReviewerAiDraftAssist = async () => {
    if (!edited) return;
    const seedTerm =
      edited.terms[edited.sourceLanguage].preferred ||
      edited.terms.en.preferred ||
      edited.terms.om.preferred ||
      edited.terms.am.preferred;
    if (!seedTerm) return;

    setAiAssisting(true);
    setError(null);
    try {
      const res = await lookupLegalTerm(seedTerm);
      setEdited((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          terms: {
            om: {
              ...prev.terms.om,
              preferred: prev.terms.om.preferred || res.om?.term || '',
            },
            am: {
              ...prev.terms.am,
              preferred: prev.terms.am.preferred || res.am?.term || '',
            },
            en: {
              ...prev.terms.en,
              preferred: prev.terms.en.preferred || res.en?.term || '',
            },
          },
          definitions: {
            om: prev.definitions.om || res.om?.definition || '',
            am: prev.definitions.am || res.am?.definition || '',
            en: prev.definitions.en || res.en?.definition || '',
          },
        };
      });
      setAiDraftWarning(true);
    } catch (err: any) {
      setError(err?.message || 'AI draft assist failed.');
    } finally {
      setAiAssisting(false);
    }
  };

  const handleDecision = async (decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT') => {
    if (!activeSub || !edited) return;
    if (!reviewerNote.trim()) {
      setError('A reviewerNote explaining the decision is mandatory.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reviewGlossarySubmissionApi({
        submissionId: activeSub.submissionId,
        decision,
        reviewerNote: reviewerNote.trim(),
        editedProposedEntry: edited,
      });
      setSelectedId(null);
      setEdited(null);
      setReviewerNote('');
      await loadQueue();
      onEntriesUpdated();
    } catch (err: any) {
      setError(err?.message || 'Review decision failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 space-y-5 shadow-xl text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Glossary Reviewer Queue & Audit Trail</span>
          </h3>
          <p className="text-slate-400">
            Verify sources, complete missing trilingual equivalents, and approve or return submissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(['pending', 'needs_changes', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
                statusFilter === st
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-950 border border-slate-800 text-slate-300'
              }`}
            >
              {st}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAudit((v) => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 font-bold cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit ({auditLogs.length})</span>
          </button>
          <button
            type="button"
            onClick={loadQueue}
            className="p-2 rounded-xl bg-slate-800 text-slate-200 cursor-pointer"
            aria-label="Refresh reviewer queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200">
          {error}
        </div>
      )}

      {showAudit ? (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {auditLogs.map((log) => (
            <div
              key={log.auditId}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2"
            >
              <div>
                <span className="font-mono font-bold text-amber-300 mr-2">{log.action}</span>
                <span className="text-slate-200">{log.reason}</span>
              </div>
              <div className="text-slate-400 font-mono">
                {log.actorEmail || log.actorUid} ({log.actorRole}) •{' '}
                {new Date(log.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Submission List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {submissions.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-center">
                No submissions in "{statusFilter}" queue.
              </div>
            ) : (
              submissions.map((sub) => {
                const headline =
                  sub.proposedEntry.terms[sub.proposedEntry.sourceLanguage].preferred ||
                  sub.proposedEntry.terms.en.preferred ||
                  sub.proposedEntry.terms.om.preferred ||
                  sub.submissionId;
                return (
                  <button
                    key={sub.submissionId}
                    type="button"
                    onClick={() => selectSubmission(sub)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                      selectedId === sub.submissionId
                        ? 'bg-amber-500/15 border-amber-500 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{headline}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                        {sub.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {sub.submissionType} • {sub.proposedEntry.domain} • By {sub.submittedByEmail || sub.submittedBy}
                    </div>
                    {sub.incompleteLanguages.length > 0 && (
                      <div className="text-[10px] text-rose-300 font-bold">
                        Incomplete: {sub.incompleteLanguages.join(', ')}
                      </div>
                    )}
                    {sub.aiAssistedDraft && (
                      <div className="text-[10px] text-amber-300 font-bold">AI draft — unverified</div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Active Submission Reviewer Workbench */}
          <div className="lg:col-span-2 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
            {!activeSub || !edited ? (
              <div className="py-12 text-center text-slate-400">
                Select a pending or needs_changes submission on the left to review or complete missing languages.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="font-mono text-amber-300 font-bold">
                      {activeSub.submissionId}
                    </span>
                    <span className="text-slate-400 ml-2">
                      ({activeSub.submissionType}
                      {activeSub.targetTermId ? ` -> ${activeSub.targetTermId}` : ''})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReviewerAiDraftAssist}
                    disabled={aiAssisting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {aiAssisting ? 'Drafting...' : 'Fill Missing via AI Draft (Unverified)'}
                    </span>
                  </button>
                </div>

                {aiDraftWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200">
                    <strong>AI draft — unverified:</strong> Carefully verify any AI-generated translation against Ethiopian statutes before clicking Approve & Publish.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(['om', 'am', 'en'] as const).map((lang) => (
                    <div key={lang} className="space-y-2 p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="font-bold text-amber-400 uppercase">{lang}</div>
                      <input
                        type="text"
                        value={edited.terms[lang].preferred}
                        onChange={(e) =>
                          setEdited({
                            ...edited,
                            terms: {
                              ...edited.terms,
                              [lang]: { ...edited.terms[lang], preferred: e.target.value },
                            },
                          })
                        }
                        placeholder={`Preferred term (${lang})`}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                      />
                      <textarea
                        rows={3}
                        value={edited.definitions[lang]}
                        onChange={(e) =>
                          setEdited({
                            ...edited,
                            definitions: { ...edited.definitions, [lang]: e.target.value },
                          })
                        }
                        placeholder={`Definition (${lang})`}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100"
                      />
                    </div>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={reviewerNote}
                  onChange={(e) => setReviewerNote(e.target.value)}
                  placeholder="Mandatory reviewer note / verification citation note..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                />

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDecision('REJECT')}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-bold cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDecision('REQUEST_CHANGES')}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Request Changes</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDecision('APPROVE')}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve & Publish</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
