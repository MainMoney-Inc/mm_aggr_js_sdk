# JS/TS browser SDK documentation

Guides for application developers who put the MainMoney checkout widget in a web page.
Install and quick start: [../README.md](../README.md). Contributor setup: [../CONTRIBUTING.md](../CONTRIBUTING.md).

Every guide states its purpose and prerequisites, gives a copy-pasteable example and lists the error cases.
Where the widget does not support something, the guide says so.

## Read in this order

| # | Guide | What it covers |
| --- | --- | --- |
| 1 | [Architecture](architecture.md) | Browser SDK + one backend SDK, `clientToken`, what must never reach the browser |
| 2 | [Session creation](session.md) | The endpoint your backend exposes to start a checkout; `createSession` and `createCheckout` options |
| 3 | [Merchant backend path contract](backend-contract.md) | Every route the widget calls: query, body, expected response, which PHP/Python/Node SDK method serves it |
| 4 | [Deposit flow](deposit-flow.md) | Countries, providers, provider match, limits, fees, currency quotes, pay, polling, retry, terminal states |
| 5 | [Payout flow](payout-flow.md) | The wizard layout, `onValidateBalance`, what differs from deposits |
| 6 | [Card and MainMoney tabs](payment-methods.md) | `payment_methods` from checkout preferences; what is and is not supported |
| 7 | [Payment links](payment-links.md) | Creating a link with a backend SDK and using the returned `url` in a browser app |
| 8 | [Platforms and sellers (MainMoney Rails)](platform-sellers.md) | `X-Merchant-Account` is a backend concern |
| 9 | [Theming, i18n, dark mode, layout](theming.md) | Colours, CSS variables, `colorScheme`, `variant`, `layout`, messages |
| 10 | [Reference: snapshot, methods, events](reference.md) | Every snapshot field, every `Checkout` method, every error class |
| 11 | [CORS and troubleshooting](troubleshooting.md) | Allowed headers, origin mismatches, restart loops, endless polling |
| 12 | [Security notes](security.md) | Secrets, tokens, amounts, polling, XSS |

## Framework guides

| Framework | Guide |
| --- | --- |
| Overview and shared rules | [frameworks/README.md](frameworks/README.md) |
| Vanilla JS / TypeScript | [frameworks/vanilla.md](frameworks/vanilla.md) |
| React | [frameworks/react.md](frameworks/react.md) |
| Vue 3 | [frameworks/vue.md](frameworks/vue.md) |
| Angular (zone, signal inputs) | [frameworks/angular.md](frameworks/angular.md) |
| Next.js and SSR | [frameworks/nextjs.md](frameworks/nextjs.md) |

Runnable examples (vanilla, React, Vue, Angular) are in [../examples/](../examples/).
