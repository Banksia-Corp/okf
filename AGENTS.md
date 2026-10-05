# AGENTS.md — Repository Guidelines & AI Pairing Rules

Welcome to `@banksia/okf`! This file defines the repository conventions, quality gates, and runtime constraints for autonomous agents and AI pair programming assistants.

## Repository Overview

`@banksia/okf` is the standalone implementation of the **Open Knowledge Format (OKF v0.2)** universal SDK, knowledge graph traversal engine, and Node.js adapter.

- **Universal Core**: Runtime-agnostic code lives under `src/` (zero Node-specific imports, compatible with browsers, Cloudflare Workers, Edge runtimes, and Node.js).
- **Node.js Adapter**: Node-specific implementations (file-system repository, logger, CLI runner) live strictly under `src/node/` and export as `@banksia/okf/node`.

## Guidelines for AI Agents

1. **Package Manager & Tooling**:
   - Always use `pnpm` (version `10.28.0`). Never execute `npm`, `yarn`, or `npx` directly.
   - Use `node` version specified in `.node-version` (Node 24 LTS).
2. **Universal Core Decoupling**:
   - Never import `node:*` modules (such as `node:fs`, `node:path`, `node:crypto`) inside `src/` root files.
   - All I/O and file system operations must remain decoupled through the `Repository` and `QueryableRepository` abstractions.
3. **Markdown Link Integrity**:
   - All links in markdown documentation must be relative (e.g. `./docs/...` instead of `/docs/...`).
4. **Issue-Driven Development**:
   - Track all units of work against GitHub Issues in [Banksia-Corp/okf](https://github.com/Banksia-Corp/okf).
   - Reference issue numbers in branch names, commit messages, and PR descriptions.
5. **Quality Gates & Commits**:
   - Always ensure `pnpm run lint` and `pnpm run format` succeed before completing a task.
   - Respect pre-commit verification configured in `lefthook.yml`.
   - Use Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
6. **Semantic Versioning & Changesets**:
   - Create a changeset using `pnpm changeset` or by adding a `.changeset/<name>.md` file whenever making user-facing features, bug fixes, or structural refactors.
   - Follow Semantic Versioning: `patch` for backwards-compatible bug fixes, `minor` for new functionality or backwards-compatible refactors, and `major` for breaking API changes.
