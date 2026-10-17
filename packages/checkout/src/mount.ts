/** Vanilla DOM mount for the checkout wizard. */

import { applyTheme, isPhoneIdentifier } from "@mainmoneyapp/js-core";

import { DEFAULT_LOGO_URL } from "./assets/logo.js";
import type { Checkout, CheckoutSnapshot } from "./checkout.js";
import { formBody, formChrome, type FooterLinks } from "./form.js";

export type MountOptions = {
  logoUrl?: string;
  /** `form` is the single-page checkout (default for deposits); `wizard` is the step-by-step flow (default for payouts). */
  layout?: "form" | "wizard";
  /** Country preselected in the form layout; defaults to the first allowed country. */
  defaultCountry?: string;
  /** Footer links; only links with a URL are shown. */
  links?: FooterLinks;
};

export function mountCheckout(element: HTMLElement, checkout: Checkout, options: MountOptions = {}): () => void {
  const logoUrl = options.logoUrl ?? DEFAULT_LOGO_URL;
  const useForm = (state: CheckoutSnapshot): boolean => (options.layout ?? (state.operation === "deposit" ? "form" : "wizard")) === "form";
  let preselecting = false;

  const renderForm = (state: CheckoutSnapshot): void => {
    if (state.step === "country" && state.countries.length > 0 && !preselecting) {
      preselecting = true;
      const preferred = state.countries.find((country) => country.code === options.defaultCountry) ?? state.countries[0];
      void checkout
        .selectCountry(preferred.code)
        .catch(() => undefined)
        .finally(() => {
          preselecting = false;
        });
    }
    let body: HTMLElement;
    if (state.step === "confirming" || state.step === "polling") {
      body = confirmingStep(checkout, state, logoUrl);
    } else if (state.step === "ongoing") {
      body = messageStep(checkout.t("ongoing"));
    } else if (state.step === "error") {
      body = retryStep(checkout, state.error ?? checkout.t("failed"));
    } else if (state.step === "terminal") {
      const status = state.status?.status ?? "";
      body =
        status.toUpperCase() === "SUCCESS" ? messageStep(checkout.t("success")) : retryStep(checkout, checkout.t("failed"));
    } else {
      body = formBody(checkout, state);
    }
    element.append(formChrome(checkout, state, logoUrl, options.links ?? {}, body));
  };

  const render = (state: CheckoutSnapshot): void => {
    // A lookup that finishes while the customer is still typing must not steal the focus.
    const fields = Array.from(element.querySelectorAll<HTMLInputElement>("input"));
    const focused = fields.findIndex((field) => field === document.activeElement);
    const caret = focused >= 0 ? fields[focused].selectionStart : null;
    renderBody(state);
    if (focused >= 0) {
      const next = element.querySelectorAll<HTMLInputElement>("input")[focused];
      next?.focus();
      if (caret !== null && caret !== undefined) {
        try {
          next?.setSelectionRange(caret, caret);
        } catch {
          // Input types without selection support (email, number).
        }
      }
    }
  };

  const renderBody = (state: CheckoutSnapshot): void => {
    applyTheme(element, state.theme);
    element.classList.add("mm-checkout");
    element.innerHTML = "";
    if (useForm(state)) {
      element.classList.add("mm-checkout-form");
      renderForm(state);
      return;
    }
    element.classList.remove("mm-checkout-form");
    if (state.step === "country") {
      element.append(countryStep(checkout, state));
    } else if (state.step === "details") {
      element.append(detailsStep(checkout, state));
    } else if (state.step === "overview") {
      element.append(overviewStep(checkout, state));
    } else if (state.step === "confirming" || state.step === "polling") {
      element.append(confirmingStep(checkout, state, logoUrl));
    } else if (state.step === "ongoing") {
      element.append(messageStep(checkout.t("ongoing")));
    } else if (state.step === "error") {
      element.append(retryStep(checkout, state.error ?? checkout.t("failed")));
      return;
    } else {
      const status = state.status?.status ?? "";
      element.append(
        status.toUpperCase() === "SUCCESS" ? messageStep(checkout.t("success")) : retryStep(checkout, checkout.t("failed")),
      );
    }
    appendError(element, state);
  };
  render(checkout.getState());
  return checkout.subscribe(render);
}

function countryStep(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const wrap = document.createElement("div");
  wrap.append(label(checkout.t("country")));
  const select = document.createElement("select");
  select.className = "mm-select";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = checkout.t("selectCountry");
  select.append(placeholder);
  for (const country of state.countries) {
    const option = document.createElement("option");
    option.value = country.code;
    option.textContent = country.name;
    if (state.selectedCountry?.code === country.code) {
      option.selected = true;
    }
    select.append(option);
  }
  select.addEventListener("change", () => {
    if (select.value !== "") {
      run(() => checkout.selectCountry(select.value));
    }
  });
  wrap.append(select);
  return wrap;
}

function detailsStep(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const wrap = document.createElement("div");
  const phone = isPhoneIdentifier(state.selectedProvider);
  wrap.append(providerList(checkout, state));
  wrap.append(identifierField(checkout, state, phone));
  if (state.customerName !== null) {
    wrap.append(overviewRow(checkout.t("customerName"), state.customerName));
  }
  wrap.append(amountField(checkout, state));
  wrap.append(actions(checkout, () => run(() => checkout.goOverview()), checkout.t("next"), true));
  return wrap;
}

function overviewStep(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const wrap = document.createElement("div");
  const phone = isPhoneIdentifier(state.selectedProvider);
  wrap.append(overviewRow(checkout.t("country"), state.selectedCountry?.name ?? ""));
  wrap.append(overviewRow(checkout.t("provider"), state.selectedProvider?.name ?? ""));
  wrap.append(overviewRow(phone ? checkout.t("phone") : checkout.t("account"), state.identifier));
  if (state.customerName !== null) {
    wrap.append(overviewRow(checkout.t("customerName"), state.customerName));
  }
  wrap.append(overviewRow(checkout.t("amount"), `${state.amount} ${state.currency}`));
  // Merchant fee and net amount are merchant-side figures: never shown to the customer.
  if (state.partnerFee !== null) {
    wrap.append(
      overviewRow(state.partnerFee.label ?? checkout.t("partnerFee"), `${state.partnerFee.amount} ${state.partnerFee.currency}`),
    );
  }
  wrap.append(actions(checkout, () => run(() => checkout.confirm()), checkout.t("confirm"), true));
  return wrap;
}

function confirmingStep(checkout: Checkout, state: CheckoutSnapshot, logoUrl: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "mm-confirm";
  const spinner = document.createElement("div");
  spinner.className = "mm-spinner";
  const curveA = document.createElement("div");
  curveA.className = "mm-spinner-curve";
  const curveB = document.createElement("div");
  curveB.className = "mm-spinner-curve";
  const logo = document.createElement("img");
  logo.className = "mm-spinner-logo";
  logo.alt = "MainMoney";
  logo.src = logoUrl;
  spinner.append(curveA, curveB, logo);
  const caption = document.createElement("div");
  caption.textContent = state.step === "polling" ? checkout.t("polling") : checkout.t("confirming");
  wrap.append(spinner, caption);
  if (state.step === "polling" && state.connectionLost) {
    const lost = document.createElement("div");
    lost.className = "mm-confirm-slow mm-confirm-offline";
    lost.setAttribute("role", "status");
    lost.textContent = checkout.t("connectionLost");
    wrap.append(lost);
  }
  if (state.step === "polling" && state.slow) {
    const notice = document.createElement("div");
    notice.className = "mm-confirm-slow";
    notice.textContent = checkout.t("slow");
    wrap.append(notice);
  }
  return wrap;
}

/** Failure screen: no form fields, only the reason and a Retry button. */
function retryStep(checkout: Checkout, message: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "mm-confirm mm-retry";
  const error = document.createElement("div");
  error.className = "mm-error";
  error.setAttribute("role", "alert");
  error.textContent = message;
  const hint = document.createElement("p");
  hint.className = "mm-hint";
  hint.textContent = checkout.t("retryHint");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mm-pay";
  button.textContent = checkout.t("retry");
  button.addEventListener("click", () => {
    button.disabled = true;
    void checkout.retry().catch(() => {
      button.disabled = false;
    });
  });
  wrap.append(error, hint, button);
  return wrap;
}

function messageStep(text: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "mm-confirm";
  wrap.textContent = text;
  return wrap;
}

function providerList(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const wrap = document.createElement("div");
  wrap.append(label(checkout.t("provider")));
  for (const provider of state.providers) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "mm-provider";
    if (state.selectedProvider?.code === provider.code) {
      row.classList.add("is-selected");
    }
    if (state.highlightedProviderCode === provider.code) {
      row.classList.add("is-highlighted");
    }
    row.textContent = provider.name;
    if (state.highlightedProviderCode === provider.code) {
      const badge = document.createElement("span");
      badge.className = "mm-badge";
      badge.textContent = checkout.t("highlighted");
      row.append(badge);
    }
    row.addEventListener("click", () => {
      run(() => checkout.selectProvider(provider.code));
    });
    wrap.append(row);
  }
  return wrap;
}

function identifierField(checkout: Checkout, state: CheckoutSnapshot, phone: boolean): HTMLElement {
  const field = document.createElement("div");
  field.className = "mm-field";
  field.append(label(phone ? checkout.t("phone") : checkout.t("account")));
  const input = document.createElement("input");
  input.className = "mm-input";
  input.value = state.identifier;
  input.addEventListener("input", () => checkout.setIdentifier(input.value));
  input.addEventListener("blur", () => {
    run(() => checkout.matchProvider());
  });
  if (phone && state.selectedCountry?.phone_code) {
    const row = document.createElement("div");
    row.className = "mm-phone";
    const prefix = document.createElement("div");
    prefix.className = "mm-phone-prefix";
    prefix.textContent = `+${state.selectedCountry.phone_code}`;
    row.append(prefix, input);
    field.append(row);
  } else {
    field.append(input);
  }
  return field;
}

function amountField(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  const field = document.createElement("div");
  field.className = "mm-field";
  field.append(label(checkout.t("amount")));
  const row = document.createElement("div");
  row.className = "mm-amount-row";
  const input = document.createElement("input");
  input.className = "mm-input";
  input.value = state.amount;
  input.inputMode = "decimal";
  if (state.lockAmount) {
    input.disabled = true;
    input.readOnly = true;
  } else {
    input.addEventListener("change", () => {
      run(() => checkout.setAmount(input.value));
    });
  }
  row.append(input);
  row.append(currencySuffix(checkout, state));
  field.append(row);
  return field;
}

function currencySuffix(checkout: Checkout, state: CheckoutSnapshot): HTMLElement {
  if (state.lockCurrency) {
    const badge = document.createElement("div");
    badge.className = "mm-currency-suffix";
    badge.textContent = state.currency;
    return badge;
  }
  const select = document.createElement("select");
  select.className = "mm-currency-suffix mm-select";
  for (const code of state.availableCurrencies) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    if (state.currency === code) {
      option.selected = true;
    }
    select.append(option);
  }
  select.addEventListener("change", () => {
    if (select.value !== "") {
      run(() => checkout.setCurrency(select.value));
    }
  });
  return select;
}

function overviewRow(labelText: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "mm-overview-row";
  const left = document.createElement("span");
  left.textContent = labelText;
  const right = document.createElement("span");
  right.textContent = value;
  row.append(left, right);
  return row;
}

function actions(checkout: Checkout, onPrimary: () => void, primaryLabel: string, showBack: boolean): HTMLElement {
  const row = document.createElement("div");
  row.className = "mm-actions";
  if (showBack) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "mm-button mm-button-secondary";
    back.textContent = checkout.t("back");
    back.addEventListener("click", () => checkout.goBack());
    row.append(back);
  }
  const primary = document.createElement("button");
  primary.type = "button";
  primary.className = "mm-button mm-button-primary";
  primary.textContent = primaryLabel;
  primary.addEventListener("click", onPrimary);
  row.append(primary);
  return row;
}

function label(text: string): HTMLElement {
  const node = document.createElement("label");
  node.className = "mm-label";
  node.textContent = text;
  return node;
}

function appendError(parent: HTMLElement, state: CheckoutSnapshot): void {
  if (state.error === undefined || state.error === "") {
    return;
  }
  const error = document.createElement("div");
  error.className = "mm-error";
  error.textContent = state.error;
  parent.append(error);
}

function run(op: () => Promise<void>): void {
  void op().catch(() => undefined);
}
