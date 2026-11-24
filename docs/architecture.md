# Architecture

**Purpose.** Explain which piece runs where, so you never put a secret in the browser and know which backend SDK call
answers each browser request.

**Prerequisites.** A merchant account with an API application (`client_id` and `secret`) and one backend SDK
installed on your server: [PHP](https://github.com/MainMoney-Inc/mm_aggr_php_sdk),
[Python](https://github.com/MainMoney-Inc/mm_aggr_python_sdk) or
[Node.js](https://github.com/MainMoney-Inc/mm_aggr_nodejs_sdk).

## The two halves

```
Browser (this SDK)                    Your server (one backend SDK)               MainMoney aggregator
------------------                    -----------------------------               --------------------
@mainmoneyapp/js-checkout  --HTTPS-->  routes under merchantBackendUrl  --SDK-->   /api/v1/...
  holds: clientToken (opaque)           holds: client_id + secret                   Bearer access token
  never holds: API keys                 forces: amount, currency, reference
```

- The **browser SDK** (`@mainmoneyapp/js-core`, `-http`, `-checkout`, and the `-react`, `-vue`, `-angular` wrappers)
  renders the checkout, collects the customer's country, phone number and amount, and calls **your** server. It never
  calls the aggregator and has no code path that sends an API key.
- The **backend SDK** exchanges `client_id` and `secret` for an access token, caches it, and calls the aggregator
  (`Authorization: Bearer <access_token>`). Only your server may hold `client_id` and `secret`.
- The route names the browser calls are fixed by this SDK (see [backend-contract.md](backend-contract.md)); your server
  must implement them. Only the Python SDK ships a ready dispatcher (`mm_aggr.checkout_proxy`); with PHP or Node you
  write the routes yourself, each one a single backend SDK call.

## `clientToken`

`clientToken` is an opaque string **you** mint on your server when a customer starts a checkout (a random token tied
to a server-side record of the order). It is not an aggregator credential and not a JWT the SDK understands.

- `createSession({ clientToken })` makes the SDK send `Authorization: Bearer <clientToken>` on every call to
  `merchantBackendUrl` (never on the status polls: those use `pollHeaders`).
- Your server maps the token back to the order (amount, currency, reference, operation, optionally the seller) and
  rejects requests without a valid token.
- The SDK does not refresh, decode or validate it. When it expires the calls fail with 401 and you must start a new
  session.

## What the browser may and may not decide

| Value | Decided by |
| --- | --- |
| Amount and currency of a cart or order | **Your server.** The widget sends them, but your route must overwrite `amount`, `currency` and `reference` from the order |
| `reference` | Your server (the widget generates a UUID only when you give none) |
| Country, provider, phone number, pay currency (`payment_currency`), receipt email | The customer, validated by the aggregator |
| `X-Merchant-Account` (seller on MainMoney Rails) | Your server only; the widget never sends it |
| Fees added by the merchant (`fees`) | Your server should confirm or set it; the browser value is untrusted |

## Lifecycle of one payment

1. The customer clicks "Pay" in your app. Your frontend calls **your** session endpoint ([session.md](session.md)).
2. Your server creates the order, mints a `clientToken`, and answers with `merchantBackendUrl`, `clientToken`,
   `pollUrl`, `pollHeaders` and the order's amount, currency and reference.
3. The browser creates a `Session` and a `Checkout`, calls `loadCountries()` and mounts the widget.
4. The widget calls your routes (countries, providers, match-provider, limits, fee simulation) and finally
   `POST /deposits` or `POST /payouts`.
5. The widget polls `pollUrl` until the status is terminal ([deposit-flow.md](deposit-flow.md)).
6. Your server learns the outcome from the aggregator (webhook and/or the status call it makes for the poll) and fulfils
   the order. **Never fulfil an order because the browser says it succeeded.**

## What this SDK does not do

- It does not create payment links, refunds, transfers or remittances, and does not read wallets or reports. Those are
  backend SDK features.
- It does not verify webhooks.
- It does not talk to the aggregator.

Next: [session.md](session.md).
