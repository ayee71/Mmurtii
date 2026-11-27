export const SYSTEM_SETTINGS_COLLECTION = 'system_settings';
export const TELEGRAM_SETTINGS_DOC_ID = 'telegram_config';
export const TELEGRAM_WEBHOOK_PATH = '/api/telegram/webhook';

export type WebhookIndicatorColor = 'green' | 'yellow' | 'red';

export type WebhookUrlSource =
  | 'env'
  | 'firestore_system_settings'
  | 'telegram_live'
  | 'derived'
  | 'override'
  | 'unset';

export interface WebhookValidationCheck {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface WebhookReachabilityResult {
  indicator: WebhookIndicatorColor;
  reachable: boolean;
  httpStatus: number | null;
  redirectedToLogin: boolean;
  redirectTarget: string | null;
  matchesTelegramWebhook: boolean;
  botEngineReady: boolean;
  explicitSecretConfigured: boolean;
  healthPayloadOk: boolean;
  reason: string;
  checkedAt: string;
  checks: WebhookValidationCheck[];
}

export interface TelegramSystemSettingRecord {
  settingId: string;
  telegramWebhookUrl: string;
  updatedBy: string;
  updatedByEmail: string;
  updatedAt?: any;
  lastValidationStatus?: WebhookIndicatorColor;
  lastValidatedAt?: string;
  lastValidationMessage?: string;
}

export function isPlaceholderWebhookValue(value: string): boolean {
  const lower = String(value || '').trim().toLowerCase();
  return (
    !lower ||
    lower.startsWith('your_') ||
    lower.startsWith('replace_with_') ||
    lower.includes('<url') ||
    lower.includes('<your') ||
    lower === 'changeme' ||
    lower === 'undefined' ||
    lower === 'null'
  );
}

export function isPrivateOrLocalWebhookHostname(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === 'metadata.google.internal' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return true;
  }
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  const m172 = host.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function validateTelegramWebhookUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl: string | null;
  origin: string | null;
  reason?: string;
} {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: null,
      origin: null,
      reason: 'TELEGRAM_WEBHOOK_URL is empty.',
    };
  }
  if (isPlaceholderWebhookValue(trimmed)) {
    return {
      valid: false,
      normalizedUrl: null,
      origin: null,
      reason: 'Placeholder URL detected. Enter your live HTTPS Cloud Run or custom domain URL.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: null,
      origin: null,
      reason: 'Invalid URL format. Expected https://<domain>/api/telegram/webhook.',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      normalizedUrl: null,
      origin: null,
      reason: `Telegram webhooks require HTTPS (received ${parsed.protocol}//${parsed.host}).`,
    };
  }

  if (isPrivateOrLocalWebhookHostname(parsed.hostname)) {
    return {
      valid: false,
      normalizedUrl: null,
      origin: null,
      reason: `Private or local host "${parsed.hostname}" is not publicly reachable by Telegram.`,
    };
  }

  if (!parsed.hostname.includes('.') || !/^[a-z0-9.-]+$/i.test(parsed.hostname)) {
    return {
      valid: false,
      normalizedUrl: null,
      origin: null,
      reason: `Hostname "${parsed.hostname}" must be a valid public domain.`,
    };
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return {
      valid: false,
      normalizedUrl: null,
      origin: null,
      reason: 'Credentials, query parameters, and hash fragments are not allowed in TELEGRAM_WEBHOOK_URL.',
    };
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath !== '/' && normalizedPath !== TELEGRAM_WEBHOOK_PATH) {
    return {
      valid: false,
      normalizedUrl: null,
      origin: parsed.origin,
      reason: `Webhook path must end with ${TELEGRAM_WEBHOOK_PATH} (received ${parsed.pathname}).`,
    };
  }

  const normalizedUrl = `${parsed.origin}${TELEGRAM_WEBHOOK_PATH}`;
  return {
    valid: true,
    normalizedUrl,
    origin: parsed.origin,
  };
}

/**
 * Generates a cryptographically random 32-character alphanumeric secret
 * suitable for TELEGRAM_WEBHOOK_SECRET (A-Z, a-z, 0-9).
 */
export function generateRandomWebhookSecret(length = 32): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Secure Web Crypto random generator is unavailable in this environment.');
  }

  const chars: string[] = [];
  const maxValidByte = 256 - (256 % alphabet.length); // 248 (eliminates modulo bias)
  const buffer = new Uint8Array(64);

  while (chars.length < length) {
    cryptoObj.getRandomValues(buffer);
    for (let i = 0; i < buffer.length && chars.length < length; i++) {
      if (buffer[i] < maxValidByte) {
        chars.push(alphabet[buffer[i] % alphabet.length]);
      }
    }
  }

  return chars.join('');
}

export interface WebhookIndicatorInput {
  configuredWebhookUrl: string;
  urlValid: boolean;
  urlValidationReason?: string;
  botConfigured: boolean;
  botEngineReachable: boolean;
  botUsername?: string | null;
  telegramWebhookUrl: string;
  telegramLastError?: string | null;
  explicitSecretConfigured: boolean;
  probeHttpStatus: number | null;
  probeHealthOk: boolean;
  probeRedirectedToLogin: boolean;
  probeRedirectTarget?: string | null;
  probeError?: string | null;
}

export function evaluateWebhookStatusIndicator(input: WebhookIndicatorInput): WebhookReachabilityResult {
  const checkedAt = new Date().toISOString();
  const checks: WebhookValidationCheck[] = [];
  const matchesTelegramWebhook = Boolean(
    input.urlValid &&
    input.configuredWebhookUrl &&
    input.telegramWebhookUrl &&
    input.telegramWebhookUrl === input.configuredWebhookUrl
  );

  // 1. URL format & public HTTPS check
  checks.push({
    key: 'url_format',
    label: 'Public HTTPS URL',
    status: input.urlValid ? 'pass' : 'fail',
    detail: input.urlValid
      ? `Valid public HTTPS endpoint (${input.configuredWebhookUrl})`
      : input.urlValidationReason || 'TELEGRAM_WEBHOOK_URL is not configured or invalid.',
  });

  // 2. Bot Engine token & getMe check
  checks.push({
    key: 'bot_engine',
    label: 'Telegram Bot Engine',
    status: input.botConfigured && input.botEngineReachable ? 'pass' : 'fail',
    detail: !input.botConfigured
      ? 'TELEGRAM_BOT_TOKEN is missing on the server.'
      : input.botEngineReachable
        ? `Connected to @${input.botUsername || 'AyebeBot'}`
        : 'Bot engine failed to reach api.telegram.org (getMe).',
  });

  // 3. Public /api/telegram/health reachability check
  if (!input.urlValid) {
    checks.push({
      key: 'public_probe',
      label: 'Public Health Probe',
      status: 'fail',
      detail: 'Skipped probe because TELEGRAM_WEBHOOK_URL is unset or invalid.',
    });
  } else if (input.probeRedirectedToLogin) {
    checks.push({
      key: 'public_probe',
      label: 'Public Health Probe',
      status: 'warn',
      detail: `Returned HTTP ${input.probeHttpStatus} login/auth redirect (${input.probeRedirectTarget || '/_aistudio-iframe.js'}). Telegram cannot bypass auth gates; deploy on a public unauthenticated Cloud Run URL.`,
    });
  } else if (input.probeHttpStatus === 200 && input.probeHealthOk) {
    checks.push({
      key: 'public_probe',
      label: 'Public Health Probe',
      status: 'pass',
      detail: 'Public /api/telegram/health returned HTTP 200 { ok: true } without authentication gate.',
    });
  } else if (input.probeHttpStatus !== null && input.probeHttpStatus >= 200 && input.probeHttpStatus < 400) {
    checks.push({
      key: 'public_probe',
      label: 'Public Health Probe',
      status: 'warn',
      detail: `Public /api/telegram/health returned HTTP ${input.probeHttpStatus} without expected JSON { ok: true } health payload.`,
    });
  } else {
    checks.push({
      key: 'public_probe',
      label: 'Public Health Probe',
      status: 'fail',
      detail: input.probeError
        ? `Public probe error: ${input.probeError}`
        : `Public /api/telegram/health returned HTTP ${input.probeHttpStatus ?? 'unreachable'}.`,
    });
  }

  // 4. Telegram getWebhookInfo alignment
  if (!input.botConfigured) {
    checks.push({
      key: 'telegram_registration',
      label: 'Telegram Registration',
      status: 'fail',
      detail: 'Cannot inspect Telegram registration without TELEGRAM_BOT_TOKEN.',
    });
  } else if (!input.telegramWebhookUrl) {
    checks.push({
      key: 'telegram_registration',
      label: 'Telegram Registration',
      status: 'warn',
      detail: 'No webhook URL is currently registered on Telegram (getWebhookInfo returned empty). Run Automated Webhook Setup.',
    });
  } else if (!matchesTelegramWebhook) {
    checks.push({
      key: 'telegram_registration',
      label: 'Telegram Registration',
      status: 'warn',
      detail: `Telegram currently points to "${input.telegramWebhookUrl}", which differs from "${input.configuredWebhookUrl}".`,
    });
  } else if (input.telegramLastError) {
    checks.push({
      key: 'telegram_registration',
      label: 'Telegram Registration',
      status: 'warn',
      detail: `Webhook URL matches, but Telegram reported an error: ${input.telegramLastError}`,
    });
  } else {
    checks.push({
      key: 'telegram_registration',
      label: 'Telegram Registration',
      status: 'pass',
      detail: 'Telegram getWebhookInfo matches configured URL with no delivery errors.',
    });
  }

  // 5. Explicit secret configuration
  checks.push({
    key: 'webhook_secret',
    label: 'TELEGRAM_WEBHOOK_SECRET',
    status: input.explicitSecretConfigured ? 'pass' : 'warn',
    detail: input.explicitSecretConfigured
      ? 'Explicit TELEGRAM_WEBHOOK_SECRET is configured on the server.'
      : 'Using derived secret fallback. Set an explicit 32-character TELEGRAM_WEBHOOK_SECRET in Server Secrets for cross-instance stability.',
  });

  // Determine overall indicator (red / yellow / green)
  let indicator: WebhookIndicatorColor = 'green';
  let reason = 'Webhook URL is publicly reachable (HTTP 200), matched on Telegram, and operational.';

  if (!input.urlValid) {
    indicator = 'red';
    reason = input.urlValidationReason || 'TELEGRAM_WEBHOOK_URL is not configured or invalid.';
  } else if (!input.botConfigured || !input.botEngineReachable) {
    indicator = 'red';
    reason = !input.botConfigured
      ? 'TELEGRAM_BOT_TOKEN is not configured on the server.'
      : 'Telegram Bot Engine cannot connect to api.telegram.org.';
  } else if (
    !input.probeRedirectedToLogin &&
    (input.probeHttpStatus === null || input.probeHttpStatus >= 400)
  ) {
    indicator = 'red';
    reason = input.probeError
      ? `Configured webhook domain is unreachable: ${input.probeError}`
      : `Configured webhook domain returned HTTP ${input.probeHttpStatus}.`;
  } else if (input.probeRedirectedToLogin) {
    indicator = 'yellow';
    reason = `Configured URL is protected behind an authentication gate (HTTP ${input.probeHttpStatus} -> ${input.probeRedirectTarget || 'login redirect'}). Telegram webhooks require a public unauthenticated Cloud Run URL.`;
  } else if (!input.probeHealthOk) {
    indicator = 'yellow';
    reason = `Endpoint responded HTTP ${input.probeHttpStatus}, but did not confirm { ok: true } Telegram bot health.`;
  } else if (!matchesTelegramWebhook) {
    indicator = 'yellow';
    reason = input.telegramWebhookUrl
      ? 'URL is publicly reachable, but Telegram is currently registered to a different webhook URL. Re-sync or run the Setup Wizard.'
      : 'URL is publicly reachable, but no webhook is registered with Telegram yet. Run the Automated Webhook Setup Wizard.';
  } else if (input.telegramLastError) {
    indicator = 'yellow';
    reason = `Webhook matches, but Telegram reported a delivery warning: ${input.telegramLastError}`;
  } else if (!input.explicitSecretConfigured) {
    indicator = 'yellow';
    reason = 'Webhook is reachable and registered, but explicit TELEGRAM_WEBHOOK_SECRET is recommended in Server Secrets.';
  }

  return {
    indicator,
    reachable: Boolean(input.probeHttpStatus === 200 && input.probeHealthOk && !input.probeRedirectedToLogin),
    httpStatus: input.probeHttpStatus,
    redirectedToLogin: input.probeRedirectedToLogin,
    redirectTarget: input.probeRedirectTarget || null,
    matchesTelegramWebhook,
    botEngineReady: Boolean(input.botConfigured && input.botEngineReachable),
    explicitSecretConfigured: input.explicitSecretConfigured,
    healthPayloadOk: input.probeHealthOk,
    reason,
    checkedAt,
    checks,
  };
}
