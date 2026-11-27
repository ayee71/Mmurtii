import { auth } from './firebase';
import type { GlossaryDomain } from '../shared/legalGlossarySchema';
import type {
  TerminologyReviewOutcome,
  TranslationFeedbackAuditRecord,
  TranslationFeedbackRecord,
  TranslationFeedbackStatus,
  TranslationFeedbackSubmissionInput,
  TranslationIssueCategory,
  TranslationLanguage,
  UserVisibleTranslationFeedback,
} from '../shared/translationFeedbackSchema';
import type { TranslationQualityMetricsSummary } from '../server/legal/translationFeedbackService';

async function getFeedbackAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // Unauthenticated callers will be cleanly rejected with HTTP 401 by the backend
  }
  return headers;
}

async function parseFeedbackResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    throw new Error(text || fallbackMessage);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || fallbackMessage);
  }
  return data as T;
}

export async function submitTranslationFeedbackApi(
  payload: TranslationFeedbackSubmissionInput
): Promise<{ ok: boolean; feedback: UserVisibleTranslationFeedback }> {
  const res = await fetch('/api/legal/translation-feedback', {
    method: 'POST',
    headers: await getFeedbackAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return parseFeedbackResponse(res, 'Failed to submit translation feedback.');
}

export async function fetchMyTranslationFeedbackApi(): Promise<{
  ok: boolean;
  count: number;
  isReviewer: boolean;
  items: UserVisibleTranslationFeedback[];
}> {
  const res = await fetch('/api/legal/translation-feedback/mine', {
    method: 'GET',
    headers: await getFeedbackAuthHeaders(),
  });
  return parseFeedbackResponse(res, 'Failed to load your translation feedback.');
}

export interface TranslationFeedbackFilterParams {
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

function buildFilterSearchParams(filters: TranslationFeedbackFilterParams): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.translationId) params.set('translationId', filters.translationId);
  if (filters.sourceLanguage && filters.sourceLanguage !== 'all') {
    params.set('sourceLanguage', filters.sourceLanguage);
  }
  if (filters.targetLanguage && filters.targetLanguage !== 'all') {
    params.set('targetLanguage', filters.targetLanguage);
  }
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.issueCategory && filters.issueCategory !== 'all') {
    params.set('issueCategory', filters.issueCategory);
  }
  if (typeof filters.minRating === 'number') params.set('minRating', String(filters.minRating));
  if (typeof filters.maxRating === 'number') params.set('maxRating', String(filters.maxRating));
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.termQuery) params.set('termQuery', filters.termQuery);
  if (filters.modelVersion) params.set('modelVersion', filters.modelVersion);
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
  return params;
}

export async function fetchReviewTranslationFeedbackApi(
  filters: TranslationFeedbackFilterParams = {}
): Promise<{ ok: boolean; count: number; items: TranslationFeedbackRecord[] }> {
  const params = buildFilterSearchParams(filters);
  const res = await fetch(`/api/legal/translation-feedback/review?${params.toString()}`, {
    method: 'GET',
    headers: await getFeedbackAuthHeaders(),
  });
  return parseFeedbackResponse(res, 'Failed to load translation feedback review queue.');
}

export async function fetchTranslationQualityMetricsApi(
  filters: TranslationFeedbackFilterParams = {}
): Promise<{ ok: boolean; metrics: TranslationQualityMetricsSummary }> {
  const params = buildFilterSearchParams(filters);
  const res = await fetch(`/api/legal/translation-feedback/metrics?${params.toString()}`, {
    method: 'GET',
    headers: await getFeedbackAuthHeaders(),
  });
  return parseFeedbackResponse(res, 'Failed to load translation quality metrics.');
}

export async function moderateTranslationFeedbackApi(payload: {
  feedbackId: string;
  decision: Exclude<TranslationFeedbackStatus, 'submitted'>;
  decisionReason: string;
  reviewerNotes?: string;
  terminologyOutcome?: TerminologyReviewOutcome;
  escalateToGlossary?: boolean;
  glossaryDomain?: GlossaryDomain;
}): Promise<{
  ok: boolean;
  feedback: TranslationFeedbackRecord;
  escalatedGlossarySubmissionId?: string;
}> {
  const res = await fetch(
    `/api/legal/translation-feedback/${encodeURIComponent(payload.feedbackId)}/moderate`,
    {
      method: 'POST',
      headers: await getFeedbackAuthHeaders(),
      body: JSON.stringify({
        decision: payload.decision,
        decisionReason: payload.decisionReason,
        reviewerNotes: payload.reviewerNotes,
        terminologyOutcome: payload.terminologyOutcome,
        escalateToGlossary: payload.escalateToGlossary,
        glossaryDomain: payload.glossaryDomain,
      }),
    }
  );
  return parseFeedbackResponse(res, 'Failed to moderate translation feedback.');
}

export async function exportCuratedTranslationFeedbackApi(
  format: 'jsonl' | 'csv',
  filters: TranslationFeedbackFilterParams = {}
): Promise<{ ok: boolean; format: 'jsonl' | 'csv'; count: number; content: string }> {
  const params = buildFilterSearchParams(filters);
  params.set('format', format);
  const res = await fetch(`/api/legal/translation-feedback/export?${params.toString()}`, {
    method: 'GET',
    headers: await getFeedbackAuthHeaders(),
  });
  return parseFeedbackResponse(res, 'Failed to export curated translation dataset.');
}

export async function fetchTranslationFeedbackAuditLogsApi(): Promise<{
  ok: boolean;
  count: number;
  logs: TranslationFeedbackAuditRecord[];
}> {
  const res = await fetch('/api/legal/translation-feedback/audit', {
    method: 'GET',
    headers: await getFeedbackAuthHeaders(),
  });
  return parseFeedbackResponse(res, 'Failed to load translation feedback audit logs.');
}
