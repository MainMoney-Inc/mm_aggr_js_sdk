/** Poll a partner status URL with injected headers only. */

import { ConfigurationException, isTerminalStatus, type StatusPayload } from "@mainmoneyapp/js-core";
import { decodeJson } from "@mainmoneyapp/js-http";

export type PollOptions = {
  pollUrl: string;
  pollHeaders: Record<string, string>;
  fetchImpl: typeof fetch;
  reference: string;
  operation: string;
  intervalMs: number;
  signal?: AbortSignal;
  /** Longest wait between attempts while the connection or the server is failing. Defaults to 10000 ms. */
  maxBackoffMs?: number;
  /** Fired when polling stops or resumes being able to reach the status endpoint (`true` = lost). */
  onConnectionChange?: (lost: boolean) => void;
  /** Fired after every poll that returned a decodable status. */
  onResponse?: (status: StatusPayload) => void;
};

export async function pollStatus(options: PollOptions): Promise<StatusPayload> {
  if (options.pollUrl.trim() === "") {
    throw new ConfigurationException("pollUrl is required when polling is enabled");
  }
  let latest: StatusPayload = { status: "PENDING" };
  let failures = 0;
  while (!options.signal?.aborted) {
    const url = withQuery(options.pollUrl, { reference: options.reference, operation: options.operation });
    let delay = options.intervalMs;
    try {
      const response = await options.fetchImpl(url, {
        method: "GET",
        headers: { ...options.pollHeaders },
        signal: options.signal,
      });
      latest = decodeJson<StatusPayload>(response.status, await response.text());
      if (failures > 0) {
        failures = 0;
        options.onConnectionChange?.(false);
      }
      options.onResponse?.(latest);
    } catch (error) {
      // Only the caller's abort ends polling early; network, 5xx or malformed answers are retried.
      if (options.signal?.aborted) {
        throw error;
      }
      failures += 1;
      if (failures === 1) {
        options.onConnectionChange?.(true);
      }
      delay = Math.min(options.intervalMs * 2 ** Math.min(failures, 6), options.maxBackoffMs ?? 10_000);
    }
    if (failures === 0 && typeof latest.status === "string" && isTerminalStatus(latest.status)) {
      return latest;
    }
    await sleep(delay, options.signal);
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
