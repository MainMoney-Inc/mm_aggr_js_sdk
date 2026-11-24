# MainMoney JS/TS frontend SDK

[![npm](https://img.shields.io/npm/v/@mainmoneyapp/js-core)](https://www.npmjs.com/org/mainmoneyapp) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Browser TypeScript modules for a branded checkout wizard. Use this package from
**Angular, React, Next.js, Vue, or vanilla TypeScript/JavaScript**.

This is not a backend client. You **must** also install **one** of:

- [PHP SDK](https://github.com/MainMoney-Inc/mm_aggr_php_sdk)
- [Python SDK](https://github.com/MainMoney-Inc/mm_aggr_python_sdk)
- [Node.js SDK](https://github.com/MainMoney-Inc/mm_aggr_nodejs_sdk)

The frontend talks to **your** server. Never put merchant API keys in the
browser.

## Requirements

- TypeScript 5+ (or JavaScript with the published `.d.ts` types)
- A backend that uses a MainMoney backend SDK
- Last two versions of Chrome, Firefox, Safari, and Edge

## Install

```bash
npm install @mainmoneyapp/js-core @mainmoneyapp/js-http @mainmoneyapp/js-checkout
```

Framework wrappers (optional, same styles):

```bash
npm install @mainmoneyapp/js-react
# or @mainmoneyapp/js-vue / @mainmoneyapp/js-angular
```

Import the shared stylesheet:

```ts
import "@mainmoneyapp/js-checkout/styles.css";
```

## Quick start

Your backend first mints a session (amount, currency and reference come from **your** order) and implements the
[routes the widget calls](docs/backend-contract.md). Then, in the browser:

```ts
import { createSession } from "@mainmoneyapp/js-core";
import { createCheckout, mountCheckout } from "@mainmoneyapp/js-checkout";
import "@mainmoneyapp/js-checkout/styles.css";

// 1. Ask YOUR server for a checkout session (see docs/session.md)
const cfg = await (await fetch("/session", { method: "POST" })).json();

// 2. Create the Checkout ONCE
const session = createSession({
  merchantBackendUrl: cfg.merchantBackendUrl, // e.g. https://your-app.example/payments
  clientToken: cfg.clientToken,               // opaque token you minted; never an API key
  locale: "en",
});
const checkout = createCheckout(session, {
  operation: "deposit",
  pollUrl: cfg.pollUrl,                       // required while pollStatus is true (the default)
  pollHeaders: cfg.pollHeaders,
  amount: cfg.amount,
  currency: cfg.currency,
  lockAmount: true,                           // for a cart or order total; omit for open amounts
  reference: cfg.reference,
});

// 3. Load countries and mount
await checkout.loadCountries();
mountCheckout(document.getElementById("checkout")!, checkout);
```

`pollUrl` and `pollHeaders` are required when `pollStatus` is true (the default). They are sent only on status polls.
Set `pollStatus: false` to skip polling; the wizard then shows that the transaction is ongoing.

Your `merchantBackendUrl` must be an endpoint **you** implement with a backend SDK. This package never calls the
aggregator and never sends a merchant API key.

React, Vue and Angular wrappers take the same `Checkout`:

```tsx
<CheckoutWizard checkout={checkout} />                 // @mainmoneyapp/js-react
```

```vue
<CheckoutWizard :checkout="checkout" />                <!-- @mainmoneyapp/js-vue -->
```

```html
<mm-checkout-wizard [checkout]="checkout" />           <!-- @mainmoneyapp/js-angular -->
```

Create the `Checkout` once and pass the same instance; a new one restarts the widget.

## Documentation

Full guides are in [docs/](docs/README.md):

- [Architecture](docs/architecture.md) and [security notes](docs/security.md)
- [Session creation and options](docs/session.md)
- [Merchant backend path contract](docs/backend-contract.md) (every route, PHP/Python/Node SDK mapping)
- [Deposit flow](docs/deposit-flow.md), [payout flow](docs/payout-flow.md), [card and MainMoney tabs](docs/payment-methods.md)
- [Payment links](docs/payment-links.md) and [platforms/sellers (MainMoney Rails)](docs/platform-sellers.md)
- [Theming, i18n, dark mode, layout](docs/theming.md)
- [Snapshot, methods, events reference](docs/reference.md)
- [CORS and troubleshooting](docs/troubleshooting.md)
- Framework guides: [vanilla](docs/frameworks/vanilla.md), [React](docs/frameworks/react.md),
  [Vue](docs/frameworks/vue.md), [Angular](docs/frameworks/angular.md), [Next.js/SSR](docs/frameworks/nextjs.md)

## License

Copyright (c) 2026 MainMoney SARL. Licensed under the MIT License. See [LICENSE](LICENSE).

## Examples

Runnable UIs live in [examples/](examples/) (vanilla JS, React, Vue, Angular).
Point `VITE_MERCHANT_BACKEND_URL` at a Python, PHP, or Node backend example.

Want to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md).
