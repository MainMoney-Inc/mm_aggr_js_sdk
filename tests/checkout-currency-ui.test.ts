// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { createSession } from "../packages/core/src/index.ts";
import { createCheckout, mountCheckout } from "../packages/checkout/src/index.ts";
import { marketCountryCode } from "../packages/checkout/src/currency-dropdown.ts";
import { MockFetch } from "./mock-fetch.ts";

const PROVIDER = {
  code: "MPESA_CD",
  name: "M-Pesa",
  entity_type: "MOBILE_MONEY",
  country_code: "CD",
  currency_code: "CDF",
  accepted_currencies: ["CDF", "KES", "USD"],
  logo: null,
};

function fees(toCurrency: string, converted: string) {
  return {
    total_merchant_fee: "0",
    net_amount: converted,
    merchant_receives: converted,
    processing_fee: "1.00",
    total_to_pay: converted,
    quote: { from_currency: "EUR", to_currency: toCurrency, rate: "2800", converted_amount: converted },
  };
}

async function setup(provider: Record<string, unknown>, feeBody: Record<string, unknown>) {
  const mock = new MockFetch();
  mock.enqueue(200, [{ code: "CD", name: "DR Congo", phone_code: "243", flag: null }]);
  mock.enqueue(200, {});
  mock.enqueue(200, [provider]);
  for (let i = 0; i < 4; i += 1) {
    mock.enqueue(200, []);
    mock.enqueue(200, feeBody);
  }
  const session = createSession({ merchantBackendUrl: "https://shop.example/p", fetch: mock.fetch });
  const checkout = createCheckout(session, { operation: "deposit", pollStatus: false, amount: "10", currency: "EUR" });
  const el = document.createElement("div");
  document.body.append(el);
  mountCheckout(el, checkout);
  await checkout.loadCountries();
  await new Promise((resolve) => setTimeout(resolve, 30));
  return { checkout, el, mock };
}

describe("currency picker", () => {
  it("offers only the provider's markets, with flag and code", async () => {
    const { el } = await setup(PROVIDER, fees("CDF", "28000.00"));
    const codes = [...el.querySelectorAll<HTMLElement>(".mm-dropdown-option")].map((item) => item.dataset.code);
    expect(codes).toEqual(["CDF", "KES", "USD"]);
    expect(el.querySelector(".mm-dropdown-button .mm-flag")?.textContent).toBe("\u{1F1E8}\u{1F1E9}");
    expect(el.querySelector("select.mm-select")).toBeNull();
  });

  it("switches the pay currency from the dropdown", async () => {
    const { checkout, el } = await setup(PROVIDER, fees("KES", "1500.00"));
    el.querySelector<HTMLElement>('.mm-dropdown-option[data-code="KES"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(checkout.getState()).toMatchObject({ currency: "EUR", payCurrency: "KES" });
  });

  it("shows the amount and its conversion into a single provider currency", async () => {
    const single = { ...PROVIDER, accepted_currencies: ["CDF"] };
    const { el } = await setup(single, fees("CDF", "28000.00"));
    expect(el.querySelector(".mm-dropdown")).toBeNull();
    const text = el.querySelector(".mm-fee-box")?.textContent ?? "";
    expect(text).toContain("Amount");
    expect(text).toContain("Converted amount");
    expect(text).toMatch(/€10\.00/);
    expect(text).toMatch(/28,000\.00/);
  });

  it("maps currencies to market countries", () => {
    expect(marketCountryCode("KES", undefined)).toBe("KE");
    expect(marketCountryCode("USD", undefined)).toBe("US");
    expect(marketCountryCode("XOF", undefined)).toBeUndefined();
  });
});
