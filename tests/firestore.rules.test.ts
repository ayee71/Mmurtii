/**
 * SEERAAI PRO — Candidate Firestore Security Rules Verification Suite (Phase 8B.6.8)
 * Target Ruleset: firestore.rules.phase8b5.3.integrated.candidate
 * Target Project: demo-seeraai-test (isolated emulator only)
 *
 * Covers authentication tiers, guest isolation, unverified gating, impersonation defense,
 * institutional isolation, and workflow regression against Firebase Emulator Suite.
 *
 * Run with:
 *   firebase emulators:exec --config firebase.emulator.test.json --project demo-seeraai-test --only firestore "npx tsx tests/firestore.rules.test.ts"
 */
import fs from 'node:fs';
import path from 'node:path';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  detail?: string;
}

async function runFirestoreRulesSuite(): Promise<void> {
  let testingModule: any;
  try {
    testingModule = await import('@firebase/rules-unit-testing' as string);
  } catch {
    console.error(
      'BLOCKED: @firebase/rules-unit-testing is not installed and Java JRE / Firebase Firestore Emulator is required.'
    );
    console.error(
      'Next step: Install Java JRE + devDependency @firebase/rules-unit-testing, then execute:\n  firebase emulators:exec --config firebase.emulator.test.json --project demo-seeraai-test --only firestore "npx tsx tests/firestore.rules.test.ts"'
    );
    process.exit(2);
  }

  const { initializeTestEnvironment, assertFails, assertSucceeds } = testingModule;
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules.phase8b5.3.integrated.candidate');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-seeraai-test',
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  const INST_A = 'inst_oromia_high_court_a';
  const INST_B = 'inst_federal_high_court_b';

  await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
    const db = ctx.firestore();
    await db.doc('users/ordinary_u1').set({ uid: 'ordinary_u1', role: 'user', email: 'u1@example.org', subscriptionTier: 'free' });
    await db.doc('users/verified_norole').set({ uid: 'verified_norole', role: 'user', email: 'public@example.org', subscriptionTier: 'free' });
    await db.doc('users/judge_a1').set({ uid: 'judge_a1', role: 'judge', institutionId: INST_A, email: 'judge.a1@court.gov.et' });

    await db.doc(`court_institutions/${INST_A}`).set({ id: INST_A, name: 'East Shoa High Court', status: 'approved' });
    await db.doc(`court_institutions/${INST_B}`).set({ id: INST_B, name: 'Federal High Court B', status: 'approved' });

    await db.doc('court_documents/doc_a1').set({ id: 'doc_a1', institutionId: INST_A, createdBy: 'judge_a1', title: 'Ruling A1', isPublic: false });
    await db.doc('court_documents/doc_b1').set({ id: 'doc_b1', institutionId: INST_B, createdBy: 'judge_b1', title: 'Ruling B1', isPublic: false });
    await db.doc(`institutions/${INST_A}/courtDocuments/cd_a1`).set({ id: 'cd_a1', institutionId: INST_A, createdBy: 'judge_a1', title: 'Sealed Order A' });
    await db.doc(`institutions/${INST_B}/courtDocuments/cd_b1`).set({ id: 'cd_b1', institutionId: INST_B, createdBy: 'judge_b1', title: 'Sealed Order B' });
    await db.doc(`institutions/${INST_A}/auditLogs/log_a1`).set({ id: 'log_a1', actorUid: 'judge_a1', action: 'VIEW_CASE' });

    await db.doc('cases/case_a1').set({ id: 'case_a1', institutionId: INST_A, title: 'File 100/2026', isPublic: false });
    await db.doc('cases/case_b1').set({ id: 'case_b1', institutionId: INST_B, title: 'File 200/2026', isPublic: false });
    await db.doc('cases/case_a1/audio_recordings/aud_1').set({ id: 'aud_1', institutionId: INST_A, caseId: 'case_a1' });
    await db.doc('witness_statements/ws_a1').set({ id: 'ws_a1', institutionId: INST_A, witnessName: 'Witness A' });
    await db.doc('witness_schedules/wsch_a1').set({ id: 'wsch_a1', institutionId: INST_A, caseNumber: '100/2026', userId: 'judge_a1' });
    await db.doc('court_audio_recordings/car_a1').set({ id: 'car_a1', institutionId: INST_A, caseId: 'case_a1' });

    await db.doc('user_documents/ud_u1').set({ id: 'ud_u1', userId: 'ordinary_u1', ownerId: 'ordinary_u1', title: 'Unverified Brief' });
    await db.doc('user_documents/ud_ver').set({ id: 'ud_ver', userId: 'verified_norole', ownerId: 'verified_norole', title: 'Private Client Memo' });
    await db.doc('document_drafts/draft_public').set({ id: 'draft_public', isPublic: true, ownerId: 'super_admin_1', title: 'Public Motion Sample' });
    await db.doc('document_drafts/draft_private_ver').set({ id: 'draft_private_ver', isPublic: false, userId: 'verified_norole', ownerId: 'verified_norole', title: 'Private Contract Draft' });
    await db.doc('objection_templates/ot_ver').set({ id: 'ot_ver', userId: 'verified_norole', title: 'Verified Objection' });
    await db.doc('annotations/ann_ver').set({ id: 'ann_ver', userId: 'verified_norole', text: 'Private note' });
    await db.doc('practice_cases/pc_anon').set({ id: 'pc_anon', userId: 'anon_1', title: 'Gurbicha Guest Practice Case' });

    await db.doc('admin_activity_logs/adm_log_1').set({ id: 'adm_log_1', action: 'CLAIMS_UPDATE', targetUid: 'judge_a1' });
    await db.doc('telegram_logs/tlog_1').set({ id: 'tlog_1', chatId: '99999', text: 'internal log' });
    await db.doc('telegram_posts/tp_1').set({ id: 'tp_1', text: 'Cassation File 241890', url: 'https://t.me/seeraai_ethio/125' });
    await db.doc('telegram_archive/ta_1').set({ id: 'ta_1', title: 'Archived Ruling 125', link: 'https://t.me/seeraai_ethio/125' });
    await db.doc('legislation_repository/proc_1156').set({ id: 'proc_1156', title: 'Labor Proclamation 1156/2019' });
    await db.doc(`court_branding/${INST_A}`).set({ name: 'East Shoa High Court', logoUrl: 'https://example.org/logo.png' });
    await db.doc('courtroom_sessions/main-courtroom').set({ status: 'active', googleMeetLink: 'https://meet.jit.si/SeeraAI' });

    await db.doc('legal_glossary/term_test_approved').set({ termId: 'term_test_approved', status: 'approved', version: 1 });
    await db.doc('legal_glossary/term_test_archived').set({ termId: 'term_test_archived', status: 'archived', version: 1 });
    await db.doc('legal_glossary/term_test_approved/versions/v1').set({ versionId: 'v1', termId: 'term_test_approved', version: 1 });
    await db.doc('glossary_submissions/sub_ver_1').set({ submissionId: 'sub_ver_1', submittedBy: 'verified_norole', status: 'pending' });
    await db.doc('glossary_audit_logs/gaud_1').set({ auditId: 'gaud_1', actorUid: 'judge_a1', action: 'SUBMISSION_APPROVED' });

    await db.doc('translation_records/trn_ver_1').set({
      translationId: 'trn_ver_1',
      ownerUid: 'verified_norole',
      sourceLanguage: 'om',
      targetLanguage: 'am',
      isRewrite: false,
    });
    await db.doc('translation_records/trn_inst_a').set({
      translationId: 'trn_inst_a',
      ownerUid: 'judge_a1',
      institutionId: INST_A,
      sourceLanguage: 'am',
      targetLanguage: 'en',
      isRewrite: false,
    });
    await db.doc('translation_feedback/tfb_ver_1').set({
      feedbackId: 'tfb_ver_1',
      translationId: 'trn_ver_1',
      submittedBy: 'verified_norole',
      status: 'accepted',
      overallRating: 5,
    });
    await db.doc('translation_feedback/tfb_ver_1/private_review/decision').set({
      feedbackId: 'tfb_ver_1',
      reviewedBy: 'super_admin_1',
      reviewerNotes: 'Internal reviewer only note',
      decisionReason: 'Verified terminology',
    });
    await db.doc('translation_feedback/tfb_inst_a').set({
      feedbackId: 'tfb_inst_a',
      translationId: 'trn_inst_a',
      submittedBy: 'judge_a1',
      institutionId: INST_A,
      status: 'under_review',
      overallRating: 4,
    });
    await db.doc('translation_feedback/tfb_inst_a/private_review/decision').set({
      feedbackId: 'tfb_inst_a',
      institutionId: INST_A,
      reviewedBy: 'cadmin_a1',
      reviewerNotes: 'Institution A internal note',
      decisionReason: 'Pending legal expert confirmation',
    });
    await db.doc('translation_feedback_rate_limits/verified_norole').set({
      uid: 'verified_norole',
      windowStartMs: Date.now(),
      count: 1,
    });
    await db.doc('translation_feedback_audit_logs/tfbaud_1').set({
      auditId: 'tfbaud_1',
      action: 'FEEDBACK_MODERATED',
      institutionId: INST_A,
      actorUid: 'cadmin_a1',
    });
    const tsNow = new Date();
    await db.doc('precedent_comments/pc_inst_a_1').set({
      commentId: 'pc_inst_a_1',
      precedentId: 'fed_225467',
      fileNumber: '225467',
      authorUid: 'judge_a1',
      authorName: 'Judge A1',
      authorRole: 'judge',
      institutionId: INST_A,
      institutionName: 'East Shoa High Court',
      commentType: 'private_note',
      visibility: 'institution_private',
      content: 'Institutional note on precedent 225467',
      status: 'open',
      createdAt: tsNow,
      updatedAt: tsNow,
    });
    await db.doc('precedent_comments/pc_personal_a_1').set({
      commentId: 'pc_personal_a_1',
      precedentId: 'fed_225467',
      fileNumber: '225467',
      authorUid: 'judge_a1',
      authorName: 'Judge A1',
      authorRole: 'judge',
      institutionId: INST_A,
      institutionName: 'East Shoa High Court',
      commentType: 'legal_question',
      visibility: 'personal_private',
      content: 'Personal private bench question on 225467',
      status: 'open',
      createdAt: tsNow,
      updatedAt: tsNow,
    });
  });

  const ctxUnauth = () => testEnv.unauthenticatedContext().firestore();
  const ctxAnon = () => testEnv.authenticatedContext('anon_1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const ctxAnonOther = () => testEnv.authenticatedContext('anon_2', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const ctxPhoneReal = () => testEnv.authenticatedContext('phone_real', { phone_number: '+251911000001', firebase: { sign_in_provider: 'phone' } }).firestore();
  const ctxPhone = () => testEnv.authenticatedContext('phone_1', { phone_number: '+251911000000', email_verified: true, firebase: { sign_in_provider: 'phone' } }).firestore();
  const ctxOrdinary = () => testEnv.authenticatedContext('ordinary_u1', { email: 'u1@example.org', email_verified: false, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxVerifiedNoRole = () => testEnv.authenticatedContext('verified_norole', { email: 'public@example.org', email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxImpersonator = () => testEnv.authenticatedContext('impersonator', { email: 'ayeledha@gmail.com', email_verified: false, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxVerifiedNonAdminOwnerEmail = () => testEnv.authenticatedContext('fake_owner', { email: 'ayeledha@gmail.com', email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxJudgeA = () => testEnv.authenticatedContext('judge_a1', { email: 'judge.a1@court.gov.et', email_verified: true, courtRole: 'judge', institutionId: INST_A, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxJudgeB = () => testEnv.authenticatedContext('judge_b1', { email: 'judge.b1@court.gov.et', email_verified: true, courtRole: 'judge', institutionId: INST_B, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxRegistrarA = () => testEnv.authenticatedContext('reg_a1', { email: 'reg.a1@court.gov.et', email_verified: true, courtRole: 'registrar', institutionId: INST_A, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxAssistantA = () => testEnv.authenticatedContext('asst_a1', { email: 'asst.a1@court.gov.et', email_verified: true, courtRole: 'assistant_judge', institutionId: INST_A, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxExpertA = () => testEnv.authenticatedContext('exp_a1', { email: 'exp.a1@court.gov.et', email_verified: true, courtRole: 'legal_expert', institutionId: INST_A, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxAuditorA = () => testEnv.authenticatedContext('aud_a1', { email: 'aud.a1@court.gov.et', email_verified: true, courtRole: 'auditor', institutionId: INST_A, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxCourtAdminA = () => testEnv.authenticatedContext('cadmin_a1', { email: 'cadmin.a1@court.gov.et', email_verified: true, courtRole: 'court_admin', institutionId: INST_A, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxAdmin = () => testEnv.authenticatedContext('super_admin_1', { email: 'admin@seeraai.et', email_verified: true, admin: true, role: 'superadmin', firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxLegalContentMgr = () => testEnv.authenticatedContext('lcm_1', { email: 'lcm@seeraai.et', email_verified: true, legalContentManager: true, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxJudgeAWithLcm = () => testEnv.authenticatedContext('judge_lcm_a1', { email: 'judge.lcm@court.gov.et', email_verified: true, courtRole: 'judge', institutionId: INST_A, legalContentManager: true, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxCourtAdminAWithLcm = () => testEnv.authenticatedContext('cadmin_lcm_a1', { email: 'cadmin.lcm@court.gov.et', email_verified: true, courtRole: 'court_admin', institutionId: INST_A, legalContentManager: true, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxExpertUnverified = () => testEnv.authenticatedContext('exp_unver_1', { email: 'exp.unver@court.gov.et', email_verified: false, courtRole: 'legal_expert', institutionId: INST_A, firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxExpertNoInst = () => testEnv.authenticatedContext('exp_noinst_1', { email: 'exp.noinst@court.gov.et', email_verified: true, courtRole: 'legal_expert', firebase: { sign_in_provider: 'password' } }).firestore();
  const ctxMissingFirebaseMap = () => testEnv.authenticatedContext('missing_fb_1', { email: 'nofb@example.org', email_verified: true, firebase: undefined as any }).firestore();
  const ctxMissingSignInProvider = () => testEnv.authenticatedContext('missing_prov_1', { email: 'noprov@example.org', email_verified: true, firebase: {} as any }).firestore();

  const results: TestResult[] = [];
  const check = async (id: number, name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ id, name, passed: true });
      console.log(`PASS [${id}]: ${name}`);
    } catch (err: any) {
      results.push({ id, name, passed: false, detail: err?.message || String(err) });
      console.error(`FAIL [${id}]: ${name} -> ${err?.message || err}`);
    }
  };

  try {
    await check(1, 'Unauthenticated user denied court docs/cases/admin logs; allowed approved public reads', async () => {
      await assertFails(ctxUnauth().doc('court_documents/doc_a1').get());
      await assertFails(ctxUnauth().doc('cases/case_a1').get());
      await assertFails(ctxUnauth().doc('admin_activity_logs/adm_log_1').get());
      await assertSucceeds(ctxUnauth().doc('legislation_repository/proc_1156').get());
      await assertSucceeds(ctxUnauth().doc('telegram_posts/tp_1').get());
      await assertSucceeds(ctxUnauth().doc('telegram_archive/ta_1').get());
      await assertSucceeds(ctxUnauth().doc('document_drafts/draft_public').get());
    });

    await check(2, 'Anonymous Guest accesses approved public content and isolated guest practice_cases only', async () => {
      await assertSucceeds(ctxAnon().doc('legislation_repository/proc_1156').get());
      await assertSucceeds(ctxAnon().doc('telegram_posts/tp_1').get());
      await assertSucceeds(ctxAnon().doc('telegram_archive/ta_1').get());
      await assertSucceeds(ctxAnon().doc(`court_branding/${INST_A}`).get());
      await assertSucceeds(ctxAnon().doc('document_drafts/draft_public').get());
      await assertSucceeds(ctxAnon().doc('practice_cases/pc_anon').get());
      await assertSucceeds(ctxAnon().doc('practice_cases/pc_anon_new').set({ userId: 'anon_1', title: 'Mock Case' }));
      await assertFails(ctxAnonOther().doc('practice_cases/pc_anon').get());
    });

    await check(3, 'Anonymous Guest denied private legal documents, court documents, courtroom writes, admin logs, and user claim writes', async () => {
      await assertFails(ctxAnon().doc('user_documents/ud_anon').set({ userId: 'anon_1', ownerId: 'anon_1', title: 'Spoof' }));
      await assertFails(ctxAnon().doc('user_documents/ud_ver').get());
      await assertFails(ctxAnon().doc('document_drafts/draft_private_ver').get());
      await assertFails(ctxAnon().doc('objection_templates/ot_ver').get());
      await assertFails(ctxAnon().doc('annotations/ann_ver').get());
      await assertFails(ctxAnon().doc('court_documents/doc_a1').get());
      await assertFails(ctxAnon().doc(`institutions/${INST_A}/courtDocuments/cd_a1`).get());
      await assertFails(ctxAnon().doc('admin_activity_logs/adm_log_1').get());
      await assertFails(ctxAnon().doc('telegram_logs/tlog_1').get());
      await assertFails(ctxAnon().doc('users/anon_1').set({ uid: 'anon_1', role: 'superadmin', admin: true }));
      await assertFails(ctxAnon().doc('courtroom_sessions/main-courtroom').update({ googleMeetLink: 'https://evil.example' }));
      await assertFails(ctxAnon().doc('collaboration_invites/inv_1').set({ ownerId: 'anon_1' }));
    });

    await check(4, 'Unverified email user denied protected personal & institutional features; permitted only basic own user profile', async () => {
      await assertSucceeds(ctxOrdinary().doc('users/ordinary_u1').get());
      await assertFails(ctxOrdinary().doc('users/judge_a1').get());
      await assertFails(ctxOrdinary().doc('user_documents/ud_u1').get());
      await assertFails(ctxOrdinary().doc('user_documents/ud_u2').set({ userId: 'ordinary_u1', title: 'Blocked' }));
      await assertFails(ctxOrdinary().doc('objection_templates/ot_unver').set({ userId: 'ordinary_u1', title: 'Test' }));
      await assertFails(ctxOrdinary().doc('annotations/ann_unver').set({ userId: 'ordinary_u1', text: 'Test' }));
      await assertFails(ctxOrdinary().doc('court_documents/doc_a1').get());
      await assertFails(ctxOrdinary().doc('witness_schedules/wsch_a1').get());
      await assertFails(ctxOrdinary().doc('telegram_logs/tlog_1').get());
    });

    await check(5, 'Phone-authenticated user does not satisfy isEmailVerified() personal/staff privileges; basic own profile allowed', async () => {
      await assertSucceeds(ctxPhoneReal().doc('users/phone_real').set({ uid: 'phone_real', displayName: 'Phone Citizen' }));
      await assertFails(ctxPhoneReal().doc('users/phone_real').update({ role: 'judge', institutionId: INST_A }));
      await assertFails(ctxPhoneReal().doc('user_documents/ud_phone_real').set({ userId: 'phone_real', title: 'Blocked' }));
      await assertFails(ctxPhoneReal().doc(`institutions/${INST_A}/courtDocuments/cd_a1`).get());
      await assertFails(ctxPhone().doc('objection_templates/ot_1').set({ userId: 'phone_1', title: 'Test' }));
      await assertFails(ctxPhone().doc('user_documents/ud_phone').set({ userId: 'phone_1', title: 'Test' }));
      await assertFails(ctxPhone().doc(`institutions/${INST_A}/courtDocuments/cd_a1`).get());
    });

    await check(6, 'Verified-email user accesses only permitted own personal features; denied others and court data', async () => {
      await assertSucceeds(ctxVerifiedNoRole().doc('user_documents/ud_ver').get());
      await assertSucceeds(ctxVerifiedNoRole().doc('user_documents/ud_ver_new').set({ userId: 'verified_norole', ownerId: 'verified_norole', title: 'Brief' }));
      await assertSucceeds(ctxVerifiedNoRole().doc('document_drafts/draft_private_ver').get());
      await assertSucceeds(ctxVerifiedNoRole().doc('objection_templates/ot_ver').get());
      await assertSucceeds(ctxVerifiedNoRole().doc('annotations/ann_ver').get());
      await assertFails(ctxVerifiedNoRole().doc('user_documents/ud_u1').get());
      await assertFails(ctxVerifiedNoRole().doc(`institutions/${INST_A}/courtDocuments/cd_a1`).get());
      await assertFails(ctxVerifiedNoRole().doc('witness_schedules/wsch_a1').get());
      await assertFails(ctxVerifiedNoRole().doc('court_documents/doc_a1').get());
    });

    await check(7, 'Authorized judge reads & writes own institution court documents, cases, and witnesses', async () => {
      await assertSucceeds(ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_a1`).get());
      await assertSucceeds(ctxJudgeA().doc('cases/case_a1').get());
      await assertSucceeds(
        ctxJudgeA().doc('court_documents/doc_a2').set({
          id: 'doc_a2',
          institutionId: INST_A,
          createdBy: 'judge_a1',
          title: 'Order A2',
          isPublic: false,
        })
      );
      await assertSucceeds(
        ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_a2`).set({
          id: 'cd_a2',
          institutionId: INST_A,
          createdBy: 'judge_a1',
          title: 'Sealed Order A2',
        })
      );
    });

    await check(8, 'Authorized registrar reads/writes institution A cases & schedules; denied institution B', async () => {
      await assertSucceeds(ctxRegistrarA().doc('cases/case_a1').update({ title: 'Updated Docket' }));
      await assertSucceeds(ctxRegistrarA().doc('witness_schedules/wsch_a2').set({ institutionId: INST_A, witness: 'W2' }));
      await assertFails(ctxRegistrarA().doc('cases/case_b1').get());
    });

    await check(9, 'Authorized assistant_judge accesses institution A dockets, denied admin activity logs', async () => {
      await assertSucceeds(ctxAssistantA().doc(`institutions/${INST_A}/courtDocuments/cd_a1`).get());
      await assertFails(ctxAssistantA().doc('admin_activity_logs/adm_log_1').get());
      await assertFails(ctxAssistantA().doc('admin_activity_logs/adm_log_asst').set({ actionType: 'config_update', target: 'test' }));
      await assertFails(ctxAssistantA().doc('admin_activity_logs/adm_log_1').update({ target: 'tampered' }));
      await assertFails(ctxAssistantA().doc('admin_activity_logs/adm_log_1').delete());
    });

    await check(10, 'Authorized legal_expert reads institution A legal docs, creates/updates legal repository, and is denied delete', async () => {
      await assertSucceeds(ctxExpertA().doc(`institutions/${INST_A}/courtDocuments/cd_a1`).get());
      await assertSucceeds(ctxExpertA().doc('legislation_repository/proc_new').set({ title: 'New Regulation' }));
      await assertSucceeds(ctxExpertA().doc('legislation_repository/proc_new').update({ title: 'Updated Regulation' }));
      await assertFails(ctxExpertA().doc('legislation_repository/proc_new').delete());
      await assertFails(ctxExpertA().doc('legislation_repository/proc_1156').delete());
      await assertFails(ctxExpertA().doc(`institutions/${INST_A}/courtDocuments/cd_a1`).delete());
    });

    await check(11, 'Authorized auditor reads institution A auditLogs, denied mutating or deleting audit logs', async () => {
      await assertSucceeds(ctxAuditorA().doc(`institutions/${INST_A}/auditLogs/log_a1`).get());
      await assertFails(ctxAuditorA().doc(`institutions/${INST_A}/auditLogs/log_a1`).update({ action: 'TAMPERED' }));
      await assertFails(ctxAuditorA().doc(`institutions/${INST_A}/auditLogs/log_a1`).delete());
    });

    await check(12, 'Authorized institution court_admin manages institution A branding & users; denied superadmin escalation', async () => {
      await assertSucceeds(ctxCourtAdminA().doc(`court_branding/${INST_A}`).set({ name: 'Updated Court' }));
      await assertSucceeds(ctxCourtAdminA().doc('court_users/staff_new').set({ institutionId: INST_A, role: 'clerk', courtRole: 'clerk' }));
      await assertFails(ctxCourtAdminA().doc('court_users/escalate').set({ institutionId: INST_A, role: 'superadmin', courtRole: 'superadmin' }));
    });

    await check(13, 'Unauthorized administrator impersonation attempts rejected (even with owner email without admin custom claim)', async () => {
      await assertFails(ctxImpersonator().doc('admin_activity_logs/adm_log_1').get());
      await assertFails(ctxVerifiedNonAdminOwnerEmail().doc('admin_activity_logs/adm_log_1').get());
      await assertFails(ctxVerifiedNonAdminOwnerEmail().doc('verifications/v1').get());
      await assertFails(ctxImpersonator().doc('users/ordinary_u1').get());
    });

    await check(14, 'Institution A user denied reading or tampering with Institution B documents', async () => {
      await assertFails(ctxJudgeA().doc(`institutions/${INST_B}/courtDocuments/cd_b1`).get());
      await assertFails(ctxJudgeA().doc('court_documents/doc_b1').get());
      await assertFails(ctxJudgeA().doc('court_documents/doc_a1').update({ institutionId: INST_B }));
      await assertFails(ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_a1`).update({ institutionId: INST_B }));
      await assertFails(ctxJudgeA().doc('cases/case_a1').update({ institutionId: INST_B }));
    });

    await check(15, 'Ordinary user denied changing their own role, admin, courtRole, or institutionId', async () => {
      await assertFails(ctxOrdinary().doc('users/ordinary_u1').update({ role: 'superadmin' }));
      await assertFails(ctxOrdinary().doc('users/ordinary_u1').update({ admin: true }));
      await assertFails(ctxOrdinary().doc('users/ordinary_u1').update({ courtRole: 'judge', institutionId: INST_A }));
      await assertSucceeds(ctxOrdinary().doc('users/ordinary_u1').update({ displayName: 'Abebe Bikila' }));
    });

    await check(16, 'Verified admin reads/creates admin_activity_logs, update/delete remain denied for immutability', async () => {
      await assertSucceeds(ctxAdmin().doc('admin_activity_logs/adm_log_1').get());
      await assertSucceeds(ctxAdmin().doc('admin_activity_logs/adm_log_2').set({ actionType: 'security_policy_change', target: 'rules', details: 'Verified admin log' }));
      await assertFails(ctxAdmin().doc('admin_activity_logs/adm_log_1').update({ target: 'tampered' }));
      await assertFails(ctxAdmin().doc('admin_activity_logs/adm_log_1').delete());
    });

    await check(17, 'Witness schedules, courtroom audio, and sealed 64KB limit checks preserved', async () => {
      await assertSucceeds(ctxUnauth().doc(`court_branding/${INST_A}`).get());
      await assertSucceeds(ctxJudgeA().doc('witness_statements/ws_a1').get());
      await assertSucceeds(ctxJudgeA().doc('witness_schedules/wsch_a1').get());
      await assertSucceeds(ctxJudgeA().doc('court_audio_recordings/car_a1').get());
      await assertFails(ctxOrdinary().doc('witness_statements/ws_a1').get());
      await assertFails(ctxOrdinary().doc('court_audio_recordings/car_a1').get());
      await assertFails(
        ctxJudgeA().doc('court_documents/doc_oversized').set({
          institutionId: INST_A,
          createdBy: 'judge_a1',
          dataUrl: 'A'.repeat(70000),
        })
      );
      await assertSucceeds(
        ctxJudgeA().doc(`institutions/${INST_A}/auditLogs/log_new`).set({
          actorUid: 'judge_a1',
          action: 'DOWNLOAD_RECORD',
        })
      );
    });

    await check(18, 'Option C: legislation_repository authorization enforces role, verification, institutionId, legalContentManager claim, and admin-only delete', async () => {
      // Admin retains full create, update, and delete
      await assertSucceeds(ctxAdmin().doc('legislation_repository/proc_adm_1').set({ title: 'Federal Code Amendment' }));
      await assertSucceeds(ctxAdmin().doc('legislation_repository/proc_adm_1').update({ title: 'Federal Code Amendment v2' }));
      await assertSucceeds(ctxAdmin().doc('legislation_repository/proc_adm_1').delete());

      // Explicit legalContentManager claim allows create/update regardless of courtRole, but denies delete
      await assertSucceeds(ctxLegalContentMgr().doc('legislation_repository/proc_lcm_1').set({ title: 'Oromia Proclamation 248' }));
      await assertSucceeds(ctxLegalContentMgr().doc('legislation_repository/proc_lcm_1').update({ title: 'Oromia Proclamation 248 Rev' }));
      await assertFails(ctxLegalContentMgr().doc('legislation_repository/proc_lcm_1').delete());

      // Existing backend server-app.ts provisions legalContentManager=true for judge/court_admin: allowed via explicit claim branch, delete denied
      await assertSucceeds(ctxJudgeAWithLcm().doc('legislation_repository/proc_jlcm_1').set({ title: 'Judge LCM Draft' }));
      await assertFails(ctxJudgeAWithLcm().doc('legislation_repository/proc_jlcm_1').delete());
      await assertSucceeds(ctxCourtAdminAWithLcm().doc('legislation_repository/proc_calcm_1').set({ title: 'CourtAdmin LCM Draft' }));
      await assertFails(ctxCourtAdminAWithLcm().doc('legislation_repository/proc_calcm_1').delete());

      // Judge & court_admin WITHOUT legalContentManager claim are denied under Option C
      await assertFails(ctxJudgeA().doc('legislation_repository/proc_judge_denied').set({ title: 'Denied Judge Write' }));
      await assertFails(ctxCourtAdminA().doc('legislation_repository/proc_cadmin_denied').set({ title: 'Denied CourtAdmin Write' }));

      // Unverified or missing-institution legal_expert denied
      await assertFails(ctxExpertUnverified().doc('legislation_repository/proc_unver_exp').set({ title: 'Blocked Unverified' }));
      await assertFails(ctxExpertNoInst().doc('legislation_repository/proc_noinst_exp').set({ title: 'Blocked No Inst' }));

      // Ordinary, guest, phone, verified-no-role, unauth, and missing-firebase-provider denied writes
      await assertFails(ctxOrdinary().doc('legislation_repository/proc_ord').set({ title: 'Blocked' }));
      await assertFails(ctxVerifiedNoRole().doc('legislation_repository/proc_ver').set({ title: 'Blocked' }));
      await assertFails(ctxPhone().doc('legislation_repository/proc_phone').set({ title: 'Blocked' }));
      await assertFails(ctxAnon().doc('legislation_repository/proc_anon').set({ title: 'Blocked' }));
      await assertFails(ctxUnauth().doc('legislation_repository/proc_unauth').set({ title: 'Blocked' }));
      await assertFails(ctxMissingFirebaseMap().doc('legislation_repository/proc_nofb').set({ title: 'Blocked' }));
      await assertFails(ctxMissingFirebaseMap().doc('user_documents/ud_nofb').set({ userId: 'missing_fb_1', ownerId: 'missing_fb_1', title: 'Blocked' }));
      await assertFails(ctxMissingSignInProvider().doc('legislation_repository/proc_noprov').set({ title: 'Blocked' }));
      await assertFails(ctxMissingSignInProvider().doc('user_documents/ud_noprov').set({ userId: 'missing_prov_1', ownerId: 'missing_prov_1', title: 'Blocked' }));
    });

    await check(19, 'Option C: legal_expert strict containment against privilege escalation, admin collections, and cross-institution/court writes', async () => {
      await assertFails(ctxExpertA().doc('users/exp_a1').set({ uid: 'exp_a1', role: 'superadmin', admin: true }));
      await assertFails(ctxExpertA().doc('users/exp_a1').set({ uid: 'exp_a1', courtRole: 'court_admin', institutionId: INST_B }));
      await assertFails(ctxVerifiedNoRole().doc('users/verified_norole').update({ role: 'legal_expert', courtRole: 'legal_expert', institutionId: INST_A }));

      await assertFails(ctxExpertA().doc('admin_activity_logs/adm_log_1').get());
      await assertFails(ctxExpertA().doc('admin_activity_logs/adm_log_exp').set({ actionType: 'tamper' }));
      await assertFails(ctxExpertA().doc('legalAuditLogs/la_1').set({ action: 'tamper' }));
      await assertFails(ctxExpertA().doc('court_users/cu_exp').set({ institutionId: INST_A, role: 'judge' }));
      await assertFails(ctxExpertA().doc('system_config/cfg_1').set({ maintenance: true }));

      await assertFails(ctxExpertA().doc(`institutions/${INST_B}/courtDocuments/cd_b1`).get());
      await assertFails(ctxExpertA().doc('court_documents/doc_b1').get());
      await assertFails(ctxExpertA().doc('cases/case_b1').get());
      await assertFails(
        ctxExpertA().doc('court_documents/doc_exp_write').set({
          id: 'doc_exp_write',
          institutionId: INST_A,
          createdBy: 'exp_a1',
          title: 'Unauthorized Court Doc Write',
        })
      );
      await assertFails(
        ctxExpertA().doc(`institutions/${INST_A}/courtDocuments/cd_exp_write`).set({
          id: 'cd_exp_write',
          institutionId: INST_A,
          createdBy: 'exp_a1',
          title: 'Unauthorized Inst Doc Write',
        })
      );
    });

    await check(20, 'Optional dataUrl UTF-8 65,536-byte enforcement and type validation across court_documents and institutions/*/courtDocuments', async () => {
      const asciiExact64K = 'A'.repeat(65536);
      const asciiOver64K = 'A'.repeat(65537);
      const multibyteExact64K = 'ሀ'.repeat(21845) + 'A'; // 21845 * 3 + 1 = 65536 UTF-8 bytes
      const multibyteOver64K = 'ሀ'.repeat(21846); // 21846 * 3 = 65538 UTF-8 bytes (< 65536 chars!)

      // Root court_documents positive cases
      await assertSucceeds(ctxJudgeA().doc('court_documents/doc_null_url').set({ id: 'doc_null_url', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: null }));
      await assertSucceeds(ctxJudgeA().doc('court_documents/doc_65536').set({ id: 'doc_65536', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: asciiExact64K }));
      await assertSucceeds(ctxJudgeA().doc('court_documents/doc_utf8_65536').set({ id: 'doc_utf8_65536', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: multibyteExact64K }));

      // Institution subcollection courtDocuments positive cases
      await assertSucceeds(ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_null_url`).set({ id: 'cd_null_url', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: null }));
      await assertSucceeds(ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_65536`).set({ id: 'cd_65536', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: asciiExact64K }));
      await assertSucceeds(ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_utf8_65536`).set({ id: 'cd_utf8_65536', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: multibyteExact64K }));

      // Root court_documents negative cases (over byte cap, invalid types, missing institutionId)
      await assertFails(ctxJudgeA().doc('court_documents/doc_65537').set({ id: 'doc_65537', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: asciiOver64K }));
      await assertFails(ctxJudgeA().doc('court_documents/doc_utf8_over').set({ id: 'doc_utf8_over', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: multibyteOver64K }));
      await assertFails(ctxJudgeA().doc('court_documents/doc_num_url').set({ id: 'doc_num_url', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: 12345 }));
      await assertFails(ctxJudgeA().doc('court_documents/doc_obj_url').set({ id: 'doc_obj_url', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: { uri: 'https://example.org' } }));
      await assertFails(ctxJudgeA().doc('court_documents/doc_arr_url').set({ id: 'doc_arr_url', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: ['bad'] }));
      await assertFails(ctxJudgeA().doc('court_documents/doc_no_inst').set({ id: 'doc_no_inst', createdBy: 'judge_a1', title: 'Missing Inst' }));

      // Institution subcollection courtDocuments negative cases
      await assertFails(ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_65537`).set({ id: 'cd_65537', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: asciiOver64K }));
      await assertFails(ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_utf8_over`).set({ id: 'cd_utf8_over', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: multibyteOver64K }));
      await assertFails(ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_num_url`).set({ id: 'cd_num_url', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: 12345 }));
      await assertFails(ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_obj_url`).set({ id: 'cd_obj_url', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: { uri: 'https://example.org' } }));
      await assertFails(ctxJudgeA().doc(`institutions/${INST_A}/courtDocuments/cd_arr_url`).set({ id: 'cd_arr_url', institutionId: INST_A, createdBy: 'judge_a1', dataUrl: ['bad'] }));
    });

    await check(21, 'Legal Glossary: public reads approved entries only; ordinary users/auditors cannot modify approved entries or audit logs', async () => {
      await assertSucceeds(ctxUnauth().doc('legal_glossary/term_test_approved').get());
      await assertSucceeds(ctxAnon().doc('legal_glossary/term_test_approved').get());
      await assertFails(ctxUnauth().doc('legal_glossary/term_test_archived').get());
      await assertFails(ctxVerifiedNoRole().doc('legal_glossary/term_test_archived').get());
      await assertFails(ctxVerifiedNoRole().doc('legal_glossary/term_bypass').set({ termId: 'term_bypass', status: 'approved', version: 1 }));
      await assertFails(ctxVerifiedNoRole().doc('legal_glossary/term_test_approved').update({ status: 'archived' }));
      await assertFails(ctxAuditorA().doc('legal_glossary/term_aud').set({ termId: 'term_aud', status: 'approved', version: 1 }));
      await assertFails(ctxAuditorA().doc('glossary_audit_logs/gaud_1').get());
      await assertFails(ctxAdmin().doc('glossary_audit_logs/gaud_1').update({ action: 'TAMPERED' }));
      await assertFails(ctxAdmin().doc('glossary_audit_logs/gaud_1').delete());
      await assertFails(ctxAdmin().doc('legal_glossary/term_test_approved/versions/v1').update({ version: 99 }));
      await assertFails(ctxAdmin().doc('legal_glossary/term_test_approved/versions/v1').delete());
    });

    await check(22, 'Legal Glossary submissions enforce verified identity, auditor block, self-scope, and reviewer isolation', async () => {
      await assertFails(ctxAnon().doc('glossary_submissions/sub_anon').set({ submissionId: 'sub_anon', submittedBy: 'anon_1', status: 'pending' }));
      await assertFails(ctxOrdinary().doc('glossary_submissions/sub_ord').set({ submissionId: 'sub_ord', submittedBy: 'ordinary_u1', status: 'pending' }));
      await assertFails(ctxAuditorA().doc('glossary_submissions/sub_aud').set({ submissionId: 'sub_aud', submittedBy: 'aud_a1', status: 'pending' }));
      await assertFails(ctxVerifiedNoRole().doc('glossary_submissions/sub_forge').set({ submissionId: 'sub_forge', submittedBy: 'verified_norole', status: 'approved' }));
      await assertSucceeds(ctxVerifiedNoRole().doc('glossary_submissions/sub_ver_new').set({ submissionId: 'sub_ver_new', submittedBy: 'verified_norole', status: 'pending' }));
      await assertSucceeds(ctxVerifiedNoRole().doc('glossary_submissions/sub_ver_1').get());
      await assertFails(ctxVerifiedNoRole().doc('glossary_submissions/sub_ver_1').update({ status: 'approved', reviewedBy: 'verified_norole' }));
      await assertSucceeds(ctxJudgeA().doc('glossary_submissions/sub_ver_1').get());
      await assertSucceeds(ctxJudgeA().doc('glossary_submissions/sub_ver_1').update({ status: 'approved', reviewedBy: 'judge_a1' }));
      await assertSucceeds(ctxJudgeA().doc('legal_glossary/term_published_by_judge').set({ termId: 'term_published_by_judge', status: 'approved', version: 1 }));
      await assertSucceeds(ctxJudgeA().doc('glossary_audit_logs/gaud_judge').set({ auditId: 'gaud_judge', actorUid: 'judge_a1', action: 'SUBMISSION_APPROVED' }));
    });

    await check(23, 'Translation Feedback: strict user isolation, server-only writes, and private_review hiding from ordinary submitters', async () => {
      await assertSucceeds(ctxVerifiedNoRole().doc('translation_records/trn_ver_1').get());
      await assertSucceeds(ctxVerifiedNoRole().doc('translation_feedback/tfb_ver_1').get());
      await assertFails(ctxVerifiedNoRole().doc('translation_feedback/tfb_ver_1/private_review/decision').get());
      await assertFails(ctxVerifiedNoRole().doc('translation_feedback/tfb_inst_a').get());
      await assertFails(ctxVerifiedNoRole().doc('translation_feedback_rate_limits/verified_norole').get());
      await assertFails(ctxVerifiedNoRole().doc('translation_feedback_audit_logs/tfbaud_1').get());
      await assertFails(ctxVerifiedNoRole().doc('translation_feedback/tfb_forged').set({ feedbackId: 'tfb_forged', submittedBy: 'verified_norole', status: 'accepted' }));
      await assertFails(ctxVerifiedNoRole().doc('translation_feedback/tfb_ver_1').update({ status: 'rejected' }));
      await assertFails(ctxAnon().doc('translation_feedback/tfb_ver_1').get());
      await assertFails(ctxOrdinary().doc('translation_feedback/tfb_ver_1').get());
      await assertFails(ctxPhone().doc('translation_feedback/tfb_ver_1').get());
    });

    await check(24, 'Translation Feedback: institutional reviewer scoping, global LCM/admin access, and auditor exclusion', async () => {
      await assertSucceeds(ctxCourtAdminA().doc('translation_feedback/tfb_inst_a').get());
      await assertSucceeds(ctxCourtAdminA().doc('translation_feedback/tfb_inst_a/private_review/decision').get());
      await assertSucceeds(ctxCourtAdminA().doc('translation_feedback_audit_logs/tfbaud_1').get());
      await assertFails(ctxCourtAdminA().doc('translation_feedback/tfb_ver_1').get());
      await assertFails(ctxCourtAdminA().doc('translation_feedback/tfb_ver_1/private_review/decision').get());
      await assertFails(ctxAuditorA().doc('translation_feedback/tfb_inst_a').get());
      await assertFails(ctxAuditorA().doc('translation_feedback_audit_logs/tfbaud_1').get());
      await assertSucceeds(ctxLegalContentMgr().doc('translation_feedback/tfb_ver_1').get());
      await assertSucceeds(ctxLegalContentMgr().doc('translation_feedback/tfb_ver_1/private_review/decision').get());
      await assertSucceeds(ctxAdmin().doc('translation_feedback/tfb_inst_a/private_review/decision').get());
      await assertFails(ctxAdmin().doc('translation_feedback_rate_limits/verified_norole').get());
      await assertFails(ctxAdmin().doc('translation_feedback_audit_logs/tfbaud_1').update({ action: 'TAMPERED' }));
    });

    await check(25, 'Precedent Comments: verified institutional scoping, personal privacy isolation, and strict schema validation', async () => {
      // Unauthenticated, anonymous, phone, unverified, or non-institutional users are denied
      await assertFails(ctxUnauth().doc('precedent_comments/pc_inst_a_1').get());
      await assertFails(ctxAnon().doc('precedent_comments/pc_inst_a_1').get());
      await assertFails(ctxPhone().doc('precedent_comments/pc_inst_a_1').get());
      await assertFails(ctxOrdinary().doc('precedent_comments/pc_inst_a_1').get());
      await assertFails(ctxVerifiedNoRole().doc('precedent_comments/pc_inst_a_1').get());
      await assertFails(ctxExpertUnverified().doc('precedent_comments/pc_inst_a_1').get());
      await assertFails(ctxExpertNoInst().doc('precedent_comments/pc_inst_a_1').get());

      // Cross-institution staff cannot read or write INST_A institutional or personal comments
      await assertFails(ctxJudgeB().doc('precedent_comments/pc_inst_a_1').get());
      await assertFails(ctxJudgeB().doc('precedent_comments/pc_personal_a_1').get());

      // Same-institution staff can read institution_private comments, but CANNOT read another author's personal_private comment
      await assertSucceeds(ctxExpertA().doc('precedent_comments/pc_inst_a_1').get());
      await assertFails(ctxExpertA().doc('precedent_comments/pc_personal_a_1').get());
      await assertSucceeds(ctxJudgeA().doc('precedent_comments/pc_personal_a_1').get());

      // Shadow field, forged authorUid, or forged status='resolved' on create must fail
      const { FieldValue } = await import('firebase/firestore');
      await assertFails(ctxExpertA().doc('precedent_comments/pc_bad_shadow').set({
        commentId: 'pc_bad_shadow',
        precedentId: 'fed_225467',
        fileNumber: '225467',
        authorUid: 'exp_a1',
        authorName: 'Expert A1',
        authorRole: 'legal_expert',
        institutionId: INST_A,
        institutionName: 'East Shoa High Court',
        commentType: 'private_note',
        visibility: 'institution_private',
        content: 'Shadow field test',
        status: 'open',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        isAdminOverride: true,
      }));
      await assertFails(ctxExpertA().doc('precedent_comments/pc_bad_status').set({
        commentId: 'pc_bad_status',
        precedentId: 'fed_225467',
        fileNumber: '225467',
        authorUid: 'exp_a1',
        authorName: 'Expert A1',
        authorRole: 'legal_expert',
        institutionId: INST_A,
        institutionName: 'East Shoa High Court',
        commentType: 'private_note',
        visibility: 'institution_private',
        content: 'Must start open',
        status: 'resolved',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }));

      // Valid institutional creation & author update succeed; another staff member cannot update author's comment
      await assertSucceeds(ctxExpertA().doc('precedent_comments/pc_valid_1').set({
        commentId: 'pc_valid_1',
        precedentId: 'fed_225467',
        fileNumber: '225467',
        authorUid: 'exp_a1',
        authorName: 'Expert A1',
        authorRole: 'legal_expert',
        institutionId: INST_A,
        institutionName: 'East Shoa High Court',
        commentType: 'legal_question',
        visibility: 'institution_private',
        content: 'Does Art. 1723 apply to rural land lease registration?',
        status: 'open',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }));
      await assertFails(ctxJudgeA().doc('precedent_comments/pc_valid_1').update({
        status: 'resolved',
        updatedAt: FieldValue.serverTimestamp(),
      }));
      await assertSucceeds(ctxExpertA().doc('precedent_comments/pc_valid_1').update({
        status: 'resolved',
        updatedAt: FieldValue.serverTimestamp(),
      }));
      await assertSucceeds(ctxCourtAdminA().doc('precedent_comments/pc_valid_1').delete());
    });
  } finally {
    await testEnv.cleanup();
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\nFirestore Rules Emulator Suite: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

runFirestoreRulesSuite().catch((err) => {
  console.error('Firestore rules suite error:', err);
  process.exit(1);
});
