import assert from 'node:assert/strict';
import {
  buildChannelFeedQueryParam,
  buildChannelsCsvParam,
  getAutoSyncIntervalMs,
  getDefaultTelegramSyncSettings,
  normalizeTelegramChannelId,
  sanitizeTelegramSyncSettings,
} from '../src/services/telegramSyncSettings';
import {
  buildStructuredLegalFeedDocument,
  extractItemChannelHandle,
  filterTelegramFeedByChannels,
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
  console.log('--- STARTING TELEGRAM SYNC SETTINGS TEST SUITE ---');

  await runTest('1. normalizeTelegramChannelId normalizes handles and t.me URLs strictly to allowed channels', () => {
    assert.equal(normalizeTelegramChannelId('@seeraai_ethio'), 'seeraai_ethio');
    assert.equal(normalizeTelegramChannelId('SEERAAI_ETHIO'), 'seeraai_ethio');
    assert.equal(normalizeTelegramChannelId('https://t.me/wakolegalstudio/1520'), 'wakolegalstudio');
    assert.equal(normalizeTelegramChannelId('@WakoLegalStudio'), 'wakolegalstudio');
    assert.equal(normalizeTelegramChannelId('https://evil.example.com/foo'), null);
    assert.equal(normalizeTelegramChannelId('unknown_channel'), null);
  });

  await runTest('2. sanitizeTelegramSyncSettings validates channels, preserves intentional empty state, and falls back safely', () => {
    const defaults = getDefaultTelegramSyncSettings();
    assert.deepEqual(defaults.enabledChannels, ['seeraai_ethio', 'wakolegalstudio']);
    assert.equal(defaults.autoSyncFrequency, '30m');

    const emptyChannels = sanitizeTelegramSyncSettings({
      enabledChannels: [],
      autoSyncFrequency: 'manual',
    });
    assert.deepEqual(emptyChannels.enabledChannels, []);
    assert.equal(emptyChannels.autoSyncFrequency, 'manual');

    const dedupedAndFiltered = sanitizeTelegramSyncSettings({
      enabledChannels: ['@wakolegalstudio', 'wakolegalstudio', 'bad_channel'],
      autoSyncFrequency: '15m',
    });
    assert.deepEqual(dedupedAndFiltered.enabledChannels, ['wakolegalstudio']);
    assert.equal(dedupedAndFiltered.autoSyncFrequency, '15m');

    const invalidFallback = sanitizeTelegramSyncSettings({
      enabledChannels: 'not-an-array',
      autoSyncFrequency: 'every-second',
    });
    assert.deepEqual(invalidFallback.enabledChannels, ['seeraai_ethio', 'wakolegalstudio']);
    assert.equal(invalidFallback.autoSyncFrequency, '30m');
  });

  await runTest('3. getAutoSyncIntervalMs maps every frequency preset to exact milliseconds or null for manual', () => {
    assert.equal(getAutoSyncIntervalMs('manual'), null);
    assert.equal(getAutoSyncIntervalMs('5m'), 5 * 60 * 1000);
    assert.equal(getAutoSyncIntervalMs('15m'), 15 * 60 * 1000);
    assert.equal(getAutoSyncIntervalMs('30m'), 30 * 60 * 1000);
    assert.equal(getAutoSyncIntervalMs('1h'), 60 * 60 * 1000);
    assert.equal(getAutoSyncIntervalMs('6h'), 6 * 60 * 60 * 1000);
  });

  await runTest('4. buildChannelFeedQueryParam & buildChannelsCsvParam encode single, multi, and none channel states', () => {
    assert.equal(buildChannelFeedQueryParam([]), 'none');
    assert.equal(buildChannelsCsvParam([]), 'none');

    assert.equal(buildChannelFeedQueryParam(['seeraai_ethio']), 'seeraai_ethio');
    assert.equal(buildChannelsCsvParam(['seeraai_ethio']), 'seeraai_ethio');

    assert.equal(buildChannelFeedQueryParam(['wakolegalstudio']), 'wakolegalstudio');
    assert.equal(buildChannelsCsvParam(['wakolegalstudio']), 'wakolegalstudio');

    assert.equal(buildChannelFeedQueryParam(['seeraai_ethio', 'wakolegalstudio']), 'all');
    assert.equal(
      buildChannelsCsvParam(['seeraai_ethio', 'wakolegalstudio']),
      'seeraai_ethio,wakolegalstudio',
    );
  });

  await runTest('5. filterTelegramFeedByChannels & buildStructuredLegalFeedDocument respect @seeraai_ethio vs @wakolegalstudio', () => {
    const items = [
      {
        id: 'seeraai-1',
        channelHandle: 'seeraai_ethio',
        title: 'Proc 1332/2016',
        postUrl: 'https://t.me/seeraai_ethio/245',
      },
      {
        id: 'wako-1',
        title: 'MMWF #228491',
        postUrl: 'https://t.me/wakolegalstudio/1520',
      },
    ];

    assert.equal(extractItemChannelHandle(items[0]), 'seeraai_ethio');
    assert.equal(extractItemChannelHandle(items[1]), 'wakolegalstudio');

    assert.deepEqual(
      filterTelegramFeedByChannels(items, ['wakolegalstudio']).map((i) => i.id),
      ['wako-1'],
    );
    assert.deepEqual(
      filterTelegramFeedByChannels(items, ['seeraai_ethio']).map((i) => i.id),
      ['seeraai-1'],
    );
    assert.deepEqual(filterTelegramFeedByChannels(items, []), []);

    const wakoDoc = buildStructuredLegalFeedDocument(items[1], 'en');
    assert.equal(wakoDoc.sourceChannel, '@wakolegalstudio');
    assert.equal(wakoDoc.sourceUrl, 'https://t.me/wakolegalstudio/1520');
  });

  console.log(`\nPASSED TESTS: ${passed}/5`);
}

void main();
