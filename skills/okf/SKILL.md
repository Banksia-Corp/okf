---
name: okf
description: >
  Use this skill when creating, editing, validating, indexing, or managing
  knowledge base documentation and concept graphs using the Open Knowledge
  Format (OKF v0.2) and the OKF CLI (`okf`). This includes scaffolding new
  concept documents (`okf create`), checking frontmatter metadata schema
  compliance (`okf validate`), generating or updating directory navigation
  indexes (`okf index`), verifying computational attestations (`okf attest`),
  and analyzing knowledge graph links and dependencies (`okf graph`). Also use
  when the user asks to structure project documentation with typed frontmatter,
  status lifecycles, and bidirectional graph links, even if they do not
  explicitly mention "OKF" by name.
---

# Open Knowledge Format (OKF v0.2) Skill

The Open Knowledge Format (OKF v0.2) standardizes structured markdown documentation, typed frontmatter metadata, verification attestation, and graph relationships across human and AI-authored knowledge bases.

This skill equips agents with precise workflows, commands, gotchas, and verification loops when creating, validating, and maintaining OKF concepts.

---

## Quick Reference & Defaults

- **Default concept directory**: `docs/concepts/` (or project-configured root)
- **Default concept type**: `concept`
- **Default status**: `active`
- **Default actor**: `human:$USER` or `<role>/<version>` (e.g., `agent/v1.0.0`)
- **CLI binary**: `okf` (aliases: `okf create` / `okf new`)

---

## When to Consult Reference Documentation

To conserve context, read reference documents only when deeper specification is needed:

- **Metadata Schema & Types**: Read [references/schema-spec.md](./references/schema-spec.md) for full frontmatter fields (`sources`, `usage_window`, `generated`, `verified`, `stale_after`).
- **Complete CLI Reference**: Read [references/cli-reference.md](./references/cli-reference.md) for advanced CLI flags, configuration discovery (`okf.config.{ts,js,mjs,json}`), and JSON outputs.
- **Computational Attestation**: Read [references/attestation.md](./references/attestation.md) when evaluating executable code contracts, test runner hooks, or execution receipts.

---

## Core Procedures & Checklists

### 1. Scaffolding a New Concept

Always use `okf create` (or template assets in `assets/templates/`) rather than writing raw frontmatter from scratch:

```bash
okf create docs/concepts/my-concept.md \
  --title "My Concept Title" \
  --type "concept" \
  --desc "Short summary of the concept" \
  --tags "architecture,core" \
  --status "active"
```

**Checklist:**

1. Choose an appropriate kebab-case filename (e.g. `storage-engine.md`).
2. Provide a descriptive `--title`.
3. Set `--tags` for discoverability.
4. If the concept has an expiration date, specify `--stale-after YYYY-MM-DD`.
5. Populate the markdown body with structured explanations, code snippets, or diagrams.

### 2. Mandatory Validation Loop

> [!IMPORTANT]
> **Mandatory Rule**: Whenever you create or modify a concept file, you MUST immediately validate it using `okf validate`.

```bash
okf validate docs/concepts/my-concept.md
```

If validation fails:

1. Examine the CLI diagnostic message (field path and expected format).
2. Fix the frontmatter or body issue.
3. Re-run `okf validate <path>` until it passes with exit code 0.

### 3. Maintaining Directory Navigation (`index.md`)

When adding, moving, or renaming concept files within a directory:

```bash
okf index docs/concepts
```

This updates or generates `docs/concepts/index.md` with:

- Subdirectory navigation links.
- Concept tables summarizing Title, Type, and Description.

### 4. Knowledge Graph Inspection & Link Auditing

To verify graph linkages and uncover orphaned concepts or missing references:

```bash
# Text summary of node count and edges
okf graph docs/concepts

# JSON format for agent programmatic analysis
okf graph docs/concepts --json
```

---

## Gotchas & Failure Modes

1. **`status` Enum Restriction**:
   - Allowed values are strictly: `active`, `draft`, `deprecated`, `archived`.
   - Values like `wip`, `in-progress`, or `published` will fail schema validation.

2. **Actor Format Restrictions**:
   - Actor IDs must match:
     - `<role>/v<version>` (e.g., `agent/v1.0.0`, `reviewer/v2`)
     - `human:<id>` (e.g., `human:luis`)
     - `process:<id>` (e.g., `process:ci-build`)
   - Plain strings like `luis` or `Alice Smith` will fail validation.

3. **`stale_after` Date Format**:
   - Must be calendar date format `YYYY-MM-DD` (e.g. `2027-12-31`). Full ISO timestamps with time components will fail this field validator.

4. **Directory `index.md` Generation**:
   - Running `okf index <dir>` regenerates the index table from files in the directory. Ensure any custom overview text is maintained appropriately.

5. **Universal Core Decoupling**:
   - Universal OKF core (`src/`) has zero Node.js dependencies (`node:fs`, `node:path`). All file I/O operations must use the repository abstraction or Node adapter (`@banksia/okf/node`).

---

## Step-by-Step Execution Checklist for Agents

- [ ] Determine concept target path (default `docs/concepts/<slug>.md`).
- [ ] Run `okf create <path> --title "<Title>" ...` or instantiate from `assets/templates/`.
- [ ] Fill in comprehensive markdown content.
- [ ] Run `okf validate <path>` to verify frontmatter conformance.
- [ ] Run `okf index <dir>` to register new file in navigation table.
- [ ] Run `okf graph <dir>` to verify graph connectivity.
