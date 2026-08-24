# Vue mini-shop

Uses `@mainmoney/js-vue`. Talks to a backend example over HTTP only.

Default port: **5175**.

## Setup

Build SDK packages from the repository root (`npm install && npm run build`).
Then start one backend, and:

```bash
cp .env.example .env
# set VITE_MERCHANT_BACKEND_URL
yarn
yarn dev
```

Open http://127.0.0.1:5175 — products, pay, refund, transfer.
