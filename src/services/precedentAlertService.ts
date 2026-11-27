import type { Language } from '../i18n/translations';
import type { PrecedentComment, PrecedentCommentType } from './precedentCommentService';

export type PrecedentInteractionType =
  | 'comment'
  | 'view_comments'
  | 'bookmark'
  | 'citation_map'
  | 'share'
  | 'copy'
  | 'export_pdf'
  | 'ai_explain'
  | 'annotation'
  | 'deep_link'
  | 'voice_note';

export interface PrecedentInteractionRecord {
  precedentId: string;
  lastInteractionType: PrecedentInteractionType;
  lastInteractedAt: string;
}

export interface PrecedentCommentAlert {
  commentId: string;
  precedentId: string;
  fileNumber: string;
  authorUid: string;
  authorName: string;
  authorRole: string;
  institutionId: string;
  institutionName: string;
  commentType: PrecedentCommentType;
  contentPreview: string;
  createdAt: string;
  isUnread: boolean;
}

const INTERACTIONS_PREFIX = 'seera_court_precedent_interactions_';
const READ_ALERTS_PREFIX = 'seera_court_precedent_alert_read_';
const MAX_INTERACTIONS = 500;
const MAX_READ_ALERT_IDS = 500;

function sanitizeUidKey(uid: string): string {
  return String(uid || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function getRecordedPrecedentInteractions(uid: string): PrecedentInteractionRecord[] {
  const safeUid = sanitizeUidKey(uid);
  const store = getSafeStorage();
  if (!safeUid || !store) return [];

  try {
    const raw = store.getItem(`${INTERACTIONS_PREFIX}${safeUid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PrecedentInteractionRecord =>
        Boolean(item) &&
        typeof item.precedentId === 'string' &&
        item.precedentId.length > 0 &&
        typeof item.lastInteractedAt === 'string'
    );
  } catch {
    return [];
  }
}

export function recordPrecedentInteraction(
  uid: string,
  precedentId: string,
  interactionType: PrecedentInteractionType
): PrecedentInteractionRecord[] {
  const safeUid = sanitizeUidKey(uid);
  const cleanPrecedentId = String(precedentId || '').trim();
  const store = getSafeStorage();
  if (!safeUid || !cleanPrecedentId || !store) {
    return getRecordedPrecedentInteractions(uid);
  }

  const existing = getRecordedPrecedentInteractions(safeUid).filter(
    (item) => item.precedentId !== cleanPrecedentId
  );
  const next: PrecedentInteractionRecord[] = [
    {
      precedentId: cleanPrecedentId,
      lastInteractionType: interactionType,
      lastInteractedAt: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, MAX_INTERACTIONS);

  try {
    store.setItem(`${INTERACTIONS_PREFIX}${safeUid}`, JSON.stringify(next));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('seera_precedent_interactions_changed'));
    }
  } catch {
    // Ignore storage quota errors cleanly
  }

  return next;
}

export function getInteractedPrecedentIds(
  uid: string,
  options?: {
    bookmarkedIds?: string[];
    commentedPrecedentIds?: string[];
  }
): Set<string> {
  const merged = new Set<string>();
  for (const rec of getRecordedPrecedentInteractions(uid)) {
    if (rec.precedentId) merged.add(rec.precedentId);
  }
  if (Array.isArray(options?.bookmarkedIds)) {
    for (const id of options.bookmarkedIds) {
      if (typeof id === 'string' && id.trim()) merged.add(id.trim());
    }
  }
  if (Array.isArray(options?.commentedPrecedentIds)) {
    for (const id of options.commentedPrecedentIds) {
      if (typeof id === 'string' && id.trim()) merged.add(id.trim());
    }
  }
  return merged;
}

export function getReadAlertIds(uid: string): Set<string> {
  const safeUid = sanitizeUidKey(uid);
  const store = getSafeStorage();
  if (!safeUid || !store) return new Set();

  try {
    const raw = store.getItem(`${READ_ALERTS_PREFIX}${safeUid}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

export function markAlertIdsAsRead(uid: string, commentIds: string[]): Set<string> {
  const safeUid = sanitizeUidKey(uid);
  const current = getReadAlertIds(safeUid);
  let changed = false;

  for (const id of commentIds) {
    if (typeof id === 'string' && id.trim() && !current.has(id.trim())) {
      current.add(id.trim());
      changed = true;
    }
  }

  const trimmed = Array.from(current).slice(-MAX_READ_ALERT_IDS);
  const nextSet = new Set(trimmed);
  const store = getSafeStorage();
  if (changed && safeUid && store) {
    try {
      store.setItem(`${READ_ALERTS_PREFIX}${safeUid}`, JSON.stringify(trimmed));
    } catch {
      // Ignore storage errors cleanly
    }
  }
  return nextSet;
}

function buildContentPreview(content: string, maxLen = 140): string {
  const compact = String(content || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen - 1)}…`;
}

/**
 * Computes institutional comment alerts exclusively for precedents that the
 * current user has previously interacted with inside their verified institution,
 * ignoring the user's own comments and personal-private notes.
 */
export function computePrecedentCommentAlerts(params: {
  institutionComments: PrecedentComment[];
  interactedPrecedentIds: Set<string>;
  currentUserUid: string;
  institutionId: string;
  readCommentIds: Set<string>;
  maxAlerts?: number;
}): PrecedentCommentAlert[] {
  const {
    institutionComments,
    interactedPrecedentIds,
    currentUserUid,
    institutionId,
    readCommentIds,
    maxAlerts = 40,
  } = params;

  if (!currentUserUid || !institutionId || interactedPrecedentIds.size === 0) {
    return [];
  }

  const alerts: PrecedentCommentAlert[] = [];
  const seen = new Set<string>();

  const sorted = [...institutionComments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (const c of sorted) {
    if (!c || !c.commentId || seen.has(c.commentId)) continue;
    if (c.institutionId !== institutionId) continue;
    if (c.visibility !== 'institution_private') continue;
    if (c.authorUid === currentUserUid) continue;
    if (!interactedPrecedentIds.has(c.precedentId)) continue;

    seen.add(c.commentId);
    alerts.push({
      commentId: c.commentId,
      precedentId: c.precedentId,
      fileNumber: c.fileNumber,
      authorUid: c.authorUid,
      authorName: c.authorName,
      authorRole: c.authorRole,
      institutionId: c.institutionId,
      institutionName: c.institutionName,
      commentType: c.commentType,
      contentPreview: buildContentPreview(c.content),
      createdAt: c.createdAt,
      isUnread: !readCommentIds.has(c.commentId),
    });

    if (alerts.length >= maxAlerts) break;
  }

  return alerts;
}

export function getPrecedentAlertLabels(lang: Language) {
  if (lang === 'am') {
    return {
      bellLabel: 'ማንቂያዎች',
      title: 'የቀጥታ የተቋም አስተያየት ማንቂያዎች',
      subtitle: 'ቀደም ሲል በተመለከቷቸው ወይም በተገናኙባቸው የሰበር ውሳኔዎች ላይ አዳዲስ ማስታወሻዎች ሲጨመሩ ያሳውቃል።',
      trackingPrefix: 'ክትትል ላይ ያሉ ውሳኔዎች፡',
      markAllRead: 'ሁሉንም እንደተነበበ ምልክት አድርግ',
      enablePush: 'የመሣሪያ ማንቂያ አንቃ',
      pushEnabled: 'የመሣሪያ ማንቂያ ንቁ ነው',
      empty: 'እስካሁን በተገናኙባቸው ውሳኔዎች ላይ አዲስ የባልደረባ አስተያየት የለም።',
      openPrecedent: 'ውሳኔውን ክፈት',
      liveToastTitle: 'አዲስ የተቋም ማስታወሻ ተጨምሯል',
      filePrefix: 'መዝገብ ቁጥር',
      noteTag: 'የግል ማስታወሻ',
      questionTag: 'የሕግ ጥያቄ',
      unreadBadge: 'አዲስ',
    };
  }
  if (lang === 'en') {
    return {
      bellLabel: 'Alerts',
      title: 'Live Institutional Precedent Alerts',
      subtitle: 'Real-time alerts when colleagues add notes or questions on precedents you have interacted with.',
      trackingPrefix: 'Tracked precedents:',
      markAllRead: 'Mark all read',
      enablePush: 'Enable Desktop Alerts',
      pushEnabled: 'Desktop Alerts On',
      empty: 'No colleague notes or questions on your interacted precedents yet.',
      openPrecedent: 'Open Precedent',
      liveToastTitle: 'New Institutional Comment',
      filePrefix: 'File No.',
      noteTag: 'Private Note',
      questionTag: 'Legal Question',
      unreadBadge: 'New',
    };
  }
  return {
    bellLabel: 'Beeksisa',
    title: 'Beeksisa Yaada Dhaabbataa Yeroo Dhugaa',
    subtitle: 'Murteewwan kanaan dura itti hirmaattan irratti yeroo yaadni ykn gaaffiin haaraan dabalamu kallattiin beeksisa argattu.',
    trackingPrefix: 'Murteewwan hordofaman:',
    markAllRead: 'Hunda akka dubbifameetti mallatteessi',
    enablePush: 'Beeksisa Desktop Bani',
    pushEnabled: 'Beeksisni Desktop Banaadha',
    empty: 'Murteewwan itti hirmaattan irratti ammaaf yaadni haaraan miseensota dhaabbataa biraa hin dabalamne.',
    openPrecedent: 'Murtii Bani',
    liveToastTitle: 'Yaadni Dhaabbataa Haaraan Dabalameera',
    filePrefix: 'Lakk. Galmee',
    noteTag: 'Yaadannoo Dhuunfaa',
    questionTag: 'Gaaffii Seeraa',
    unreadBadge: 'Haaraa',
  };
}
