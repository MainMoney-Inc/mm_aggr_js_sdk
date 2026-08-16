/** Default fetch client. */

import type { HttpClient, RequestOptions } from "./http-client.js";

export class FetchHttpClient implements HttpClient {
  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  async request(method: string, uri: string, options: RequestOptions = {}): Promise<{ status: number; bodyText: string }> {
    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    let body: string | undefined;
    if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers.Accept ??= "application/json";
      headers["Content-Type"] ??= "application/json";
    }
    const url = withQuery(uri, options.query);
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = options.signal === undefined ? timeout : AbortSignal.any([timeout, options.signal]);
    const response = await this.fetchImpl(url, { method, headers, body, signal });
    return { status: response.status, bodyText: await response.text() };
  }
}

function withQuery(uri: string, query: RequestOptions["query"]): string {
  if (query === undefined) {
    return uri;
  }
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== "");
  if (entries.length === 0) {
    return uri;
  }
  const hasOrigin = uri.startsWith("http://") || uri.startsWith("https://");
  const parsed = hasOrigin ? new URL(uri) : new URL(uri, "https://placeholder.invalid");
  for (const [name, value] of entries) {
    parsed.searchParams.set(name, String(value));
  }
  if (hasOrigin) {
    return parsed.toString();
  }
  return `${parsed.pathname}${parsed.search}`;
}
