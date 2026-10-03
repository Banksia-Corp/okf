/**
 * @fileoverview Universal knowledge graph construction, traversal, and dependency resolution.
 *
 * Implements directed graph modeling of OKF concepts, extracting cross-document markdown links,
 * determining upstream/downstream dependencies, and executing multi-hop neighborhood queries.
 *
 * @packageDocumentation
 */

import { Concept, deriveTrustTier, isFresh } from './schema.js';
import { ConceptFilter } from './repository.js';

/**
 * Directed edge connecting two concepts within a {@link KnowledgeGraph}.
 */
export interface GraphEdge {
  /** Unique edge identifier formatted as `<sourceId>-><targetId>`. */
  id: string;
  /** Concept ID of the originating document containing the markdown link. */
  source: string;
  /** Concept ID of the targeted referenced document. */
  target: string;
  /** Optional link text or anchor label from the markdown link syntax `[label](target.md)`. */
  label?: string;
}

/**
 * OKF v0.2 Knowledge Graph containing indexed concept nodes and directed connection edges.
 */
export interface KnowledgeGraph {
  /** Specification version indicator. */
  version: '0.2';
  /** Array of concept nodes in the graph. */
  nodes: Concept[];
  /** Array of directed edges representing references between concepts. */
  edges: GraphEdge[];
}

export type { ConceptFilter };

/**
 * Resolves a relative markdown link target against a source document's filepath using POSIX semantics.
 *
 * Automatically strips trailing `.md` extensions for canonical concept IDs.
 *
 * @param fromFile - Source document path (e.g. `'concepts/network/tcp.md'`).
 * @param targetLink - Relative target link from markdown (e.g. `'../protocols/ip.md'`).
 * @returns Resolved canonical concept ID (e.g. `'concepts/protocols/ip'`).
 *
 * @example
 * ```ts
 * resolveRelativePosix('guides/intro.md', './advanced.md');
 * // 'guides/advanced'
 * ```
 */
export function resolveRelativePosix(
  fromFile: string,
  targetLink: string
): string {
  const cleanFrom = fromFile.replace(/\\/g, '/').replace(/^\.\//, '');
  const fromDirParts = cleanFrom.split('/');
  fromDirParts.pop(); // remove file name

  const cleanTarget = targetLink.replace(/\\/g, '/');
  const targetPathOnly = cleanTarget.split(/[?#]/)[0];
  const targetParts = targetPathOnly.split('/');

  if (targetPathOnly.startsWith('/')) {
    fromDirParts.length = 0;
  }

  for (const part of targetParts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (
        fromDirParts.length > 0 &&
        fromDirParts[fromDirParts.length - 1] !== '..'
      ) {
        fromDirParts.pop();
      } else {
        fromDirParts.push('..');
      }
    } else {
      fromDirParts.push(part);
    }
  }

  const resolved = fromDirParts.join('/');
  return resolved.endsWith('.md') ? resolved.slice(0, -3) : resolved;
}

/**
 * Extracts all relative markdown links (`[label](path.md)`) from a document body string.
 *
 * Ignores images (`![]()`), external URLs (`http://`, `https://`), and email links (`mailto:`).
 *
 * @param body - The markdown body text.
 * @returns Array of extracted `{ link, label }` records.
 *
 * @example
 * ```ts
 * extractMarkdownLinks('See [Architecture](./arch.md) and [RFC](https://ietf.org)');
 * // [{ link: './arch.md', label: 'Architecture' }]
 * ```
 */
export function extractMarkdownLinks(
  body: string
): { link: string; label: string }[] {
  const linkRegex = /(?<!!)(?:\[([^\]]+)\]\(([^)]+)\))/g;
  const matches: { link: string; label: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(body)) !== null) {
    const rawLabel = m[1];
    const rawTarget = m[2].trim();
    const unbracketed =
      rawTarget.startsWith('<') && rawTarget.includes('>')
        ? rawTarget.slice(1, rawTarget.indexOf('>')).trim()
        : rawTarget;
    const targetUrl = unbracketed.split(/\s+/)[0];

    if (
      /^(?:[a-z]+:)?\/\//i.test(targetUrl) ||
      targetUrl.startsWith('mailto:')
    ) {
      continue;
    }

    const pathOnly = targetUrl.split(/[?#]/)[0];
    if (!pathOnly.endsWith('.md')) {
      continue;
    }

    matches.push({ label: rawLabel.trim(), link: targetUrl });
  }

  return matches;
}

/**
 * Constructs a {@link KnowledgeGraph} from an array of concept documents by parsing inter-document markdown links.
 *
 * @param concepts - Array of concept documents to index into the graph.
 * @returns A fully constructed {@link KnowledgeGraph}.
 *
 * @example
 * ```ts
 * const graph = buildGraph([conceptA, conceptB]);
 * console.log(`Graph contains ${graph.edges.length} edges`);
 * ```
 */
export function buildGraph(concepts: Concept[]): KnowledgeGraph {
  const nodeMap = new Map<string, Concept>();
  for (const c of concepts) {
    nodeMap.set(c.id, c);
    nodeMap.set(c.filepath, c);
    if (c.filepath.endsWith('.md')) {
      nodeMap.set(c.filepath.slice(0, -3), c);
    }
  }

  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  for (const concept of concepts) {
    const links = extractMarkdownLinks(concept.body);
    for (const link of links) {
      const resolved = resolveRelativePosix(concept.filepath, link.link);
      const targetConcept = nodeMap.get(resolved);
      if (targetConcept && targetConcept.id !== concept.id) {
        const edgeId = `${concept.id}->${targetConcept.id}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            id: edgeId,
            source: concept.id,
            target: targetConcept.id,
            label: link.label,
          });
        }
      }
    }
  }

  return {
    version: '0.2',
    nodes: concepts,
    edges,
  };
}

/**
 * Retrieves all concepts that the given concept directly links to (outward dependencies).
 *
 * @param graph - The knowledge graph.
 * @param conceptId - Originating concept ID.
 * @returns Array of target {@link Concept} objects.
 */
export function getDependencies(
  graph: KnowledgeGraph,
  conceptId: string
): Concept[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const depIds = Array.from(
    new Set(
      graph.edges.filter((e) => e.source === conceptId).map((e) => e.target)
    )
  );
  return depIds.map((id) => nodeMap.get(id)!).filter(Boolean);
}

/**
 * Retrieves all concepts that link directly to the given concept (inward dependents / consumers).
 *
 * @param graph - The knowledge graph.
 * @param conceptId - Target concept ID.
 * @returns Array of source {@link Concept} objects.
 */
export function getDependents(
  graph: KnowledgeGraph,
  conceptId: string
): Concept[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const dependentIds = Array.from(
    new Set(
      graph.edges.filter((e) => e.target === conceptId).map((e) => e.source)
    )
  );
  return dependentIds.map((id) => nodeMap.get(id)!).filter(Boolean);
}

/**
 * Retrieves neighboring concepts reachable from `conceptId` within a specified hop depth and direction.
 *
 * @param graph - The knowledge graph to traverse.
 * @param conceptId - Starting root concept ID.
 * @param options - Traversal options controlling search depth and direction (`both`, `outgoing`, `incoming`).
 * @returns Array of reached neighbor {@link Concept} objects.
 *
 * @example
 * ```ts
 * const neighbors = getNeighbors(graph, 'core/architecture', { depth: 2, direction: 'outgoing' });
 * ```
 */
export function getNeighbors(
  graph: KnowledgeGraph,
  conceptId: string,
  options: { depth?: number; direction?: 'both' | 'outgoing' | 'incoming' } = {}
): Concept[] {
  const depth = options.depth ?? 1;
  const direction = options.direction ?? 'both';
  const visited = new Set<string>([conceptId]);
  let currentLevel = new Set<string>([conceptId]);

  for (let d = 0; d < depth; d++) {
    const nextLevel = new Set<string>();
    for (const id of currentLevel) {
      for (const edge of graph.edges) {
        if (
          (direction === 'both' || direction === 'outgoing') &&
          edge.source === id
        ) {
          if (!visited.has(edge.target)) {
            visited.add(edge.target);
            nextLevel.add(edge.target);
          }
        }
        if (
          (direction === 'both' || direction === 'incoming') &&
          edge.target === id
        ) {
          if (!visited.has(edge.source)) {
            visited.add(edge.source);
            nextLevel.add(edge.source);
          }
        }
      }
    }
    currentLevel = nextLevel;
  }

  visited.delete(conceptId);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  return Array.from(visited)
    .map((id) => nodeMap.get(id)!)
    .filter(Boolean);
}

/**
 * Filters an array of concepts based on matching criteria in {@link ConceptFilter}.
 *
 * Evaluates concept type, status, tags, trust tier derivation, and freshness expiration.
 *
 * @param concepts - Array of concepts to filter.
 * @param filter - Criteria filter object.
 * @returns Subset of concepts matching all specified criteria.
 *
 * @example
 * ```ts
 * const activeArchitectures = filterConcepts(concepts, {
 *   type: 'architecture',
 *   status: 'active',
 *   stale: true,
 * });
 * ```
 */
export function filterConcepts(
  concepts: Concept[],
  filter: ConceptFilter
): Concept[] {
  return concepts.filter((c) => {
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      if (!types.includes(c.frontmatter.type)) return false;
    }
    if (filter.status) {
      const status = c.frontmatter.status ?? 'active';
      if (status !== filter.status) return false;
    }
    if (filter.tags && filter.tags.length > 0) {
      const conceptTags = c.frontmatter.tags || [];
      if (!filter.tags.some((t) => conceptTags.includes(t))) return false;
    }
    if (filter.trustTier) {
      const tier = deriveTrustTier(c.frontmatter.verified);
      if (tier !== filter.trustTier) return false;
    }
    if (filter.stale !== undefined) {
      const fresh = isFresh(c.frontmatter.stale_after);
      if (filter.stale === true && fresh) return false;
      if (filter.stale === false && !fresh) return false;
    }
    return true;
  });
}
