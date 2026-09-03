/** A polite identifier for the third-party metadata APIs (MusicBrainz asks for one). */
export const USER_AGENT =
  "gatefold/0.1.0 (+https://github.com/sacortesh/gatefold-album-companion)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET JSON with a User-Agent, a hard timeout, and optional retry on transient failures. */
export async function getJson<T>(
  url: string,
  init: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    retries?: number;
  } = {},
): Promise<T> {
  const retries = init.retries ?? 0;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * attempt);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 8000);
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/json",
          ...init.headers,
        },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/** Run a lookup, swallowing any failure to a warning + null (context is best-effort). */
export async function safe<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn(
      `[context] ${label} failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
