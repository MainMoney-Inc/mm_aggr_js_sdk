# @mainmoney/js-checkout

Headless checkout and vanilla `mountCheckout`. Import
`@mainmoney/js-checkout/styles.css`. See the [root README](../../README.md).

## Layouts

`mountCheckout(element, checkout, options)` renders:

- **`form`** (default for `operation: "deposit"`): one page with Card / Mobile money /
  MainMoney tabs, optional receipt email, dial-code dropdown plus local phone number,
  fee box (Merchant receives / Processing fee / You pay), provider logos for the selected
  country, a Pay button, an EN/FR toggle and footer links.
- **`wizard`** (default for payouts): the step-by-step flow. Force either with `layout`.

| Option | Purpose |
| --- | --- |
| `logoUrl` | Overrides the embedded MainMoney logo. |
| `layout` | `"form"` or `"wizard"`. |
| `defaultCountry` | ISO code preselected in the form (defaults to the first allowed country). |
| `links` | `{ privacy, terms, security, help }` URLs. Links without a URL are hidden. |

## Where the data comes from

- Tabs: `payment_methods` from `/checkout-preferences` (falls back to mobile money only).
  Card and MainMoney show a "coming soon" panel and a disabled Pay button until their
  backends are integrated.
- Countries, flags and provider logos: `/countries` and `/providers`, already limited to
  what the merchant may use.
- Fee box: `merchant_receives`, `processing_fee` and `total_to_pay` from `/fees/simulate`.
  With `fee_bearer: "CUSTOMER"` the deposit is created with `total_to_pay` as the amount.
- The phone number is sent once as `<dial code><local number>`; typing `+243...` or `0...`
  is handled.

Headless API additions: `pay()`, `setMethod()`, `setLocale()`, `setCustomerEmail()` and
`canPay` / `paymentMethods` / `feeBearer` on the snapshot.
