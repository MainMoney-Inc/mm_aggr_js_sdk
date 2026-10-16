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
  slow: "Your payment request has been sent. We are waiting for the provider to confirm success or failure. Please keep this page open.",
  limits: "Amount must be between {min} and {max}",
  required: "This field is required",
  balanceRejected: "Balance validation failed",
  highlighted: "Matched provider",
  formTitle: "Complete your payment",
  formSubtitle: "Enter your details below. Your payment is encrypted and processed securely.",
  tabCard: "Card",
  tabMobileMoney: "Mobile money",
  tabMainMoney: "MainMoney",
  emailLabel: "Email for receipt (optional)",
  emailPlaceholder: "you@example.com",
  emailHint: "We'll send a payment receipt to this address when your payment succeeds.",
  phoneHint: "Enter the local number without the country code.",
  merchantReceives: "Merchant receives",
  processingFee: "Processing fee",
  youPay: "You pay",
  pay: "Pay",
  language: "Language",
  poweredBy: "Powered by",
  rights: "All rights reserved.",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  security: "Security",
  help: "Help Center",
  cardSoon: "Card payments are coming soon.",
  mainmoneySoon: "Pay by scanning a QR code with the MainMoney app. Coming soon.",
  noProviders: "No mobile money provider is available for this country.",
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
  slow: "Votre demande de paiement a été envoyée. Nous attendons la confirmation (succès ou échec) de l'opérateur. Veuillez garder cette page ouverte.",
  limits: "Le montant doit être compris entre {min} et {max}",
  required: "Ce champ est obligatoire",
  balanceRejected: "Validation du solde échouée",
  highlighted: "Fournisseur correspondant",
  formTitle: "Finalisez votre paiement",
  formSubtitle: "Saisissez vos informations ci-dessous. Votre paiement est chiffré et traité de manière sécurisée.",
  tabCard: "Carte",
  tabMobileMoney: "Mobile money",
  tabMainMoney: "MainMoney",
  emailLabel: "E-mail pour le reçu (facultatif)",
  emailPlaceholder: "vous@exemple.com",
  emailHint: "Nous enverrons un reçu à cette adresse lorsque votre paiement aura réussi.",
  phoneHint: "Saisissez le numéro local sans l'indicatif du pays.",
  merchantReceives: "Le marchand reçoit",
  processingFee: "Frais de traitement",
  youPay: "Vous payez",
  pay: "Payer",
  language: "Langue",
  poweredBy: "Propulsé par",
  rights: "Tous droits réservés.",
  privacy: "Politique de confidentialité",
  terms: "Conditions d'utilisation",
  security: "Sécurité",
  help: "Centre d'aide",
  cardSoon: "Le paiement par carte sera bientôt disponible.",
  mainmoneySoon: "Payez en scannant un code QR avec l'application MainMoney. Bientôt disponible.",
  noProviders: "Aucun opérateur mobile money n'est disponible pour ce pays.",
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
