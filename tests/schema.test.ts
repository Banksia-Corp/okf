import { describe, it, expect } from 'vitest';
import {
  ActorSchema,
  DateOnlySchema,
  IsoDateTimeSchema,
  FrontmatterSchema,
  normalizeVerified,
  deriveTrustTier,
  isFresh,
} from '../src/schema.js';

describe('OKF v0.2 Schema Rules', () => {
  describe('ActorSchema', () => {
    it('accepts valid role/version actors', () => {
      expect(ActorSchema.safeParse('agent/v1.0.0').success).toBe(true);
      expect(ActorSchema.safeParse('reviewer/v2').success).toBe(true);
      expect(ActorSchema.safeParse('compiler-bot/v0.1').success).toBe(true);
    });

    it('accepts valid human:<id> actors', () => {
      expect(ActorSchema.safeParse('human:luis').success).toBe(true);
      expect(ActorSchema.safeParse('human:alice_smith').success).toBe(true);
      expect(ActorSchema.safeParse('human:user-123').success).toBe(true);
    });

    it('accepts valid process:<id> actors', () => {
      expect(ActorSchema.safeParse('process:ci-build').success).toBe(true);
      expect(ActorSchema.safeParse('process:github_actions').success).toBe(
        true
      );
      expect(ActorSchema.safeParse('process:cron-job-1').success).toBe(true);
    });

    it('rejects invalid actor strings', () => {
      expect(ActorSchema.safeParse('invalid_actor').success).toBe(false);
      expect(ActorSchema.safeParse('human:').success).toBe(false);
      expect(ActorSchema.safeParse('agent/').success).toBe(false);
      expect(ActorSchema.safeParse('agent/1.0').success).toBe(false);
      expect(ActorSchema.safeParse('human:user name').success).toBe(false);
      expect(ActorSchema.safeParse('').success).toBe(false);
    });
  });

  describe('DateOnlySchema', () => {
    it('accepts YYYY-MM-DD formatted calendar dates', () => {
      expect(DateOnlySchema.safeParse('2026-09-26').success).toBe(true);
      expect(DateOnlySchema.safeParse('2024-02-29').success).toBe(true);
      expect(DateOnlySchema.safeParse('2030-12-31').success).toBe(true);
    });

    it('rejects non-date or malformed date strings', () => {
      expect(DateOnlySchema.safeParse('2026/09/26').success).toBe(false);
      expect(DateOnlySchema.safeParse('26-09-2026').success).toBe(false);
      expect(DateOnlySchema.safeParse('2026-9-26').success).toBe(false);
      expect(DateOnlySchema.safeParse('invalid-date').success).toBe(false);
      expect(DateOnlySchema.safeParse('').success).toBe(false);
    });
  });

  describe('IsoDateTimeSchema', () => {
    it('accepts standard ISO-8601 UTC and offset timestamps', () => {
      expect(IsoDateTimeSchema.safeParse('2026-09-26T07:00:00Z').success).toBe(
        true
      );
      expect(
        IsoDateTimeSchema.safeParse('2026-09-26T17:00:00+10:00').success
      ).toBe(true);
      expect(
        IsoDateTimeSchema.safeParse('2026-09-26T00:00:00.123Z').success
      ).toBe(true);
      expect(
        IsoDateTimeSchema.safeParse('2026-09-26T12:00:00-05:00').success
      ).toBe(true);
    });

    it('rejects invalid timestamps', () => {
      expect(IsoDateTimeSchema.safeParse('2026-09-26').success).toBe(false);
      expect(IsoDateTimeSchema.safeParse('2026-09-26 12:00:00').success).toBe(
        false
      );
      expect(IsoDateTimeSchema.safeParse('invalid-timestamp').success).toBe(
        false
      );
      expect(IsoDateTimeSchema.safeParse('').success).toBe(false);
    });
  });

  describe('FrontmatterSchema', () => {
    it('validates minimal valid frontmatter', () => {
      const result = FrontmatterSchema.safeParse({
        type: 'concept',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('active');
      }
    });

    it('validates comprehensive frontmatter with optional metadata', () => {
      const result = FrontmatterSchema.safeParse({
        type: 'architecture',
        title: 'Core Architecture',
        description: 'Decoupled universal core design',
        resource: 'urn:okf:core:arch',
        tags: ['architecture', 'core', 'v0.2'],
        sources: [
          {
            resource: 'https://github.com/Banksia-Corp/okf',
            title: 'Repository',
            author: 'Banksia',
            usage_count: 5,
            last_modified: '2026-09-26',
            usage_window: {
              start: '2026-01-01',
              end: '2026-12-31',
            },
          },
        ],
        generated: {
          by: 'agent/v1.0.0',
          at: '2026-09-26T08:00:00Z',
        },
        verified: [
          {
            by: 'human:luis',
            at: '2026-09-26T09:00:00Z',
            tier: 'human-reviewed',
          },
        ],
        status: 'active',
        stale_after: '2026-12-31',
        executor: {
          type: 'shell',
          run: 'echo "verified"',
        },
        receipt: {
          format: 'json',
          schema: { status: 'string' },
        },
        attester: {
          type: 'static',
          verify: 'pnpm test',
        },
      });

      expect(result.success).toBe(true);
    });

    it('supports single object for verified field in frontmatter', () => {
      const result = FrontmatterSchema.safeParse({
        type: 'concept',
        verified: {
          by: 'process:ci',
          at: '2026-09-26T10:00:00Z',
          tier: 'machine-confirmed',
        },
      });

      expect(result.success).toBe(true);
    });

    it('allows arbitrary extra properties via passthrough', () => {
      const result = FrontmatterSchema.safeParse({
        type: 'custom',
        extra_key: 'arbitrary_metadata',
        custom_number: 42,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).extra_key).toBe(
          'arbitrary_metadata'
        );
        expect((result.data as Record<string, unknown>).custom_number).toBe(42);
      }
    });

    it('rejects invalid status enum values', () => {
      const result = FrontmatterSchema.safeParse({
        type: 'concept',
        status: 'invalid-status',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid stale_after date formats', () => {
      const result = FrontmatterSchema.safeParse({
        type: 'concept',
        stale_after: '31-12-2026',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('normalizeVerified', () => {
    it('returns empty array when undefined', () => {
      expect(normalizeVerified(undefined)).toEqual([]);
    });

    it('returns array unchanged when already an array', () => {
      const entry = {
        by: 'human:luis',
        at: '2026-09-26T00:00:00Z',
        tier: 'human-reviewed' as const,
      };
      expect(normalizeVerified([entry])).toEqual([entry]);
    });

    it('wraps a single verified object in an array', () => {
      const entry = {
        by: 'process:ci',
        at: '2026-09-26T00:00:00Z',
        tier: 'machine-confirmed' as const,
      };
      expect(normalizeVerified(entry)).toEqual([entry]);
    });
  });

  describe('deriveTrustTier', () => {
    it('returns unverified when verified is missing or empty', () => {
      expect(deriveTrustTier(undefined)).toBe('unverified');
      expect(deriveTrustTier([])).toBe('unverified');
    });

    it('derives human-reviewed if tier is explicit human-reviewed', () => {
      expect(
        deriveTrustTier({
          by: 'reviewer',
          at: '2026-09-26T00:00:00Z',
          tier: 'human-reviewed',
        })
      ).toBe('human-reviewed');
    });

    it('derives human-reviewed if actor starts with human:', () => {
      expect(
        deriveTrustTier({
          by: 'human:luis',
          at: '2026-09-26T00:00:00Z',
        })
      ).toBe('human-reviewed');
    });

    it('derives machine-confirmed when verified by a non-human and tier is not human-reviewed', () => {
      expect(
        deriveTrustTier({
          by: 'process:ci-build',
          at: '2026-09-26T00:00:00Z',
          tier: 'machine-confirmed',
        })
      ).toBe('machine-confirmed');

      expect(
        deriveTrustTier({
          by: 'agent/v1.0.0',
          at: '2026-09-26T00:00:00Z',
        })
      ).toBe('machine-confirmed');
    });

    it('prioritizes human-reviewed in multi-entry verification list', () => {
      const entries = [
        {
          by: 'process:ci',
          at: '2026-09-26T00:00:00Z',
          tier: 'machine-confirmed' as const,
        },
        {
          by: 'human:alice',
          at: '2026-09-26T01:00:00Z',
        },
      ];
      expect(deriveTrustTier(entries)).toBe('human-reviewed');
    });
  });

  describe('isFresh', () => {
    const fixedNow = new Date('2026-09-26T12:00:00.000Z');

    it('returns true when stale_after is undefined', () => {
      expect(isFresh(undefined, fixedNow)).toBe(true);
    });

    it('returns true when stale_after date is today or in the future', () => {
      expect(isFresh('2026-09-26', fixedNow)).toBe(true);
      expect(isFresh('2026-09-27', fixedNow)).toBe(true);
      expect(isFresh('2026-10-01', fixedNow)).toBe(true);
    });

    it('returns false when stale_after date is in the past', () => {
      expect(isFresh('2026-09-25', fixedNow)).toBe(false);
      expect(isFresh('2025-12-31', fixedNow)).toBe(false);
    });

    it('handles ISO timestamps with time component correctly', () => {
      expect(isFresh('2026-09-26T15:00:00.000Z', fixedNow)).toBe(true);
      expect(isFresh('2026-09-26T10:00:00.000Z', fixedNow)).toBe(false);
    });

    it('returns false for invalid date strings', () => {
      expect(isFresh('invalid-date', fixedNow)).toBe(false);
    });
  });
});
