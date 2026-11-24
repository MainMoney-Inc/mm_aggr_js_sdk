# Angular

**Purpose.** Use the standalone `CheckoutWizardComponent` (`<mm-checkout-wizard>`) from `@mainmoneyapp/js-angular`.

**Prerequisites.** [frameworks/README.md](README.md); Angular **17.2 or later** (signal inputs, `effect`); the package is built
with ng-packagr, so install it from its `dist` (see `packages/angular/README.md` for the build and `npm pack` steps).

Import the stylesheet once: `angular.json` -> `styles: ["node_modules/@mainmoneyapp/js-checkout/dist/styles.css"]`, or
`import "@mainmoneyapp/js-checkout/styles.css"` in `main.ts`.

```ts
import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { CheckoutWizardComponent } from "@mainmoneyapp/js-angular";
import type { Checkout } from "@mainmoneyapp/js-checkout";
import { buildCheckout, startPayment } from "./payment";

@Component({
  selector: "app-pay",
  standalone: true,
  imports: [CheckoutWizardComponent],
  template: `
    @if (checkout(); as c) {
      <mm-checkout-wizard [checkout]="c" [colorScheme]="scheme()" variant="embedded" defaultCountry="KE"
        [links]="{ terms: 'https://shop.example/terms' }" />
    } @else if (error()) {
      <p role="alert">{{ error() }}</p>
    } @else {
      <p>Starting checkout…</p>
    }
  `,
})
export class PayComponent implements OnInit, OnDestroy {
  readonly checkout = signal<Checkout | null>(null);
  readonly error = signal<string | null>(null);
  readonly scheme = signal<"light" | "dark" | "auto">("auto");

  async ngOnInit(): Promise<void> {
    try {
      const instance = buildCheckout(await startPayment());
      await instance.loadCountries();
      this.checkout.set(instance);            // created ONCE, here, not in the template
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  ngOnDestroy(): void {
    this.checkout()?.close();                 // the component does not close it for you
  }
}
```

## Inputs

| Input | Type | Default | Note |
| --- | --- | --- | --- |
| `checkout` | `Checkout` | required | Same instance for the life of the payment |
| `logoUrl` | `string` | `undefined` | |
| `colorScheme` | `ColorScheme` | `undefined` | When bound, calls `checkout.setColorScheme` on every change (outside the zone); unset keeps the scheme given to `createCheckout` |
| `variant` | `CheckoutVariant` | `"default"` | `"embedded"` for a host modal/card |
| `layout` | `"form" \| "wizard"` | `undefined` | Deposits default to `form`, payouts to `wizard` |
| `defaultCountry` | `string` | `undefined` | ISO code preselected in the form |
| `links` | `{ privacy?, terms?, security?, help? }` | `undefined` | Footer links |

Changing `checkout`, `logoUrl`, `variant`, `layout`, `defaultCountry` or `links` re-mounts the widget (the form restarts);
changing only `colorScheme` does not.

**`colorScheme`:** leave the input unset to keep the scheme you passed to `createCheckout` (default `auto`); bind it to
drive the palette from your own theme signal.

## Zone and change detection

- The component mounts the widget **outside the Angular zone**: debounce timers, status polling and fetches would
  otherwise trigger a change-detection pass each. The widget renders its own DOM and does not need Angular for it.
- Consequence for your code: callbacks you register with `checkout.subscribe(...)` are called from that outside-zone
  context. Signals update your template regardless; if you use plain fields with default change detection, wrap the update:

```ts
constructor(private readonly zone: NgZone) {}
// ...
this.stop = checkout.subscribe((s) => this.zone.run(() => { this.step = s.step; }));
```

- `loadCountries()` called from `ngOnInit` runs inside the zone: fine, it is a handful of requests.

## SSR and signals

- Server-side rendering is safe: the mount only runs in the browser (`isPlatformBrowser`); on the server the component
  renders an empty `<div>`. Your own `ngOnInit` also runs on the server, though: guard it with
  `isPlatformBrowser(inject(PLATFORM_ID))` so the payment session and `loadCountries()` happen in the customer's browser,
  not during server rendering.
- `checkout` is a signal input: pass a signal value in the template (`[checkout]="c"` above) or `[checkout]="checkout()!"`.
  Do not create it in a getter or template call (`[checkout]="make()"`): a new `Checkout` each change detection restarts the widget.
- The component's `effect` clears the host DOM and unmounts on destroy.

## Error cases

| Symptom | Cause |
| --- | --- |
| Widget restarts constantly | Checkout created in a getter/template expression |
| "Required input" error | `checkout` was `null` when the component rendered: guard with `@if` |
| Spinner or text stays stale in an old Angular without signals | Angular below 17.2 is not supported |
