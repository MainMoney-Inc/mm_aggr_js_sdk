# Changelog

## Unreleased

- Checkout keeps the cart currency: `currency` fixes the amount's currency and the widget only chooses the
  currency the customer pays in (`payCurrency`), through a `payment_currency` fee quote. When there is no quote
  it falls back to the cart currency with "Conversion between {from} and {to} is not available".
- Pay currency selector shown even when the amount is locked; fee box shows the converted amounts and the rate.
- Failed payments: new `error` step with only the reason and a Retry button; `onRetry` lets hosts start a new
  session, otherwise Retry resubmits with a `-r<N>` reference and Idempotency-Key suffix.
- `customerEmail` option pre-fills the receipt address.
- Countries are de-duplicated; countries and checkout preferences load in parallel; providers are cached per
  country for the life of the widget.

## 0.1.1

- Relicensed under the MIT License.
- Package scope is now `@mainmoneyapp` (`@mainmoneyapp/js-*`).
- First release published to npm.
