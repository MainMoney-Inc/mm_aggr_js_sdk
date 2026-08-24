import "zone.js";
import "@mainmoney/js-checkout/styles.css";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, withHashLocation } from "@angular/router";

import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes, withHashLocation())],
}).catch((error: unknown) => console.error(error));
