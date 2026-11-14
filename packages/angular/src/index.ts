import { isPlatformBrowser } from "@angular/common";
import { Component, ElementRef, PLATFORM_ID, effect, inject, input, viewChild } from "@angular/core";

import type { Checkout, CheckoutVariant, ColorScheme } from "@mainmoneyapp/js-checkout";
import { mountCheckout } from "@mainmoneyapp/js-checkout";

/**
 * Checkout wizard. Import `@mainmoneyapp/js-checkout/styles.css` once in your app
 * (`angular.json` -> `styles`, or `src/main.ts`).
 *
 * The DOM mount only runs in the browser, so the component is safe under SSR.
 * `colorScheme` follows your theme signal: every change calls `checkout.setColorScheme`, which only flips the
 * palette (the form is not re-rendered, so a focused input keeps its focus and value).
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
  private readonly host = viewChild.required<ElementRef<HTMLElement>>("host");

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    effect((onCleanup) => {
      if (!this.isBrowser) {
        return;
      }
      const unmount = mountCheckout(this.host().nativeElement, this.checkout(), {
        logoUrl: this.logoUrl(),
        variant: this.variant(),
      });
      onCleanup(unmount);
    });
    effect(() => {
      if (this.isBrowser) {
        this.checkout().setColorScheme(this.colorScheme());
      }
    });
  }
}
