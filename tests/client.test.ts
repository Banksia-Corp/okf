import { describe, it, expect, vi } from 'vitest';
import { Client } from '../src/client.js';
import { InMemoryRepository } from '../src/repository.js';

describe('Universal OKF Client', () => {
  it('reads and parses valid concepts through repository abstraction', async () => {
    const repo = new InMemoryRepository({
      'concepts/overview.md': `---
type: concept
title: Overview Document
status: active
---
# Overview
This is an overview.
`,
    });

    const client = new Client({ repository: repo });
    const concept = await client.getConcept('concepts/overview.md');

    expect(concept.id).toBe('concepts/overview');
    expect(concept.frontmatter.title).toBe('Overview Document');
    expect(concept.body).toBe('# Overview\nThis is an overview.');
  });

  it('throws descriptive error on invalid concept frontmatter', async () => {
    const repo = new InMemoryRepository({
      'broken.md': `---
status: active
---
Missing type field.
`,
    });

    const client = new Client({ repository: repo });
    await expect(client.getConcept('broken.md')).rejects.toThrow(
      /Invalid OKF concept at broken\.md/
    );
  });

  it('creates and saves new concepts to repository', async () => {
    const repo = new InMemoryRepository();
    const client = new Client({ repository: repo });

    const created = await client.createConcept({
      filepath: 'new-doc.md',
      title: 'New Documentation',
      type: 'guide',
      tags: ['guide', 'getting-started'],
      body: 'Body content.',
    });

    expect(created.id).toBe('new-doc');
    expect(created.frontmatter.title).toBe('New Documentation');
    expect(await repo.exists('new-doc.md')).toBe(true);

    const savedRaw = await repo.readConcept('new-doc.md');
    expect(savedRaw).toContain('type: guide');
    expect(savedRaw).toContain('title: New Documentation');
  });

  it('prevents overwriting existing concept on create unless force option is true', async () => {
    const repo = new InMemoryRepository({
      'existing.md': `---
type: concept
title: Existing
---
Original.
`,
    });

    const client = new Client({ repository: repo });

    await expect(
      client.createConcept({
        filepath: 'existing.md',
        title: 'Collision',
      })
    ).rejects.toThrow(/already exists/);

    const overwritten = await client.createConcept({
      filepath: 'existing.md',
      title: 'Forced Overwrite',
      force: true,
    });
    expect(overwritten.frontmatter.title).toBe('Forced Overwrite');
  });

  it('lists all valid concepts recursively and calls onError for broken files', async () => {
    const repo = new InMemoryRepository({
      'valid-root.md': `---
type: concept
title: Root Concept
---
Valid
`,
      'docs/valid-nested.md': `---
type: guide
title: Nested Concept
---
Valid
`,
      'docs/invalid.md': `---
status: active
---
Missing type
`,
    });

    const onErrorSpy = vi.fn();
    const client = new Client({ repository: repo, onError: onErrorSpy });

    const concepts = await client.listAllConcepts();
    expect(concepts).toHaveLength(2);
    expect(concepts.map((c) => c.id).sort()).toEqual([
      'docs/valid-nested',
      'valid-root',
    ]);

    expect(onErrorSpy).toHaveBeenCalledTimes(1);
    expect(onErrorSpy).toHaveBeenCalledWith(
      'docs/invalid.md',
      expect.any(Error)
    );
  });

  it('memoizes knowledge graph and clears cache on saveConcept / createConcept', async () => {
    const repo = new InMemoryRepository({
      'a.md': `---
type: concept
title: A
---
Link [B](./b.md)
`,
      'b.md': `---
type: concept
title: B
---
Leaf
`,
    });

    const client = new Client({ repository: repo });
    const graph1 = await client.buildGraph();
    const graph2 = await client.buildGraph();
    expect(graph1).toBe(graph2); // Same memoized reference

    // Creating a new concept clears graph cache
    await client.createConcept({
      filepath: 'c.md',
      title: 'C',
    });

    const graph3 = await client.buildGraph();
    expect(graph3).not.toBe(graph1); // Cache was cleared
    expect(graph3.nodes).toHaveLength(3);
  });

  it('delegates traversal queries to memoized graph', async () => {
    const repo = new InMemoryRepository({
      'a.md': `---
type: concept
title: A
---
Link [B](./b.md)
`,
      'b.md': `---
type: concept
title: B
---
Leaf
`,
    });

    const client = new Client({ repository: repo });
    const deps = await client.getDependencies('a');
    expect(deps).toHaveLength(1);
    expect(deps[0].id).toBe('b');

    const dependents = await client.getDependents('b');
    expect(dependents).toHaveLength(1);
    expect(dependents[0].id).toBe('a');

    const neighbors = await client.getNeighbors('a');
    expect(neighbors).toHaveLength(1);
    expect(neighbors[0].id).toBe('b');
  });

  it('finds concepts using ConceptFilter criteria', async () => {
    const repo = new InMemoryRepository({
      'a.md': `---
type: architecture
title: Arch A
status: active
---
Content
`,
      'b.md': `---
type: guide
title: Guide B
status: draft
---
Content
`,
    });

    const client = new Client({ repository: repo });
    const activeArch = await client.findConcepts({
      type: 'architecture',
      status: 'active',
    });
    expect(activeArch).toHaveLength(1);
    expect(activeArch[0].id).toBe('a');
  });
});
