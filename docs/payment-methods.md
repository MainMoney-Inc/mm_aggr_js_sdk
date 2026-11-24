# Card and MainMoney tabs (payment methods)

**Purpose.** Explain how the tabs of the single-page form are chosen and what each one can do today.

**Prerequisites.** `GET /checkout-preferences` proxied by your backend ([backend-contract.md](backend-contract.md#2-get-checkout-preferences)).
The tabs exist only in the **form** layout (the default for deposits).

## How the tabs are chosen

`loadCountries()` also calls `GET /checkout-preferences`. Its `payment_methods` array is intersected with the values the
widget knows (`mobile_money`, `card`, `mainmoney`):

- Default before/without preferences: `["mobile_money"]`, active method `mobile_money`, no tab bar.
- With two or more methods a tab bar is shown, always in the order **Card, Mobile money, MainMoney** (not the order
  returned by the backend).
- If the active method is not in the list, the active method becomes the first known method in the order
  `mobile_money`, `card`, `mainmoney` that the backend listed.
- Unknown values are ignored. An empty array leaves the mobile money pane and no tabs.
- The wizard layout (payouts) has no tabs.

`snapshot.paymentMethods` and `snapshot.activeMethod` expose the state; `checkout.setMethod("card")` switches (ignored
when the method is not enabled).

## What each tab does

| Tab | Support in this SDK |
| --- | --- |
| **Mobile money** | Fully supported: the flow in [deposit-flow.md](deposit-flow.md). |
| **Card** | **Not supported.** The tab shows "Card payments are coming soon." and the Pay button stays disabled. No card data is collected and no card route is called. |
| **MainMoney** | **Not supported.** The tab shows a placeholder frame with "Pay by scanning a QR code with the MainMoney app. Coming soon." No QR code is generated and no request is made. Pay stays disabled. |

Consequences:

- `canPay` is `false` unless the active method is `mobile_money`, and `pay()` returns without doing anything otherwise.
- If the merchant has **only** `card` (or only `mainmoney`) enabled, the active method is that tab and the customer cannot
  pay in this widget. Keep `mobile_money` enabled for merchants that use the widget, or build the flow with
  [payment links](payment-links.md), which support cards.
- The merchant contract lists a card deposit validation route (`transactions/card-deposits/validate-payment/`); this widget
  never calls it, and `/deposits/validate` (`createSession({ paths: { validatePayment } })`) is also unused.

## Fee bearer

`fee_bearer` from the preferences (`MERCHANT` or `CUSTOMER`) is stored as `snapshot.feeBearer`. It does not change the
requests the widget sends; the aggregator applies the merchant's setting. The fee box always shows what the **customer**
pays (processing fee and total).

## Error cases

| Symptom | Cause |
| --- | --- |
| No tab bar although the merchant enabled several methods | `/checkout-preferences` not proxied, failed (ignored silently) or returned `payment_methods` with one entry |
| Pay disabled on the Card tab | Expected: not supported |
| Only a "coming soon" pane | Merchant has no `mobile_money` method enabled |
