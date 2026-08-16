import type { Checkout } from "@mainmoney/js-checkout";

export type CheckoutWizardProps = {
  checkout: Checkout;
  logoUrl?: string;
};

export declare function CheckoutWizard(props: CheckoutWizardProps): unknown;
