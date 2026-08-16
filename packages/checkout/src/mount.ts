/** Vanilla DOM mount for the checkout wizard. */

import { applyTheme, isPhoneIdentifier } from "@mainmoney/js-core";

import type { Checkout, CheckoutSnapshot } from "./checkout.js";

export type MountOptions = {
  logoUrl?: string;
};

export function mountCheckout(element: HTMLElement, checkout: Checkout, options: MountOptions = {}): () => void {
  const logoUrl = options.logoUrl ?? new URL("./assets/main_money_square.png", import.meta.url).href;
  const render = (state: CheckoutSnapshot): void => {
    applyTheme(element, state.theme);
    element.classList.add("mm-checkout");
    element.innerHTML = "";
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
    } else {
      const status = state.status?.status ?? "";
      element.append(messageStep(status.toUpperCase() === "SUCCESS" ? checkout.t("success") : checkout.t("failed")));
    }
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
      void checkout.selectCountry(select.value);
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
  if (state.error !== undefined) {
    const error = document.createElement("div");
    error.className = "mm-error";
    error.textContent = state.error;
    wrap.append(error);
  }
  wrap.append(actions(checkout, () => void checkout.goOverview(), checkout.t("next"), true));
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
  if (state.fees !== undefined) {
    wrap.append(overviewRow(checkout.t("fees"), `${state.fees.total_merchant_fee} ${state.currency}`));
    wrap.append(overviewRow(checkout.t("netAmount"), `${state.fees.net_amount} ${state.currency}`));
  }
  if (state.partnerFee !== null) {
    wrap.append(
      overviewRow(state.partnerFee.label ?? checkout.t("partnerFee"), `${state.partnerFee.amount} ${state.partnerFee.currency}`),
    );
  }
  wrap.append(actions(checkout, () => void checkout.confirm(), checkout.t("confirm"), true));
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
      void checkout.selectProvider(provider.code);
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
    void checkout.matchProvider();
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
  const input = document.createElement("input");
  input.className = "mm-input";
  input.value = state.amount;
  input.inputMode = "decimal";
  input.addEventListener("change", () => {
    void checkout.setAmount(input.value);
  });
  field.append(input);
  return field;
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
