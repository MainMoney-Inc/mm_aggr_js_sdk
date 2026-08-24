# JS/TS frontend examples

Standalone checkout UIs. They never hold merchant API keys. Build the SDK
packages from the repository root (`npm install && npm run build`), start
**one** backend example, then set `VITE_MERCHANT_BACKEND_URL` in this app’s
`.env`. Each example installs `@mainmoney/*` from `../../packages`.

| Example | Port | Package |
| --- | --- | --- |
| [vanilla-js](vanilla-js/) | 5173 | `@mainmoney/js-checkout` |
| [react](react/) | 5174 | `@mainmoney/js-react` |
| [vue](vue/) | 5175 | `@mainmoney/js-vue` |
| [angular](angular/) | 4200 | `@mainmoney/js-angular` |

Pages: products, pay, refund, transfer. Same shop API on every backend.
