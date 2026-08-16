# Contributing

This document is for people who change **this repository**. To install the
package into an application, see [README.md](README.md).

## Legal

Pull requests require agreement to [CLA.md](CLA.md). Contributions are owned
by MainMoney SARL.

## Clone

```bash
git clone git@github.com:MainMoney-Inc/mm_aggr_js_sdk.git
```

## Setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Branches and commits

- `feature/<name>`, `bugfix/<name>`, `hotfix/<issue>`, `refactor/<description>`
- Conventional commits: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Pull requests

- Include tests for behavior changes.
- Do not invent merchant API endpoints. This package is the **frontend** SDK:
  it must not send merchant API keys. Backend SDKs implement the pinned
  contract in the contrib hub `contract/`.
- Do not commit secrets.
