export type TelegramFeedSortMode = 'latest' | 'relevant';

export interface RelevanceScorableFeedItem {
  id?: string;
  title?: unknown;
  headline?: unknown;
  text?: unknown;
  summary?: unknown;
  rawText?: unknown;
  type?: string;
  category?: string;
  referenceNumber?: string;
  fileNumber?: string;
  tags?: string[];
  keyArticles?: string[];
  url?: string;
  postUrl?: string;
  channelHandle?: string;
  channelTitle?: string;
  date?: string;
  publishDate?: string;
}

export function resolveLocalizedFeedText(value: unknown, lang: string = 'om'): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    const normalizedLang = String(lang || 'om').toLowerCase();
    const order = normalizedLang.startsWith('am')
      ? ['am', 'om', 'en']
      : normalizedLang.startsWith('en')
        ? ['en', 'om', 'am']
        : ['om', 'en', 'am'];

    for (const key of order) {
      const candidate = rec[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  return '';
}

export function parseFeedTimestamp(dateStr?: string): number {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const trimmed = dateStr.trim();
  if (!trimmed) return 0;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatFeedDateLabel(dateStr?: string, lang: string = 'om'): string {
  if (!dateStr) return '';
  const ts = parseFeedTimestamp(dateStr);
  if (!ts) return dateStr;

  const locale = lang.startsWith('am') ? 'am-ET' : lang.startsWith('en') ? 'en-US' : 'om-ET';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function computeFeedItemRelevanceScore(item: RelevanceScorableFeedItem): number {
  let score = 0;

  const type = (item.type || '').toLowerCase();
  const category = (item.category || '').toLowerCase();
  const combinedText = [
    resolveLocalizedFeedText(item.title, 'en'),
    resolveLocalizedFeedText(item.title, 'om'),
    resolveLocalizedFeedText(item.text, 'en'),
    resolveLocalizedFeedText(item.summary, 'en'),
    resolveLocalizedFeedText(item.summary, 'om'),
    typeof item.rawText === 'string' ? item.rawText : '',
  ]
    .join(' ')
    .toLowerCase();

  // 1. Primary authoritative instrument type weight
  if (type.includes('cassation') || category.includes('cass') || /mmwf|cassation|ijibbaataa|ሰበር/.test(combinedText)) {
    score += 35;
  } else if (type.includes('proclamation') || category.includes('proc') || /labsii|proclamation|አዋጅ/.test(combinedText)) {
    score += 30;
  } else if (type.includes('regulation') || type.includes('directive') || /dambii|qajeelfama|regulation|ደንብ/.test(combinedText)) {
    score += 24;
  } else {
    score += 12;
  }

  // 2. Specific statutory/case reference identifier
  const ref = (item.referenceNumber || item.fileNumber || '').trim();
  if (ref) score += 16;

  // 3. Statutory articles cited
  const articleCount = Array.isArray(item.keyArticles) ? item.keyArticles.length : 0;
  score += Math.min(16, articleCount * 4);

  if (/(art\.|article|keeyyata|kwt|አንቀጽ)\s*\d+/i.test(combinedText)) {
    score += 10;
  }

  // 4. Direct Telegram post link vs generic channel root
  const url = (item.url || item.postUrl || '').trim();
  if (/https:\/\/t\.me\/[^/]+\/\d+/.test(url)) {
    score += 10;
  }

  // 5. Substantive legal summary detail & tags
  if (combinedText.length >= 120) score += 8;
  if (Array.isArray(item.tags)) {
    score += Math.min(8, item.tags.length * 2);
  }

  // 6. Bounded freshness tie-breaker (0 to 12 pts within 30 days)
  const ts = parseFeedTimestamp(item.date || item.publishDate);
  if (ts > 0) {
    const ageDays = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
    score += Math.max(0, Math.round(12 - Math.min(12, (ageDays / 30) * 12)));
  }

  return score;
}

export function sortTelegramFeedItems<T extends RelevanceScorableFeedItem>(
  items: T[],
  mode: TelegramFeedSortMode,
): T[] {
  const indexed = items.map((item, idx) => ({
    item,
    idx,
    ts: parseFeedTimestamp(item.date || item.publishDate),
    rel: computeFeedItemRelevanceScore(item),
  }));

  indexed.sort((a, b) => {
    if (mode === 'relevant') {
      if (b.rel !== a.rel) return b.rel - a.rel;
      if (b.ts !== a.ts) return b.ts - a.ts;
      return a.idx - b.idx;
    }

    // 'latest': newest timestamp first; items without valid timestamps retain original order after dated items
    if (b.ts !== a.ts) return b.ts - a.ts;
    return a.idx - b.idx;
  });

  return indexed.map((entry) => entry.item);
}

function collectFeedTextVariants(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    return Object.values(rec)
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim());
  }
  return [];
}

export function filterTelegramFeedItems<T extends RelevanceScorableFeedItem>(
  items: T[],
  searchQuery: string,
): T[] {
  const normalized = String(searchQuery || '').trim().toLowerCase();
  if (!normalized) return items;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return items;

  return items.filter((item) => {
    const haystack = [
      ...collectFeedTextVariants(item.title),
      ...collectFeedTextVariants(item.headline),
      ...collectFeedTextVariants(item.text),
      ...collectFeedTextVariants(item.summary),
      typeof item.rawText === 'string' ? item.rawText : '',
      item.referenceNumber || '',
      item.fileNumber || '',
      item.category || '',
      item.type || '',
      ...(Array.isArray(item.tags) ? item.tags : []),
      ...(Array.isArray(item.keyArticles) ? item.keyArticles : []),
      item.url || '',
      item.postUrl || '',
    ]
      .join(' ')
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}

export function extractItemChannelHandle(item: RelevanceScorableFeedItem): string {
  const direct = typeof item.channelHandle === 'string' ? item.channelHandle.trim() : '';
  if (direct) {
    return direct.toLowerCase().replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '').split('/')[0];
  }

  const rawUrl = (item.postUrl || item.url || '').trim();
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.hostname.endsWith('t.me')) {
        const segments = parsed.pathname.split('/').filter(Boolean);
        const candidate = segments[0] === 's' ? segments[1] : segments[0];
        if (candidate) {
          return candidate.toLowerCase().replace(/^@/, '');
        }
      }
    } catch {
      // Ignore malformed URLs
    }
  }

  return 'seeraai_ethio';
}

export function filterTelegramFeedByChannels<T extends RelevanceScorableFeedItem>(
  items: T[],
  enabledChannels: readonly string[],
): T[] {
  if (!Array.isArray(enabledChannels) || enabledChannels.length === 0) {
    return [];
  }

  const normalizedAllowed = new Set(
    enabledChannels
      .map((ch) => String(ch || '').trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean),
  );

  if (normalizedAllowed.size === 0) {
    return [];
  }

  return items.filter((item) => normalizedAllowed.has(extractItemChannelHandle(item)));
}

export interface ShareFeedPayload {
  title: string;
  text: string;
  url: string;
}

export async function shareLegalFeedItem(
  payload: ShareFeedPayload,
): Promise<{ method: 'web_share' | 'clipboard' | 'aborted' | 'failed' }> {
  const shareText = [payload.title, payload.text].filter(Boolean).join('\n\n');
  const fullClipboardText = [payload.title, payload.text, payload.url]
    .filter(Boolean)
    .join('\n\n');

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: shareText,
        url: payload.url,
      });
      return { method: 'web_share' };
    } catch (err: unknown) {
      const errName =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name?: unknown }).name)
          : '';
      if (errName === 'AbortError') {
        return { method: 'aborted' };
      }
      // Fall through to clipboard fallback when Web Share is blocked (e.g. iframe / unsupported protocol)
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(fullClipboardText);
      return { method: 'clipboard' };
    }
  } catch {
    // Fall through to failed
  }

  return { method: 'failed' };
}

export interface StructuredLegalFeedDocument {
  title: string;
  documentType: string;
  referenceNumber: string;
  categoryLabel: string;
  sourceChannel: string;
  sourceUrl: string;
  publishedDateLabel: string;
  exportedAtLabel: string;
  keyArticles: string[];
  tags: string[];
  bodyParagraphs: string[];
  filename: string;
}

function sanitizePdfFilenamePart(input: string): string {
  const cleaned = input
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 64) || 'Legal_Update';
}

export function buildStructuredLegalFeedDocument(
  item: RelevanceScorableFeedItem,
  lang: string = 'om',
): StructuredLegalFeedDocument {
  const normalizedLang = String(lang || 'om').toLowerCase();
  const title =
    resolveLocalizedFeedText(item.title, normalizedLang) ||
    resolveLocalizedFeedText(item.headline, normalizedLang) ||
    (normalizedLang.startsWith('am')
      ? 'የቴሌግራም የሕግ መረጃ'
      : normalizedLang.startsWith('en')
        ? 'Telegram Legal Update'
        : 'Oduu fi Murtii Seeraa Telegram');

  const typeRaw = `${item.type || ''} ${item.category || ''} ${title}`.toLowerCase();
  const isCassation =
    typeRaw.includes('cassation') ||
    typeRaw.includes('mmwf') ||
    typeRaw.includes('ijibbaataa') ||
    typeRaw.includes('ሰበር');
  const isProclamation =
    typeRaw.includes('proclamation') ||
    typeRaw.includes('labsii') ||
    typeRaw.includes('አዋጅ');
  const isRegulation =
    typeRaw.includes('regulation') ||
    typeRaw.includes('directive') ||
    typeRaw.includes('dambii') ||
    typeRaw.includes('qajeelfama') ||
    typeRaw.includes('ደንብ');

  const documentType = isCassation
    ? normalizedLang.startsWith('am')
      ? 'የሰበር ችሎት ውሳኔ (Cassation Precedent)'
      : normalizedLang.startsWith('en')
        ? 'Cassation Bench Precedent'
        : 'Murtii Dhaddacha Ijibbaataa (Cassation Precedent)'
    : isProclamation
      ? normalizedLang.startsWith('am')
        ? 'አዋጅ / ሕግ (Proclamation / Legislation)'
        : normalizedLang.startsWith('en')
          ? 'Statutory Proclamation / Legislation'
          : 'Labsii Seeraa (Statutory Proclamation)'
      : isRegulation
        ? normalizedLang.startsWith('am')
          ? 'ደንብ / መመሪያ (Regulation / Directive)'
          : normalizedLang.startsWith('en')
            ? 'Regulation / Directive'
            : 'Dambii / Qajeelfama (Regulation / Directive)'
        : normalizedLang.startsWith('am')
          ? 'የሕግ መረጃ ማጠቃለያ (Legal Briefing)'
          : normalizedLang.startsWith('en')
            ? 'Legal Case / Regulatory Update'
            : 'Ibsa fi Oduu Seeraa (Legal Update)';

  const referenceNumber = (item.referenceNumber || item.fileNumber || '').trim() || 'N/A';
  const categoryLabel = (item.category || item.type || 'general').trim();

  const rawUrl = (item.postUrl || item.url || '').trim();
  let sourceUrl = 'https://t.me/seeraai_ethio';
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:') {
        sourceUrl = parsed.toString();
      }
    } catch {
      // Keep default verified channel URL
    }
  }

  const publishedRaw = item.date || item.publishDate;
  const publishedDateLabel = publishedRaw
    ? formatFeedDateLabel(publishedRaw, normalizedLang) || publishedRaw
    : normalizedLang.startsWith('am')
      ? 'አልተገለጸም'
      : normalizedLang.startsWith('en')
        ? 'Not specified'
        : 'Hin ibsamne';

  const exportedAtLabel = formatFeedDateLabel(new Date().toISOString(), normalizedLang);

  const keyArticles = Array.isArray(item.keyArticles)
    ? item.keyArticles.map((a) => String(a).trim()).filter(Boolean)
    : [];
  const tags = Array.isArray(item.tags)
    ? item.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];

  const candidateTexts = [
    resolveLocalizedFeedText(item.text, normalizedLang),
    resolveLocalizedFeedText(item.summary, normalizedLang),
    typeof item.rawText === 'string' ? item.rawText.trim() : '',
  ].filter(Boolean);

  const seenParagraphs = new Set<string>();
  const bodyParagraphs: string[] = [];
  for (const block of candidateTexts) {
    const parts = block
      .split(/\r?\n{1,}/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const part of parts) {
      if (!seenParagraphs.has(part)) {
        seenParagraphs.add(part);
        bodyParagraphs.push(part);
      }
    }
  }
  if (bodyParagraphs.length === 0) {
    bodyParagraphs.push(title);
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const nameToken = referenceNumber !== 'N/A' ? referenceNumber : title;
  const filename = `SEERAAI_${sanitizePdfFilenamePart(nameToken)}_${dateStamp}.pdf`;

  const extractedChannel = extractItemChannelHandle(item);
  const sourceChannel = `@${extractedChannel || 'seeraai_ethio'}`;

  return {
    title,
    documentType,
    referenceNumber,
    categoryLabel,
    sourceChannel,
    sourceUrl,
    publishedDateLabel,
    exportedAtLabel,
    keyArticles,
    tags,
    bodyParagraphs,
    filename,
  };
}
