import { createSession } from "@mainmoney/js-core";
import { createCheckout, mountCheckout } from "@mainmoney/js-checkout";
import "@mainmoney/js-checkout/styles.css";

import {
  backendUrl,
  createPaySession,
  createPayoutSession,
  listOrders,
  listProducts,
  listTransfers,
  refundOrder,
  type CheckoutConfig,
  type Product,
} from "./api";
import "./styles.css";

const app = document.getElementById("app")!;

function nav(active: string): string {
  const links = [
    ["#/", "Products"],
    ["#/refund", "Refund"],
    ["#/transfer", "Transfer"],
  ];
  return `<nav>${links.map(([href, label]) => `<a href="${href}"${href === active || (active.startsWith("#/pay") && href === "#/") ? ' style="text-decoration:underline"' : ""}>${label}</a>`).join("")}<span style="margin-left:auto;color:#aaa">backend ${backendUrl()}</span></nav>`;
}

async function mountWizard(host: HTMLElement, cfg: CheckoutConfig, operation: "deposit" | "payout"): Promise<void> {
  const session = createSession({
    merchantBackendUrl: cfg.merchantBackendUrl,
    clientToken: cfg.clientToken,
    locale: cfg.locale ?? "en",
  });
  const checkout = createCheckout(session, {
    operation,
    pollUrl: cfg.pollUrl,
    pollHeaders: cfg.pollHeaders,
    amount: cfg.amount ?? undefined,
    lockAmount: cfg.lockAmount === true,
    reference: cfg.reference,
  });
  await checkout.loadCountries();
  mountCheckout(host, checkout);
}

async function renderProducts(): Promise<void> {
  app.innerHTML = `${nav("#/")}<main><h1>Products</h1><p>Choose an item to pay with MainMoney.</p><div id="list">Loading…</div></main>`;
  try {
    const products = await listProducts();
    const list = document.getElementById("list")!;
    list.innerHTML = products
      .map(
        (product: Product) =>
          `<article class="card"><h2>${product.name}</h2><p>${product.description}</p><p><strong>${product.price} ${product.currency}</strong></p><button data-id="${product.id}">Pay</button></article>`,
      )
      .join("");
    list.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        window.location.hash = `#/pay/${button.getAttribute("data-id")}`;
      });
    });
  } catch (error) {
    document.getElementById("list")!.innerHTML = `<p class="error">${(error as Error).message}</p>`;
  }
}

async function renderPay(productId: number): Promise<void> {
  app.innerHTML = `${nav("#/pay")}<main><h1>Pay</h1><div id="checkout">Starting checkout…</div></main>`;
  try {
    const cfg = await createPaySession(productId);
    const host = document.getElementById("checkout")!;
    host.innerHTML = "";
    await mountWizard(host, cfg, "deposit");
  } catch (error) {
    document.getElementById("checkout")!.innerHTML = `<p class="error">${(error as Error).message}</p>`;
  }
}

async function renderRefund(): Promise<void> {
  app.innerHTML = `${nav("#/refund")}<main><h1>Refund</h1><div id="list">Loading…</div></main>`;
  try {
    const orders = await listOrders();
    const list = document.getElementById("list")!;
    if (orders.length === 0) {
      list.innerHTML = "<p>No orders yet. Pay for a product first.</p>";
      return;
    }
    list.innerHTML = orders
      .map(
        (order) =>
          `<article class="card"><p>Ref ${order.reference} — ${order.amount} ${order.currency} — <strong>${order.status}</strong></p>${
            order.status === "paid" ? `<button data-id="${order.id}">Refund</button>` : ""
          }</article>`,
      )
      .join("");
    list.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", async () => {
        button.setAttribute("disabled", "true");
        try {
          await refundOrder(Number(button.getAttribute("data-id")));
          await renderRefund();
        } catch (error) {
          button.insertAdjacentHTML("afterend", `<p class="error">${(error as Error).message}</p>`);
        }
      });
    });
  } catch (error) {
    document.getElementById("list")!.innerHTML = `<p class="error">${(error as Error).message}</p>`;
  }
}

async function renderTransfer(): Promise<void> {
  app.innerHTML = `${nav("#/transfer")}<main><h1>Transfer (payout)</h1>
    <form id="form" class="card">
      <p><label>Amount <input name="amount" value="5.00" required /></label></p>
      <p><label>Currency <input name="currency" value="USD" required /></label></p>
      <button type="submit">Start payout</button>
    </form>
    <div id="checkout"></div>
    <h2>Recent transfers</h2>
    <div id="list">Loading…</div></main>`;
  document.getElementById("form")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const host = document.getElementById("checkout")!;
    host.textContent = "Starting payout…";
    try {
      const cfg = await createPayoutSession(String(data.get("amount")), String(data.get("currency")));
      host.innerHTML = "";
      await mountWizard(host, cfg, "payout");
    } catch (error) {
      host.innerHTML = `<p class="error">${(error as Error).message}</p>`;
    }
  });
  try {
    const transfers = await listTransfers();
    document.getElementById("list")!.innerHTML =
      transfers.length === 0
        ? "<p>No transfers yet.</p>"
        : transfers
            .map(
              (item) =>
                `<article class="card"><p>Ref ${item.reference} — ${item.amount} ${item.currency} → ${item.destination || "—"} — <strong>${item.status}</strong></p></article>`,
            )
            .join("");
  } catch (error) {
    document.getElementById("list")!.innerHTML = `<p class="error">${(error as Error).message}</p>`;
  }
}

async function route(): Promise<void> {
  const hash = window.location.hash || "#/";
  const pay = hash.match(/^#\/pay\/(\d+)/);
  if (pay) {
    await renderPay(Number(pay[1]));
    return;
  }
  if (hash.startsWith("#/refund")) {
    await renderRefund();
    return;
  }
  if (hash.startsWith("#/transfer")) {
    await renderTransfer();
    return;
  }
  await renderProducts();
}

window.addEventListener("hashchange", () => {
  void route();
});
void route();
