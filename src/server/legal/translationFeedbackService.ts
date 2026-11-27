import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import {
  canReviewGlossary,
  getGlossaryEntryDetail,
  GlossaryCallerIdentity,
  submitGlossaryProposal,
} from './glossaryService';
import type { GlossaryDomain } from '../../shared/legalGlossarySchema';
import {
  CuratedDatasetExportRow,
  formatTranslationDirection,
  isSupportedTranslationLanguage,
  sanitizeCsvCell,
  sanitizeFeedbackText,
  stripReviewerFieldsForUser,
  TERMINOLOGY_REVIEW_OUTCOMES,
  TerminologyReviewOutcome,
  TRANSLATION_FEEDBACK_LIMITS,
  TRANSLATION_FEEDBACK_SCHEMA_VERSION,
  TRANSLATION_FEEDBACK_STATUSES,
  TRANSLATION_MODULES,
  TranslationDirection,
  TranslationFeedbackAuditRecord,
  TranslationFeedbackRecord,
  TranslationFeedbackStatus,
  TranslationIssueCategory,
  TranslationLanguage,
  TranslationModuleId,
  TranslationRecord,
  UserVisibleTranslationFeedback,
  validateTranslationFeedbackPayload,
} from '../../shared/translationFeedbackSchema';

export const TRANSLATION_RECORDS_COLLECTION = 'translation_records';
export const TRANSLATION_FEEDBACK_COLLECTION = 'translation_feedback';
export const TRANSLATION_FEEDBACK_RATE_LIMITS_COLLECTION = 'translation_feedback_rate_limits';
export const TRANSLATION_FEEDBACK_AUDIT_COLLECTION = 'translation_feedback_audit_logs';

export const SERVER_APP_VERSION = process.env.SEERAAI_APP_VERSION || '5.0.0';
export const SERVER_TRANSLATION_PROMPT_VERSION =
  process.env.SEERAAI_TRANSLATION_PROMPT_VERSION || 'legal-translate-v5.0';
export const SERVER_GLOSSARY_VERSION =
  process.env.SEERAAI_GLOSSARY_VERSION || 'trilingual-glossary-v1.0';

export type TranslationFeedbackCaller = GlossaryCallerIdentity;

const GLOBAL_ADMIN_ROLES = new Set(['admin', 'superadmin', 'super_admin']);
const INSTITUTIONAL_REVIEWER_ROLES = new Set(['court_admin', 'judge', 'legal_expert']);

export function isGlobalTranslationReviewer(caller: TranslationFeedbackCaller): boolean {
  if (!caller.uid || caller.uid === 'guest') return false;
  if (caller.signInProvider === 'anonymous' || caller.emailVerified !== true) return false;
  if (caller.isAdminClaim || caller.legalContentManagerClaim) return true;
  const role = (caller.role || '').trim().toLowerCase();
  return GLOBAL_ADMIN_ROLES.has(role);
}

export function canReviewTranslationFeedback(caller: TranslationFeedbackCaller): boolean {
  if (!caller.uid || caller.uid === 'guest') return false;
  if (caller.signInProvider === 'anonymous' || caller.signInProvider === 'phone' || caller.emailVerified !== true) return false;
  if (isGlobalTranslationReviewer(caller)) return true;

  const role = (caller.role || '').trim().toLowerCase();
  return Boolean(caller.institutionId) && INSTITUTIONAL_REVIEWER_ROLES.has(role);
}

export function canSubmitTranslationFeedback(caller: TranslationFeedbackCaller): boolean {
  if (!caller.uid || caller.uid === 'guest') return false;
  if (caller.signInProvider === 'anonymous' || caller.signInProvider === 'phone' || caller.emailVerified !== true) return false;
  return true;
}

export function resolveProviderForModel(model: string): string {
  const normalized = (model || '').toLowerCase();
  if (normalized.startsWith('gemini')) return 'google_genai';
  if (normalized.startsWith('seeraai')) return 'seeraai_engine';
  return 'server_configured';
}

function canReviewerAccessRecord(
  caller: TranslationFeedbackCaller,
  record: Pick<TranslationFeedbackRecord, 'institutionId'>
): boolean {
  if (!canReviewTranslationFeedback(caller)) return false;
  if (isGlobalTranslationReviewer(caller)) return true;
  // Institutional reviewers are strictly scoped to their own institutionId
  return Boolean(caller.institutionId && record.institutionId === caller.institutionId);
}

// Local deterministic caches / fallback stores for isolated tests and resilient fallback
// when Admin Firestore lacks local IAM credentials
const localTranslationRecordsMap = new Map<string, TranslationRecord>();
const localFeedbackMap = new Map<string, TranslationFeedbackRecord>();
const localRateLimitMap = new Map<string, { windowStartMs: number; count: number }>();
const localAuditLogs: TranslationFeedbackAuditRecord[] = [];

export function resetTranslationFeedbackStoreForTests(): void {
  localTranslationRecordsMap.clear();
  localFeedbackMap.clear();
  localRateLimitMap.clear();
  localAuditLogs.length = 0;
}

export function getTranslationFeedbackAuditLogsInMemoryForTests(): TranslationFeedbackAuditRecord[] {
  return [...localAuditLogs];
}

async function safeAppendFeedbackAuditLog(
  db: Firestore | null,
  record: TranslationFeedbackAuditRecord
): Promise<void> {
  localAuditLogs.unshift(record);
  if (db) {
    try {
      await db.collection(TRANSLATION_FEEDBACK_AUDIT_COLLECTION).doc(record.auditId).set(record);
    } catch (err: any) {
      console.warn('[TranslationFeedbackService] Audit log Firestore write fallback:', err?.message || err);
    }
  }
}

export interface CreateTranslationRecordInput {
  ownerUid: string | null;
  institutionId?: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  isRewrite: boolean;
  module?: TranslationModuleId;
  model: string;
}

export async function recordIssuedTranslation(
  db: Firestore | null,
  input: CreateTranslationRecordInput
): Promise<TranslationRecord> {
  const translationId = `trn_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  const createdAt = new Date().toISOString();
  const moduleId: TranslationModuleId = (TRANSLATION_MODULES as readonly string[]).includes(
    input.module || ''
  )
    ? (input.module as TranslationModuleId)
    : 'api_translate';

  const record: TranslationRecord = {
    translationId,
    ownerUid: input.ownerUid,
    ...(input.institutionId ? { institutionId: input.institutionId } : {}),
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    isRewrite: Boolean(input.isRewrite),
    module: moduleId,
    provider: resolveProviderForModel(input.model),
    model: input.model || 'gemini-4-hydrogen',
    promptVersion: SERVER_TRANSLATION_PROMPT_VERSION,
    glossaryVersion: SERVER_GLOSSARY_VERSION,
    appVersion: SERVER_APP_VERSION,
    createdAt,
  };

  localTranslationRecordsMap.set(translationId, record);

  if (db) {
    try {
      await db.collection(TRANSLATION_RECORDS_COLLECTION).doc(translationId).set(record);
    } catch (err: any) {
      console.warn('[TranslationFeedbackService] Translation record Firestore write fallback:', err?.message || err);
    }
  }

  return record;
}

export async function getTranslationRecordById(
  db: Firestore | null,
  translationId: string
): Promise<TranslationRecord | null> {
  const local = localTranslationRecordsMap.get(translationId);
  if (local) return local;

  if (db) {
    try {
      const snap = await db.collection(TRANSLATION_RECORDS_COLLECTION).doc(translationId).get();
      if (snap.exists) {
        const data = snap.data() as TranslationRecord;
        if (data?.translationId) {
          localTranslationRecordsMap.set(data.translationId, data);
          return data;
        }
      }
    } catch (err: any) {
      console.warn('[TranslationFeedbackService] Translation record Firestore lookup fallback:', err?.message || err);
    }
  }

  return null;
}

async function enforcePersistentRateLimit(
  db: Firestore | null,
  uid: string,
  nowMs: number = Date.now()
): Promise<void> {
  const maxCount = TRANSLATION_FEEDBACK_LIMITS.rateLimitMaxPerWindow;
  const windowMs = TRANSLATION_FEEDBACK_LIMITS.rateLimitWindowMs;

  if (db) {
    try {
      const ref = db.collection(TRANSLATION_FEEDBACK_RATE_LIMITS_COLLECTION).doc(uid);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? (snap.data() as { windowStartMs?: number; count?: number }) : null;
        const windowStartMs =
          data && typeof data.windowStartMs === 'number' && nowMs - data.windowStartMs < windowMs
            ? data.windowStartMs
            : nowMs;
        const currentCount =
          data && typeof data.windowStartMs === 'number' && nowMs - data.windowStartMs < windowMs
            ? Number(data.count || 0)
            : 0;

        if (currentCount >= maxCount) {
          throw new Error(
            'RATE_LIMITED: Too many translation feedback submissions in the current hour. Please try again later.'
          );
        }

        tx.set(ref, {
          uid,
          windowStartMs,
          count: currentCount + 1,
          updatedAt: new Date(nowMs).toISOString(),
        });
      });
      return;
    } catch (err: any) {
      if (err instanceof Error && err.message.startsWith('RATE_LIMITED:')) {
        throw err;
      }
      // Fall back to in-memory limiter if Firestore IAM is unavailable locally
      console.warn('[TranslationFeedbackService] Firestore rate limit fallback:', err?.message || err);
    }
  }

  const prev = localRateLimitMap.get(uid);
  if (!prev || nowMs - prev.windowStartMs >= windowMs) {
    localRateLimitMap.set(uid, { windowStartMs: nowMs, count: 1 });
    return;
  }
  if (prev.count >= maxCount) {
    throw new Error(
      'RATE_LIMITED: Too many translation feedback submissions in the current hour. Please try again later.'
    );
  }
  prev.count += 1;
  localRateLimitMap.set(uid, prev);
}

function makeDeterministicFeedbackId(uid: string, translationId: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${uid}:${translationId}`)
    .digest('hex')
    .slice(0, 20);
  return `tfb_${hash}`;
}

export async function submitTranslationFeedback(
  db: Firestore | null,
  caller: TranslationFeedbackCaller,
  rawPayload: unknown
): Promise<UserVisibleTranslationFeedback> {
  if (!canSubmitTranslationFeedback(caller)) {
    throw new Error(
      'UNAUTHORIZED: A verified non-anonymous account is required to submit translation feedback.'
    );
  }

  const validation = validateTranslationFeedbackPayload(rawPayload);
  if (!validation.ok) {
    throw new Error(`VALIDATION_ERROR: ${validation.error}`);
  }
  const input = validation.value;

  const translationRecord = await getTranslationRecordById(db, input.translationId);
  if (!translationRecord) {
    throw new Error(`NOT_FOUND: Translation ${input.translationId} was not found.`);
  }

  // Verify caller is authorized to reference this exact translation
  const isOwner = translationRecord.ownerUid !== null && translationRecord.ownerUid === caller.uid;
  const isSameInstitution =
    Boolean(translationRecord.institutionId) &&
    Boolean(caller.institutionId) &&
    translationRecord.institutionId === caller.institutionId;

  if (!isOwner && !isSameInstitution) {
    throw new Error(
      'FORBIDDEN: You are not authorized to submit feedback for this translation.'
    );
  }

  if (translationRecord.isRewrite) {
    throw new Error(
      'VALIDATION_ERROR: Cross-language translation feedback is only supported for translations between two distinct languages.'
    );
  }

  if (
    translationRecord.sourceLanguage !== input.sourceLanguage ||
    translationRecord.targetLanguage !== input.targetLanguage
  ) {
    throw new Error(
      'VALIDATION_ERROR: Submitted language pair does not match the referenced translation record.'
    );
  }

  // Deterministic feedback ID prevents duplicate/race-condition submissions per (user, translationId)
  const feedbackId = makeDeterministicFeedbackId(caller.uid, input.translationId);

  if (localFeedbackMap.has(feedbackId)) {
    throw new Error(
      'DUPLICATE_SUBMISSION: You have already submitted feedback for this translation.'
    );
  }

  if (db) {
    try {
      const col = db.collection(TRANSLATION_FEEDBACK_COLLECTION);
      const docRef = col.doc(feedbackId);
      const privRef = docRef.collection('private_review').doc('decision');
      const [existingSnap, privSnap] = await Promise.all([docRef.get(), privRef.get()]);
      if (existingSnap.exists) {
        const baseRec = existingSnap.data() as TranslationFeedbackRecord;
        const privData = privSnap.exists ? (privSnap.data() as Partial<TranslationFeedbackRecord>) : {};
        localFeedbackMap.set(feedbackId, { ...baseRec, ...privData });
        throw new Error(
          'DUPLICATE_SUBMISSION: You have already submitted feedback for this translation.'
        );
      }
    } catch (err: any) {
      if (err instanceof Error && err.message.startsWith('DUPLICATE_SUBMISSION:')) {
        throw err;
      }
    }
  }

  await enforcePersistentRateLimit(db, caller.uid);

  // If terminology correction references a glossaryTermId, enrich conceptId from verified glossary if present
  let terminologyCorrection = input.terminologyCorrection
    ? { ...input.terminologyCorrection }
    : undefined;
  if (terminologyCorrection?.glossaryTermId) {
    const detail = await getGlossaryEntryDetail(db, terminologyCorrection.glossaryTermId, caller);
    if (detail?.entry) {
      terminologyCorrection.conceptId = detail.entry.conceptId;
    } else {
      delete terminologyCorrection.glossaryTermId;
    }
  }

  const now = new Date().toISOString();
  const effectiveInstitutionId = translationRecord.institutionId || caller.institutionId;

  // Authoritative metadata is strictly populated server-side from translationRecord / server config
  const record: TranslationFeedbackRecord = {
    feedbackId,
    schemaVersion: TRANSLATION_FEEDBACK_SCHEMA_VERSION,
    translationId: translationRecord.translationId,
    sourceLanguage: translationRecord.sourceLanguage,
    targetLanguage: translationRecord.targetLanguage,
    direction: formatTranslationDirection(
      translationRecord.sourceLanguage,
      translationRecord.targetLanguage
    ),
    module: translationRecord.module,
    translationCreatedAt: translationRecord.createdAt,
    provider: translationRecord.provider,
    model: translationRecord.model,
    promptVersion: translationRecord.promptVersion,
    glossaryVersion: translationRecord.glossaryVersion,
    appVersion: translationRecord.appVersion,
    overallRating: input.overallRating,
    ...(input.accuracyRating !== undefined ? { accuracyRating: input.accuracyRating } : {}),
    ...(input.terminologyRating !== undefined ? { terminologyRating: input.terminologyRating } : {}),
    ...(input.completenessRating !== undefined
      ? { completenessRating: input.completenessRating }
      : {}),
    ...(input.readabilityRating !== undefined ? { readabilityRating: input.readabilityRating } : {}),
    issueCategories: input.issueCategories,
    comment: input.comment || '',
    ...(terminologyCorrection ? { terminologyCorrection } : {}),
    submittedBy: caller.uid,
    ...(effectiveInstitutionId ? { institutionId: effectiveInstitutionId } : {}),
    submittedAt: now,
    updatedAt: now,
    status: 'submitted',
    consentToCuratedDataset: input.consentToCuratedDataset === true,
    ...(input.consentToCuratedDataset === true ? { consentRecordedAt: now } : {}),
  };

  if (db) {
    try {
      await db.collection(TRANSLATION_FEEDBACK_COLLECTION).doc(feedbackId).create(record);
    } catch (err: any) {
      if (err?.code === 6 || String(err?.message || '').includes('ALREADY_EXISTS')) {
        throw new Error(
          'DUPLICATE_SUBMISSION: You have already submitted feedback for this translation.'
        );
      }
      console.warn('[TranslationFeedbackService] Feedback Firestore write fallback:', err?.message || err);
    }
  }

  localFeedbackMap.set(feedbackId, record);

  await safeAppendFeedbackAuditLog(db, {
    auditId: `tfbaud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    action: 'FEEDBACK_SUBMITTED',
    feedbackId,
    translationId: record.translationId,
    actorUid: caller.uid,
    actorRole: caller.role || 'user',
    ...(effectiveInstitutionId ? { institutionId: effectiveInstitutionId } : {}),
    newStatus: 'submitted',
    timestamp: now,
  });

  return stripReviewerFieldsForUser(record);
}

export async function listMyTranslationFeedback(
  db: Firestore | null,
  caller: TranslationFeedbackCaller,
  limitCount = 50
): Promise<UserVisibleTranslationFeedback[]> {
  if (!canSubmitTranslationFeedback(caller)) {
    throw new Error(
      'UNAUTHORIZED: A verified non-anonymous account is required to view your feedback.'
    );
  }

  const merged = new Map<string, TranslationFeedbackRecord>();
  for (const item of localFeedbackMap.values()) {
    if (item.submittedBy === caller.uid) {
      merged.set(item.feedbackId, item);
    }
  }

  if (db) {
    try {
      const snap = await db
        .collection(TRANSLATION_FEEDBACK_COLLECTION)
        .where('submittedBy', '==', caller.uid)
        .limit(Math.min(100, Math.max(1, limitCount)))
        .get();
      for (const docSnap of snap.docs) {
        const rec = docSnap.data() as TranslationFeedbackRecord;
        if (rec?.feedbackId) {
          const cached = localFeedbackMap.get(rec.feedbackId);
          // Preserve cached private fields for reviewer in-memory map while never returning them to user
          merged.set(rec.feedbackId, cached ? { ...rec, ...cached } : rec);
          if (!cached) {
            localFeedbackMap.set(rec.feedbackId, rec);
          }
        }
      }
    } catch (err: any) {
      console.warn('[TranslationFeedbackService] listMyTranslationFeedback fallback:', err?.message || err);
    }
  }

  return Array.from(merged.values())
    .filter((r) => r.submittedBy === caller.uid)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, limitCount)
    .map(stripReviewerFieldsForUser);
}

export interface ReviewFeedbackFilterOptions {
  translationId?: string;
  sourceLanguage?: TranslationLanguage | 'all';
  targetLanguage?: TranslationLanguage | 'all';
  status?: TranslationFeedbackStatus | 'all';
  issueCategory?: TranslationIssueCategory | 'all';
  minRating?: number;
  maxRating?: number;
  dateFrom?: string;
  dateTo?: string;
  termQuery?: string;
  modelVersion?: string;
  limit?: number;
}

async function loadScopedFeedbackForReviewer(
  db: Firestore | null,
  reviewer: TranslationFeedbackCaller
): Promise<TranslationFeedbackRecord[]> {
  if (!canReviewTranslationFeedback(reviewer)) {
    throw new Error(
      'FORBIDDEN: Only authorized legal reviewers or administrators may inspect feedback queue.'
    );
  }

  const isGlobal = isGlobalTranslationReviewer(reviewer);
  const merged = new Map<string, TranslationFeedbackRecord>();

  for (const rec of localFeedbackMap.values()) {
    if (isGlobal || (reviewer.institutionId && rec.institutionId === reviewer.institutionId)) {
      merged.set(rec.feedbackId, rec);
    }
  }

  if (db) {
    try {
      const col = db.collection(TRANSLATION_FEEDBACK_COLLECTION);
      const snap = isGlobal
        ? await col.limit(500).get()
        : await col.where('institutionId', '==', reviewer.institutionId!).limit(500).get();

      const baseRecords: TranslationFeedbackRecord[] = [];
      for (const docSnap of snap.docs) {
        const rec = docSnap.data() as TranslationFeedbackRecord;
        if (rec?.feedbackId) {
          baseRecords.push(rec);
        }
      }

      if (baseRecords.length > 0) {
        const privRefs = baseRecords.map((rec) =>
          col.doc(rec.feedbackId).collection('private_review').doc('decision')
        );
        const privSnaps =
          typeof db.getAll === 'function'
            ? await db.getAll(...privRefs)
            : await Promise.all(privRefs.map((ref) => ref.get()));

        for (let i = 0; i < baseRecords.length; i++) {
          const base = baseRecords[i];
          const priv = privSnaps[i]?.exists
            ? (privSnaps[i].data() as Partial<TranslationFeedbackRecord>)
            : {};
          const fullRec: TranslationFeedbackRecord = { ...base, ...priv };
          merged.set(fullRec.feedbackId, fullRec);
          localFeedbackMap.set(fullRec.feedbackId, fullRec);
        }
      }
    } catch (err: any) {
      console.warn('[TranslationFeedbackService] Reviewer Firestore load fallback:', err?.message || err);
    }
  }

  return Array.from(merged.values()).filter((r) => canReviewerAccessRecord(reviewer, r));
}

function applyReviewerFilters(
  records: TranslationFeedbackRecord[],
  filters: ReviewFeedbackFilterOptions
): TranslationFeedbackRecord[] {
  const termNorm = (filters.termQuery || '').normalize('NFC').trim().toLowerCase();
  const modelFilter = (filters.modelVersion || '').trim().toLowerCase();
  const translationFilter = (filters.translationId || '').trim();

  return records
    .filter((rec) => {
      if (translationFilter && rec.translationId !== translationFilter) return false;
      if (
        filters.sourceLanguage &&
        filters.sourceLanguage !== 'all' &&
        isSupportedTranslationLanguage(filters.sourceLanguage) &&
        rec.sourceLanguage !== filters.sourceLanguage
      ) {
        return false;
      }
      if (
        filters.targetLanguage &&
        filters.targetLanguage !== 'all' &&
        isSupportedTranslationLanguage(filters.targetLanguage) &&
        rec.targetLanguage !== filters.targetLanguage
      ) {
        return false;
      }
      if (filters.status && filters.status !== 'all' && rec.status !== filters.status) {
        return false;
      }
      if (
        filters.issueCategory &&
        filters.issueCategory !== 'all' &&
        !rec.issueCategories.includes(filters.issueCategory)
      ) {
        return false;
      }
      if (typeof filters.minRating === 'number' && rec.overallRating < filters.minRating) {
        return false;
      }
      if (typeof filters.maxRating === 'number' && rec.overallRating > filters.maxRating) {
        return false;
      }
      if (filters.dateFrom && rec.submittedAt < filters.dateFrom) return false;
      if (filters.dateTo && rec.submittedAt > filters.dateTo) return false;
      if (modelFilter && rec.model.toLowerCase() !== modelFilter) return false;
      if (termNorm) {
        const haystack = [
          rec.terminologyCorrection?.sourceTerm || '',
          rec.terminologyCorrection?.currentTargetTerm || '',
          rec.terminologyCorrection?.suggestedTargetTerm || '',
          rec.terminologyCorrection?.legalReference || '',
          rec.comment || '',
        ]
          .join(' ')
          .normalize('NFC')
          .toLowerCase();
        if (!haystack.includes(termNorm)) return false;
      }
      return true;
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function searchReviewTranslationFeedback(
  db: Firestore | null,
  reviewer: TranslationFeedbackCaller,
  filters: ReviewFeedbackFilterOptions = {}
): Promise<TranslationFeedbackRecord[]> {
  const scoped = await loadScopedFeedbackForReviewer(db, reviewer);
  const filtered = applyReviewerFilters(scoped, filters);
  const maxItems = Math.min(250, Math.max(1, filters.limit || 100));
  return filtered.slice(0, maxItems);
}

export interface TranslationQualityMetricsSummary {
  totalFeedbackCount: number;
  averageOverallRating: number | null;
  lowSampleThreshold: number;
  byDirection: Array<{
    direction: TranslationDirection;
    count: number;
    averageRating: number;
    lowSampleSize: boolean;
  }>;
  byModel: Array<{
    model: string;
    provider: string;
    count: number;
    averageRating: number;
    lowSampleSize: boolean;
  }>;
  byIssueCategory: Array<{
    category: TranslationIssueCategory;
    count: number;
  }>;
  byStatus: Record<TranslationFeedbackStatus, number>;
  consentedAcceptedCount: number;
}

export async function computeFeedbackQualityMetrics(
  db: Firestore | null,
  reviewer: TranslationFeedbackCaller,
  filters: ReviewFeedbackFilterOptions = {}
): Promise<TranslationQualityMetricsSummary> {
  const scoped = await loadScopedFeedbackForReviewer(db, reviewer);
  const filtered = applyReviewerFilters(scoped, filters);
  const LOW_SAMPLE_THRESHOLD = 5;

  const totalFeedbackCount = filtered.length;
  const ratingSum = filtered.reduce((acc, r) => acc + r.overallRating, 0);
  const averageOverallRating =
    totalFeedbackCount > 0 ? Number((ratingSum / totalFeedbackCount).toFixed(2)) : null;

  const dirMap = new Map<TranslationDirection, { count: number; sum: number }>();
  const modelMap = new Map<string, { provider: string; count: number; sum: number }>();
  const catMap = new Map<TranslationIssueCategory, number>();
  const byStatus: Record<TranslationFeedbackStatus, number> = {
    submitted: 0,
    under_review: 0,
    accepted: 0,
    rejected: 0,
    needs_clarification: 0,
  };
  let consentedAcceptedCount = 0;

  for (const r of filtered) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.status === 'accepted' && r.consentToCuratedDataset) {
      consentedAcceptedCount += 1;
    }

    const d = dirMap.get(r.direction) || { count: 0, sum: 0 };
    d.count += 1;
    d.sum += r.overallRating;
    dirMap.set(r.direction, d);

    const m = modelMap.get(r.model) || { provider: r.provider, count: 0, sum: 0 };
    m.count += 1;
    m.sum += r.overallRating;
    modelMap.set(r.model, m);

    for (const c of r.issueCategories) {
      catMap.set(c, (catMap.get(c) || 0) + 1);
    }
  }

  return {
    totalFeedbackCount,
    averageOverallRating,
    lowSampleThreshold: LOW_SAMPLE_THRESHOLD,
    byDirection: Array.from(dirMap.entries())
      .map(([direction, v]) => ({
        direction,
        count: v.count,
        averageRating: Number((v.sum / v.count).toFixed(2)),
        lowSampleSize: v.count < LOW_SAMPLE_THRESHOLD,
      }))
      .sort((a, b) => b.count - a.count),
    byModel: Array.from(modelMap.entries())
      .map(([model, v]) => ({
        model,
        provider: v.provider,
        count: v.count,
        averageRating: Number((v.sum / v.count).toFixed(2)),
        lowSampleSize: v.count < LOW_SAMPLE_THRESHOLD,
      }))
      .sort((a, b) => b.count - a.count),
    byIssueCategory: Array.from(catMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    byStatus,
    consentedAcceptedCount,
  };
}

export interface ModerateTranslationFeedbackInput {
  feedbackId: string;
  decision: Exclude<TranslationFeedbackStatus, 'submitted'>;
  decisionReason: string;
  reviewerNotes?: string;
  terminologyOutcome?: TerminologyReviewOutcome;
  escalateToGlossary?: boolean;
  glossaryDomain?: GlossaryDomain;
}

export async function moderateTranslationFeedback(
  db: Firestore | null,
  reviewer: TranslationFeedbackCaller,
  input: ModerateTranslationFeedbackInput
): Promise<{
  feedback: TranslationFeedbackRecord;
  escalatedGlossarySubmissionId?: string;
}> {
  if (!canReviewTranslationFeedback(reviewer)) {
    throw new Error(
      'FORBIDDEN: Only authorized legal reviewers or administrators may moderate translation feedback.'
    );
  }

  const validDecisions = new Set<string>(
    TRANSLATION_FEEDBACK_STATUSES.filter((s) => s !== 'submitted')
  );
  if (!validDecisions.has(input.decision)) {
    throw new Error(
      'VALIDATION_ERROR: decision must be under_review, accepted, rejected, or needs_clarification.'
    );
  }

  const decisionReason = sanitizeFeedbackText(
    input.decisionReason,
    TRANSLATION_FEEDBACK_LIMITS.maxDecisionReasonLength
  );
  if (!decisionReason) {
    throw new Error('VALIDATION_ERROR: decisionReason explaining the moderation action is required.');
  }

  const reviewerNotes = sanitizeFeedbackText(
    input.reviewerNotes || '',
    TRANSLATION_FEEDBACK_LIMITS.maxReviewerNotesLength
  );

  if (
    input.terminologyOutcome &&
    !(TERMINOLOGY_REVIEW_OUTCOMES as readonly string[]).includes(input.terminologyOutcome)
  ) {
    throw new Error('VALIDATION_ERROR: Invalid terminologyOutcome value.');
  }

  let existing = localFeedbackMap.get(input.feedbackId);
  if (!existing && db) {
    try {
      const docRef = db.collection(TRANSLATION_FEEDBACK_COLLECTION).doc(input.feedbackId);
      const privRef = docRef.collection('private_review').doc('decision');
      const [snap, privSnap] = await Promise.all([docRef.get(), privRef.get()]);
      if (snap.exists) {
        const baseRec = snap.data() as TranslationFeedbackRecord;
        const privData = privSnap.exists ? (privSnap.data() as Partial<TranslationFeedbackRecord>) : {};
        existing = { ...baseRec, ...privData };
        localFeedbackMap.set(existing.feedbackId, existing);
      }
    } catch {
      // fallback
    }
  }

  if (!existing) {
    throw new Error(`NOT_FOUND: Translation feedback ${input.feedbackId} does not exist.`);
  }

  if (!canReviewerAccessRecord(reviewer, existing)) {
    throw new Error(
      'FORBIDDEN: Institutional scope prevents moderating feedback outside your institution.'
    );
  }

  const now = new Date().toISOString();
  let escalatedGlossarySubmissionId = existing.escalatedGlossarySubmissionId;

  // Escalate proposed terminology change to the existing Glossary human-approval queue (NEVER auto-updates legal_glossary)
  if (
    input.escalateToGlossary &&
    existing.terminologyCorrection &&
    !escalatedGlossarySubmissionId
  ) {
    if (!canReviewGlossary(reviewer)) {
      throw new Error(
        'FORBIDDEN: Caller lacks glossary reviewer authority to escalate terminology corrections.'
      );
    }

    const tc = existing.terminologyCorrection;
    const srcLang = existing.sourceLanguage;
    const tgtLang = existing.targetLanguage;
    const domain: GlossaryDomain = input.glossaryDomain || 'other';
    const jurisdictionList = [tc.jurisdiction || 'Federal Ethiopia'];
    const definitionText =
      tc.explanation ||
      `Proposed correction from translation feedback ${existing.feedbackId}: "${tc.currentTargetTerm}" -> "${tc.suggestedTargetTerm}"`;

    const termsBlock = {
      om: { preferred: srcLang === 'om' ? tc.sourceTerm : tgtLang === 'om' ? tc.suggestedTargetTerm : '', synonyms: [] as string[] },
      am: { preferred: srcLang === 'am' ? tc.sourceTerm : tgtLang === 'am' ? tc.suggestedTargetTerm : '', synonyms: [] as string[] },
      en: { preferred: srcLang === 'en' ? tc.sourceTerm : tgtLang === 'en' ? tc.suggestedTargetTerm : '', synonyms: [] as string[] },
    };

    const defsBlock = {
      om: srcLang === 'om' ? definitionText : '',
      am: srcLang === 'am' ? definitionText : '',
      en: srcLang === 'en' ? definitionText : '',
    };

    const sourceReferences = tc.legalReference
      ? [
          {
            sourceType: 'other' as const,
            title: tc.legalReference,
          },
        ]
      : [];

    const glossarySub = await submitGlossaryProposal(db, reviewer, {
      submissionType: tc.glossaryTermId ? 'revision' : 'new_term',
      ...(tc.glossaryTermId ? { targetTermId: tc.glossaryTermId } : {}),
      aiAssistedDraft: false,
      proposedEntry: {
        sourceLanguage: srcLang,
        terms: termsBlock,
        definitions: defsBlock,
        translationNotes: {
          [tgtLang]: `Suggested replacing "${tc.currentTargetTerm}" with "${tc.suggestedTargetTerm}" (feedback ${existing.feedbackId}).`,
        },
        domain,
        jurisdiction: jurisdictionList,
        sourceReferences,
        isGeneralLegalDefinition: sourceReferences.length === 0,
        ...(sourceReferences.length === 0
          ? { noSourceJustification: 'Escalated from translation feedback pending legal verification.' }
          : {}),
      },
    });

    escalatedGlossarySubmissionId = glossarySub.submissionId;

    await safeAppendFeedbackAuditLog(db, {
      auditId: `tfbaud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      action: 'TERMINOLOGY_ESCALATED',
      feedbackId: existing.feedbackId,
      translationId: existing.translationId,
      actorUid: reviewer.uid,
      actorRole: reviewer.role || 'reviewer',
      ...(existing.institutionId ? { institutionId: existing.institutionId } : {}),
      decisionReason: `Escalated to glossary submission ${escalatedGlossarySubmissionId}`,
      timestamp: now,
    });
  }

  const updated: TranslationFeedbackRecord = {
    ...existing,
    status: input.decision,
    updatedAt: now,
    reviewedBy: reviewer.uid,
    reviewedAt: now,
    reviewDecision: input.decision,
    decisionReason,
    ...(reviewerNotes ? { reviewerNotes } : existing.reviewerNotes ? { reviewerNotes: existing.reviewerNotes } : {}),
    ...(input.terminologyOutcome
      ? { terminologyOutcome: input.terminologyOutcome }
      : existing.terminologyOutcome
      ? { terminologyOutcome: existing.terminologyOutcome }
      : {}),
    ...(escalatedGlossarySubmissionId ? { escalatedGlossarySubmissionId } : {}),
  };

  if (db) {
    try {
      const parentDocRef = db.collection(TRANSLATION_FEEDBACK_COLLECTION).doc(updated.feedbackId);
      const privateReviewRef = parentDocRef.collection('private_review').doc('decision');

      // Physically separate private reviewer metadata from the user-readable parent doc
      const parentPublicSafePayload = {
        ...stripReviewerFieldsForUser(updated),
        module: updated.module,
        translationCreatedAt: updated.translationCreatedAt,
        provider: updated.provider,
        model: updated.model,
        promptVersion: updated.promptVersion,
        glossaryVersion: updated.glossaryVersion,
        appVersion: updated.appVersion,
        ...(updated.consentRecordedAt ? { consentRecordedAt: updated.consentRecordedAt } : {}),
      };

      const privateReviewPayload = {
        feedbackId: updated.feedbackId,
        ...(updated.institutionId ? { institutionId: updated.institutionId } : {}),
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt,
        reviewDecision: updated.reviewDecision,
        decisionReason: updated.decisionReason,
        ...(updated.reviewerNotes ? { reviewerNotes: updated.reviewerNotes } : {}),
        ...(updated.terminologyOutcome ? { terminologyOutcome: updated.terminologyOutcome } : {}),
      };

      await Promise.all([
        parentDocRef.set(parentPublicSafePayload),
        privateReviewRef.set(privateReviewPayload),
      ]);
    } catch (err: any) {
      console.warn('[TranslationFeedbackService] Moderation Firestore write fallback:', err?.message || err);
    }
  }
  localFeedbackMap.set(updated.feedbackId, updated);

  await safeAppendFeedbackAuditLog(db, {
    auditId: `tfbaud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    action: 'FEEDBACK_MODERATED',
    feedbackId: updated.feedbackId,
    translationId: updated.translationId,
    actorUid: reviewer.uid,
    actorRole: reviewer.role || 'reviewer',
    ...(updated.institutionId ? { institutionId: updated.institutionId } : {}),
    previousStatus: existing.status,
    newStatus: updated.status,
    decisionReason,
    timestamp: now,
  });

  return {
    feedback: updated,
    ...(escalatedGlossarySubmissionId ? { escalatedGlossarySubmissionId } : {}),
  };
}

export async function exportCuratedTranslationDataset(
  db: Firestore | null,
  reviewer: TranslationFeedbackCaller,
  options: { format?: 'jsonl' | 'csv'; filters?: ReviewFeedbackFilterOptions } = {}
): Promise<{
  format: 'jsonl' | 'csv';
  count: number;
  rows: CuratedDatasetExportRow[];
  content: string;
}> {
  if (!canReviewTranslationFeedback(reviewer)) {
    throw new Error(
      'FORBIDDEN: Only authorized legal reviewers or administrators may export curated translation feedback.'
    );
  }

  const format: 'jsonl' | 'csv' = options.format === 'csv' ? 'csv' : 'jsonl';
  const scoped = await loadScopedFeedbackForReviewer(db, reviewer);
  const filtered = applyReviewerFilters(scoped, options.filters || {});

  // CRITICAL ELIGIBILITY GATE (Feature F):
  // ONLY accepted AND explicitly consented records may enter the curated export.
  const eligible = filtered.filter(
    (rec) => rec.status === 'accepted' && rec.consentToCuratedDataset === true
  );

  const rows: CuratedDatasetExportRow[] = eligible.map((rec) => ({
    feedbackId: rec.feedbackId,
    schemaVersion: rec.schemaVersion,
    translationId: rec.translationId,
    sourceLanguage: rec.sourceLanguage,
    targetLanguage: rec.targetLanguage,
    direction: rec.direction,
    overallRating: rec.overallRating,
    ...(rec.accuracyRating !== undefined ? { accuracyRating: rec.accuracyRating } : {}),
    ...(rec.terminologyRating !== undefined ? { terminologyRating: rec.terminologyRating } : {}),
    ...(rec.completenessRating !== undefined ? { completenessRating: rec.completenessRating } : {}),
    ...(rec.readabilityRating !== undefined ? { readabilityRating: rec.readabilityRating } : {}),
    issueCategories: rec.issueCategories,
    ...(rec.terminologyCorrection ? { terminologyCorrection: rec.terminologyCorrection } : {}),
    ...(rec.terminologyOutcome ? { terminologyOutcome: rec.terminologyOutcome } : {}),
    reviewDecision: 'accepted',
    reviewedAt: rec.reviewedAt || rec.updatedAt,
    consentToCuratedDataset: true,
    provider: rec.provider,
    model: rec.model,
    promptVersion: rec.promptVersion,
    glossaryVersion: rec.glossaryVersion,
    appVersion: rec.appVersion,
  }));

  let content = '';
  if (format === 'jsonl') {
    content = rows.map((row) => JSON.stringify(row)).join('\n');
  } else {
    const header = [
      'feedbackId',
      'schemaVersion',
      'translationId',
      'sourceLanguage',
      'targetLanguage',
      'direction',
      'overallRating',
      'accuracyRating',
      'terminologyRating',
      'completenessRating',
      'readabilityRating',
      'issueCategories',
      'sourceTerm',
      'currentTargetTerm',
      'suggestedTargetTerm',
      'legalReference',
      'terminologyOutcome',
      'reviewDecision',
      'reviewedAt',
      'consentToCuratedDataset',
      'provider',
      'model',
      'promptVersion',
      'glossaryVersion',
      'appVersion',
    ].join(',');
    const lines = rows.map((row) =>
      [
        row.feedbackId,
        row.schemaVersion,
        row.translationId,
        row.sourceLanguage,
        row.targetLanguage,
        row.direction,
        row.overallRating,
        row.accuracyRating ?? '',
        row.terminologyRating ?? '',
        row.completenessRating ?? '',
        row.readabilityRating ?? '',
        row.issueCategories.join('|'),
        row.terminologyCorrection?.sourceTerm ?? '',
        row.terminologyCorrection?.currentTargetTerm ?? '',
        row.terminologyCorrection?.suggestedTargetTerm ?? '',
        row.terminologyCorrection?.legalReference ?? '',
        row.terminologyOutcome ?? '',
        row.reviewDecision,
        row.reviewedAt,
        row.consentToCuratedDataset,
        row.provider,
        row.model,
        row.promptVersion,
        row.glossaryVersion,
        row.appVersion,
      ]
        .map(sanitizeCsvCell)
        .join(',')
    );
    content = [header, ...lines].join('\n');
  }

  await safeAppendFeedbackAuditLog(db, {
    auditId: `tfbaud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    action: 'CURATED_DATASET_EXPORTED',
    actorUid: reviewer.uid,
    actorRole: reviewer.role || 'reviewer',
    ...(reviewer.institutionId ? { institutionId: reviewer.institutionId } : {}),
    exportFormat: format,
    exportedCount: rows.length,
    timestamp: new Date().toISOString(),
  });

  return { format, count: rows.length, rows, content };
}

export async function listTranslationFeedbackAuditLogs(
  db: Firestore | null,
  reviewer: TranslationFeedbackCaller,
  limitCount = 100
): Promise<TranslationFeedbackAuditRecord[]> {
  if (!canReviewTranslationFeedback(reviewer)) {
    throw new Error(
      'FORBIDDEN: Only authorized legal reviewers or administrators may view feedback audit logs.'
    );
  }

  const isGlobal = isGlobalTranslationReviewer(reviewer);
  const combined = new Map<string, TranslationFeedbackAuditRecord>();

  for (const log of localAuditLogs) {
    if (isGlobal || (reviewer.institutionId && log.institutionId === reviewer.institutionId)) {
      combined.set(log.auditId, log);
    }
  }

  if (db) {
    try {
      const col = db.collection(TRANSLATION_FEEDBACK_AUDIT_COLLECTION);
      const snap = isGlobal
        ? await col.orderBy('timestamp', 'desc').limit(limitCount).get()
        : await col
            .where('institutionId', '==', reviewer.institutionId!)
            .limit(limitCount)
            .get();
      for (const docSnap of snap.docs) {
        const rec = docSnap.data() as TranslationFeedbackAuditRecord;
        if (rec?.auditId) combined.set(rec.auditId, rec);
      }
    } catch {
      // fallback to localAuditLogs
    }
  }

  return Array.from(combined.values())
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limitCount);
}
