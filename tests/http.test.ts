import { describe, expect, it } from "vitest";

import { createSession } from "../packages/core/src/index.ts";
import { createHttp } from "../packages/http/src/index.ts";
import { MockFetch } from "./mock-fetch.ts";

describe("createHttp", () => {
  it("unwraps an aggregator envelope and sends a client token", async () => {
    const mock = new MockFetch();
    mock.enqueue(200, { success: true, response_data: { code: "KE" }, message: "ok" });
    const session = createSession({
      merchantBackendUrl: "https://shop.example/payments",
      clientToken: "merchant-session",
      fetch: mock.fetch,
    });
    const http = createHttp(session);
    const result = await http.get<{ code: string }>("/countries");
    expect(result).toEqual({ code: "KE" });
    expect(mock.calls[0]?.headers.Authorization).toBe("Bearer merchant-session");
    expect(mock.calls[0]?.headers["X-API-KEY"]).toBeUndefined();
  });

  it("maps non-2xx bodies to MerchantBackendException", async () => {
    const mock = new MockFetch();
    mock.enqueue(403, { success: false, message: "Forbidden", response_data: { errors: { detail: "nope" } } });
    const session = createSession({ merchantBackendUrl: "https://shop.example/payments", fetch: mock.fetch });
    const http = createHttp(session);
    await expect(http.get("/countries")).rejects.toMatchObject({ statusCode: 403, message: "Forbidden" });
  });
});
