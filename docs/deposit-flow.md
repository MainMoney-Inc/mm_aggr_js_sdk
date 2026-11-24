# Deposit flow, end to end

**Purpose.** What the widget does from mount to a terminal status when `operation: "deposit"` (the customer pays you),
and every option and error on the way.

**Prerequisites.** [session.md](session.md) (a `Session`, a `Checkout`, `loadCountries()` done) and the routes of
[backend-contract.md](backend-contract.md). Deposits use the single-page **form** layout by default.

## Minimal copy-paste

```ts
import { createSession } from "@mainmoneyapp/js-core";
import { createCheckout, mountCheckout } from "@mainmoneyapp/js-checkout";
import "@mainmoneyapp/js-checkout/styles.css";

const cfg = await (await fetch("/session", { method: "POST" })).json(); // see session.md

const checkout = createCheckout(createSession({ merchantBackendUrl: cfg.merchantBackendUrl, clientToken: cfg.clientToken }), {
  operation: "deposit",
  pollUrl: cfg.pollUrl,
  pollHeaders: cfg.pollHeaders,
  amount: cfg.amount,
  currency: cfg.currency,
  lockAmount: true,
  reference: cfg.reference,
});
await checkout.loadCountries();
const unmount = mountCheckout(document.getElementById("checkout")!, checkout);
```

## Sequence

| # | Step | Browser to your server | Notes |
| --- | --- | --- | --- |
| 1 | `loadCountries()` | `GET /countries`, `GET /checkout-preferences` | Preferences are optional; failure of countries sets `state.error` |
| 2 | Country preselected | `GET /providers?country=&operation_type=DEPOSIT` | The form layout selects `defaultCountry` (mount option) or the first country. With exactly one provider it is selected automatically |
| 3 | Customer types the number | `GET /match-provider?...` | See below |
| 4 | Provider known, amount present | `GET /amount-limits`, `POST /fees/simulate` | Re-run on provider, amount or pay currency change |
| 5 | Customer presses Pay | (`match-provider` if needed), hooks, `POST /deposits` | `pay()` |
| 6 | Waiting | `GET <pollUrl>` repeatedly | Until terminal status |
| 7 | Terminal | none | Success or failure screen |

## Countries

`loadCountries()` keeps the countries your backend returns (the aggregator already restricts them to the merchant's
allowed markets) minus entries without `code` and duplicates. Choosing another dial code in the form calls
`selectCountry(code)`, which clears the selected provider and customer name, reloads providers (cached per country) and,
if a number was already typed, repeats the lookup with the new dial code. An unknown code sets the error "Unknown
country".

## Providers

The provider logos shown are the active country's providers. The customer can click one to override the match;
`selectProvider(code)` re-runs limits and fees. A country with no provider shows "No mobile money provider is available
for this country." and Pay stays disabled.

## Phone number normalisation

Mobile money numbers are always sent as `<dial code><national number>`, digits only, **also on `match-provider` before a
provider is known** (`toE164Digits`, exported from `@mainmoneyapp/js-checkout`):

| Customer types (country +243) | Sent |
| --- | --- |
| `987805910` | `243987805910` |
| `0987805910` | `243987805910` |
| `+243987805910` | `243987805910` |
| `00243987805910` | `243987805910` |

Rules: non-digits and leading zeros are removed; the dial code is stripped only when at least 8 digits remain after it
(so a national number that merely starts with the dial code digits is kept). `canPay` requires 7 to 12 national digits.
Only an already selected, **non-phone** provider (bank account, card identifier) keeps the raw value.

## Provider match: debounce, blur, deduplication

`match-provider` answers "which provider owns this number" and returns the account holder name when the provider
supports lookup.

- **Debounce:** the form starts a lookup 600 ms after the last keystroke, once the field has at least 7 digits.
- **Blur:** leaving a non-empty field looks the number up immediately. A blur caused by the widget re-rendering is
  ignored.
- **One request per number:** the debounce, the blur and `pay()` share the request in flight (keyed by country and
  normalised number). An identical, already matched number does nothing.
- **Stale answers are dropped:** if the customer changed the number or country meanwhile, the older answer is ignored.
- **On success:** the matched provider is highlighted and, when it is in the country's provider list, selected; the
  currency follows it (see below); `customerName` is set from `lookup_data.name` (or `name`), otherwise `null`; then
  limits and fees load. A failing limits or fee call does not discard the match; it only sets `state.error`.
- **On failure:** `state.error` shows the backend message, for example "No entity found" (HTTP 400) when no provider
  matches the number.
- If `entity` is not in the country's provider list the provider stays unselected and `pay()` reports "Select a provider"
  until the customer picks one.

Headless use: call `checkout.matchProvider()` yourself after `setIdentifier(value)`.

## Amount, limits and fees

- The amount field is editable unless `lockAmount: true`. With `lockAmount` and a non-empty `amount` the form hides the
  field. `setAmount()` is ignored when locked.
- **Limits.** `amount-limits` is queried per provider and **pay** currency. If the amount (or the converted amount
  when a quote applies) is outside `amount_min`..`amount_max` the message "Amount must be between {min} and {max}" is shown.
  This is advisory: the widget does not disable Pay for it; the aggregator enforces limits on `POST /deposits`.
- **Fee simulation.** `POST /fees/simulate` fills the fee box with `processing_fee` ("Processing fee") and `total_to_pay`
  ("You pay"); the Pay button reads `Pay <total_to_pay>` formatted for the locale. The widget never shows what the merchant
  receives. `feeBearer` (from checkout preferences) is available on the snapshot but is **not** sent in any request.
- **Merchant fee `fees`.** `createCheckout({ fees: "1.00" })` adds a static merchant fee on top of `amount` for deposits
  (the merchant must be allowed to add fees). It is sent as `fees` in every simulation and in `POST /deposits`, never folded
  into `amount`. It is ignored for payouts.
- **Partner fee hook.** `onPartnerFee(snapshot)` runs when the customer presses Pay (before the deposit is created):

```ts
createCheckout(session, {
  operation: "deposit",
  // ...
  onPartnerFee: async (ctx) => ({ amount: "1.00", currency: ctx.currency, label: "App fee" }), // or null for none
});
```

  - The returned `currency` must equal the cart `currency`, otherwise the flow stops with a `CurrencyMismatchException`
    message ("Cannot mix monetary amounts across currencies").
  - A thrown error stops the flow and its message is shown.
  - The amount wins over the static `fees` option and is sent as `fees`. It is stored in `snapshot.partnerFee`. It is
    fetched after the simulation already ran, so the fee box reflects it only once a later simulation runs; the static
    `fees` option is part of every simulation from the start.
  - The wizard layout lists it as an extra row in the overview; the form layout does not display it.
  - Your backend should still validate `fees` against the merchant's allowed range.

## Currencies and quotes

Two currencies exist: `currency` (the cart currency, the currency of `amount`) and `payCurrency` (what the customer pays
in).

| Configuration | Behaviour |
| --- | --- |
| No `currency` anywhere | The widget takes the matched provider's currency (the provider's `accepted_currencies`); the customer can switch among those and `currency` changes with it |
| `currency: "USD"` (or `createSession({ currency })`) | `currency` never changes. `payCurrency` follows the provider: the cart currency if the provider accepts it, otherwise its first accepted currency. The form shows a "Pay in" selector when the provider accepts several |
| `lockCurrency: true` (with `currency`) | The customer always pays in `currency`; no selector. Always pair it with `currency`: without it the currency stays empty and Pay never enables |

When `payCurrency` differs from `currency`:

- `POST /fees/simulate` carries `payment_currency`, and the response includes a `quote`
  (`from_currency`, `to_currency`, `rate`, `converted_amount`); the fee box and the Pay button are shown in the pay
  currency with an exchange-rate hint.
- `POST /deposits` carries `currency` (cart) and `payment_currency`.
- The aggregator answers HTTP 400 (`no_quote`, or `errors.payment_currency`) when no rate exists. The widget then falls
  back to the cart currency with the message "Conversion between X and Y is not available. Please select Y." If the provider does
  not accept the cart currency either, `quoteUnavailable` is `true`, the error stays and Pay is disabled.

## Pay, hooks and the deposit request

`pay()` (the Pay button):

1. Does nothing unless the active tab is mobile money ([payment-methods.md](payment-methods.md)).
2. Looks the number up if no provider is selected or the number changed.
3. No provider: error "Select a provider".
4. Requires country, provider, identifier, amount and currency ("This field is required" otherwise).
5. Runs `onPartnerFee` (and, for payouts, `onValidateBalance`).
6. Calls `confirm()`: step `confirming`, then `POST /deposits` ([backend-contract.md](backend-contract.md#7-post-deposits)).

Reference: `createCheckout({ reference })`, else a `crypto.randomUUID()` (needs HTTPS or localhost; otherwise pass
`reference`). `Idempotency-Key` is not sent unless `idempotencyHeader: true`; the body `reference` is what makes the call
idempotent.

## Polling and terminal states

After `POST /deposits` returns:

| Create response `status` | Widget |
| --- | --- |
| terminal (`SUCCESS`, `FAILED`, `CANCELLED`, `CANCELED`, `EXPIRED`, any case) | step `terminal` immediately, no polling |
| anything else and `pollStatus: false` | step `ongoing`, text "Transaction ongoing" |
| anything else and polling on | step `polling`, text "Waiting for confirmation" |

Polling (`GET <pollUrl>?reference=&operation=deposit` with `pollHeaders`):

- Interval `pollIntervalMs` (default 1000 ms). It stops only on a terminal status or `checkout.close()`; there is no
  overall timeout.
- After `slowNoticeAfterMs` (default 30 s) `slow` becomes `true` and the widget shows "Your payment is still being
  processed. You can safely leave this page...". Polling continues.
- A network error, a non-2xx answer or an unparsable body is **retried forever** with exponential backoff
  (`interval * 2^n`, capped at 10 s). `connectionLost` is `true` while it fails and the widget shows "Connection
  lost...". This includes 401/403 from an expired `pollHeaders` token: fix it on the server, the widget cannot tell
  "offline" from "unauthorised".
- `pollConfirmed` becomes `true` after the first decodable answer.

Terminal screen: `SUCCESS` shows "Payment succeeded"; every other terminal status shows "Payment failed", a hint and a
**Retry** button. The status message of the aggregator is not displayed; read `snapshot.status` for it.

Detect the end in your own code:

```ts
const stop = checkout.subscribe((s) => {
  if (s.step === "terminal") {
    stop();
    // s.status?.status === "SUCCESS" -> ask YOUR server for the order state, then navigate.
  }
});
```

The internal `complete`, `ongoing` and `status` events are not exposed by the `Checkout` type; use `subscribe`
([reference.md](reference.md#events)).

## Retry

- **Failure at create time** (HTTP error from `POST /deposits`): without `onRetry` the widget returns to the form with the
  error text; the customer can fix the number or amount and press Pay again. With `onRetry` it shows only the error and a
  Retry button.
- **Failed terminal status:** the Retry button calls `retry()`.
- **Without `onRetry`:** `retry()` clears the error and returns to the form; the next submission uses a new reference
  `<reference>-r1`, `-r2`, ... (a failed deposit keeps its reference for good).
- **With `onRetry`:** the widget calls it and does nothing else. Use it to start a **new server session** and swap in a
  new `Checkout`:

```ts
const host = document.getElementById("checkout")!;
let checkout: Checkout;
let unmount: () => void = () => undefined;

async function start(): Promise<void> {
  const cfg = await (await fetch("/session", { method: "POST" })).json();
  const next = createCheckout(createSession({ merchantBackendUrl: cfg.merchantBackendUrl, clientToken: cfg.clientToken }), {
    operation: "deposit", pollUrl: cfg.pollUrl, pollHeaders: cfg.pollHeaders, amount: cfg.amount, currency: cfg.currency,
    lockAmount: true, reference: cfg.reference,
    onRetry: async () => {
      unmount();
      checkout.close(); // stops polling and theme listeners of the old instance
      await start();    // new order/reference on your server, new Checkout, new mount
    },
  });
  await next.loadCountries();
  checkout = next;
  unmount = mountCheckout(host, checkout);
}
await start();
```

If your backend forces the `reference` from the session, an in-place retry would send the same reference and the aggregator
rejects it as a duplicate; use `onRetry` and a new session in that case.

## Error cases

| What the customer sees | Cause |
| --- | --- |
| "Failed to fetch" | CORS or network, see [troubleshooting.md](troubleshooting.md) |
| "No entity found" | No provider matches the number, or the market is not enabled for the merchant |
| "Select a provider" | Match gave a provider that is not in the country list, or none |
| "Amount must be between..." | Outside provider limits |
| "Conversion between ... is not available" | No FX rate for the chosen pay currency |
| "Cannot mix monetary amounts across currencies" | `onPartnerFee` returned another currency |
| Pay button disabled | See `canPay` in [reference.md](reference.md#canpay) |
| "Connection lost" forever | Status route unreachable or answering 4xx/5xx |
