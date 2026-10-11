import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from "@angular/core";

import type { Checkout } from "@mainmoneyapp/js-checkout";
import { mountCheckout } from "@mainmoneyapp/js-checkout";

/**
 * Checkout wizard. Import `@mainmoneyapp/js-checkout/styles.css` once in your app
 * (`angular.json` -> `styles`, or `src/main.ts`).
 *
 * The DOM mount only runs in the browser, so the component is safe under SSR.
 */
@Component({
  selector: "mm-checkout-wizard",
  standalone: true,
  template: "<div #host></div>",
})
export class CheckoutWizardComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) checkout!: Checkout;
  @Input() logoUrl?: string;
  @ViewChild("host", { static: true }) host!: ElementRef<HTMLElement>;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private unmount?: () => void;

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isBrowser || !this.checkout) {
      return;
    }
    if (changes["checkout"] || changes["logoUrl"]) {
      this.unmount?.();
      this.unmount = mountCheckout(this.host.nativeElement, this.checkout, { logoUrl: this.logoUrl });
    }
  }

  ngOnDestroy(): void {
    this.unmount?.();
  }
}
