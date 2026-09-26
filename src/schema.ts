import { z } from 'zod';

export const ActorSchema = z
  .string()
  .regex(
    /^(?:[a-zA-Z0-9_-]+\/v[0-9.]+|human:[a-zA-Z0-9_-]+|process:[a-zA-Z0-9_-]+)$/,
    'Actor must follow <role>/<version>, human:<id>, or process:<id>'
  );

export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .or(
    z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
        'Invalid ISO-8601 timestamp'
      )
  );

export const DateOnlySchema = z
  .string()
  .date('Date must follow YYYY-MM-DD format');

export const UsageWindowSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

export const SourceSchema = z.object({
  resource: z.string(),
  id: z.string().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
  usage_count: z.number().int().nonnegative().optional(),
  last_modified: z.string().optional(),
  usage_window: UsageWindowSchema.optional(),
});

export const GeneratedSchema = z.object({
  by: ActorSchema,
  at: IsoDateTimeSchema,
});

export const TrustTierSchema = z.enum([
  'unverified',
  'machine-confirmed',
  'human-reviewed',
]);
export type TrustTier = z.infer<typeof TrustTierSchema>;

export const VerifiedEntrySchema = z.object({
  by: ActorSchema,
  at: IsoDateTimeSchema,
  tier: TrustTierSchema.optional(),
});

/**
 * Sanitizes text for safe interpolation inside Markdown table cells and log entries.
 * Escapes pipe characters (|) and converts carriage returns / newlines to single spaces.
 */
export function sanitizeMarkdownCell(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

export const NormalizedVerifiedSchema = z.union([
  VerifiedEntrySchema,
  z.array(VerifiedEntrySchema),
]);

export const ExecutorSchema = z.object({
  type: z.string(),
  run: z.string(),
});

export const ReceiptSchema = z.object({
  format: z.string(),
  schema: z.record(z.string(), z.unknown()).optional(),
});

export const AttesterSchema = z.object({
  type: z.string(),
  verify: z.string(),
});

export const FrontmatterSchema = z
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

export type Source = z.infer<typeof SourceSchema>;
export type Generated = z.infer<typeof GeneratedSchema>;
export type Verified = z.infer<typeof VerifiedEntrySchema>;
export type Executor = z.infer<typeof ExecutorSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;
export type Attester = z.infer<typeof AttesterSchema>;
export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export interface Concept {
  id: string;
  filepath: string;
  frontmatter: Frontmatter;
  body: string;
}

// Verification Normalization Helper
export function normalizeVerified(
  verified?: Verified[] | Verified
): Verified[] {
  if (!verified) return [];
  return Array.isArray(verified) ? verified : [verified];
}

// Derived State Helpers
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

export function isFresh(stale_after?: string, now: Date = new Date()): boolean {
  if (!stale_after) return true;
  const expiration = stale_after.includes('T')
    ? new Date(stale_after)
    : new Date(`${stale_after}T23:59:59.999Z`);
  if (isNaN(expiration.getTime())) return false;
  return expiration.getTime() >= now.getTime();
}

// Backward Compatibility Aliases
export const OKFSourceSchema = SourceSchema;
export const OKFGeneratedSchema = GeneratedSchema;
export const OKFVerifiedSchema = VerifiedEntrySchema;
export const OKFExecutorSchema = ExecutorSchema;
export const OKFReceiptSchema = ReceiptSchema;
export const OKFAttesterSchema = AttesterSchema;
export const OKFFrontmatterSchema = FrontmatterSchema;
export type OKFSource = Source;
export type OKFGenerated = Generated;
export type OKFVerified = Verified;
export type OKFFrontmatter = Frontmatter;
export type OKFConcept = Concept;
