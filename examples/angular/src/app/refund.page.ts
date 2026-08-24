import { NgFor, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";

import { listOrders, refundOrder, type Order } from "./api";

@Component({
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <h1>Refund</h1>
    <p class="error" *ngIf="error">{{ error }}</p>
    <p *ngIf="orders.length === 0">No orders yet. Pay for a product first.</p>
    <article class="card" *ngFor="let order of orders">
      <p>Ref {{ order.reference }} — {{ order.amount }} {{ order.currency }} — <strong>{{ order.status }}</strong></p>
      <button *ngIf="order.status === 'paid'" type="button" (click)="refund(order.id)">Refund</button>
    </article>
  `,
})
export class RefundPageComponent implements OnInit {
  orders: Order[] = [];
  error: string | null = null;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    void listOrders()
      .then((items) => (this.orders = items))
      .catch((err: Error) => (this.error = err.message));
  }

  refund(id: number): void {
    void refundOrder(id)
      .then(() => this.reload())
      .catch((err: Error) => (this.error = err.message));
  }
}
