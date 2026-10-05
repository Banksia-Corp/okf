# @banksia/okf

Open Knowledge Format (OKF v0.2) universal SDK, knowledge graph traversal engine, and Node.js adapter.

## Overview

The Open Knowledge Format (OKF) standardizes structured markdown documentation, typed frontmatter metadata, verification attestation, and graph relationships across human and AI-authored knowledge bases.

`@banksia/okf` delivers:

- **Universal Decoupled Core (`@banksia/okf`)**: Minimal-dependency runtime-agnostic library compatible with Node.js, Cloudflare Workers, Edge environments, and browsers (utilizing `zod` for type-safe schema validation and `gray-matter` for frontmatter parsing).
- **Dedicated Node.js Adapter (`@banksia/okf/node`)**: High-performance file system repository, path traversal protection, atomic audit logging, and directory indexing.
- **Interactive CLI (`okf`)**: Interactive CLI tool for scaffolding concepts, validating knowledge bases, verifying attestation, generating directory indexes, and querying knowledge graphs.

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

# Install official OKF Agent Skill into workspace (.agents/skills/okf/)
okf skill install
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

### Testing the CLI Locally

To test the `okf` CLI locally across your system before the package is published to npm:

1. **Link the package globally**:

   ```bash
   pnpm link --global
   ```

   _(Ensure pnpm's global bin directory is in your `$PATH`, e.g., `~/.local/share/pnpm`)._

2. **Run `okf` directly from anywhere**:

   ```bash
   okf --help
   okf validate ./docs
   ```

3. **Unlink when finished**:
   ```bash
   pnpm unlink --global @banksia/okf
   ```

## Governance & Contributing

- [AGENTS.md](./AGENTS.md) — Guidelines and rules for autonomous agents and AI pair programming.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Contribution workflow, branch conventions, and testing requirements.
- [LICENSE](./LICENSE) — MIT License.
