export { createSession, type CreateSessionOptions, type Session } from "./session.js";
export {
  ConfigurationException,
  CurrencyMismatchException,
  FrontendSdkException,
  MerchantBackendException,
} from "./errors.js";
export { addDecimalStrings, addMoney, assertSameCurrency, type Money } from "./money.js";
export { DEFAULT_PATHS, joinUrl, type MerchantPaths } from "./paths.js";
export { Emitter, type Listener } from "./events.js";
export { EN, FR, createTranslator, type MessageCatalog } from "./i18n.js";
export { applyTheme, themeFromPreferences } from "./theme.js";
export {
  DEFAULT_THEME,
  extractCustomerName,
  isMobileMoney,
  isPhoneIdentifier,
  isTerminalStatus,
  type AmountLimit,
  type CheckoutLocale,
  type CheckoutTheme,
  type Country,
  type DepositRequest,
  type FeeSimulation,
  type OperationType,
  type PartnerFee,
  type PayoutRequest,
  type Provider,
  type StatusPayload,
} from "./types.js";

export const VERSION = "0.1.0";
