import { isPlatformBrowser } from "@angular/common";
import { Component, ElementRef, NgZone, PLATFORM_ID, effect, inject, input, untracked, viewChild } from "@angular/core";

import type { Checkout, CheckoutVariant, ColorScheme, MountOptions } from "@mainmoneyapp/js-checkout";
import { mountCheckout } from "@mainmoneyapp/js-checkout";

/**
 * Checkout wizard. Import `@mainmoneyapp/js-checkout/styles.css` once in your app
 * (`angular.json` -> `styles`, or `src/main.ts`).
 *
 * - The DOM mount only runs in the browser, so the component is safe under SSR.
 * - The widget runs **outside the Angular zone**: its debounce timers, status polling and fetch calls would
 *   otherwise trigger a change-detection pass each. It renders its own DOM and never needs Angular to.
 * - Create the `Checkout` once (in `ngOnInit`, a service or a signal), not in a template expression or getter:
 *   a new `Checkout` instance restarts the widget from the first step.
 * - `colorScheme` follows your theme signal: every change calls `checkout.setColorScheme`, which only flips the
 *   palette (the form is not re-rendered, so a focused input keeps its focus and value).
 */
@Component({
  selector: "mm-checkout-wizard",
  standalone: true,
  template: "<div #host></div>",
})
export class CheckoutWizardComponent {
  readonly checkout = input.required<Checkout>();
  readonly logoUrl = input<string | undefined>(undefined);
  readonly colorScheme = input<ColorScheme>("auto");
  readonly variant = input<CheckoutVariant>("default");
  /** `form` is the single-page checkout (default for deposits); `wizard` is the step-by-step flow. */
  readonly layout = input<MountOptions["layout"]>(undefined);
  /** Country preselected in the form layout. */
  readonly defaultCountry = input<string | undefined>(undefined);
  /** Footer links; only links with a URL are shown. */
  readonly links = input<MountOptions["links"]>(undefined);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>("host");

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);

  constructor() {
    effect((onCleanup) => {
      if (!this.isBrowser) {
        return;
      }
      // Track only the inputs that must restart the widget; the host element is stable.
      const checkout = this.checkout();
      const options: MountOptions = {
        logoUrl: this.logoUrl(),
        variant: this.variant(),
        layout: this.layout(),
        defaultCountry: this.defaultCountry(),
        links: this.links(),
      };
      const element = untracked(() => this.host().nativeElement);
      const unmount = this.zone.runOutsideAngular(() => mountCheckout(element, checkout, options));
      onCleanup(() => {
        unmount();
        element.replaceChildren();
      });
    });
    effect(() => {
      const scheme = this.colorScheme();
      const checkout = this.checkout();
      if (this.isBrowser) {
        this.zone.runOutsideAngular(() => checkout.setColorScheme(scheme));
      }
    });
  }
}
