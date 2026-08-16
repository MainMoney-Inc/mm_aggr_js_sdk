/** Checkout copy. Merchants may override keys via `messages`. */

import type { CheckoutLocale } from "./types.js";

export type MessageCatalog = Record<string, string>;

export const EN: MessageCatalog = {
  country: "Country",
  selectCountry: "Select a country",
  provider: "Provider",
  selectProvider: "Select a provider",
  phone: "Phone number",
  account: "Account number",
  customerName: "Customer name",
  amount: "Amount",
  currency: "Currency",
  fees: "Fees",
  partnerFee: "Partner fee",
  total: "Total",
  netAmount: "Net amount",
  overview: "Overview",
  confirm: "Confirm",
  back: "Back",
  next: "Next",
  ongoing: "Transaction ongoing",
  success: "Payment succeeded",
  failed: "Payment failed",
  confirming: "Confirming payment",
  polling: "Waiting for confirmation",
  limits: "Amount must be between {min} and {max}",
  required: "This field is required",
  balanceRejected: "Balance validation failed",
  highlighted: "Matched provider",
};

export const FR: MessageCatalog = {
  country: "Pays",
  selectCountry: "Sélectionnez un pays",
  provider: "Fournisseur",
  selectProvider: "Sélectionnez un fournisseur",
  phone: "Numéro de téléphone",
  account: "Numéro de compte",
  customerName: "Nom du client",
  amount: "Montant",
  currency: "Devise",
  fees: "Frais",
  partnerFee: "Frais partenaire",
  total: "Total",
  netAmount: "Montant net",
  overview: "Récapitulatif",
  confirm: "Confirmer",
  back: "Retour",
  next: "Suivant",
  ongoing: "Transaction en cours",
  success: "Paiement réussi",
  failed: "Paiement échoué",
  confirming: "Confirmation du paiement",
  polling: "En attente de confirmation",
  limits: "Le montant doit être compris entre {min} et {max}",
  required: "Ce champ est obligatoire",
  balanceRejected: "Validation du solde échouée",
  highlighted: "Fournisseur correspondant",
};

const CATALOGS: Record<CheckoutLocale, MessageCatalog> = { en: EN, fr: FR };

export function createTranslator(
  locale: CheckoutLocale,
  overrides: Partial<MessageCatalog> = {},
): (key: string, vars?: Record<string, string>) => string {
  const catalog = { ...CATALOGS[locale], ...overrides };
  return (key, vars = {}) => {
    let text = catalog[key] ?? key;
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, value);
    }
    return text;
  };
}
