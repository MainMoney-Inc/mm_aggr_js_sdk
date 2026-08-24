import { NgFor, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { listProducts, type Product } from "./api";

@Component({
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <h1>Products</h1>
    <p class="error" *ngIf="error">{{ error }}</p>
    <article class="card" *ngFor="let product of products">
      <h2>{{ product.name }}</h2>
      <p>{{ product.description }}</p>
      <p><strong>{{ product.price }} {{ product.currency }}</strong></p>
      <button type="button" (click)="pay(product.id)">Pay</button>
    </article>
  `,
})
export class ProductsPageComponent implements OnInit {
  products: Product[] = [];
  error: string | null = null;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    void listProducts()
      .then((items) => (this.products = items))
      .catch((err: Error) => (this.error = err.message));
  }

  pay(id: number): void {
    void this.router.navigate(["/pay", id]);
  }
}
