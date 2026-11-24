# Vanilla JavaScript / TypeScript

**Purpose.** Mount the widget in any page without a framework (a bundler such as Vite, or an ES module).

**Prerequisites.** [frameworks/README.md](README.md) shared rules; the helpers `startPayment` and `buildCheckout` defined
there.

```html
<div id="checkout"></div>
<script type="module" src="/main.ts"></script>
```

```ts
import { mountCheckout } from "@mainmoneyapp/js-checkout";
import "@mainmoneyapp/js-checkout/styles.css";
import { buildCheckout, startPayment } from "./payment";

const host = document.getElementById("checkout")!;
try {
  const checkout = buildCheckout(await startPayment());
  await checkout.loadCountries();
  const unmount = mountCheckout(host, checkout, {
    variant: "embedded",
    defaultCountry: "KE",
    links: { terms: "https://shop.example/terms", privacy: "https://shop.example/privacy" },
  });

  // Know when it is over:
  const stop = checkout.subscribe((s) => {
    if (s.step === "terminal") {
      stop();
      // Ask YOUR server for the order state, then navigate.
    }
  });

  // Leaving the page (single-page apps): stop everything.
  window.addEventListener("pagehide", () => { unmount(); checkout.close(); }, { once: true });
} catch (error) {
  host.textContent = (error as Error).message;
}
```

`mountCheckout` renders into `host` (it sets `innerHTML`, so keep the element empty) and returns an unsubscribe function.
Calling it again on the same element with another `Checkout` re-renders into it; unmount the first one before.

## Headless (your own UI)

Skip `mountCheckout` and drive the `Checkout` yourself: [reference.md](../reference.md).

```ts
checkout.subscribe((s) => render(s));
await checkout.selectCountry("KE");
checkout.setIdentifier("0712345678");
await checkout.matchProvider();
await checkout.pay();
```

## Error cases

| Symptom | Cause |
| --- | --- |
| Nothing rendered | `loadCountries` failed: read `checkout.getState().error` |
| Mounted twice | You called `mountCheckout` in a handler that runs again: guard it |
| Top-level `await` error | Your bundler target is too old: use `async` functions |
