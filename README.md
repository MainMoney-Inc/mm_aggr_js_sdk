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

```ts
import { createSession } from "@mainmoneyapp/js-core";
import { createCheckout, mountCheckout } from "@mainmoneyapp/js-checkout";

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

Store plugins can pass `amount` and `lockAmount: true` so the wizard cannot
edit a cart or order total. Omit `lockAmount` for open amounts (for example a
donation shortcode).
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
| POST | `/deposits` | create deposit (the Python SDK's `mm_aggr.checkout_proxy` implements every route here) |
| POST | `/deposits/validate` | validate a deposit payment |
| POST | `/payouts` | create payout |
| GET | injected `pollUrl` | status payload; uses `pollHeaders` |

Phone numbers are always sent as `<dial code><national number>` (`987805910`, `0987805910` and
`+243987805910` with +243 selected all become `243987805910`), also on `match-provider` before a provider is
known. Only bank account or card identifiers of an already selected, non-phone provider are sent raw. Changing
the country repeats the lookup for a number already typed.

### CORS: what your backend must allow

The widget calls `merchantBackendUrl` from the browser, so that backend must answer the CORS preflight
(`OPTIONS`) for your site's origin. Allow exactly:

| Header | Value |
| --- | --- |
| `Access-Control-Allow-Origin` | your site origin (e.g. `https://shop.example`), not `*` when you send `Authorization` |
| `Access-Control-Allow-Methods` | `GET, POST, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type, Authorization` (add `Idempotency-Key` only if you set `idempotencyHeader: true`) |

Express: `app.use(cors({ origin: ["https://shop.example"], allowedHeaders: ["Content-Type", "Authorization"] }))`.
FastAPI: `CORSMiddleware(allow_origins=[...], allow_methods=["*"], allow_headers=["Content-Type", "Authorization"])`.
Laravel: `config/cors.php` -> `allowed_origins`, `allowed_headers`. Note that `*` in `Access-Control-Allow-Headers`
does not cover `Authorization`; list it explicitly.

A CORS error on `POST /deposits` while the lookups (`GET`) work almost always means the preflight rejects a request
header or the origin of the page that mounts the widget (check `http://` vs `https://`, `localhost` vs `127.0.0.1`
and the port).

### Troubleshooting

- **Provider match fires repeatedly or flickers**: update to 0.2.0. The lookup runs once the customer stops typing
  (600 ms) or leaves the field, and identical requests are shared.
- **Widget restarts from the first step in Angular/React/Vue**: you created a new `Checkout` on every render. Create
  it once (`ngOnInit`, `useMemo`/`useRef`, a service) and pass the same instance.
- **Pay button stays disabled**: it needs a selected country, provider, an amount above 0, a currency and a phone
  number of 7 to 12 national digits.

### Currency

`currency` is the **cart currency** and never changes: `createCheckout({ currency: "USD" })` keeps `USD` as the
amount's currency while `payCurrency` follows the chosen provider through a `payment_currency` fee quote (a
USD cart with a CDF-only provider sends `currency=USD`, `payment_currency=CDF`). Set `currency` and
`lockCurrency` once in `createSession({ currency, lockCurrency })` (e.g. from your merchant session payload);
`createCheckout` uses them as defaults and its own options win. Your backend must still force amount and
currency from its own order.

### Theme and i18n

Checkout colors (`primary`, `secondary`, `accent`, `background`) come from
`GET /checkout-preferences` (aggregator merchant API) or `createSession({ theme })`.

#### Dark mode and live switching

```ts
const checkout = createCheckout(session, { operation: "deposit", colorScheme: "auto" }); // "light" | "dark" | "auto"
checkout.setColorScheme("dark"); // flips `data-mm-theme`; the form is not re-rendered (focus and value kept)
```

- `colorScheme` defaults to `auto`: the widget follows `prefers-color-scheme` live (`matchMedia`) and
  stops listening on `checkout.close()`. `CheckoutSnapshot.colorScheme` is the selection,
  `resolvedColorScheme` is `light`/`dark`.
- It can also be your own signal: `{ get(): ColorScheme; subscribe(cb): () => void }`.
- React / Vue: `<CheckoutWizard colorScheme={scheme} />`. Angular: `<mm-checkout-wizard [colorScheme]="scheme()" />`
  (signal input; needs Angular 17.2+).
- The root element carries `data-mm-theme="light|dark|auto"` and `data-mm-variant`.

#### Layout

The widget fills its parent (`width: 100%`, no `max-width`). `mountCheckout(el, checkout, { variant: "embedded" })`
drops the surface, padding, radius and shadow for use inside a host modal or card. Provider tiles and the fee box
reflow with container queries (320px and up).

#### CSS variables

Set on the mount element (or any ancestor) to override. Dark values are defined for
`[data-mm-theme="dark"]` and for `auto` under `prefers-color-scheme: dark`; dark text pairs keep WCAG AA.

| Variable | Purpose | Light default |
| --- | --- | --- |
| `--mm-color-primary` / `-secondary` / `-accent` | brand colours (merchant theme) | `#ff3366` / `#5f5e5e` / `#b90040` |
| `--mm-color-background` | merchant page background (light surface) | `#f8f9fb` |
| `--mm-color-surface` | card surface | the background |
| `--mm-color-ink` | main text | `#170f2e` |
| `--mm-color-muted` | secondary text, labels | `#5b5f66` |
| `--mm-color-line` | borders, dividers | `#cfd2d6` |
| `--mm-color-input-bg` | inputs, select, dial code | `#ffffff` |
| `--mm-color-error` / `--mm-color-success` | error and success text | `#b90040` / `#0b7a43` |
| `--mm-color-tile-bg` / `-tile-ink` | provider tiles (stay light so logos read) | `#ffffff` / `#191c1e` |
| `--mm-color-fee-bg`, `-surface-alt`, `-notice-bg`, `-notice-ink`, `-on-primary`, `-on-ink`, `-disabled`, `-disabled-ink` | fee box, tabs/secondary buttons, slow/error notices, button text, disabled pay | see `styles.css` |
| `--mm-max-width` | cap the card width | `none` |
| `--mm-padding` | card padding | `1.5rem` |
| `--mm-radius` | card radius | `16px` |

Copy is English and French (`locale: "en" | "fr"`), overridable via `messages`.

### React / Vue / Angular

```tsx
import { CheckoutWizard } from "@mainmoneyapp/js-react";
<CheckoutWizard checkout={checkout} />
```

```vue
<CheckoutWizard :checkout="checkout" />
```

```html
<mm-checkout-wizard [checkout]="checkout" [colorScheme]="scheme()" />
```

React and Vue take the same `colorScheme` and `variant` props.

## License

Copyright (c) 2026 MainMoney SARL. Licensed under the MIT License. See [LICENSE](LICENSE).

## Examples

Runnable UIs live in [examples/](examples/) (vanilla JS, React, Vue, Angular).
Point `VITE_MERCHANT_BACKEND_URL` at a Python, PHP, or Node backend example.

Want to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md).
