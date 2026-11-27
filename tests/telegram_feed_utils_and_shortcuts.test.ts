import assert from 'node:assert/strict';
import {
  buildStructuredLegalFeedDocument,
  computeFeedItemRelevanceScore,
  filterTelegramFeedItems,
  resolveLocalizedFeedText,
  shareLegalFeedItem,
  sortTelegramFeedItems,
} from '../src/services/telegramFeedUtils';

let passed = 0;
async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('--- STARTING TELEGRAM FEED UTILS & SHARE SUITE ---');

  await runTest('1. resolveLocalizedFeedText resolves om/am/en objects and plain strings accurately', () => {
    const localized = {
      om: 'Murtii Dhaddacha Ijibbaataa #138286',
      am: 'የሰበር መዝገብ ቁ. 138286',
      en: 'FSC Cassation Precedent #138286',
    };
    assert.equal(resolveLocalizedFeedText(localized, 'om'), localized.om);
    assert.equal(resolveLocalizedFeedText(localized, 'am'), localized.am);
    assert.equal(resolveLocalizedFeedText(localized, 'en'), localized.en);
    assert.equal(resolveLocalizedFeedText('Plain post text', 'om'), 'Plain post text');
  });

  await runTest('2. sortTelegramFeedItems sorts Latest chronologically and Most Relevant by legal significance', () => {
    const now = Date.now();
    const olderHighImpactCassation = {
      id: 'cassation-1',
      title: 'FSC Cassation Bench #228491',
      summary:
        'Federal Supreme Court Cassation binding decision under Civil Code Art. 2091 and FDRE Const. Art. 35(7) protecting surviving spouse property rights.',
      type: 'cassation_decision',
      category: 'cassation',
      referenceNumber: 'MMWF 228491',
      keyArticles: ['Civil Code Art. 2091', 'FDRE Const. Art. 35(7)', 'Proc. 130/1999 Art. 6'],
      tags: ['MMWF', 'Cassation', 'Property', 'Family'],
      postUrl: 'https://t.me/seeraai_ethio/245',
      publishDate: new Date(now - 1000 * 60 * 60 * 48).toISOString(), // 48h ago
    };

    const newerRoutineNotice = {
      id: 'notice-2',
      title: 'Office holiday schedule',
      summary: 'Short reminder about office hours.',
      type: 'notice',
      category: 'general',
      postUrl: 'https://t.me/seeraai_ethio',
      publishDate: new Date(now - 1000 * 60 * 10).toISOString(), // 10m ago
    };

    const items = [olderHighImpactCassation, newerRoutineNotice];

    const byLatest = sortTelegramFeedItems(items, 'latest');
    assert.equal(byLatest[0].id, 'notice-2', 'Latest mode must place newest timestamp first');
    assert.equal(byLatest[1].id, 'cassation-1');

    const byRelevant = sortTelegramFeedItems(items, 'relevant');
    assert.ok(
      computeFeedItemRelevanceScore(olderHighImpactCassation) >
        computeFeedItemRelevanceScore(newerRoutineNotice),
    );
    assert.equal(
      byRelevant[0].id,
      'cassation-1',
      'Most Relevant mode must rank cited Cassation decision above routine notice',
    );
  });

  await runTest('3. shareLegalFeedItem uses navigator.share when available and handles AbortError silently', async () => {
    const originalNavigator = globalThis.navigator;
    let sharedPayload: ShareData | undefined;

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        share: async (data: ShareData) => {
          sharedPayload = data;
        },
        clipboard: {
          writeText: async () => {},
        },
      },
    });

    try {
      const result = await shareLegalFeedItem({
        title: 'Cassation #228491',
        text: 'Surviving spouse property rights',
        url: 'https://t.me/seeraai_ethio/245',
      });
      assert.equal(result.method, 'web_share');
      assert.equal(sharedPayload?.title, 'Cassation #228491');
      assert.equal(sharedPayload?.url, 'https://t.me/seeraai_ethio/245');

      // Simulate user cancelling share sheet (AbortError)
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
          share: async () => {
            const err = new Error('User cancelled');
            err.name = 'AbortError';
            throw err;
          },
          clipboard: {
            writeText: async () => {
              throw new Error('Should not fall back to clipboard on AbortError');
            },
          },
        },
      });
      const aborted = await shareLegalFeedItem({
        title: 'Cassation #228491',
        text: 'Summary',
        url: 'https://t.me/seeraai_ethio/245',
      });
      assert.equal(aborted.method, 'aborted');
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }
  });

  await runTest('4. shareLegalFeedItem falls back to clipboard when Web Share API is unavailable or blocked', async () => {
    const originalNavigator = globalThis.navigator;
    let copiedText = '';

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          writeText: async (text: string) => {
            copiedText = text;
          },
        },
      },
    });

    try {
      const result = await shareLegalFeedItem({
        title: 'Proc. 1332/2016',
        text: 'Digital remote hearings recognized.',
        url: 'https://t.me/seeraai_ethio/245',
      });
      assert.equal(result.method, 'clipboard');
      assert.ok(copiedText.includes('Proc. 1332/2016'));
      assert.ok(copiedText.includes('https://t.me/seeraai_ethio/245'));
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }
  });

  await runTest('5. filterTelegramFeedItems matches keywords, case numbers, tags, and localized fields across om/am/en', () => {
    const now = Date.now();
    const feedItems = [
      {
        id: 'labor-1156',
        title: {
          om: 'Labsii Hojjetaa fi Hojjachiisaa 1156/2011',
          am: 'የአሠሪና ሠራተኛ አዋጅ 1156/2011',
          en: 'Labor Proclamation No. 1156/2019',
        },
        summary: 'Severance pay and termination rules under Article 39.',
        referenceNumber: 'Labsii 1156/2019',
        tags: ['Labor', 'Termination'],
        publishDate: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      },
      {
        id: 'cassation-228491',
        title: 'MMWF Galmee Lakk. 228491',
        summary: 'Federal Supreme Court Cassation decision on surviving spouse property rights.',
        fileNumber: '228491',
        type: 'cassation_decision',
        keyArticles: ['Civil Code Art. 2091'],
        tags: ['Cassation', 'Property'],
        publishDate: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
      },
    ];

    assert.equal(filterTelegramFeedItems(feedItems, '').length, 2);
    assert.deepEqual(
      filterTelegramFeedItems(feedItems, '1156 severance').map((i) => i.id),
      ['labor-1156'],
    );
    assert.deepEqual(
      filterTelegramFeedItems(feedItems, '228491').map((i) => i.id),
      ['cassation-228491'],
    );
    assert.deepEqual(
      filterTelegramFeedItems(feedItems, 'የአሠሪና').map((i) => i.id),
      ['labor-1156'],
    );

    const combined = sortTelegramFeedItems(
      filterTelegramFeedItems(feedItems, '2091'),
      'relevant',
    );
    assert.equal(combined[0].id, 'cassation-228491');
  });

  await runTest('6. buildStructuredLegalFeedDocument prepares sanitized structured legal metadata and paragraphs', () => {
    const doc = buildStructuredLegalFeedDocument(
      {
        id: 'cassation-228491',
        title: {
          om: 'Murtii Dhaddacha Ijibbaataa #228491',
          am: 'የሰበር መዝገብ ቁ. 228491',
          en: 'FSC Cassation Precedent #228491',
        },
        text: 'Line 1 holding.\nLine 2 reasoning.',
        summary: 'Line 1 holding.\nLine 3 summary.',
        fileNumber: '228491',
        type: 'cassation_decision',
        category: 'cassation',
        keyArticles: ['Civil Code Art. 2091', 'FDRE Const. Art. 35(7)'],
        tags: ['Cassation', 'Property'],
        postUrl: 'https://t.me/seeraai_ethio/245',
        publishDate: '2026-03-20T10:00:00.000Z',
      },
      'en',
    );

    assert.equal(doc.title, 'FSC Cassation Precedent #228491');
    assert.equal(doc.documentType, 'Cassation Bench Precedent');
    assert.equal(doc.referenceNumber, '228491');
    assert.equal(doc.sourceChannel, '@seeraai_ethio');
    assert.equal(doc.sourceUrl, 'https://t.me/seeraai_ethio/245');
    assert.deepEqual(doc.keyArticles, ['Civil Code Art. 2091', 'FDRE Const. Art. 35(7)']);
    assert.deepEqual(doc.bodyParagraphs, ['Line 1 holding.', 'Line 2 reasoning.', 'Line 3 summary.']);
    assert.ok(doc.filename.startsWith('SEERAAI_228491_'));
    assert.ok(doc.filename.endsWith('.pdf'));
  });

  console.log(`\nPASSED TESTS: ${passed}/6`);
}

void main();
