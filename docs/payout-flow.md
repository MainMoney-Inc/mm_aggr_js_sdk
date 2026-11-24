# Payout flow

**Purpose.** Use the widget to send money out (`operation: "payout"`), for example a seller withdrawal or a refund-like
transfer started by an operator. Describes what differs from [deposits](deposit-flow.md).

**Prerequisites.** Same as deposits, plus a backend route `POST /payouts` that is only reachable by an authorised user:
a payout debits the merchant wallet. Never expose a payout checkout to anonymous visitors.

## Minimal copy-paste

```ts
const checkout = createCheckout(session, {
  operation: "payout",
  pollUrl: cfg.pollUrl,
  pollHeaders: cfg.pollHeaders,
  amount: cfg.amount,          // from your server
  currency: cfg.currency,
  lockAmount: true,
  reference: cfg.reference,
  onValidateBalance: async (ctx) => {
    const r = await fetch("/payouts/precheck", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.clientToken}` },
      body: JSON.stringify({ amount: ctx.amount, currency: ctx.currency }),
    });
    return r.ok ? { ok: true } : { ok: false, message: "Insufficient balance" };
  },
});
await checkout.loadCountries();
mountCheckout(document.getElementById("checkout")!, checkout); // payouts default to the step-by-step wizard layout
```

`/payouts/precheck` is **your** route (not part of the SDK contract): for example it reads the wallet with the backend SDK
(`client.wallets.list()` / `$client->wallets->list()`).

## What differs from deposits

| Aspect | Deposit | Payout |
| --- | --- | --- |
| Default layout | `form` (single page) | `wizard`: country, details, overview, confirm. Force with `mountCheckout(el, c, { layout: "form" })` |
| Provider lists/limits/fees `operation_type` | `DEPOSIT` | `PAYOUT` |
| Single provider in country | auto-selected | **not** auto-selected: the customer picks it or a number lookup matches it |
| Identifier sent | `customer_phone` | `destination_account` (normalised the same way for mobile money; raw for non-phone providers) |
| Body | includes `customer_name`, `customer_email`, `payment_currency`, `fees` when set | only `provider_code`, `reference`, `amount`, `currency`, `destination_account` |
| Merchant fee `fees` / `onPartnerFee` amount | sent | never sent (a partner fee is still validated and shown on the wizard overview) |
| `onValidateBalance` | not used | runs before the overview/confirm |
| Fee simulation `payment_currency` | sent when pay currency differs | sent the same way, but `POST /payouts` carries no `payment_currency` |
| Poll `operation` | `deposit` | `payout` |

## Wizard steps

1. **Country:** a select; `selectCountry` loads providers for `PAYOUT`.
2. **Details:** provider buttons, the account/phone field (a blur runs `match-provider` and highlights the match), the
   customer name if the lookup returned one, the amount field and **Next**. **Next** calls `goOverview()`.
3. **Overview:** country, provider, number, name, amount (and the partner fee row). **Confirm** calls `confirm()`.
4. **Confirming / polling / terminal:** identical to deposits ([polling](deposit-flow.md#polling-and-terminal-states)).

`goBack()` moves overview to details to country. The Back button in the wizard calls it.

## `onValidateBalance`

`onValidateBalance(snapshot) => Promise<{ ok: boolean; message?: string }>` runs in `goOverview()`/`pay()` for payouts
only, after `onPartnerFee`:

- `{ ok: true }`: continue.
- `{ ok: false, message }`: the flow stops on the details step and `message` is shown; without `message` the text is
  "Balance validation failed".
- A thrown error: the flow stops and the error message is shown.

It is a **courtesy check in the browser**. The aggregator checks the balance again when `POST /payouts` is processed
and answers 400 on insufficient funds, which the widget shows as an error. Do not rely on the hook for security.

## Error cases

| Symptom | Cause |
| --- | --- |
| "Balance validation failed" | `onValidateBalance` returned `ok: false` without a message |
| 400 with an insufficient balance message after Confirm | Wallet too low at the aggregator |
| 403 | Your key lacks the payout scope (server side) |
| Same reference rejected on retry | See [Retry](deposit-flow.md#retry) |

Business, remittance and merchant-account payouts (`payouts/business/...`) exist in the backend SDKs but are not reachable
from this widget.
