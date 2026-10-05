---
'@banksia/okf': minor
---

refactor(cli): migrate CLI parser and subcommands to citty

- Migrate from monolithic `node:util.parseArgs` implementation to declarative, lightweight `citty@0.2.2`.
- Modularize subcommands into `src/node/commands/` (`create`, `validate`, `index`, `attest`, `graph`).
- Add subcommand aliasing (`okf create` / `okf new`).
- Preserve 100% backward compatibility for all existing commands, options, and public exports (`runCli`, `printHelp`).
