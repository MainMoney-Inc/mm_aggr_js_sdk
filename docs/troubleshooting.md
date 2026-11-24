# CORS and troubleshooting

**Purpose.** Fix the problems integrators actually hit: CORS preflight failures, origin mismatches, a widget that keeps
restarting, a Pay button that stays disabled, and polling that never ends.

**Prerequisites.** Your routes from [backend-contract.md](backend-contract.md) respond; open the browser devtools
Network tab.

## CORS: what your backend must allow

The widget calls `merchantBackendUrl` from the browser, so when that URL has another origin than your page, your server
must answer the CORS preflight (`OPTIONS`) and add CORS headers to every response.

| Header | Value |
| --- | --- |
| `Access-Control-Allow-Origin` | Your page origin exactly (for example `https://shop.example`). Not `*` while you send `Authorization` |
| `Access-Control-Allow-Methods` | `GET, POST, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type, Authorization` (add `Idempotency-Key` only if you set `idempotencyHeader: true`) |

What triggers a preflight:

- `Authorization: Bearer <clientToken>` on any call (so every call when you set `clientToken`).
- `Content-Type: application/json` on `POST /fees/simulate`, `/deposits`, `/payouts`.
- The status poll carries whatever `pollHeaders` contains (for example `Authorization`): allow those names too.
- A custom `Idempotency-Key` header, only when `idempotencyHeader: true`. Since 0.2.0 it is **off** by default because it
  made every payment fail the preflight on backends that only allow `Content-Type` and `Authorization`. The body
  `reference` already makes deposits and payouts idempotent.

No cookies are sent to another origin (the SDK does not set `credentials`), so you do not need
`Access-Control-Allow-Credentials`. Authenticate with the bearer token.

Snippets:

```ts
// Express
app.use(cors({ origin: ["https://shop.example"], allowedHeaders: ["Content-Type", "Authorization"] }));
```

```python
# FastAPI
app.add_middleware(CORSMiddleware, allow_origins=["https://shop.example"],
                   allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type", "Authorization"])
```

```php
// Laravel config/cors.php
'allowed_origins' => ['https://shop.example'],
'allowed_headers' => ['Content-Type', 'Authorization'],
```

`*` in `Access-Control-Allow-Headers` does **not** cover `Authorization`; list it explicitly.

Same-origin setups (the page and the routes share scheme, host and port, for example a reverse proxy at `/payments`) need
no CORS at all: set `merchantBackendUrl: "/payments"` (a path is accepted as the base).

### Origin mismatches

The check is on the origin of the **page** that mounts the widget, compared character for character:

- `http://` vs `https://`;
- `localhost` vs `127.0.0.1` (different origins);
- the port (`5173` vs `5174`);
- `www.` vs the bare domain.

A CORS error on `POST /deposits` while the `GET` lookups work almost always means the preflight rejects a request header
(`Content-Type`, `Idempotency-Key`) or the page origin. The browser shows the failure as "Failed to fetch" and the widget
shows that text.

## Symptoms

| Symptom | Cause and fix |
| --- | --- |
| Widget restarts from the first step on every render (Angular/React/Vue) | A new `Checkout` was created per render. Create it once (`ngOnInit`, `useMemo`/`useRef`/`useState`, a service) and pass the same instance |
| Provider match fires repeatedly or flickers | Use 0.2.0 or later. The lookup runs once the customer stops typing (600 ms) or leaves the field, and identical requests are shared |
| Pay button stays disabled | `canPay` needs: details step, mobile money tab, a country, providers in that country, a currency, no unavailable quote, an amount above 0, and 7 to 12 national digits ([reference.md](reference.md#canpay)) |
| Pay disabled only on the Card/MainMoney tab | Those tabs are placeholders ([payment-methods.md](payment-methods.md)) |
| Pay never enables with `lockCurrency` | `lockCurrency` without `currency`: the currency stays empty. Pass `currency` |
| "Failed to fetch" on every call | CORS, wrong `merchantBackendUrl`, mixed content (HTTPS page, HTTP backend), server down |
| 401 on every call | `clientToken` missing/expired, or your server does not read `Authorization: Bearer` |
| "Connection lost..." never goes away while paying | The status route is unreachable or answers 4xx/5xx; polling retries forever with backoff capped at 10 s. Check `pollUrl`, `pollHeaders` (an expired token gives 401) and CORS for the poll |
| Polling works but the widget never finishes | Your status route never returns a terminal `status` (`SUCCESS`, `FAILED`, `CANCELLED`/`CANCELED`, `EXPIRED`). Return the aggregator payload unchanged |
| "No entity found" | The number matches no provider enabled for the merchant and operation, or the country is not allowed |
| Deposit rejected as duplicate reference | The same `reference` was reused: after a failure the aggregator keeps it. Do not force a fixed reference on in-place retries; use `onRetry` with a new session |
| Colours ignore `theme` | `/checkout-preferences` answered with `primary_color` ([theming.md](theming.md)) |
| `crypto.randomUUID is not a function` as an error | The page is not a secure context (plain `http://` on a non-localhost host). Serve HTTPS or pass `reference` |
| Unstyled widget | `styles.css` not imported |
| `ReferenceError: document is not defined` | Mounted during server rendering: see [frameworks/nextjs.md](frameworks/nextjs.md) |
| Typing is laggy in Angular | Make sure you use the wrapper (it runs the widget outside the zone) or run your own mount in `NgZone.runOutsideAngular` |

## Debug checklist

1. Network tab: does `GET /countries` return 2xx? Is the `OPTIONS` preflight 2xx with the right headers?
2. `checkout.getState().error` and `.step`.
3. For polling, call your `pollUrl?reference=...&operation=deposit` with the same headers in a REST client.
4. Confirm your server overwrites `reference`, `amount` and `currency` and is not rejecting the retry reference.
