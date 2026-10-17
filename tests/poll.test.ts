import { describe, expect, it } from "vitest";

import { pollStatus } from "../packages/checkout/src/poll.ts";

type Step = { status: number; body: unknown } | "network";

function scriptedFetch(steps: Step[]): typeof fetch {
  let index = 0;
  return (async () => {
    const step = steps[Math.min(index, steps.length - 1)];
    index += 1;
    if (step === "network") {
      throw new TypeError("NetworkError when attempting to fetch resource.");
    }
    return new Response(JSON.stringify(step.body), { status: step.status });
  }) as typeof fetch;
}

const base = { pollUrl: "https://shop.example/status", pollHeaders: {}, reference: "R1", operation: "deposit", intervalMs: 1 };

describe("pollStatus", () => {
  it("keeps polling through network errors and 5xx, then resolves on a terminal status", async () => {
    const changes: boolean[] = [];
    const result = await pollStatus({
      ...base,
      fetchImpl: scriptedFetch(["network", "network", { status: 502, body: {} }, { status: 200, body: { status: "PENDING" } }, { status: 200, body: { status: "SUCCESS" } }]),
      onConnectionChange: (lost) => changes.push(lost),
    });
    expect(result.status).toBe("SUCCESS");
    expect(changes).toEqual([true, false]);
  });

  it("returns a failed payment status as a normal terminal result", async () => {
    const result = await pollStatus({ ...base, fetchImpl: scriptedFetch([{ status: 200, body: { status: "FAILED" } }]) });
    expect(result.status).toBe("FAILED");
  });

  it("reports responses and stops with the abort signal", async () => {
    const controller = new AbortController();
    let responses = 0;
    const promise = pollStatus({
      ...base,
      fetchImpl: scriptedFetch([{ status: 200, body: { status: "PENDING" } }]),
      signal: controller.signal,
      onResponse: () => {
        responses += 1;
        controller.abort();
      },
    });
    await expect(promise).rejects.toBeDefined();
    expect(responses).toBe(1);
  });
});
