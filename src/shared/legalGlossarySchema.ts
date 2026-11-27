export type GlossaryLanguage = 'om' | 'am' | 'en';

export type GlossaryEntryType = 'legal_term' | 'court_name' | 'document_type';

export const GLOSSARY_ENTRY_TYPES: Array<{
  id: GlossaryEntryType;
  labels: Record<GlossaryLanguage, string>;
}> = [
  {
    id: 'legal_term',
    labels: { om: 'Jechoota Seeraa', am: 'የሕግ ቃላት', en: 'Key Legal Terms' },
  },
  {
    id: 'court_name',
    labels: { om: 'Maqaalee Mana Murtii', am: 'የፍርድ ቤት ስሞች', en: 'Court Names' },
  },
  {
    id: 'document_type',
    labels: { om: 'Gosoota Sanada Seeraa', am: 'የሕግ ሰነድ ዓይነቶች', en: 'Document Types' },
  },
];

export type GlossaryDomain =
  | 'constitutional'
  | 'civil'
  | 'civil_procedure'
  | 'criminal'
  | 'criminal_procedure'
  | 'evidence'
  | 'family'
  | 'land'
  | 'labour'
  | 'commercial'
  | 'administrative'
  | 'other';

export const GLOSSARY_DOMAINS: Array<{
  id: GlossaryDomain;
  labels: Record<GlossaryLanguage, string>;
}> = [
  {
    id: 'constitutional',
    labels: { om: 'Seera Heeraa', am: 'ሕገ-መንግሥታዊ ሕግ', en: 'Constitutional Law' },
  },
  {
    id: 'civil',
    labels: { om: 'Seera Hariiroo Hawaasaa', am: 'ፍትሐ ብሔር ሕግ', en: 'Civil Law' },
  },
  {
    id: 'civil_procedure',
    labels: { om: 'Adeemsa Falmii Hariiroo Hawaasaa', am: 'የፍትሐ ብሔር ሥነ-ሥርዓት', en: 'Civil Procedure' },
  },
  {
    id: 'criminal',
    labels: { om: 'Seera Yakkaa', am: 'የወንጀል ሕግ', en: 'Criminal Law' },
  },
  {
    id: 'criminal_procedure',
    labels: { om: 'Adeemsa Falmii Yakkaa', am: 'የወንጀል ሥነ-ሥርዓት', en: 'Criminal Procedure' },
  },
  {
    id: 'evidence',
    labels: { om: 'Seera Ragaa', am: 'የማስረጃ ሕግ', en: 'Evidence' },
  },
  {
    id: 'family',
    labels: { om: 'Seera Maatii', am: 'የቤተሰብ ሕግ', en: 'Family Law' },
  },
  {
    id: 'land',
    labels: { om: 'Seera Lafaa fi Qabeenyaa', am: 'የመሬትና ንብረት ሕግ', en: 'Land & Property Law' },
  },
  {
    id: 'labour',
    labels: { om: 'Seera Hojjetaa fi Hojjechiisaa', am: 'የአሠሪና ሠራተኛ ሕግ', en: 'Labour Law' },
  },
  {
    id: 'commercial',
    labels: { om: 'Seera Daldalaa', am: 'የንግድ ሕግ', en: 'Commercial Law' },
  },
  {
    id: 'administrative',
    labels: { om: 'Seera Bulchiinsaa', am: 'የአስተዳደር ሕግ', en: 'Administrative Law' },
  },
  {
    id: 'other',
    labels: { om: 'Kan Biraa', am: 'ሌላ', en: 'Other' },
  },
];

export const GLOSSARY_JURISDICTIONS = [
  'Federal Ethiopia',
  'Oromia',
  'Other',
] as const;

export type GlossaryJurisdiction = (typeof GLOSSARY_JURISDICTIONS)[number];

export type SourceReferenceType =
  | 'constitution'
  | 'proclamation'
  | 'regulation'
  | 'directive'
  | 'code'
  | 'cassation_decision'
  | 'court_decision'
  | 'official_dictionary'
  | 'publication'
  | 'other';

export interface GlossarySourceReference {
  sourceType: SourceReferenceType;
  title: string;
  issuingBody?: string;
  identifier?: string;
  articleOrSection?: string;
  volume?: string;
  page?: string;
  publicationDate?: string;
  documentId?: string;
  url?: string;
}

export interface GlossaryLanguageTermBlock {
  preferred: string;
  synonyms: string[];
  discouragedSynonyms?: string[];
}

export interface GlossaryEntryRecord {
  termId: string;
  conceptId: string;
  entryType?: GlossaryEntryType;
  terms: {
    om: GlossaryLanguageTermBlock;
    am: GlossaryLanguageTermBlock;
    en: GlossaryLanguageTermBlock;
  };
  definitions: {
    om: string;
    am: string;
    en: string;
  };
  usageNotes: {
    om?: string;
    am?: string;
    en?: string;
  };
  translationNotes?: {
    om?: string;
    am?: string;
    en?: string;
  };
  noExactEquivalent?: {
    om?: boolean;
    am?: boolean;
    en?: boolean;
  };
  domain: GlossaryDomain;
  jurisdiction: string[];
  sourceReferences: GlossarySourceReference[];
  isGeneralLegalDefinition?: boolean;
  noSourceJustification?: string;
  status: 'approved' | 'archived';
  version: number;
  searchTokens: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  reviewedAt: string;
  reviewedBy: string;
}

export interface GlossaryEntryVersionRecord {
  versionId: string;
  termId: string;
  version: number;
  snapshot: Omit<GlossaryEntryRecord, 'searchTokens'>;
  archivedAt: string;
  archivedBy: string;
  changeReason: string;
  submissionId?: string;
}

export type GlossarySubmissionStatus = 'pending' | 'needs_changes' | 'approved' | 'rejected';

export interface GlossarySubmissionProposedEntry {
  sourceLanguage: GlossaryLanguage;
  entryType?: GlossaryEntryType;
  terms: {
    om: { preferred: string; synonyms: string[]; discouragedSynonyms?: string[] };
    am: { preferred: string; synonyms: string[]; discouragedSynonyms?: string[] };
    en: { preferred: string; synonyms: string[]; discouragedSynonyms?: string[] };
  };
  definitions: {
    om: string;
    am: string;
    en: string;
  };
  usageNotes?: {
    om?: string;
    am?: string;
    en?: string;
  };
  translationNotes?: {
    om?: string;
    am?: string;
    en?: string;
  };
  noExactEquivalent?: {
    om?: boolean;
    am?: boolean;
    en?: boolean;
  };
  domain: GlossaryDomain;
  jurisdiction: string[];
  sourceReferences: GlossarySourceReference[];
  isGeneralLegalDefinition?: boolean;
  noSourceJustification?: string;
}

export interface GlossarySubmissionRecord {
  submissionId: string;
  submissionType: 'new_term' | 'revision';
  targetTermId?: string;
  proposedEntry: GlossarySubmissionProposedEntry;
  incompleteLanguages: GlossaryLanguage[];
  aiAssistedDraft?: boolean;
  status: GlossarySubmissionStatus;
  submittedBy: string;
  submittedByEmail?: string;
  submittedByName?: string;
  institutionId?: string;
  submittedAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerNote?: string;
  reason?: string;
}

export interface GlossaryAuditRecord {
  auditId: string;
  action:
    | 'TERM_SUBMITTED'
    | 'REVISION_SUBMITTED'
    | 'SUBMISSION_APPROVED'
    | 'SUBMISSION_REJECTED'
    | 'SUBMISSION_NEEDS_CHANGES'
    | 'ENTRY_UPDATED'
    | 'ENTRY_ARCHIVED'
    | 'AI_DRAFT_GENERATED';
  termId?: string;
  submissionId?: string;
  actorUid: string;
  actorRole: string;
  actorEmail?: string;
  previousVersion?: number;
  newVersion?: number;
  changedFields?: string[];
  decision?: string;
  reason: string;
  timestamp: string;
}

export const GLOSSARY_MAX_LENGTHS = {
  term: 200,
  synonym: 160,
  synonymsPerLanguage: 12,
  discouragedSynonymsPerLanguage: 12,
  definition: 2500,
  usageNote: 1200,
  translationNote: 1000,
  sourceTitle: 300,
  sourceField: 180,
  url: 600,
  reviewerNote: 1500,
  maxSourceReferences: 10,
} as const;

/**
 * Unicode NFC normalization for Afaan Oromoo, Amharic, and English search matching.
 * Preserves all Ethiopic characters/diacritics and avoids lossy transliteration or
 * crude fixed-length stemming that could conflate distinct legal concepts.
 */
export function normalizeGlossaryText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .normalize('NFC')
    .replace(/[’‘`]/g, "'")
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}'\-./\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function tokenizeGlossaryText(input: string): string[] {
  const norm = normalizeGlossaryText(input);
  if (!norm) return [];
  const words = norm
    .split(/[\s,/]+/)
    .map((w) => w.replace(/^['.\-]+|['.\-]+$/g, ''))
    .filter((w) => w.length >= 2);
  return Array.from(new Set(words));
}

export function buildGlossarySearchTokens(
  entry: Pick<GlossaryEntryRecord, 'terms' | 'definitions' | 'usageNotes' | 'domain' | 'jurisdiction'>
): string[] {
  const tokens = new Set<string>();
  const langs: GlossaryLanguage[] = ['om', 'am', 'en'];

  for (const lang of langs) {
    const preferred = entry.terms?.[lang]?.preferred || '';
    const normPreferred = normalizeGlossaryText(preferred);
    if (normPreferred) tokens.add(normPreferred);
    for (const w of tokenizeGlossaryText(preferred)) tokens.add(w);

    for (const syn of entry.terms?.[lang]?.synonyms || []) {
      const normSyn = normalizeGlossaryText(syn);
      if (normSyn) tokens.add(normSyn);
      for (const w of tokenizeGlossaryText(syn)) tokens.add(w);
    }

    for (const disc of entry.terms?.[lang]?.discouragedSynonyms || []) {
      const normDisc = normalizeGlossaryText(disc);
      if (normDisc) tokens.add(normDisc);
      for (const w of tokenizeGlossaryText(disc)) tokens.add(w);
    }

    const def = entry.definitions?.[lang] || '';
    for (const w of tokenizeGlossaryText(def)) {
      if (tokens.size < 220) tokens.add(w);
    }
  }

  return Array.from(tokens).slice(0, 220);
}

export interface GlossaryMatchReason {
  language: GlossaryLanguage;
  field: 'preferred' | 'synonym' | 'discouraged_synonym' | 'definition' | 'usage';
  matchedText: string;
}

export interface RankedGlossaryResult {
  entry: GlossaryEntryRecord;
  score: number;
  matchReasons: GlossaryMatchReason[];
}

export interface GlossarySearchQueryOptions {
  query?: string;
  entryType?: GlossaryEntryType | 'all';
  domain?: GlossaryDomain | 'all';
  jurisdiction?: string;
  status?: 'approved' | 'archived' | 'all';
  page?: number;
  pageSize?: number;
}

export interface GlossarySearchResponsePayload {
  items: RankedGlossaryResult[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  searchMethod: string;
  searchLimitations: string;
}

/**
 * Deterministic, Unicode-NFC-safe trilingual search & ranking engine.
 * Ranking tiers:
 *   1. Exact preferred term match (+120) or preferred term phrase/word match (+85)
 *   2. Exact synonym match (+65) or synonym phrase/word match (+48)
 *   3. Informal/discouraged synonym match (+35 / +28) — steers user/AI to official term
 *   4. Definition (+22) or usage-note (+15) match
 */
export function searchAndRankGlossaryEntries(
  entries: GlossaryEntryRecord[],
  options: GlossarySearchQueryOptions
): GlossarySearchResponsePayload {
  const {
    query = '',
    entryType = 'all',
    domain = 'all',
    jurisdiction = 'all',
    status = 'approved',
    page = 1,
    pageSize = 20,
  } = options;

  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));

  const normQuery = normalizeGlossaryText(query);
  const queryWords = tokenizeGlossaryText(query);

  const filtered = entries.filter((entry) => {
    if (status !== 'all' && entry.status !== status) return false;
    if (entryType !== 'all' && (entry.entryType || 'legal_term') !== entryType) return false;
    if (domain !== 'all' && entry.domain !== domain) return false;
    if (jurisdiction && jurisdiction !== 'all') {
      const hasJurisdiction = (entry.jurisdiction || []).some(
        (j) => normalizeGlossaryText(j) === normalizeGlossaryText(jurisdiction)
      );
      if (!hasJurisdiction) return false;
    }
    return true;
  });

  const ranked: RankedGlossaryResult[] = [];
  const langs: GlossaryLanguage[] = ['om', 'am', 'en'];

  for (const entry of filtered) {
    if (!normQuery) {
      ranked.push({
        entry,
        score: 0,
        matchReasons: [],
      });
      continue;
    }

    let score = 0;
    const matchReasons: GlossaryMatchReason[] = [];

    for (const lang of langs) {
      const preferredRaw = entry.terms?.[lang]?.preferred || '';
      const normPreferred = normalizeGlossaryText(preferredRaw);
      if (normPreferred) {
        if (normPreferred === normQuery) {
          score = Math.max(score, 120);
          matchReasons.push({ language: lang, field: 'preferred', matchedText: preferredRaw });
        } else if (
          normPreferred.includes(normQuery) ||
          (queryWords.length > 0 && queryWords.every((w) => normPreferred.includes(w)))
        ) {
          score = Math.max(score, 85);
          matchReasons.push({ language: lang, field: 'preferred', matchedText: preferredRaw });
        }
      }

      for (const synRaw of entry.terms?.[lang]?.synonyms || []) {
        const normSyn = normalizeGlossaryText(synRaw);
        if (!normSyn) continue;
        if (normSyn === normQuery) {
          score = Math.max(score, 65);
          matchReasons.push({ language: lang, field: 'synonym', matchedText: synRaw });
        } else if (
          normSyn.includes(normQuery) ||
          (queryWords.length > 0 && queryWords.every((w) => normSyn.includes(w)))
        ) {
          score = Math.max(score, 48);
          matchReasons.push({ language: lang, field: 'synonym', matchedText: synRaw });
        }
      }

      for (const discRaw of entry.terms?.[lang]?.discouragedSynonyms || []) {
        const normDisc = normalizeGlossaryText(discRaw);
        if (!normDisc) continue;
        if (normDisc === normQuery) {
          score = Math.max(score, 35);
          matchReasons.push({ language: lang, field: 'discouraged_synonym', matchedText: discRaw });
        } else if (
          normDisc.includes(normQuery) ||
          (queryWords.length > 0 && queryWords.every((w) => normDisc.includes(w)))
        ) {
          score = Math.max(score, 28);
          matchReasons.push({ language: lang, field: 'discouraged_synonym', matchedText: discRaw });
        }
      }

      const defRaw = entry.definitions?.[lang] || '';
      const normDef = normalizeGlossaryText(defRaw);
      if (
        normDef &&
        (normDef.includes(normQuery) ||
          (queryWords.length > 0 && queryWords.every((w) => normDef.includes(w))))
      ) {
        score = Math.max(score, 22);
        matchReasons.push({
          language: lang,
          field: 'definition',
          matchedText: defRaw.slice(0, 110) + (defRaw.length > 110 ? '…' : ''),
        });
      }

      const usageRaw = entry.usageNotes?.[lang] || '';
      const normUsage = normalizeGlossaryText(usageRaw);
      if (
        normUsage &&
        (normUsage.includes(normQuery) ||
          (queryWords.length > 0 && queryWords.every((w) => normUsage.includes(w))))
      ) {
        score = Math.max(score, 15);
        matchReasons.push({
          language: lang,
          field: 'usage',
          matchedText: usageRaw.slice(0, 110) + (usageRaw.length > 110 ? '…' : ''),
        });
      }
    }

    if (score > 0) {
      // Bonus when multiple fields match
      score += Math.min(10, matchReasons.length * 2);
      ranked.push({ entry, score, matchReasons });
    }
  }

  if (normQuery) {
    ranked.sort((a, b) => b.score - a.score || a.entry.termId.localeCompare(b.entry.termId));
  } else {
    ranked.sort(
      (a, b) =>
        b.entry.updatedAt.localeCompare(a.entry.updatedAt) ||
        a.entry.termId.localeCompare(b.entry.termId)
    );
  }

  const total = ranked.length;
  const start = (safePage - 1) * safePageSize;
  const paged = ranked.slice(start, start + safePageSize);

  return {
    items: paged,
    total,
    page: safePage,
    pageSize: safePageSize,
    hasMore: start + paged.length < total,
    searchMethod:
      'Unicode NFC normalization + case-folded multi-field ranking (preferred term > approved synonym > blocked informal synonym > definition > usage note) backed by Firestore searchTokens.',
    searchLimitations:
      'Firestore does not provide native full-text search. Multi-word matching and ranked trilingual scoring are executed server-side over indexed approved entries with pagination.',
  };
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function detectIncompleteLanguages(entry: {
  terms: { om: { preferred: string }; am: { preferred: string }; en: { preferred: string } };
  definitions: { om: string; am: string; en: string };
}): GlossaryLanguage[] {
  const missing: GlossaryLanguage[] = [];
  (['om', 'am', 'en'] as GlossaryLanguage[]).forEach((lang) => {
    const termOk = Boolean(entry.terms?.[lang]?.preferred?.trim());
    const defOk = Boolean(entry.definitions?.[lang]?.trim());
    if (!termOk || !defOk) {
      missing.push(lang);
    }
  });
  return missing;
}

export function validateSourceReferences(
  refs: unknown
): { ok: true; value: GlossarySourceReference[] } | { ok: false; error: string } {
  if (!Array.isArray(refs)) {
    return { ok: false, error: 'sourceReferences must be an array.' };
  }
  if (refs.length > GLOSSARY_MAX_LENGTHS.maxSourceReferences) {
    return {
      ok: false,
      error: `A maximum of ${GLOSSARY_MAX_LENGTHS.maxSourceReferences} source references is allowed.`,
    };
  }

  const allowedTypes = new Set<SourceReferenceType>([
    'constitution',
    'proclamation',
    'regulation',
    'directive',
    'code',
    'cassation_decision',
    'court_decision',
    'official_dictionary',
    'publication',
    'other',
  ]);

  const cleaned: GlossarySourceReference[] = [];
  for (const item of refs) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Each source reference must be a structured object.' };
    }
    const r = item as Record<string, unknown>;
    const title = typeof r.title === 'string' ? r.title.normalize('NFC').trim() : '';
    const sourceType = (typeof r.sourceType === 'string' ? r.sourceType : 'other') as SourceReferenceType;
    if (!allowedTypes.has(sourceType)) {
      return { ok: false, error: `Unsupported sourceType: ${String(r.sourceType)}` };
    }
    if (!title || title.length > GLOSSARY_MAX_LENGTHS.sourceTitle) {
      return {
        ok: false,
        error: `Source reference title is required and must be <= ${GLOSSARY_MAX_LENGTHS.sourceTitle} characters.`,
      };
    }

    const url = typeof r.url === 'string' ? r.url.trim() : undefined;
    if (url && (!isValidHttpUrl(url) || url.length > GLOSSARY_MAX_LENGTHS.url)) {
      return { ok: false, error: `Invalid source reference URL: ${url}` };
    }

    const optStr = (val: unknown) =>
      typeof val === 'string' && val.trim()
        ? val.normalize('NFC').trim().slice(0, GLOSSARY_MAX_LENGTHS.sourceField)
        : undefined;

    cleaned.push({
      sourceType,
      title,
      ...(optStr(r.issuingBody) ? { issuingBody: optStr(r.issuingBody) } : {}),
      ...(optStr(r.identifier) ? { identifier: optStr(r.identifier) } : {}),
      ...(optStr(r.articleOrSection) ? { articleOrSection: optStr(r.articleOrSection) } : {}),
      ...(optStr(r.volume) ? { volume: optStr(r.volume) } : {}),
      ...(optStr(r.page) ? { page: optStr(r.page) } : {}),
      ...(optStr(r.publicationDate) ? { publicationDate: optStr(r.publicationDate) } : {}),
      ...(optStr(r.documentId) ? { documentId: optStr(r.documentId) } : {}),
      ...(url ? { url } : {}),
    });
  }

  return { ok: true, value: cleaned };
}

export function validateGlossarySubmissionPayload(
  raw: unknown
):
  | {
      ok: true;
      submissionType: 'new_term' | 'revision';
      targetTermId?: string;
      proposedEntry: GlossarySubmissionProposedEntry;
      incompleteLanguages: GlossaryLanguage[];
      aiAssistedDraft: boolean;
    }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Request payload must be an object.' };
  }
  const body = raw as Record<string, unknown>;
  const submissionType = body.submissionType === 'revision' ? 'revision' : 'new_term';
  const targetTermId =
    typeof body.targetTermId === 'string' && body.targetTermId.trim()
      ? body.targetTermId.trim()
      : undefined;

  if (submissionType === 'revision' && !targetTermId) {
    return { ok: false, error: 'targetTermId is required when proposing a revision.' };
  }

  const proposed = (body.proposedEntry && typeof body.proposedEntry === 'object'
    ? body.proposedEntry
    : body) as Record<string, unknown>;

  const sourceLang = proposed.sourceLanguage;
  if (sourceLang !== 'om' && sourceLang !== 'am' && sourceLang !== 'en') {
    return { ok: false, error: 'sourceLanguage must be one of: om, am, en.' };
  }

  const rawTerms = (proposed.terms || {}) as Record<string, any>;
  const rawDefs = (proposed.definitions || {}) as Record<string, any>;
  const rawUsage = (proposed.usageNotes || {}) as Record<string, any>;
  const rawTransNotes = (proposed.translationNotes || {}) as Record<string, any>;
  const rawNoExact = (proposed.noExactEquivalent || {}) as Record<string, any>;

  const cleanSynonyms = (val: unknown, maxCount = GLOSSARY_MAX_LENGTHS.synonymsPerLanguage): string[] => {
    if (!Array.isArray(val)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of val) {
      if (typeof s !== 'string') continue;
      const trimmed = s.normalize('NFC').trim();
      if (!trimmed || trimmed.length > GLOSSARY_MAX_LENGTHS.synonym) continue;
      const key = normalizeGlossaryText(trimmed);
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(trimmed);
      }
      if (out.length >= maxCount) break;
    }
    return out;
  };

  const cleanStr = (val: unknown, max: number): string =>
    typeof val === 'string' ? val.normalize('NFC').trim().slice(0, max) : '';

  const entryTypeRaw = proposed.entryType;
  let entryType: GlossaryEntryType = 'legal_term';
  if (entryTypeRaw !== undefined && entryTypeRaw !== null && entryTypeRaw !== '') {
    if (
      entryTypeRaw !== 'legal_term' &&
      entryTypeRaw !== 'court_name' &&
      entryTypeRaw !== 'document_type'
    ) {
      return { ok: false, error: 'entryType must be one of: legal_term, court_name, document_type.' };
    }
    entryType = entryTypeRaw;
  }

  const terms = {
    om: {
      preferred: cleanStr(rawTerms.om?.preferred, GLOSSARY_MAX_LENGTHS.term),
      synonyms: cleanSynonyms(rawTerms.om?.synonyms),
      discouragedSynonyms: cleanSynonyms(
        rawTerms.om?.discouragedSynonyms,
        GLOSSARY_MAX_LENGTHS.discouragedSynonymsPerLanguage
      ),
    },
    am: {
      preferred: cleanStr(rawTerms.am?.preferred, GLOSSARY_MAX_LENGTHS.term),
      synonyms: cleanSynonyms(rawTerms.am?.synonyms),
      discouragedSynonyms: cleanSynonyms(
        rawTerms.am?.discouragedSynonyms,
        GLOSSARY_MAX_LENGTHS.discouragedSynonymsPerLanguage
      ),
    },
    en: {
      preferred: cleanStr(rawTerms.en?.preferred, GLOSSARY_MAX_LENGTHS.term),
      synonyms: cleanSynonyms(rawTerms.en?.synonyms),
      discouragedSynonyms: cleanSynonyms(
        rawTerms.en?.discouragedSynonyms,
        GLOSSARY_MAX_LENGTHS.discouragedSynonymsPerLanguage
      ),
    },
  };

  // Prevent forbidden/informal synonyms from overlapping the official preferred term or approved synonyms
  for (const lang of ['om', 'am', 'en'] as GlossaryLanguage[]) {
    const normPreferred = normalizeGlossaryText(terms[lang].preferred);
    const normApprovedSet = new Set(terms[lang].synonyms.map((s) => normalizeGlossaryText(s)));
    for (const disc of terms[lang].discouragedSynonyms || []) {
      const normDisc = normalizeGlossaryText(disc);
      if (normPreferred && normDisc === normPreferred) {
        return {
          ok: false,
          error: `Discouraged/informal synonym "${disc}" in (${lang}) cannot match the official preferred term.`,
        };
      }
      if (normApprovedSet.has(normDisc)) {
        return {
          ok: false,
          error: `Discouraged/informal synonym "${disc}" in (${lang}) conflicts with an approved synonym.`,
        };
      }
    }
  }

  const definitions = {
    om: cleanStr(rawDefs.om, GLOSSARY_MAX_LENGTHS.definition),
    am: cleanStr(rawDefs.am, GLOSSARY_MAX_LENGTHS.definition),
    en: cleanStr(rawDefs.en, GLOSSARY_MAX_LENGTHS.definition),
  };

  if (!terms[sourceLang].preferred) {
    return {
      ok: false,
      error: `Preferred term in source language (${sourceLang}) is required.`,
    };
  }
  if (!definitions[sourceLang]) {
    return {
      ok: false,
      error: `Definition in source language (${sourceLang}) is required.`,
    };
  }

  const domain = proposed.domain as GlossaryDomain;
  if (!GLOSSARY_DOMAINS.some((d) => d.id === domain)) {
    return { ok: false, error: 'Invalid or unsupported legal domain.' };
  }

  const rawJurisdictions = Array.isArray(proposed.jurisdiction)
    ? proposed.jurisdiction.filter((j): j is string => typeof j === 'string' && j.trim().length > 0)
    : [];
  const jurisdiction = Array.from(
    new Set(rawJurisdictions.map((j) => j.normalize('NFC').trim().slice(0, 80)))
  );
  if (jurisdiction.length === 0) {
    return { ok: false, error: 'At least one jurisdiction is required.' };
  }

  const refsValidation = validateSourceReferences(proposed.sourceReferences || []);
  if (!refsValidation.ok) {
    return { ok: false, error: refsValidation.error };
  }

  const usageNotes: GlossaryEntryRecord['usageNotes'] = {
    ...(cleanStr(rawUsage.om, GLOSSARY_MAX_LENGTHS.usageNote)
      ? { om: cleanStr(rawUsage.om, GLOSSARY_MAX_LENGTHS.usageNote) }
      : {}),
    ...(cleanStr(rawUsage.am, GLOSSARY_MAX_LENGTHS.usageNote)
      ? { am: cleanStr(rawUsage.am, GLOSSARY_MAX_LENGTHS.usageNote) }
      : {}),
    ...(cleanStr(rawUsage.en, GLOSSARY_MAX_LENGTHS.usageNote)
      ? { en: cleanStr(rawUsage.en, GLOSSARY_MAX_LENGTHS.usageNote) }
      : {}),
  };

  const translationNotes: GlossaryEntryRecord['translationNotes'] = {
    ...(cleanStr(rawTransNotes.om, GLOSSARY_MAX_LENGTHS.translationNote)
      ? { om: cleanStr(rawTransNotes.om, GLOSSARY_MAX_LENGTHS.translationNote) }
      : {}),
    ...(cleanStr(rawTransNotes.am, GLOSSARY_MAX_LENGTHS.translationNote)
      ? { am: cleanStr(rawTransNotes.am, GLOSSARY_MAX_LENGTHS.translationNote) }
      : {}),
    ...(cleanStr(rawTransNotes.en, GLOSSARY_MAX_LENGTHS.translationNote)
      ? { en: cleanStr(rawTransNotes.en, GLOSSARY_MAX_LENGTHS.translationNote) }
      : {}),
  };

  const proposedEntry: GlossarySubmissionProposedEntry = {
    sourceLanguage: sourceLang,
    entryType,
    terms,
    definitions,
    usageNotes,
    ...(Object.keys(translationNotes).length > 0 ? { translationNotes } : {}),
    noExactEquivalent: {
      om: Boolean(rawNoExact.om),
      am: Boolean(rawNoExact.am),
      en: Boolean(rawNoExact.en),
    },
    domain,
    jurisdiction,
    sourceReferences: refsValidation.value,
    isGeneralLegalDefinition: Boolean(proposed.isGeneralLegalDefinition),
    ...(cleanStr(proposed.noSourceJustification, 400)
      ? { noSourceJustification: cleanStr(proposed.noSourceJustification, 400) }
      : {}),
  };

  const incompleteLanguages = detectIncompleteLanguages(proposedEntry);

  return {
    ok: true,
    submissionType,
    targetTermId,
    proposedEntry,
    incompleteLanguages,
    aiAssistedDraft: Boolean(body.aiAssistedDraft),
  };
}
