import { strict as assert } from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';

import { TethralApiError, TethralClient } from '../src/tethralClient.js';

type FetchCall = { url: string; init: RequestInit };

let originalFetch: typeof fetch;
let calls: FetchCall[];
let respond: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  calls = [];
  respond = async () => new Response(JSON.stringify({ routines: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
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

describe('TethralClient', () => {
  describe('listRoutines', () => {
    it('attaches bearer auth and returns routines', async () => {
      respond = async () => new Response(JSON.stringify({ routines: [{ id: 'rt_a', name: 'Alpha', description: 'A' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
      const client = new TethralClient({ baseUrl: 'https://api.example/', token: 'tth_test' });
      const routines = await client.listRoutines();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://api.example/v1/routines');
      assert.equal((calls[0].init.headers as Record<string, string>).authorization, 'Bearer tth_test');
      assert.deepEqual(routines, [{ id: 'rt_a', name: 'Alpha', description: 'A' }]);
    });

    it('strips trailing slash from baseUrl', async () => {
      const client = new TethralClient({ baseUrl: 'https://api.example///', token: 'tth_test' });
      await client.listRoutines();
      assert.equal(calls[0].url, 'https://api.example/v1/routines');
    });

    it('normalizes null description to undefined', async () => {
      respond = async () => new Response(JSON.stringify({ routines: [{ id: 'rt_a', name: 'Alpha', description: null }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
      const client = new TethralClient({ baseUrl: 'https://api.example', token: 'tth_test' });
      const routines = await client.listRoutines();
      assert.equal(routines[0].description, undefined);
    });

    it('returns empty array when API omits routines field', async () => {
      respond = async () => new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } });
      const client = new TethralClient({ baseUrl: 'https://api.example', token: 'tth_test' });
      const routines = await client.listRoutines();
      assert.deepEqual(routines, []);
    });

    it('throws TethralApiError on non-2xx with status code preserved', async () => {
      respond = async () => new Response('unauthorized', { status: 401 });
      const client = new TethralClient({ baseUrl: 'https://api.example', token: 'tth_bad' });
      await assert.rejects(
        client.listRoutines(),
        (err: TethralApiError) => err instanceof TethralApiError && err.status === 401,
      );
    });

    it('times out via internal abort', async () => {
      respond = () => new Promise<Response>(() => { /* never resolves */ });
      const client = new TethralClient({ baseUrl: 'https://api.example', token: 'tth_test', listTimeoutMs: 50 });
      await assert.rejects(
        client.listRoutines(),
        (err: TethralApiError) => err instanceof TethralApiError && /timed out after 50ms/.test(err.message),
      );
    });

    it('honors external AbortSignal', async () => {
      respond = () => new Promise<Response>(() => { /* never resolves */ });
      const client = new TethralClient({ baseUrl: 'https://api.example', token: 'tth_test', listTimeoutMs: 5_000 });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 20);
      await assert.rejects(
        client.listRoutines({ signal: controller.signal }),
        (err: TethralApiError) => err instanceof TethralApiError && /aborted/.test(err.message),
      );
    });
  });

  describe('executeRoutine', () => {
    it('POSTs to the encoded route id', async () => {
      respond = async () => new Response('', { status: 202 });
      const client = new TethralClient({ baseUrl: 'https://api.example', token: 'tth_test' });
      await client.executeRoutine('rt morning');
      assert.equal(calls[0].url, 'https://api.example/v1/routines/rt%20morning/execute');
      assert.equal(calls[0].init.method, 'POST');
    });

    it('accepts a 202 with empty body', async () => {
      respond = async () => new Response('', { status: 202 });
      const client = new TethralClient({ baseUrl: 'https://api.example', token: 'tth_test' });
      await client.executeRoutine('rt_a');
    });
  });
});
