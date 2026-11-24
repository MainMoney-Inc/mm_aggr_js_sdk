# MainMoney Rails: platforms and sellers

**Purpose.** State clearly what the browser SDK does and does not do when your application is a platform that acts on
behalf of sellers (sub-merchants) on MainMoney Rails.

**Prerequisites.** A MainMoney Rails platform account and the seller account ids (portal: Sellers, the seller, Overview,
Account ID). Sellers themselves (onboarding, KYB) are managed through the aggregator and the backend; none of that is in
this package.

## The rule

Acting on behalf of a seller is **purely a backend concern**. The aggregator reads the header `X-Merchant-Account` on
the platform's API calls; the browser SDK:

- never sends `X-Merchant-Account`,
- has no option, header or path for it,
- never sees the seller's account id unless **you** put it in a payload.

Your backend decides the seller from the `clientToken` (the saved checkout record) and adds the header when it calls the
backend SDK. A customer must never be able to choose the seller.

## Pattern

1. Your session endpoint saves `{ token, reference, amount, currency, sellerAccountId }`.
2. Every checkout route resolves the token and forwards the call with the seller.
3. Platform fees (`application_fee`, `application_fee_percent`) are set by your backend in the body of
   deposits/payouts; the widget never sends them.

Per the pinned contract, `X-Merchant-Account` is accepted on deposits, deposit validation, payouts, status checks,
refunds, remittances, wallets, reports and payment links. The aggregator answers **403** when the seller is unknown, is
not yours or is not active (the widget would show the backend `message`).

## What the backend SDKs support

Checked against the SDK sources next to this repository at the time of writing (they were still being edited, so
confirm against the version you install and read its Rails guide):

| SDK | Seller on a call | Client-wide default |
| --- | --- | --- |
| Python | `merchant_account=` argument on deposits, payouts, status, payment links, ... | `Client(..., merchant_account=id)` or `client.with_merchant_account(id)` |
| PHP | `merchantAccount:` argument on the same calls | none documented: pass it per call |
| Node.js | `{ merchantAccount }` option on the same calls | `new Client({ ..., merchantAccount })` |

The seller header is **not** part of the contract for countries, providers, match-provider, amount limits, fee
simulation and checkout preferences, so the backend SDKs do not send it there. Those calls (and therefore the fee box)
use the platform's own configuration; the aggregator applies the seller's fees and limits when the deposit or
payout itself is created with the header.

Python example (the handler behind `POST /payments/deposits`):

```python
body = {**request_json, "reference": session.reference, "amount": session.amount, "currency": session.currency,
        "application_fee_percent": "1.5"}
result = client.deposits.create(body, idempotency_key, merchant_account=session.seller_account_id)
```

Use the same seller on the status route behind `pollUrl`, otherwise the transaction is not found:

```python
client.status.check("deposit", session.reference, merchant_account=session.seller_account_id)
```

## What the browser still does

Everything else is unchanged: countries, providers, limits and fees are requested through your routes. Because those
endpoints are not seller-specific, a fee shown to the customer can differ from the final charge for a seller with its
own fee plan; the aggregator's charge is the one that counts.

## Payment links for sellers

Create the link with the seller's account id on your server ([payment-links.md](payment-links.md)); the browser only
receives `url`.

## Error cases

| Symptom | Cause |
| --- | --- |
| 403 on deposit | Seller unknown, not yours, not active, or missing scope |
| Fee box differs from the final charge | Seller fee plan applies only on the deposit/payout call, not on `fees/simulate` |
