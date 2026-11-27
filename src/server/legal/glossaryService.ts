import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { LEGAL_GLOSSARY_DATA } from '../../data/legalGlossary';
import {
  buildGlossarySearchTokens,
  detectIncompleteLanguages,
  GlossaryAuditRecord,
  GlossaryDomain,
  GlossaryEntryRecord,
  GlossaryEntryVersionRecord,
  GlossaryLanguage,
  GlossarySearchQueryOptions,
  GlossarySearchResponsePayload,
  GlossarySubmissionProposedEntry,
  GlossarySubmissionRecord,
  GlossarySubmissionStatus,
  searchAndRankGlossaryEntries,
  validateGlossarySubmissionPayload,
} from '../../shared/legalGlossarySchema';

export const GLOSSARY_COLLECTION = 'legal_glossary';
export const GLOSSARY_SUBMISSIONS_COLLECTION = 'glossary_submissions';
export const GLOSSARY_AUDIT_COLLECTION = 'glossary_audit_logs';

export interface GlossaryCallerIdentity {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  institutionId?: string;
  emailVerified?: boolean;
  signInProvider?: string;
  isAdminClaim?: boolean;
  legalContentManagerClaim?: boolean;
}

const REVIEWER_ROLES = new Set([
  'admin',
  'superadmin',
  'super_admin',
  'court_admin',
  'judge',
  'legal_expert',
]);

const READ_ONLY_OR_AUDITOR_ROLES = new Set(['auditor', 'read_only', 'readonly', 'guest']);

export function canReviewGlossary(caller: GlossaryCallerIdentity): boolean {
  if (!caller.uid || caller.uid === 'guest') return false;
  if (caller.signInProvider === 'anonymous' || caller.emailVerified !== true) return false;

  if (caller.isAdminClaim || caller.legalContentManagerClaim) return true;

  const role = (caller.role || '').trim().toLowerCase();
  if (!role || READ_ONLY_OR_AUDITOR_ROLES.has(role)) return false;
  return REVIEWER_ROLES.has(role);
}

export function canSubmitGlossaryProposal(caller: GlossaryCallerIdentity): boolean {
  if (!caller.uid || caller.uid === 'guest') return false;
  if (caller.signInProvider === 'anonymous' || caller.emailVerified !== true) return false;
  const role = (caller.role || '').trim().toLowerCase();
  if (READ_ONLY_OR_AUDITOR_ROLES.has(role)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Baseline Entries Mapped Strictly from Existing Verified Repository Data
// ---------------------------------------------------------------------------
function mapCategoryToDomain(category: string): GlossaryDomain {
  if (category === 'constitutional') return 'constitutional';
  if (category === 'labor') return 'labour';
  if (category === 'commercial') return 'commercial';
  if (category === 'civilCourt') return 'civil_procedure';
  return 'other';
}

function buildBaselineGlossaryEntries(): GlossaryEntryRecord[] {
  const baselineTimestamp = '2026-01-01T00:00:00.000Z';
  return LEGAL_GLOSSARY_DATA.map((item) => {
    const jurisdiction =
      item.id === 'proclamation'
        ? ['Federal Ethiopia', 'Oromia']
        : ['Federal Ethiopia'];

    const base: Omit<GlossaryEntryRecord, 'searchTokens'> = {
      termId: `term_${item.id}`,
      conceptId: `concept_${item.id}`,
      terms: {
        om: { preferred: item.om.term, synonyms: [] },
        am: { preferred: item.am.term, synonyms: [] },
        en: { preferred: item.en.term, synonyms: [] },
      },
      definitions: {
        om: item.om.definition,
        am: item.am.definition,
        en: item.en.definition,
      },
      usageNotes: {
        om: item.om.usage,
        am: item.am.usage,
        en: item.en.usage,
      },
      domain: mapCategoryToDomain(item.category),
      jurisdiction,
      sourceReferences: [
        {
          sourceType: item.sourceReference.toLowerCase().includes('constitution')
            ? 'constitution'
            : item.sourceReference.toLowerCase().includes('proclamation')
            ? 'proclamation'
            : item.sourceReference.toLowerCase().includes('code')
            ? 'code'
            : 'other',
          title: item.sourceReference,
        },
      ],
      status: 'approved',
      version: 1,
      createdAt: baselineTimestamp,
      updatedAt: baselineTimestamp,
      createdBy: 'seeraai_verified_baseline',
      updatedBy: 'seeraai_verified_baseline',
      reviewedAt: baselineTimestamp,
      reviewedBy: 'seeraai_editorial_board',
    };

    return {
      ...base,
      searchTokens: buildGlossarySearchTokens(base),
    };
  });
}

// Local deterministic stores for isolated tests and resilient fallback when Admin Firestore lacks local IAM credentials
const localEntriesMap = new Map<string, GlossaryEntryRecord>();
const localVersionsMap = new Map<string, GlossaryEntryVersionRecord[]>();
const localSubmissionsMap = new Map<string, GlossarySubmissionRecord>();
const localAuditLogs: GlossaryAuditRecord[] = [];
let baselineSeeded = false;

export function resetGlossaryInMemoryStoreForTests(): void {
  localEntriesMap.clear();
  localVersionsMap.clear();
  localSubmissionsMap.clear();
  localAuditLogs.length = 0;
  baselineSeeded = false;
  ensureBaselineSeeded();
}

function ensureBaselineSeeded(): void {
  if (baselineSeeded) return;
  baselineSeeded = true;
  for (const entry of buildBaselineGlossaryEntries()) {
    localEntriesMap.set(entry.termId, entry);
  }
}

async function safeAppendAuditLog(db: Firestore | null, record: GlossaryAuditRecord): Promise<void> {
  localAuditLogs.unshift(record);
  if (!db) return;
  try {
    await db.collection(GLOSSARY_AUDIT_COLLECTION).doc(record.auditId).set(record);
  } catch (err: any) {
    console.warn('[GlossaryService] Audit log Firestore write fallback:', err?.message || err);
  }
}

async function loadAllEntries(db: Firestore | null): Promise<GlossaryEntryRecord[]> {
  ensureBaselineSeeded();

  if (db) {
    try {
      const snap = await db.collection(GLOSSARY_COLLECTION).get();
      if (!snap.empty) {
        const merged = new Map<string, GlossaryEntryRecord>(localEntriesMap);
        for (const docSnap of snap.docs) {
          const data = docSnap.data() as GlossaryEntryRecord;
          if (data && data.termId) {
            merged.set(data.termId, data);
            localEntriesMap.set(data.termId, data);
          }
        }
        return Array.from(merged.values());
      }
      // Best-effort seed verified baseline to Firestore when collection is empty
      const batch = db.batch();
      for (const entry of localEntriesMap.values()) {
        batch.set(db.collection(GLOSSARY_COLLECTION).doc(entry.termId), entry);
      }
      await batch.commit().catch(() => {});
    } catch (err: any) {
      console.warn('[GlossaryService] Firestore read fallback to local baseline cache:', err?.message || err);
    }
  }

  return Array.from(localEntriesMap.values());
}

export async function searchGlossaryEntries(
  db: Firestore | null,
  options: GlossarySearchQueryOptions,
  caller?: GlossaryCallerIdentity
): Promise<GlossarySearchResponsePayload> {
  const entries = await loadAllEntries(db);
  const canSeeArchived = caller ? canReviewGlossary(caller) : false;
  const effectiveStatus = canSeeArchived ? options.status || 'approved' : 'approved';

  return searchAndRankGlossaryEntries(entries, {
    ...options,
    status: effectiveStatus,
  });
}

export async function getGlossaryEntryDetail(
  db: Firestore | null,
  termId: string,
  caller?: GlossaryCallerIdentity
): Promise<{
  entry: GlossaryEntryRecord;
  versions: GlossaryEntryVersionRecord[];
} | null> {
  const entries = await loadAllEntries(db);
  const entry = entries.find((e) => e.termId === termId);
  if (!entry) return null;

  const isReviewer = caller ? canReviewGlossary(caller) : false;
  if (entry.status !== 'approved' && !isReviewer) {
    return null;
  }

  let versions = localVersionsMap.get(termId) || [];
  if (db) {
    try {
      const verSnap = await db
        .collection(GLOSSARY_COLLECTION)
        .doc(termId)
        .collection('versions')
        .orderBy('version', 'desc')
        .get();
      if (!verSnap.empty) {
        versions = verSnap.docs.map((d) => d.data() as GlossaryEntryVersionRecord);
        localVersionsMap.set(termId, versions);
      }
    } catch {
      // keep localVersionsMap fallback
    }
  }

  return { entry, versions };
}

export async function submitGlossaryProposal(
  db: Firestore | null,
  caller: GlossaryCallerIdentity,
  rawPayload: unknown
): Promise<GlossarySubmissionRecord> {
  if (!canSubmitGlossaryProposal(caller)) {
    throw new Error(
      'UNAUTHORIZED: Only verified non-anonymous authenticated users (excluding read-only/auditor roles) may submit glossary proposals.'
    );
  }

  const validation = validateGlossarySubmissionPayload(rawPayload);
  if (!validation.ok) {
    throw new Error(`VALIDATION_ERROR: ${validation.error}`);
  }

  if (validation.submissionType === 'revision') {
    const entries = await loadAllEntries(db);
    const exists = entries.some((e) => e.termId === validation.targetTermId);
    if (!exists) {
      throw new Error('NOT_FOUND: Target glossary entry for revision does not exist.');
    }
  }

  const now = new Date().toISOString();
  const submissionId = `gsub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // Server strictly controls workflow status, submitter identity, timestamps, and incomplete flags.
  const record: GlossarySubmissionRecord = {
    submissionId,
    submissionType: validation.submissionType,
    ...(validation.targetTermId ? { targetTermId: validation.targetTermId } : {}),
    proposedEntry: validation.proposedEntry,
    incompleteLanguages: validation.incompleteLanguages,
    aiAssistedDraft: validation.aiAssistedDraft,
    status: 'pending',
    submittedBy: caller.uid,
    ...(caller.email ? { submittedByEmail: caller.email } : {}),
    ...(caller.displayName ? { submittedByName: caller.displayName } : {}),
    ...(caller.institutionId ? { institutionId: caller.institutionId } : {}),
    submittedAt: now,
    updatedAt: now,
  };

  localSubmissionsMap.set(submissionId, record);

  if (db) {
    try {
      await db.collection(GLOSSARY_SUBMISSIONS_COLLECTION).doc(submissionId).set(record);
    } catch (err: any) {
      console.warn('[GlossaryService] Submission Firestore write fallback:', err?.message || err);
    }
  }

  await safeAppendAuditLog(db, {
    auditId: `gaud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    action: validation.submissionType === 'revision' ? 'REVISION_SUBMITTED' : 'TERM_SUBMITTED',
    termId: validation.targetTermId,
    submissionId,
    actorUid: caller.uid,
    actorRole: caller.role || 'user',
    actorEmail: caller.email,
    decision: 'pending',
    reason:
      validation.incompleteLanguages.length > 0
        ? `Submitted with incomplete translations (${validation.incompleteLanguages.join(', ')}) awaiting reviewer verification.`
        : 'Submitted for legal terminology review.',
    timestamp: now,
  });

  return record;
}

export async function listGlossarySubmissionsForCaller(
  db: Firestore | null,
  caller: GlossaryCallerIdentity,
  options: { status?: GlossarySubmissionStatus | 'all'; mineOnly?: boolean } = {}
): Promise<GlossarySubmissionRecord[]> {
  if (!caller.uid || caller.uid === 'guest' || caller.signInProvider === 'anonymous' || caller.emailVerified !== true) {
    throw new Error('UNAUTHORIZED: Verified non-anonymous authentication is required to view submissions.');
  }

  const isReviewer = canReviewGlossary(caller);
  const allMap = new Map<string, GlossarySubmissionRecord>(localSubmissionsMap);

  if (db) {
    try {
      const col = db.collection(GLOSSARY_SUBMISSIONS_COLLECTION);
      const snap = isReviewer && !options.mineOnly
        ? await col.get()
        : await col.where('submittedBy', '==', caller.uid).get();
      for (const docSnap of snap.docs) {
        const sub = docSnap.data() as GlossarySubmissionRecord;
        if (sub?.submissionId) {
          allMap.set(sub.submissionId, sub);
          localSubmissionsMap.set(sub.submissionId, sub);
        }
      }
    } catch (err: any) {
      console.warn('[GlossaryService] Submissions Firestore list fallback:', err?.message || err);
    }
  }

  let list = Array.from(allMap.values());
  if (!isReviewer || options.mineOnly) {
    list = list.filter((s) => s.submittedBy === caller.uid);
  }
  if (options.status && options.status !== 'all') {
    list = list.filter((s) => s.status === options.status);
  }

  list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return list;
}

export interface ReviewGlossarySubmissionInput {
  submissionId: string;
  decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
  reviewerNote: string;
  editedProposedEntry?: Partial<GlossarySubmissionProposedEntry>;
}

export async function reviewGlossarySubmission(
  db: Firestore | null,
  reviewer: GlossaryCallerIdentity,
  input: ReviewGlossarySubmissionInput
): Promise<{
  submission: GlossarySubmissionRecord;
  approvedEntry?: GlossaryEntryRecord;
}> {
  if (!canReviewGlossary(reviewer)) {
    throw new Error('FORBIDDEN: Only authorized legal reviewers or administrators may review glossary submissions.');
  }

  const trimmedNote = (input.reviewerNote || '').normalize('NFC').trim();
  if (!trimmedNote) {
    throw new Error('VALIDATION_ERROR: reviewerNote explaining the decision is required.');
  }

  let submission = localSubmissionsMap.get(input.submissionId);
  if (!submission && db) {
    try {
      const snap = await db.collection(GLOSSARY_SUBMISSIONS_COLLECTION).doc(input.submissionId).get();
      if (snap.exists) {
        submission = snap.data() as GlossarySubmissionRecord;
        localSubmissionsMap.set(submission.submissionId, submission);
      }
    } catch {
      // ignore
    }
  }

  if (!submission) {
    throw new Error(`NOT_FOUND: Submission ${input.submissionId} does not exist.`);
  }

  if (submission.status === 'approved' || submission.status === 'rejected') {
    throw new Error(`INVALID_STATE: Submission ${input.submissionId} is already finalized (${submission.status}).`);
  }

  // Merge any reviewer completions/corrections safely through validation
  let workingProposed: GlossarySubmissionProposedEntry = submission.proposedEntry;
  if (input.editedProposedEntry) {
    const mergedRaw = {
      submissionType: submission.submissionType,
      targetTermId: submission.targetTermId,
      aiAssistedDraft: submission.aiAssistedDraft,
      proposedEntry: {
        ...submission.proposedEntry,
        ...input.editedProposedEntry,
        terms: {
          om: {
            ...submission.proposedEntry.terms.om,
            ...(input.editedProposedEntry.terms?.om || {}),
          },
          am: {
            ...submission.proposedEntry.terms.am,
            ...(input.editedProposedEntry.terms?.am || {}),
          },
          en: {
            ...submission.proposedEntry.terms.en,
            ...(input.editedProposedEntry.terms?.en || {}),
          },
        },
        definitions: {
          ...submission.proposedEntry.definitions,
          ...(input.editedProposedEntry.definitions || {}),
        },
        usageNotes: {
          ...(submission.proposedEntry.usageNotes || {}),
          ...(input.editedProposedEntry.usageNotes || {}),
        },
        translationNotes: {
          ...(submission.proposedEntry.translationNotes || {}),
          ...(input.editedProposedEntry.translationNotes || {}),
        },
      },
    };
    const revalidated = validateGlossarySubmissionPayload(mergedRaw);
    if (!revalidated.ok) {
      throw new Error(`VALIDATION_ERROR: ${revalidated.error}`);
    }
    workingProposed = revalidated.proposedEntry;
  }

  const now = new Date().toISOString();
  const incompleteLanguages = detectIncompleteLanguages(workingProposed);

  if (input.decision === 'REQUEST_CHANGES' || input.decision === 'REJECT') {
    const nextStatus: GlossarySubmissionStatus =
      input.decision === 'REQUEST_CHANGES' ? 'needs_changes' : 'rejected';

    const updatedSub: GlossarySubmissionRecord = {
      ...submission,
      proposedEntry: workingProposed,
      incompleteLanguages,
      status: nextStatus,
      reviewedBy: reviewer.uid,
      reviewedAt: now,
      updatedAt: now,
      reviewerNote: trimmedNote,
      reason: trimmedNote,
    };

    localSubmissionsMap.set(updatedSub.submissionId, updatedSub);
    if (db) {
      try {
        await db.collection(GLOSSARY_SUBMISSIONS_COLLECTION).doc(updatedSub.submissionId).set(updatedSub);
      } catch {}
    }

    await safeAppendAuditLog(db, {
      auditId: `gaud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      action: input.decision === 'REQUEST_CHANGES' ? 'SUBMISSION_NEEDS_CHANGES' : 'SUBMISSION_REJECTED',
      termId: submission.targetTermId,
      submissionId: updatedSub.submissionId,
      actorUid: reviewer.uid,
      actorRole: reviewer.role || 'reviewer',
      actorEmail: reviewer.email,
      decision: nextStatus,
      reason: trimmedNote,
      timestamp: now,
    });

    return { submission: updatedSub };
  }

  // APPROVE: Enforce completeness & source verification gate
  if (incompleteLanguages.length > 0) {
    throw new Error(
      `INCOMPLETE_TERMINOLOGY: Cannot publish while missing terms or definitions for: ${incompleteLanguages.join(', ')}. Complete all three languages first or mark "needs_changes".`
    );
  }

  const hasVerifiedSource =
    (workingProposed.sourceReferences && workingProposed.sourceReferences.length > 0) ||
    Boolean(workingProposed.isGeneralLegalDefinition) ||
    Boolean(workingProposed.noSourceJustification && workingProposed.noSourceJustification.trim().length >= 8);

  if (!hasVerifiedSource) {
    throw new Error(
      'SOURCE_REFERENCE_REQUIRED: Cannot approve without at least one source reference, an explicit general legal definition flag, or a justified noSourceJustification.'
    );
  }

  const allEntries = await loadAllEntries(db);
  const existingEntry =
    submission.submissionType === 'revision' && submission.targetTermId
      ? allEntries.find((e) => e.termId === submission.targetTermId)
      : undefined;

  if (submission.submissionType === 'revision' && !existingEntry) {
    throw new Error(`NOT_FOUND: Target glossary entry ${submission.targetTermId} no longer exists.`);
  }

  // Preserve previous approved version snapshot cleanly before incrementing version
  let previousVersion: number | undefined;
  if (existingEntry) {
    previousVersion = existingEntry.version;
    const { searchTokens: _omitTokens, ...snapshotWithoutTokens } = existingEntry;
    const versionRecord: GlossaryEntryVersionRecord = {
      versionId: `v${existingEntry.version}_${Date.now()}`,
      termId: existingEntry.termId,
      version: existingEntry.version,
      snapshot: snapshotWithoutTokens,
      archivedAt: now,
      archivedBy: reviewer.uid,
      changeReason: trimmedNote,
      submissionId: submission.submissionId,
    };

    const prevList = localVersionsMap.get(existingEntry.termId) || [];
    localVersionsMap.set(existingEntry.termId, [versionRecord, ...prevList]);

    if (db) {
      try {
        await db
          .collection(GLOSSARY_COLLECTION)
          .doc(existingEntry.termId)
          .collection('versions')
          .doc(versionRecord.versionId)
          .set(versionRecord);
      } catch {}
    }
  }

  const termId = existingEntry
    ? existingEntry.termId
    : `term_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const conceptId = existingEntry
    ? existingEntry.conceptId
    : `concept_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const approvedWithoutTokens: Omit<GlossaryEntryRecord, 'searchTokens'> = {
    termId,
    conceptId,
    terms: workingProposed.terms,
    definitions: workingProposed.definitions,
    usageNotes: workingProposed.usageNotes || {},
    ...(workingProposed.translationNotes ? { translationNotes: workingProposed.translationNotes } : {}),
    ...(workingProposed.noExactEquivalent ? { noExactEquivalent: workingProposed.noExactEquivalent } : {}),
    domain: workingProposed.domain,
    jurisdiction: workingProposed.jurisdiction,
    sourceReferences: workingProposed.sourceReferences,
    ...(workingProposed.isGeneralLegalDefinition ? { isGeneralLegalDefinition: true } : {}),
    ...(workingProposed.noSourceJustification
      ? { noSourceJustification: workingProposed.noSourceJustification }
      : {}),
    status: 'approved',
    version: existingEntry ? existingEntry.version + 1 : 1,
    createdAt: existingEntry ? existingEntry.createdAt : now,
    updatedAt: now,
    createdBy: existingEntry ? existingEntry.createdBy : submission.submittedBy,
    updatedBy: reviewer.uid,
    reviewedAt: now,
    reviewedBy: reviewer.uid,
  };

  const approvedEntry: GlossaryEntryRecord = {
    ...approvedWithoutTokens,
    searchTokens: buildGlossarySearchTokens(approvedWithoutTokens),
  };

  localEntriesMap.set(termId, approvedEntry);

  const updatedSub: GlossarySubmissionRecord = {
    ...submission,
    targetTermId: termId,
    proposedEntry: workingProposed,
    incompleteLanguages: [],
    status: 'approved',
    reviewedBy: reviewer.uid,
    reviewedAt: now,
    updatedAt: now,
    reviewerNote: trimmedNote,
    reason: trimmedNote,
  };
  localSubmissionsMap.set(updatedSub.submissionId, updatedSub);

  if (db) {
    try {
      await db.collection(GLOSSARY_COLLECTION).doc(termId).set(approvedEntry);
      await db.collection(GLOSSARY_SUBMISSIONS_COLLECTION).doc(updatedSub.submissionId).set(updatedSub);
    } catch (err: any) {
      console.warn('[GlossaryService] Approval Firestore write fallback:', err?.message || err);
    }
  }

  await safeAppendAuditLog(db, {
    auditId: `gaud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    action: 'SUBMISSION_APPROVED',
    termId,
    submissionId: updatedSub.submissionId,
    actorUid: reviewer.uid,
    actorRole: reviewer.role || 'reviewer',
    actorEmail: reviewer.email,
    previousVersion,
    newVersion: approvedEntry.version,
    decision: 'approved',
    reason: trimmedNote,
    timestamp: now,
  });

  return { submission: updatedSub, approvedEntry };
}

export async function archiveGlossaryEntry(
  db: Firestore | null,
  reviewer: GlossaryCallerIdentity,
  termId: string,
  reason: string
): Promise<GlossaryEntryRecord> {
  if (!canReviewGlossary(reviewer)) {
    throw new Error('FORBIDDEN: Only authorized reviewers or administrators may archive glossary entries.');
  }
  const cleanReason = (reason || '').trim();
  if (!cleanReason) {
    throw new Error('VALIDATION_ERROR: Archiving reason is required.');
  }

  const entries = await loadAllEntries(db);
  const existing = entries.find((e) => e.termId === termId);
  if (!existing) {
    throw new Error(`NOT_FOUND: Glossary entry ${termId} does not exist.`);
  }

  const now = new Date().toISOString();
  const archived: GlossaryEntryRecord = {
    ...existing,
    status: 'archived',
    updatedAt: now,
    updatedBy: reviewer.uid,
  };
  localEntriesMap.set(termId, archived);

  if (db) {
    try {
      await db.collection(GLOSSARY_COLLECTION).doc(termId).set(archived);
    } catch {}
  }

  await safeAppendAuditLog(db, {
    auditId: `gaud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    action: 'ENTRY_ARCHIVED',
    termId,
    actorUid: reviewer.uid,
    actorRole: reviewer.role || 'reviewer',
    actorEmail: reviewer.email,
    previousVersion: existing.version,
    newVersion: existing.version,
    decision: 'archived',
    reason: cleanReason,
    timestamp: now,
  });

  return archived;
}

export async function listGlossaryAuditLogs(
  db: Firestore | null,
  caller: GlossaryCallerIdentity,
  termId?: string
): Promise<GlossaryAuditRecord[]> {
  if (!canReviewGlossary(caller)) {
    throw new Error('FORBIDDEN: Only authorized reviewers or administrators may view glossary audit logs.');
  }

  const combined = new Map<string, GlossaryAuditRecord>();
  for (const log of localAuditLogs) {
    combined.set(log.auditId, log);
  }

  if (db) {
    try {
      const ref = db.collection(GLOSSARY_AUDIT_COLLECTION);
      const snap = termId
        ? await ref.where('termId', '==', termId).limit(100).get()
        : await ref.orderBy('timestamp', 'desc').limit(100).get();
      for (const docSnap of snap.docs) {
        const rec = docSnap.data() as GlossaryAuditRecord;
        if (rec?.auditId) combined.set(rec.auditId, rec);
      }
    } catch {}
  }

  let logs = Array.from(combined.values());
  if (termId) {
    logs = logs.filter((l) => l.termId === termId);
  }
  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return logs.slice(0, 100);
}
