# Theming, i18n, dark mode and layout

**Purpose.** Make the widget match your brand and language: colours, CSS variables, light/dark palette, layout variants
and message overrides.

**Prerequisites.** `import "@mainmoneyapp/js-checkout/styles.css"` once in your app. Without it the widget renders
unstyled.

## Brand colours: where they come from

Four colours: `primary`, `secondary`, `accent`, `background`, written as `--mm-color-primary`, `-secondary`, `-accent` and
`-background` on the mount element. Sources, lowest to highest priority:

1. Built-in defaults `#ff3366`, `#5f5e5e`, `#b90040`, `#f8f9fb`.
2. `createSession({ theme })`, then `createCheckout(session, { theme })` (merged in that order).
3. `GET /checkout-preferences` (`primary_color`, `secondary_color`, `accent_color`, `background_color`): applied by
   `loadCountries()` **when `primary_color` is present** and then replaces all four (missing ones keep the previous
   value). To keep your own colours, do not proxy that route or have it answer without `primary_color`.

`snapshot.theme` shows the resolved colours.

## Dark mode

```ts
const checkout = createCheckout(session, { operation: "deposit", colorScheme: "auto" }); // "light" | "dark" | "auto"
checkout.setColorScheme("dark"); // flips data-mm-theme; the form is not re-rendered (focus and typed values survive)
```

- Default is `auto`: the widget follows `prefers-color-scheme` live through `matchMedia` and stops listening on
  `checkout.close()`.
- `snapshot.colorScheme` is the selection; `snapshot.resolvedColorScheme` is `light` or `dark` (`auto` resolved).
- Bind your own theme store: `colorScheme: { get(): ColorScheme, subscribe(cb): () => void }`. The widget follows it until
  `close()`.
- The mount element carries `data-mm-theme="light|dark|auto"`, `data-mm-resolved-theme="light|dark"` and
  `data-mm-variant="default|embedded"`.
- Wrappers: React and Vue take a `colorScheme` prop, Angular a `[colorScheme]` input ([frameworks/](frameworks/README.md)).
- Provider logo tiles stay light in dark mode so logos remain legible.

## CSS variables

All colours are CSS variables declared on the mount element (the element with class `mm-checkout`).

**Important:** because they are declared *on that element*, a value set on an **ancestor** does not override them. Override
them one of these ways:

```css
/* 1. Selectors more specific than the widget's own (an id beats its class selectors) */
#checkout.mm-checkout { --mm-color-ink: #111; --mm-color-line: #d0d0d0; }                 /* light, and base for all */
#checkout.mm-checkout[data-mm-theme="dark"] { --mm-color-ink: #f5f5f5; }                  /* explicit dark */
@media (prefers-color-scheme: dark) {
  #checkout.mm-checkout[data-mm-theme="auto"] { --mm-color-ink: #f5f5f5; }                /* auto resolving to dark */
}
```

```ts
// 2. Inline on the mount element (wins over both palettes; the four brand colours are re-applied from the theme on each render)
document.getElementById("checkout")!.style.setProperty("--mm-color-ink", "#111");
```

Only `--mm-max-width`, `--mm-padding` and `--mm-radius` are not declared by the widget, so they can be set on the mount
element or on any ancestor.

| Variable | Purpose | Light default |
| --- | --- | --- |
| `--mm-color-primary`, `-secondary`, `-accent` | Brand colours (from the theme, see above) | `#ff3366`, `#5f5e5e`, `#b90040` |
| `--mm-color-background` | Merchant page background | `#f8f9fb` |
| `--mm-color-surface` | Card surface | the background |
| `--mm-color-ink` | Main text | `#170f2e` |
| `--mm-color-muted` | Secondary text, labels | `#5b5f66` |
| `--mm-color-line` | Borders, dividers | `#cfd2d6` |
| `--mm-color-input-bg` | Inputs, selects, dial code | `#ffffff` |
| `--mm-color-error`, `--mm-color-success` | Error and success text | `#b90040`, `#0b7a43` |
| `--mm-color-tile-bg`, `--mm-color-tile-ink` | Provider tiles | `#ffffff`, `#191c1e` |
| `--mm-color-surface-alt`, `-fee-bg`, `-notice-bg`, `-notice-ink`, `-on-primary`, `-on-ink`, `-disabled`, `-disabled-ink` | Tabs, fee box, notices, button text, disabled Pay | see `styles.css` |
| `--mm-max-width` | Cap the card width | `none` |
| `--mm-padding` | Card padding | `1.5rem` (form layout: `1rem 1.25rem 1.25rem`) |
| `--mm-radius` | Card radius | `16px` |

Dark palettes (`[data-mm-theme="dark"]`, and `auto` under `prefers-color-scheme: dark`) keep WCAG AA text contrast.

## Layout

`mountCheckout(element, checkout, options)` options:

| Option | Values | Meaning |
| --- | --- | --- |
| `layout` | `"form"` / `"wizard"` | `form`: single page (default for deposits). `wizard`: step by step (default for payouts) |
| `variant` | `"default"` / `"embedded"` | `embedded` drops the card surface, padding, radius and shadow: use inside your own modal or card |
| `defaultCountry` | ISO code | Country preselected by the form layout (default: first country) |
| `links` | `{ privacy, terms, security, help }` | Footer links; only links with a URL are rendered (open in a new tab with `noopener noreferrer`) |
| `logoUrl` | URL | Replaces the embedded MainMoney logo (header and spinner) |

The widget fills its parent (`width: 100%`, no `max-width`). Provider tiles and the fee box reflow with container queries
(from 320 px up). The form layout has an EN/FR toggle in its header that calls `setLocale`.

## Messages and i18n

Supported locales: `en`, `fr`. Pick with `createSession({ locale })` or `createCheckout({ locale })`, or at runtime with
`checkout.setLocale("fr")`.

Override copy with `messages`; session messages are merged first, then the checkout's. Overrides apply to **both**
languages. Placeholders use `{name}`.

```ts
createCheckout(session, {
  operation: "deposit",
  messages: { formTitle: "Pay your order", pay: "Pay now", limits: "Enter between {min} and {max}" },
  // ...
});
```

Keys (all strings in `EN`/`FR`, exported from `@mainmoneyapp/js-core`): `country`, `selectCountry`, `provider`,
`selectProvider`, `phone`, `account`, `customerName`, `amount`, `currency`, `fees`, `partnerFee`, `total`, `netAmount`,
`overview`, `confirm`, `back`, `next`, `ongoing`, `success`, `failed`, `confirming`, `polling`, `slow`, `lookingUp`,
`connectionLost`, `limits`, `required`, `balanceRejected`, `highlighted`, `formTitle`, `formSubtitle`, `tabCard`,
`tabMobileMoney`, `tabMainMoney`, `emailLabel`, `emailPlaceholder`, `emailHint`, `phoneHint`, `merchantReceives`,
`processingFee`, `youPay`, `pay`, `language`, `poweredBy`, `rights`, `privacy`, `terms`, `security`, `help`, `cardSoon`,
`mainmoneySoon`, `noProviders`, `noQuote`, `payIn`, `exchangeRate`, `retry`, `retryHint`.

`checkout.t(key, vars)` translates with the current locale; an unknown key returns the key. Errors coming from your
backend (`message`) are shown as is and are not translated by the widget: localise them on your server.

## Error cases

| Symptom | Cause |
| --- | --- |
| Unstyled widget | `styles.css` not imported |
| Brand colours differ from `theme` | `/checkout-preferences` returned colours and won |
| A CSS variable override has no effect | Set on an ancestor; use the element itself or a selector as above |
| Wrong language for an error | The text comes from your backend `message` |
