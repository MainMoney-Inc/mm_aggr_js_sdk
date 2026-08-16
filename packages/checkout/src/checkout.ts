/** Headless checkout wizard. */

import {
  ConfigurationException,
  CurrencyMismatchException,
  Emitter,
  addMoney,
  createTranslator,
  extractCustomerName,
  isPhoneIdentifier,
  isTerminalStatus,
  type AmountLimit,
  type CheckoutTheme,
  type Country,
  type FeeSimulation,
  type MessageCatalog,
  type OperationType,
  type PartnerFee,
  type Provider,
  type Session,
  type StatusPayload,
} from "@mainmoney/js-core";
import { createHttp, type MerchantHttp } from "@mainmoney/js-http";

import { pollStatus } from "./poll.js";

export type CheckoutStep = "country" | "details" | "overview" | "confirming" | "polling" | "ongoing" | "terminal";

export type BalanceCheck = { ok: boolean; message?: string };

export type CreateCheckoutOptions = {
  operation: OperationType;
  pollStatus?: boolean;
  pollUrl?: string;
  pollHeaders?: Record<string, string>;
  locale?: "en" | "fr";
  messages?: Partial<MessageCatalog>;
  theme?: Partial<CheckoutTheme>;
  reference?: string;
  amount?: string;
  lockAmount?: boolean;
  pollIntervalMs?: number;
  onPartnerFee?: (ctx: CheckoutSnapshot) => Promise<PartnerFee | null>;
  onValidateBalance?: (ctx: CheckoutSnapshot) => Promise<BalanceCheck>;
  http?: MerchantHttp;
};

export type CheckoutSnapshot = {
  step: CheckoutStep;
  operation: OperationType;
  countries: Country[];
  providers: Provider[];
  selectedCountry?: Country;
  selectedProvider?: Provider;
  highlightedProviderCode?: string;
  identifier: string;
  customerName: string | null;
  amount: string;
  lockAmount: boolean;
  currency: string;
  limits?: AmountLimit;
  fees?: FeeSimulation;
  partnerFee: PartnerFee | null;
  error?: string;
  status?: StatusPayload;
  theme: CheckoutTheme;
};

export type Checkout = {
  readonly t: (key: string, vars?: Record<string, string>) => string;
  getState(): CheckoutSnapshot;
  subscribe(listener: (state: CheckoutSnapshot) => void): () => void;
  loadCountries(): Promise<void>;
  selectCountry(code: string): Promise<void>;
  selectProvider(code: string): Promise<void>;
  setIdentifier(value: string): void;
  matchProvider(): Promise<void>;
  setAmount(amount: string): Promise<void>;
  goOverview(): Promise<void>;
  goBack(): void;
  confirm(): Promise<void>;
  close(): void;
};

export function createCheckout(session: Session, options: CreateCheckoutOptions): Checkout {
  const pollEnabled = options.pollStatus !== false;
  if (pollEnabled) {
    if (options.pollUrl === undefined || options.pollUrl.trim() === "") {
      throw new ConfigurationException("pollUrl is required when pollStatus is true");
    }
    if (options.pollHeaders === undefined) {
      throw new ConfigurationException("pollHeaders is required when pollStatus is true");
    }
  }

  const http = options.http ?? createHttp(session);
  const t = createTranslator(options.locale ?? session.locale, { ...session.messages, ...options.messages });
  const theme = { ...session.theme, ...options.theme };
  const emitter = new Emitter();
  const pollAbort = new AbortController();

  const state: CheckoutSnapshot = {
    step: "country",
    operation: options.operation,
    countries: [],
    providers: [],
    identifier: "",
    customerName: null,
    amount: options.amount ?? "",
    lockAmount: options.lockAmount === true,
    currency: "",
    partnerFee: null,
    theme,
  };

  const notify = (): void => {
    emitter.emit("change", getState());
  };

  const getState = (): CheckoutSnapshot => structuredClone(state);

  const paginated = <T>(payload: unknown): T[] => {
    if (Array.isArray(payload)) {
      return payload as T[];
    }
    if (payload !== null && typeof payload === "object" && Array.isArray((payload as { results?: unknown }).results)) {
      return (payload as { results: T[] }).results;
    }
    return [];
  };

  const loadCountries = async (): Promise<void> => {
    const payload = await http.get<unknown>(session.paths.countries);
    state.countries = paginated<Country>(payload);
    try {
      const prefs = await http.get<Record<string, unknown>>(session.paths.checkoutPreferences);
      if (prefs.primary_color !== undefined) {
        state.theme = {
          primary: String(prefs.primary_color ?? state.theme.primary),
          secondary: String(prefs.secondary_color ?? state.theme.secondary),
          accent: String(prefs.accent_color ?? state.theme.accent),
          background: String(prefs.background_color ?? state.theme.background),
        };
      }
    } catch {
      // Branding is optional; merchant may not proxy the endpoint yet.
    }
    notify();
  };

  const selectCountry = async (code: string): Promise<void> => {
    const country = state.countries.find((item) => item.code === code);
    if (country === undefined) {
      throw new ConfigurationException("Unknown country");
    }
    state.selectedCountry = country;
    state.selectedProvider = undefined;
    state.highlightedProviderCode = undefined;
    state.customerName = null;
    const payload = await http.get<unknown>(session.paths.providers, { country: code });
    state.providers = paginated<Provider>(payload);
    state.step = "details";
    notify();
  };

  const selectProvider = async (code: string): Promise<void> => {
    const provider = state.providers.find((item) => item.code === code);
    if (provider === undefined) {
      throw new ConfigurationException("Unknown provider");
    }
    state.selectedProvider = provider;
    state.currency = provider.currency_code;
    await refreshLimitsAndFees();
    notify();
  };

  const setIdentifier = (value: string): void => {
    state.identifier = value;
    notify();
  };

  const matchProvider = async (): Promise<void> => {
    if (state.identifier.trim() === "") {
      return;
    }
    const payload = await http.get<Record<string, unknown>>(session.paths.matchProvider, {
      account_number: e164OrIdentifier(),
      get_lookup: true,
    });
    const entity = typeof payload.entity === "string" ? payload.entity : undefined;
    if (entity !== undefined) {
      state.highlightedProviderCode = entity;
      const matched = state.providers.find((item) => item.code === entity);
      if (matched !== undefined) {
        state.selectedProvider = matched;
        state.currency = matched.currency_code;
      }
    }
    state.customerName = extractCustomerName(payload);
    await refreshLimitsAndFees();
    notify();
  };

  const setAmount = async (amount: string): Promise<void> => {
    if (state.lockAmount) {
      return;
    }
    state.amount = amount;
    await refreshLimitsAndFees();
    notify();
  };

  const refreshLimitsAndFees = async (): Promise<void> => {
    if (state.selectedProvider === undefined || state.amount.trim() === "" || state.currency === "") {
      return;
    }
    const operation = state.operation === "deposit" ? "DEPOSIT" : "PAYOUT";
    const limitsPayload = await http.get<unknown>(session.paths.amountLimits, {
      financial_entity_code: state.selectedProvider.code,
      currency: state.currency,
      operation_type: operation,
    });
    const limits = paginated<AmountLimit>(limitsPayload);
    state.limits = limits[0];
    if (state.limits !== undefined) {
      const amount = Number(state.amount);
      const min = state.limits.amount_min === null ? undefined : Number(state.limits.amount_min);
      const max = state.limits.amount_max === null ? undefined : Number(state.limits.amount_max);
      if ((min !== undefined && amount < min) || (max !== undefined && amount > max)) {
        state.error = t("limits", {
          min: state.limits.amount_min ?? "",
          max: state.limits.amount_max ?? "",
        });
      } else {
        state.error = undefined;
      }
    }
    state.fees = await http.post<FeeSimulation>(session.paths.feesSimulate, {
      provider_code: state.selectedProvider.code,
      operation_type: operation,
      amount: state.amount,
      currency: state.currency,
    });
  };

  const goOverview = async (): Promise<void> => {
    if (state.selectedCountry === undefined || state.selectedProvider === undefined) {
      state.error = t("required");
      notify();
      return;
    }
    if (state.identifier.trim() === "" || state.amount.trim() === "") {
      state.error = t("required");
      notify();
      return;
    }
    if (options.onPartnerFee !== undefined) {
      const fee = await options.onPartnerFee(getState());
      if (fee !== null && fee.currency !== state.currency) {
        throw new CurrencyMismatchException();
      }
      state.partnerFee = fee;
    }
    if (state.operation === "payout" && options.onValidateBalance !== undefined) {
      const result = await options.onValidateBalance(getState());
      if (!result.ok) {
        state.error = result.message ?? t("balanceRejected");
        notify();
        return;
      }
    }
    state.error = undefined;
    state.step = "overview";
    notify();
  };

  const goBack = (): void => {
    if (state.step === "overview") {
      state.step = "details";
    } else if (state.step === "details") {
      state.step = "country";
    }
    notify();
  };

  const confirm = async (): Promise<void> => {
    if (state.selectedProvider === undefined) {
      throw new ConfigurationException("Provider is required");
    }
    state.step = "confirming";
    notify();
    const reference = options.reference ?? crypto.randomUUID();
    const createAmount = depositAmount();
    let created: StatusPayload;
    if (state.operation === "deposit") {
      const payload: Record<string, unknown> = {
        provider_code: state.selectedProvider.code,
        reference,
        amount: createAmount,
        currency: state.currency,
        customer_phone: e164OrIdentifier(),
      };
      if (state.customerName !== null) {
        payload.customer_name = state.customerName;
      }
      created = await http.post<StatusPayload>(session.paths.deposits, payload, {
        "Idempotency-Key": reference,
      });
    } else {
      created = await http.post<StatusPayload>(session.paths.payouts, {
        provider_code: state.selectedProvider.code,
        reference,
        amount: state.amount,
        currency: state.currency,
        destination_account: e164OrIdentifier(),
      }, { "Idempotency-Key": reference });
    }
    state.status = created;
    if (typeof created.status === "string" && isTerminalStatus(created.status)) {
      state.step = "terminal";
      notify();
      emitter.emit("complete", getState());
      return;
    }
    if (!pollEnabled) {
      state.step = "ongoing";
      notify();
      emitter.emit("ongoing", getState());
      return;
    }
    state.step = "polling";
    notify();
    const status = await pollStatus({
      pollUrl: options.pollUrl ?? "",
      pollHeaders: options.pollHeaders ?? {},
      fetchImpl: session.fetch,
      reference,
      operation: state.operation,
      intervalMs: options.pollIntervalMs ?? 2000,
      signal: pollAbort.signal,
    });
    state.status = status;
    state.step = "terminal";
    notify();
    emitter.emit("complete", getState());
    if (typeof status.status === "string") {
      emitter.emit("status", status);
    }
  };

  const depositAmount = (): string => {
    if (state.partnerFee === null || state.operation !== "deposit") {
      return state.amount;
    }
    return addMoney(
      { amount: state.amount, currency: state.currency },
      { amount: state.partnerFee.amount, currency: state.partnerFee.currency },
    ).amount;
  };

  const e164OrIdentifier = (): string => {
    const raw = state.identifier.trim();
    if (!isPhoneIdentifier(state.selectedProvider) || state.selectedCountry?.phone_code === undefined) {
      return raw;
    }
    const national = raw.replace(/\D/g, "").replace(/^0+/, "");
    return `${state.selectedCountry.phone_code}${national}`;
  };

  const close = (): void => {
    pollAbort.abort();
  };

  return {
    t,
    getState,
    subscribe: (listener) => emitter.on("change", listener),
    loadCountries,
    selectCountry,
    selectProvider,
    setIdentifier,
    matchProvider,
    setAmount,
    goOverview,
    goBack,
    confirm,
    close,
  };
}
