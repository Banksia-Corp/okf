import { Concept, deriveTrustTier, isFresh } from './schema.js';
import { ConceptFilter } from './repository.js';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface KnowledgeGraph {
  version: '0.2';
  nodes: Concept[];
  edges: GraphEdge[];
}

export type { ConceptFilter };

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
      fromDirParts.pop();
    } else {
      fromDirParts.push(part);
    }
  }

  const resolved = fromDirParts.join('/');
  return resolved.endsWith('.md') ? resolved.slice(0, -3) : resolved;
}

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
