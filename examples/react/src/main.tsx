import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { createSession } from "@mainmoney/js-core";
import { createCheckout } from "@mainmoney/js-checkout";
import { CheckoutWizard } from "@mainmoney/js-react";
import "@mainmoney/js-checkout/styles.css";
import type { Checkout } from "@mainmoney/js-checkout";

import {
  backendUrl,
  createPaySession,
  createPayoutSession,
  listOrders,
  listProducts,
  listTransfers,
  refundOrder,
  type CheckoutConfig,
  type Order,
  type Product,
  type Transfer,
} from "./api";
import "./styles.css";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav>
        <Link to="/">Products</Link>
        <Link to="/refund">Refund</Link>
        <Link to="/transfer">Transfer</Link>
        <span style={{ marginLeft: "auto", color: "#aaa" }}>backend {backendUrl()}</span>
      </nav>
      <main>{children}</main>
    </>
  );
}

function useCheckout(cfg: CheckoutConfig | null, operation: "deposit" | "payout"): Checkout | null {
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  useEffect(() => {
    if (cfg === null) {
      setCheckout(null);
      return;
    }
    let cancelled = false;
    const session = createSession({
      merchantBackendUrl: cfg.merchantBackendUrl,
      clientToken: cfg.clientToken,
      locale: cfg.locale ?? "en",
    });
    const instance = createCheckout(session, {
      operation,
      pollUrl: cfg.pollUrl,
      pollHeaders: cfg.pollHeaders,
      amount: cfg.amount ?? undefined,
      lockAmount: cfg.lockAmount === true,
      reference: cfg.reference,
    });
    void instance.loadCountries().then(() => {
      if (!cancelled) {
        setCheckout(instance);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cfg, operation]);
  return checkout;
}

function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void listProducts().then(setProducts).catch((err: Error) => setError(err.message));
  }, []);
  return (
    <Layout>
      <h1>Products</h1>
      {error !== null ? <p className="error">{error}</p> : null}
      {products.map((product) => (
        <article className="card" key={product.id}>
          <h2>{product.name}</h2>
          <p>{product.description}</p>
          <p>
            <strong>
              {product.price} {product.currency}
            </strong>
          </p>
          <button type="button" onClick={() => navigate(`/pay/${product.id}`)}>
            Pay
          </button>
        </article>
      ))}
    </Layout>
  );
}

function PayPage() {
  const { id } = useParams();
  const [cfg, setCfg] = useState<CheckoutConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void createPaySession(Number(id)).then(setCfg).catch((err: Error) => setError(err.message));
  }, [id]);
  const checkout = useCheckout(cfg, "deposit");
  return (
    <Layout>
      <h1>Pay</h1>
      {error !== null ? <p className="error">{error}</p> : null}
      {checkout !== null ? <CheckoutWizard checkout={checkout} /> : <p>Starting checkout…</p>}
    </Layout>
  );
}

function RefundPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = () => {
    void listOrders().then(setOrders).catch((err: Error) => setError(err.message));
  };
  useEffect(() => {
    reload();
  }, []);
  return (
    <Layout>
      <h1>Refund</h1>
      {error !== null ? <p className="error">{error}</p> : null}
      {orders.length === 0 ? <p>No orders yet. Pay for a product first.</p> : null}
      {orders.map((order) => (
        <article className="card" key={order.id}>
          <p>
            Ref {order.reference} — {order.amount} {order.currency} — <strong>{order.status}</strong>
          </p>
          {order.status === "paid" ? (
            <button
              type="button"
              onClick={() => {
                void refundOrder(order.id).then(reload).catch((err: Error) => setError(err.message));
              }}
            >
              Refund
            </button>
          ) : null}
        </article>
      ))}
    </Layout>
  );
}

function TransferPage() {
  const [cfg, setCfg] = useState<CheckoutConfig | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const checkout = useCheckout(cfg, "payout");
  useEffect(() => {
    void listTransfers().then(setTransfers).catch((err: Error) => setError(err.message));
  }, []);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void createPayoutSession(String(data.get("amount")), String(data.get("currency")))
      .then(setCfg)
      .catch((err: Error) => setError(err.message));
  }
  return (
    <Layout>
      <h1>Transfer (payout)</h1>
      <form className="card" onSubmit={onSubmit}>
        <p>
          <label>
            Amount <input name="amount" defaultValue="5.00" required />
          </label>
        </p>
        <p>
          <label>
            Currency <input name="currency" defaultValue="USD" required />
          </label>
        </p>
        <button type="submit">Start payout</button>
      </form>
      {error !== null ? <p className="error">{error}</p> : null}
      {checkout !== null ? <CheckoutWizard checkout={checkout} /> : null}
      <h2>Recent transfers</h2>
      {transfers.map((item) => (
        <article className="card" key={item.id}>
          <p>
            Ref {item.reference} — {item.amount} {item.currency} → {item.destination || "—"} — <strong>{item.status}</strong>
          </p>
        </article>
      ))}
    </Layout>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProductsPage />} />
        <Route path="/pay/:id" element={<PayPage />} />
        <Route path="/refund" element={<RefundPage />} />
        <Route path="/transfer" element={<TransferPage />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
