import { Routes } from "@angular/router";

import { PayPageComponent } from "./pay.page";
import { ProductsPageComponent } from "./products.page";
import { RefundPageComponent } from "./refund.page";
import { TransferPageComponent } from "./transfer.page";

export const routes: Routes = [
  { path: "", component: ProductsPageComponent },
  { path: "pay/:id", component: PayPageComponent },
  { path: "refund", component: RefundPageComponent },
  { path: "transfer", component: TransferPageComponent },
];
