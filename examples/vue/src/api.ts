export type Product = {
  id: number;
  sku: string;
  name: string;
  description: string;
  price: string;
  currency: string;
};

export type Order = {
  id: number;
  reference: string;
  product_id: number;
  amount: string;
  currency: string;
  status: string;
};

export type Transfer = {
  id: number;
  reference: string;
  amount: string;
  currency: string;
  destination: string;
  status: string;
};

export type CheckoutConfig = {
  merchantBackendUrl: string;
  clientToken: string;
  pollUrl: string;
  pollHeaders: Record<string, string>;
  locale?: "en" | "fr";
  amount?: string | null;
  currency?: string | null;
  lockAmount?: boolean;
  reference?: string;
  operation?: "deposit" | "payout";
};

export function backendUrl(): string {
  return (import.meta.env.VITE_MERCHANT_BACKEND_URL as string | undefined)?.replace(/\/+$/, "") ?? "http://127.0.0.1:8000";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? `Request failed (${response.status})`);
  }
  return payload;
}

export function listProducts(): Promise<Product[]> {
  return request("/products");
}

export function createPaySession(productId: number): Promise<CheckoutConfig> {
  return request("/session", { method: "POST", body: JSON.stringify({ product_id: productId }) });
}

export function createPayoutSession(amount: string, currency: string): Promise<CheckoutConfig> {
  return request("/session", {
    method: "POST",
    body: JSON.stringify({ operation: "payout", amount, currency, lockAmount: true }),
  });
}

export function listOrders(): Promise<Order[]> {
  return request("/orders");
}

export function refundOrder(id: number): Promise<unknown> {
  return request(`/orders/${id}/refund`, { method: "POST" });
}

export function listTransfers(): Promise<Transfer[]> {
  return request("/transfers");
}
