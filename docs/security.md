# Security notes

**Purpose.** The rules that keep merchant credentials and money safe when you embed the widget.

**Prerequisites.** [architecture.md](architecture.md).

## Rules

1. **No API keys in the browser.** `client_id` and `secret` live only on your server. The browser SDK has no option for
   them and sends only `Authorization: Bearer <clientToken>` (your own token) and your `pollHeaders`.
2. **Never trust amounts from the browser.** The widget sends `amount`, `currency`, `reference` and optionally `fees`.
   Your routes must overwrite `reference`, `amount` and `currency` from your own order (`lockAmount` is only a UI
   convenience) and validate `fees`.
3. **Never fulfil from the browser.** `terminal` with `SUCCESS` in the browser is a display state. Confirm the order from
   your server (the aggregator's status or webhook) before delivering goods. Verify webhooks with the backend SDK.
4. **`clientToken` hygiene.** Random, unguessable, short-lived, bound to one order and one operation; reject reuse after
   completion. It is visible to the page (and to any script in it), so it must grant nothing beyond this checkout.
5. **`pollHeaders` are page-visible too.** Use the same scoped token. Do not put long-lived secrets in them.
6. **Seller selection is server-side** ([platform-sellers.md](platform-sellers.md)).
7. **Payout checkouts need authorisation.** Gate the session endpoint behind your own login and permissions.
8. **Sanitise what you put in `messages` and `links`.** The widget writes text with `textContent`, so backend `message`
   values and your overrides cannot inject HTML; `links` URLs become `href` values: only pass trusted `https://` URLs.
9. **Do not leak internals in error `message`.** The widget displays it to the customer verbatim.
10. **HTTPS only.** `crypto.randomUUID`, mixed-content rules and card/mobile money trust all expect it.
11. **CORS:** allow only your own origins ([troubleshooting.md](troubleshooting.md)); do not use `*` with `Authorization`.
12. **Content Security Policy.** The widget needs `connect-src` for your backend origin, `img-src` for provider logos and
    country flags (absolute URLs from the aggregator) and `style-src` for `styles.css`. It uses no inline scripts.

## Logging

The SDK does not log. If you log requests in your own code, do not log `clientToken`, `pollHeaders` or phone numbers.
