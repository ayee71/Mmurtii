import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import legalAnswerRoute from '../src/server/legal/legalAnswerRoute';
import {
  archiveGlossaryEntry,
  canReviewGlossary,
  canSubmitGlossaryProposal,
  getGlossaryEntryDetail,
  GlossaryCallerIdentity,
  listGlossaryAuditLogs,
  listGlossarySubmissionsForCaller,
  resetGlossaryInMemoryStoreForTests,
  reviewGlossarySubmission,
  searchGlossaryEntries,
  submitGlossaryProposal,
} from '../src/server/legal/glossaryService';
import {
  buildGlossarySearchTokens,
  GlossaryEntryRecord,
  normalizeGlossaryText,
  searchAndRankGlossaryEntries,
  validateGlossarySubmissionPayload,
  validateSourceReferences,
} from '../src/shared/legalGlossarySchema';

let passed = 0;
let failed = 0;

async function runCheck(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`FAIL: ${name}\n  -> ${err?.message || err}`);
  }
}

async function requestJson(
  server: http.Server,
  method: string,
  urlPath: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: any }> {
  const addr = server.address() as { port: number };
  const payload = body !== undefined ? JSON.stringify(body) : undefined;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path: urlPath,
        method,
        headers: {
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, json: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode || 0, json: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const VERIFIED_USER: GlossaryCallerIdentity = {
  uid: 'user_verified_1',
  email: 'citizen@example.org',
  emailVerified: true,
  signInProvider: 'password',
  role: 'user',
};

const OTHER_VERIFIED_USER: GlossaryCallerIdentity = {
  uid: 'user_verified_2',
  email: 'lawyer@example.org',
  emailVerified: true,
  signInProvider: 'password',
  role: 'user',
};

const AUDITOR_USER: GlossaryCallerIdentity = {
  uid: 'auditor_1',
  email: 'auditor@court.gov.et',
  emailVerified: true,
  signInProvider: 'password',
  role: 'auditor',
  institutionId: 'inst_oromia_1',
};

const ANONYMOUS_USER: GlossaryCallerIdentity = {
  uid: 'anon_1',
  emailVerified: false,
  signInProvider: 'anonymous',
};

const UNVERIFIED_USER: GlossaryCallerIdentity = {
  uid: 'unver_1',
  email: 'unverified@example.org',
  emailVerified: false,
  signInProvider: 'password',
};

const OWNER_EMAIL_WITHOUT_CLAIM: GlossaryCallerIdentity = {
  uid: 'impersonator_1',
  email: 'ayeledha@gmail.com',
  emailVerified: true,
  signInProvider: 'password',
  role: 'user',
  isAdminClaim: false,
};

const REVIEWER_JUDGE: GlossaryCallerIdentity = {
  uid: 'judge_reviewer_1',
  email: 'judge.reviewer@court.gov.et',
  emailVerified: true,
  signInProvider: 'password',
  role: 'judge',
  institutionId: 'inst_oromia_1',
};

async function main() {
  console.log('--- SEERAAI PRO TRILINGUAL LEGAL GLOSSARY VERIFICATION SUITE ---\n');
  resetGlossaryInMemoryStoreForTests();

  await runCheck('1. Trilingual search in om, am, and en returns exact same conceptId & termId', async () => {
    const omRes = await searchGlossaryEntries(null, { query: 'Heera Mootummaa' });
    const amRes = await searchGlossaryEntries(null, { query: 'ሕገ-መንግሥት' });
    const enRes = await searchGlossaryEntries(null, { query: 'Constitution' });

    assert.ok(omRes.items.length > 0, 'Oromo constitution query should match');
    assert.ok(amRes.items.length > 0, 'Amharic constitution query should match');
    assert.ok(enRes.items.length > 0, 'English constitution query should match');

    assert.equal(omRes.items[0].entry.termId, amRes.items[0].entry.termId);
    assert.equal(amRes.items[0].entry.conceptId, enRes.items[0].entry.conceptId);
    assert.equal(omRes.items[0].matchReasons[0]?.language, 'om');
    assert.equal(amRes.items[0].matchReasons[0]?.language, 'am');
    assert.equal(enRes.items[0].matchReasons[0]?.language, 'en');
  });

  await runCheck('2. Unicode NFC normalization handles Ethiopic script, Qubee apostrophes, and punctuation cleanly', () => {
    assert.equal(normalizeGlossaryText('  Heera   Mootummaa!! '), 'heera mootummaa');
    assert.equal(normalizeGlossaryText("Mirga’aafi   Dirqama"), "mirga'aafi dirqama");
    assert.equal(normalizeGlossaryText("Mirga`aafi   Dirqama"), "mirga'aafi dirqama");
    const amNorm = normalizeGlossaryText('ሕገ\u200B-መንግሥት');
    assert.equal(amNorm, 'ሕገ-መንግሥት');
  });

  await runCheck('3. Synonym search & ranking prioritize preferred > synonym > definition and separate concepts', () => {
    const makeEntry = (
      id: string,
      enPref: string,
      enSyns: string[],
      enDef: string,
      jurisdiction: string[]
    ): GlossaryEntryRecord => {
      const base: Omit<GlossaryEntryRecord, 'searchTokens'> = {
        termId: `term_${id}`,
        conceptId: `concept_${id}`,
        terms: {
          om: { preferred: `${id} (om)`, synonyms: [] },
          am: { preferred: `${id} (am)`, synonyms: [] },
          en: { preferred: enPref, synonyms: enSyns },
        },
        definitions: {
          om: `${id} ibsa`,
          am: `${id} ትርጉም`,
          en: enDef,
        },
        usageNotes: {},
        domain: 'evidence',
        jurisdiction,
        sourceReferences: [{ sourceType: 'code', title: 'Federal Evidence Law' }],
        status: 'approved',
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'test',
        updatedBy: 'test',
        reviewedAt: '2026-01-01T00:00:00.000Z',
        reviewedBy: 'judge_1',
      };
      return { ...base, searchTokens: buildGlossarySearchTokens(base) };
    };

    const sample: GlossaryEntryRecord[] = [
      makeEntry('def_hit', 'Admissibility', [], 'Concerns burden of proof in criminal litigation.', ['Federal Ethiopia']),
      makeEntry('syn_hit', 'Onus Probandi', ['Burden of Proof'], 'Duty to establish facts.', ['Federal Ethiopia']),
      makeEntry('pref_hit', 'Burden of Proof', ['Evidentiary Duty'], 'Legal obligation to prove a disputed assertion.', ['Oromia']),
      makeEntry('std_hit', 'Standard of Proof', [], 'Degree of certainty required (preponderance or beyond reasonable doubt).', ['Federal Ethiopia']),
    ];

    const ranked = searchAndRankGlossaryEntries(sample, { query: 'Burden of Proof' });
    assert.equal(ranked.items.length, 3);
    assert.equal(ranked.items[0].entry.termId, 'term_pref_hit');
    assert.equal(ranked.items[1].entry.termId, 'term_syn_hit');
    assert.equal(ranked.items[2].entry.termId, 'term_def_hit');
    assert.ok(ranked.items[0].score > ranked.items[1].score);
    assert.ok(ranked.items[1].score > ranked.items[2].score);

    // Verify Burden of Proof & Standard of Proof remain distinct concepts, plus Oromia jurisdiction filter
    const oromiaOnly = searchAndRankGlossaryEntries(sample, { jurisdiction: 'Oromia' });
    assert.equal(oromiaOnly.items.length, 1);
    assert.equal(oromiaOnly.items[0].entry.termId, 'term_pref_hit');
  });

  await runCheck('4. Pagination and empty/no-results states work deterministically', async () => {
    const page1 = await searchGlossaryEntries(null, { page: 1, pageSize: 2 });
    const page2 = await searchGlossaryEntries(null, { page: 2, pageSize: 2 });
    assert.equal(page1.items.length, 2);
    assert.equal(page2.items.length, 2);
    assert.notEqual(page1.items[0].entry.termId, page2.items[0].entry.termId);
    assert.equal(page1.hasMore, true);

    const noMatch = await searchGlossaryEntries(null, { query: 'NoSuchLegalTermXYZ999' });
    assert.equal(noMatch.items.length, 0);
    assert.equal(noMatch.total, 0);
    assert.equal(noMatch.hasMore, false);
  });

  await runCheck('5. RBAC enforces strict isolation for anonymous, unverified, auditor, ordinary, and claimless owner email', async () => {
    assert.equal(canSubmitGlossaryProposal(ANONYMOUS_USER), false);
    assert.equal(canSubmitGlossaryProposal(UNVERIFIED_USER), false);
    assert.equal(canSubmitGlossaryProposal(AUDITOR_USER), false);
    assert.equal(canSubmitGlossaryProposal(VERIFIED_USER), true);

    assert.equal(canReviewGlossary(ANONYMOUS_USER), false);
    assert.equal(canReviewGlossary(UNVERIFIED_USER), false);
    assert.equal(canReviewGlossary(AUDITOR_USER), false);
    assert.equal(canReviewGlossary(VERIFIED_USER), false);
    assert.equal(canReviewGlossary(OWNER_EMAIL_WITHOUT_CLAIM), false);
    assert.equal(canReviewGlossary(REVIEWER_JUDGE), true);

    await assert.rejects(
      () =>
        submitGlossaryProposal(null, AUDITOR_USER, {
          submissionType: 'new_term',
          proposedEntry: {
            sourceLanguage: 'en',
            terms: { om: { preferred: '', synonyms: [] }, am: { preferred: '', synonyms: [] }, en: { preferred: 'Audit Test', synonyms: [] } },
            definitions: { om: '', am: '', en: 'Definition' },
            domain: 'other',
            jurisdiction: ['Federal Ethiopia'],
            sourceReferences: [],
          },
        }),
      /UNAUTHORIZED/
    );
  });

  await runCheck('6. Partial-language & AI draft submissions stay pending and require completion + verified source before approval', async () => {
    resetGlossaryInMemoryStoreForTests();
    const sub = await submitGlossaryProposal(null, VERIFIED_USER, {
      submissionType: 'new_term',
      aiAssistedDraft: true,
      proposedEntry: {
        sourceLanguage: 'om',
        terms: {
          om: { preferred: 'Mirga Dursa', synonyms: ['Mirga Hundee'] },
          am: { preferred: '', synonyms: [] },
          en: { preferred: '', synonyms: [] },
        },
        definitions: {
          om: 'Mirga bu\'uuraa seeraan eegamu.',
          am: '',
          en: '',
        },
        domain: 'constitutional',
        jurisdiction: ['Federal Ethiopia', 'Oromia'],
        sourceReferences: [],
      },
    });

    assert.equal(sub.status, 'pending');
    assert.equal(sub.aiAssistedDraft, true);
    assert.deepEqual(sub.incompleteLanguages, ['am', 'en']);

    // Scope isolation: another non-reviewer user cannot see VERIFIED_USER's submission
    const otherSubs = await listGlossarySubmissionsForCaller(null, OTHER_VERIFIED_USER);
    assert.equal(otherSubs.length, 0);
    const ownSubs = await listGlossarySubmissionsForCaller(null, VERIFIED_USER);
    assert.equal(ownSubs.length, 1);

    // Non-reviewer cannot approve
    await assert.rejects(
      () =>
        reviewGlossarySubmission(null, VERIFIED_USER, {
          submissionId: sub.submissionId,
          decision: 'APPROVE',
          reviewerNote: 'Self-approve attempt',
        }),
      /FORBIDDEN/
    );

    // Reviewer cannot approve while languages are incomplete
    await assert.rejects(
      () =>
        reviewGlossarySubmission(null, REVIEWER_JUDGE, {
          submissionId: sub.submissionId,
          decision: 'APPROVE',
          reviewerNote: 'Trying to approve incomplete entry',
        }),
      /INCOMPLETE_TERMINOLOGY/
    );

    // Reviewer completing languages WITHOUT source reference also blocked
    await assert.rejects(
      () =>
        reviewGlossarySubmission(null, REVIEWER_JUDGE, {
          submissionId: sub.submissionId,
          decision: 'APPROVE',
          reviewerNote: 'Completed text without citing statute',
          editedProposedEntry: {
            terms: {
              om: { preferred: 'Mirga Dursa', synonyms: ['Mirga Hundee'] },
              am: { preferred: 'ቀዳሚ መብት', synonyms: [] },
              en: { preferred: 'Primary Right', synonyms: [] },
            },
            definitions: {
              om: 'Mirga bu\'uuraa seeraan eegamu.',
              am: 'በሕግ የተጠበቀ መሠረታዊ መብት።',
              en: 'A fundamental right protected by law.',
            },
          },
        }),
      /SOURCE_REFERENCE_REQUIRED/
    );

    // Reviewer completes all 3 languages AND adds verified statute reference -> approves & publishes!
    const approved = await reviewGlossarySubmission(null, REVIEWER_JUDGE, {
      submissionId: sub.submissionId,
      decision: 'APPROVE',
      reviewerNote: 'Verified against FDRE Constitution Art. 13-44.',
      editedProposedEntry: {
        terms: {
          om: { preferred: 'Mirga Dursa', synonyms: ['Mirga Hundee'] },
          am: { preferred: 'ቀዳሚ መብት', synonyms: [] },
          en: { preferred: 'Primary Right', synonyms: [] },
        },
        definitions: {
          om: 'Mirga bu\'uuraa seeraan eegamu.',
          am: 'በሕግ የተጠበቀ መሠረታዊ መብት።',
          en: 'A fundamental right protected by law.',
        },
        sourceReferences: [
          {
            sourceType: 'constitution',
            title: 'FDRE Constitution',
            articleOrSection: 'Art. 13',
          },
        ],
      },
    });

    assert.equal(approved.submission.status, 'approved');
    assert.equal(approved.approvedEntry?.status, 'approved');
    assert.equal(approved.approvedEntry?.version, 1);

    // Revision workflow preserves prior approved snapshot in versions subcollection
    const termId = approved.approvedEntry!.termId;
    const revSub = await submitGlossaryProposal(null, VERIFIED_USER, {
      submissionType: 'revision',
      targetTermId: termId,
      proposedEntry: {
        ...approved.approvedEntry!,
        sourceLanguage: 'en',
        definitions: {
          ...approved.approvedEntry!.definitions,
          en: 'A fundamental constitutional entitlement enforceable by courts.',
        },
      },
    });

    const revApproved = await reviewGlossarySubmission(null, REVIEWER_JUDGE, {
      submissionId: revSub.submissionId,
      decision: 'APPROVE',
      reviewerNote: 'Clarified judicial enforceability.',
    });
    assert.equal(revApproved.approvedEntry?.version, 2);

    const detail = await getGlossaryEntryDetail(null, termId);
    assert.ok(detail);
    assert.equal(detail.entry.version, 2);
    assert.equal(detail.versions.length, 1);
    assert.equal(detail.versions[0].version, 1);
    assert.equal(detail.versions[0].snapshot.definitions.en, 'A fundamental right protected by law.');

    // Archive requires reviewer role & logs audit event
    await assert.rejects(
      () => archiveGlossaryEntry(null, VERIFIED_USER, termId, 'Unauthorized'),
      /FORBIDDEN/
    );
    const archived = await archiveGlossaryEntry(null, REVIEWER_JUDGE, termId, 'Superseded by test check');
    assert.equal(archived.status, 'archived');

    const logs = await listGlossaryAuditLogs(null, REVIEWER_JUDGE, termId);
    assert.ok(logs.some((l) => l.action === 'SUBMISSION_APPROVED'));
    assert.ok(logs.some((l) => l.action === 'ENTRY_ARCHIVED'));
  });

  await runCheck('7. Source reference validation rejects invalid/javascript URLs', () => {
    const bad = validateSourceReferences([
      { sourceType: 'proclamation', title: 'Test Law', url: 'javascript:alert(1)' },
    ]);
    assert.equal(bad.ok, false);

    const good = validateSourceReferences([
      { sourceType: 'proclamation', title: 'Proclamation 1156/2019', url: 'https://law.et/1156' },
    ]);
    assert.equal(good.ok, true);
  });

  await runCheck('8. Live HTTP integration tests on /api/legal/glossary enforce fail-closed RBAC', async () => {
    resetGlossaryInMemoryStoreForTests();
    const app = express();
    app.use(express.json());
    app.use('/api/legal', legalAnswerRoute);
    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    try {
      const publicGet = await requestJson(server, 'GET', '/api/legal/glossary?q=Constitution');
      assert.equal(publicGet.status, 200);
      assert.equal(publicGet.json?.ok, true);
      assert.ok(publicGet.json?.items?.length >= 1);
      assert.equal(publicGet.json?.permissions?.canSubmit, false);
      assert.equal(publicGet.json?.permissions?.canReview, false);

      const unauthPost = await requestJson(server, 'POST', '/api/legal/glossary/submissions', {
        submittedBy: 'forged_admin',
        status: 'approved',
      });
      assert.equal(unauthPost.status, 401);

      const unauthSubs = await requestJson(server, 'GET', '/api/legal/glossary/submissions');
      assert.equal(unauthSubs.status, 401);

      const unauthReview = await requestJson(
        server,
        'POST',
        '/api/legal/glossary/submissions/fake_id/review',
        { decision: 'APPROVE', reviewerNote: 'forged' }
      );
      assert.equal(unauthReview.status, 401);

      const unauthAudit = await requestJson(server, 'GET', '/api/legal/glossary/audit');
      assert.equal(unauthAudit.status, 401);

      const missingTerm = await requestJson(server, 'GET', '/api/legal/glossary/nonexistent_term_xyz');
      assert.equal(missingTerm.status, 404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  await runCheck('9. Navigation labels, Desktop Navbar exposure, and /api/legal-dictionary AI draft labels hold', () => {
    const om = fs.readFileSync(path.resolve(process.cwd(), 'src/i18n/om.ts'), 'utf8');
    const am = fs.readFileSync(path.resolve(process.cwd(), 'src/i18n/am.ts'), 'utf8');
    const en = fs.readFileSync(path.resolve(process.cwd(), 'src/i18n/en.ts'), 'utf8');
    const navbar = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Navbar.tsx'), 'utf8');
    const srv = fs.readFileSync(path.resolve(process.cwd(), 'server-app.ts'), 'utf8');

    assert.ok(om.includes('glossary: "Hiika Jechoota Seeraa"'));
    assert.ok(am.includes('glossary: "የሕግ ቃላት መዝገበ ቃላት"'));
    assert.ok(en.includes('glossary: "Legal Glossary"'));
    assert.ok(navbar.includes("id: 'glossary'"));
    assert.ok(srv.includes('aiDraft: true'));
    assert.ok(srv.includes("verificationStatus: 'UNVERIFIED'"));
  });

  console.log(`\nGlossary Verification Summary: ${passed}/${passed + failed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal glossary test error:', err);
  process.exit(1);
});
