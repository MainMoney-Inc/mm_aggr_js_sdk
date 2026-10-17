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
    const checkout = await failedDeposit(mock);
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
