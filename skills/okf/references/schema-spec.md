# OKF v0.2 Frontmatter Metadata Specification

This reference document defines the complete schema specification for Open Knowledge Format (OKF v0.2) frontmatter headers.

---

## Frontmatter Schema Overview

OKF concepts embed YAML frontmatter delimited by `---` at the beginning of Markdown files.

```yaml
---
type: concept
title: Knowledge Graph Navigation
description: Core traversal abstractions for bidirectional concept relationships.
resource: urn:okf:core:graph
tags:
  - architecture
  - graph
status: active
stale_after: 2027-12-31
actor: human:luis
sources:
  - resource: https://github.com/Banksia-Corp/okf
    title: OKF Repository
    usage_count: 5
generated:
  by: agent/v1.0.0
  at: 2026-10-05T12:00:00Z
verified:
  - by: human:reviewer
    at: 2026-10-05T14:30:00Z
    tier: human-reviewed
---
```

---

## Field Specifications

### 1. `type` (string, required)

The functional classifier of the document.

- Common values: `'concept'`, `'architecture'`, `'decision'`, `'Attested Computation'`.
- Default: `'concept'`.

### 2. `title` (string, optional)

Human-readable title for the concept document. Rendered in headers and directory index tables.

### 3. `description` (string, optional)

One or two sentence summary of the concept's scope, purpose, or conclusions.

### 4. `status` (string enum, optional, default: `'active'`)

The lifecycle phase of the concept:

- `active`: Currently valid and actively maintained.
- `draft`: Incomplete work in progress.
- `deprecated`: Obsolete or superseded by another concept.
- `archived`: Historical record preserved for auditing but no longer applicable.

### 5. `stale_after` (string, optional)

Calendar expiration date in strict format: `YYYY-MM-DD` (e.g. `2027-06-30`). Concepts past this date trigger stale warnings during validation audits.

### 6. `resource` (string, optional)

Canonical URI or URN identifying the concept across organizations and external registries (e.g., `urn:okf:core:engine`).

### 7. `tags` (array of strings, optional)

Categorical keywords used for indexing and graph filtering.

### 8. `actor` (string, optional)

The identifier of the initiating or editing author.
Must match one of three formats:

- `<role>/v<version>` (e.g., `agent/v1.0.0`, `reviewer/v2`)
- `human:<id>` (e.g., `human:luis`)
- `process:<id>` (e.g., `process:ci-build`)

### 9. `sources` (array of Source objects, optional)

External citations, datasets, or documentation references.

- `resource` (string, required): URI or file path.
- `id` (string, optional): Unique citation key.
- `title` (string, optional): Title of the cited work.
- `author` (string, optional): Author or organization.
- `usage_count` (integer >= 0, optional): Query count.
- `last_modified` (string, optional): Date/timestamp.
- `usage_window` (object, optional): `{ start?: string, end?: string }`.

### 10. `generated` (object, optional)

Provenance tracking for automated synthesis:

- `by` (Actor string, required): Actor ID of synthesizing agent/process.
- `at` (ISO-8601 string, required): Timestamp of generation.

### 11. `verified` (Verified object or array of objects, optional)

Verification and attestation history:

- `by` (Actor string, required): Actor ID.
- `at` (ISO-8601 string, required): Timestamp.
- `tier` (enum, optional): `unverified` | `machine-confirmed` | `human-reviewed`.
