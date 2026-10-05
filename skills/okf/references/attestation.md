# OKF Computational Attestation Specification

This reference describes the computational attestation protocol supported by OKF v0.2.

---

## Overview

OKF allows concepts to define **computational assertions** that can be programmatically verified and attested. This guarantees that technical claims, benchmarks, benchmarks, or invariants documented in markdown stay aligned with executable code reality.

---

## Frontmatter Contracts

To qualify as an `Attested Computation`, the concept frontmatter MUST define:

1. `type: Attested Computation`
2. `executor`: Object specifying how to run the target program or benchmark.
   - `type`: Environment runtime (`shell`, `docker`, `node`).
   - `run`: Shell command to execute.
3. `receipt`: Object specifying expected execution receipt structure.
   - `format`: Format identifier (`json`, `junit`, `csv`).
   - `schema` (optional): JSON schema describing output format.
4. `attester`: Object defining the verification condition.
   - `type`: Attestation mechanism (`static`, `runtime`, `crypto`).
   - `verify`: Shell command or evaluation expression verifying concept veracity.

---

## Example Concept Document

```markdown
---
type: Attested Computation
title: In-Memory Graph Index Benchmark
description: Attestation ensuring concept graph traversal remains under 5ms for 1,000 nodes.
status: active
executor:
  type: shell
  run: pnpm test tests/graph.test.ts
receipt:
  format: json
attester:
  type: runtime
  verify: exit 0
---

# In-Memory Graph Index Benchmark

This document attests to the runtime performance benchmarks of the OKF in-memory graph indexer.

## Execution Requirements

Running `okf attest docs/concepts/graph-benchmark.md` verifies that the test suite runs and completes successfully.
```

---

## Verifying Attestation

Execute `okf attest`:

```bash
okf attest docs/concepts/graph-benchmark.md
```

The CLI inspects the frontmatter contract, validates the executor specification, and outputs the verification status.
