/**
 * SEERAAI PRO — Unit Tests for Precedent Deep-Link Sharing,
 * Link-Entry Auto-Update Detection, and Institutional Comment Validation.
 */
import assert from 'node:assert/strict';

// Provide minimal browser globals for client service modules under Node test runner
const mockLocation = {
  href: 'https://ais-pre-jb7bcd5dvmwn4zolxoq73v-551578258786.europe-west3.run.app/',
  origin: 'https://ais-pre-jb7bcd5dvmwn4zolxoq73v-551578258786.europe-west3.run.app',
  pathname: '/',
  search: '',
  hash: '',
};

const mockStorage = new Map<string, string>();
(globalThis as any).window = {
  location: mockLocation,
  self: {},
  top: {},
  localStorage: {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => mockStorage.set(k, String(v)),
    removeItem: (k: string) => mockStorage.delete(k),
  },
};
(globalThis as any).localStorage = (globalThis as any).window.localStorage;

async function runTests() {
  const shareUrl = await import('../src/services/shareUrl');
  const updateSvc = await import('../src/services/appUpdateService');
  const commentSvc = await import('../src/services/precedentCommentService');

  let passed = 0;
  const run = (name: string, fn: () => void) => {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  };

  run('buildPrecedentDeepLink creates a valid deep link with tab=cassation, caseId, q, and lang', () => {
    const link = shareUrl.buildPrecedentDeepLink('fed_16568', '16568', 'om', 'Judge Bekele');
    const parsed = new URL(link);
    assert.equal(parsed.searchParams.get('tab'), 'cassation');
    assert.equal(parsed.searchParams.get('caseId'), 'fed_16568');
    assert.equal(parsed.searchParams.get('q'), '16568');
    assert.equal(parsed.searchParams.get('lang'), 'om');
    assert.equal(parsed.searchParams.get('by'), 'Judge Bekele');
  });

  run('buildPrecedentDeepLink sanitizes unsafe characters and never exposes restricted tabs', () => {
    const restricted = shareUrl.buildShareableFindingUrl('admin', 'test', 'en');
    const parsed = new URL(restricted);
    assert.equal(parsed.searchParams.get('tab'), null);
    assert.equal(shareUrl.isRestrictedTab('adminDashboard'), false);
    assert.equal(shareUrl.isRestrictedTab('admin'), true);
    assert.equal(shareUrl.isRestrictedTab('settings'), true);
  });

  run('readShareableStateFromUrl parses deep-linked precedent parameters accurately', () => {
    mockLocation.search = '?by=Advocate&tab=cassation&caseId=oromia_19987&q=19987&lang=am';
    mockLocation.href = `https://ais-pre-jb7bcd5dvmwn4zolxoq73v-551578258786.europe-west3.run.app/${mockLocation.search}`;
    const state = shareUrl.readShareableStateFromUrl();
    assert.ok(state);
    assert.equal(state.tab, 'cassation');
    assert.equal(state.caseId, 'oromia_19987');
    assert.equal(state.query, '19987');
    assert.equal(state.lang, 'am');
    assert.equal(state.creator, 'Advocate');
  });

  run('isSharedLinkEntry detects shared deep links and ignores plain root navigation', () => {
    mockLocation.search = '';
    assert.equal(updateSvc.isSharedLinkEntry(), false);

    mockLocation.search = '?tab=cassation&caseId=fed_16568';
    assert.equal(updateSvc.isSharedLinkEntry(), true);

    mockLocation.search = '?by=Ayele';
    assert.equal(updateSvc.isSharedLinkEntry(), true);

    mockLocation.search = '?courtLink=mmagurbicha';
    assert.equal(updateSvc.isSharedLinkEntry(), true);
  });

  run('validatePrecedentCommentInput enforces length, precedentId, fileNumber, and institutional ID pattern', () => {
    assert.equal(
      commentSvc.validatePrecedentCommentInput({
        precedentId: 'fed_16568',
        fileNumber: '16568',
        institutionId: 'inst_oromia_supreme',
        content: 'Verify Art. 1723 formality requirement against this holding.',
      }).valid,
      true
    );

    assert.equal(
      commentSvc.validatePrecedentCommentInput({
        precedentId: 'fed_16568',
        fileNumber: '16568',
        institutionId: 'inst_oromia_supreme',
        content: 'a',
      }).valid,
      false
    );

    assert.equal(
      commentSvc.validatePrecedentCommentInput({
        precedentId: 'fed_16568',
        fileNumber: '16568',
        institutionId: 'bad/inst..id',
        content: 'Valid content body',
      }).valid,
      false
    );

    assert.equal(
      commentSvc.validatePrecedentCommentInput({
        precedentId: '',
        fileNumber: '16568',
        institutionId: 'inst_oromia_supreme',
        content: 'Valid content body',
      }).valid,
      false
    );

    assert.equal(
      commentSvc.validatePrecedentCommentInput({
        precedentId: 'fed_16568',
        fileNumber: '16568',
        institutionId: 'inst_oromia_supreme',
        content: 'x'.repeat(4001),
      }).valid,
      false
    );
  });

  console.log(`\nPrecedent Share & Institutional Comments Unit Suite: ${passed}/${passed} passed`);
}

runTests().catch((err) => {
  console.error('Unit suite error:', err);
  process.exit(1);
});
