import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertTriangle, CheckCircle2, Send, Sparkles } from 'lucide-react';
import type { Language } from '../i18n/translations';
import {
  GLOSSARY_DOMAINS,
  GLOSSARY_JURISDICTIONS,
  GlossaryDomain,
  GlossaryEntryRecord,
  GlossaryLanguage,
  GlossarySourceReference,
  GlossarySubmissionProposedEntry,
  SourceReferenceType,
} from '../shared/legalGlossarySchema';
import { submitGlossaryTermOrRevision } from '../services/glossaryApi';

interface GlossarySubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang: Language;
  revisionTarget?: GlossaryEntryRecord | null;
  aiDraftPrefill?: {
    sourceLanguage: GlossaryLanguage;
    om?: { term: string; definition: string; usage?: string };
    am?: { term: string; definition: string; usage?: string };
    en?: { term: string; definition: string; usage?: string };
    primaryProclamationOrCode?: string;
  } | null;
  onSubmitted: () => void;
}

const SOURCE_TYPES: Array<{ value: SourceReferenceType; label: string }> = [
  { value: 'constitution', label: 'Constitution' },
  { value: 'proclamation', label: 'Proclamation' },
  { value: 'regulation', label: 'Regulation' },
  { value: 'directive', label: 'Directive' },
  { value: 'code', label: 'Legal Code' },
  { value: 'cassation_decision', label: 'Cassation Decision' },
  { value: 'court_decision', label: 'Court Decision' },
  { value: 'official_dictionary', label: 'Official Dictionary' },
  { value: 'publication', label: 'Legal Publication' },
  { value: 'other', label: 'Other' },
];

export const GlossarySubmissionModal: React.FC<GlossarySubmissionModalProps> = ({
  isOpen,
  onClose,
  currentLang,
  revisionTarget,
  aiDraftPrefill,
  onSubmitted,
}) => {
  const [sourceLanguage, setSourceLanguage] = useState<GlossaryLanguage>(currentLang);
  const [domain, setDomain] = useState<GlossaryDomain>('civil');
  const [jurisdiction, setJurisdiction] = useState<string[]>(['Federal Ethiopia']);

  const [omTerm, setOmTerm] = useState('');
  const [omSynonyms, setOmSynonyms] = useState('');
  const [omDef, setOmDef] = useState('');
  const [omUsage, setOmUsage] = useState('');
  const [omNoExact, setOmNoExact] = useState(false);
  const [omTransNote, setOmTransNote] = useState('');

  const [amTerm, setAmTerm] = useState('');
  const [amSynonyms, setAmSynonyms] = useState('');
  const [amDef, setAmDef] = useState('');
  const [amUsage, setAmUsage] = useState('');
  const [amNoExact, setAmNoExact] = useState(false);
  const [amTransNote, setAmTransNote] = useState('');

  const [enTerm, setEnTerm] = useState('');
  const [enSynonyms, setEnSynonyms] = useState('');
  const [enDef, setEnDef] = useState('');
  const [enUsage, setEnUsage] = useState('');
  const [enNoExact, setEnNoExact] = useState(false);
  const [enTransNote, setEnTransNote] = useState('');

  const [sourceReferences, setSourceReferences] = useState<GlossarySourceReference[]>([]);
  const [isGeneralLegalDefinition, setIsGeneralLegalDefinition] = useState(false);
  const [noSourceJustification, setNoSourceJustification] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (revisionTarget) {
      setSourceLanguage(currentLang);
      setDomain(revisionTarget.domain);
      setJurisdiction(
        revisionTarget.jurisdiction?.length ? revisionTarget.jurisdiction : ['Federal Ethiopia']
      );
      setOmTerm(revisionTarget.terms.om.preferred);
      setOmSynonyms(revisionTarget.terms.om.synonyms.join(', '));
      setOmDef(revisionTarget.definitions.om);
      setOmUsage(revisionTarget.usageNotes?.om || '');
      setOmNoExact(Boolean(revisionTarget.noExactEquivalent?.om));
      setOmTransNote(revisionTarget.translationNotes?.om || '');

      setAmTerm(revisionTarget.terms.am.preferred);
      setAmSynonyms(revisionTarget.terms.am.synonyms.join(', '));
      setAmDef(revisionTarget.definitions.am);
      setAmUsage(revisionTarget.usageNotes?.am || '');
      setAmNoExact(Boolean(revisionTarget.noExactEquivalent?.am));
      setAmTransNote(revisionTarget.translationNotes?.am || '');

      setEnTerm(revisionTarget.terms.en.preferred);
      setEnSynonyms(revisionTarget.terms.en.synonyms.join(', '));
      setEnDef(revisionTarget.definitions.en);
      setEnUsage(revisionTarget.usageNotes?.en || '');
      setEnNoExact(Boolean(revisionTarget.noExactEquivalent?.en));
      setEnTransNote(revisionTarget.translationNotes?.en || '');

      setSourceReferences(revisionTarget.sourceReferences || []);
      setIsGeneralLegalDefinition(Boolean(revisionTarget.isGeneralLegalDefinition));
      setNoSourceJustification(revisionTarget.noSourceJustification || '');
    } else if (aiDraftPrefill) {
      setSourceLanguage(aiDraftPrefill.sourceLanguage || currentLang);
      setDomain('other');
      setJurisdiction(['Federal Ethiopia']);
      setOmTerm(aiDraftPrefill.om?.term || '');
      setOmSynonyms('');
      setOmDef(aiDraftPrefill.om?.definition || '');
      setOmUsage(aiDraftPrefill.om?.usage || '');
      setOmNoExact(false);
      setOmTransNote('');

      setAmTerm(aiDraftPrefill.am?.term || '');
      setAmSynonyms('');
      setAmDef(aiDraftPrefill.am?.definition || '');
      setAmUsage(aiDraftPrefill.am?.usage || '');
      setAmNoExact(false);
      setAmTransNote('');

      setEnTerm(aiDraftPrefill.en?.term || '');
      setEnSynonyms('');
      setEnDef(aiDraftPrefill.en?.definition || '');
      setEnUsage(aiDraftPrefill.en?.usage || '');
      setAmNoExact(false);
      setEnNoExact(false);
      setEnTransNote('');

      setSourceReferences(
        aiDraftPrefill.primaryProclamationOrCode
          ? [
              {
                sourceType: 'other',
                title: aiDraftPrefill.primaryProclamationOrCode,
              },
            ]
          : []
      );
      setIsGeneralLegalDefinition(false);
      setNoSourceJustification('');
    } else {
      setSourceLanguage(currentLang);
      setDomain('civil');
      setJurisdiction(['Federal Ethiopia']);
      setOmTerm('');
      setOmSynonyms('');
      setOmDef('');
      setOmUsage('');
      setOmNoExact(false);
      setOmTransNote('');
      setAmTerm('');
      setAmSynonyms('');
      setAmDef('');
      setAmUsage('');
      setAmNoExact(false);
      setAmTransNote('');
      setEnTerm('');
      setEnSynonyms('');
      setEnDef('');
      setEnUsage('');
      setEnNoExact(false);
      setEnTransNote('');
      setSourceReferences([]);
      setIsGeneralLegalDefinition(false);
      setNoSourceJustification('');
    }
  }, [isOpen, revisionTarget, aiDraftPrefill, currentLang]);

  if (!isOpen) return null;

  const parseSynonyms = (raw: string): string[] =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const toggleJurisdiction = (j: string) => {
    setJurisdiction((prev) =>
      prev.includes(j) ? prev.filter((item) => item !== j) : [...prev, j]
    );
  };

  const addSourceReference = () => {
    setSourceReferences((prev) => [
      ...prev,
      { sourceType: 'proclamation', title: '', identifier: '', articleOrSection: '', url: '' },
    ]);
  };

  const updateSourceRef = (idx: number, patch: Partial<GlossarySourceReference>) => {
    setSourceReferences((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const removeSourceRef = (idx: number) => {
    setSourceReferences((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (jurisdiction.length === 0) {
      setErrorMsg('Please select at least one jurisdiction.');
      return;
    }

    const cleanRefs = sourceReferences.filter((r) => r.title.trim().length > 0);
    const proposedEntry: GlossarySubmissionProposedEntry = {
      sourceLanguage,
      terms: {
        om: { preferred: omTerm.trim(), synonyms: parseSynonyms(omSynonyms) },
        am: { preferred: amTerm.trim(), synonyms: parseSynonyms(amSynonyms) },
        en: { preferred: enTerm.trim(), synonyms: parseSynonyms(enSynonyms) },
      },
      definitions: {
        om: omDef.trim(),
        am: amDef.trim(),
        en: enDef.trim(),
      },
      usageNotes: {
        ...(omUsage.trim() ? { om: omUsage.trim() } : {}),
        ...(amUsage.trim() ? { am: amUsage.trim() } : {}),
        ...(enUsage.trim() ? { en: enUsage.trim() } : {}),
      },
      translationNotes: {
        ...(omTransNote.trim() ? { om: omTransNote.trim() } : {}),
        ...(amTransNote.trim() ? { am: amTransNote.trim() } : {}),
        ...(enTransNote.trim() ? { en: enTransNote.trim() } : {}),
      },
      noExactEquivalent: {
        om: omNoExact,
        am: amNoExact,
        en: enNoExact,
      },
      domain,
      jurisdiction,
      sourceReferences: cleanRefs,
      isGeneralLegalDefinition,
      ...(noSourceJustification.trim()
        ? { noSourceJustification: noSourceJustification.trim() }
        : {}),
    };

    setSubmitting(true);
    try {
      const res = await submitGlossaryTermOrRevision({
        submissionType: revisionTarget ? 'revision' : 'new_term',
        ...(revisionTarget ? { targetTermId: revisionTarget.termId } : {}),
        aiAssistedDraft: Boolean(aiDraftPrefill),
        proposedEntry,
      });
      setSuccessMsg(
        res.submission.incompleteLanguages.length > 0
          ? `Submitted for pending review (ID: ${res.submission.submissionId}). Missing languages (${res.submission.incompleteLanguages.join(', ')}) were marked incomplete for reviewer completion.`
          : `Submitted for pending legal reviewer approval (ID: ${res.submission.submissionId}).`
      );
      onSubmitted();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-serif-legal font-bold text-slate-100">
              {revisionTarget
                ? `Suggest Correction: ${revisionTarget.terms[currentLang].preferred}`
                : 'Propose New Legal Glossary Term'}
            </h2>
            <p className="text-xs text-slate-400">
              All proposals enter a pending human review queue. Incomplete languages may be left blank for reviewer completion.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {aiDraftPrefill && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>AI draft — unverified:</strong> Review and verify every term, definition, and statute reference before submitting. AI drafts never auto-publish.
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Metadata Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Primary Source Language *</label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value as GlossaryLanguage)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              >
                <option value="om">Afaan Oromoo (om)</option>
                <option value="am">አማርኛ (am)</option>
                <option value="en">English (en)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Legal Domain *</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as GlossaryDomain)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              >
                {GLOSSARY_DOMAINS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.labels[currentLang] || d.labels.en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1.5">Jurisdiction *</label>
              <div className="flex flex-wrap gap-1.5">
                {GLOSSARY_JURISDICTIONS.map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => toggleJurisdiction(j)}
                    className={`px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer ${
                      jurisdiction.includes(j)
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trilingual Language Input Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Afaan Oromoo */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 uppercase">Afaan Oromoo (om)</span>
                {sourceLanguage === 'om' && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Required
                  </span>
                )}
              </div>
              <input
                type="text"
                value={omTerm}
                onChange={(e) => setOmTerm(e.target.value)}
                required={sourceLanguage === 'om'}
                placeholder="Preferred term (om)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <input
                type="text"
                value={omSynonyms}
                onChange={(e) => setOmSynonyms(e.target.value)}
                placeholder="Approved synonyms (comma-separated)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <textarea
                rows={3}
                value={omDef}
                onChange={(e) => setOmDef(e.target.value)}
                required={sourceLanguage === 'om'}
                placeholder="Legal definition (om)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <input
                type="text"
                value={omUsage}
                onChange={(e) => setOmUsage(e.target.value)}
                placeholder="Usage example (optional)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={omNoExact}
                  onChange={(e) => setOmNoExact(e.target.checked)}
                />
                <span>No exact equivalent in Afaan Oromoo</span>
              </label>
              {omNoExact && (
                <input
                  type="text"
                  value={omTransNote}
                  onChange={(e) => setOmTransNote(e.target.value)}
                  placeholder="Translation equivalence note"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                />
              )}
            </div>

            {/* Amharic */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 font-ethiopic">
              <div className="flex items-center justify-between font-sans">
                <span className="font-bold text-amber-400 uppercase">አማርኛ (am)</span>
                {sourceLanguage === 'am' && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Required
                  </span>
                )}
              </div>
              <input
                type="text"
                value={amTerm}
                onChange={(e) => setAmTerm(e.target.value)}
                required={sourceLanguage === 'am'}
                placeholder="ተመራጭ ቃል (am)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <input
                type="text"
                value={amSynonyms}
                onChange={(e) => setAmSynonyms(e.target.value)}
                placeholder="ተመሳሳይ ቃላት (በኮማ ይለዩ)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <textarea
                rows={3}
                value={amDef}
                onChange={(e) => setAmDef(e.target.value)}
                required={sourceLanguage === 'am'}
                placeholder="የሕግ ትርጉም (am)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <input
                type="text"
                value={amUsage}
                onChange={(e) => setAmUsage(e.target.value)}
                placeholder="የአጠቃቀም ምሳሌ (optional)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer font-sans">
                <input
                  type="checkbox"
                  checked={amNoExact}
                  onChange={(e) => setAmNoExact(e.target.checked)}
                />
                <span>No exact equivalent in Amharic</span>
              </label>
              {amNoExact && (
                <input
                  type="text"
                  value={amTransNote}
                  onChange={(e) => setAmTransNote(e.target.value)}
                  placeholder="Translation equivalence note"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                />
              )}
            </div>

            {/* English */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 uppercase">English (en)</span>
                {sourceLanguage === 'en' && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Required
                  </span>
                )}
              </div>
              <input
                type="text"
                value={enTerm}
                onChange={(e) => setEnTerm(e.target.value)}
                required={sourceLanguage === 'en'}
                placeholder="Preferred term (en)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <input
                type="text"
                value={enSynonyms}
                onChange={(e) => setEnSynonyms(e.target.value)}
                placeholder="Approved synonyms (comma-separated)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <textarea
                rows={3}
                value={enDef}
                onChange={(e) => setEnDef(e.target.value)}
                required={sourceLanguage === 'en'}
                placeholder="Legal definition (en)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <input
                type="text"
                value={enUsage}
                onChange={(e) => setEnUsage(e.target.value)}
                placeholder="Usage example (optional)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
              />
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enNoExact}
                  onChange={(e) => setEnNoExact(e.target.checked)}
                />
                <span>No exact equivalent in English</span>
              </label>
              {enNoExact && (
                <input
                  type="text"
                  value={enTransNote}
                  onChange={(e) => setEnTransNote(e.target.value)}
                  placeholder="Translation equivalence note"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                />
              )}
            </div>
          </div>

          {/* Structured Source References */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Structured Legal Source References</span>
              <button
                type="button"
                onClick={addSourceReference}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Source</span>
              </button>
            </div>

            {sourceReferences.map((ref, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center bg-slate-900 p-3 rounded-xl border border-slate-800"
              >
                <select
                  value={ref.sourceType}
                  onChange={(e) =>
                    updateSourceRef(idx, { sourceType: e.target.value as SourceReferenceType })
                  }
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
                >
                  {SOURCE_TYPES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={ref.title}
                  onChange={(e) => updateSourceRef(idx, { title: e.target.value })}
                  placeholder="Statute / Case Title *"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
                />
                <input
                  type="text"
                  value={ref.identifier || ''}
                  onChange={(e) => updateSourceRef(idx, { identifier: e.target.value })}
                  placeholder="Proc. / File No."
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
                />
                <input
                  type="text"
                  value={ref.articleOrSection || ''}
                  onChange={(e) => updateSourceRef(idx, { articleOrSection: e.target.value })}
                  placeholder="Article / Vol. / Page"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="url"
                    value={ref.url || ''}
                    onChange={(e) => updateSourceRef(idx, { url: e.target.value })}
                    placeholder="https://... (optional)"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeSourceRef(idx)}
                    className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 cursor-pointer"
                    aria-label="Remove source"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGeneralLegalDefinition}
                  onChange={(e) => setIsGeneralLegalDefinition(e.target.checked)}
                />
                <span>General doctrinal legal definition (no single statute)</span>
              </label>
              <input
                type="text"
                value={noSourceJustification}
                onChange={(e) => setNoSourceJustification(e.target.value)}
                placeholder="Or provide justification if citing without URL/statute..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit for Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
