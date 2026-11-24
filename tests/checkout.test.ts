import { describe, expect, it } from "vitest";

import { ConfigurationException, createSession } from "../packages/core/src/index.ts";
import { createCheckout, toE164Digits } from "../packages/checkout/src/index.ts";
import { MockFetch } from "./mock-fetch.ts";

function sessionWith(mock: MockFetch) {
  return createSession({
    merchantBackendUrl: "https://shop.example/payments",
    fetch: mock.fetch,
  });
}

describe("createCheckout", () => {
  it("requires pollUrl and pollHeaders when polling is enabled", () => {
    const mock = new MockFetch();
    const session = sessionWith(mock);
    expect(() => createCheckout(session, { operation: "deposit" })).toThrow(ConfigurationException);
    expect(() => createCheckout(session, { operation: "deposit", pollUrl: "https://shop.example/status" })).toThrow(
      ConfigurationException,
    );
  });

  it("loads countries, providers, highlights a match, and shows a customer name", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(200, { primary_color: "#112233", locale: "en" });
    mock.enqueue(200, [
      { code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
    ]);
    mock.enqueue(200, { entity: "MPESA_KE", lookup_data: { name: "Jane Doe" } });
    const checkout = createCheckout(sessionWith(mock), { operation: "deposit", pollStatus: false });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    checkout.setIdentifier("0712345678");
    await checkout.matchProvider();
    const state = checkout.getState();
    expect(state.highlightedProviderCode).toBe("MPESA_KE");
    expect(state.customerName).toBe("Jane Doe");
    expect(state.selectedProvider?.code).toBe("MPESA_KE");
    const providersCall = mock.calls.find((call) => call.url.includes("/providers"));
    expect(providersCall?.url).toContain("operation_type=DEPOSIT");
    const matchCall = mock.calls.find((call) => call.url.includes("/match-provider"));
    expect(matchCall?.url).toContain("operation_type=DEPOSIT");
  });

  it("hides a null customer name", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, { message: "no prefs" });
    mock.enqueue(200, [
      { code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
    ]);
    mock.enqueue(200, { entity: "MPESA_KE", lookup_data: { name: null } });
    const checkout = createCheckout(sessionWith(mock), { operation: "deposit", pollStatus: false });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    checkout.setIdentifier("0712345678");
    await checkout.matchProvider();
    expect(checkout.getState().customerName).toBeNull();
  });

  it("sends the partner fee as fees and keeps amount as amount", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      { code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
    ]);
    mock.enqueue(200, []);
    mock.enqueue(200, {
      provider_code: "MPESA_KE",
      total_merchant_fee: "2.00",
      net_amount: "102.00",
      currency: "KES",
    });
    mock.enqueue(200, { status: "PENDING", merchant_reference: "ORDER-1" });
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: false,
      reference: "ORDER-1",
      onPartnerFee: async () => ({ amount: "5.00", currency: "KES", label: "App fee" }),
    });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    await checkout.selectProvider("MPESA_KE");
    checkout.setIdentifier("0712345678");
    await checkout.setAmount("100.00");
    await checkout.goOverview();
    await checkout.confirm();
    const createCall = mock.calls.find((call) => call.url.includes("/deposits") && call.method === "POST");
    expect(createCall).toBeDefined();
    const body = JSON.parse(createCall?.body ?? "{}");
    expect(body.amount).toBe("100.00");
    expect(body.fees).toBe("5.00");
  });

  it("blocks payout confirm when balance validation fails", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      { code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
    ]);
    mock.enqueue(200, []);
    mock.enqueue(200, { total_merchant_fee: "0", net_amount: "50.00", currency: "KES" });
    const checkout = createCheckout(sessionWith(mock), {
      operation: "payout",
      pollStatus: false,
      onValidateBalance: async () => ({ ok: false, message: "Insufficient wallet" }),
    });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    await checkout.selectProvider("MPESA_KE");
    checkout.setIdentifier("0712345678");
    await checkout.setAmount("50.00");
    await checkout.goOverview();
    expect(checkout.getState().step).toBe("details");
    expect(checkout.getState().error).toBe("Insufficient wallet");
    const providersCall = mock.calls.find((call) => call.url.includes("/providers"));
    expect(providersCall?.url).toContain("operation_type=PAYOUT");
  });

  it("stores a countries request failure on state instead of throwing", async () => {
    const mock = new MockFetch();
    mock.enqueue(503, { message: "MainMoney is not configured" });
    const checkout = createCheckout(sessionWith(mock), { operation: "deposit", pollStatus: false });
    await checkout.loadCountries();
    expect(checkout.getState().countries).toEqual([]);
    expect(checkout.getState().error).toBe("MainMoney is not configured");
  });

  it("stores a providers request failure and stays on the country step", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, {});
    mock.enqueue(502, { message: "Provider list unavailable" });
    const checkout = createCheckout(sessionWith(mock), { operation: "deposit", pollStatus: false });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    expect(checkout.getState().step).toBe("country");
    expect(checkout.getState().selectedCountry).toBeUndefined();
    expect(checkout.getState().error).toBe("Provider list unavailable");
  });

  it("returns to overview with the deposit error message when create fails", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      { code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
    ]);
    mock.enqueue(200, []);
    mock.enqueue(200, { total_merchant_fee: "0", net_amount: "10.00", currency: "KES" });
    mock.enqueue(400, { message: "Amount is locked to the checkout session" });
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: false,
      reference: "ORDER-FAIL",
    });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    await checkout.selectProvider("MPESA_KE");
    checkout.setIdentifier("0712345678");
    await checkout.setAmount("10.00");
    await checkout.goOverview();
    await checkout.confirm();
    expect(checkout.getState().step).toBe("overview");
    expect(checkout.getState().error).toBe("Amount is locked to the checkout session");
  });

  it("pre-fills amount and ignores setAmount when lockAmount is true", async () => {
    const mock = new MockFetch();
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: false,
      amount: "25.00",
      lockAmount: true,
    });
    expect(checkout.getState().amount).toBe("25.00");
    expect(checkout.getState().lockAmount).toBe(true);
    await checkout.setAmount("99.00");
    expect(checkout.getState().amount).toBe("25.00");
  });

  it("closes with ongoing when polling is disabled", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      { code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
    ]);
    mock.enqueue(200, []);
    mock.enqueue(200, { total_merchant_fee: "0", net_amount: "10.00", currency: "KES" });
    mock.enqueue(200, { status: "PENDING" });
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: false,
      reference: "ORDER-2",
    });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    await checkout.selectProvider("MPESA_KE");
    checkout.setIdentifier("0712345678");
    await checkout.setAmount("10.00");
    await checkout.goOverview();
    await checkout.confirm();
    expect(checkout.getState().step).toBe("ongoing");
  });

  it("polls the injected URL with injected headers", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      { code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
    ]);
    mock.enqueue(200, []);
    mock.enqueue(200, { total_merchant_fee: "0", net_amount: "10.00", currency: "KES" });
    mock.enqueue(200, { status: "PENDING" });
    mock.enqueue(200, { status: "SUCCESS", merchant_reference: "ORDER-3" });
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: true,
      pollUrl: "https://partner.example/status",
      pollHeaders: { Authorization: "Bearer partner-token", "X-CSRF-Token": "csrf" },
      pollIntervalMs: 1,
      reference: "ORDER-3",
    });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    await checkout.selectProvider("MPESA_KE");
    checkout.setIdentifier("0712345678");
    await checkout.setAmount("10.00");
    await checkout.goOverview();
    await checkout.confirm();
    const pollCall = mock.calls.find((call) => call.url.startsWith("https://partner.example/status"));
    expect(pollCall).toBeDefined();
    expect(pollCall?.headers.Authorization).toBe("Bearer partner-token");
    expect(pollCall?.headers["X-CSRF-Token"]).toBe("csrf");
    expect(pollCall?.url).toContain("reference=ORDER-3");
    expect(checkout.getState().step).toBe("terminal");
    expect(checkout.getState().status?.status).toBe("SUCCESS");
  });

  it("flags slow after slowNoticeAfterMs but keeps polling until a terminal status", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      { code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
    ]);
    mock.enqueue(200, []);
    mock.enqueue(200, { total_merchant_fee: "0", net_amount: "10.00", currency: "KES" });
    mock.enqueue(200, { status: "PENDING" });
    for (let i = 0; i < 40; i += 1) {
      mock.enqueue(200, { status: "PENDING" });
    }
    mock.enqueue(200, { status: "SUCCESS", merchant_reference: "ORDER-4" });
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: true,
      pollUrl: "https://partner.example/status",
      pollHeaders: {},
      pollIntervalMs: 5,
      slowNoticeAfterMs: 50,
      reference: "ORDER-4",
    });
    const slowSeen: boolean[] = [];
    checkout.subscribe((state) => slowSeen.push(state.slow));
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    await checkout.selectProvider("MPESA_KE");
    checkout.setIdentifier("0712345678");
    await checkout.setAmount("10.00");
    await checkout.goOverview();
    await checkout.confirm();
    expect(slowSeen).toContain(true);
    expect(checkout.getState().step).toBe("terminal");
    expect(checkout.getState().status?.status).toBe("SUCCESS");
    expect(checkout.getState().slow).toBe(false);
  });

  it("does not call match-provider on identifier keystrokes", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      {
        code: "MPESA_KE",
        name: "M-Pesa",
        entity_type: "MOBILE_MONEY",
        country_code: "KE",
        currency_code: "KES",
        accepted_currencies: ["KES"],
      },
    ]);
    const checkout = createCheckout(sessionWith(mock), { operation: "deposit", pollStatus: false });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    checkout.setIdentifier("0");
    checkout.setIdentifier("07");
    checkout.setIdentifier("0712345678");
    const matchCalls = mock.calls.filter((call) => call.url.includes("/match-provider"));
    expect(matchCalls).toHaveLength(0);
    await checkout.matchProvider();
    expect(mock.calls.filter((call) => call.url.includes("/match-provider"))).toHaveLength(1);
  });

  it("uses accepted_currencies for currency selection", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "CD", name: "Congo", phone_code: "243" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      {
        code: "SIM_CD",
        name: "Simulator",
        entity_type: "MOBILE_MONEY",
        country_code: "CD",
        currency_code: "CDF",
        accepted_currencies: ["CDF", "USD"],
      },
    ]);
    const checkout = createCheckout(sessionWith(mock), { operation: "deposit", pollStatus: false });
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    expect(checkout.getState().availableCurrencies).toEqual(["CDF", "USD"]);
    await checkout.selectProvider("SIM_CD");
    expect(checkout.getState().currency).toBe("CDF");
    await checkout.setCurrency("USD");
    expect(checkout.getState().currency).toBe("USD");
  });

  it("locks currency when provided in options", async () => {
    const mock = new MockFetch();
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: false,
      currency: "USD",
      lockCurrency: true,
    });
    expect(checkout.getState().currency).toBe("USD");
    expect(checkout.getState().lockCurrency).toBe(true);
    expect(checkout.getState().availableCurrencies).toEqual(["USD"]);
  });
});

describe("cart currency, quote, retry and email", () => {
  const provider = {
    code: "SIM_CD",
    name: "Simulator",
    entity_type: "MOBILE_MONEY",
    country_code: "CD",
    currency_code: "CDF",
    accepted_currencies: ["CDF", "EUR"],
  };

  /** `afterProviders` are the responses the auto-selected provider consumes (limits, then fees). */
  async function ready(mock: MockFetch, afterProviders: Array<[number, unknown]>, extra: Record<string, unknown> = {}) {
    mock.enqueue(200, [{ code: "CD", name: "Congo", phone_code: "243" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [provider]);
    for (const [status, body] of afterProviders) {
      mock.enqueue(status, body);
    }
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: false,
      currency: "EUR",
      amount: "10.00",
      lockAmount: true,
      ...extra,
    });
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    return checkout;
  }

  it("keeps the cart currency and only offers the provider's currencies as pay currency", async () => {
    const mock = new MockFetch();
    const checkout = await ready(mock, [[200, []], [200, { total_to_pay: "10.00", currency: "EUR" }]]);
    const state = checkout.getState();
    expect(state.currency).toBe("EUR");
    expect(state.payCurrency).toBe("EUR");
    expect(state.availableCurrencies).toEqual(["CDF", "EUR"]);
    expect(state.currencyFixed).toBe(true);
  });

  it("sends payment_currency to the fee simulation and shows the quote", async () => {
    const mock = new MockFetch();
    const checkout = await ready(mock, [[200, []], [200, { total_to_pay: "10.00" }]]);
    mock.enqueue(200, []);
    mock.enqueue(200, {
      total_to_pay: "10.00",
      quote: { from_currency: "EUR", to_currency: "CDF", rate: "3000", converted_amount: "30000.00" },
    });
    await checkout.setCurrency("CDF");
    const simulate = mock.calls.filter((call) => call.url.endsWith("/fees/simulate")).pop();
    expect(JSON.parse(simulate?.body ?? "{}")).toMatchObject({ currency: "EUR", payment_currency: "CDF", amount: "10.00" });
    expect(checkout.getState().currency).toBe("EUR");
    expect(checkout.getState().fees?.quote?.converted_amount).toBe("30000.00");
  });

  it("falls back to the cart currency with an explanation when no quote exists", async () => {
    const mock = new MockFetch();
    const checkout = await ready(mock, [[200, []], [200, { total_to_pay: "10.00" }]]);
    mock.enqueue(200, []);
    mock.enqueue(400, { success: false, message: "No quote", response_data: { errors: { payment_currency: ["no_quote"] } } });
    mock.enqueue(200, []);
    mock.enqueue(200, { total_to_pay: "10.00" });
    await checkout.setCurrency("CDF");
    const state = checkout.getState();
    expect(state.payCurrency).toBe("EUR");
    expect(state.error).toBe("Conversion between CDF and EUR is not available. Please select EUR.");
    expect(state.quoteUnavailable).toBe(false);
  });

  it("blocks paying when the only accepted currency has no quote", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "CD", name: "Congo", phone_code: "243" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [{ ...provider, accepted_currencies: ["CDF"] }]);
    mock.enqueue(200, []);
    mock.enqueue(400, { message: "No quote", errors: { payment_currency: ["no_quote"] } });
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: false,
      currency: "EUR",
      amount: "10.00",
      lockAmount: true,
    });
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    const state = checkout.getState();
    expect(state.quoteUnavailable).toBe(true);
    expect(state.canPay).toBe(false);
    expect(state.error).toContain("Please select EUR");
  });

  it("seeds the receipt email and keeps it editable", () => {
    const checkout = createCheckout(sessionWith(new MockFetch()), {
      operation: "deposit",
      pollStatus: false,
      customerEmail: " buyer@example.com ",
    });
    expect(checkout.getState().customerEmail).toBe("buyer@example.com");
    checkout.setCustomerEmail("other@example.com");
    expect(checkout.getState().customerEmail).toBe("other@example.com");
  });

  async function failedDeposit(mock: MockFetch, extra: Record<string, unknown> = {}) {
    mock.enqueue(200, [{ code: "CD", name: "Congo", phone_code: "243" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [{ ...provider, accepted_currencies: ["EUR"], currency_code: "EUR" }]);
    mock.enqueue(200, []);
    mock.enqueue(200, { total_to_pay: "10.00" });
    mock.enqueue(400, { message: "Deposit validation failed" });
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: false,
      currency: "EUR",
      amount: "10.00",
      lockAmount: true,
      reference: "ORDER-9",
      ...extra,
    });
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    checkout.setIdentifier("0812345678");
    await checkout.confirm();
    return checkout;
  }

  it("shows only the error with onRetry and calls it on retry", async () => {
    let retried = 0;
    const checkout = await failedDeposit(new MockFetch(), { onRetry: () => void (retried += 1) });
    expect(checkout.getState().step).toBe("error");
    await checkout.retry();
    expect(retried).toBe(1);
  });

  it("retries in place with a new reference and idempotency key suffix", async () => {
    const mock = new MockFetch();
    const checkout = await failedDeposit(mock, { idempotencyHeader: true });
    expect(checkout.getState().step).toBe("overview");
    await checkout.retry();
    mock.enqueue(200, { status: "PENDING" });
    await checkout.confirm();
    const deposits = mock.calls.filter((call) => call.url.endsWith("/deposits"));
    expect(deposits).toHaveLength(2);
    expect(deposits[0].headers["Idempotency-Key"]).toBe("ORDER-9");
    expect(deposits[1].headers["Idempotency-Key"]).toBe("ORDER-9-r1");
    expect(JSON.parse(deposits[1].body ?? "{}").reference).toBe("ORDER-9-r1");
  });
});

describe("toE164Digits", () => {
  it.each(["812345678", "0812345678", "+243812345678", "243812345678", "00243812345678", "+243 (0)81 234 5678"])(
    "prepends the dial code exactly once for %s",
    (input) => {
      expect(toE164Digits(input, "243")).toBe("243812345678");
    },
  );

  it("keeps a national number that merely starts with the dial code", () => {
    expect(toE164Digits("243123456", "243")).toBe("243243123456");
  });
});

describe("phone normalisation before a provider is known", () => {
  const PROVIDERS = [
    { code: "MTN_CD", name: "MTN", entity_type: "MOBILE_MONEY", country_code: "CD", currency_code: "USD" },
    { code: "ORANGE_CD", name: "Orange", entity_type: "MOBILE_MONEY", country_code: "CD", currency_code: "USD" },
  ];

  async function ready(mock: MockFetch, extra: Record<string, unknown> = {}) {
    mock.enqueue(200, [{ code: "CD", name: "Congo", phone_code: "243" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, PROVIDERS);
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: false,
      currency: "USD",
      amount: "10.00",
      lockAmount: true,
      ...extra,
    });
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    return checkout;
  }

  const matchAccount = (mock: MockFetch): string[] =>
    mock.calls
      .filter((call) => call.url.includes("/match-provider"))
      .map((call) => new URL(call.url).searchParams.get("account_number") ?? "");

  it.each(["987805910", "0987805910", "+243987805910"])("sends 243987805910 to match-provider for %s", async (typed) => {
    const mock = new MockFetch();
    const checkout = await ready(mock);
    expect(checkout.getState().selectedProvider).toBeUndefined();
    mock.enqueue(200, { entity: "MTN_CD" });
    checkout.setIdentifier(typed);
    await checkout.matchProvider();
    expect(matchAccount(mock)).toEqual(["243987805910"]);
  });

  it("canPay is true with a valid local number before a provider is matched", async () => {
    const mock = new MockFetch();
    const checkout = await ready(mock);
    expect(checkout.getState().selectedProvider).toBeUndefined();
    checkout.setIdentifier("987805910");
    expect(checkout.getState().canPay).toBe(true);
    checkout.setIdentifier("12");
    expect(checkout.getState().canPay).toBe(false);
  });

  it("looks the number up again when the country (dial code) changes", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [
      { code: "CD", name: "Congo", phone_code: "243" },
      { code: "KE", name: "Kenya", phone_code: "254" },
    ]);
    mock.enqueue(404, {});
    mock.enqueue(200, PROVIDERS);
    const checkout = createCheckout(sessionWith(mock), { operation: "deposit", pollStatus: false, currency: "USD", amount: "10", lockAmount: true });
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    mock.enqueue(200, { entity: "MTN_CD" });
    checkout.setIdentifier("712345678");
    await checkout.matchProvider();
    mock.enqueue(200, [{ code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "USD" }]);
    mock.enqueue(200, { entity: "MPESA_KE" });
    await checkout.selectCountry("KE");
    expect(matchAccount(mock)).toEqual(["243712345678", "254712345678"]);
  });

  it("keeps a bank account number raw once a non-phone provider is selected", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, [{ code: "CD", name: "Congo", phone_code: "243" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      { code: "BANK_CD", name: "Bank", entity_type: "BANK", country_code: "CD", currency_code: "USD" },
      ...PROVIDERS,
    ]);
    const checkout = createCheckout(sessionWith(mock), { operation: "payout", pollStatus: false, currency: "USD" });
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    mock.enqueue(200, []);
    await checkout.selectProvider("BANK_CD");
    mock.enqueue(200, { entity: "BANK_CD" });
    checkout.setIdentifier("00123456789");
    await checkout.matchProvider();
    expect(matchAccount(mock)).toEqual(["00123456789"]);
  });
});

describe("cart currency and session defaults", () => {
  const CDF_ONLY = {
    code: "AIRTEL_CD",
    name: "Airtel",
    entity_type: "MOBILE_MONEY",
    country_code: "CD",
    currency_code: "CDF",
    accepted_currencies: ["CDF"],
  };

  async function load(mock: MockFetch, session: ReturnType<typeof createSession>, options: Record<string, unknown> = {}) {
    mock.enqueue(200, [{ code: "CD", name: "Congo", phone_code: "243" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [CDF_ONLY]);
    mock.enqueue(200, []);
    mock.enqueue(200, { total_to_pay: "10.00" });
    const checkout = createCheckout(session, { operation: "deposit", pollStatus: false, amount: "10.00", lockAmount: true, ...options });
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    return checkout;
  }

  it("a USD cart with a CDF-only provider pays in CDF and keeps currency USD", async () => {
    const mock = new MockFetch();
    const checkout = await load(mock, sessionWith(mock), { currency: "USD" });
    const state = checkout.getState();
    expect(state.currency).toBe("USD");
    expect(state.payCurrency).toBe("CDF");
    const simulate = mock.calls.filter((call) => call.url.endsWith("/fees/simulate")).pop();
    expect(JSON.parse(simulate?.body ?? "{}")).toMatchObject({ currency: "USD", payment_currency: "CDF" });
    mock.enqueue(200, { status: "PENDING" });
    checkout.setIdentifier("987805910");
    await checkout.pay();
    const deposit = mock.calls.find((call) => call.url.endsWith("/deposits"));
    expect(JSON.parse(deposit?.body ?? "{}")).toMatchObject({ currency: "USD", payment_currency: "CDF", customer_phone: "243987805910" });
  });

  it("createSession currency and lockCurrency are the defaults for createCheckout", async () => {
    const mock = new MockFetch();
    const session = createSession({
      merchantBackendUrl: "https://shop.example/payments",
      fetch: mock.fetch,
      currency: "usd",
      lockCurrency: true,
    });
    const checkout = createCheckout(session, { operation: "deposit", pollStatus: false });
    const state = checkout.getState();
    expect(state.currency).toBe("USD");
    expect(state.currencyFixed).toBe(true);
    expect(state.lockCurrency).toBe(true);
  });

  it("checkout options win over the session defaults", () => {
    const mock = new MockFetch();
    const session = createSession({ merchantBackendUrl: "https://shop.example/payments", fetch: mock.fetch, currency: "USD", lockCurrency: true });
    const state = createCheckout(session, { operation: "deposit", pollStatus: false, currency: "EUR", lockCurrency: false }).getState();
    expect(state.currency).toBe("EUR");
    expect(state.lockCurrency).toBe(false);
  });
});

describe("provider lookup", () => {
  async function ready(mock: MockFetch, options: Record<string, unknown> = {}) {
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      { code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
      { code: "AIRTEL_KE", name: "Airtel", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
    ]);
    const checkout = createCheckout(sessionWith(mock), { operation: "deposit", pollStatus: false, ...options });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    return checkout;
  }

  it("sends one lookup when the debounce, blur and pay ask for the same number", async () => {
    const mock = new MockFetch();
    const checkout = await ready(mock);
    mock.enqueue(200, { entity: "AIRTEL_KE", lookup_data: { name: "Jane" } });
    checkout.setIdentifier("0712345678");
    await Promise.all([checkout.matchProvider(), checkout.matchProvider(), checkout.matchProvider()]);
    expect(mock.calls.filter((call) => call.url.includes("/match-provider"))).toHaveLength(1);
    expect(checkout.getState().selectedProvider?.code).toBe("AIRTEL_KE");
  });

  it("drops a slow answer for a number the customer already replaced", async () => {
    const mock = new MockFetch();
    const checkout = await ready(mock);
    mock.enqueue(200, { entity: "MPESA_KE", lookup_data: { name: "Old Number" } });
    mock.enqueue(200, { entity: "AIRTEL_KE", lookup_data: { name: "New Number" } });
    checkout.setIdentifier("0712345678");
    const first = checkout.matchProvider();
    checkout.setIdentifier("0799999999");
    const second = checkout.matchProvider();
    await Promise.all([first, second]);
    const state = checkout.getState();
    expect(state.selectedProvider?.code).toBe("AIRTEL_KE");
    expect(state.customerName).toBe("New Number");
  });

  it("keeps the match when limits and fees cannot be loaded", async () => {
    const mock = new MockFetch();
    const checkout = await ready(mock, { amount: "100", currency: "KES" });
    mock.enqueue(200, { entity: "AIRTEL_KE", lookup_data: { name: "Jane" } });
    mock.enqueue(500, { message: "limits down" });
    checkout.setIdentifier("0712345678");
    await checkout.matchProvider();
    const state = checkout.getState();
    expect(state.selectedProvider?.code).toBe("AIRTEL_KE");
    expect(state.customerName).toBe("Jane");
    expect(state.error).toBeDefined();
  });
});

describe("deposit request headers", () => {
  async function pending(mock: MockFetch, options: Record<string, unknown> = {}) {
    mock.enqueue(200, [{ code: "KE", name: "Kenya", phone_code: "254" }]);
    mock.enqueue(404, {});
    mock.enqueue(200, [
      { code: "MPESA_KE", name: "M-Pesa", entity_type: "MOBILE_MONEY", country_code: "KE", currency_code: "KES" },
    ]);
    mock.enqueue(200, { limits: [] });
    mock.enqueue(200, { total_to_pay: "100.00" });
    const checkout = createCheckout(sessionWith(mock), {
      operation: "deposit",
      pollStatus: false,
      reference: "ORDER-1",
      amount: "100",
      currency: "KES",
      ...options,
    });
    await checkout.loadCountries();
    await checkout.selectCountry("KE");
    checkout.setIdentifier("0712345678");
    mock.enqueue(200, { status: "PENDING" });
    await checkout.confirm();
    return mock.calls.find((call) => call.method === "POST" && call.url.endsWith("/deposits"));
  }

  it("does not send a custom Idempotency-Key header by default (no CORS preflight surprise)", async () => {
    const call = await pending(new MockFetch());
    expect(call).toBeDefined();
    expect(Object.keys(call?.headers ?? {}).map((name) => name.toLowerCase())).not.toContain("idempotency-key");
    expect(JSON.parse(call?.body ?? "{}").reference).toBe("ORDER-1");
  });

  it("sends the Idempotency-Key header when idempotencyHeader is on", async () => {
    const call = await pending(new MockFetch(), { idempotencyHeader: true });
    expect(call?.headers["Idempotency-Key"]).toBe("ORDER-1");
  });
});

