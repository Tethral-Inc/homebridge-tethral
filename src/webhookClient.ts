/**
 * Webhook escape hatch — fires arbitrary user-configured HTTP requests.
 *
 * Separate from TethralClient: Tethral routines go through the Tethral API
 * with a bearer token; webhooks go to user-supplied URLs with user-supplied
 * headers/body/method. They share nothing at the auth layer.
 */

export type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface WebhookHeader {
  key: string;
  value: string;
}

export interface WebhookConfig {
  /** HomeKit-facing display name. Must be unique within the plugin's webhook list. */
  name: string;
  /** Full URL to fire. */
  url: string;
  /** HTTP method. Defaults to POST. */
  method?: WebhookMethod;
  /** Optional headers. UI renders as a repeatable {key, value} array. */
  headers?: WebhookHeader[];
  /** Optional raw request body. The user is responsible for matching it with a Content-Type header. */
  body?: string;
  /** Per-request timeout in ms. Defaults to 5000. */
  timeoutMs?: number;
}

export class WebhookError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'WebhookError';
  }
}

const DEFAULT_TIMEOUT_MS = 5_000;

function composeSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const defined = signals.filter((s): s is AbortSignal => s !== undefined);
  if (defined.length === 1) {
    return defined[0];
  }
  return AbortSignal.any(defined);
}

function buildHeaders(input: WebhookHeader[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, value } of input ?? []) {
    if (!key) {
      continue;
    }
    out[key] = value ?? '';
  }
  // Default User-Agent so target servers can see who's calling
  if (!Object.keys(out).some(k => k.toLowerCase() === 'user-agent')) {
    out['user-agent'] = '@tethralinc/homebridge-tethral (webhook)';
  }
  return out;
}

/**
 * Validate a webhook config; return a normalized version or null with a
 * reason if it should be skipped. Pure function — testable without HB.
 */
export function validateWebhook(input: Partial<WebhookConfig>): { ok: true; config: WebhookConfig } | { ok: false; reason: string } {
  if (!input.name || typeof input.name !== 'string') {
    return { ok: false, reason: 'missing or invalid `name`' };
  }
  if (!input.url || typeof input.url !== 'string') {
    return { ok: false, reason: 'missing or invalid `url`' };
  }
  try {
    const u = new URL(input.url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, reason: `unsupported URL protocol: ${u.protocol}` };
    }
  } catch {
    return { ok: false, reason: `invalid URL: ${input.url}` };
  }
  const method: WebhookMethod = (input.method ?? 'POST').toUpperCase() as WebhookMethod;
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { ok: false, reason: `unsupported HTTP method: ${input.method}` };
  }
  return {
    ok: true,
    config: {
      name: input.name,
      url: input.url,
      method,
      headers: Array.isArray(input.headers) ? input.headers.filter(h => h && typeof h.key === 'string' && h.key.length > 0) : undefined,
      body: typeof input.body === 'string' && input.body.length > 0 ? input.body : undefined,
      timeoutMs: typeof input.timeoutMs === 'number' && input.timeoutMs > 0 ? input.timeoutMs : DEFAULT_TIMEOUT_MS,
    },
  };
}

export async function fireWebhook(config: WebhookConfig, externalSignal?: AbortSignal): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = composeSignals(controller.signal, externalSignal);

  try {
    const res = await fetch(config.url, {
      method: config.method ?? 'POST',
      headers: buildHeaders(config.headers),
      body: config.body,
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new WebhookError(`Webhook ${config.name} ${res.status} ${res.statusText} ${text}`.trim(), res.status);
    }
  } catch (err) {
    if (err instanceof WebhookError) {
      throw err;
    }
    if ((err as Error).name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw new WebhookError(`Webhook ${config.name} aborted`, undefined, err);
      }
      throw new WebhookError(`Webhook ${config.name} timed out after ${config.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`, undefined, err);
    }
    throw new WebhookError(`Webhook ${config.name} network error: ${(err as Error).message}`, undefined, err);
  } finally {
    clearTimeout(timer);
  }
}
