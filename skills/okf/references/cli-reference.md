# OKF CLI Command Suite Reference

This reference provides a complete catalog of commands, options, configuration discovery, and exit codes for the `okf` CLI.

---

## Global Options

- `--config, -c <path>`: Explicit path to configuration file (`okf.config.{ts,js,mjs,json}`).
- `--help, -h`: Display top-level or command-specific help message.

---

## Commands

### `okf create` (alias: `okf new`)

Scaffolds a new concept document with validated frontmatter headers.

```bash
okf create <filepath> [options]
```

**Options:**

- `--title, -t <title>`: Concept title (**required**).
- `--type <type>`: Document classifier (default: `'concept'`).
- `--desc, -d <description>`: Summary description.
- `--tags <tag1,tag2>`: Comma-delimited list of tags.
- `--status <status>`: `active` | `draft` | `deprecated` | `archived` (default: `'active'`).
- `--stale-after <YYYY-MM-DD>`: Calendar expiration date.
- `--resource <uri>`: Canonical URI/URN identifier.
- `--body <body>`: Initial markdown body content.
- `--force, -f`: Overwrite existing target file.
- `--actor <id>`: Actor identifier (default: `human:$USER`).
- `--no-log`: Skip appending audit record to `log.md`.

---

### `okf validate`

Validates schema compliance across a single markdown file or entire directory tree.

```bash
okf validate [path]
```

**Behavior:**

- Single file: Validates that frontmatter parses and satisfies OKF v0.2 schema constraints.
- Directory: Recursively discovers all `.md` concept documents and checks compliance.
- Exit code `0` on success; `1` if any file violates schema rules.

---

### `okf index`

Generates or updates navigation tables in directory `index.md`.

```bash
okf index [dir]
```

**Behavior:**

- Inspects subdirectories and concept markdown files.
- Generates a Markdown table linking concept titles to their filenames with descriptions.
- Preserves directory navigation structure.

---

### `okf attest`

Evaluates and verifies computational attestation concepts.

```bash
okf attest <filepath>
```

**Behavior:**

- Confirms `frontmatter.type === 'Attested Computation'`.
- Validates configured executor run command and attester verify contract.

---

### `okf graph`

Renders the concept knowledge graph and bidirectional link structure.

```bash
okf graph [dir] [--json]
```

**Options:**

- `--json`: Outputs machine-readable graph topology containing `nodes` and `edges`.

---

### `okf skill install` (aliases: `okf skill init`, `okf skill add`)

Installs the official OKF Agent Skill into the project or global user directory.

```bash
okf skill install [targetDir] [options]
```

**Options:**

- `--dest, -d <path>`: Custom destination path.
- `--agent <platform>`: Platform target preset (`gemini`, `claude`, `generic`).
- `--force, -f`: Overwrite existing skill files.
- `--global, -g`: Install into user global skills directory.
- `--dry-run`: Preview destination path and files without writing.

---

## Exit Codes

- `0`: Success / clean execution.
- `1`: Validation errors, missing required parameters, or execution failure.
