export interface TethralRoutine {
  id: string;
  name: string;
  description?: string;
}

export interface TethralClientOptions {
  baseUrl: string;
  token: string;
  executeTimeoutMs?: number;
  listTimeoutMs?: number;
}

export class TethralApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TethralApiError';
  }
}

export class TethralClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly executeTimeoutMs: number;
  private readonly listTimeoutMs: number;

  constructor(opts: TethralClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token;
    this.executeTimeoutMs = opts.executeTimeoutMs ?? 5_000;
    this.listTimeoutMs = opts.listTimeoutMs ?? 10_000;
  }

  async listRoutines(): Promise<TethralRoutine[]> {
    const body = await this.request<{ routines: TethralRoutine[] }>('GET', '/v1/routines', undefined, this.listTimeoutMs);
    return body.routines ?? [];
  }

  async executeRoutine(routineId: string): Promise<void> {
    await this.request<unknown>('POST', `/v1/routines/${encodeURIComponent(routineId)}/execute`, null, this.executeTimeoutMs);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body: unknown, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'authorization': `Bearer ${this.token}`,
          'accept': 'application/json',
          ...(body != null ? { 'content-type': 'application/json' } : {}),
          'user-agent': '@tethral/homebridge-tethral',
        },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new TethralApiError(`Tethral API ${method} ${path} failed: ${res.status} ${res.statusText} ${text}`.trim(), res.status);
      }

      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        return (await res.json()) as T;
      }
      return undefined as T;
    } catch (err) {
      if (err instanceof TethralApiError) {
        throw err;
      }
      if ((err as Error).name === 'AbortError') {
        throw new TethralApiError(`Tethral API ${method} ${path} timed out after ${timeoutMs}ms`, undefined, err);
      }
      throw new TethralApiError(`Tethral API ${method} ${path} network error: ${(err as Error).message}`, undefined, err);
    } finally {
      clearTimeout(timer);
    }
  }
}
