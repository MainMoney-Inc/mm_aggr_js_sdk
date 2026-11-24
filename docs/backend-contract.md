# Merchant backend path contract

**Purpose.** The exact routes, query strings, bodies and responses between the widget and **your** server, and which
backend SDK call serves each route. Implement every route you need under `merchantBackendUrl`.

**Prerequisites.** [architecture.md](architecture.md), one backend SDK installed and configured with your `client_id`
and `secret`.

## Conventions shared by all routes

- URL = `merchantBackendUrl` + path (default paths below, overridable with `createSession({ paths })`).
- If `createSession({ clientToken })` is set every request carries `Authorization: Bearer <clientToken>`.
- Requests with a JSON body also carry `Content-Type: application/json` and `Accept: application/json`. No cookies are
  sent to another origin (the SDK does not set `credentials`).
- A timeout (`timeoutMs`, default 30 s) aborts the request.
- Query values that are empty or undefined are dropped; booleans are sent as `true`/`false`.
- **Success:** any `2xx`. The body may be the raw payload or the aggregator envelope
  `{ "success": true, "response_data": <payload>, "message": "..." }`: the SDK unwraps `response_data`. An envelope with
  `"success": false` is treated as an error (HTTP 400).
- **Errors:** any non-2xx. The SDK throws `MerchantBackendException` with `statusCode`, `message` (from the body
  `message`, otherwise "Merchant backend request failed"), `errors` (from `response_data.errors` or `errors`) and the
  whole body as `responseBody`. The widget shows `message` to the customer, so never put internals in it.
- Lists may be a bare array or `{ count, next, previous, results: [...] }`. The widget reads the first page only (it
  sends no `page`/`page_size`).

Recommended error body from your routes: `{ "message": "Human readable", "errors": { "field": ["detail"] } }`.

## Route table

| # | Method and path | Called when | Aggregator endpoint (via the backend SDK) |
| --- | --- | --- | --- |
| 1 | `GET /countries` | `loadCountries()` | `GET /manage/general/countries/` |
| 2 | `GET /checkout-preferences` | `loadCountries()` (in parallel, optional) | `GET /manage/general/checkout-preferences/` |
| 3 | `GET /providers` | country selected | `GET /manage/general/financial-entities/` |
| 4 | `GET /match-provider` | phone number lookup | `GET /transactions/customers/match-provider/` |
| 5 | `GET /amount-limits` | provider and amount known | `GET /manage/general/amount-limits/` |
| 6 | `POST /fees/simulate` | provider and amount known | `POST /manage/general/fees/simulate/` |
| 7 | `POST /deposits` | pay/confirm, `operation: "deposit"` | `POST /transactions/deposits/` |
| 8 | `POST /payouts` | pay/confirm, `operation: "payout"` | `POST /transactions/payouts/` |
| 9 | `GET <pollUrl>` | after a non-terminal create | `POST /transactions/status/check/{operation_type}/` (note: POST at the aggregator) |
| - | `POST /deposits/validate` | **never called by the widget** | `POST /transactions/deposits/validate-payment/` |

## Which backend SDK method serves each route

| Route | Python (`mm_aggr`) | PHP (`MainMoney\Aggregator\Client`) | Node.js |
| --- | --- | --- | --- |
| `/countries` | `client.countries.list()` | `$client->countries->list()` | `client.countries.list()` |
| `/checkout-preferences` | `client.checkout_preferences.get()` | `$client->checkoutPreferences->get()` | `client.checkoutPreferences.get()` |
| `/providers` | `client.providers.list(query)` | `$client->providers->list($query)` | `client.providers.list(query)` |
| `/match-provider` | `client.customers.match_provider(account, get_lookup, operation_type)` | `$client->customers->matchProvider($account, $getLookup, $operationType)` | `client.customers.matchProvider(account, getLookup, operationType)` |
| `/amount-limits` | `client.amount_limits.list(query)` | `$client->amountLimits->list($query)` | `client.amountLimits.list(query)` |
| `/fees/simulate` | `client.fees.simulate(body)` | `$client->fees->simulate($body)` | `client.fees.simulate(body)` |
| `/deposits` | `client.deposits.create(body, idempotency_key)` | `$client->deposits->create($body, $idempotencyKey)` | `client.deposits.create(body, idempotencyKey)` |
| `/payouts` | `client.payouts.create(body, idempotency_key)` | `$client->payouts->create($body, $idempotencyKey)` | `client.payouts.create(body, idempotencyKey)` |
| poll | `client.status.check(operation, reference)` | `$client->status->check($operation, $reference)` | `client.status.check(operation, reference)` |
| validate (unused) | `client.deposits.validate_payment(body)` | `$client->deposits->validatePayment($body)` | `client.deposits.validatePayment(body)` |

Ready-made routing: **Python only** ships `mm_aggr.checkout_proxy` (`dispatch`/`handle`, `CHECKOUT_ROUTES`) that
implements all of the routes above including `status`, with `reference=` and `overrides=` to force order values. For PHP
and Node you write one handler per route (the Node Express example in the Node SDK repository,
`examples/express/src/proxy.ts`, is a complete reference).

## 1. `GET /countries`

- Query: none.
- Response: array or `{ results }` of `{ code, name, iso3_code, phone_code, flag }`. The widget drops entries without a
  `code` and duplicates.
- Used for: the country/dial-code selector. `phone_code` (digits, e.g. `243`) drives phone normalisation.

## 2. `GET /checkout-preferences`

- Query: none. Optional: if this call fails the form still works (branding and tabs fall back to defaults).
- Response fields the widget reads: `primary_color`, `secondary_color`, `accent_color`, `background_color` (applied
  **only if** `primary_color` is present, and then they win over `createSession({ theme })`), `payment_methods`
  (`["mobile_money","card","mainmoney"]` subset, see [payment-methods.md](payment-methods.md)) and `fee_bearer`
  (`MERCHANT` or `CUSTOMER`, exposed on the snapshot as `feeBearer`). `locale` and `logo` are **not** used by the widget.

## 3. `GET /providers`

- Query: `country=<ISO code>`, `operation_type=DEPOSIT|PAYOUT`.
- Response: array or `{ results }` of `{ code, name, entity_type, country_code, currency_code, accepted_currencies, logo,
  is_active }`. `entity_type: "MOBILE_MONEY"` marks phone-number providers; `accepted_currencies` (falls back to
  `[currency_code]`) drives currency choice.
- The widget caches the answer per `country:operation` for the life of the `Checkout`.

## 4. `GET /match-provider`

- Query: `account_number=<digits>`, `get_lookup=true`, `operation_type=DEPOSIT|PAYOUT`.
  `account_number` is `<dial code><national number>` digits only for mobile money (see
  [deposit-flow.md](deposit-flow.md#phone-number-normalisation)).
- Response used: `entity` (a provider `code` from `/providers`), and the customer name from `lookup_data.name`
  (fallback: top-level `name`). Other keys (`entity_group`, `account_number`) are ignored.
- The aggregator answers HTTP 400 with `message: "No entity found"` when the number matches no provider the merchant may
  use. The widget then shows that message.

## 5. `GET /amount-limits`

- Query: `financial_entity_code=<provider code>`, `currency=<pay currency>`, `operation_type=DEPOSIT|PAYOUT`.
- Response: array or `{ results }`; the widget uses the first item: `{ amount_min, amount_max, currency }` (strings or
  `null`).

## 6. `POST /fees/simulate`

Body sent by the widget:

```json
{
  "provider_code": "MPESA_KE",
  "operation_type": "DEPOSIT",
  "amount": "25.00",
  "currency": "USD",
  "payment_currency": "KES",
  "fees": "1.00"
}
```

`payment_currency` is present only when the customer pays in a currency different from `currency`. `fees` is present only
for deposits with a merchant fee. Response fields used: `processing_fee`, `total_to_pay`, `merchant_receives`,
`quote { from_currency, to_currency, rate, converted_amount }`, and for payout/limit checks the whole object is kept on
`snapshot.fees`. HTTP 400 whose body contains `payment_currency` in `errors` or the text `no_quote` means no exchange
rate exists (see [deposit-flow.md](deposit-flow.md#currencies-and-quotes)).

## 7. `POST /deposits`

Body sent by the widget:

```json
{
  "provider_code": "MPESA_KE",
  "reference": "ORDER-1042",
  "amount": "25.00",
  "currency": "USD",
  "customer_phone": "254712345678",
  "payment_currency": "KES",
  "customer_name": "Jane Doe",
  "customer_email": "jane@example.com",
  "fees": "1.00"
}
```

Always present: `provider_code`, `reference`, `amount`, `currency`, `customer_phone`. Optional: `payment_currency` (only if
different from `currency`), `customer_name` (only if the lookup returned one), `customer_email` (only if filled),
`fees` (only if the merchant fee is set; never folded into `amount`).

Header: `Idempotency-Key: <reference>` **only** when `createCheckout({ idempotencyHeader: true })`.

Your route **must** overwrite `reference`, `amount` and `currency` from the order, then call the backend SDK. Response:
the aggregator deposit response (`status`, `transaction_id`, `internal_reference`, `merchant_reference`, `message`, ...).
HTTP 202 and 2xx are accepted. A terminal `status` ends the flow without polling.

## 8. `POST /payouts`

```json
{
  "provider_code": "MTN_CD",
  "reference": "PAYOUT-77",
  "amount": "10.00",
  "currency": "USD",
  "destination_account": "243812345678"
}
```

Same rules as deposits (force the values server-side, `Idempotency-Key` only with `idempotencyHeader`). The widget sends
no fee fields and no `payment_currency` for payouts. Insufficient merchant balance is answered by the aggregator with a
400 that the widget shows as an error.

## 9. Status poll (`pollUrl`)

- `GET <pollUrl>?reference=<reference>&operation=deposit|payout` (existing query keys of `pollUrl` are kept; these two are
  set/overwritten). Headers: exactly `pollHeaders`; **not** `clientToken`, not `Content-Type`.
- Response: the status object (aggregator status payload). Only `status` drives the widget. Terminal values (case
  insensitive): `SUCCESS`, `FAILED`, `CANCELLED`, `CANCELED`, `EXPIRED`. Anything else keeps polling.
- Backend SDK: call `status.check(operation, reference)`; the `reference` is the merchant reference (the aggregator also
  accepts the internal reference).

Python:

```python
# Do not forward the browser's query: in `dispatch`, a `reference` query value wins over the `reference=` argument.
query = {"operation": request.args.get("operation", "deposit")}
status, body = handle(client, "GET", "status", query=query, reference=session.reference)
```

Node:

```ts
app.get("/payments/status", authenticate, async (req, res) => {
  const result = await client.status.check(String(req.query.operation ?? "deposit"), session.reference);
  res.json(result);
});
```

## Worked example: PHP route for deposits

```php
// POST /payments/deposits
$session = $store->findByBearer($request->bearerToken()) ?? abort(401);
$body = $request->json()->all();
$body['reference'] = $session->reference;   // force order values
$body['amount']    = $session->amount;
$body['currency']  = $session->currency;
return response()->json($client->deposits->create($body, 'mm-' . hash('sha256', $session->token)));
```

## Error cases

| Symptom | Cause |
| --- | --- |
| Widget shows "Failed to fetch" and no request reaches your server | CORS or network, see [troubleshooting.md](troubleshooting.md) |
| "Merchant backend request failed" | Non-2xx without a `message` in the body |
| 401 on every route | `clientToken` unknown or expired on your side |
| 404 on a route | Path not implemented; implement it or map with `createSession({ paths })` |
| Duplicate reference error on a retry | Backend forced the same `reference`; see [deposit-flow.md](deposit-flow.md#retry) |
