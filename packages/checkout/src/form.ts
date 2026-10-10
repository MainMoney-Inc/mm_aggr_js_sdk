/** Single-form checkout layout: tabs, phone with dial code, fee box, provider logos, Pay button. */

import type { CheckoutLocale, Country, PaymentMethod, Provider } from "@mainmoney/js-core";

import type { Checkout, CheckoutSnapshot } from "./checkout.js";

export type FooterLinkKey = "privacy" | "terms" | "security" | "help";

export type FooterLinks = Partial<Record<FooterLinkKey, string>>;

const LOCALES: CheckoutLocale[] = ["en", "fr"];
const TAB_LABEL_KEYS: Record<PaymentMethod, string> = {
  mobile_money: "tabMobileMoney",
  card: "tabCard",
  mainmoney: "tabMainMoney",
};
/** Display order of the tabs, independent of the order the backend lists them in. */
const TAB_ORDER: PaymentMethod[] = ["card", "mobile_money", "mainmoney"];
const FOOTER_LINK_KEYS: FooterLinkKey[] = ["privacy", "terms", "security", "help"];

/** Wraps `body` with the header (language toggle, powered-by) and footer shared by every form step. */
export function formChrome(
  checkout: Checkout,
  state: CheckoutSnapshot,
  logoUrl: string,
  links: FooterLinks,
  body: HTMLElement,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "mm-form";
  root.append(header(checkout, state, logoUrl), body, footer(checkout, links));
  return root;
}

export function formBody(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const body = document.createElement("div");
  body.className = "mm-form-body";

  const title = document.createElement("h2");
  title.className = "mm-title";
  title.textContent = checkout.t("formTitle");
  const subtitle = document.createElement("p");
  subtitle.className = "mm-subtitle";
  subtitle.textContent = checkout.t("formSubtitle");
  body.append(title, subtitle);

  if (state.paymentMethods.length > 1) {
    body.append(tabs(checkout, state));
  }
  if (state.activeMethod === "mobile_money") {
    body.append(mobileMoneyPane(checkout, state));
  } else if (state.activeMethod === "card") {
    body.append(placeholderPane(checkout.t("cardSoon")));
  } else {
    body.append(qrPane(checkout.t("mainmoneySoon")));
  }
  body.append(payButton(checkout, state));
  return body;
}

function header(checkout: Checkout, state: CheckoutSnapshot, logoUrl: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "mm-header";

  const language = document.createElement("div");
  language.className = "mm-language";
  const caption = document.createElement("span");
  caption.textContent = `${checkout.t("language")}:`;
  language.append(caption);
  for (const locale of LOCALES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mm-language-option";
    button.textContent = locale.toUpperCase();
    button.setAttribute("aria-pressed", String(state.locale === locale));
    if (state.locale === locale) {
      button.classList.add("is-active");
    }
    button.addEventListener("click", () => checkout.setLocale(locale));
    language.append(button);
  }

  const powered = document.createElement("div");
  powered.className = "mm-powered";
  const text = document.createElement("span");
  text.textContent = checkout.t("poweredBy");
  const logo = document.createElement("img");
  logo.src = logoUrl;
  logo.alt = "";
  logo.className = "mm-powered-logo";
  const brand = document.createElement("strong");
  brand.className = "mm-powered-brand";
  brand.textContent = "MainMoney";
  powered.append(text, logo, brand);

  row.append(language, powered);
  return row;
}

function footer(checkout: Checkout, links: FooterLinks): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "mm-footer";
  const copyright = document.createElement("div");
  copyright.className = "mm-copyright";
  copyright.textContent = `© ${new Date().getFullYear()} MainMoney. ${checkout.t("rights")}`;
  wrap.append(copyright);
  const nav = document.createElement("nav");
  nav.className = "mm-footer-links";
  for (const key of FOOTER_LINK_KEYS) {
    const href = links[key];
    if (href === undefined || href === "") {
      continue;
    }
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = checkout.t(key);
    nav.append(anchor);
  }
  if (nav.childElementCount > 0) {
    wrap.append(nav);
  }
  return wrap;
}

function tabs(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const row = document.createElement("div");
  row.className = "mm-tabs";
  row.setAttribute("role", "tablist");
  for (const method of TAB_ORDER.filter((item) => state.paymentMethods.includes(item))) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "mm-tab";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(state.activeMethod === method));
    tab.textContent = checkout.t(TAB_LABEL_KEYS[method]);
    if (state.activeMethod === method) {
      tab.classList.add("is-active");
    }
    tab.addEventListener("click", () => checkout.setMethod(method));
    row.append(tab);
  }
  return row;
}

function mobileMoneyPane(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const pane = document.createElement("div");
  pane.className = "mm-pane";
  pane.append(emailField(checkout, state));
  pane.append(phoneField(checkout, state));
  if (!state.lockAmount || state.amount === "") {
    pane.append(amountField(checkout, state));
  }
  pane.append(feeBox(checkout, state));
  pane.append(providerLogos(checkout, state));
  appendError(pane, state);
  return pane;
}

function placeholderPane(message: string): HTMLElement {
  const pane = document.createElement("div");
  pane.className = "mm-pane mm-placeholder";
  pane.textContent = message;
  return pane;
}

function qrPane(message: string): HTMLElement {
  const pane = document.createElement("div");
  pane.className = "mm-pane mm-placeholder mm-qr";
  const frame = document.createElement("div");
  frame.className = "mm-qr-frame";
  frame.setAttribute("aria-hidden", "true");
  const text = document.createElement("p");
  text.textContent = message;
  pane.append(frame, text);
  return pane;
}

function floatingField(labelText: string, control: HTMLElement, hint?: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "mm-floating";
  const box = document.createElement("div");
  box.className = "mm-floating-box";
  const label = document.createElement("span");
  label.className = "mm-floating-label";
  label.textContent = labelText;
  box.append(label, control);
  wrap.append(box);
  if (hint !== undefined) {
    const note = document.createElement("p");
    note.className = "mm-hint";
    note.textContent = hint;
    wrap.append(note);
  }
  return wrap;
}

function emailField(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const input = document.createElement("input");
  input.className = "mm-input mm-input-bare";
  input.type = "email";
  input.autocomplete = "email";
  input.placeholder = checkout.t("emailPlaceholder");
  input.value = state.customerEmail;
  input.addEventListener("input", () => checkout.setCustomerEmail(input.value));
  return floatingField(checkout.t("emailLabel"), input, checkout.t("emailHint"));
}

function phoneField(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const row = document.createElement("div");
  row.className = "mm-phone-row";

  const flag = document.createElement("span");
  flag.className = "mm-flag";
  flag.append(flagNode(state.selectedCountry));

  const dial = document.createElement("select");
  dial.className = "mm-dial";
  dial.setAttribute("aria-label", checkout.t("country"));
  for (const country of state.countries) {
    if (country.phone_code === undefined || country.phone_code === "") {
      continue;
    }
    const option = document.createElement("option");
    option.value = country.code;
    option.textContent = `+${country.phone_code}`;
    option.title = country.name;
    option.selected = state.selectedCountry?.code === country.code;
    dial.append(option);
  }
  dial.addEventListener("change", () => {
    void checkout.selectCountry(dial.value).catch(() => undefined);
  });

  const divider = document.createElement("span");
  divider.className = "mm-phone-divider";

  const input = document.createElement("input");
  input.className = "mm-input mm-input-bare";
  input.type = "tel";
  input.inputMode = "tel";
  input.autocomplete = "tel-national";
  input.placeholder = "812345678";
  input.value = state.identifier;
  input.addEventListener("input", () => {
    checkout.setIdentifier(input.value);
    refreshPayButton(checkout, input);
  });
  input.addEventListener("blur", () => {
    void checkout.matchProvider().catch(() => undefined);
  });

  row.append(flag, dial, divider, input);
  return floatingField(checkout.t("phone"), row, checkout.t("phoneHint"));
}

function amountField(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const row = document.createElement("div");
  row.className = "mm-amount-row";
  const input = document.createElement("input");
  input.className = "mm-input mm-input-bare";
  input.inputMode = "decimal";
  input.value = state.amount;
  input.disabled = state.lockAmount;
  input.addEventListener("input", () => refreshPayButton(checkout, input));
  input.addEventListener("change", () => {
    void checkout.setAmount(input.value).catch(() => undefined);
  });
  row.append(input);
  if (state.lockCurrency || state.availableCurrencies.length <= 1) {
    const badge = document.createElement("span");
    badge.className = "mm-currency-suffix";
    badge.textContent = state.currency;
    row.append(badge);
  } else {
    const select = document.createElement("select");
    select.className = "mm-currency-suffix mm-select";
    for (const code of state.availableCurrencies) {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = code;
      option.selected = state.currency === code;
      select.append(option);
    }
    select.addEventListener("change", () => {
      void checkout.setCurrency(select.value).catch(() => undefined);
    });
    row.append(select);
  }
  return floatingField(checkout.t("amount"), row);
}

function feeBox(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const box = document.createElement("div");
  box.className = "mm-fee-box";
  const q = quote(state);
  box.append(feeRow(checkout.t("merchantReceives"), formatMoney(q.receives, state)));
  box.append(feeRow(checkout.t("processingFee"), formatMoney(q.fee, state)));
  const total = feeRow(checkout.t("youPay"), formatMoney(q.pay, state));
  total.classList.add("mm-fee-total");
  box.append(total);
  return box;
}

function feeRow(labelText: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "mm-fee-row";
  const label = document.createElement("span");
  label.textContent = labelText;
  const amount = document.createElement("span");
  amount.textContent = value;
  row.append(label, amount);
  return row;
}

function providerLogos(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "mm-providers";
  if (state.providers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "mm-hint";
    empty.textContent = state.selectedCountry === undefined ? "" : checkout.t("noProviders");
    wrap.append(empty);
    return wrap;
  }
  for (const provider of state.providers) {
    wrap.append(providerChip(checkout, state, provider));
  }
  return wrap;
}

function providerChip(checkout: Checkout, state: CheckoutSnapshot, provider: Provider): HTMLElement {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "mm-provider-chip";
  chip.title = provider.name;
  chip.setAttribute("aria-label", provider.name);
  chip.setAttribute("aria-pressed", String(state.selectedProvider?.code === provider.code));
  if (state.selectedProvider?.code === provider.code) {
    chip.classList.add("is-selected");
  }
  if (provider.logo) {
    const img = document.createElement("img");
    img.src = provider.logo;
    img.alt = provider.name;
    img.loading = "lazy";
    chip.append(img);
  } else {
    chip.textContent = provider.name;
  }
  chip.addEventListener("click", () => {
    void checkout.selectProvider(provider.code).catch(() => undefined);
  });
  return chip;
}

function payButton(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mm-pay";
  applyPayState(button, checkout, state);
  button.addEventListener("click", () => {
    void checkout.pay().catch(() => undefined);
  });
  return button;
}

function applyPayState(button: HTMLElement, checkout: Checkout, state: CheckoutSnapshot): void {
  const ready = state.canPay;
  (button as HTMLButtonElement).disabled = !ready;
  const total = ready ? formatMoney(quote(state).pay, state) : "—";
  button.textContent = `${checkout.t("pay")} ${total}`;
}

/** Re-evaluate the Pay button after typing without re-rendering (which would drop input focus). */
function refreshPayButton(checkout: Checkout, from: HTMLElement): void {
  const button = from.closest(".mm-form")?.querySelector<HTMLElement>(".mm-pay") ?? null;
  if (button !== null) {
    applyPayState(button, checkout, checkout.getState());
  }
}

type Quote = { receives: string | null; fee: string | null; pay: string | null };

function quote(state: CheckoutSnapshot): Quote {
  const amount = state.amount.trim() === "" ? null : state.amount;
  const fees = state.fees;
  return {
    receives: fees?.merchant_receives ?? amount,
    fee: fees?.processing_fee ?? null,
    pay: fees?.total_to_pay ?? amount,
  };
}

function formatMoney(value: string | null, state: CheckoutSnapshot): string {
  if (value === null || value === "" || state.currency === "") {
    return "—";
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(state.locale, { style: "currency", currency: state.currency }).format(number);
  } catch {
    return `${number.toFixed(2)} ${state.currency}`;
  }
}

function flagNode(country: Country | undefined): Node {
  if (country?.flag) {
    const img = document.createElement("img");
    img.src = country.flag;
    img.alt = country.name;
    img.className = "mm-flag-image";
    return img;
  }
  return document.createTextNode(flagEmoji(country?.code));
}

/** ISO 3166-1 alpha-2 code to a flag emoji; empty when the code is not two letters. */
export function flagEmoji(code: string | undefined): string {
  if (code === undefined || !/^[A-Za-z]{2}$/.test(code)) {
    return "";
  }
  return [...code.toUpperCase()].map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65)).join("");
}

function appendError(parent: HTMLElement, state: CheckoutSnapshot): void {
  if (state.error === undefined || state.error === "") {
    return;
  }
  const error = document.createElement("div");
  error.className = "mm-error";
  error.setAttribute("role", "alert");
  error.textContent = state.error;
  parent.append(error);
}
