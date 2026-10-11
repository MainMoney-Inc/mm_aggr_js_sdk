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

`@mainmoneyapp/js-angular` is built with ng-packagr (Ivy partial compilation). Do not bundle that package with tsup.

## npm

Packages: `@mainmoneyapp/js-core`, `@mainmoneyapp/js-http`, `@mainmoneyapp/js-checkout`,
`@mainmoneyapp/js-react`, `@mainmoneyapp/js-vue`, `@mainmoneyapp/js-angular`. Releases are
automated: bump `version` in every `packages/*/package.json` (and the pinned
`@mainmoneyapp/*` dependencies), update `CHANGELOG.md`, then push an annotated tag
`vX.Y.Z`. The `Publish` workflow publishes all packages to npm with provenance using
the `NPM_TOKEN` organisation secret. Never commit npm tokens.

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
