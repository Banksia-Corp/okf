# @banksia/okf

## 0.3.0

### Minor Changes

- [#40](https://github.com/Banksia-Corp/okf/pull/40) [`fba49de`](https://github.com/Banksia-Corp/okf/commit/fba49de09d039eeb587b03b983d2a7050ad39d04) Thanks [@luismiddleton](https://github.com/luismiddleton)! - Optimize SDK and CLI bundle size, migrate to Pure ESM, and upgrade frontmatter parser to `@11ty/gray-matter`:

  - Transition to Pure ESM by dropping CommonJS build outputs (`dist/index.cjs`, `dist/node/index.cjs`).
  - Upgrade frontmatter parser to `@11ty/gray-matter` (resolving CVE-2020-7788/`GHSA-hp3w-g68c-fv3c` in upstream transitive dependency and using `Uint8Array` for Universal Core decoupling).
  - Add `"sideEffects": false` in `package.json` for enhanced downstream bundler tree-shaking.
  - Lazy-load `jiti` on demand via dynamic `await import('jiti')` during TypeScript/JavaScript configuration loading.
  - Lazy-load CLI subcommands on demand in `citty` runner.

## 0.2.1

### Patch Changes

- [#37](https://github.com/Banksia-Corp/okf/pull/37) [`6a18d2c`](https://github.com/Banksia-Corp/okf/commit/6a18d2c521776f70664c1799da32df2fd4b2c25a) Thanks [@luismiddleton](https://github.com/luismiddleton)! - Resolve Antigravity CLI skill installation paths (`.agents/skills/okf` in workspace scope, `~/.gemini/config/skills/okf` in global scope) and expand `AgentPlatform` type with `antigravity`.

## 0.2.0

### Minor Changes

- [#34](https://github.com/Banksia-Corp/okf/pull/34) [`6955f61`](https://github.com/Banksia-Corp/okf/commit/6955f61d6f18d6c1eab67d33535e7afeb2ba4d1a) Thanks [@luismiddleton](https://github.com/luismiddleton)! - Add official Open Knowledge Format (OKF v0.2) agent skill and CLI installation subcommand (`okf skill install`).

## 0.1.0

### Minor Changes

- [#32](https://github.com/Banksia-Corp/okf/pull/32) [`8ddc9a2`](https://github.com/Banksia-Corp/okf/commit/8ddc9a2fbe90e8cd425d9919886c53c24d7584eb) Thanks [@luismiddleton](https://github.com/luismiddleton)! - refactor(cli): migrate CLI parser and subcommands to citty

  - Migrate from monolithic `node:util.parseArgs` implementation to declarative, lightweight `citty@0.2.2`.
  - Modularize subcommands into `src/node/commands/` (`create`, `validate`, `index`, `attest`, `graph`).
  - Add subcommand aliasing (`okf create` / `okf new`).
  - Preserve 100% backward compatibility for all existing commands, options, and public exports (`runCli`, `printHelp`).

## 0.0.2

### Patch Changes

- [#23](https://github.com/Banksia-Corp/okf/pull/23) [`89eb8de`](https://github.com/Banksia-Corp/okf/commit/89eb8decff6796d488380be27496651210184b7b) Thanks [@luismiddleton](https://github.com/luismiddleton)! - Resolve JSR slow types / missing explicit type annotations and add comprehensive TSDoc ([#22](https://github.com/Banksia-Corp/okf/issues/22))
