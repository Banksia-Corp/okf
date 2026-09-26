# @banksia/okf

Open Knowledge Format (OKF v0.2) universal SDK, knowledge graph traversal engine, and Node.js adapter.

## Overview

The Open Knowledge Format (OKF) standardizes structured markdown documentation, typed frontmatter metadata, verification attestation, and graph relationships across human and AI-authored knowledge bases.

`@banksia/okf` delivers:

- **Universal Decoupled Core (`@banksia/okf`)**: Zero-dependency runtime-agnostic library compatible with Node.js, Cloudflare Workers, Edge environments, and browsers.
- **Dedicated Node.js Adapter (`@banksia/okf/node`)**: High-performance file system repository, path traversal protection, atomic audit logging, and directory indexing.
- **Zero-Dependency CLI (`okf`)**: Interactive CLI tool for validating knowledge bases, computing attestation hashes, generating index files, and querying dependency graphs.

## Installation

```bash
pnpm add @banksia/okf
```

## Quick Start

### CLI Usage

```bash
# Scaffold a new OKF concept document
okf create docs/concepts/my-concept.md --title "My First Concept" --tags "core,arch"

# Validate OKF frontmatter schema across files or directories
okf validate ./docs

# Generate or update directory index.md
okf index ./docs/concepts

# Generate dependency knowledge graph
okf graph ./docs --json
```

### Universal Core Usage

```typescript
import { GrayMatterParser, InMemoryRepository, Client } from '@banksia/okf';

const repository = new InMemoryRepository();
const parser = new GrayMatterParser();
const client = new Client({ repository, parser });
```

### Node.js Filesystem Usage

```typescript
import { FileSystemRepository } from '@banksia/okf/node';
import { GrayMatterParser, Client } from '@banksia/okf';

const repository = new FileSystemRepository('./docs/knowledge');
const parser = new GrayMatterParser();
const client = new Client({ repository, parser });
```

## Development

```bash
# Install dependencies
pnpm install

# Check code formatting & linting
pnpm run lint

# Automatically format code
pnpm run format
```

## Governance & Contributing

- [AGENTS.md](./AGENTS.md) — Guidelines and rules for autonomous agents and AI pair programming.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Contribution workflow, branch conventions, and testing requirements.
- [LICENSE](./LICENSE) — MIT License.
