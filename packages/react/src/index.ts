import { createElement, useEffect, useRef } from "react";

import type { Checkout, CheckoutVariant, ColorScheme } from "@mainmoneyapp/js-checkout";
import { mountCheckout } from "@mainmoneyapp/js-checkout";

export type CheckoutWizardProps = {
  checkout: Checkout;
  logoUrl?: string;
  /** Live palette: every change calls `checkout.setColorScheme` without re-rendering the form. */
  colorScheme?: ColorScheme;
  variant?: CheckoutVariant;
};

export function CheckoutWizard({ checkout, logoUrl, colorScheme, variant }: CheckoutWizardProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current === null) {
      return;
    }
    return mountCheckout(ref.current, checkout, { logoUrl, variant });
  }, [checkout, logoUrl, variant]);
  useEffect(() => {
    if (colorScheme !== undefined) {
      checkout.setColorScheme(colorScheme);
    }
  }, [checkout, colorScheme]);
  return createElement("div", { ref });
}
