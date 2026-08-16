# MainMoney JS/TS frontend SDK

Browser TypeScript modules for checkout and related UI. Use this package from
**Angular, React, Next.js, Vue, or vanilla TypeScript/JavaScript**.

This is not a backend client. You **must** also install **one** of:

- [PHP SDK](https://github.com/MainMoney-Inc/mm_aggr_php_sdk)
- [Python SDK](https://github.com/MainMoney-Inc/mm_aggr_python_sdk)
- [Node.js SDK](https://github.com/MainMoney-Inc/mm_aggr_nodejs_sdk)

The frontend talks to **your** server. Never put merchant API keys in the
browser.

## Requirements

- TypeScript 5+ (or JavaScript with the published `.d.ts` types)
- A backend that uses a MainMoney backend SDK
- Last two versions of Chrome, Firefox, Safari, and Edge

## Install

```bash
npm install @mainmoney/js-core
```

Optional modules:

```bash
npm install @mainmoney/js-http @mainmoney/js-checkout
```

## Quick start (TypeScript)

```ts
import { createSession } from "@mainmoney/js-core";

const session = createSession({
  merchantBackendUrl: "https://your-app.example/payments",
});
```

Your `merchantBackendUrl` must be an endpoint **you** implement with a backend
SDK. This package will not call the aggregator with a merchant API key.

## License

Copyright (c) 2026 MainMoney SARL. Licensed under the PolyForm Noncommercial
License 1.0.0. Non-commercial use is allowed. Commercial use requires
permission from MainMoney SARL. See [LICENSE](LICENSE).

Want to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md).
