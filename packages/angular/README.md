# @mainmoneyapp/js-angular

Angular standalone `CheckoutWizardComponent` (`<mm-checkout-wizard>`).
Peer dependencies: `@angular/core` and `@angular/common` >= 17.
See the [root README](../../README.md).

## Build and install

Always build from the SDK root so `core`, `http` and `checkout` are built before the wrapper:

```bash
npm install && npm run build
```

ng-packagr writes the publishable package to `packages/angular/dist` (it generates the
`exports`, `module` and `typings` fields). Publish or install **from `dist`**:

```bash
npm pack ./packages/angular/dist ./packages/checkout ./packages/core ./packages/http
# then in your Angular app: npm install ./mainmoney-js-*.tgz
```

or, for local development, `"@mainmoneyapp/js-angular": "file:<path>/packages/angular/dist"`.

## Usage

Import the stylesheet once, in `angular.json` -> `styles` or `src/main.ts`:

```ts
import "@mainmoneyapp/js-checkout/styles.css";
```

```ts
import { CheckoutWizardComponent } from "@mainmoneyapp/js-angular";

@Component({
  standalone: true,
  imports: [CheckoutWizardComponent],
  template: `<mm-checkout-wizard [checkout]="checkout" />`,
})
export class PayComponent implements OnInit {
  checkout?: Checkout;

  async ngOnInit(): Promise<void> {
    const checkout = createCheckout(session, { operation: "deposit", pollUrl, pollHeaders });
    await checkout.loadCountries();
    this.checkout = checkout; // create once; a new instance restarts the widget
  }
}
```

- The logo is embedded, so no `assets` entry is needed. Pass `[logoUrl]` to override it.
- Changing `[checkout]` or `[logoUrl]` remounts the wizard.
- Nothing is mounted on the server, so SSR is safe.
- Inputs: `checkout` (required), `logoUrl`, `colorScheme`, `variant`, `layout` (`form` | `wizard`), `defaultCountry`, `links`.
- The widget runs outside the Angular zone, so its polling and debounce timers do not trigger change detection.
- Create the `Checkout` once. Never build it in a template expression or getter.
- On `ngOnDestroy` of the host page call `checkout.close()` to stop status polling.
- The merchant backend must allow CORS for your origin, see [docs/troubleshooting.md](../../docs/troubleshooting.md) and [docs/frameworks/angular.md](../../docs/frameworks/angular.md).
