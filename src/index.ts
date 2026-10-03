/**
 * @fileoverview `@banksia/okf` — Universal Open Knowledge Format (OKF v0.2) Core SDK.
 *
 * This entrypoint exports the universal, runtime-agnostic core of OKF. It contains zero Node-specific
 * dependencies and is compatible with modern browsers, Cloudflare Workers, Edge runtimes, Deno, and Node.js.
 *
 * Key components:
 * - Schema & Validators: {@link FrontmatterSchema}, {@link ActorSchema}, {@link Concept}
 * - Parsers: {@link GrayMatterParser}, {@link parseConceptContent}, {@link stringifyConcept}
 * - Repositories: {@link Repository}, {@link QueryableRepository}, {@link InMemoryRepository}
 * - Graph Traversal: {@link buildGraph}, {@link getDependencies}, {@link getDependents}, {@link getNeighbors}
 * - Client: {@link Client}, {@link CreateConceptOptions}
 * - Configuration: {@link OKFConfig}, {@link defineConfig}, {@link normalizeKnowledgeRoots}
 * - Attestation & Logging: {@link evaluateAttestedComputation}, {@link AuditLogger}
 *
 * @packageDocumentation
 */

export * from './schema.js';
export * from './parser.js';
export * from './repository.js';
export * from './graph.js';
export * from './client.js';
export * from './indexer.js';
export * from './attester.js';
export * from './logger.js';
export * from './config.js';
