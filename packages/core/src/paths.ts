/** Merchant-backend path convention for the JS/TS frontend SDK. */

export type MerchantPaths = {
  countries: string;
  providers: string;
  matchProvider: string;
  amountLimits: string;
  feesSimulate: string;
  checkoutPreferences: string;
  deposits: string;
  validatePayment: string;
  payouts: string;
};

export const DEFAULT_PATHS: MerchantPaths = {
  countries: "/countries",
  providers: "/providers",
  matchProvider: "/match-provider",
  amountLimits: "/amount-limits",
  feesSimulate: "/fees/simulate",
  checkoutPreferences: "/checkout-preferences",
  deposits: "/deposits",
  validatePayment: "/deposits/validate",
  payouts: "/payouts",
};

/** Strip leading and/or trailing "/" in linear time (avoids regex backtracking on long slash runs). */
export function trimSlashes(value: string, { start = false, end = false }: { start?: boolean; end?: boolean } = {}): string {
  let from = 0;
  let to = value.length;
  if (start) {
    while (from < to && value.charCodeAt(from) === 47) from += 1;
  }
  if (end) {
    while (to > from && value.charCodeAt(to - 1) === 47) to -= 1;
  }
  return value.slice(from, to);
}

export function joinUrl(base: string, path: string): string {
  const prefix = trimSlashes(base, { end: true });
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${prefix}/${trimSlashes(path, { start: true })}`;
}
