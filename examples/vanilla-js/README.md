# Vanilla JS mini-shop

Uses `@mainmoney/js-checkout`. Talks to a backend example over HTTP only.

Default port: **5173**.

## Setup

Build SDK packages from the repository root (`npm install && npm run build`).
Then start one backend (Django 8000, FastAPI 8001, Flask 8002, Laravel 8003, or Express 8004).

```bash
cp .env.example .env
# set VITE_MERCHANT_BACKEND_URL to that backend
yarn
yarn dev
```

Open http://127.0.0.1:5173 — products, pay, refund, transfer.
