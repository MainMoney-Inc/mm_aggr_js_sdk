import { describe, expect, it } from "vitest";

import {
  ConfigurationException,
  CurrencyMismatchException,
  addMoney,
  createSession,
  extractCustomerName,
  joinUrl,
} from "../packages/core/src/index.ts";

describe("createSession", () => {
  it("rejects an empty merchant backend URL", () => {
    expect(() => createSession({ merchantBackendUrl: "  " })).toThrow(ConfigurationException);
  });

  it("keeps default paths and allows overrides", () => {
    const session = createSession({
      merchantBackendUrl: "https://shop.example/payments",
      paths: { deposits: "/custom-deposits" },
    });
    expect(session.paths.countries).toBe("/countries");
    expect(session.paths.deposits).toBe("/custom-deposits");
  });
});

describe("money", () => {
  it("adds amounts in the same currency", () => {
    expect(addMoney({ amount: "10.50", currency: "KES" }, { amount: "1.25", currency: "KES" })).toEqual({
      amount: "11.75",
      currency: "KES",
    });
  });

  it("refuses mixed-currency addition", () => {
    expect(() => addMoney({ amount: "1", currency: "KES" }, { amount: "1", currency: "UGX" })).toThrow(
      CurrencyMismatchException,
    );
  });
});

describe("extractCustomerName", () => {
  it("returns lookup_data.name when present", () => {
    expect(extractCustomerName({ lookup_data: { name: "Jane Doe" } })).toBe("Jane Doe");
  });

  it("hides null or empty names", () => {
    expect(extractCustomerName({ lookup_data: { name: null } })).toBeNull();
    expect(extractCustomerName({ name: "  " })).toBeNull();
  });
});

describe("joinUrl", () => {
  it("joins a base URL and path without duplicating slashes", () => {
    expect(joinUrl("https://shop.example/payments/", "/countries")).toBe("https://shop.example/payments/countries");
  });
});
