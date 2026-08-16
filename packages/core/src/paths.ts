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

export function joinUrl(base: string, path: string): string {
  const prefix = base.replace(/\/+$/, "");
  const suffix = path.startsWith("http://") || path.startsWith("https://") ? path : path.replace(/^\/+/, "/");
  if (suffix.startsWith("http://") || suffix.startsWith("https://")) {
    return suffix;
  }
  return `${prefix}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}
