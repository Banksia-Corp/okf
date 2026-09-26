import { describe, it, expect } from 'vitest';
import {
  resolveRelativePosix,
  extractMarkdownLinks,
  buildGraph,
  getDependencies,
  getDependents,
  getNeighbors,
  filterConcepts,
} from '../src/graph.js';
import { Concept } from '../src/schema.js';

describe('OKF Knowledge Graph & Traversal Engine', () => {
  describe('resolveRelativePosix', () => {
    it('resolves relative link in same directory', () => {
      expect(resolveRelativePosix('concepts/auth.md', './session.md')).toBe(
        'concepts/session'
      );
      expect(resolveRelativePosix('concepts/auth.md', 'session.md')).toBe(
        'concepts/session'
      );
    });

    it('resolves relative link to parent directory', () => {
      expect(
        resolveRelativePosix('concepts/auth/token.md', '../crypto.md')
      ).toBe('concepts/crypto');
    });

    it('strips url search params and hashes before resolving', () => {
      expect(
        resolveRelativePosix('concepts/auth.md', './session.md#token-flow')
      ).toBe('concepts/session');
    });
  });

  describe('extractMarkdownLinks', () => {
    it('extracts valid relative markdown links with labels', () => {
      const markdown = `
# System Architecture
Refer to [Session Management](./session.md) and [Security Policy](../policy/security.md#rules).
Also check [Token Guide](<./tokens.md>).
`;
      const links = extractMarkdownLinks(markdown);
      expect(links).toEqual([
        { label: 'Session Management', link: './session.md' },
        { label: 'Security Policy', link: '../policy/security.md#rules' },
        { label: 'Token Guide', link: './tokens.md' },
      ]);
    });

    it('ignores external URLs, images, mailto, and non-markdown links', () => {
      const markdown = `
![Architecture Diagram](./assets/diagram.png)
Read more at [Documentation](https://okf.banksia.io).
Contact us at [Support](mailto:support@banksia.io).
Reference [RFC](./rfc.txt).
`;
      const links = extractMarkdownLinks(markdown);
      expect(links).toEqual([]);
    });
  });

  describe('buildGraph & Edge Traversal', () => {
    const concepts: Concept[] = [
      {
        id: 'concepts/a',
        filepath: 'concepts/a.md',
        frontmatter: { type: 'core', title: 'Concept A', status: 'active' },
        body: 'Depends on [Concept B](./b.md) and [Concept C](./c.md).',
      },
      {
        id: 'concepts/b',
        filepath: 'concepts/b.md',
        frontmatter: { type: 'service', title: 'Concept B', status: 'active' },
        body: 'Depends on [Concept C](./c.md).',
      },
      {
        id: 'concepts/c',
        filepath: 'concepts/c.md',
        frontmatter: {
          type: 'database',
          title: 'Concept C',
          status: 'active',
          tags: ['storage'],
        },
        body: 'Leaf node without dependencies.',
      },
      {
        id: 'concepts/d',
        filepath: 'concepts/d.md',
        frontmatter: {
          type: 'core',
          title: 'Concept D',
          status: 'draft',
          tags: ['experimental'],
        },
        body: 'Isolated concept pointing to [Concept A](./a.md).',
      },
    ];

    it('builds directed knowledge graph with correct nodes and edges', () => {
      const graph = buildGraph(concepts);
      expect(graph.version).toBe('0.2');
      expect(graph.nodes).toHaveLength(4);

      // Edges: A->B, A->C, B->C, D->A
      expect(graph.edges).toHaveLength(4);
      expect(
        graph.edges.find(
          (e) => e.source === 'concepts/a' && e.target === 'concepts/b'
        )
      ).toBeDefined();
      expect(
        graph.edges.find(
          (e) => e.source === 'concepts/a' && e.target === 'concepts/c'
        )
      ).toBeDefined();
      expect(
        graph.edges.find(
          (e) => e.source === 'concepts/b' && e.target === 'concepts/c'
        )
      ).toBeDefined();
      expect(
        graph.edges.find(
          (e) => e.source === 'concepts/d' && e.target === 'concepts/a'
        )
      ).toBeDefined();
    });

    it('retrieves direct dependencies (outgoing edges)', () => {
      const graph = buildGraph(concepts);
      const depsA = getDependencies(graph, 'concepts/a');
      expect(depsA.map((c) => c.id).sort()).toEqual([
        'concepts/b',
        'concepts/c',
      ]);

      const depsC = getDependencies(graph, 'concepts/c');
      expect(depsC).toEqual([]);
    });

    it('retrieves direct dependents (incoming edges)', () => {
      const graph = buildGraph(concepts);
      const dependentsC = getDependents(graph, 'concepts/c');
      expect(dependentsC.map((c) => c.id).sort()).toEqual([
        'concepts/a',
        'concepts/b',
      ]);

      const dependentsD = getDependents(graph, 'concepts/d');
      expect(dependentsD).toEqual([]);
    });

    it('performs BFS neighborhood queries by depth and direction', () => {
      const graph = buildGraph(concepts);

      // 1 hop outgoing from D -> [A]
      const neighborsDOut1 = getNeighbors(graph, 'concepts/d', {
        depth: 1,
        direction: 'outgoing',
      });
      expect(neighborsDOut1.map((c) => c.id)).toEqual(['concepts/a']);

      // 2 hops outgoing from D -> [A, B, C]
      const neighborsDOut2 = getNeighbors(graph, 'concepts/d', {
        depth: 2,
        direction: 'outgoing',
      });
      expect(neighborsDOut2.map((c) => c.id).sort()).toEqual([
        'concepts/a',
        'concepts/b',
        'concepts/c',
      ]);

      // 1 hop incoming to C -> [A, B]
      const neighborsCIn1 = getNeighbors(graph, 'concepts/c', {
        depth: 1,
        direction: 'incoming',
      });
      expect(neighborsCIn1.map((c) => c.id).sort()).toEqual([
        'concepts/a',
        'concepts/b',
      ]);

      // Both directions from B: outgoing -> C, incoming -> A
      const neighborsBBoth = getNeighbors(graph, 'concepts/b', {
        depth: 1,
        direction: 'both',
      });
      expect(neighborsBBoth.map((c) => c.id).sort()).toEqual([
        'concepts/a',
        'concepts/c',
      ]);
    });
  });

  describe('filterConcepts', () => {
    const list: Concept[] = [
      {
        id: '1',
        filepath: '1.md',
        frontmatter: {
          type: 'guide',
          status: 'active',
          tags: ['frontend', 'react'],
          verified: {
            by: 'human:luis',
            at: '2026-09-26T00:00:00Z',
          },
          stale_after: '2030-01-01',
        },
        body: '',
      },
      {
        id: '2',
        filepath: '2.md',
        frontmatter: {
          type: 'architecture',
          status: 'draft',
          tags: ['backend'],
          stale_after: '2020-01-01', // stale
        },
        body: '',
      },
    ];

    it('filters by single and multi type', () => {
      expect(filterConcepts(list, { type: 'guide' })).toHaveLength(1);
      expect(
        filterConcepts(list, { type: ['guide', 'architecture'] })
      ).toHaveLength(2);
      expect(filterConcepts(list, { type: 'unknown' })).toHaveLength(0);
    });

    it('filters by status', () => {
      expect(filterConcepts(list, { status: 'active' })).toHaveLength(1);
      expect(filterConcepts(list, { status: 'draft' })).toHaveLength(1);
      expect(filterConcepts(list, { status: 'deprecated' })).toHaveLength(0);
    });

    it('filters by tags', () => {
      expect(filterConcepts(list, { tags: ['react'] })).toHaveLength(1);
      expect(filterConcepts(list, { tags: ['backend'] })).toHaveLength(1);
      expect(filterConcepts(list, { tags: ['non-existent'] })).toHaveLength(0);
    });

    it('filters by trust tier', () => {
      expect(
        filterConcepts(list, { trustTier: 'human-reviewed' })
      ).toHaveLength(1);
      expect(filterConcepts(list, { trustTier: 'unverified' })).toHaveLength(1);
      expect(
        filterConcepts(list, { trustTier: 'machine-confirmed' })
      ).toHaveLength(0);
    });

    it('filters by freshness (stale flag)', () => {
      expect(filterConcepts(list, { stale: true })).toHaveLength(1);
      expect(filterConcepts(list, { stale: true })[0].id).toBe('2');

      expect(filterConcepts(list, { stale: false })).toHaveLength(1);
      expect(filterConcepts(list, { stale: false })[0].id).toBe('1');
    });
  });
});
