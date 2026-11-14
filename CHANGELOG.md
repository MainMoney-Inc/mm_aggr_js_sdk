# Changelog

## 0.1.4

- Security: `joinUrl` trims slashes in linear time (CodeQL `js/polynomial-redos`).
- Security: dependency updates (vite, vitest 4, fast-uri, source-map-js, tinypool); the Angular wrapper and example build on Angular 21.
- Workflows declare least-privilege `permissions: contents: read` (CodeQL).

## 0.1.3

- Fix: `match-provider` and `canPay` used the bare local number until a provider was selected. Mobile money
  numbers are now always normalised to `<dial code><national>` (`987805910`, `0987805910`, `+243987805910` all give
  `243987805910`); changing the country repeats the lookup for a typed number.
- `createSession({ currency, lockCurrency })` set the defaults for `createCheckout`; documented and tested that the
  cart `currency` is kept while `payCurrency` follows the provider through a quote.
- Dark mode and live theming: `colorScheme` option (`light` | `dark` | `auto`, default `auto`, or a `{ get, subscribe }`
  signal), `Checkout.setColorScheme()`, `CheckoutSnapshot.colorScheme` / `resolvedColorScheme`. `auto` follows
  `prefers-color-scheme` live and unsubscribes on `close()`. Switching does not re-render the form.
- Every colour in `styles.css` is a CSS variable (`--mm-color-surface|ink|muted|line|input-bg|error|success`, ...)
  with a light, a dark and an auto palette (WCAG AA). Provider logo tiles keep a light surface.
- Layout: the widget fills its parent (no `max-width`); `--mm-max-width`, `--mm-padding`, `--mm-radius`;
  `variant: "embedded"`; provider tiles and fee box reflow with container queries.
- Angular `CheckoutWizardComponent` now uses signal inputs (`checkout`, `logoUrl`, `colorScheme`, `variant`);
  peer range is Angular `>=17.2`. React and Vue wizards take `colorScheme` and `variant` props.
- Re-exported `ColorScheme`, `ColorSchemeSource`, `CheckoutVariant` from `@mainmoneyapp/js-checkout`.

Also in this release (previously unreleased):

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
