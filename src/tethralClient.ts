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

export interface RequestOptions {
  signal?: AbortSignal;
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

function composeSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const defined = signals.filter((s): s is AbortSignal => s !== undefined);
  if (defined.length === 1) {
    return defined[0];
  }
  return AbortSignal.any(defined);
}

function normalizeRoutine(input: TethralRoutine & { description?: string | null }): TethralRoutine {
  return {
    id: input.id,
    name: input.name,
    description: input.description ?? undefined,
  };
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

  async listRoutines(opts: RequestOptions = {}): Promise<TethralRoutine[]> {
    const body = await this.request<{ routines: TethralRoutine[] }>('GET', '/v1/routines', undefined, this.listTimeoutMs, opts.signal);
    return (body.routines ?? []).map(normalizeRoutine);
  }

  async executeRoutine(routineId: string, opts: RequestOptions = {}): Promise<void> {
    await this.request<unknown>('POST', `/v1/routines/${encodeURIComponent(routineId)}/execute`, null, this.executeTimeoutMs, opts.signal);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body: unknown, timeoutMs: number, externalSignal?: AbortSignal): Promise<T> {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
    const signal = composeSignals(timeoutController.signal, externalSignal);

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
        signal,
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
        if (externalSignal?.aborted) {
          throw new TethralApiError(`Tethral API ${method} ${path} aborted`, undefined, err);
        }
        throw new TethralApiError(`Tethral API ${method} ${path} timed out after ${timeoutMs}ms`, undefined, err);
      }
      throw new TethralApiError(`Tethral API ${method} ${path} network error: ${(err as Error).message}`, undefined, err);
    } finally {
      clearTimeout(timer);
    }
  }
}
