import { Router, Request, Response } from 'express';
import { getSafeAdminAuth, getSafeAdminFirestore } from '../firebase-admin-config';
import {
  archiveGlossaryEntry,
  canReviewGlossary,
  canSubmitGlossaryProposal,
  getGlossaryEntryDetail,
  GlossaryCallerIdentity,
  listGlossaryAuditLogs,
  listGlossarySubmissionsForCaller,
  reviewGlossarySubmission,
  searchGlossaryEntries,
  submitGlossaryProposal,
} from './glossaryService';
import type { GlossaryDomain, GlossarySubmissionStatus } from '../../shared/legalGlossarySchema';

const router = Router();

async function resolveGlossaryCaller(req: Request): Promise<
  | { ok: true; authenticated: boolean; caller: GlossaryCallerIdentity }
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
  const msg = err instanceof Error ? err.message : 'Glossary operation failed.';
  if (msg.startsWith('UNAUTHORIZED:')) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: msg });
  }
  if (msg.startsWith('FORBIDDEN:')) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: msg });
  }
  if (msg.startsWith('NOT_FOUND:')) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND', message: msg });
  }
  if (
    msg.startsWith('VALIDATION_ERROR:') ||
    msg.startsWith('INCOMPLETE_TERMINOLOGY:') ||
    msg.startsWith('SOURCE_REFERENCE_REQUIRED:') ||
    msg.startsWith('INVALID_STATE:')
  ) {
    const code = msg.split(':')[0];
    return res.status(400).json({ ok: false, error: code, message: msg });
  }
  return res.status(fallbackStatus).json({ ok: false, error: 'GLOSSARY_ERROR', message: msg });
}

// GET /api/legal/glossary — Public trilingual search & paginated browse of approved entries
router.get('/', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveGlossaryCaller(req);
    const caller = resolved.ok ? resolved.caller : { uid: 'guest', emailVerified: false };

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const domain =
      typeof req.query.domain === 'string' && req.query.domain.trim()
        ? (req.query.domain.trim() as GlossaryDomain | 'all')
        : 'all';
    const jurisdiction =
      typeof req.query.jurisdiction === 'string' && req.query.jurisdiction.trim()
        ? req.query.jurisdiction.trim()
        : 'all';
    const status =
      typeof req.query.status === 'string' &&
      (req.query.status === 'approved' || req.query.status === 'archived' || req.query.status === 'all')
        ? req.query.status
        : 'approved';
    const page = Number.parseInt(String(req.query.page || '1'), 10) || 1;
    const pageSize = Number.parseInt(String(req.query.pageSize || '20'), 10) || 20;

    const db = getSafeAdminFirestore();
    const result = await searchGlossaryEntries(
      db,
      { query: q, domain, jurisdiction, status, page, pageSize },
      caller
    );

    return res.json({
      ok: true,
      ...result,
      permissions: {
        canSubmit: canSubmitGlossaryProposal(caller),
        canReview: canReviewGlossary(caller),
      },
    });
  } catch (err) {
    return sendMappedError(res, err, 500);
  }
});

// GET /api/legal/glossary/submissions — Scoped submission tracking & reviewer queue
router.get('/submissions', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveGlossaryCaller(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, message: resolved.message });
    }
    if (!resolved.authenticated) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication Bearer token is required to view glossary submissions.',
      });
    }

    const status =
      typeof req.query.status === 'string' &&
      (['pending', 'needs_changes', 'approved', 'rejected', 'all'] as const).includes(
        req.query.status as any
      )
        ? (req.query.status as GlossarySubmissionStatus | 'all')
        : 'all';
    const mineOnly = req.query.mine === '1' || req.query.mine === 'true';

    const db = getSafeAdminFirestore();
    const submissions = await listGlossarySubmissionsForCaller(db, resolved.caller, {
      status,
      mineOnly,
    });

    return res.json({
      ok: true,
      count: submissions.length,
      isReviewer: canReviewGlossary(resolved.caller),
      submissions,
    });
  } catch (err) {
    return sendMappedError(res, err, 403);
  }
});

// GET /api/legal/glossary/audit — Reviewer/admin glossary audit trail
router.get('/audit', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveGlossaryCaller(req);
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

    const termId = typeof req.query.termId === 'string' ? req.query.termId.trim() : undefined;
    const db = getSafeAdminFirestore();
    const logs = await listGlossaryAuditLogs(db, resolved.caller, termId);
    return res.json({ ok: true, count: logs.length, logs });
  } catch (err) {
    return sendMappedError(res, err, 403);
  }
});

// GET /api/legal/glossary/:termId — Full entry details & recoverable version history
router.get('/:termId', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveGlossaryCaller(req);
    const caller = resolved.ok ? resolved.caller : { uid: 'guest', emailVerified: false };
    const db = getSafeAdminFirestore();
    const detail = await getGlossaryEntryDetail(db, req.params.termId, caller);

    if (!detail) {
      return res.status(404).json({
        ok: false,
        error: 'NOT_FOUND',
        message: 'Glossary entry not found or unavailable.',
      });
    }

    return res.json({ ok: true, ...detail });
  } catch (err) {
    return sendMappedError(res, err, 500);
  }
});

// POST /api/legal/glossary/submissions — Submit new term or suggested correction into pending review
router.post('/submissions', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveGlossaryCaller(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, message: resolved.message });
    }
    if (!resolved.authenticated) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication Bearer token is required to submit a glossary proposal.',
      });
    }
    if (!canSubmitGlossaryProposal(resolved.caller)) {
      return res.status(403).json({
        ok: false,
        error: 'FORBIDDEN',
        message:
          'Verified non-anonymous user account (excluding read-only/auditor roles) is required to submit glossary proposals.',
      });
    }

    const db = getSafeAdminFirestore();
    const submission = await submitGlossaryProposal(db, resolved.caller, req.body);
    return res.status(201).json({ ok: true, submission });
  } catch (err) {
    return sendMappedError(res, err, 400);
  }
});

// POST /api/legal/glossary/submissions/:submissionId/review — Reviewer Approve / Request Changes / Reject
router.post('/submissions/:submissionId/review', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveGlossaryCaller(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, message: resolved.message });
    }
    if (!resolved.authenticated) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHENTICATED',
        message: 'Authentication Bearer token is required to review glossary submissions.',
      });
    }
    if (!canReviewGlossary(resolved.caller)) {
      return res.status(403).json({
        ok: false,
        error: 'FORBIDDEN',
        message: 'Only authorized legal reviewers or administrators may review glossary submissions.',
      });
    }

    const decision = req.body?.decision;
    if (decision !== 'APPROVE' && decision !== 'REQUEST_CHANGES' && decision !== 'REJECT') {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_DECISION',
        message: 'decision must be APPROVE, REQUEST_CHANGES, or REJECT.',
      });
    }

    const db = getSafeAdminFirestore();
    const result = await reviewGlossarySubmission(db, resolved.caller, {
      submissionId: req.params.submissionId,
      decision,
      reviewerNote: typeof req.body?.reviewerNote === 'string' ? req.body.reviewerNote : '',
      editedProposedEntry: req.body?.editedProposedEntry,
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    return sendMappedError(res, err, 400);
  }
});

// POST /api/legal/glossary/:termId/archive — Reviewer/admin soft archive
router.post('/:termId/archive', async (req: Request, res: Response) => {
  try {
    const resolved = await resolveGlossaryCaller(req);
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
    if (!canReviewGlossary(resolved.caller)) {
      return res.status(403).json({
        ok: false,
        error: 'FORBIDDEN',
        message: 'Only authorized legal reviewers or administrators may archive glossary entries.',
      });
    }

    const db = getSafeAdminFirestore();
    const entry = await archiveGlossaryEntry(
      db,
      resolved.caller,
      req.params.termId,
      typeof req.body?.reason === 'string' ? req.body.reason : ''
    );
    return res.json({ ok: true, entry });
  } catch (err) {
    return sendMappedError(res, err, 400);
  }
});

export default router;
