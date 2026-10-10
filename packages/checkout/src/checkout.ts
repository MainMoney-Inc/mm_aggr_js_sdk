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
  type CheckoutLocale,
  type CheckoutTheme,
  type Country,
  type FeeBearer,
  type FeeSimulation,
  type MessageCatalog,
  type OperationType,
  type PartnerFee,
  type PaymentMethod,
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
  locale?: CheckoutLocale;
  messages?: Partial<MessageCatalog>;
  theme?: Partial<CheckoutTheme>;
  reference?: string;
  amount?: string;
  lockAmount?: boolean;
  currency?: string;
  lockCurrency?: boolean;
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
  lockCurrency: boolean;
  availableCurrencies: string[];
  limits?: AmountLimit;
  fees?: FeeSimulation;
  partnerFee: PartnerFee | null;
  locale: CheckoutLocale;
  /** Tabs enabled for the merchant (from checkout preferences); defaults to mobile money only. */
  paymentMethods: PaymentMethod[];
  activeMethod: PaymentMethod;
  feeBearer: FeeBearer;
  /** Optional address for the payment receipt. */
  customerEmail: string;
  /** True when the form is complete enough for `pay()`. Computed on every `getState()`. */
  canPay: boolean;
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
  setCustomerEmail(value: string): void;
  setMethod(method: PaymentMethod): void;
  setLocale(locale: CheckoutLocale): void;
  matchProvider(): Promise<void>;
  setCurrency(code: string): Promise<void>;
  setAmount(amount: string): Promise<void>;
  goOverview(): Promise<void>;
  goBack(): void;
  /** Single-form flow: resolve the provider, run merchant hooks, then confirm without an overview step. */
  pay(): Promise<void>;
  confirm(): Promise<void>;
  close(): void;
};

/** Shortest national number that can follow a dial code the customer already typed. */
const MIN_NATIONAL_AFTER_DIAL_CODE = 8;

/** Plausible length of a national mobile number (E.164 allows up to 15 digits including the dial code). */
const MIN_LOCAL_NUMBER_DIGITS = 7;
const MAX_LOCAL_NUMBER_DIGITS = 12;

/**
 * Builds `<dialCode><national>` (digits only) from whatever the customer typed:
 * `812345678`, `0812345678`, `+243812345678`, `00243812345678` all yield `243812345678`.
 * A dial code is only stripped when enough digits remain, so a national number that
 * merely starts with the same digits is left alone.
 */
export function toE164Digits(input: string, dialCode: string): string {
  const code = dialCode.replace(/\D/g, "");
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  const national =
    digits.startsWith(code) && digits.length - code.length >= MIN_NATIONAL_AFTER_DIAL_CODE
      ? digits.slice(code.length).replace(/^0+/, "")
      : digits;
  return `${code}${national}`;
}

export function providerAcceptedCurrencies(provider: Provider): string[] {
  if (provider.accepted_currencies !== undefined && provider.accepted_currencies.length > 0) {
    return [...provider.accepted_currencies];
  }
  return [provider.currency_code];
}

export function unionProviderCurrencies(providers: Provider[]): string[] {
  const codes = new Set<string>();
  for (const provider of providers) {
    for (const code of providerAcceptedCurrencies(provider)) {
      codes.add(code);
    }
  }
  return [...codes].sort();
}

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
  const catalogOverrides = { ...session.messages, ...options.messages };
  let translate = createTranslator(options.locale ?? session.locale, catalogOverrides);
  const t = (key: string, vars?: Record<string, string>): string => translate(key, vars);
  const theme = { ...session.theme, ...options.theme };
  const emitter = new Emitter();
  const pollAbort = new AbortController();
  const explicitCurrency = options.currency?.trim() ?? "";
  const lockCurrency = options.lockCurrency === true || explicitCurrency !== "";

  const state: CheckoutSnapshot = {
    step: "country",
    operation: options.operation,
    countries: [],
    providers: [],
    identifier: "",
    customerName: null,
    amount: options.amount ?? "",
    lockAmount: options.lockAmount === true,
    currency: explicitCurrency,
    lockCurrency,
    availableCurrencies: explicitCurrency !== "" ? [explicitCurrency] : [],
    partnerFee: null,
    locale: options.locale ?? session.locale,
    paymentMethods: ["mobile_money"],
    activeMethod: "mobile_money",
    feeBearer: "MERCHANT",
    customerEmail: "",
    canPay: false,
    theme,
  };

  let lastMatchedIdentifier = "";
  let returnStep: CheckoutStep = "overview";

  const notify = (): void => {
    emitter.emit("change", getState());
  };

  const getState = (): CheckoutSnapshot => ({ ...structuredClone(state), canPay: computeCanPay() });

  /** Digits a customer must type: long enough to be a local number, short enough to exclude pasted junk. */
  const hasValidLocalNumber = (): boolean => {
    const digits = e164OrIdentifier().replace(/\D/g, "");
    const dial = state.selectedCountry?.phone_code?.replace(/\D/g, "") ?? "";
    const national = digits.length - dial.length;
    return national >= MIN_LOCAL_NUMBER_DIGITS && national <= MAX_LOCAL_NUMBER_DIGITS;
  };

  const computeCanPay = (): boolean => {
    const amount = Number(state.amount);
    return (
      state.step === "details" &&
      state.activeMethod === "mobile_money" &&
      state.selectedCountry !== undefined &&
      state.providers.length > 0 &&
      state.currency !== "" &&
      Number.isFinite(amount) &&
      amount > 0 &&
      hasValidLocalNumber()
    );
  };

  const messageFromError = (error: unknown): string => {
    if (error instanceof Error && error.message !== "") {
      return error.message;
    }
    return "Merchant backend request failed";
  };

  const fail = (error: unknown): void => {
    state.error = messageFromError(error);
    notify();
  };

  const routingOperationType = (): "DEPOSIT" | "PAYOUT" => {
    return state.operation === "deposit" ? "DEPOSIT" : "PAYOUT";
  };

  const paginated = <T>(payload: unknown): T[] => {
    if (Array.isArray(payload)) {
      return payload as T[];
    }
    if (payload !== null && typeof payload === "object" && Array.isArray((payload as { results?: unknown }).results)) {
      return (payload as { results: T[] }).results;
    }
    return [];
  };

  const applyProviderCurrency = (provider: Provider): void => {
    if (state.lockCurrency) {
      return;
    }
    const accepted = providerAcceptedCurrencies(provider);
    state.availableCurrencies = accepted;
    if (accepted.includes(provider.currency_code)) {
      state.currency = provider.currency_code;
    } else if (accepted.length > 0) {
      state.currency = accepted[0];
    }
  };

  const PAYMENT_METHODS: PaymentMethod[] = ["mobile_money", "card", "mainmoney"];

  const applyPaymentPreferences = (prefs: Record<string, unknown>): void => {
    if (Array.isArray(prefs.payment_methods)) {
      const methods = PAYMENT_METHODS.filter((method) => (prefs.payment_methods as unknown[]).includes(method));
      state.paymentMethods = methods;
      if (!methods.includes(state.activeMethod)) {
        state.activeMethod = methods[0] ?? "mobile_money";
      }
    }
    if (prefs.fee_bearer === "CUSTOMER" || prefs.fee_bearer === "MERCHANT") {
      state.feeBearer = prefs.fee_bearer;
    }
  };

  const loadCountries = async (): Promise<void> => {
    try {
      const payload = await http.get<unknown>(session.paths.countries);
      state.countries = paginated<Country>(payload);
      state.error = undefined;
    } catch (error) {
      fail(error);
      return;
    }
    try {
      const prefs = await http.get<Record<string, unknown>>(session.paths.checkoutPreferences);
      applyPaymentPreferences(prefs);
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
      fail(new ConfigurationException("Unknown country"));
      return;
    }
    try {
      const payload = await http.get<unknown>(session.paths.providers, {
        country: code,
        operation_type: routingOperationType(),
      });
      state.selectedCountry = country;
      state.selectedProvider = undefined;
      state.highlightedProviderCode = undefined;
      state.customerName = null;
      lastMatchedIdentifier = "";
      state.providers = paginated<Provider>(payload);
      if (!state.lockCurrency) {
        state.availableCurrencies = unionProviderCurrencies(state.providers);
        if (state.currency === "" && state.availableCurrencies.length > 0) {
          state.currency = state.availableCurrencies[0];
        }
      }
      state.error = undefined;
      state.step = "details";
      if (state.providers.length === 1 && state.operation === "deposit") {
        state.selectedProvider = state.providers[0];
        applyProviderCurrency(state.providers[0]);
        await refreshLimitsAndFees();
      }
      notify();
    } catch (error) {
      fail(error);
    }
  };

  const selectProvider = async (code: string): Promise<void> => {
    const provider = state.providers.find((item) => item.code === code);
    if (provider === undefined) {
      fail(new ConfigurationException("Unknown provider"));
      return;
    }
    try {
      state.selectedProvider = provider;
      applyProviderCurrency(provider);
      await refreshLimitsAndFees();
      notify();
    } catch (error) {
      fail(error);
    }
  };

  const setIdentifier = (value: string): void => {
    state.identifier = value;
    // Do not notify: full re-render destroys the input and fires blur → matchProvider.
  };

  const setCustomerEmail = (value: string): void => {
    state.customerEmail = value.trim();
  };

  const setMethod = (method: PaymentMethod): void => {
    if (!state.paymentMethods.includes(method) || state.activeMethod === method) {
      return;
    }
    state.activeMethod = method;
    state.error = undefined;
    notify();
  };

  const setLocale = (locale: CheckoutLocale): void => {
    if (state.locale === locale) {
      return;
    }
    state.locale = locale;
    translate = createTranslator(locale, catalogOverrides);
    notify();
  };

  const matchProvider = async (): Promise<void> => {
    const trimmed = state.identifier.trim();
    if (trimmed === "") {
      return;
    }
    if (trimmed === lastMatchedIdentifier) {
      return;
    }
    try {
      const payload = await http.get<Record<string, unknown>>(session.paths.matchProvider, {
        account_number: e164OrIdentifier(),
        get_lookup: true,
        operation_type: routingOperationType(),
      });
      const entity = typeof payload.entity === "string" ? payload.entity : undefined;
      if (entity !== undefined) {
        state.highlightedProviderCode = entity;
        const matched = state.providers.find((item) => item.code === entity);
        if (matched !== undefined) {
          state.selectedProvider = matched;
          applyProviderCurrency(matched);
        }
      }
      state.customerName = extractCustomerName(payload);
      lastMatchedIdentifier = trimmed;
      await refreshLimitsAndFees();
      notify();
    } catch (error) {
      fail(error);
    }
  };

  const setCurrency = async (code: string): Promise<void> => {
    if (state.lockCurrency) {
      return;
    }
    const normalized = code.trim().toUpperCase();
    if (normalized === "" || !state.availableCurrencies.includes(normalized)) {
      fail(new ConfigurationException("Unknown currency"));
      return;
    }
    try {
      state.currency = normalized;
      await refreshLimitsAndFees();
      notify();
    } catch (error) {
      fail(error);
    }
  };

  const setAmount = async (amount: string): Promise<void> => {
    if (state.lockAmount) {
      return;
    }
    try {
      state.amount = amount;
      await refreshLimitsAndFees();
      notify();
    } catch (error) {
      fail(error);
    }
  };

  const refreshLimitsAndFees = async (): Promise<void> => {
    if (state.selectedProvider === undefined || state.amount.trim() === "" || state.currency === "") {
      return;
    }
    const operation = routingOperationType();
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

  /** Validate the form and run merchant hooks. Returns false (with `state.error` set) when blocked. */
  const prepare = async (): Promise<boolean> => {
    if (state.selectedCountry === undefined || state.selectedProvider === undefined) {
      state.error = t("required");
      notify();
      return false;
    }
    if (state.identifier.trim() === "" || state.amount.trim() === "" || state.currency === "") {
      state.error = t("required");
      notify();
      return false;
    }
    try {
      if (options.onPartnerFee !== undefined) {
        const fee = await options.onPartnerFee(getState());
        if (fee !== null && fee.currency !== state.currency) {
          fail(new CurrencyMismatchException());
          return false;
        }
        state.partnerFee = fee;
      }
      if (state.operation === "payout" && options.onValidateBalance !== undefined) {
        const result = await options.onValidateBalance(getState());
        if (!result.ok) {
          state.error = result.message ?? t("balanceRejected");
          notify();
          return false;
        }
      }
      state.error = undefined;
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  };

  const goOverview = async (): Promise<void> => {
    if (await prepare()) {
      state.step = "overview";
      notify();
    }
  };

  const pay = async (): Promise<void> => {
    if (state.activeMethod !== "mobile_money") {
      return;
    }
    if (state.selectedProvider === undefined || lastMatchedIdentifier !== state.identifier.trim()) {
      await matchProvider();
    }
    if (state.selectedProvider === undefined) {
      state.error = t("selectProvider");
      notify();
      return;
    }
    if (await prepare()) {
      returnStep = "details";
      await confirm();
    }
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
      fail(new ConfigurationException("Provider is required"));
      return;
    }
    state.step = "confirming";
    state.error = undefined;
    notify();
    try {
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
        if (state.customerEmail !== "") {
          payload.customer_email = state.customerEmail;
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
    } catch (error) {
      state.step = returnStep;
      fail(error);
    }
  };

  const depositAmount = (): string => {
    if (state.operation !== "deposit") {
      return state.amount;
    }
    // With CUSTOMER as fee bearer the customer pays amount + processing fee.
    const base =
      state.feeBearer === "CUSTOMER" && state.fees?.total_to_pay !== undefined
        ? Number(state.fees.total_to_pay).toFixed(2)
        : state.amount;
    if (state.partnerFee === null) {
      return base;
    }
    return addMoney(
      { amount: base, currency: state.currency },
      { amount: state.partnerFee.amount, currency: state.partnerFee.currency },
    ).amount;
  };

  const e164OrIdentifier = (): string => {
    const raw = state.identifier.trim();
    if (!isPhoneIdentifier(state.selectedProvider) || state.selectedCountry?.phone_code === undefined) {
      return raw;
    }
    return toE164Digits(raw, state.selectedCountry.phone_code);
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
    setCustomerEmail,
    setMethod,
    setLocale,
    matchProvider,
    setCurrency,
    setAmount,
    goOverview,
    goBack,
    pay,
    confirm,
    close,
  };
}
