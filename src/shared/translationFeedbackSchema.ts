import type { GlossaryLanguage } from './legalGlossarySchema';

export type TranslationLanguage = GlossaryLanguage; // 'om' | 'am' | 'en'

export const SUPPORTED_TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = [
  'om',
  'am',
  'en',
] as const;

export const SUPPORTED_TRANSLATION_DIRECTIONS = [
  'om->am',
  'am->om',
  'om->en',
  'en->om',
  'am->en',
  'en->am',
] as const;

export type TranslationDirection = (typeof SUPPORTED_TRANSLATION_DIRECTIONS)[number];

export const TRANSLATION_FEEDBACK_SCHEMA_VERSION = '1.0.0';

export const TRANSLATION_ISSUE_CATEGORIES = [
  'incorrect_legal_term',
  'legal_meaning_changed',
  'text_or_clause_omitted',
  'meaning_or_clause_added',
  'wrong_target_language',
  'inconsistent_terminology',
  'grammar_readability_problem',
  'citation_article_reference_changed',
  'other',
] as const;

export type TranslationIssueCategory = (typeof TRANSLATION_ISSUE_CATEGORIES)[number];

export const TRANSLATION_FEEDBACK_STATUSES = [
  'submitted',
  'under_review',
  'accepted',
  'rejected',
  'needs_clarification',
] as const;

export type TranslationFeedbackStatus = (typeof TRANSLATION_FEEDBACK_STATUSES)[number];

export const TRANSLATION_MODULES = [
  'translate_view',
  'document_analysis',
  'voice_ocr_converter',
  'api_translate',
] as const;

export type TranslationModuleId = (typeof TRANSLATION_MODULES)[number];

export const TERMINOLOGY_REVIEW_OUTCOMES = [
  'accepted',
  'rejected',
  'context_dependent',
  'needs_legal_research',
] as const;

export type TerminologyReviewOutcome = (typeof TERMINOLOGY_REVIEW_OUTCOMES)[number];

export const TRANSLATION_FEEDBACK_LIMITS = {
  maxCommentLength: 2000,
  maxTermLength: 200,
  maxExplanationLength: 1000,
  maxLegalReferenceLength: 300,
  maxReviewerNotesLength: 1500,
  maxDecisionReasonLength: 800,
  maxIssueCategories: 9,
  maxTranslationIdLength: 128,
  rateLimitMaxPerWindow: 20,
  rateLimitWindowMs: 60 * 60 * 1000, // 1 hour
} as const;

export interface TerminologyCorrectionInput {
  sourceTerm: string;
  currentTargetTerm: string;
  suggestedTargetTerm: string;
  explanation?: string;
  legalReference?: string;
  glossaryTermId?: string;
  conceptId?: string;
  jurisdiction?: string;
}

export interface TranslationRecord {
  translationId: string;
  ownerUid: string | null; // null if unauthenticated guest translation (cannot submit authenticated user feedback for cross-user docs)
  institutionId?: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  isRewrite: boolean;
  module: TranslationModuleId;
  provider: string;
  model: string;
  promptVersion: string;
  glossaryVersion: string;
  appVersion: string;
  createdAt: string;
}

export interface TranslationFeedbackRecord {
  feedbackId: string;
  schemaVersion: string;
  translationId: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  direction: TranslationDirection;
  module: TranslationModuleId;
  translationCreatedAt: string;
  provider: string;
  model: string;
  promptVersion: string;
  glossaryVersion: string;
  appVersion: string;
  overallRating: number;
  accuracyRating?: number;
  terminologyRating?: number;
  completenessRating?: number;
  readabilityRating?: number;
  issueCategories: TranslationIssueCategory[];
  comment: string;
  terminologyCorrection?: TerminologyCorrectionInput;
  submittedBy: string;
  institutionId?: string;
  submittedAt: string;
  updatedAt: string;
  status: TranslationFeedbackStatus;
  consentToCuratedDataset: boolean;
  consentRecordedAt?: string;
  // Reviewer-only fields — MUST NEVER be serialized to ordinary users
  reviewedBy?: string;
  reviewedAt?: string;
  reviewDecision?: TranslationFeedbackStatus;
  decisionReason?: string;
  reviewerNotes?: string;
  terminologyOutcome?: TerminologyReviewOutcome;
  escalatedGlossarySubmissionId?: string;
}

export interface UserVisibleTranslationFeedback {
  feedbackId: string;
  schemaVersion: string;
  translationId: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  direction: TranslationDirection;
  overallRating: number;
  accuracyRating?: number;
  terminologyRating?: number;
  completenessRating?: number;
  readabilityRating?: number;
  issueCategories: TranslationIssueCategory[];
  comment: string;
  terminologyCorrection?: TerminologyCorrectionInput;
  submittedBy: string;
  institutionId?: string;
  submittedAt: string;
  updatedAt: string;
  status: TranslationFeedbackStatus;
  consentToCuratedDataset: boolean;
  escalatedGlossarySubmissionId?: string;
}

export interface TranslationFeedbackAuditRecord {
  auditId: string;
  action:
    | 'FEEDBACK_SUBMITTED'
    | 'FEEDBACK_MODERATED'
    | 'TERMINOLOGY_ESCALATED'
    | 'CURATED_DATASET_EXPORTED';
  feedbackId?: string;
  translationId?: string;
  actorUid: string;
  actorRole: string;
  institutionId?: string;
  previousStatus?: TranslationFeedbackStatus;
  newStatus?: TranslationFeedbackStatus;
  decisionReason?: string;
  exportFormat?: 'jsonl' | 'csv';
  exportedCount?: number;
  timestamp: string;
}

export interface TranslationFeedbackSubmissionInput {
  translationId: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  overallRating: number;
  accuracyRating?: number;
  terminologyRating?: number;
  completenessRating?: number;
  readabilityRating?: number;
  issueCategories: TranslationIssueCategory[];
  comment?: string;
  terminologyCorrection?: TerminologyCorrectionInput;
  consentToCuratedDataset?: boolean;
}

export interface CuratedDatasetExportRow {
  feedbackId: string;
  schemaVersion: string;
  translationId: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  direction: TranslationDirection;
  overallRating: number;
  accuracyRating?: number;
  terminologyRating?: number;
  completenessRating?: number;
  readabilityRating?: number;
  issueCategories: TranslationIssueCategory[];
  terminologyCorrection?: TerminologyCorrectionInput;
  terminologyOutcome?: TerminologyReviewOutcome;
  reviewDecision: 'accepted';
  reviewedAt: string;
  consentToCuratedDataset: true;
  provider: string;
  model: string;
  promptVersion: string;
  glossaryVersion: string;
  appVersion: string;
}

export function isSupportedTranslationLanguage(val: unknown): val is TranslationLanguage {
  return val === 'om' || val === 'am' || val === 'en';
}

export function isValidTranslationPair(
  sourceLang: unknown,
  targetLang: unknown
): sourceLang is TranslationLanguage {
  return (
    isSupportedTranslationLanguage(sourceLang) &&
    isSupportedTranslationLanguage(targetLang) &&
    sourceLang !== targetLang
  );
}

export function formatTranslationDirection(
  sourceLang: TranslationLanguage,
  targetLang: TranslationLanguage
): TranslationDirection {
  const dir = `${sourceLang}->${targetLang}` as TranslationDirection;
  if (!(SUPPORTED_TRANSLATION_DIRECTIONS as readonly string[]).includes(dir)) {
    throw new Error(`Unsupported translation direction: ${String(sourceLang)}->${String(targetLang)}`);
  }
  return dir;
}

export function isValidRatingInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 5;
}

/**
 * Strips control chars and normalizes NFC whitespace for untrusted feedback text.
 * Note: React automatically escapes text nodes, and CSV exports additionally guard
 * formula-injection prefixes; server-side storage keeps clean normalized plain text
 * without raw HTML tags.
 */
export function sanitizeFeedbackText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .trim()
    .slice(0, maxLen);
}

export function escapeForHtmlText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeCsvCell(value: unknown): string {
  const str = value === undefined || value === null ? '' : String(value);
  // Guard spreadsheet formula injection (=, +, -, @, tab, CR)
  const formulaSafe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  const escaped = formulaSafe.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function requiresCommentForSubmission(categories: TranslationIssueCategory[]): boolean {
  return categories.includes('other');
}

export function hasTerminologyIssueCategory(categories: TranslationIssueCategory[]): boolean {
  return (
    categories.includes('incorrect_legal_term') ||
    categories.includes('inconsistent_terminology') ||
    categories.includes('citation_article_reference_changed')
  );
}

export function validateTranslationFeedbackPayload(
  raw: unknown
):
  | { ok: true; value: TranslationFeedbackSubmissionInput }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Feedback payload must be a JSON object.' };
  }

  const body = raw as Record<string, unknown>;

  const translationId =
    typeof body.translationId === 'string' ? body.translationId.trim() : '';
  if (
    !translationId ||
    translationId.length > TRANSLATION_FEEDBACK_LIMITS.maxTranslationIdLength ||
    !/^[a-zA-Z0-9_\-]+$/.test(translationId)
  ) {
    return { ok: false, error: 'A valid translationId is required.' };
  }

  const sourceLanguage = body.sourceLanguage;
  const targetLanguage = body.targetLanguage;
  if (!isSupportedTranslationLanguage(sourceLanguage)) {
    return { ok: false, error: 'sourceLanguage must be one of: om, am, en.' };
  }
  if (!isSupportedTranslationLanguage(targetLanguage)) {
    return { ok: false, error: 'targetLanguage must be one of: om, am, en.' };
  }
  if (sourceLanguage === targetLanguage) {
    return {
      ok: false,
      error: 'sourceLanguage and targetLanguage must differ for translation feedback.',
    };
  }

  if (!isValidRatingInteger(body.overallRating)) {
    return { ok: false, error: 'overallRating must be an integer between 1 and 5.' };
  }

  const optionalRatingKeys = [
    'accuracyRating',
    'terminologyRating',
    'completenessRating',
    'readabilityRating',
  ] as const;
  const optionalRatings: Partial<Record<(typeof optionalRatingKeys)[number], number>> = {};

  for (const key of optionalRatingKeys) {
    const val = body[key];
    if (val !== undefined && val !== null) {
      if (!isValidRatingInteger(val)) {
        return { ok: false, error: `${key} must be an integer between 1 and 5.` };
      }
      optionalRatings[key] = val;
    }
  }

  const rawCategories = Array.isArray(body.issueCategories) ? body.issueCategories : [];
  const allowedCategorySet = new Set<string>(TRANSLATION_ISSUE_CATEGORIES);
  const issueCategories: TranslationIssueCategory[] = [];
  for (const item of rawCategories) {
    if (typeof item !== 'string' || !allowedCategorySet.has(item)) {
      return { ok: false, error: `Unsupported issue category: ${String(item)}` };
    }
    if (!issueCategories.includes(item as TranslationIssueCategory)) {
      issueCategories.push(item as TranslationIssueCategory);
    }
  }
  if (issueCategories.length > TRANSLATION_FEEDBACK_LIMITS.maxIssueCategories) {
    return { ok: false, error: 'Too many issue categories provided.' };
  }

  const rawCommentStr = typeof body.comment === 'string' ? body.comment : '';
  const trimmedRawComment = rawCommentStr.normalize('NFC').trim();
  if (trimmedRawComment.length > TRANSLATION_FEEDBACK_LIMITS.maxCommentLength) {
    return {
      ok: false,
      error: `comment must not exceed ${TRANSLATION_FEEDBACK_LIMITS.maxCommentLength} characters.`,
    };
  }
  const comment = sanitizeFeedbackText(trimmedRawComment, TRANSLATION_FEEDBACK_LIMITS.maxCommentLength);

  if (body.comment !== undefined && typeof body.comment !== 'string') {
    return { ok: false, error: 'comment must be a string.' };
  }

  // Reject whitespace-only comment if comment was explicitly provided or required by category/low rating
  const commentRequired =
    requiresCommentForSubmission(issueCategories) ||
    (issueCategories.length === 0 && body.overallRating <= 2);

  if (commentRequired && !comment) {
    return {
      ok: false,
      error: 'A non-empty explanation comment is required for this rating or selected issue category.',
    };
  }
  if (typeof body.comment === 'string' && body.comment.length > 0 && trimmedRawComment.length === 0) {
    return { ok: false, error: 'comment cannot be blank whitespace.' };
  }

  let terminologyCorrection: TerminologyCorrectionInput | undefined;
  if (body.terminologyCorrection !== undefined && body.terminologyCorrection !== null) {
    if (typeof body.terminologyCorrection !== 'object' || Array.isArray(body.terminologyCorrection)) {
      return { ok: false, error: 'terminologyCorrection must be a structured object.' };
    }
    const tc = body.terminologyCorrection as Record<string, unknown>;
    const rawSource = typeof tc.sourceTerm === 'string' ? tc.sourceTerm.trim() : '';
    const rawCurrent = typeof tc.currentTargetTerm === 'string' ? tc.currentTargetTerm.trim() : '';
    const rawSuggested = typeof tc.suggestedTargetTerm === 'string' ? tc.suggestedTargetTerm.trim() : '';

    if (
      rawSource.length > TRANSLATION_FEEDBACK_LIMITS.maxTermLength ||
      rawCurrent.length > TRANSLATION_FEEDBACK_LIMITS.maxTermLength ||
      rawSuggested.length > TRANSLATION_FEEDBACK_LIMITS.maxTermLength
    ) {
      return {
        ok: false,
        error: `Terminology fields must not exceed ${TRANSLATION_FEEDBACK_LIMITS.maxTermLength} characters.`,
      };
    }

    const sourceTerm = sanitizeFeedbackText(rawSource, TRANSLATION_FEEDBACK_LIMITS.maxTermLength);
    const currentTargetTerm = sanitizeFeedbackText(rawCurrent, TRANSLATION_FEEDBACK_LIMITS.maxTermLength);
    const suggestedTargetTerm = sanitizeFeedbackText(rawSuggested, TRANSLATION_FEEDBACK_LIMITS.maxTermLength);

    if (!sourceTerm || !currentTargetTerm || !suggestedTargetTerm) {
      return {
        ok: false,
        error: 'terminologyCorrection requires sourceTerm, currentTargetTerm, and suggestedTargetTerm.',
      };
    }

    const rawExpl = typeof tc.explanation === 'string' ? tc.explanation.trim() : '';
    if (rawExpl.length > TRANSLATION_FEEDBACK_LIMITS.maxExplanationLength) {
      return {
        ok: false,
        error: `terminologyCorrection.explanation must not exceed ${TRANSLATION_FEEDBACK_LIMITS.maxExplanationLength} characters.`,
      };
    }

    const rawRef = typeof tc.legalReference === 'string' ? tc.legalReference.trim() : '';
    if (rawRef.length > TRANSLATION_FEEDBACK_LIMITS.maxLegalReferenceLength) {
      return {
        ok: false,
        error: `terminologyCorrection.legalReference must not exceed ${TRANSLATION_FEEDBACK_LIMITS.maxLegalReferenceLength} characters.`,
      };
    }

    const glossaryTermId =
      typeof tc.glossaryTermId === 'string' && tc.glossaryTermId.trim()
        ? tc.glossaryTermId.trim().slice(0, 128)
        : undefined;
    const conceptId =
      typeof tc.conceptId === 'string' && tc.conceptId.trim()
        ? tc.conceptId.trim().slice(0, 128)
        : undefined;
    const jurisdiction =
      typeof tc.jurisdiction === 'string' && tc.jurisdiction.trim()
        ? sanitizeFeedbackText(tc.jurisdiction, 80)
        : undefined;

    const explanation = sanitizeFeedbackText(rawExpl, TRANSLATION_FEEDBACK_LIMITS.maxExplanationLength);
    const legalReference = sanitizeFeedbackText(rawRef, TRANSLATION_FEEDBACK_LIMITS.maxLegalReferenceLength);

    terminologyCorrection = {
      sourceTerm,
      currentTargetTerm,
      suggestedTargetTerm,
      ...(explanation ? { explanation } : {}),
      ...(legalReference ? { legalReference } : {}),
      ...(glossaryTermId ? { glossaryTermId } : {}),
      ...(conceptId ? { conceptId } : {}),
      ...(jurisdiction ? { jurisdiction } : {}),
    };
  }

  if (body.consentToCuratedDataset !== undefined && typeof body.consentToCuratedDataset !== 'boolean') {
    return { ok: false, error: 'consentToCuratedDataset must be a boolean.' };
  }

  return {
    ok: true,
    value: {
      translationId,
      sourceLanguage,
      targetLanguage: targetLanguage as TranslationLanguage,
      overallRating: body.overallRating,
      ...optionalRatings,
      issueCategories,
      comment,
      ...(terminologyCorrection ? { terminologyCorrection } : {}),
      consentToCuratedDataset: body.consentToCuratedDataset === true,
    },
  };
}

export function stripReviewerFieldsForUser(
  record: TranslationFeedbackRecord
): UserVisibleTranslationFeedback {
  return {
    feedbackId: record.feedbackId,
    schemaVersion: record.schemaVersion,
    translationId: record.translationId,
    sourceLanguage: record.sourceLanguage,
    targetLanguage: record.targetLanguage,
    direction: record.direction,
    overallRating: record.overallRating,
    ...(record.accuracyRating !== undefined ? { accuracyRating: record.accuracyRating } : {}),
    ...(record.terminologyRating !== undefined ? { terminologyRating: record.terminologyRating } : {}),
    ...(record.completenessRating !== undefined ? { completenessRating: record.completenessRating } : {}),
    ...(record.readabilityRating !== undefined ? { readabilityRating: record.readabilityRating } : {}),
    issueCategories: record.issueCategories,
    comment: record.comment,
    ...(record.terminologyCorrection ? { terminologyCorrection: record.terminologyCorrection } : {}),
    submittedBy: record.submittedBy,
    ...(record.institutionId ? { institutionId: record.institutionId } : {}),
    submittedAt: record.submittedAt,
    updatedAt: record.updatedAt,
    status: record.status,
    consentToCuratedDataset: record.consentToCuratedDataset,
    ...(record.escalatedGlossarySubmissionId
      ? { escalatedGlossarySubmissionId: record.escalatedGlossarySubmissionId }
      : {}),
  };
}
