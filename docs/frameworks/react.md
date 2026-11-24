# React

**Purpose.** Use `CheckoutWizard` from `@mainmoneyapp/js-react` (React 18+).

**Prerequisites.** [frameworks/README.md](README.md); `npm install @mainmoneyapp/js-react`.

```tsx
import { useEffect, useState } from "react";
import { CheckoutWizard } from "@mainmoneyapp/js-react";
import type { Checkout } from "@mainmoneyapp/js-checkout";
import "@mainmoneyapp/js-checkout/styles.css";
import { buildCheckout, startPayment } from "./payment";

export function PayPage({ scheme }: { scheme: "light" | "dark" | "auto" }) {
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let instance: Checkout | undefined;
    startPayment()
      .then(async (cfg) => {
        instance = buildCheckout(cfg);
        await instance.loadCountries();
        if (!cancelled) setCheckout(instance);
        else instance.close();
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      instance?.close();
    };
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!checkout) return <p>Starting checkout…</p>;
  return <CheckoutWizard checkout={checkout} colorScheme={scheme} variant="embedded" />;
}
```

Notes:

- The `Checkout` lives in state, built inside an effect with an empty dependency list: **never** call `buildCheckout` in the
  render body. In React Strict Mode (development) the effect runs twice; the cleanup above closes the first instance, and your session endpoint is called twice (development only).
- The wrapper mounts in an effect keyed on `checkout`, `logoUrl` and `variant`; changing any of them re-mounts (the form
  restarts). `colorScheme` changes only flip the palette (`checkout.setColorScheme`).
- If you do not pass `colorScheme`, the one given to `createCheckout` (default `auto`) is kept.
- The wrapper does not call `checkout.close()`: do it in your own cleanup, as above.
- To start a **new** attempt (for `onRetry`), build a new `Checkout`, `setCheckout(next)` and close the old one.
- `layout`, `defaultCountry` and `links` are not wrapper props. Mount yourself:

```tsx
import { useEffect, useRef } from "react";
import { mountCheckout } from "@mainmoneyapp/js-checkout";

function Custom({ checkout }: { checkout: Checkout }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => mountCheckout(ref.current!, checkout, { layout: "wizard", defaultCountry: "CD", links: { help: "https://shop.example/help" } }), [checkout]);
  return <div ref={ref} />;
}
```

Observe the result with `checkout.subscribe` inside an effect (and return its unsubscribe):

```tsx
useEffect(() => checkout.subscribe((s) => { if (s.step === "terminal") onDone(s.status?.status ?? ""); }), [checkout]);
```

## Error cases

| Symptom | Cause |
| --- | --- |
| Restarts on every render | `Checkout` created during render |
| Blank, no error | Strict Mode closed the instance you still use: build inside the effect as shown |
| Palette prop ignored | The prop only applies when defined; pass a valid `light`/`dark`/`auto` |
