# Reference: snapshot, methods, events and errors

**Purpose.** Complete list of what `Checkout` exposes, for headless use (your own UI) and for observing the widget.

**Prerequisites.** [session.md](session.md).

```ts
const checkout = createCheckout(session, options);
const state = checkout.getState();            // a deep copy: mutating it changes nothing
const stop = checkout.subscribe((s) => { /* every state change */ });
stop();
```

`getState()` returns a fresh `structuredClone` with `canPay` recomputed. `subscribe` returns an unsubscribe function.
The listener runs on every change **except** keystrokes in the phone, email and amount inputs
(`setIdentifier` and `setCustomerEmail` do not notify, so the form is not re-rendered while typing).

## `CheckoutSnapshot`

| Field | Type | Meaning |
| --- | --- | --- |
| `step` | `"country" \| "details" \| "overview" \| "confirming" \| "polling" \| "ongoing" \| "terminal" \| "error"` | Where the flow is. `terminal`: final status known. `ongoing`: created, polling disabled. `error`: failure with `onRetry` set |
| `operation` | `"deposit" \| "payout"` | From the options |
| `countries` | `Country[]` | `{ code, name, iso3_code?, phone_code?, flag? }` |
| `providers` | `Provider[]` | Providers of the selected country |
| `selectedCountry`, `selectedProvider` | optional | Current selection |
| `highlightedProviderCode` | `string?` | Provider code returned by the last number match |
| `identifier` | `string` | The raw text typed (phone or account) |
| `customerName` | `string \| null` | Name from the lookup |
| `amount` | `string` | Decimal string |
| `lockAmount` | `boolean` | Amount cannot be edited |
| `currency` | `string` | Currency of `amount` (the cart currency) |
| `lockCurrency` | `boolean` | Customer cannot choose another currency |
| `currencyFixed` | `boolean` | `currency` came from the options/session; only `payCurrency` can change |
| `payCurrency` | `string` | Currency the customer pays in |
| `availableCurrencies` | `string[]` | Currencies the provider (or all providers of the country) accept |
| `quoteUnavailable` | `boolean` | No FX rate between `currency` and `payCurrency`, and no fallback |
| `limits` | `AmountLimit?` | First limit item for the provider/currency/operation |
| `fees` | `FeeSimulation?` | Last simulation (`processing_fee`, `total_to_pay`, `merchant_receives`, `quote`, ...) |
| `partnerFee` | `PartnerFee \| null` | Result of `onPartnerFee` |
| `locale` | `"en" \| "fr"` | Current language |
| `paymentMethods` | `PaymentMethod[]` | Tabs enabled by the merchant; default `["mobile_money"]` |
| `activeMethod` | `PaymentMethod` | Selected tab |
| `feeBearer` | `"MERCHANT" \| "CUSTOMER"` | From checkout preferences; informational |
| `customerEmail` | `string` | Receipt address |
| `canPay` | `boolean` | See below |
| `error` | `string?` | Current error text (shown by the widget) |
| `status` | `StatusPayload?` | Last create/poll response |
| `slow` | `boolean` | Polling longer than `slowNoticeAfterMs` |
| `connectionLost` | `boolean` | Status polling failing now |
| `pollConfirmed` | `boolean` | First status poll succeeded |
| `theme` | `CheckoutTheme` | Resolved brand colours |
| `colorScheme` | `"light" \| "dark" \| "auto"` | Selected palette |
| `resolvedColorScheme` | `"light" \| "dark"` | Palette after resolving `auto` |

### `canPay`

`true` only when all hold: step is `details`; active method is `mobile_money`; a country is selected; the country has at
least one provider; `currency` is not empty; `quoteUnavailable` is false; `amount` is a number above 0; the normalised
number has 7 to 12 national digits. It does **not** depend on limits, on a matched provider (the lookup runs in `pay()`),
or on the email.

## `Checkout` methods

| Method | Effect |
| --- | --- |
| `t(key, vars?)` | Translate with the current locale and overrides |
| `loadCountries()` | Countries + checkout preferences. Never throws; failure sets `error` |
| `selectCountry(code)` | Load providers, go to `details`. Unknown code sets the error "Unknown country". Repeats the lookup if a number is typed |
| `selectProvider(code)` | Select, adopt its currency rules, reload limits/fees |
| `setIdentifier(value)` | Store the number; no notification |
| `setCustomerEmail(value)` | Store the trimmed email; no notification |
| `setMethod(method)` | Switch tab (ignored if not enabled) |
| `setLocale(locale)` | Switch language and notify |
| `setColorScheme(scheme)` | Switch palette; only flips attributes in `mountCheckout` |
| `matchProvider()` | Number lookup (deduplicated); no-op for an empty or already matched number |
| `setCurrency(code)` | Choose pay currency (or currency when not fixed); ignored if `lockCurrency`; unknown code sets "Unknown currency" |
| `setAmount(amount)` | Set the amount and refresh limits/fees; ignored if `lockAmount` |
| `goOverview()` | Run hooks, go to `overview` (wizard) |
| `goBack()` | overview to details to country |
| `pay()` | Single-form flow: lookup if needed, hooks, then `confirm()` |
| `confirm()` | Create the deposit/payout, then poll |
| `retry()` | `onRetry()` if set, else back to the form for a new attempt |
| `close()` | Abort polling and release `matchMedia`/theme listeners. Does not clear the DOM |

Methods that can fail record the message in `state.error` and resolve; they do not reject. Calling `confirm()` without a
selected provider sets the error "Provider is required".

## Events

The `Checkout` type exposes **one** subscription: `subscribe` (state changes). The internal bus also emits `complete`
(terminal reached or create returned a terminal status), `ongoing` (polling disabled) and `status` (final poll payload),
but there is no public method to listen to them. Observe the same moments from the snapshot:

| You want | Watch |
| --- | --- |
| Payment finished | `state.step === "terminal"`, outcome in `state.status?.status` |
| Created but not tracked (`pollStatus: false`) | `state.step === "ongoing"` |
| Polling started | `state.step === "polling"` |
| Network trouble while polling | `state.connectionLost` |
| Any error | `state.error` |

`mountCheckout(...)` returns an unsubscribe function for its own rendering; `core` also exports a tiny `Emitter` class
(`on`, `off`, `emit`) for your own use.

## Errors

Imported from `@mainmoneyapp/js-core`:

| Class | Raised when | Fields |
| --- | --- | --- |
| `FrontendSdkException` | Base class | `message` |
| `ConfigurationException` | Empty `merchantBackendUrl`; polling without `pollUrl`/`pollHeaders`; unknown country/provider/currency; missing provider on confirm | |
| `CurrencyMismatchException` | `onPartnerFee` returned another currency; `addMoney` with two currencies | |
| `MerchantBackendException` | Non-2xx answer, or `success: false` envelope | `statusCode`, `errors`, `responseBody` |

Only `createSession` and `createCheckout` throw synchronously. Everything else reaches you as `state.error` (a string:
the error's message). Network failures carry the browser's message (for example "Failed to fetch").

## Package exports

| Package | Exports |
| --- | --- |
| `@mainmoneyapp/js-core` | `createSession`, `DEFAULT_PATHS`, `joinUrl`, exception classes, `Emitter`, `EN`, `FR`, `createTranslator`, `applyTheme`, `applyColorScheme`, `themeFromPreferences`, `DEFAULT_THEME`, `isTerminalStatus`, `isMobileMoney`, `isPhoneIdentifier`, `extractCustomerName`, `isColorScheme`, `addMoney`, `addDecimalStrings`, `assertSameCurrency`, `VERSION`, and all shared types |
| `@mainmoneyapp/js-http` | `createHttp`, `decodeJson`, `FetchHttpClient`, `HttpClient`, `MerchantHttp` types |
| `@mainmoneyapp/js-checkout` | `createCheckout`, `mountCheckout`, `pollStatus`, `toE164Digits`, types `Checkout`, `CheckoutSnapshot`, `CheckoutStep`, `CreateCheckoutOptions`, `BalanceCheck`, `MountOptions`, `CheckoutVariant`, `ColorScheme`, `ColorSchemeSource`; `styles.css` |
| `@mainmoneyapp/js-react` | `CheckoutWizard` |
| `@mainmoneyapp/js-vue` | `CheckoutWizard` |
| `@mainmoneyapp/js-angular` | `CheckoutWizardComponent` (`<mm-checkout-wizard>`) |
