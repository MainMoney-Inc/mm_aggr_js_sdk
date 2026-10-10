import { describe, expect, it } from "vitest";

import { createSession } from "../packages/core/src/index.ts";
import { createCheckout } from "../packages/checkout/src/index.ts";
import { flagEmoji } from "../packages/checkout/src/form.ts";
import { MockFetch } from "./mock-fetch.ts";

const COUNTRIES = [{ code: "CD", name: "DR Congo", phone_code: "243", flag: null }];
const PROVIDER = {
  code: "MTN_CD",
  name: "MTN",
  entity_type: "MOBILE_MONEY",
  country_code: "CD",
  currency_code: "USD",
  logo: null,
};

function sessionWith(mock: MockFetch) {
  return createSession({ merchantBackendUrl: "https://shop.example/payments", fetch: mock.fetch });
}

/** Queue: countries, preferences, providers (one) and the limits+fees fetched when the single provider is selected. */
function queueLoad(mock: MockFetch, prefs: Record<string, unknown>, totalToPay = "10.00"): void {
  mock.enqueue(200, COUNTRIES);
  mock.enqueue(200, prefs);
  mock.enqueue(200, [PROVIDER]);
  queueQuote(mock, totalToPay);
}

function queueQuote(mock: MockFetch, totalToPay: string): void {
  mock.enqueue(200, []);
  mock.enqueue(200, {
    total_merchant_fee: "0.50",
    net_amount: "10.00",
    merchant_receives: "10.00",
    processing_fee: "0.50",
    total_to_pay: totalToPay,
  });
}

function depositBody(mock: MockFetch): Record<string, unknown> {
  const call = mock.calls.find((item) => item.method === "POST" && item.url.endsWith("/deposits"));
  expect(call).toBeDefined();
  return JSON.parse(call?.body ?? "{}") as Record<string, unknown>;
}

const FORM_OPTIONS = {
  operation: "deposit",
  pollStatus: false,
  amount: "10.00",
  lockAmount: true,
  currency: "USD",
  reference: "ORDER-1",
} as const;

describe("checkout form flow", () => {
  it("reads payment methods and fee bearer from checkout preferences", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, COUNTRIES);
    mock.enqueue(200, { payment_methods: ["mobile_money", "card", "bogus"], fee_bearer: "CUSTOMER" });
    const checkout = createCheckout(sessionWith(mock), FORM_OPTIONS);
    await checkout.loadCountries();
    const state = checkout.getState();
    expect(state.paymentMethods).toEqual(["mobile_money", "card"]);
    expect(state.feeBearer).toBe("CUSTOMER");
  });

  it("defaults to mobile money only when preferences do not list methods", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, COUNTRIES);
    mock.enqueue(200, { primary_color: "#112233" });
    const checkout = createCheckout(sessionWith(mock), FORM_OPTIONS);
    await checkout.loadCountries();
    expect(checkout.getState().paymentMethods).toEqual(["mobile_money"]);
    expect(checkout.getState().feeBearer).toBe("MERCHANT");
  });

  it("only switches to enabled methods and falls back when the active one is disabled", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, COUNTRIES);
    mock.enqueue(200, { payment_methods: ["card", "mainmoney"] });
    const checkout = createCheckout(sessionWith(mock), FORM_OPTIONS);
    await checkout.loadCountries();
    expect(checkout.getState().activeMethod).toBe("card");
    checkout.setMethod("mobile_money");
    expect(checkout.getState().activeMethod).toBe("card");
    checkout.setMethod("mainmoney");
    expect(checkout.getState().activeMethod).toBe("mainmoney");
  });

  it("auto-selects the only provider and fetches the fee quote", async () => {
    const mock = new MockFetch();
    queueLoad(mock, { payment_methods: ["mobile_money"] });
    const checkout = createCheckout(sessionWith(mock), FORM_OPTIONS);
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    const state = checkout.getState();
    expect(state.selectedProvider?.code).toBe("MTN_CD");
    expect(state.fees?.total_to_pay).toBe("10.00");
  });

  it("canPay needs a plausible local number", async () => {
    const mock = new MockFetch();
    queueLoad(mock, {});
    const checkout = createCheckout(sessionWith(mock), FORM_OPTIONS);
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    expect(checkout.getState().canPay).toBe(false);
    checkout.setIdentifier("8123");
    expect(checkout.getState().canPay).toBe(false);
    checkout.setIdentifier("+243812345678");
    expect(checkout.getState().canPay).toBe(true);
  });

  it("pay() sends the E.164 phone once, with the receipt email", async () => {
    const mock = new MockFetch();
    queueLoad(mock, {});
    mock.enqueue(200, { entity: "MTN_CD" });
    queueQuote(mock, "10.00");
    mock.enqueue(200, { status: "SUCCESS", transaction_id: "T1" });
    const checkout = createCheckout(sessionWith(mock), FORM_OPTIONS);
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    checkout.setIdentifier("243812345678");
    checkout.setCustomerEmail("  jane@example.com ");
    await checkout.pay();
    const body = depositBody(mock);
    expect(body.customer_phone).toBe("243812345678");
    expect(body.customer_email).toBe("jane@example.com");
    expect(body.provider_code).toBe("MTN_CD");
    expect(body.amount).toBe("10.00");
    expect(checkout.getState().step).toBe("terminal");
  });

  it("keeps amount as amount when the customer bears the fee and shows what they pay", async () => {
    const mock = new MockFetch();
    queueLoad(mock, { fee_bearer: "CUSTOMER" }, "10.50");
    mock.enqueue(200, { entity: "MTN_CD" });
    queueQuote(mock, "10.50");
    mock.enqueue(200, { status: "SUCCESS" });
    const checkout = createCheckout(sessionWith(mock), FORM_OPTIONS);
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    checkout.setIdentifier("812345678");
    expect(checkout.getState().fees?.total_to_pay).toBe("10.50");
    await checkout.pay();
    const body = depositBody(mock);
    expect(body.amount).toBe("10.00");
    expect(body).not.toHaveProperty("fees");
    expect(body).not.toHaveProperty("customer_email");
  });

  it("sends the merchant fee as fees, in the simulation and in the deposit", async () => {
    const mock = new MockFetch();
    queueLoad(mock, {});
    mock.enqueue(200, { entity: "MTN_CD" });
    queueQuote(mock, "10.50");
    mock.enqueue(200, { status: "SUCCESS" });
    const checkout = createCheckout(sessionWith(mock), { ...FORM_OPTIONS, fees: "1.00" });
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    checkout.setIdentifier("812345678");
    await checkout.pay();
    const simulate = mock.calls.find((call) => call.url.endsWith("/fees/simulate"));
    expect(JSON.parse(simulate?.body ?? "{}").fees).toBe("1.00");
    const body = depositBody(mock);
    expect(body.amount).toBe("10.00");
    expect(body.fees).toBe("1.00");
  });

  it("never sends fees on a payout", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, COUNTRIES);
    mock.enqueue(200, {});
    mock.enqueue(200, [PROVIDER]);
    queueQuote(mock, "10.00");
    mock.enqueue(200, { status: "SUCCESS" });
    const checkout = createCheckout(sessionWith(mock), { ...FORM_OPTIONS, operation: "payout", fees: "1.00" });
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    checkout.setIdentifier("812345678");
    await checkout.goOverview();
    await checkout.confirm();
    const payout = mock.calls.find((call) => call.method === "POST" && call.url.endsWith("/payouts"));
    expect(JSON.parse(payout?.body ?? "{}")).not.toHaveProperty("fees");
    const simulate = mock.calls.find((call) => call.url.endsWith("/fees/simulate"));
    expect(JSON.parse(simulate?.body ?? "{}")).not.toHaveProperty("fees");
  });

  it("returns to the form with the error when the deposit fails", async () => {
    const mock = new MockFetch();
    queueLoad(mock, {});
    mock.enqueue(200, { entity: "MTN_CD" });
    queueQuote(mock, "10.00");
    mock.enqueue(400, { message: "Insufficient funds" });
    const checkout = createCheckout(sessionWith(mock), FORM_OPTIONS);
    await checkout.loadCountries();
    await checkout.selectCountry("CD");
    checkout.setIdentifier("812345678");
    await checkout.pay();
    expect(checkout.getState().step).toBe("details");
    expect(checkout.getState().error).toBe("Insufficient funds");
  });

  it("does nothing on pay() outside the mobile money tab", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, COUNTRIES);
    mock.enqueue(200, { payment_methods: ["card"] });
    const checkout = createCheckout(sessionWith(mock), FORM_OPTIONS);
    await checkout.loadCountries();
    const before = mock.calls.length;
    await checkout.pay();
    expect(mock.calls.length).toBe(before);
  });

  it("switches language and re-translates", async () => {
    const mock = new MockFetch();
    const checkout = createCheckout(sessionWith(mock), FORM_OPTIONS);
    expect(checkout.t("pay")).toBe("Pay");
    checkout.setLocale("fr");
    expect(checkout.getState().locale).toBe("fr");
    expect(checkout.t("pay")).toBe("Payer");
  });
});

describe("flagEmoji", () => {
  it("maps ISO codes and rejects bad input", () => {
    expect(flagEmoji("cd")).toBe("🇨🇩");
    expect(flagEmoji("COD")).toBe("");
    expect(flagEmoji(undefined)).toBe("");
  });
});
