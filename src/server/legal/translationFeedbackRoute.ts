import { Router, Request, Response } from 'express';
import { getSafeAdminAuth, getSafeAdminFirestore } from '../firebase-admin-config';
import {
  canReviewTranslationFeedback,
  canSubmitTranslationFeedback,
  computeFeedbackQualityMetrics,
  exportCuratedTranslationDataset,
  listMyTranslationFeedback,
  listTranslationFeedbackAuditLogs,
  moderateTranslationFeedback,
  ReviewFeedbackFilterOptions,
  searchReviewTranslationFeedback,
  submitTranslationFeedback,
  TranslationFeedbackCaller,
} from './translationFeedbackService';
import type {
  TranslationFeedbackStatus,
  TranslationIssueCategory,
  TranslationLanguage,
} from '../../shared/translationFeedbackSchema';

const router = Router();

async function resolveFeedbackCaller(req: Request): Promise<
  | { ok: true; authenticated: boolean; caller: TranslationFeedbackCaller }
  | { ok: false; status: number; error: string; message: string }
> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: true,
      authenticated: false,
      caller: { uid: 'guest', emailVerified: false },
    };
  }

  let decoded: any;
  try {
    decoded = await getSafeAdminAuth().verifyIdToken(match[1].trim());
  } catch {
    return {
      ok: false,
      status: 401,
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired Firebase ID token.',
    };
  }

  const signInProvider = String(decoded?.firebase?.sign_in_provider || '');
  const emailVerified = decoded?.email_verified === true && signInProvider !== 'phone';
  const email = typeof decoded?.email === 'string' ? decoded.email.toLowerCase() : undefined;
  let role =
    typeof decoded?.courtRole === 'string' && decoded.courtRole
      ? decoded.courtRole
      : typeof decoded?.role === 'string'
      ? decoded.role
      : '';
  let institutionId =
    typeof decoded?.institutionId === 'string' && decoded.institutionId
      ? decoded.institutionId
      : undefined;

  const db = getSafeAdminFirestore();
  if (emailVerified && signInProvider !== 'anonymous' && (!role || !institutionId) && db) {
    try {
      const courtUserSnap = await db.collection('court_users').doc(decoded.uid).get();
      if (courtUserSnap.exists && courtUserSnap.data()?.status === 'active') {
        if (!role && typeof courtUserSnap.data()?.role === 'string') {
          role = courtUserSnap.data()?.role;
        }
        if (!institutionId && typeof courtUserSnap.data()?.institutionId === 'string') {
          institutionId = courtUserSnap.data()?.institutionId;
        }
      }
    } catch {
      // Fallback to verified ID token claims only
    }
  }

  return {
    ok: true,
    authenticated: true,
    caller: {
      uid: decoded.uid,
      email,
      displayName: typeof decoded?.name === 'string' ? decoded.name : undefined,
      role: role || undefined,
      institutionId,
      emailVerified,
      signInProvider,
      isAdminClaim: decoded?.admin === true || decoded?.role === 'superadmin',
      legalContentManagerClaim: decoded?.legalContentManager === true,
    },
  };
}

function sendMappedError(res: Response, err: unknown, fallbackStatus = 400) {
  const msg = err instanceof Error ? err.message : 'Translation feedback operation failed.';
  if (msg.startsWith('UNAUTHORIZED:')) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: msg });
  }
  if (msg.startsWith('FORBIDDEN:')) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: msg });
  }
  if (msg.startsWith('NOT_FOUND:')) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND', message: msg });
  }
  if (msg.startsWith('DUPLICATE_SUBMISSION:')) {
    return res.status(409).json({ ok: false, error: 'DUPLICATE_SUBMISSION', message: msg });
  }
  if (msg.startsWith('RATE_LIMITED:')) {
    return res.status(429).json({ ok: false, error: 'RATE_LIMITED', message: msg });
  }
  if (msg.startsWith('VALIDATION_ERROR:')) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', message: msg });
  }
  return res.status(fallbackStatus).json({ ok: false, error: 'TRANSLATION_FEEDBACK_ERROR', message: msg });
}

function parseFilterQuery(query: Request['query']): ReviewFeedbackFilterOptions {
  const translationId = typeof query.translationId === 'string' ? query.translationId.trim() : undefined;
  const sourceLanguage =
    typeof query.sourceLanguage === 'string' && ['om', 'am', 'en', 'all'].includes(query.sourceLanguage)
      ? (query.sourceLanguage as TranslationLanguage | 'all')
      : undefined;
  const targetLanguage =
    typeof query.targetLanguage === 'string' && ['om', 'am', 'en', 'all'].includes(query.targetLanguage)
      ? (query.targetLanguage as TranslationLanguage | 'all')
      : undefined;
  const status =
    typeof query.status === 'string' &&
    ['submitted', 'under_review', 'accepted', 'rejected', 'needs_clarification', 'all'].includes(
      query.status
    )
      ? (query.status as TranslationFeedbackStatus | 'all')
      : undefined;
  const issueCategory =
    typeof query.issueCategory === 'string' && query.issueCategory.trim()
      ? (query.issueCategory.trim() as TranslationIssueCategory | 'all')
      : undefined;
  const minRatingRaw = query.minRating ? Number.parseInt(String(query.minRating), 10) : NaN;
  const maxRatingRaw = query.maxRating ? Number.parseInt(String(query.maxRating), 10) : NaN;
  const dateFrom = typeof query.dateFrom === 'string' && query.dateFrom.trim() ? query.dateFrom.trim() : undefined;
  const dateTo = typeof query.dateTo === 'string' && query.dateTo.trim() ? query.dateTo.trim() : undefined;
  const termQuery = typeof query.termQuery === 'string' ? query.termQuery : undefined;
  const modelVersion = typeof query.modelVersion === 'string' ? query.modelVersion : undefined;
  const limitRaw = query.limit ? Number.parseInt(String(query.limit), 10) : NaN;

  return {
    translationId,
    sourceLanguage,
    targetLanguage,
    status,
    issueCategory,
    ...(Number.isInteger(minRatingRaw) ? { minRating: minRatingRaw } : {}),
    ...(Number.isInteger(maxRatingRaw) ? { maxRating: maxRatingRaw } : {}),
    dateFrom,
    dateTo,
    termQuery,
    modelVersion,
    ...(Number.isInteger(limitRaw) ? { limit: limitRaw } : {}),
  };
}

// POST /api/legal/translation-feedback — Submit authenticated translation feedback
router.post('/', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveFeedbackCaller(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, message: resolved.message });
    }
    if (!resolved.authenticated || !canSubmitTranslationFeedback(resolved.caller)) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHENTICATED',
        message: 'Verified non-anonymous authentication is required to submit translation feedback.',
      });
    }

    const db = getSafeAdminFirestore();
    const feedback = await submitTranslationFeedback(db, resolved.caller, req.body);
    return res.status(201).json({ ok: true, feedback });
  } catch (err) {
    return sendMappedError(res, err, 400);
  }
});

// GET /api/legal/translation-feedback/mine — Ordinary user's own feedback statuses (private notes stripped)
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveFeedbackCaller(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, message: resolved.message });
    }
    if (!resolved.authenticated || !canSubmitTranslationFeedback(resolved.caller)) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHENTICATED',
        message: 'Verified non-anonymous authentication is required.',
      });
    }

    const db = getSafeAdminFirestore();
    const items = await listMyTranslationFeedback(db, resolved.caller);
    return res.json({
      ok: true,
      count: items.length,
      isReviewer: canReviewTranslationFeedback(resolved.caller),
      items,
    });
  } catch (err) {
    return sendMappedError(res, err, 400);
  }
});

// GET /api/legal/translation-feedback/review — Authorized reviewer search & filter queue
router.get('/review', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveFeedbackCaller(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, message: resolved.message });
    }
    if (!resolved.authenticated) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication Bearer token is required.',
      });
    }
    if (!canReviewTranslationFeedback(resolved.caller)) {
      return res.status(403).json({
        ok: false,
        error: 'FORBIDDEN',
        message: 'Only authorized legal reviewers or administrators may access the review queue.',
      });
    }

    const db = getSafeAdminFirestore();
    const filters = parseFilterQuery(req.query);
    const items = await searchReviewTranslationFeedback(db, resolved.caller, filters);
    return res.json({ ok: true, count: items.length, items });
  } catch (err) {
    return sendMappedError(res, err, 403);
  }
});

// GET /api/legal/translation-feedback/metrics — Aggregate indicators for reviewers/admins
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveFeedbackCaller(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, message: resolved.message });
    }
    if (!resolved.authenticated) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication Bearer token is required.',
      });
    }
    if (!canReviewTranslationFeedback(resolved.caller)) {
      return res.status(403).json({
        ok: false,
        error: 'FORBIDDEN',
        message: 'Only authorized legal reviewers or administrators may view quality metrics.',
      });
    }

    const db = getSafeAdminFirestore();
    const filters = parseFilterQuery(req.query);
    const metrics = await computeFeedbackQualityMetrics(db, resolved.caller, filters);
    return res.json({ ok: true, metrics });
  } catch (err) {
    return sendMappedError(res, err, 403);
  }
});

// GET /api/legal/translation-feedback/audit — Audit trail for reviewers/admins
router.get('/audit', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveFeedbackCaller(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, message: resolved.message });
    }
    if (!resolved.authenticated) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication Bearer token is required.',
      });
    }
    if (!canReviewTranslationFeedback(resolved.caller)) {
      return res.status(403).json({
        ok: false,
        error: 'FORBIDDEN',
        message: 'Only authorized legal reviewers or administrators may view audit logs.',
      });
    }

    const db = getSafeAdminFirestore();
    const logs = await listTranslationFeedbackAuditLogs(db, resolved.caller);
    return res.json({ ok: true, count: logs.length, logs });
  } catch (err) {
    return sendMappedError(res, err, 403);
  }
});

// GET /api/legal/translation-feedback/export — Curated dataset export (accepted + consented ONLY)
router.get('/export', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveFeedbackCaller(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, message: resolved.message });
    }
    if (!resolved.authenticated) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication Bearer token is required.',
      });
    }
    if (!canReviewTranslationFeedback(resolved.caller)) {
      return res.status(403).json({
        ok: false,
        error: 'FORBIDDEN',
        message: 'Only authorized legal reviewers or administrators may export curated datasets.',
      });
    }

    const format = req.query.format === 'csv' ? 'csv' : 'jsonl';
    const filters = parseFilterQuery(req.query);
    const db = getSafeAdminFirestore();
    const result = await exportCuratedTranslationDataset(db, resolved.caller, {
      format,
      filters,
    });

    if (req.query.download === '1') {
      res.setHeader(
        'Content-Type',
        format === 'csv' ? 'text/csv; charset=utf-8' : 'application/x-ndjson; charset=utf-8'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="seeraai_curated_translation_feedback.${format}"`
      );
      return res.send(result.content);
    }

    return res.json({
      ok: true,
      format: result.format,
      count: result.count,
      rows: result.rows,
      content: result.content,
    });
  } catch (err) {
    return sendMappedError(res, err, 403);
  }
});

// POST /api/legal/translation-feedback/:feedbackId/moderate — Reviewer moderation & glossary escalation
router.post('/:feedbackId/moderate', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveFeedbackCaller(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, message: resolved.message });
    }
    if (!resolved.authenticated) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication Bearer token is required.',
      });
    }
    if (!canReviewTranslationFeedback(resolved.caller)) {
      return res.status(403).json({
        ok: false,
        error: 'FORBIDDEN',
        message: 'Only authorized legal reviewers or administrators may moderate translation feedback.',
      });
    }

    const db = getSafeAdminFirestore();
    const result = await moderateTranslationFeedback(db, resolved.caller, {
      feedbackId: req.params.feedbackId,
      decision: req.body?.decision,
      decisionReason: typeof req.body?.decisionReason === 'string' ? req.body.decisionReason : '',
      reviewerNotes: typeof req.body?.reviewerNotes === 'string' ? req.body.reviewerNotes : undefined,
      terminologyOutcome: req.body?.terminologyOutcome,
      escalateToGlossary: req.body?.escalateToGlossary === true,
      glossaryDomain: req.body?.glossaryDomain,
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    return sendMappedError(res, err, 400);
  }
});

export default router;
