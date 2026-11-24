# Payment links

**Purpose.** Explain how payment links relate to the browser SDK. **The widget does not create, list or cancel payment
links.** A merchant backend creates a link with its backend SDK and the browser app uses the returned `url`.

**Prerequisites.** A backend SDK installed on your server and an API key with the `PAYMENT_LINK` scope. Nothing from this
package is needed to open a link.

## Who does what

| Step | Where | How |
| --- | --- | --- |
| Create the link | Your server | `client.payment_links.create(...)` (Python), `$client->paymentLinks->create(...)` (PHP), `client.paymentLinks.create(...)` (Node) |
| Return `url` to the browser | Your server route, **not** one of the checkout routes | Your own endpoint, e.g. `POST /payment-links` |
| Send the customer to `url` | Browser | Redirect, a link, a QR code, or an embed (see below) |
| Know it was paid | Your server | Poll `paymentLinks.get(id)` until `status` is `PAID`, and/or verify the webhook |

The SDK has no `paymentLinks` path in `MerchantPaths`, no method on `Checkout` and no component for links. A link is paid
on the hosted page the `url` points to, with the methods the link allows (`card`, `mobile_money`).

## 1. Create the link on your server

Python:

```python
link = client.payment_links.create(
    {
        "reference": "INV-1042",       # required, unique, max 100
        "amount": "25.00",             # required, decimal string; fixed by you
        "currency": "USD",             # required
        "title": "Invoice 1042",
        "methods": ["card", "mobile_money"],
        "redirect_url": "https://shop.example/thanks",
    },
    idempotency_key="INV-1042",
)
return {"id": link["id"], "url": link["url"]}
```

PHP:

```php
$link = $client->paymentLinks->create([
    'reference' => 'INV-1042', 'amount' => '25.00', 'currency' => 'USD',
    'redirect_url' => 'https://shop.example/thanks',
], idempotencyKey: 'INV-1042');
return ['id' => $link['id'], 'url' => $link['url']];
```

Node:

```ts
const link = await client.paymentLinks.create({
  reference: "INV-1042", amount: "25.00", currency: "USD", redirect_url: "https://shop.example/thanks",
});
res.json({ id: link.id, url: link.url });
```

Fields, statuses (`ACTIVE`, `PAID`, `EXPIRED`, `CANCELLED`), expiry and cancellation are in each backend SDK's
`docs/payment-links.md`. Return only `id` and `url` (and maybe `status`) to the browser.

## 2. Use `url` in the browser

### Redirect (works everywhere)

```ts
const { url } = await (await fetch("/payment-links", { method: "POST", credentials: "include" })).json();
window.location.assign(url);
```

React / Vue / Angular do exactly the same inside a click handler; there is no wrapper component:

```tsx
<button onClick={async () => {
  const { url } = await (await fetch("/payment-links", { method: "POST" })).json();
  window.location.assign(url);
}}>Pay</button>
```

Set `redirect_url` on the link so the customer returns to your app after paying. Then show the order state **from your
server** (the redirect alone does not prove payment).

### Embed (iframe)

Whether the hosted page can be framed depends on the framing headers of the hosted payment page, which are not part of
the contract this SDK implements; the documentation here cannot confirm it. If you try an `<iframe src={url}>`, test it
in your environment and keep the redirect as a fallback. The widget itself offers no embed helper for links.

### Share

`url` is safe to share publicly (email, chat, QR code). Never share the API credentials.

## 3. Learning the outcome

The browser cannot learn the payment result from the link page. Poll your server, which calls `paymentLinks.get(id)`
until `status` is `PAID` (and `paid_at` is set), or react to your verified webhook. You can reuse the widget's
polling pattern with your own endpoint, but `createCheckout` polling is for deposits and payouts created by the widget
and only works with a `reference` known to the status route.

## Links, the widget, and when to choose which

| You want | Use |
| --- | --- |
| Mobile money checkout inside your page, with provider match and fee box | The widget (`operation: "deposit"`) |
| Card payments | A payment link (the widget's Card tab is a placeholder) |
| A shareable pay-later URL (email, QR) | A payment link |

For sellers on MainMoney Rails see [platform-sellers.md](platform-sellers.md).

## Error cases

| Symptom | Cause |
| --- | --- |
| 403 creating a link | Key lacks `PAYMENT_LINK` scope, or the seller is unknown/inactive |
| 400 | Invalid fields (missing `reference`, `amount`, `currency`) |
| 409 | Reused `reference`, or cancelling an already paid link |
| iframe stays blank | The hosted page refuses framing: redirect instead |
