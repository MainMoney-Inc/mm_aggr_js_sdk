# MainMoney JS/TS frontend SDK

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
npm install @mainmoney/js-core @mainmoney/js-http @mainmoney/js-checkout
```

Framework wrappers (optional, same styles):

```bash
npm install @mainmoney/js-react
# or @mainmoney/js-vue / @mainmoney/js-angular
```

Until the packages are on npm, install from GitHub:

```bash
npm install github:MainMoney-Inc/mm_aggr_js_sdk
```

Import the shared stylesheet:

```ts
import "@mainmoney/js-checkout/styles.css";
```

## Quick start

```ts
import { createSession } from "@mainmoney/js-core";
import { createCheckout, mountCheckout } from "@mainmoney/js-checkout";

const session = createSession({
  merchantBackendUrl: "https://your-app.example/payments",
  locale: "en",
});

const checkout = createCheckout(session, {
  operation: "deposit",
  pollStatus: true,
  pollUrl: "https://your-app.example/payments/status",
  pollHeaders: {
    Authorization: `Bearer ${clientToken}`,
  },
  onPartnerFee: async () => ({ amount: "1.00", currency: "KES", label: "App fee" }),
});

await checkout.loadCountries();
mountCheckout(document.getElementById("checkout")!, checkout);
```

`pollUrl` and `pollHeaders` are required when `pollStatus` is true (the
default). They are sent only on status polls so your endpoint does not return
401/403. Set `pollStatus: false` to skip polling; the wizard shows that the
transaction is ongoing and closes.

Your `merchantBackendUrl` must be an endpoint **you** implement with a backend
SDK. This package will not call the aggregator with a merchant API key.

### Merchant backend paths

Relative to `merchantBackendUrl`:

| Method | Path | Proxies |
| --- | --- | --- |
| GET | `/countries` | `GET /manage/general/countries/` |
| GET | `/providers?country=` | `GET /manage/general/financial-entities/` |
| GET | `/match-provider?account_number=&get_lookup=true` | match-provider; show `lookup_data.name` when present |
| GET | `/amount-limits` | amount limits |
| POST | `/fees/simulate` | fee simulation |
| GET | `/checkout-preferences` | branding colors and locale |
| POST | `/deposits` or `/payouts` | create |
| GET | injected `pollUrl` | status payload; uses `pollHeaders` |

### Theme and i18n

Checkout colors (`primary`, `secondary`, `accent`, `background`) come from
`GET /checkout-preferences` (aggregator merchant API) or `createSession({ theme })`.
Copy is English and French (`locale: "en" | "fr"`), overridable via `messages`.

### React / Vue / Angular

```tsx
import { CheckoutWizard } from "@mainmoney/js-react";
<CheckoutWizard checkout={checkout} />
```

```vue
<CheckoutWizard :checkout="checkout" />
```

```html
<mm-checkout-wizard [checkout]="checkout" />
```

## License

Copyright (c) 2026 MainMoney SARL. Licensed under the PolyForm Noncommercial
License 1.0.0. Non-commercial use is allowed. Commercial use requires
permission from MainMoney SARL. See [LICENSE](LICENSE).

Want to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md).
