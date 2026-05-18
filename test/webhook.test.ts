import { strict as assert } from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';

import { diffWebhooks } from '../src/platform.js';
import { fireWebhook, validateWebhook, WebhookError, type WebhookConfig } from '../src/webhookClient.js';

// ---------------- validateWebhook ----------------

describe('validateWebhook', () => {
  it('accepts a minimal valid webhook', () => {
    const r = validateWebhook({ name: 'a', url: 'https://example.com/hook' });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.config.name, 'a');
      assert.equal(r.config.method, 'POST');
      assert.equal(r.config.timeoutMs, 5000);
    }
  });

  it('rejects missing name', () => {
    const r = validateWebhook({ url: 'https://example.com' });
    assert.equal(r.ok, false);
  });

  it('rejects missing url', () => {
    const r = validateWebhook({ name: 'a' });
    assert.equal(r.ok, false);
  });

  it('rejects invalid URL', () => {
    const r = validateWebhook({ name: 'a', url: 'not a url' });
    assert.equal(r.ok, false);
  });

  it('rejects non-http(s) URL protocols', () => {
    const r = validateWebhook({ name: 'a', url: 'ftp://example.com/' });
    assert.equal(r.ok, false);
  });

  it('rejects unsupported HTTP methods', () => {
    const r = validateWebhook({ name: 'a', url: 'https://example.com', method: 'TRACE' as 'GET' });
    assert.equal(r.ok, false);
  });

  it('normalizes method to uppercase', () => {
    const r = validateWebhook({ name: 'a', url: 'https://example.com', method: 'post' as 'POST' });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.config.method, 'POST');
    }
  });

  it('filters out header entries with empty key', () => {
    const r = validateWebhook({
      name: 'a',
      url: 'https://example.com',
      headers: [
        { key: 'X-Real', value: '1' },
        { key: '', value: 'orphan' },
      ],
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.config.headers!.length, 1);
      assert.equal(r.config.headers![0].key, 'X-Real');
    }
  });
});

// ---------------- fireWebhook ----------------

type FetchCall = { url: string; init: RequestInit };
let originalFetch: typeof fetch;
let calls: FetchCall[];
let respond: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  calls = [];
  respond = async () => new Response('', { status: 200 });
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    const signal = init.signal as AbortSignal | undefined;
    if (signal?.aborted) {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }
    return new Promise<Response>((resolve, reject) => {
      let settled = false;
      const onAbort = () => {
        if (settled) {
          return;
        }
        settled = true;
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      respond(input, init).then(
        (r) => {
          if (!settled) {
            settled = true; signal?.removeEventListener('abort', onAbort); resolve(r); 
          } 
        },
        (e) => {
          if (!settled) {
            settled = true; signal?.removeEventListener('abort', onAbort); reject(e); 
          } 
        },
      );
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fireWebhook', () => {
  it('sends the configured method + URL', async () => {
    await fireWebhook({ name: 'a', url: 'https://example.com/hook', method: 'POST', timeoutMs: 5000 });
    assert.equal(calls[0].url, 'https://example.com/hook');
    assert.equal(calls[0].init.method, 'POST');
  });

  it('attaches headers and a default User-Agent', async () => {
    await fireWebhook({
      name: 'a',
      url: 'https://example.com',
      method: 'POST',
      headers: [{ key: 'Authorization', value: 'Bearer xyz' }],
      timeoutMs: 5000,
    });
    const h = calls[0].init.headers as Record<string, string>;
    assert.equal(h.Authorization, 'Bearer xyz');
    assert.ok(h['user-agent']);
  });

  it('honors a user-supplied User-Agent over the default', async () => {
    await fireWebhook({
      name: 'a',
      url: 'https://example.com',
      method: 'POST',
      headers: [{ key: 'User-Agent', value: 'CustomAgent/1.0' }],
      timeoutMs: 5000,
    });
    const h = calls[0].init.headers as Record<string, string>;
    assert.equal(h['User-Agent'], 'CustomAgent/1.0');
  });

  it('passes the body verbatim when provided', async () => {
    await fireWebhook({
      name: 'a',
      url: 'https://example.com',
      method: 'POST',
      body: '{"foo":"bar"}',
      timeoutMs: 5000,
    });
    assert.equal(calls[0].init.body, '{"foo":"bar"}');
  });

  it('throws WebhookError on non-2xx', async () => {
    respond = async () => new Response('nope', { status: 500 });
    await assert.rejects(
      fireWebhook({ name: 'a', url: 'https://example.com', method: 'POST', timeoutMs: 5000 }),
      (err: WebhookError) => err instanceof WebhookError && err.status === 500,
    );
  });

  it('times out via internal abort', async () => {
    respond = () => new Promise<Response>(() => { /* never resolves */ });
    await assert.rejects(
      fireWebhook({ name: 'a', url: 'https://example.com', method: 'POST', timeoutMs: 50 }),
      (err: WebhookError) => err instanceof WebhookError && /timed out after 50ms/.test(err.message),
    );
  });

  it('honors external AbortSignal', async () => {
    respond = () => new Promise<Response>(() => { /* never resolves */ });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(
      fireWebhook({ name: 'a', url: 'https://example.com', method: 'POST', timeoutMs: 5000 }, controller.signal),
      (err: WebhookError) => err instanceof WebhookError && /aborted/.test(err.message),
    );
  });
});

// ---------------- diffWebhooks ----------------

type WebhookAccessoryLike = { UUID: string; displayName: string; context: { webhook: WebhookConfig } };
const uuidForWebhook = (n: string) => `wh-${n}`;
function webhookMap(...entries: Array<[string, WebhookAccessoryLike]>): Map<string, WebhookAccessoryLike> {
  return new Map(entries);
}
function webhookAcc(name: string, url = 'https://example.com'): WebhookAccessoryLike {
  return { UUID: uuidForWebhook(name), displayName: name, context: { webhook: { name, url, method: 'POST', timeoutMs: 5000 } } };
}

describe('diffWebhooks', () => {
  it('classifies all incoming as create when current is empty', () => {
    const incoming: WebhookConfig[] = [
      { name: 'a', url: 'https://example.com', method: 'POST', timeoutMs: 5000 },
      { name: 'b', url: 'https://example.com', method: 'POST', timeoutMs: 5000 },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = diffWebhooks(new Map() as any, incoming, uuidForWebhook);
    assert.equal(d.create.length, 2);
    assert.equal(d.update.length, 0);
    assert.equal(d.remove.length, 0);
  });

  it('classifies matching uuid as update', () => {
    const current = webhookMap([uuidForWebhook('a'), webhookAcc('a')]);
    const incoming: WebhookConfig[] = [{ name: 'a', url: 'https://example.com/new', method: 'POST', timeoutMs: 5000 }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = diffWebhooks(current as any, incoming, uuidForWebhook);
    assert.equal(d.update.length, 1);
    assert.equal(d.update[0].config.url, 'https://example.com/new');
  });

  it('classifies missing uuid as remove', () => {
    const current = webhookMap([uuidForWebhook('a'), webhookAcc('a')], [uuidForWebhook('b'), webhookAcc('b')]);
    const incoming: WebhookConfig[] = [{ name: 'a', url: 'https://example.com', method: 'POST', timeoutMs: 5000 }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = diffWebhooks(current as any, incoming, uuidForWebhook);
    assert.equal(d.update.length, 1);
    assert.equal(d.remove.length, 1);
    assert.equal(d.remove[0].uuid, uuidForWebhook('b'));
  });
});
