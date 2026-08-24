import { Component } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";

import { backendUrl } from "./api";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <nav>
      <a routerLink="/">Products</a>
      <a routerLink="/refund">Refund</a>
      <a routerLink="/transfer">Transfer</a>
      <span style="margin-left:auto;color:#aaa">backend {{ backend }}</span>
    </nav>
    <main>
      <router-outlet />
    </main>
  `,
})
export class AppComponent {
  readonly backend = backendUrl();
}
