import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";

import type { Checkout } from "@mainmoney/js-checkout";
import { mountCheckout } from "@mainmoney/js-checkout";

@Component({
  selector: "mm-checkout-wizard",
  standalone: true,
  template: "<div #host></div>",
})
export class CheckoutWizardComponent implements OnInit, OnDestroy {
  @Input({ required: true }) checkout!: Checkout;
  @Input() logoUrl?: string;
  @ViewChild("host", { static: true }) host!: ElementRef<HTMLElement>;

  private unmount?: () => void;

  ngOnInit(): void {
    this.unmount = mountCheckout(this.host.nativeElement, this.checkout, { logoUrl: this.logoUrl });
  }

  ngOnDestroy(): void {
    this.unmount?.();
  }
}
