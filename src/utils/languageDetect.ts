import type { Language } from '../i18n/translations';

export interface LanguageDetectionResult {
  language: Language;
  confidence: 'high' | 'medium' | 'low';
  script: 'ethiopic' | 'latin';
}

const OROMO_MARKERS = [
  'akka',
  'maal',
  'maaliif',
  'keeyyata',
  'labsii',
  'seera',
  'mana murtii',
  'dhaddacha',
  'ijibbaataa',
  'qabiyyee',
  'galmee',
  'beenyaa',
  'hojjetaa',
  'hojjataa',
  'waliigaltee',
  'iyyannoo',
  'himata',
  'deebii',
  'murtii',
  'dhaala',
  "gaa'ila",
  'mirga',
  'dirqama',
  'irratti',
  'keessatti',
  'fayyadamaa',
  'abbaa',
  'haadha',
  "bakka bu'aa",
  'shakkamaa',
  'ragaa',
  'dhimma',
  'bu\'uura',
  'kaffaltii',
  'babal\'ina',
  'oli\'iyyannoo',
  'ol-iyyannoo',
  'murtee',
  'abukaatoo',
  'qaama',
  'namni',
  'kun',
  'kana',
  'yoo',
  'ta\'e',
  'hin',
  'qabu',
  'jiru',
  'fi',
];

const ENGLISH_MARKERS = [
  'proclamation',
  'article',
  'whereas',
  'herein',
  'hereby',
  'pursuant',
  'agreement',
  'contract',
  'plaintiff',
  'defendant',
  'petition',
  'petitioner',
  'respondent',
  'court',
  'judgment',
  'supreme',
  'cassation',
  'evidence',
  'witness',
  'section',
  'clause',
  'jurisdiction',
  'appellant',
  'appellee',
  'shall',
  'thereof',
  'liability',
  'compensation',
  'rights',
  'obligations',
];

const ENGLISH_STOPWORDS = /\b(the|and|of|to|in|for|that|with|under|by|from|this|which|shall|between|party|parties)\b/gi;

/**
 * Accurately detects whether a legal text is primarily Afaan Oromoo ('om'), Amharic ('am'), or English ('en').
 * Safe for client, server, and Node tests.
 */
export function detectDocumentLanguage(text: string): LanguageDetectionResult {
  const sample = (text || '').normalize('NFKC').trim();
  if (!sample) {
    return { language: 'om', confidence: 'low', script: 'latin' };
  }

  // 1. Check Ethiopic (Amharic / Ge'ez) script density
  const ethiopicMatches = sample.match(/[\u1200-\u137F]/g);
  const latinMatches = sample.match(/[A-Za-z]/g);
  const ethCount = ethiopicMatches ? ethiopicMatches.length : 0;
  const latCount = latinMatches ? latinMatches.length : 0;

  if (ethCount > 0 && (ethCount >= 4 || ethCount > latCount * 0.25)) {
    return {
      language: 'am',
      confidence: ethCount >= 12 ? 'high' : 'medium',
      script: 'ethiopic',
    };
  }

  // 2. Compare Afaan Oromoo vs English markers
  const lower = sample.toLowerCase();
  let omScore = 0;
  let enScore = 0;

  for (const marker of OROMO_MARKERS) {
    if (lower.includes(marker)) {
      omScore += marker.length >= 6 ? 3 : 2;
    }
  }

  // Oromo orthography signals: apostrophe glottal stop between vowels, double vowels, dh/ny/ch/ph/sh
  const doubleVowels = lower.match(/(aa|ee|ii|oo|uu)/g);
  if (doubleVowels && doubleVowels.length >= 2) {
    omScore += Math.min(8, doubleVowels.length * 1.5);
  }
  const glottalStops = lower.match(/[aeiou]['’][aeiou]/g);
  if (glottalStops && glottalStops.length >= 1) {
    omScore += Math.min(6, glottalStops.length * 2.5);
  }
  const qubeeDigraphs = lower.match(/\b[a-z]*(dh|ny|ch|ph)[a-z]*\b/g);
  if (qubeeDigraphs && qubeeDigraphs.length >= 1) {
    omScore += Math.min(6, qubeeDigraphs.length * 1.5);
  }

  for (const marker of ENGLISH_MARKERS) {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) {
      enScore += 3;
    }
  }

  const stopMatches = lower.match(ENGLISH_STOPWORDS);
  if (stopMatches) {
    enScore += Math.min(12, stopMatches.length * 1.5);
  }

  if (omScore > enScore && omScore >= 2) {
    return {
      language: 'om',
      confidence: omScore >= 6 ? 'high' : 'medium',
      script: 'latin',
    };
  }

  if (enScore > omScore && enScore >= 2) {
    return {
      language: 'en',
      confidence: enScore >= 6 ? 'high' : 'medium',
      script: 'latin',
    };
  }

  // Tie-break on double vowels if present
  if (doubleVowels && doubleVowels.length >= 1 && !stopMatches) {
    return { language: 'om', confidence: 'low', script: 'latin' };
  }

  return { language: enScore > 0 ? 'en' : 'om', confidence: 'low', script: 'latin' };
}

export function isSupportedLanguage(lang: unknown): lang is Language {
  return lang === 'om' || lang === 'am' || lang === 'en';
}

export interface DocumentLanguageLike {
  originalLanguage?: Language;
  outputLanguages?: Language[];
  content?: string;
  title?: string;
}

/**
 * Resolves a document's authoritative original language without overwriting it with UI language.
 */
export function getDocumentOriginalLanguage(doc: DocumentLanguageLike): Language {
  if (isSupportedLanguage(doc.originalLanguage)) {
    return doc.originalLanguage;
  }
  if (Array.isArray(doc.outputLanguages) && doc.outputLanguages.length === 1 && isSupportedLanguage(doc.outputLanguages[0])) {
    return doc.outputLanguages[0];
  }
  const combined = `${doc.title || ''}\n${(doc.content || '').slice(0, 1500)}`;
  if (combined.trim()) {
    return detectDocumentLanguage(combined).language;
  }
  if (Array.isArray(doc.outputLanguages) && doc.outputLanguages.length > 0 && isSupportedLanguage(doc.outputLanguages[0])) {
    return doc.outputLanguages[0];
  }
  return 'om';
}

export function getLanguageDisplayName(lang: Language, format: 'native' | 'short' | 'bilingual' = 'native'): string {
  if (format === 'short') {
    return lang.toUpperCase();
  }
  if (format === 'bilingual') {
    if (lang === 'om') return 'Afaan Oromoo (OM)';
    if (lang === 'am') return 'አማርኛ / Amharic (AM)';
    return 'English (EN)';
  }
  if (lang === 'om') return 'Afaan Oromoo';
  if (lang === 'am') return 'አማርኛ';
  return 'English';
}

/**
 * Splits a comma, semicolon, or newline-delimited keyword string into clean deduplicated tags.
 */
export function parseTagInput(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  const parts = raw
    .split(/[,;\n]+/)
    .map((t) => t.trim().replace(/^#+/, ''))
    .filter((t) => t.length > 0 && t.length <= 64);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of parts) {
    const key = tag.normalize('NFKC').toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(tag);
    }
  }
  return result;
}

export function normalizeSearchText(text: string): string {
  return (text || '')
    .normalize('NFKC')
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .trim();
}

export interface SearchSnippetResult {
  snippet: string;
  highlightTerm: string;
  matchCount: number;
}

/**
 * Extracts a contextual snippet around the first occurrence of query terms in a document body.
 */
export function extractSearchSnippet(
  text: string,
  query: string,
  maxLength: number = 180
): SearchSnippetResult | null {
  const source = (text || '').normalize('NFKC');
  const normQuery = normalizeSearchText(query);
  if (!source.trim() || !normQuery) return null;

  const terms = Array.from(
    new Set(
      normQuery
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
  );
  if (terms.length === 0) return null;

  const normSource = source.replace(/[’‘`]/g, "'").toLowerCase();
  let bestIdx = -1;
  let matchedTerm = normQuery;

  // Prefer full phrase match first
  const phraseIdx = normSource.indexOf(normQuery);
  if (phraseIdx !== -1) {
    bestIdx = phraseIdx;
    matchedTerm = normQuery;
  } else {
    for (const term of terms) {
      const idx = normSource.indexOf(term);
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
        bestIdx = idx;
        matchedTerm = term;
      }
    }
  }

  if (bestIdx === -1) return null;

  // Count total occurrences across terms
  let matchCount = 0;
  for (const term of terms) {
    let pos = 0;
    while (pos < normSource.length) {
      const found = normSource.indexOf(term, pos);
      if (found === -1) break;
      matchCount++;
      pos = found + term.length;
    }
  }

  const contextBefore = Math.floor((maxLength - matchedTerm.length) / 2);
  let start = Math.max(0, bestIdx - contextBefore);
  let end = Math.min(source.length, start + maxLength);

  // Snap to word boundaries lightly so words aren't chopped mid-token
  if (start > 0) {
    const spaceIdx = source.indexOf(' ', start);
    if (spaceIdx !== -1 && spaceIdx < bestIdx && spaceIdx - start < 20) {
      start = spaceIdx + 1;
    }
  }
  if (end < source.length) {
    const spaceIdx = source.lastIndexOf(' ', end);
    if (spaceIdx > bestIdx + matchedTerm.length && end - spaceIdx < 20) {
      end = spaceIdx;
    }
  }

  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  const rawSlice = source.slice(start, end).replace(/\s+/g, ' ').trim();

  return {
    snippet: `${prefix}${rawSlice}${suffix}`,
    highlightTerm: matchedTerm,
    matchCount: Math.max(1, matchCount),
  };
}

export interface SearchableDocument {
  id: string;
  title: string;
  content: string;
  tags: string[];
  folderId?: string;
  taskType: string;
  isBookmarked?: boolean;
  originalLanguage?: Language;
  outputLanguages?: Language[];
  caseName?: string;
  docType?: string;
  fileName?: string;
  separatedVersions?: {
    om?: string;
    am?: string;
    en?: string;
  };
}

export interface DocumentSearchOptions {
  query?: string;
  folder?: string;
  taskType?: string;
  languageFilter?: Language | 'all';
  tagFilter?: string | null;
}

export interface DocumentSearchHit<T extends SearchableDocument> {
  doc: T;
  originalLanguage: Language;
  snippet: SearchSnippetResult | null;
  matchedIn: Array<'title' | 'content' | 'tags' | 'metadata'>;
  score: number;
}

/**
 * Full-text trilingual document filter & search with snippet extraction and original-language filtering.
 */
export function searchDocuments<T extends SearchableDocument>(
  docs: T[],
  options: DocumentSearchOptions
): DocumentSearchHit<T>[] {
  const {
    query = '',
    folder = 'all',
    taskType = 'all',
    languageFilter = 'all',
    tagFilter = null,
  } = options;

  const normQuery = normalizeSearchText(query);
  const queryTerms = normQuery ? normQuery.split(/\s+/).filter(Boolean) : [];
  const normTagFilter = tagFilter ? normalizeSearchText(tagFilter) : null;

  const hits: DocumentSearchHit<T>[] = [];

  for (const doc of docs) {
    if (taskType !== 'all' && doc.taskType !== taskType) continue;

    if (folder === 'bookmarked') {
      if (!doc.isBookmarked) continue;
    } else if (folder === 'unfiled') {
      if (doc.folderId) continue;
    } else if (folder !== 'all') {
      if (doc.folderId !== folder) continue;
    }

    const origLang = getDocumentOriginalLanguage(doc);
    if (languageFilter !== 'all' && origLang !== languageFilter) {
      continue;
    }

    if (normTagFilter) {
      const hasTag = (doc.tags || []).some((t) => normalizeSearchText(t) === normTagFilter);
      if (!hasTag) continue;
    }

    if (queryTerms.length === 0) {
      hits.push({
        doc,
        originalLanguage: origLang,
        snippet: null,
        matchedIn: [],
        score: 0,
      });
      continue;
    }

    const normTitle = normalizeSearchText(doc.title || '');
    const normContent = normalizeSearchText(doc.content || '');
    const normSeparated = [
      doc.separatedVersions?.om,
      doc.separatedVersions?.am,
      doc.separatedVersions?.en,
    ]
      .filter(Boolean)
      .map((v) => normalizeSearchText(v || ''))
      .join('\n');
    const normTags = (doc.tags || []).map((t) => normalizeSearchText(t)).join(' ');
    const normMeta = normalizeSearchText(
      [doc.caseName, doc.docType, doc.fileName, origLang, getLanguageDisplayName(origLang, 'bilingual')]
        .filter(Boolean)
        .join(' ')
    );

    const combinedText = `${normTitle}\n${normContent}\n${normSeparated}\n${normTags}\n${normMeta}`;
    const allTermsMatch = queryTerms.every((term) => combinedText.includes(term));
    if (!allTermsMatch) continue;

    const matchedIn: Array<'title' | 'content' | 'tags' | 'metadata'> = [];
    let score = 0;

    if (queryTerms.every((term) => normTitle.includes(term))) {
      matchedIn.push('title');
      score += 40;
    }
    if (queryTerms.some((term) => normTags.includes(term))) {
      matchedIn.push('tags');
      score += 25;
    }
    if (queryTerms.some((term) => normContent.includes(term) || normSeparated.includes(term))) {
      matchedIn.push('content');
      score += 20;
    }
    if (queryTerms.some((term) => normMeta.includes(term))) {
      matchedIn.push('metadata');
      score += 10;
    }

    // Prefer snippet from primary original content, falling back to separatedVersions
    const snippetSource =
      doc.content && queryTerms.some((term) => normalizeSearchText(doc.content).includes(term))
        ? doc.content
        : doc.separatedVersions?.[origLang] ||
          doc.separatedVersions?.om ||
          doc.separatedVersions?.am ||
          doc.separatedVersions?.en ||
          doc.content;

    const snippet = extractSearchSnippet(snippetSource || '', normQuery);
    if (snippet) {
      score += Math.min(20, snippet.matchCount * 2);
    }

    hits.push({
      doc,
      originalLanguage: origLang,
      snippet,
      matchedIn,
      score,
    });
  }

  if (queryTerms.length > 0) {
    hits.sort((a, b) => b.score - a.score);
  }

  return hits;
}
