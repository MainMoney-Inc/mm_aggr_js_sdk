import type { Checkout, CheckoutVariant, ColorScheme } from "@mainmoneyapp/js-checkout";

export type CheckoutWizardProps = {
  checkout: Checkout;
  logoUrl?: string;
  colorScheme?: ColorScheme;
  variant?: CheckoutVariant;
};

export declare function CheckoutWizard(props: CheckoutWizardProps): unknown;
