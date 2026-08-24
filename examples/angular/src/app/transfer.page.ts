import { NgFor, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CheckoutWizardComponent } from "@mainmoney/js-angular";
import { createCheckout, type Checkout } from "@mainmoney/js-checkout";
import { createSession } from "@mainmoney/js-core";

import { createPayoutSession, listTransfers, type Transfer } from "./api";

@Component({
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, CheckoutWizardComponent],
  template: `
    <h1>Transfer (payout)</h1>
    <form class="card" (submit)="startPayout($event)">
      <p><label>Amount <input name="amount" [(ngModel)]="amount" required /></label></p>
      <p><label>Currency <input name="currency" [(ngModel)]="currency" required /></label></p>
      <button type="submit">Start payout</button>
    </form>
    <p class="error" *ngIf="error">{{ error }}</p>
    <mm-checkout-wizard *ngIf="checkout" [checkout]="checkout" />
    <h2>Recent transfers</h2>
    <article class="card" *ngFor="let item of transfers">
      <p>Ref {{ item.reference }} — {{ item.amount }} {{ item.currency }} → {{ item.destination || "—" }} — <strong>{{ item.status }}</strong></p>
    </article>
  `,
})
export class TransferPageComponent implements OnInit {
  amount = "5.00";
  currency = "USD";
  checkout: Checkout | null = null;
  transfers: Transfer[] = [];
  error: string | null = null;

  ngOnInit(): void {
    void listTransfers()
      .then((items) => (this.transfers = items))
      .catch((err: Error) => (this.error = err.message));
  }

  startPayout(event: Event): void {
    event.preventDefault();
    void createPayoutSession(this.amount, this.currency)
      .then(async (cfg) => {
        const session = createSession({
          merchantBackendUrl: cfg.merchantBackendUrl,
          clientToken: cfg.clientToken,
          locale: cfg.locale ?? "en",
        });
        const instance = createCheckout(session, {
          operation: "payout",
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
