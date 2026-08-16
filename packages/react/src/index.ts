import { createElement, useEffect, useRef } from "react";

import type { Checkout } from "@mainmoney/js-checkout";
import { mountCheckout } from "@mainmoney/js-checkout";

export type CheckoutWizardProps = {
  checkout: Checkout;
  logoUrl?: string;
};

export function CheckoutWizard({ checkout, logoUrl }: CheckoutWizardProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current === null) {
      return;
    }
    return mountCheckout(ref.current, checkout, { logoUrl });
  }, [checkout, logoUrl]);
  return createElement("div", { ref });
}
