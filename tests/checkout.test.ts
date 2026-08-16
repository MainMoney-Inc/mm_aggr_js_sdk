import { describe, expect, it } from "vitest";

import { ConfigurationException, createSession } from "../packages/core/src/index.ts";
import { createCheckout } from "../packages/checkout/src/index.ts";
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

  it("adds a partner fee to the deposit amount", async () => {
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
    expect(JSON.parse(createCall?.body ?? "{}").amount).toBe("105.00");
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
});
