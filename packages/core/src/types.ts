/** Shared checkout types. Amounts are decimal strings; never mix currencies. */

export type OperationType = "deposit" | "payout";

export type CheckoutLocale = "en" | "fr";

export type CheckoutTheme = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
};

export const DEFAULT_THEME: CheckoutTheme = {
  primary: "#ff3366",
  secondary: "#5f5e5e",
  accent: "#b90040",
  background: "#f8f9fb",
};

export type Country = {
  code: string;
  name: string;
  iso3_code?: string;
  phone_code?: string;
};

export type Provider = {
  code: string;
  name: string;
  entity_type: string;
  country_code: string;
  currency_code: string;
  accepted_currencies?: string[];
  is_active?: boolean;
};

export type AmountLimit = {
  financial_entity_code: string;
  operation_type: string | null;
  currency: string;
  amount_min: string | null;
  amount_max: string | null;
};

export type FeeSimulation = {
  provider_code: string;
  operation_type: string;
  amount: string;
  currency: string;
  provider_fee: string;
  our_fee: string;
  merchant_additional_fee: string;
  promotion_discount: string;
  total_merchant_fee: string;
  net_amount: string;
};

export type PartnerFee = {
  amount: string;
  currency: string;
  label?: string;
};

export type StatusPayload = {
  status: string;
  transaction_id?: string;
  internal_reference?: string;
  external_reference?: string;
  merchant_reference?: string;
  provider_reference?: string;
  message?: string;
  status_reason?: string;
  amount?: string;
  currency?: string;
  provider_code?: string;
  status_updated?: boolean;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type DepositRequest = {
  provider_code: string;
  reference: string;
  amount: string;
  currency: string;
  customer_phone: string;
  customer_name?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
};

export type PayoutRequest = {
  provider_code: string;
  reference: string;
  amount: string;
  currency: string;
  destination_account: string;
  metadata?: Record<string, unknown>;
};

export function isMobileMoney(provider: Provider | undefined): boolean {
  if (provider === undefined) {
    return false;
  }
  return provider.entity_type === "MOBILE_MONEY";
}

export function isPhoneIdentifier(provider: Provider | undefined): boolean {
  return isMobileMoney(provider);
}

export function extractCustomerName(payload: Record<string, unknown>): string | null {
  const lookup = payload.lookup_data;
  if (isPlainObject(lookup) && typeof lookup.name === "string" && lookup.name.trim() !== "") {
    return lookup.name.trim();
  }
  if (typeof payload.name === "string" && payload.name.trim() !== "") {
    return payload.name.trim();
  }
  return null;
}

export function isTerminalStatus(status: string): boolean {
  const normalized = status.toUpperCase();
  return (
    normalized === "SUCCESS" ||
    normalized === "FAILED" ||
    normalized === "CANCELLED" ||
    normalized === "CANCELED" ||
    normalized === "EXPIRED"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
