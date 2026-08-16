/** Queued fetch double with request history. */

export type MockCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
};

export class MockFetch {
  readonly calls: MockCall[] = [];
  private readonly queue: Array<{ status: number; body: unknown }> = [];

  enqueue(status: number, body: unknown): void {
    this.queue.push({ status, body });
  }

  fetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers: Record<string, string> = {};
    const raw = init?.headers;
    if (raw !== undefined && !(raw instanceof Headers) && !Array.isArray(raw)) {
      for (const [name, value] of Object.entries(raw)) {
        headers[name] = String(value);
      }
    } else if (raw instanceof Headers) {
      raw.forEach((value, name) => {
        headers[name] = value;
      });
    }
    this.calls.push({
      url,
      method: (init?.method ?? "GET").toUpperCase(),
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    const next = this.queue.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  };
}
