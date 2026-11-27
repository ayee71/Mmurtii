import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Language } from '../i18n/translations';
import {
  Archive,
  Building2,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileDown,
  Globe,
  HelpCircle,
  Layout,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { fetchTelegramChannelFeed } from '../services/telegramLegalHarvesterService';
import { onTelegramLiveFeedUpdated } from '../services/telegramLiveFeedSync';
import { DailyLegalWisdomCard } from '../components/DailyLegalWisdomCard';
import { exportTelegramFeedItemToPdf } from '../services/telegramFeedPdfExport';
import { TelegramSyncSettingsSection } from '../components/TelegramSyncSettingsSection';
import {
  TelegramSyncSettings,
  buildChannelFeedQueryParam,
  buildChannelsCsvParam,
  getTelegramSyncSettings,
  onTelegramSyncSettingsUpdated,
} from '../services/telegramSyncSettings';
import {
  TelegramFeedSortMode,
  filterTelegramFeedByChannels,
  filterTelegramFeedItems,
  formatFeedDateLabel,
  resolveLocalizedFeedText,
  shareLegalFeedItem,
  sortTelegramFeedItems,
  computeFeedItemRelevanceScore,
} from '../services/telegramFeedUtils';

interface HomeViewProps {
  currentLang: Language;
  onNavigate: (tab: string) => void;
}

interface TelegramFeedItemView {
  id: string;
  title: string;
  text: string;
  date: string;
  url: string;
  channelHandle?: string;
  category?: string;
  type?: string;
  referenceNumber?: string;
  tags?: string[];
  keyArticles?: string[];
  rawText?: string;
  relevanceScore?: number;
}

interface GroundedNewsItem {
  id: string;
  title: string;
  text: string;
  date?: string;
  source?: string;
  url?: string;
  keyTakeaway?: string;
}

interface TelegramFeedResponse {
  items?: unknown[];
}

interface HomeLabels {
  feedTitle: string;
  feedSubtitle: string;
  loading: string;
  noPosts: string;
  fetchError: string;
  invalidResponse: string;
  copy: string;
  copied: string;
  copyFailed: string;
  share: string;
  shared: string;
  shareCopied: string;
  shareFailed: string;
  exportPdf: string;
  exportingPdf: string;
  exportedPdf: string;
  exportPdfFailed: string;
  sortLatest: string;
  sortRelevant: string;
  feedSearchPlaceholder: string;
  clearFeedSearch: string;
  noMatchingFeedPosts: string;
  openPost: string;
  noTitle: string;
  channel: string;
  // Grounding labels
  groundingToggle: string;
  groundingEnabled: string;
  groundingDisabled: string;
  groundingDesc: string;
  groundedTitle: string;
  groundedSubtitle: string;
  groundedBadge: string;
  searchQueriesLabel: string;
  keyTakeawayLabel: string;
  searchPlaceholder: string;
  searchButton: string;
}

const TELEGRAM_CHANNEL_URL = 'https://t.me/seeraai_ethio';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function firstText(value: unknown, keys: string[], lang: string = 'om'): string {
  const record = asRecord(value);
  if (!record) return '';

  for (const key of keys) {
    const candidate = record[key];
    const resolved = resolveLocalizedFeedText(candidate, lang);
    if (resolved) {
      return resolved;
    }
  }

  return '';
}

function safeExternalUrl(value: string): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeTelegramItem(
  rawItem: unknown,
  index: number,
  noTitle: string,
  lang: string = 'om',
): TelegramFeedItemView {
  const rec = asRecord(rawItem);
  const plainText = typeof rawItem === 'string' ? rawItem.trim() : '';
  const summaryOrText =
    firstText(rawItem, ['summary', 'text', 'message', 'content', 'body', 'caption', 'description', 'rawText'], lang) ||
    plainText;
  const keyPrincipleText = firstText(rawItem, ['keyPrinciples'], lang);
  const combinedBody = [summaryOrText, keyPrincipleText && !summaryOrText.includes(keyPrincipleText) ? keyPrincipleText : '']
    .filter(Boolean)
    .join('\n');

  const title =
    firstText(rawItem, ['title', 'headline'], lang) ||
    combinedBody.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 100) ||
    noTitle;
  const id =
    firstText(rawItem, ['id', 'message_id', 'messageId', 'postId'], lang) ||
    `telegram-post-${index}-${title.slice(0, 24)}`;
  const date = firstText(rawItem, [
    'publishDate',
    'date',
    'created_at',
    'createdAt',
    'publishedAt',
    'timestamp',
  ], lang);
  const suppliedUrl = firstText(rawItem, [
    'postUrl',
    'url',
    'link',
    'permalink',
    'telegramUrl',
  ], lang);

  const category = firstText(rawItem, ['category'], lang) || undefined;
  const type = firstText(rawItem, ['type'], lang) || undefined;
  const channelHandle = firstText(rawItem, ['channelHandle'], lang).replace(/^@/, '') || undefined;
  const referenceNumber = firstText(rawItem, ['referenceNumber', 'fileNumber'], lang) || undefined;
  const rawText = typeof rec?.rawText === 'string' ? rec.rawText : undefined;
  const tags = Array.isArray(rec?.tags)
    ? rec.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : undefined;
  const keyArticles = Array.isArray(rec?.keyArticles)
    ? rec.keyArticles.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    : undefined;

  const baseItem: TelegramFeedItemView = {
    id: `${id}-${index}`,
    title,
    text: combinedBody || title,
    date,
    url: safeExternalUrl(suppliedUrl) || TELEGRAM_CHANNEL_URL,
    channelHandle,
    category,
    type,
    referenceNumber,
    tags,
    keyArticles,
    rawText,
  };

  baseItem.relevanceScore = computeFeedItemRelevanceScore(baseItem);
  return baseItem;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentLang,
  onNavigate,
}) => {
  const languageCode = String(currentLang).toLowerCase();

  const labels = useMemo<HomeLabels>(() => {
    if (languageCode.startsWith('am')) {
      return {
        feedTitle: 'የሕግ መረጃና የፍርድ ውሳኔዎች ቴሌግራም',
        feedSubtitle: 'የቅርብ ጊዜ ልጥፎች • ለማዘመን ይጫኑ',
        loading: 'የቴሌግራም ልጥፎች በመጫን ላይ...',
        noPosts: 'በአሁኑ ጊዜ የሚታይ ልጥፍ የለም።',
        fetchError: 'የቴሌግራም መረጃን ማምጣት አልተቻለም። እንደገና ይሞክሩ።',
        invalidResponse: 'ከቴሌግራም የተመለሰው መረጃ በትክክል አልተዘጋጀም።',
        copy: 'ቅዳ',
        copied: 'ተቀድቷል',
        copyFailed: 'መቅዳት አልተቻለም',
        share: 'አጋራ',
        shared: 'ተጋርቷል',
        shareCopied: 'ሊንክ ተቀድቷል',
        shareFailed: 'ማጋራት አልተቻለም',
        exportPdf: 'ወደ PDF ላክ',
        exportingPdf: 'PDF በመፍጠር ላይ...',
        exportedPdf: 'PDF ወርዷል',
        exportPdfFailed: 'PDF መፍጠር አልተቻለም',
        sortLatest: 'የቅርብ ጊዜ',
        sortRelevant: 'በጣም ተዛማጅ',
        feedSearchPlaceholder: 'በቴሌግራም ልጥፎች ውስጥ ቁልፍ ቃል፣ አዋጅ ወይም መዝገብ ቁጥር ፈልግ...',
        clearFeedSearch: 'ፍለጋን አጽዳ',
        noMatchingFeedPosts: 'ከፍለጋዎ ጋር የሚዛመድ የቴሌግራም ልጥፍ አልተገኘም።',
        openPost: 'የቴሌግራም ልጥፉን ክፈት',
        noTitle: 'የቴሌግራም ልጥፍ',
        channel: 'ምንጭ',
        groundingToggle: 'የጉግል ፍለጋ ግራውንዲንግ (Search Grounding)',
        groundingEnabled: 'በርቷል',
        groundingDisabled: 'ጠፍቷል',
        groundingDesc: 'በጌሚኒ ኤአይና በጉግል ፍለጋ የቀጥታ የ2025/2026 የሕግ መረጃዎችና አዋጆች',
        groundedTitle: 'የቀጥታ የሕግ መረጃዎች (GOOGLE SEARCH GROUNDED)',
        groundedSubtitle: 'የቅርብ ጊዜ የኢትዮጵያ ሕጎች፣ አዋጆችና የሰበር ውሳኔዎች',
        groundedBadge: '✓ Live Google Search Grounded',
        searchQueriesLabel: 'የተደረጉ ፍለጋዎች:',
        keyTakeawayLabel: 'ዋና የሕግ ነጥብ:',
        searchPlaceholder: 'የሕግ ርዕስ ወይም አዋጅ ፈልግ...',
        searchButton: 'ፈልግ',
      };
    }

    if (languageCode.startsWith('en')) {
      return {
        feedTitle: 'SEERAAI TELEGRAM LEGAL UPDATES',
        feedSubtitle: 'Latest channel posts • Refresh to update',
        loading: 'Loading Telegram posts...',
        noPosts: 'There are no posts to display right now.',
        fetchError: 'Could not load Telegram posts. Please try again.',
        invalidResponse: 'The Telegram service returned an unexpected response.',
        copy: 'Copy post',
        copied: 'Copied',
        copyFailed: 'Copy failed',
        share: 'Share',
        shared: 'Shared',
        shareCopied: 'Link copied',
        shareFailed: 'Share failed',
        exportPdf: 'Export to PDF',
        exportingPdf: 'Exporting PDF...',
        exportedPdf: 'PDF saved',
        exportPdfFailed: 'PDF export failed',
        sortLatest: 'Latest',
        sortRelevant: 'Most Relevant',
        feedSearchPlaceholder: 'Filter Telegram feed by keyword, proclamation, or case no...',
        clearFeedSearch: 'Clear filter',
        noMatchingFeedPosts: 'No Telegram posts match your search filter.',
        openPost: 'Open Telegram post',
        noTitle: 'Telegram post',
        channel: 'Source',
        groundingToggle: 'Google Search Grounding',
        groundingEnabled: 'ON',
        groundingDisabled: 'OFF',
        groundingDesc: 'Fetch real-time 2025/2026 Ethiopian legal updates & proclamations via Gemini AI & Google Search',
        groundedTitle: 'LIVE GROUNDED ETHIOPIAN LEGAL UPDATES',
        groundedSubtitle: 'Real-time proclamations, regulations & Cassation rulings',
        groundedBadge: '✓ Live Google Search Grounded',
        searchQueriesLabel: 'Google Search Queries:',
        keyTakeawayLabel: 'Key Legal Takeaway:',
        searchPlaceholder: 'Search specific legal topic or proclamation...',
        searchButton: 'Search',
      };
    }

    return {
      feedTitle: 'ODUU FI MURTIILEE TELEGRAM @SEERAAI_ETHIO',
      feedSubtitle: 'Maxxansa haaraa • haaromsuuf cuqaasi',
      loading: 'Maxxansi Telegram fe’amaa jira...',
      noPosts: 'Ammaaf maxxansi agarsiifamu hin jiru.',
      fetchError: 'Maxxansa Telegram fiduun hin milkoofne. Irra deebi’ii yaali.',
      invalidResponse: 'Deebiin tajaajila Telegram irraa dhufe sirnaan hin qindaa’in.',
      copy: 'Garagalchi',
      copied: 'Garagalfame',
      copyFailed: 'Garagalchuun hin milkoofne',
      share: 'Qoodi (Share)',
      shared: 'Qoodame',
      shareCopied: 'Linkiin Qooduu Garagalfame',
      shareFailed: 'Qooduun hin milkoofne',
      exportPdf: 'Gara PDF ergi',
      exportingPdf: 'PDF qopheessaa...',
      exportedPdf: 'PDF buufameera',
      exportPdfFailed: 'PDF baasuun hin milkoofne',
      sortLatest: 'Haaraa (Latest)',
      sortRelevant: 'Barbaachisaa (Most Relevant)',
      feedSearchPlaceholder: 'Maxxansa Telegram keessaa jecha ijoo, labsii ykn lakk. galmee barbaadi...',
      clearFeedSearch: 'Barbaacha haqi',
      noMatchingFeedPosts: 'Maxxansi Telegram barbaacha keessaniin walsimu hin argamne.',
      openPost: 'Maxxansa Telegram bani',
      noTitle: 'Maxxansa Telegram',
      channel: 'Madda',
      groundingToggle: 'Google Search Grounding',
      groundingEnabled: 'BANAA (ON)',
      groundingDisabled: 'CUFAA (OFF)',
      groundingDesc: 'Oduu seeraa fi labsiilee 2025/2026 haaraa Gemini AI & Google Search tiin kallattiin argadhu',
      groundedTitle: 'ODUU SEERAA HAARAA (GOOGLE SEARCH GROUNDED)',
      groundedSubtitle: 'Labsiilee, dambiiwwan fi murtiiwwan Dhaddacha Ijibbaataa kallattiin',
      groundedBadge: '✓ Live Google Search Grounded',
      searchQueriesLabel: 'Jechoota Barbaacha Google:',
      keyTakeawayLabel: 'Qabxii Ijoo Seeraa:',
      searchPlaceholder: 'Mata duree seeraa ykn labsii barbaadi...',
      searchButton: 'Barbaadi',
    };
  }, [languageCode]);

  // Grounding state
  const [isGroundingEnabled, setIsGroundingEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('seeraai_grounding_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const [groundedNews, setGroundedNews] = useState<GroundedNewsItem[]>([]);
  const [isFetchingGrounded, setIsFetchingGrounded] = useState(false);
  const [groundedError, setGroundedError] = useState<string | null>(null);
  const [searchQueriesUsed, setSearchQueriesUsed] = useState<string[]>([]);
  const [customSearchInput, setCustomSearchInput] = useState('');

  // Telegram feed state
  const [syncSettings, setSyncSettings] = useState<TelegramSyncSettings>(() => getTelegramSyncSettings());
  const [telegramFeed, setTelegramFeed] = useState<TelegramFeedItemView[]>([]);
  const [feedSortMode, setFeedSortMode] = useState<TelegramFeedSortMode>('latest');
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  const [isSyncingFeed, setIsSyncingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [copiedFeedId, setCopiedFeedId] = useState<string | null>(null);
  const [copyErrorId, setCopyErrorId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{ id: string; status: 'shared' | 'copied' | 'failed' } | null>(null);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<{ id: string; status: 'exported' | 'failed' } | null>(null);

  const isMountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortedTelegramFeed = useMemo(() => {
    const byChannel = filterTelegramFeedByChannels(telegramFeed, syncSettings.enabledChannels);
    const filtered = filterTelegramFeedItems(byChannel, feedSearchQuery);
    return sortTelegramFeedItems(filtered, feedSortMode);
  }, [telegramFeed, syncSettings.enabledChannels, feedSearchQuery, feedSortMode]);

  // Fetch grounded news from /api/grounded-legal-news
  const handleFetchGroundedNews = useCallback(async (customQuery?: string) => {
    setIsFetchingGrounded(true);
    setGroundedError(null);

    try {
      const q = customQuery?.trim() || 'latest Ethiopian legal proclamations news Supreme Court cassation rulings 2025 2026';
      const response = await fetch(`/api/grounded-legal-news?query=${encodeURIComponent(q)}`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data.ok && Array.isArray(data.items)) {
        setGroundedNews(data.items);
        setSearchQueriesUsed(data.searchQueries || []);
      } else {
        setGroundedError(data.error || 'Failed to parse grounded news payload.');
      }
    } catch (err: unknown) {
      console.warn('Grounded news fetch warning:', err);
      setGroundedError('Oduu seeraa Google Search Grounding irraa fiduun hin milkoofne. Irra deebi\'ii yaali.');
    } finally {
      setIsFetchingGrounded(false);
    }
  }, []);

  // Refresh Telegram feed using active channel sync settings
  const handleRefreshTelegramFeed = useCallback(async (overrideChannels?: TelegramSyncSettings['enabledChannels']) => {
    const activeChannels = overrideChannels ?? syncSettings.enabledChannels;
    const requestId = ++requestIdRef.current;

    if (activeChannels.length === 0) {
      setIsSyncingFeed(false);
      setFeedError(null);
      setTelegramFeed([]);
      return;
    }

    setIsSyncingFeed(true);
    setFeedError(null);

    try {
      const response = (await fetchTelegramChannelFeed(
        buildChannelFeedQueryParam(activeChannels),
        12,
        buildChannelsCsvParam(activeChannels),
      )) as TelegramFeedResponse | null;

      if (!isMountedRef.current || requestId !== requestIdRef.current) return;

      if (!response || !Array.isArray(response.items)) {
        setFeedError(labels.invalidResponse);
        return;
      }

      setTelegramFeed(
        response.items.map((item, index) =>
          normalizeTelegramItem(item, index, labels.noTitle, languageCode),
        ),
      );
    } catch (error) {
      console.warn('Telegram feed fetch error:', error);
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setFeedError(labels.fetchError);
      }
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setIsSyncingFeed(false);
      }
    }
  }, [labels, languageCode, syncSettings.enabledChannels]);

  // Toggle grounding switch
  const handleToggleGrounding = () => {
    const nextState = !isGroundingEnabled;
    setIsGroundingEnabled(nextState);
    try {
      localStorage.setItem('seeraai_grounding_enabled', String(nextState));
    } catch {
      // Ignore storage errors
    }

    if (nextState && groundedNews.length === 0) {
      void handleFetchGroundedNews();
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    void handleRefreshTelegramFeed();

    if (isGroundingEnabled && groundedNews.length === 0) {
      void handleFetchGroundedNews();
    }

    const unsubSettings = onTelegramSyncSettingsUpdated((updated) => {
      if (!isMountedRef.current) return;
      setSyncSettings(updated);
    });

    const unsubFeedSync = onTelegramLiveFeedUpdated((detail) => {
      if (!isMountedRef.current) return;
      const items = detail.channelFeedData?.items;
      if (Array.isArray(items)) {
        setFeedError(null);
        setTelegramFeed(
          items.map((item, index) =>
            normalizeTelegramItem(item, index, labels.noTitle, languageCode),
          ),
        );
      }
    });

    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
      unsubSettings();
      unsubFeedSync();
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      if (shareTimerRef.current) {
        clearTimeout(shareTimerRef.current);
      }
      if (pdfTimerRef.current) {
        clearTimeout(pdfTimerRef.current);
      }
    };
  }, [handleRefreshTelegramFeed, isGroundingEnabled, handleFetchGroundedNews, groundedNews.length, labels.noTitle, languageCode]);

  const handleCopyFeed = async (item: { title: string; text: string; url?: string; id: string }) => {
    const textToCopy = [item.title, item.text, item.url]
      .filter(Boolean)
      .join('\n\n');

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API is unavailable in this browser context.');
      }

      await navigator.clipboard.writeText(textToCopy);
      setCopyErrorId(null);
      setCopiedFeedId(item.id);

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopiedFeedId((current) => (current === item.id ? null : current));
      }, 2000);
    } catch (error) {
      console.warn('Post copy error:', error);
      setCopiedFeedId(null);
      setCopyErrorId(item.id);
    }
  };

  const handleShareFeed = async (item: { id: string; title: string; text: string; url?: string }) => {
    const targetUrl = item.url || TELEGRAM_CHANNEL_URL;
    const result = await shareLegalFeedItem({
      title: item.title,
      text: item.text,
      url: targetUrl,
    });

    if (result.method === 'aborted') return;

    const status =
      result.method === 'web_share'
        ? 'shared'
        : result.method === 'clipboard'
          ? 'copied'
          : 'failed';

    setShareFeedback({ id: item.id, status });
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = setTimeout(() => {
      setShareFeedback((current) => (current?.id === item.id ? null : current));
    }, 2400);

    if (status === 'shared') {
      window.dispatchEvent(
        new CustomEvent('seera:show_toast', {
          detail: { message: labels.shared, emoji: '📤' },
        }),
      );
    } else if (status === 'copied') {
      window.dispatchEvent(
        new CustomEvent('seera:show_toast', {
          detail: { message: labels.shareCopied, emoji: '🔗' },
        }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent('seera:show_toast', {
          detail: { message: labels.shareFailed, emoji: '⚠️' },
        }),
      );
    }
  };

  const handleExportFeedPdf = async (item: TelegramFeedItemView) => {
    if (exportingPdfId) return;
    setExportingPdfId(item.id);
    setPdfFeedback(null);

    try {
      await exportTelegramFeedItemToPdf(item, languageCode);
      if (!isMountedRef.current) return;
      setPdfFeedback({ id: item.id, status: 'exported' });
      window.dispatchEvent(
        new CustomEvent('seera:show_toast', {
          detail: { message: labels.exportedPdf, emoji: '📄' },
        }),
      );
    } catch (error) {
      console.warn('Telegram feed PDF export error:', error);
      if (!isMountedRef.current) return;
      setPdfFeedback({ id: item.id, status: 'failed' });
      window.dispatchEvent(
        new CustomEvent('seera:show_toast', {
          detail: { message: labels.exportPdfFailed, emoji: '⚠️' },
        }),
      );
    } finally {
      if (isMountedRef.current) {
        setExportingPdfId((current) => (current === item.id ? null : current));
      }
      if (pdfTimerRef.current) clearTimeout(pdfTimerRef.current);
      pdfTimerRef.current = setTimeout(() => {
        setPdfFeedback((current) => (current?.id === item.id ? null : current));
      }, 2600);
    }
  };

  const primaryCards = [
    {
      id: 'cassationMaster',
      title: '⚖️ Baafata Murtii Ijibbaataa (Vol 1-25+)',
      subtitle: 'Federal Supreme Court Cassation Precedents Master Index & Updates',
      icon: <Scale className="h-6 w-6 text-emerald-400" aria-hidden="true" />,
      action: () => onNavigate('cassation'),
      border: 'border-emerald-500/60 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950',
    },
    {
      id: 'xiinxalaGalmee',
      title: '⚖️ Xiinxala Galmee (Murtii Aanaa vs Olaanaa)',
      subtitle:
        currentLang === 'am'
          ? 'የወረዳና የከፍተኛ ፍርድ ቤት ውሳኔዎች ንጽጽር እና ሪፖርት (.txt)'
          : currentLang === 'en'
          ? 'Compare Lower & High Court Rulings, Evidence, & Export (.txt)'
          : 'Murtii mana murtii aanaa fi olaanaa wal bira qabiitii report .txt uumi',
      icon: <Scale className="h-6 w-6 text-amber-400" aria-hidden="true" />,
      action: () => onNavigate('xiinxalaGalmee'),
      border: 'border-amber-500/50',
    },
    {
      id: 'templates',
      title: "Sanadoota Qophaa'an & Unkaalee",
      subtitle: 'Prepared Documents & Templates',
      icon: <Layout className="h-6 w-6 text-amber-400" aria-hidden="true" />,
      action: () => onNavigate('templates'),
      border: 'border-amber-500/40',
    },
    {
      id: 'courtDocuments',
      title: 'Kuusaa Sanadoota Mana Murtii (External Storage)',
      subtitle: 'Court Document External Storage',
      icon: <Building2 className="h-6 w-6 text-emerald-400" aria-hidden="true" />,
      action: () => onNavigate('personnelFolder'),
      border: 'border-emerald-500/40',
    },
    {
      id: 'telegramArchive',
      title: 'Arkaba Telegram (Galmee 1,500+)',
      subtitle: 'Telegram Archive & Case Database',
      icon: <Archive className="h-6 w-6 text-sky-400" aria-hidden="true" />,
      action: () => onNavigate('social'),
      border: 'border-sky-500/40',
    },
    {
      id: 'helpFaq',
      title: 'Gargaarsa Seeraa & FAQ (Search Grounding)',
      subtitle: 'Legal Aid & Search Grounding',
      icon: <HelpCircle className="h-6 w-6 text-amber-300" aria-hidden="true" />,
      action: () => onNavigate('faq'),
      border: 'border-amber-400/50',
    },
  ];

  return (
    <main className="animate-in fade-in space-y-6 pb-20">
      {/* Daily Legal Wisdom Card */}
      <DailyLegalWisdomCard currentLang={currentLang} />

      {/* Primary navigation cards */}
      <section aria-label="Primary navigation" className="space-y-4">
        {primaryCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={card.action}
            className={`group flex w-full items-center justify-between rounded-[2rem] border ${card.border} bg-slate-900/90 p-5 text-left shadow-xl transition-all hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`}
          >
            <span className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 shadow-inner transition-colors group-hover:border-indigo-500/50">
                {card.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold text-white transition-colors group-hover:text-indigo-300 sm:text-lg">
                  {card.title}
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                  {card.subtitle}
                </span>
              </span>
            </span>
            <span
              aria-hidden="true"
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-slate-400 transition-all group-hover:bg-indigo-600 group-hover:text-white"
            >
              ›
            </span>
          </button>
        ))}
      </section>

      {/* Grounding Mode Controller Toggle Card */}
      <section className="rounded-[2rem] border border-indigo-500/30 bg-slate-900/90 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950 border border-indigo-500/30 text-indigo-400">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{labels.groundingToggle}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${isGroundingEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                  {isGroundingEnabled ? labels.groundingEnabled : labels.groundingDisabled}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{labels.groundingDesc}</p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isGroundingEnabled}
            onClick={handleToggleGrounding}
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              isGroundingEnabled ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <span className="sr-only">Toggle Google Search Grounding</span>
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isGroundingEnabled ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Dynamic News Feed Section (Switches between Live Grounded Legal News & Telegram Feed based on Toggle) */}
      {isGroundingEnabled ? (
        <section
          aria-labelledby="grounded-feed-heading"
          aria-busy={isFetchingGrounded}
          className="relative space-y-4 overflow-hidden rounded-[2.5rem] border border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 p-6 shadow-2xl animate-in fade-in"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className={`h-3 w-3 shrink-0 rounded-full ${isFetchingGrounded ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    id="grounded-feed-heading"
                    className="text-sm font-black uppercase tracking-wider text-white"
                  >
                    {labels.groundedTitle}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    {labels.groundedBadge}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-amber-200/80">
                  {labels.groundedSubtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleFetchGroundedNews(customSearchInput)}
              disabled={isFetchingGrounded}
              aria-label="Refresh Grounded Legal News"
              title="Refresh Grounded Legal News"
              className="shrink-0 rounded-xl border border-amber-500/30 bg-slate-900 p-2.5 text-amber-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 text-xs font-bold"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4 ${isFetchingGrounded ? 'animate-spin' : ''}`}
              />
              <span>Haaromsi</span>
            </button>
          </div>

          {/* Search Bar for Grounding */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleFetchGroundedNews(customSearchInput);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={customSearchInput}
                onChange={(e) => setCustomSearchInput(e.target.value)}
                placeholder={labels.searchPlaceholder}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isFetchingGrounded}
              className="rounded-xl border border-amber-500/50 bg-amber-600 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-500 transition disabled:opacity-50"
            >
              {labels.searchButton}
            </button>
          </form>

          {/* Search Queries Used Badge */}
          {searchQueriesUsed.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
              <span className="font-bold text-amber-400">{labels.searchQueriesLabel}</span>
              {searchQueriesUsed.map((sq, idx) => (
                <span key={idx} className="rounded-md border border-slate-800 bg-slate-950 px-2 py-0.5 font-mono text-slate-300">
                  {sq}
                </span>
              ))}
            </div>
          )}

          {groundedError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-200"
            >
              {groundedError}
            </div>
          )}

          {isFetchingGrounded && groundedNews.length === 0 && (
            <div role="status" className="flex items-center gap-3 rounded-2xl bg-slate-950/60 p-5 text-sm text-amber-200">
              <RefreshCw className="h-5 w-5 animate-spin text-amber-400" />
              <span>Google Search Grounding fi Gemini AI wajjin oduu seeraa 2025/2026 fe’amaa jira...</span>
            </div>
          )}

          {!isFetchingGrounded && groundedNews.length === 0 && !groundedError && (
            <p className="rounded-2xl border border-amber-500/20 bg-slate-950/60 p-5 text-sm text-slate-300">
              Ammaaf oduun seeraa Google Search Grounding irraa argame hin jiru.
            </p>
          )}

          <div className="space-y-4">
            {groundedNews.map((item) => (
              <article
                key={item.id || item.title}
                className="space-y-3 rounded-2xl border border-amber-500/30 bg-slate-950/90 p-5 shadow-inner"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/60 px-3 py-1 font-mono text-[10px] font-bold text-amber-300">
                    <ShieldCheck className="h-3 w-3 text-amber-400" />
                    {labels.channel}: {item.source || 'Google Search Grounded Legal News'}
                  </span>
                  {item.date && (
                    <time className="font-mono text-[10px] text-amber-200/70">
                      {item.date}
                    </time>
                  )}
                </div>

                <h3 className="text-sm font-bold leading-snug text-white">
                  {item.title}
                </h3>

                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">
                  {item.text}
                </p>

                {item.keyTakeaway && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                    <span className="font-bold text-emerald-400 block mb-1">{labels.keyTakeawayLabel}</span>
                    {item.keyTakeaway}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900 pt-3 text-xs">
                  <button
                    type="button"
                    onClick={() => void handleCopyFeed(item)}
                    className="flex items-center gap-1.5 font-bold text-amber-400 transition hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    {copiedFeedId === item.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>
                      {copiedFeedId === item.id
                        ? labels.copied
                        : copyErrorId === item.id
                          ? labels.copyFailed
                          : labels.copy}
                    </span>
                  </button>

                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 font-bold text-indigo-400 transition hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      <span>Madda Seeraa Bani</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        /* Telegram channel feed section */
        <section
          aria-labelledby="telegram-feed-heading"
          aria-busy={isSyncingFeed}
          className="relative space-y-4 overflow-hidden rounded-[2.5rem] border border-indigo-500/40 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-6 shadow-2xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className={`h-3 w-3 shrink-0 rounded-full ${isSyncingFeed ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`}
              />
              <div className="min-w-0">
                <h2
                  id="telegram-feed-heading"
                  className="text-sm font-black uppercase tracking-wider text-white"
                >
                  {labels.feedTitle}
                </h2>
                <p className="mt-1 font-mono text-[10px] text-indigo-300">
                  {labels.feedSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Sorting Toggle: Latest vs Most Relevant */}
              <div
                role="group"
                aria-label="Sort Telegram Live Feed"
                className="inline-flex items-center rounded-xl border border-indigo-500/30 bg-slate-950/90 p-1 text-[11px] font-bold"
              >
                <button
                  type="button"
                  aria-pressed={feedSortMode === 'latest'}
                  onClick={() => setFeedSortMode('latest')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    feedSortMode === 'latest'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <span>{labels.sortLatest}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={feedSortMode === 'relevant'}
                  onClick={() => setFeedSortMode('relevant')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    feedSortMode === 'relevant'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>{labels.sortRelevant}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleRefreshTelegramFeed()}
                disabled={isSyncingFeed}
                aria-label="Refresh Telegram feed"
                title="Refresh Telegram feed"
                className="shrink-0 rounded-xl border border-indigo-500/30 bg-slate-900 p-2.5 text-indigo-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`h-4 w-4 ${isSyncingFeed ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* Dedicated Sync Settings Section (Channel Toggles & Auto-Sync Frequency) */}
          <TelegramSyncSettingsSection
            currentLang={currentLang}
            variant="indigo"
            onSettingsChange={(updated) => setSyncSettings(updated)}
            onSyncCompleted={() => void handleRefreshTelegramFeed()}
          />

          {/* Searchable Filter Bar for Telegram Live Feed */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400"
              />
              <input
                type="search"
                role="searchbox"
                value={feedSearchQuery}
                onChange={(e) => setFeedSearchQuery(e.target.value)}
                placeholder={labels.feedSearchPlaceholder}
                aria-label={labels.feedSearchPlaceholder}
                className="w-full rounded-xl border border-indigo-500/30 bg-slate-950/90 py-2.5 pl-10 pr-24 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {telegramFeed.length > 0 && (
                  <span className="rounded-md border border-indigo-500/20 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-300">
                    {sortedTelegramFeed.length}/{telegramFeed.length}
                  </span>
                )}
                {feedSearchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setFeedSearchQuery('')}
                    aria-label={labels.clearFeedSearch}
                    title={labels.clearFeedSearch}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {feedError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-sm text-rose-200"
            >
              {feedError}
            </div>
          )}

          {isSyncingFeed && telegramFeed.length === 0 && (
            <p role="status" className="rounded-2xl bg-slate-950/60 p-5 text-sm text-slate-300">
              {labels.loading}
            </p>
          )}

          {!isSyncingFeed && telegramFeed.length === 0 && !feedError && (
            <p className="rounded-2xl border border-indigo-500/20 bg-slate-950/60 p-5 text-sm text-slate-300">
              {labels.noPosts}
            </p>
          )}

          {!isSyncingFeed && telegramFeed.length > 0 && sortedTelegramFeed.length === 0 && !feedError && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-indigo-500/20 bg-slate-950/60 p-5 text-sm text-slate-300">
              <span>{labels.noMatchingFeedPosts}</span>
              <button
                type="button"
                onClick={() => setFeedSearchQuery('')}
                className="self-start sm:self-auto rounded-xl border border-indigo-500/40 bg-indigo-950/60 px-3 py-1.5 text-xs font-bold text-indigo-200 hover:bg-indigo-900/70 transition cursor-pointer"
              >
                {labels.clearFeedSearch}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {sortedTelegramFeed.map((item) => {
              const formattedDate = formatFeedDateLabel(item.date, languageCode);
              const isShareActive = shareFeedback?.id === item.id;
              return (
                <article
                  key={item.id}
                  className="space-y-3 rounded-2xl border border-indigo-500/30 bg-slate-950/80 p-5 shadow-inner"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-indigo-500/40 bg-indigo-900/60 px-3 py-1 font-mono text-[10px] font-bold text-indigo-300">
                        {labels.channel}: @{item.channelHandle || 'seeraai_ethio'}
                      </span>
                      {item.referenceNumber && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                          {item.referenceNumber}
                        </span>
                      )}
                    </div>
                    {formattedDate && (
                      <time
                        dateTime={item.date}
                        className="font-mono text-[10px] text-slate-400"
                      >
                        {formattedDate}
                      </time>
                    )}
                  </div>

                  <h3 className="text-sm font-bold leading-snug text-white">
                    {item.title}
                  </h3>

                  <p className="max-h-32 overflow-hidden whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">
                    {item.text}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900 pt-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => void handleCopyFeed(item)}
                        className="flex items-center gap-1.5 font-bold text-indigo-400 transition hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer"
                      >
                        {copiedFeedId === item.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {copiedFeedId === item.id
                            ? labels.copied
                            : copyErrorId === item.id
                              ? labels.copyFailed
                              : labels.copy}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleShareFeed(item)}
                        aria-label={`${labels.share}: ${item.title}`}
                        className="flex items-center gap-1.5 font-bold text-emerald-400 transition hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
                      >
                        {isShareActive && shareFeedback.status !== 'failed' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                        ) : (
                          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {isShareActive
                            ? shareFeedback.status === 'shared'
                              ? labels.shared
                              : shareFeedback.status === 'copied'
                                ? labels.shareCopied
                                : labels.shareFailed
                            : labels.share}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleExportFeedPdf(item)}
                        disabled={exportingPdfId === item.id}
                        aria-label={`${labels.exportPdf}: ${item.title}`}
                        className="flex items-center gap-1.5 font-bold text-sky-400 transition hover:text-sky-300 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer"
                      >
                        {exportingPdfId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : pdfFeedback?.id === item.id && pdfFeedback.status === 'exported' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {exportingPdfId === item.id
                            ? labels.exportingPdf
                            : pdfFeedback?.id === item.id
                              ? pdfFeedback.status === 'exported'
                                ? labels.exportedPdf
                                : labels.exportPdfFailed
                              : labels.exportPdf}
                        </span>
                      </button>
                    </div>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 font-bold text-amber-400 transition hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <span>{labels.openPost}</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
};
