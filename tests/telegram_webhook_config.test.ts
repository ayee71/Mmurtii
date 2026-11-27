import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateWebhookStatusIndicator,
  generateRandomWebhookSecret,
  validateTelegramWebhookUrl,
} from '../src/services/telegramWebhookConfig';

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`FAIL: ${name}\n  -> ${err?.message || err}`);
  }
}

runTest('1. validateTelegramWebhookUrl normalizes public HTTPS domain and rejects private/insecure URLs', () => {
  const validRoot = validateTelegramWebhookUrl('https://seeraai-prod-xyz.run.app');
  assert.equal(validRoot.valid, true);
  assert.equal(validRoot.normalizedUrl, 'https://seeraai-prod-xyz.run.app/api/telegram/webhook');

  const validFull = validateTelegramWebhookUrl('https://seeraai-prod-xyz.run.app/api/telegram/webhook/');
  assert.equal(validFull.valid, true);
  assert.equal(validFull.normalizedUrl, 'https://seeraai-prod-xyz.run.app/api/telegram/webhook');

  assert.equal(validateTelegramWebhookUrl('http://seeraai-prod-xyz.run.app/api/telegram/webhook').valid, false);
  assert.equal(validateTelegramWebhookUrl('https://localhost:3000/api/telegram/webhook').valid, false);
  assert.equal(validateTelegramWebhookUrl('https://127.0.0.1/api/telegram/webhook').valid, false);
  assert.equal(validateTelegramWebhookUrl('https://169.254.169.254/api/telegram/webhook').valid, false);
  assert.equal(validateTelegramWebhookUrl('https://10.0.0.5/api/telegram/webhook').valid, false);
  assert.equal(validateTelegramWebhookUrl('https://192.168.1.10/api/telegram/webhook').valid, false);
  assert.equal(validateTelegramWebhookUrl('https://172.16.0.1/api/telegram/webhook').valid, false);
  assert.equal(validateTelegramWebhookUrl('https://<URL-CLOUD-RUN-HAARAA>/api/telegram/webhook').valid, false);
  assert.equal(validateTelegramWebhookUrl('https://seeraai.run.app/api/telegram/webhook?token=abc').valid, false);
  assert.equal(validateTelegramWebhookUrl('https://seeraai.run.app/wrong/path').valid, false);
});

runTest('2. generateRandomWebhookSecret generates 32-character CSPRNG alphanumeric secrets', () => {
  const s1 = generateRandomWebhookSecret(32);
  const s2 = generateRandomWebhookSecret(32);
  assert.equal(s1.length, 32);
  assert.equal(s2.length, 32);
  assert.match(s1, /^[A-Za-z0-9]{32}$/);
  assert.match(s2, /^[A-Za-z0-9]{32}$/);
  assert.notEqual(s1, s2);
});

runTest('3. evaluateWebhookStatusIndicator returns GREEN, YELLOW, and RED accurately', () => {
  const green = evaluateWebhookStatusIndicator({
    configuredWebhookUrl: 'https://seeraai-prod.run.app/api/telegram/webhook',
    urlValid: true,
    botConfigured: true,
    botEngineReachable: true,
    botUsername: 'AyebeBot',
    telegramWebhookUrl: 'https://seeraai-prod.run.app/api/telegram/webhook',
    telegramLastError: null,
    explicitSecretConfigured: true,
    probeHttpStatus: 200,
    probeHealthOk: true,
    probeRedirectedToLogin: false,
  });
  assert.equal(green.indicator, 'green');
  assert.equal(green.reachable, true);
  assert.equal(green.matchesTelegramWebhook, true);

  const yellowAuthGate = evaluateWebhookStatusIndicator({
    configuredWebhookUrl: 'https://ais-pre-example.europe-west3.run.app/api/telegram/webhook',
    urlValid: true,
    botConfigured: true,
    botEngineReachable: true,
    botUsername: 'AyebeBot',
    telegramWebhookUrl: 'https://ais-pre-example.europe-west3.run.app/api/telegram/webhook',
    telegramLastError: null,
    explicitSecretConfigured: true,
    probeHttpStatus: 302,
    probeHealthOk: false,
    probeRedirectedToLogin: true,
    probeRedirectTarget: '/_aistudio-iframe.js',
  });
  assert.equal(yellowAuthGate.indicator, 'yellow');
  assert.equal(yellowAuthGate.redirectedToLogin, true);
  assert.equal(yellowAuthGate.reachable, false);

  const yellowMismatch = evaluateWebhookStatusIndicator({
    configuredWebhookUrl: 'https://seeraai-prod.run.app/api/telegram/webhook',
    urlValid: true,
    botConfigured: true,
    botEngineReachable: true,
    botUsername: 'AyebeBot',
    telegramWebhookUrl: '',
    telegramLastError: null,
    explicitSecretConfigured: true,
    probeHttpStatus: 200,
    probeHealthOk: true,
    probeRedirectedToLogin: false,
  });
  assert.equal(yellowMismatch.indicator, 'yellow');

  const redUnset = evaluateWebhookStatusIndicator({
    configuredWebhookUrl: '',
    urlValid: false,
    urlValidationReason: 'TELEGRAM_WEBHOOK_URL is empty.',
    botConfigured: true,
    botEngineReachable: true,
    telegramWebhookUrl: '',
    explicitSecretConfigured: false,
    probeHttpStatus: null,
    probeHealthOk: false,
    probeRedirectedToLogin: false,
  });
  assert.equal(redUnset.indicator, 'red');
  assert.equal(redUnset.reachable, false);

  const redProbeFail = evaluateWebhookStatusIndicator({
    configuredWebhookUrl: 'https://seeraai-prod.run.app/api/telegram/webhook',
    urlValid: true,
    botConfigured: true,
    botEngineReachable: true,
    telegramWebhookUrl: 'https://seeraai-prod.run.app/api/telegram/webhook',
    explicitSecretConfigured: true,
    probeHttpStatus: 503,
    probeHealthOk: false,
    probeRedirectedToLogin: false,
    probeError: 'HTTP 503 returned',
  });
  assert.equal(redProbeFail.indicator, 'red');
});

runTest('4. firestore.rules, firestore.rules.candidate, and firebase-blueprint.json enforce admin-only system_settings', () => {
  const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  const candRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules.candidate'), 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8'));

  for (const r of [rules, candRules]) {
    assert.ok(r.includes('match /system_settings/{settingId}'));
    assert.ok(r.includes('isValidSystemSetting(incoming(), settingId)'));
    const idx = r.indexOf('match /system_settings/{settingId}');
    const block = r.slice(idx, idx + 250);
    assert.ok(block.includes('allow get, list: if isAdmin();'));
    assert.ok(!block.includes('if true'));
  }

  assert.ok(blueprint.firestore['system_settings/{settingId}']);
  assert.ok(blueprint.entities.SystemSetting);
  const propKeys = Object.keys(blueprint.entities.SystemSetting.properties || {});
  assert.ok(!propKeys.some((k) => /secret|token/i.test(k)), 'SystemSetting properties must never store secrets or tokens');
});

runTest('5. firestore.rules and candidate enforce admin-only access to telegram_logs', () => {
  const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  const candRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules.candidate'), 'utf8');

  for (const r of [rules, candRules]) {
    assert.ok(r.includes('match /telegram_logs/'), 'Must protect telegram_logs');
    const idx = r.indexOf('match /telegram_logs/');
    const pathVarClose = r.indexOf('}', idx);
    const bodyOpen = r.indexOf('{', pathVarClose + 1);
    const bodyClose = r.indexOf('}', bodyOpen + 1);
    const block = r.slice(idx, bodyClose + 1);
    assert.ok(block.includes('isAdmin()'), 'telegram_logs must require admin role');
    assert.ok(!block.includes('if true'), 'telegram_logs must never be public');
  }
});

runTest('6. TelegramStatusDashboard implements Copy URL to Clipboard, Test Fetch button with raw status code & body modal, and Last 5 Connection Attempts table', () => {
  const code = fs.readFileSync(path.resolve(process.cwd(), 'src/components/TelegramStatusDashboard.tsx'), 'utf8');
  const serverCode = fs.readFileSync(path.resolve(process.cwd(), 'server-app.ts'), 'utf8');

  // 1. Copy URL to Clipboard
  assert.ok(code.includes('Copy URL to Clipboard'), 'Must have Copy URL to Clipboard button');
  assert.ok(code.includes('handleCopyUrlToClipboard'), 'Must implement handleCopyUrlToClipboard');

  // 2. Test Fetch button and raw status code & body modal
  assert.ok(code.includes('Test Fetch Webhook URL'), 'Must have Test Fetch Webhook URL button');
  assert.ok(code.includes('testFetchModalOpen'), 'Must have modal state for test fetch');
  assert.ok(code.includes('Raw Status Code') || code.includes('Raw Response Status Code'), 'Modal must display raw status code');
  assert.ok(code.includes('Raw Response Body'), 'Modal must display raw response body');
  assert.ok(code.includes('testFetchResult.rawBody'), 'Modal must bind rawBody');
  assert.ok(serverCode.includes('/api/telegram/test-webhook-fetch'), 'Server must have /api/telegram/test-webhook-fetch endpoint');

  // 3. Last 5 connection attempts table from telegram_logs
  assert.ok(code.includes('Last 5 Webhook Connection Attempts'), 'Must have Last 5 Webhook Connection Attempts table');
  assert.ok(code.includes('telegram_logs'), 'Must reference telegram_logs');
  assert.ok(code.includes('connectionAttempts'), 'Must have connectionAttempts state');
  assert.ok(code.includes('attempt.statusCode') || code.includes('attempt.httpStatus'), 'Must display status code');
  assert.ok(code.includes('attempt.timestamp'), 'Must display timestamp');
  assert.ok(serverCode.includes("action: 'Webhook Admin Test Probe'"), 'Server probe must write to telegram_logs');
});

console.log(`\nTelegram Webhook Config Suite: ${passed}/${passed + failed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

