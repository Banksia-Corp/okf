---
'@banksia/okf': minor
---

Optimize SDK and CLI bundle size, migrate to Pure ESM, and upgrade frontmatter parser to `@11ty/gray-matter`:

- Transition to Pure ESM by dropping CommonJS build outputs (`dist/index.cjs`, `dist/node/index.cjs`).
- Upgrade frontmatter parser to `@11ty/gray-matter` (resolving CVE-2020-7788/`GHSA-hp3w-g68c-fv3c` in upstream transitive dependency and using `Uint8Array` for Universal Core decoupling).
- Add `"sideEffects": false` in `package.json` for enhanced downstream bundler tree-shaking.
- Lazy-load `jiti` on demand via dynamic `await import('jiti')` during TypeScript/JavaScript configuration loading.
- Lazy-load CLI subcommands on demand in `citty` runner.
