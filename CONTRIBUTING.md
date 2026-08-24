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

`@mainmoney/js-angular` is built with ng-packagr (Ivy partial compilation). Do not bundle that package with tsup.

## npm

Packages: `@mainmoney/js-core`, `@mainmoney/js-http`, `@mainmoney/js-checkout`,
`@mainmoney/js-react`, `@mainmoney/js-vue`, `@mainmoney/js-angular`. First
publish is a one-time project create on npm. After that, release from each
package directory with `npm publish --access public`. Release by pushing an
annotated tag (`v0.1.0`, then semver). Do not commit npm tokens.

## Branches and commits

- `feature/<name>`, `bugfix/<name>`, `hotfix/<issue>`, `refactor/<description>`
- Conventional commits: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Pull requests

- Include tests for behavior changes.
- Do not invent merchant API endpoints. This package is the **frontend** SDK:
  it must not send merchant API keys. Backend SDKs implement the pinned
  contract in the contrib hub `contract/`.
- Do not commit secrets.
- Local demos live under `examples/`.
