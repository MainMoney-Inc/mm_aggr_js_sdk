/** Designed currency picker: market flag + ISO code per option, keyboard and screen-reader friendly. */

import type { Country, Provider } from "@mainmoneyapp/js-core";

/** Currencies shared by several countries (or none in particular): no single market flag applies. */
const SHARED_CURRENCIES = new Set(["XAF", "XOF", "XCD", "XPF", "ANG"]);
/** ISO 4217 codes whose first two letters are not the ISO 3166 country of the market. */
const CURRENCY_COUNTRY: Record<string, string> = { EUR: "EU", USD: "US" };

/** ISO 3166-1 alpha-2 code to a flag emoji; empty when the code is not two letters. */
export function flagEmoji(code: string | undefined): string {
  if (code === undefined || !/^[A-Za-z]{2}$/.test(code)) {
    return "";
  }
  return [...code.toUpperCase()].map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65)).join("");
}

/** Country code of the market a currency belongs to: the provider's own country for its home currency. */
export function marketCountryCode(currency: string, provider: Provider | undefined): string | undefined {
  const code = currency.trim().toUpperCase();
  if (provider !== undefined && provider.currency_code?.toUpperCase() === code && provider.country_code) {
    return provider.country_code.toUpperCase();
  }
  if (SHARED_CURRENCIES.has(code)) {
    return undefined;
  }
  return CURRENCY_COUNTRY[code] ?? (code.length === 3 ? code.slice(0, 2) : undefined);
}

/** Flag node for a currency's market: the uploaded flag image when we know the country, else an emoji. */
export function marketFlag(currency: string, provider: Provider | undefined, countries: Country[]): Node {
  const countryCode = marketCountryCode(currency, provider);
  const country = countries.find((item) => item.code.toUpperCase() === countryCode);
  if (country?.flag) {
    const img = document.createElement("img");
    img.src = country.flag;
    img.alt = "";
    img.className = "mm-flag-image";
    return img;
  }
  return document.createTextNode(flagEmoji(countryCode) || "\u{1F310}");
}

export type CurrencyDropdownOptions = {
  codes: string[];
  selected: string;
  label: string;
  flagFor: (code: string) => Node;
  onSelect: (code: string) => void;
  className?: string;
};

function optionContent(code: string, flag: Node): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "mm-dropdown-content";
  const flagBox = document.createElement("span");
  flagBox.className = "mm-flag";
  flagBox.setAttribute("aria-hidden", "true");
  flagBox.append(flag);
  const text = document.createElement("span");
  text.className = "mm-dropdown-code";
  text.textContent = code;
  wrap.append(flagBox, text);
  return wrap;
}

export function currencyDropdown(options: CurrencyDropdownOptions): HTMLElement {
  const root = document.createElement("div");
  root.className = `mm-dropdown ${options.className ?? ""}`.trim();

  const button = document.createElement("button");
  button.type = "button";
  button.className = "mm-dropdown-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", options.label);
  const caret = document.createElement("span");
  caret.className = "mm-dropdown-caret";
  caret.setAttribute("aria-hidden", "true");
  button.append(optionContent(options.selected, options.flagFor(options.selected)), caret);

  const list = document.createElement("ul");
  list.className = "mm-dropdown-list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", options.label);
  list.tabIndex = -1;
  list.hidden = true;

  const items = options.codes.map((code) => {
    const item = document.createElement("li");
    item.className = "mm-dropdown-option";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(code === options.selected));
    item.dataset.code = code;
    item.tabIndex = -1;
    item.append(optionContent(code, options.flagFor(code)));
    if (code === options.selected) {
      item.classList.add("is-selected");
    }
    list.append(item);
    return item;
  });

  let active = Math.max(0, options.codes.indexOf(options.selected));
  const focusItem = (index: number): void => {
    if (items.length === 0) {
      return;
    }
    active = (index + items.length) % items.length;
    items[active].focus();
  };

  const onOutside = (event: Event): void => {
    // A re-render detaches the dropdown: nothing left to close, only the listener to drop.
    if (!root.isConnected || !root.contains(event.target as Node)) {
      close(false);
    }
  };
  function close(refocus: boolean): void {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutside, true);
    if (refocus && root.isConnected) {
      button.focus();
    }
  }
  const open = (): void => {
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", onOutside, true);
    focusItem(active);
  };
  const choose = (code: string): void => {
    close(true);
    if (code !== options.selected) {
      options.onSelect(code);
    }
  };

  button.addEventListener("click", () => (list.hidden ? open() : close(true)));
  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open();
    }
  });
  list.addEventListener("click", (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>("[data-code]");
    if (item?.dataset.code !== undefined) {
      choose(item.dataset.code);
    }
  });
  list.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(active - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(items.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const code = items[active]?.dataset.code;
      if (code !== undefined) {
        choose(code);
      }
    } else if (event.key === "Escape" || event.key === "Tab") {
      close(event.key === "Escape");
    }
  });

  root.append(button, list);
  return root;
}
