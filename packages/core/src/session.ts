/** Browser session: merchant backend URL, optional client token, path overrides. */

import { ConfigurationException } from "./errors.js";
import { DEFAULT_PATHS, type MerchantPaths } from "./paths.js";
import { DEFAULT_THEME, type CheckoutLocale, type CheckoutTheme } from "./types.js";

export type CreateSessionOptions = {
  merchantBackendUrl: string;
  clientToken?: string;
  paths?: Partial<MerchantPaths>;
  fetch?: typeof fetch;
  timeoutMs?: number;
  locale?: CheckoutLocale;
  messages?: Record<string, string>;
  theme?: Partial<CheckoutTheme>;
};

export type Session = {
  merchantBackendUrl: string;
  clientToken?: string;
  paths: MerchantPaths;
  fetch: typeof fetch;
  timeoutMs: number;
  locale: CheckoutLocale;
  messages: Record<string, string>;
  theme: CheckoutTheme;
};

export function createSession(options: CreateSessionOptions): Session {
  const merchantBackendUrl = options.merchantBackendUrl?.trim() ?? "";
  if (merchantBackendUrl === "") {
    throw new ConfigurationException("merchantBackendUrl is required");
  }
  return {
    merchantBackendUrl,
    clientToken: options.clientToken,
    paths: { ...DEFAULT_PATHS, ...options.paths },
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    timeoutMs: options.timeoutMs ?? 30_000,
    locale: options.locale ?? "en",
    messages: options.messages ?? {},
    theme: { ...DEFAULT_THEME, ...options.theme },
  };
}
