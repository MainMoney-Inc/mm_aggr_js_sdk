import { NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { CheckoutWizardComponent } from "@mainmoney/js-angular";
import { createCheckout, type Checkout } from "@mainmoney/js-checkout";
import { createSession } from "@mainmoney/js-core";

import { createPaySession } from "./api";

@Component({
  standalone: true,
  imports: [NgIf, CheckoutWizardComponent],
  template: `
    <h1>Pay</h1>
    <p class="error" *ngIf="error">{{ error }}</p>
    <mm-checkout-wizard *ngIf="checkout" [checkout]="checkout" />
    <p *ngIf="!checkout && !error">Starting checkout…</p>
  `,
})
export class PayPageComponent implements OnInit {
  checkout: Checkout | null = null;
  error: string | null = null;

  constructor(private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get("id"));
    void createPaySession(id)
      .then(async (cfg) => {
        const session = createSession({
          merchantBackendUrl: cfg.merchantBackendUrl,
          clientToken: cfg.clientToken,
          locale: cfg.locale ?? "en",
        });
        const instance = createCheckout(session, {
          operation: "deposit",
          pollUrl: cfg.pollUrl,
          pollHeaders: cfg.pollHeaders,
          amount: cfg.amount ?? undefined,
          lockAmount: cfg.lockAmount === true,
          reference: cfg.reference,
        });
        await instance.loadCountries();
        this.checkout = instance;
      })
      .catch((err: Error) => (this.error = err.message));
  }
}
