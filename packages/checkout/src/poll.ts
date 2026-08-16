/** Poll a partner status URL with injected headers only. */

import { ConfigurationException, isTerminalStatus, type StatusPayload } from "@mainmoney/js-core";
import { decodeJson } from "@mainmoney/js-http";

export type PollOptions = {
  pollUrl: string;
  pollHeaders: Record<string, string>;
  fetchImpl: typeof fetch;
  reference: string;
  operation: string;
  intervalMs: number;
  signal?: AbortSignal;
};

export async function pollStatus(options: PollOptions): Promise<StatusPayload> {
  if (options.pollUrl.trim() === "") {
    throw new ConfigurationException("pollUrl is required when polling is enabled");
  }
  let latest: StatusPayload = { status: "PENDING" };
  while (!options.signal?.aborted) {
    const url = withQuery(options.pollUrl, { reference: options.reference, operation: options.operation });
    const response = await options.fetchImpl(url, {
      method: "GET",
      headers: { ...options.pollHeaders },
      signal: options.signal,
    });
    latest = decodeJson<StatusPayload>(response.status, await response.text());
    if (typeof latest.status === "string" && isTerminalStatus(latest.status)) {
      return latest;
    }
    await sleep(options.intervalMs, options.signal);
  }
  return latest;
}

function withQuery(uri: string, query: Record<string, string>): string {
  const parsed = new URL(uri, uri.startsWith("http") ? undefined : "https://placeholder.invalid");
  for (const [name, value] of Object.entries(query)) {
    parsed.searchParams.set(name, value);
  }
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return parsed.toString();
  }
  return `${parsed.pathname}${parsed.search}`;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("aborted"));
      },
      { once: true },
    );
  });
}
