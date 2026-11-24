# Next.js and server-side rendering

**Purpose.** Run the widget in Next.js (App Router) and any SSR framework: what runs on the server, what only in the
browser, and how to host your merchant backend routes.

**Prerequisites.** [frameworks/README.md](README.md); `@mainmoneyapp/js-react`; for the backend part, the Node.js SDK
(`@mainmoneyapp/sdk`).

## Rules for SSR

- The packages can be imported on the server: nothing touches `window` or `document` at import time, and
  `createCheckout` guards `matchMedia`. But `mountCheckout` needs `document` and the checkout talks to your backend from
  the browser: create and mount the checkout **in the browser** (an effect).
- The `CheckoutWizard` React component renders an empty `<div>` on the server and mounts in an effect, so it is SSR-safe.
- Import `@mainmoneyapp/js-checkout/styles.css` in your root layout (global CSS).
- Mark the component `"use client"`.

## Client component

```tsx
// app/pay/PayClient.tsx
"use client";
import { useEffect, useState } from "react";
import { CheckoutWizard } from "@mainmoneyapp/js-react";
import type { Checkout } from "@mainmoneyapp/js-checkout";
import { buildCheckout, startPayment } from "@/lib/payment";   // see frameworks/README.md; startPayment calls /api/session

export default function PayClient() {
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let instance: Checkout | undefined;
    startPayment()
      .then(async (cfg) => {
        instance = buildCheckout(cfg);
        await instance.loadCountries();
        if (!cancelled) setCheckout(instance); else instance.close();
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => { cancelled = true; instance?.close(); };
  }, []);
  if (error) return <p role="alert">{error}</p>;
  return checkout ? <CheckoutWizard checkout={checkout} variant="embedded" /> : <p>Starting checkout…</p>;
}
```

```tsx
// app/layout.tsx
import "@mainmoneyapp/js-checkout/styles.css";
```

```tsx
// app/pay/page.tsx (a server component may render the client component)
import PayClient from "./PayClient";
export default function Page() { return <PayClient />; }
```

## Hosting the merchant routes in Next.js (same origin: no CORS)

Put the backend SDK in route handlers and use a relative `merchantBackendUrl` (`"/api/payments"`). The browser then calls
your own origin and needs no CORS configuration.

```ts
// app/api/session/route.ts
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { saveCheckoutSession } from "@/lib/sessions";   // your store

export async function POST() {
  const order = await createOrderForCurrentUser();       // your code
  const token = randomBytes(24).toString("hex");
  await saveCheckoutSession({ token, ...order });
  return NextResponse.json({
    merchantBackendUrl: "/api/payments",
    clientToken: token,
    pollUrl: "/api/payments/status",
    pollHeaders: { Authorization: `Bearer ${token}` },
    amount: order.amount, currency: order.currency, reference: order.reference, lockAmount: true,
  });
}
```

```ts
// app/api/payments/[...route]/route.ts
import { Client } from "@mainmoneyapp/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { findCheckoutSession } from "@/lib/sessions";

const client = new Client({ clientId: process.env.MM_CLIENT_ID!, secret: process.env.MM_API_SECRET!, test: true });

async function handle(req: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  const session = await findCheckoutSession(req.headers.get("authorization")?.replace(/^Bearer /i, ""));
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const route = (await params).route.join("/");
  const q = Object.fromEntries(req.nextUrl.searchParams);
  try {
    if (req.method === "GET" && route === "countries") return NextResponse.json(await client.countries.list());
    if (req.method === "GET" && route === "checkout-preferences") return NextResponse.json(await client.checkoutPreferences.get());
    if (req.method === "GET" && route === "providers") return NextResponse.json(await client.providers.list(q));
    if (req.method === "GET" && route === "match-provider")
      return NextResponse.json(await client.customers.matchProvider(q.account_number ?? "", q.get_lookup === "true", q.operation_type));
    if (req.method === "GET" && route === "amount-limits") return NextResponse.json(await client.amountLimits.list(q));
    if (req.method === "POST" && route === "fees/simulate") return NextResponse.json(await client.fees.simulate(await req.json()));
    if (req.method === "POST" && route === "deposits") {
      const body = { ...(await req.json()), reference: session.reference, amount: session.amount, currency: session.currency };
      return NextResponse.json(await client.deposits.create(body, `mm-${session.token}`));
    }
    if (req.method === "POST" && route === "payouts") {
      const body = { ...(await req.json()), reference: session.reference, amount: session.amount, currency: session.currency };
      return NextResponse.json(await client.payouts.create(body, session.reference));
    }
    if (req.method === "GET" && route === "status")
      return NextResponse.json(await client.status.check(q.operation === "payout" ? "payout" : "deposit", session.reference));
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode ?? 400;
    return NextResponse.json({ message: "Payment request failed" }, { status: status >= 400 ? status : 400 });
  }
  return NextResponse.json({ message: "Unknown route" }, { status: 404 });
}
export { handle as GET, handle as POST };
```

(`params` is a promise in recent Next.js versions; adapt to yours.) The `catch` returns a fixed message because the widget
shows `message` to the customer and raw exception text must not reach them; log the real error on the server.

## Error cases

| Symptom | Cause |
| --- | --- |
| `document is not defined` | `mountCheckout` or the wrapper's mount ran during SSR: keep it in a client component/effect |
| Hydration warning | The wrapper renders an empty `<div>` on both sides; if it appears, a `Checkout` was created during render |
| Unstyled widget | CSS not imported in the root layout |
| CORS errors | You used an absolute URL to another origin; use a relative `merchantBackendUrl` or configure CORS ([troubleshooting.md](../troubleshooting.md)) |
