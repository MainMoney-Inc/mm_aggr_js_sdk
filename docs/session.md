# Session creation

**Purpose.** Show how a checkout starts: the endpoint your backend exposes, what it returns, and how the browser turns
that into a `Session` and a `Checkout`. Also lists every option of `createSession` and `createCheckout`.

**Prerequisites.** [architecture.md](architecture.md); the backend routes of [backend-contract.md](backend-contract.md).

## 1. Your session endpoint (backend)

The SDK does not define this endpoint: it is **your** route (the runnable examples call it `POST /session`). It must
create the order and answer with what the browser needs. Minimal Node/Express sketch (the same shape works with PHP or
Python):

```ts
import { randomBytes } from "node:crypto";

app.post("/session", requireLoggedInCustomer, (req, res) => {
  const order = createOrderFromCart(req.user); // amount + currency come from YOUR data, not from the request body
  const clientToken = randomBytes(24).toString("hex");
  saveCheckoutSession({ token: clientToken, orderId: order.id, reference: order.reference, amount: order.amount,
    currency: order.currency, operation: "deposit" });
  const base = `${req.protocol}://${req.get("host")}`;
  res.json({
    merchantBackendUrl: `${base}/payments`,          // the prefix of the routes in backend-contract.md
    clientToken,                                      // opaque; maps back to the saved record
    pollUrl: `${base}/payments/status`,               // GET, see deposit-flow.md
    pollHeaders: { Authorization: `Bearer ${clientToken}` },
    amount: order.amount,                             // decimal string, e.g. "25.00"
    currency: order.currency,                         // e.g. "USD"
    lockAmount: true,
    reference: order.reference,
    locale: "en",
  });
});
```

Rules:

- Amounts are **decimal strings** (`"25.00"`), never floats.
- `reference` must be unique per attempt on your aggregator application. A failed deposit keeps its reference forever,
  so see [deposit-flow.md](deposit-flow.md#retry) before reusing one.
- Every `/payments/*` route must resolve the `Authorization: Bearer <clientToken>` to the saved record and overwrite
  `reference`, `amount` and `currency` from it before calling the backend SDK.
- Answer 401 for an unknown or expired token. Send safe, short `message` texts: the widget shows `message` to the
  customer.

## 2. Browser: `createSession`

```ts
import { createSession } from "@mainmoneyapp/js-core";

const cfg = await fetch("/session", { method: "POST", credentials: "include" }).then((r) => r.json());

const session = createSession({
  merchantBackendUrl: cfg.merchantBackendUrl,
  clientToken: cfg.clientToken,
  locale: cfg.locale ?? "en",
  currency: cfg.currency,      // optional default for createCheckout
});
```

`createSession` throws `ConfigurationException` ("merchantBackendUrl is required") when the URL is empty.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `merchantBackendUrl` | `string` | required | Base URL of your routes. Joined with the path (`joinUrl`): trailing and leading slashes are normalised |
| `clientToken` | `string` | none | Sent as `Authorization: Bearer <clientToken>` on every call to `merchantBackendUrl`. Not sent on status polls |
| `paths` | `Partial<MerchantPaths>` | see below | Override individual route paths |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Inject a `fetch` (tests, custom credentials policy). Used for merchant calls **and** for polling |
| `timeoutMs` | `number` | `30000` | Per-request timeout of merchant calls (not of the poll loop) |
| `locale` | `"en" \| "fr"` | `"en"` | Default language |
| `messages` | `Record<string,string>` | `{}` | Copy overrides, see [theming.md](theming.md#messages-and-i18n) |
| `theme` | `Partial<CheckoutTheme>` | defaults | `primary`, `secondary`, `accent`, `background` |
| `currency` | `string` | none | Default cart currency for `createCheckout` |
| `lockCurrency` | `boolean` | `false` | Default for `createCheckout({ lockCurrency })` |

Default paths (`DEFAULT_PATHS`), override any of them with `paths`:

| Key | Default |
| --- | --- |
| `countries` | `/countries` |
| `providers` | `/providers` |
| `matchProvider` | `/match-provider` |
| `amountLimits` | `/amount-limits` |
| `feesSimulate` | `/fees/simulate` |
| `checkoutPreferences` | `/checkout-preferences` |
| `deposits` | `/deposits` |
| `validatePayment` | `/deposits/validate` (declared but the widget never calls it) |
| `payouts` | `/payouts` |

A path that starts with `http://` or `https://` is used as is (it can point to another host).

## 3. Browser: `createCheckout`

```ts
import { createCheckout, mountCheckout } from "@mainmoneyapp/js-checkout";
import "@mainmoneyapp/js-checkout/styles.css";

const checkout = createCheckout(session, {
  operation: "deposit",
  pollUrl: cfg.pollUrl,
  pollHeaders: cfg.pollHeaders,
  amount: cfg.amount,
  lockAmount: cfg.lockAmount === true,
  reference: cfg.reference,
});
await checkout.loadCountries();
mountCheckout(document.getElementById("checkout")!, checkout);
```

Create the `Checkout` **once per payment attempt**. A new instance restarts the widget at the first step.

`createCheckout` throws `ConfigurationException` when `pollStatus` is not `false` and `pollUrl` is missing/blank or
`pollHeaders` is `undefined`.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `operation` | `"deposit" \| "payout"` | required | Collect money or send money ([deposit-flow.md](deposit-flow.md), [payout-flow.md](payout-flow.md)) |
| `pollStatus` | `boolean` | `true` | `false` skips polling: after a non-terminal create the widget shows "Transaction ongoing" |
| `pollUrl` | `string` | required if polling | Absolute or relative URL of your status route |
| `pollHeaders` | `Record<string,string>` | required if polling | Headers sent **only** on polls (use `{}` if none are needed) |
| `pollIntervalMs` | `number` | `1000` | Delay between polls |
| `slowNoticeAfterMs` | `number` | `30000` | Sets `slow: true` (the widget shows a reassurance text); polling continues |
| `reference` | `string` | `crypto.randomUUID()` | Merchant reference of the payment. `randomUUID` needs a secure context (HTTPS or localhost) |
| `amount` | `string` | `""` | Pre-filled amount |
| `lockAmount` | `boolean` | `false` | The customer cannot edit the amount and `setAmount` is ignored |
| `currency` | `string` | session's | Cart currency; fixes the amount currency, see [deposit-flow.md](deposit-flow.md#currencies-and-quotes) |
| `lockCurrency` | `boolean` | session's | The customer always pays in `currency` |
| `fees` | `string` | none | Static merchant fee added on top of `amount` (deposits only) |
| `customerEmail` | `string` | `""` | Pre-fills the optional receipt email |
| `onPartnerFee` | `(snapshot) => Promise<PartnerFee \| null>` | none | Dynamic merchant fee hook |
| `onValidateBalance` | `(snapshot) => Promise<{ ok, message? }>` | none | Payout pre-check hook |
| `onRetry` | `() => void \| Promise<void>` | none | Host-managed retry (new server session) |
| `idempotencyHeader` | `boolean` | `false` | Also send `Idempotency-Key` on deposit/payout (needs CORS allow-list) |
| `locale`, `messages`, `theme`, `colorScheme` | | | See [theming.md](theming.md) |
| `http` | `MerchantHttp` | `createHttp(session)` | Replace the HTTP client (tests) |

## Error cases

| Situation | Result |
| --- | --- |
| Empty `merchantBackendUrl` | `createSession` throws `ConfigurationException` |
| Polling on, no `pollUrl` or no `pollHeaders` | `createCheckout` throws `ConfigurationException` |
| Session endpoint answers non-2xx | Your own code: show an error and do not create a `Checkout` |
| `loadCountries()` fails (401, CORS, 5xx) | Does not throw. `getState().error` holds the message and the widget shows it |

Next: [backend-contract.md](backend-contract.md).
