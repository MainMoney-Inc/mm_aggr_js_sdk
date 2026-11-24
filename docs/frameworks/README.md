# Framework guides

**Purpose.** One page per environment, all following the same rules. Pick yours:

| Environment | Guide | Package |
| --- | --- | --- |
| Vanilla JS / TypeScript | [vanilla.md](vanilla.md) | `@mainmoneyapp/js-checkout` |
| React 18+ | [react.md](react.md) | `@mainmoneyapp/js-react` |
| Vue 3 | [vue.md](vue.md) | `@mainmoneyapp/js-vue` |
| Angular 17.2+ | [angular.md](angular.md) | `@mainmoneyapp/js-angular` |
| Next.js / SSR | [nextjs.md](nextjs.md) | React wrapper in a client component |

**Prerequisites.** A backend implementing [the path contract](../backend-contract.md) and a session endpoint
([session.md](../session.md)). Install:

```bash
npm install @mainmoneyapp/js-core @mainmoneyapp/js-http @mainmoneyapp/js-checkout
npm install @mainmoneyapp/js-react     # or js-vue / js-angular
```

## Rules that apply everywhere

1. **Create the `Checkout` once per payment attempt** and pass the same instance to the wrapper. Creating one in a render,
   a template expression or a getter restarts the widget at the first step.
2. **Await `loadCountries()` before showing the widget** (optional but avoids an empty first paint). It never throws; check
   `getState().error`.
3. **Call `checkout.close()` when you discard a `Checkout`** (route change, new session, component destroyed). It stops
   polling and removes the `prefers-color-scheme` listener. The React, Vue and Angular wrappers unmount the DOM and
   unsubscribe, but **do not call `close()`** for you.
4. **Import the stylesheet once:** `import "@mainmoneyapp/js-checkout/styles.css"`.
5. **Browser only:** `mountCheckout` needs `document`. Never call it on the server.
6. The merchant backend decides amount, currency and reference; never take them from the URL or from the user.

## What the wrappers expose

| Capability | React `CheckoutWizard` | Vue `CheckoutWizard` | Angular `<mm-checkout-wizard>` | `mountCheckout` |
| --- | --- | --- | --- | --- |
| `checkout` | prop | prop | required input | argument |
| `logoUrl` | prop | prop | input | option |
| `variant` | prop | prop | input (default `"default"`) | option |
| `colorScheme` (live) | prop | prop | input (default `"auto"`) | `checkout.setColorScheme()` |
| `layout`, `defaultCountry`, `links` | **not exposed**: call `mountCheckout` yourself | **not exposed** | inputs | options |

Where a wrapper lacks an option, mount the widget yourself in the framework's lifecycle hook (examples in each guide).

## Shared helper used by the guides

Your own function that asks your session endpoint and returns what the browser needs:

```ts
export type PaySession = {
  merchantBackendUrl: string; clientToken: string; pollUrl: string; pollHeaders: Record<string, string>;
  amount: string; currency: string; reference: string; lockAmount?: boolean; locale?: "en" | "fr";
};
export async function startPayment(): Promise<PaySession> {
  const r = await fetch("/session", { method: "POST", credentials: "include" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? `Session failed (${r.status})`);
  return r.json();
}
```

```ts
import { createSession } from "@mainmoneyapp/js-core";
import { createCheckout } from "@mainmoneyapp/js-checkout";

export function buildCheckout(cfg: PaySession) {
  return createCheckout(
    createSession({ merchantBackendUrl: cfg.merchantBackendUrl, clientToken: cfg.clientToken, locale: cfg.locale ?? "en" }),
    {
      operation: "deposit",
      pollUrl: cfg.pollUrl,
      pollHeaders: cfg.pollHeaders,
      amount: cfg.amount,
      currency: cfg.currency,
      lockAmount: cfg.lockAmount === true,
      reference: cfg.reference,
    },
  );
}
```

## Error cases (all frameworks)

| Symptom | Fix |
| --- | --- |
| Widget resets on each render | Rule 1 |
| Polling continues after leaving the page | Rule 3 |
| Nothing renders and no error | Missing `styles.css`, or the host element has zero size |
| Dark mode does not follow your app theme | Bind `colorScheme` ([theming.md](../theming.md#dark-mode)) |
