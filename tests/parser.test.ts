import { describe, it, expect } from 'vitest';
import {
  GrayMatterParser,
  parseConceptContent,
  stringifyConcept,
} from '../src/parser.js';
import { Concept, Verified } from '../src/schema.js';

describe('OKF Markdown Parser', () => {
  const parser = new GrayMatterParser();

  it('parses valid frontmatter and body into a Concept', () => {
    const raw = `---
type: architecture
title: Universal Decoupled Architecture
status: active
tags:
  - architecture
  - core
---

# Universal Architecture

Body content here.
`;

    const res = parser.parse(raw, 'concepts/architecture.md');
    expect(res.valid).toBe(true);
    expect(res.errors).toBeUndefined();
    expect(res.concept).toBeDefined();

    const concept = res.concept!;
    expect(concept.id).toBe('concepts/architecture');
    expect(concept.filepath).toBe('concepts/architecture.md');
    expect(concept.frontmatter.type).toBe('architecture');
    expect(concept.frontmatter.title).toBe('Universal Decoupled Architecture');
    expect(concept.frontmatter.status).toBe('active');
    expect(concept.frontmatter.tags).toEqual(['architecture', 'core']);
    expect(concept.body).toBe('# Universal Architecture\n\nBody content here.');
  });

  it('derives concept ID by stripping .md extension', () => {
    const raw = `---
type: concept
---
Content
`;
    const resWithExt = parser.parse(raw, 'deep/nested/item.md');
    expect(resWithExt.concept?.id).toBe('deep/nested/item');

    const resWithoutExt = parser.parse(raw, 'item');
    expect(resWithoutExt.concept?.id).toBe('item');
  });

  it('normalizes single verified object to an array in frontmatter during parse', () => {
    const raw = `---
type: concept
verified:
  by: human:luis
  at: 2026-09-26T00:00:00Z
  tier: human-reviewed
---
Verified content.
`;
    const res = parser.parse(raw, 'verified-item.md');
    expect(res.valid).toBe(true);
    expect(Array.isArray(res.concept?.frontmatter.verified)).toBe(true);
    expect(res.concept?.frontmatter.verified).toHaveLength(1);
    const verifiedList = res.concept?.frontmatter.verified as Verified[];
    expect(verifiedList?.[0].by).toBe('human:luis');
  });

  it('returns valid: false with schema validation error details when schema is invalid', () => {
    const raw = `---
status: active
---
Missing required type property.
`;
    const res = parser.parse(raw, 'invalid.md');
    expect(res.valid).toBe(false);
    expect(res.concept).toBeUndefined();
    expect(res.errors).toBeDefined();
    expect(res.errors?.some((e) => e.includes('type'))).toBe(true);
  });

  it('returns valid: false when frontmatter is malformed YAML', () => {
    const raw = `---
type: [unclosed list
---
Content
`;
    const res = parser.parse(raw, 'broken-yaml.md');
    expect(res.valid).toBe(false);
    expect(res.errors).toBeDefined();
    expect(res.errors?.length).toBeGreaterThan(0);
  });

  it('non-destructively stringifies concept back to markdown with frontmatter', () => {
    const concept: Concept = {
      id: 'docs/test',
      filepath: 'docs/test.md',
      frontmatter: {
        type: 'test-concept',
        title: 'Round Trip Test',
        status: 'active',
        tags: ['vitest', 'unit'],
      },
      body: '## Hello World\n\nThis is a non-destructive test.',
    };

    const serialized = parser.stringify(concept);
    expect(serialized).toContain('type: test-concept');
    expect(serialized).toContain('title: Round Trip Test');
    expect(serialized).toContain('## Hello World');

    const reparsed = parser.parse(serialized, 'docs/test.md');
    expect(reparsed.valid).toBe(true);
    expect(reparsed.concept?.frontmatter.type).toBe('test-concept');
    expect(reparsed.concept?.frontmatter.title).toBe('Round Trip Test');
    expect(reparsed.concept?.body).toBe(concept.body);
  });

  it('exports functional helpers parseConceptContent and stringifyConcept', () => {
    const raw = `---
type: concept
title: Helper Test
---
Helper body.
`;
    const parsed = parseConceptContent(raw, 'helper.md');
    expect(parsed.valid).toBe(true);
    expect(parsed.concept?.frontmatter.title).toBe('Helper Test');

    const stringified = stringifyConcept(parsed.concept!);
    expect(stringified).toContain('type: concept');
    expect(stringified).toContain('Helper body.');
  });
});
