import React, { useEffect, useState } from 'react';
import { X, History, ExternalLink, Edit3, Archive, ShieldCheck, AlertCircle } from 'lucide-react';
import type { Language } from '../i18n/translations';
import {
  GLOSSARY_DOMAINS,
  GlossaryEntryRecord,
  GlossaryEntryVersionRecord,
  GlossaryLanguage,
} from '../shared/legalGlossarySchema';
import { archiveGlossaryEntryApi, fetchGlossaryEntryDetail } from '../services/glossaryApi';

interface GlossaryEntryDetailModalProps {
  termId: string | null;
  currentLang: Language;
  primaryLang: GlossaryLanguage;
  canSubmit: boolean;
  canReview: boolean;
  onClose: () => void;
  onSuggestCorrection: (entry: GlossaryEntryRecord) => void;
  onArchived: () => void;
}

export const GlossaryEntryDetailModal: React.FC<GlossaryEntryDetailModalProps> = ({
  termId,
  currentLang,
  primaryLang,
  canSubmit,
  canReview,
  onClose,
  onSuggestCorrection,
  onArchived,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<GlossaryEntryRecord | null>(null);
  const [versions, setVersions] = useState<GlossaryEntryVersionRecord[]>([]);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!termId) {
      setEntry(null);
      setVersions([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetchGlossaryEntryDetail(termId)
      .then((res) => {
        if (!active) return;
        setEntry(res.entry);
        setVersions(res.versions || []);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message || 'Failed to load term details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [termId]);

  if (!termId) return null;

  const orderedLanguages: GlossaryLanguage[] = [
    primaryLang,
    ...(['om', 'am', 'en'] as GlossaryLanguage[]).filter((l) => l !== primaryLang),
  ];

  const langLabel: Record<GlossaryLanguage, string> = {
    om: 'Afaan Oromoo',
    am: 'አማርኛ',
    en: 'English',
  };

  const handleArchive = async () => {
    if (!entry || !archiveReason.trim()) return;
    setArchiving(true);
    setError(null);
    try {
      await archiveGlossaryEntryApi(entry.termId, archiveReason.trim());
      setArchiveReason('');
      onArchived();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive glossary entry.');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-serif-legal font-bold text-slate-100">
              {entry ? entry.terms[primaryLang].preferred : 'Glossary Entry Detail'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            aria-label="Close detail"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-xs">
          {loading && <div className="text-slate-400 py-8 text-center">Loading verified term details...</div>}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {entry && (
            <>
              {/* Identity & Classification */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
                    {GLOSSARY_DOMAINS.find((d) => d.id === entry.domain)?.labels[currentLang] ||
                      entry.domain}
                  </span>
                  {entry.jurisdiction.map((j) => (
                    <span
                      key={j}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-semibold"
                    >
                      {j}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    v{entry.version} • {entry.status}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  ID: {entry.termId} • Concept: {entry.conceptId}
                </div>
              </div>

              {/* Trilingual Definitions & Synonyms (ordered with primaryLang first) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {orderedLanguages.map((lang) => {
                  const termBlock = entry.terms[lang];
                  const noExact = entry.noExactEquivalent?.[lang];
                  const transNote = entry.translationNotes?.[lang];
                  return (
                    <div
                      key={lang}
                      className={`p-4 rounded-2xl border space-y-2.5 ${
                        lang === primaryLang
                          ? 'bg-slate-950 border-amber-500/40'
                          : 'bg-slate-950/60 border-slate-800'
                      } ${lang === 'am' ? 'font-ethiopic' : ''}`}
                    >
                      <div className="flex items-center justify-between font-sans">
                        <span className="text-[11px] font-bold text-amber-400 uppercase">
                          {langLabel[lang]}
                        </span>
                        {lang === primaryLang && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-slate-100">{termBlock.preferred}</div>

                      {termBlock.synonyms.length > 0 && (
                        <div className="flex flex-wrap gap-1 font-sans">
                          {termBlock.synonyms.map((syn) => (
                            <span
                              key={syn}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              ≈ {syn}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-slate-300 leading-relaxed">{entry.definitions[lang]}</p>

                      {entry.usageNotes?.[lang] && (
                        <p className="text-[11px] text-slate-400 italic border-t border-slate-800/80 pt-2">
                          {entry.usageNotes[lang]}
                        </p>
                      )}

                      {(noExact || transNote) && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 font-sans">
                          {noExact && <div className="font-bold">No exact equivalent</div>}
                          {transNote && <div>{transNote}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Structured Source References */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-slate-200">Verified Source References</h3>
                {entry.sourceReferences?.length > 0 ? (
                  <ul className="space-y-2">
                    {entry.sourceReferences.map((ref, idx) => (
                      <li
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800"
                      >
                        <div>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 mr-2">
                            {ref.sourceType}
                          </span>
                          <span className="font-semibold text-slate-100">{ref.title}</span>
                          {(ref.identifier || ref.articleOrSection || ref.volume || ref.page) && (
                            <span className="text-slate-400 ml-2">
                              {[ref.identifier, ref.articleOrSection, ref.volume, ref.page]
                                .filter(Boolean)
                                .join(' • ')}
                            </span>
                          )}
                        </div>
                        {ref.url && (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold"
                          >
                            <span>Source Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">
                    {entry.isGeneralLegalDefinition
                      ? 'General doctrinal legal definition verified by editorial reviewer.'
                      : entry.noSourceJustification || 'Verified editorial baseline.'}
                  </p>
                )}
              </div>

              {/* Previous Approved Version History */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-slate-200">
                  <History className="w-4 h-4 text-amber-400" />
                  <span>Previous Approved Versions ({versions.length})</span>
                </div>
                {versions.length === 0 ? (
                  <p className="text-slate-400">No prior revisions archived yet (current version v{entry.version}).</p>
                ) : (
                  <div className="space-y-2">
                    {versions.map((v) => (
                      <div
                        key={v.versionId}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-amber-300">
                            Version v{v.version}
                          </span>
                          <span className="text-slate-400">
                            Archived {new Date(v.archivedAt).toLocaleString()} by {v.archivedBy}
                          </span>
                        </div>
                        <div className="text-slate-300">
                          {v.snapshot.terms.om.preferred} • {v.snapshot.terms.am.preferred} •{' '}
                          {v.snapshot.terms.en.preferred}
                        </div>
                        <div className="text-slate-400 italic">Reason: {v.changeReason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                {canReview && entry.status === 'approved' ? (
                  <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                    <input
                      type="text"
                      value={archiveReason}
                      onChange={(e) => setArchiveReason(e.target.value)}
                      placeholder="Archive reason (reviewer/admin)..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={archiving || !archiveReason.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-bold cursor-pointer disabled:opacity-50"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archive</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-slate-400">
                    Reviewed by <span className="font-mono">{entry.reviewedBy}</span>
                  </div>
                )}

                {canSubmit && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSuggestCorrection(entry);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Suggest Correction</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
