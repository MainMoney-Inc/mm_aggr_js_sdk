// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createSession, type ColorScheme } from "../packages/core/src/index.ts";
import { createCheckout, mountCheckout } from "../packages/checkout/src/index.ts";
import { MockFetch } from "./mock-fetch.ts";

const CSS = readFileSync(resolve("packages/checkout/src/styles.css"), "utf8");

const PROVIDER = { code: "MTN_CD", name: "MTN", entity_type: "MOBILE_MONEY", country_code: "CD", currency_code: "USD", logo: null };

type MediaListener = () => void;

function stubMatchMedia(initial: boolean) {
  const listeners = new Set<MediaListener>();
  const query = {
    matches: initial,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, listener: MediaListener) => listeners.add(listener),
    removeEventListener: (_: string, listener: MediaListener) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => query);
  return {
    listeners,
    set(matches: boolean) {
      query.matches = matches;
      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
}

async function mounted(options: { colorScheme?: ColorScheme | { get(): ColorScheme; subscribe(cb: (s: ColorScheme) => void): () => void }; variant?: "embedded" } = {}) {
  const mock = new MockFetch();
  mock.enqueue(200, [{ code: "CD", name: "DR Congo", phone_code: "243", flag: null }]);
  mock.enqueue(200, {});
  mock.enqueue(200, [PROVIDER]);
  mock.enqueue(200, []);
  mock.enqueue(200, { total_to_pay: "10.00", total_merchant_fee: "0", net_amount: "10.00" });
  const session = createSession({ merchantBackendUrl: "https://shop.example/payments", fetch: mock.fetch });
  const checkout = createCheckout(session, {
    operation: "deposit",
    pollStatus: false,
    amount: "10.00",
    lockAmount: true,
    currency: "USD",
    colorScheme: options.colorScheme,
  });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mountCheckout(host, checkout, { variant: options.variant });
  await checkout.loadCountries();
  await vi.waitFor(() => expect(host.querySelector("input")).not.toBeNull());
  return { checkout, host, unmount };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("colour scheme", () => {
  it("defaults to auto", async () => {
    stubMatchMedia(false);
    const { host, checkout } = await mounted();
    expect(checkout.getState().colorScheme).toBe("auto");
    expect(host.getAttribute("data-mm-theme")).toBe("auto");
    expect(host.getAttribute("data-mm-resolved-theme")).toBe("light");
  });

  it("setColorScheme flips data-mm-theme, notifies, and keeps the typed input focused", async () => {
    stubMatchMedia(false);
    const { host, checkout } = await mounted({ colorScheme: "light" });
    const seen: string[] = [];
    checkout.subscribe((state) => seen.push(state.colorScheme));
    const input = host.querySelector<HTMLInputElement>("input[type=tel]")!;
    input.focus();
    input.value = "987805910";
    checkout.setIdentifier(input.value);
    input.setSelectionRange(3, 3);

    checkout.setColorScheme("dark");

    expect(host.getAttribute("data-mm-theme")).toBe("dark");
    expect(seen).toEqual(["dark"]);
    expect(host.querySelector("input[type=tel]")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("987805910");
    expect(input.selectionStart).toBe(3);
    checkout.setColorScheme("light");
    expect(host.getAttribute("data-mm-theme")).toBe("light");
  });

  it("follows a host signal and stops after close()", async () => {
    stubMatchMedia(false);
    let current: ColorScheme = "light";
    const callbacks = new Set<(scheme: ColorScheme) => void>();
    const source = {
      get: () => current,
      subscribe: (cb: (scheme: ColorScheme) => void) => {
        callbacks.add(cb);
        return () => callbacks.delete(cb);
      },
    };
    const { host, checkout } = await mounted({ colorScheme: source });
    expect(host.getAttribute("data-mm-theme")).toBe("light");
    current = "dark";
    callbacks.forEach((cb) => cb("dark"));
    expect(host.getAttribute("data-mm-theme")).toBe("dark");
    checkout.close();
    expect(callbacks.size).toBe(0);
  });

  it("in auto, a prefers-color-scheme change updates the resolved theme and unsubscribes on close()", async () => {
    const media = stubMatchMedia(false);
    const { host, checkout } = await mounted();
    const input = host.querySelector<HTMLInputElement>("input[type=tel]")!;
    input.focus();
    expect(host.getAttribute("data-mm-resolved-theme")).toBe("light");
    media.set(true);
    expect(checkout.getState().resolvedColorScheme).toBe("dark");
    expect(host.getAttribute("data-mm-resolved-theme")).toBe("dark");
    expect(host.getAttribute("data-mm-theme")).toBe("auto");
    expect(document.activeElement).toBe(input);
    checkout.close();
    expect(media.listeners.size).toBe(0);
  });

  it("an explicit scheme ignores system changes", async () => {
    const media = stubMatchMedia(false);
    const { host } = await mounted({ colorScheme: "light" });
    media.set(true);
    expect(host.getAttribute("data-mm-resolved-theme")).toBe("light");
  });
});

describe("layout and tokens", () => {
  const rule = (selector: string): string => {
    const start = CSS.indexOf(`${selector} {`);
    expect(start).toBeGreaterThanOrEqual(0);
    return CSS.slice(start, CSS.indexOf("}", start));
  };

  it("the wizard fills its parent: no fixed max-width, only --mm-max-width (default none)", () => {
    for (const selector of [".mm-checkout", ".mm-checkout-form"]) {
      const block = rule(selector);
      expect(block).not.toMatch(/max-width:\s*\d/);
    }
    expect(rule(".mm-checkout")).toContain("width: 100%");
    expect(rule(".mm-checkout")).toContain("max-width: var(--mm-max-width, none)");
  });

  it("has no hard-coded colours outside the variable definitions", () => {
    const offenders = CSS.split("\n").filter((line) => /#[0-9a-fA-F]{3,8}\b/.test(line) && !/^\s*--mm-color-[a-z-]+:/.test(line));
    expect(offenders).toEqual([]);
  });

  it("defines the documented tokens, dark palette and auto media query", () => {
    for (const token of ["surface", "ink", "muted", "line", "input-bg", "error", "success"]) {
      expect(CSS).toContain(`--mm-color-${token}:`);
    }
    expect(CSS).toContain('.mm-checkout[data-mm-theme="dark"]');
    expect(CSS).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*\.mm-checkout\[data-mm-theme="auto"\]/);
    expect(CSS).toContain('[data-mm-variant="embedded"]');
    expect(CSS).toContain("@container");
  });

  it("marks the embedded variant", async () => {
    stubMatchMedia(false);
    const { host } = await mounted({ variant: "embedded" });
    expect(host.getAttribute("data-mm-variant")).toBe("embedded");
  });
});
