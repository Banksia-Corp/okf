# @banksia/okf

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
