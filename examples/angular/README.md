# Angular mini-shop

Uses `@mainmoney/js-angular`. Talks to a backend example over HTTP only.

Default port: **4200**.

## Setup

Build SDK packages from the repository root (`npm install && npm run build`).
Then start one backend, and:

```bash
cp .env.example .env
# set VITE_MERCHANT_BACKEND_URL
yarn
yarn dev
```

`yarn dev` runs `scripts/sync-env.mjs` so `.env` is copied into
`src/environments/environment.local.ts`.

Open http://127.0.0.1:4200 — products, pay, refund, transfer.
