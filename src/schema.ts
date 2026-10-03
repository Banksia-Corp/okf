/**
 * @fileoverview Universal Open Knowledge Format (OKF v0.2) schema definitions and validators.
 *
 * This module defines the core Zod validation schemas, TypeScript interfaces, and normalization
 * utilities for OKF concept frontmatter, provenance metadata, verification tiers, and execution contracts.
 * It is completely runtime-agnostic and free of Node-specific dependencies.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Temporal window bounding the active usage or validity period of an attributed source.
 */
export interface UsageWindow {
  /** Optional ISO start date or timestamp (YYYY-MM-DD or ISO-8601). */
  start?: string;
  /** Optional ISO end date or timestamp (YYYY-MM-DD or ISO-8601). */
  end?: string;
}

/**
 * Attributed external resource, documentation citation, or dataset referenced by an OKF concept.
 */
export interface Source {
  /** URI, repository URL, or canonical path identifier of the source. */
  resource: string;
  /** Optional unique citation identifier within the document. */
  id?: string;
  /** Human-readable title of the cited resource. */
  title?: string;
  /** Author, organization, or entity responsible for the source. */
  author?: string;
  /** Total number of times this resource has been referenced or queried. */
  usage_count?: number;
  /** Last known modification date of the source (YYYY-MM-DD or ISO-8601). */
  last_modified?: string;
  /** Active temporal window of the cited resource. */
  usage_window?: UsageWindow;
}

/**
 * Provenance metadata detailing the agent, tool, or process that synthesized the concept document.
 */
export interface Generated {
  /** Identifier of the creating actor (e.g. `agent/v1.0.0`, `process:ci-build`). */
  by: string;
  /** ISO-8601 timestamp at which the document was generated. */
  at: string;
}

/**
 * Verification trust tier assigned to an OKF concept document.
 * - `unverified`: Default state without formal human or automated verification.
 * - `machine-confirmed`: Validated by automated tests, linters, or CI processes.
 * - `human-reviewed`: Reviewed and approved by an authorized human expert.
 */
export type TrustTier = 'unverified' | 'machine-confirmed' | 'human-reviewed';

/**
 * An individual attestation or verification event recording an actor validating the concept.
 */
export interface Verified {
  /** Identifier of the verifying actor (e.g. `human:alice`, `process:ci`). */
  by: string;
  /** ISO-8601 timestamp of verification. */
  at: string;
  /** Explicit verification trust tier assigned by the attesting actor. */
  tier?: TrustTier;
}

/**
 * Specification for executing reproducible computations, test suites, or benchmarks associated with a concept.
 */
export interface Executor {
  /** Execution runner or environment type (e.g. `shell`, `docker`, `node`). */
  type: string;
  /** Shell command or script entrypoint to execute the computation. */
  run: string;
}

/**
 * Execution receipt specification capturing computation output metadata and validation schema.
 */
export interface Receipt {
  /** Serialization format of the expected receipt (e.g. `json`, `csv`, `junit`). */
  format: string;
  /** Optional JSON schema object defining the expected schema of the execution receipt. */
  schema?: Record<string, unknown>;
}

/**
 * Attestation specification for computationally verifiable OKF concepts.
 */
export interface Attester {
  /** Attestation mechanism type (e.g. `static`, `runtime`, `crypto`). */
  type: string;
  /** Command or verification hook to evaluate concept truthfulness. */
  verify: string;
}

/**
 * Frontmatter metadata schema for OKF v0.2 concept markdown documents.
 */
export interface Frontmatter {
  /** OKF concept type descriptor (e.g. `concept`, `architecture`, `Attested Computation`). */
  type: string;
  /** Optional human-readable title of the concept. */
  title?: string;
  /** Optional short summary or description of the concept. */
  description?: string;
  /** Optional canonical resource URI or URN identifying the concept across registries. */
  resource?: string;
  /** Optional list of classification tags or indexing keywords. */
  tags?: string[];
  /** Optional list of external sources and citations. */
  sources?: Source[];
  /** Optional synthesis provenance metadata. */
  generated?: Generated;
  /** Optional verification attestations (single entry or array of entries). */
  verified?: Verified | Verified[];
  /** Lifecycle status of the concept. Defaults to `'active'`. */
  status?: 'active' | 'draft' | 'deprecated' | 'archived';
  /** Optional calendar date (YYYY-MM-DD) or ISO timestamp after which the concept is considered stale. */
  stale_after?: string;
  /** Optional execution environment configuration. */
  executor?: Executor;
  /** Optional execution receipt specification. */
  receipt?: Receipt;
  /** Optional computational attestation specification. */
  attester?: Attester;
  /** Arbitrary extra frontmatter properties permitted by passthrough validation. */
  [key: string]: unknown;
}

/**
 * In-memory representation of an Open Knowledge Format (OKF v0.2) concept document.
 */
export interface Concept {
  /** Unique concept identifier, typically derived from relative path without `.md` extension. */
  id: string;
  /** Relative or canonical file path where the concept markdown file is located. */
  filepath: string;
  /** Validated frontmatter metadata. */
  frontmatter: Frontmatter;
  /** Markdown body content without frontmatter delimiters. */
  body: string;
}

/**
 * Validates an actor identifier following OKF naming conventions.
 *
 * Supported formats:
 * - `<role>/v<version>` (e.g. `agent/v1.0.0`, `reviewer/v2`)
 * - `human:<id>` (e.g. `human:luis`, `human:alice_smith`)
 * - `process:<id>` (e.g. `process:ci-build`, `process:github_actions`)
 *
 * @example
 * ```ts
 * ActorSchema.parse('human:luis');
 * ActorSchema.parse('agent/v1.0.0');
 * ```
 */
export const ActorSchema: z.ZodType<string> = z
  .string()
  .regex(
    /^(?:[a-zA-Z0-9_-]+\/v[0-9.]+|human:[a-zA-Z0-9_-]+|process:[a-zA-Z0-9_-]+)$/,
    'Actor must follow <role>/<version>, human:<id>, or process:<id>'
  );

/**
 * Validates an ISO-8601 timestamp string or converts a `Date` instance to an ISO string.
 *
 * @example
 * ```ts
 * IsoDateTimeSchema.parse('2026-09-26T07:00:00Z');
 * IsoDateTimeSchema.parse(new Date());
 * ```
 */
export const IsoDateTimeSchema: z.ZodType<string> = z.union([
  z.string().datetime({ offset: true }),
  z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
      'Invalid ISO-8601 timestamp'
    ),
  z.date().transform((d) => d.toISOString()),
]);

/**
 * Validates calendar date strings in strict `YYYY-MM-DD` format.
 *
 * @example
 * ```ts
 * DateOnlySchema.parse('2026-12-31');
 * ```
 */
export const DateOnlySchema: z.ZodType<string> = z
  .string()
  .date('Date must follow YYYY-MM-DD format');

/**
 * Validates an optional temporal usage window for citations.
 */
export const UsageWindowSchema: z.ZodType<UsageWindow> = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

/**
 * Validates source citations and provenance attribution entries.
 *
 * @example
 * ```ts
 * SourceSchema.parse({
 *   resource: 'https://github.com/Banksia-Corp/okf',
 *   title: 'OKF Specification',
 * });
 * ```
 */
export const SourceSchema: z.ZodType<Source> = z.object({
  resource: z.string(),
  id: z.string().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
  usage_count: z.number().int().nonnegative().optional(),
  last_modified: z.string().optional(),
  usage_window: UsageWindowSchema.optional(),
});

/**
 * Validates generation metadata recording the synthesizing agent and timestamp.
 */
export const GeneratedSchema: z.ZodType<Generated> = z.object({
  by: ActorSchema,
  at: IsoDateTimeSchema,
});

/**
 * Validates trust tier enumeration values.
 */
export const TrustTierSchema: z.ZodType<TrustTier> = z.enum([
  'unverified',
  'machine-confirmed',
  'human-reviewed',
]);

/**
 * Validates an individual concept verification entry.
 */
export const VerifiedEntrySchema: z.ZodType<Verified> = z.object({
  by: ActorSchema,
  at: IsoDateTimeSchema,
  tier: TrustTierSchema.optional(),
});

/**
 * Sanitizes text for safe interpolation inside Markdown table cells and log entries.
 * Escapes pipe characters (`|`) and converts carriage returns / newlines to single spaces.
 *
 * @param text - The raw text string to sanitize.
 * @returns Sanitized string safe for Markdown table cells.
 *
 * @example
 * ```ts
 * sanitizeMarkdownCell('Line 1\nLine 2 | extra');
 * // returns: 'Line 1 Line 2 \| extra'
 * ```
 */
export function sanitizeMarkdownCell(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

/**
 * Validates verification attestations formatted as either a single entry or an array of entries.
 */
export const NormalizedVerifiedSchema: z.ZodType<Verified | Verified[]> =
  z.union([VerifiedEntrySchema, z.array(VerifiedEntrySchema)]);

/**
 * Validates executor configurations for executable concepts.
 *
 * @example
 * ```ts
 * ExecutorSchema.parse({ type: 'shell', run: 'pnpm test' });
 * ```
 */
export const ExecutorSchema: z.ZodType<Executor> = z.object({
  type: z.string(),
  run: z.string(),
});

/**
 * Validates execution receipt format and schema expectations.
 */
export const ReceiptSchema: z.ZodType<Receipt> = z.object({
  format: z.string(),
  schema: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Validates attestation specifications for Attested Computation concepts.
 */
export const AttesterSchema: z.ZodType<Attester> = z.object({
  type: z.string(),
  verify: z.string(),
});

/**
 * Comprehensive Zod schema validating OKF v0.2 frontmatter metadata.
 *
 * Passthrough validation is enabled so extra properties are preserved.
 *
 * @example
 * ```ts
 * const res = FrontmatterSchema.safeParse({
 *   type: 'concept',
 *   title: 'Knowledge Graph Traversal',
 * });
 * ```
 */
export const FrontmatterSchema: z.ZodType<Frontmatter> = z
  .object({
    type: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    resource: z.string().optional(),
    tags: z.array(z.string()).optional(),
    sources: z.array(SourceSchema).optional(),
    generated: GeneratedSchema.optional(),
    verified: NormalizedVerifiedSchema.optional(),
    status: z
      .enum(['active', 'draft', 'deprecated', 'archived'])
      .default('active'),
    stale_after: DateOnlySchema.optional(),
    executor: ExecutorSchema.optional(),
    receipt: ReceiptSchema.optional(),
    attester: AttesterSchema.optional(),
  })
  .passthrough();

/**
 * Normalizes verification metadata into a standardized array of {@link Verified} entries.
 *
 * @param verified - A single verification entry, an array of entries, or undefined.
 * @returns An array containing zero or more verification entries.
 *
 * @example
 * ```ts
 * normalizeVerified(undefined); // []
 * normalizeVerified({ by: 'human:luis', at: '2026-09-26T00:00:00Z' });
 * // [{ by: 'human:luis', at: '2026-09-26T00:00:00Z' }]
 * ```
 */
export function normalizeVerified(
  verified?: Verified[] | Verified
): Verified[] {
  if (!verified) return [];
  return Array.isArray(verified) ? verified : [verified];
}

/**
 * Derives the effective trust tier for a concept based on its verification records.
 *
 * Priority rules:
 * 1. If any attestation has `tier === 'human-reviewed'` or actor starts with `human:`, returns `'human-reviewed'`.
 * 2. If valid attestations exist but none are human, returns `'machine-confirmed'`.
 * 3. Otherwise returns `'unverified'`.
 *
 * @param verified - Verification attestations to inspect.
 * @returns Derived {@link TrustTier} value.
 *
 * @example
 * ```ts
 * deriveTrustTier([]); // 'unverified'
 * deriveTrustTier({ by: 'process:ci', at: '2026-09-26T00:00:00Z' }); // 'machine-confirmed'
 * deriveTrustTier({ by: 'human:luis', at: '2026-09-26T00:00:00Z' }); // 'human-reviewed'
 * ```
 */
export function deriveTrustTier(verified?: Verified[] | Verified): TrustTier {
  if (!verified) return 'unverified';
  const list = normalizeVerified(verified);
  if (list.length === 0) return 'unverified';
  if (
    list.some(
      (v) => v.tier === 'human-reviewed' || (v.by && v.by.startsWith('human:'))
    )
  ) {
    return 'human-reviewed';
  }
  return 'machine-confirmed';
}

/**
 * Determines whether a concept document is fresh according to its `stale_after` expiration date.
 *
 * @param stale_after - ISO date string or timestamp (e.g. `2026-12-31`). If omitted, concept is fresh.
 * @param now - Reference date to evaluate freshness against (defaults to current time).
 * @returns `true` if the concept is still fresh, `false` if expired or date is invalid.
 *
 * @example
 * ```ts
 * isFresh('2026-12-31'); // true (if current date is before expiration)
 * isFresh('2020-01-01'); // false
 * ```
 */
export function isFresh(stale_after?: string, now: Date = new Date()): boolean {
  if (!stale_after) return true;
  const expiration = stale_after.includes('T')
    ? new Date(stale_after)
    : new Date(`${stale_after}T23:59:59.999Z`);
  if (isNaN(expiration.getTime())) return false;
  return expiration.getTime() >= now.getTime();
}

/** Backward compatibility alias for {@link SourceSchema}. */
export const OKFSourceSchema: z.ZodType<Source> = SourceSchema;

/** Backward compatibility alias for {@link GeneratedSchema}. */
export const OKFGeneratedSchema: z.ZodType<Generated> = GeneratedSchema;

/** Backward compatibility alias for {@link VerifiedEntrySchema}. */
export const OKFVerifiedSchema: z.ZodType<Verified> = VerifiedEntrySchema;

/** Backward compatibility alias for {@link ExecutorSchema}. */
export const OKFExecutorSchema: z.ZodType<Executor> = ExecutorSchema;

/** Backward compatibility alias for {@link ReceiptSchema}. */
export const OKFReceiptSchema: z.ZodType<Receipt> = ReceiptSchema;

/** Backward compatibility alias for {@link AttesterSchema}. */
export const OKFAttesterSchema: z.ZodType<Attester> = AttesterSchema;

/** Backward compatibility alias for {@link FrontmatterSchema}. */
export const OKFFrontmatterSchema: z.ZodType<Frontmatter> = FrontmatterSchema;

/** Backward compatibility alias for {@link Source}. */
export type OKFSource = Source;

/** Backward compatibility alias for {@link Generated}. */
export type OKFGenerated = Generated;

/** Backward compatibility alias for {@link Verified}. */
export type OKFVerified = Verified;

/** Backward compatibility alias for {@link Frontmatter}. */
export type OKFFrontmatter = Frontmatter;

/** Backward compatibility alias for {@link Concept}. */
export type OKFConcept = Concept;
