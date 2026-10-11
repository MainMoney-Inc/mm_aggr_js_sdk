import type { Checkout } from "@mainmoneyapp/js-checkout";

export type CheckoutWizardProps = {
  checkout: Checkout;
  logoUrl?: string;
};

export declare function CheckoutWizard(props: CheckoutWizardProps): unknown;
