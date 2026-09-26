import {
  Concept,
  Frontmatter,
  FrontmatterSchema,
  normalizeVerified,
} from './schema.js';
import { Parser, GrayMatterParser } from './parser.js';
import { Repository, ConceptFilter } from './repository.js';
import {
  KnowledgeGraph,
  buildGraph,
  getDependencies,
  getDependents,
  getNeighbors,
  filterConcepts,
} from './graph.js';

export interface CreateConceptOptions {
  filepath: string;
  title: string;
  type?: string;
  description?: string;
  tags?: string[];
  status?: 'active' | 'draft' | 'deprecated' | 'archived';
  stale_after?: string;
  resource?: string;
  body?: string;
  force?: boolean;
}

export interface Config {
  repository: Repository;
  parser?: Parser;
  onError?: (path: string, error: unknown) => void;
}

export class Client {
  readonly repository: Repository;
  readonly parser: Parser;
  readonly onError?: (path: string, error: unknown) => void;
  private readonly _graphCache = new Map<string, KnowledgeGraph>();

  constructor(config: Config) {
    this.repository = config.repository;
    this.parser = config.parser ?? new GrayMatterParser();
    this.onError = config.onError;
  }

  clearCache(): void {
    this._graphCache.clear();
  }

  async getConcept(path: string): Promise<Concept> {
    const content = await this.repository.readConcept(path);
    const res = this.parser.parse(content, path);
    if (!res.valid || !res.concept) {
      throw new Error(
        `Invalid OKF concept at ${path}: ${res.errors?.join(', ') || 'Unknown parsing error'}`
      );
    }
    return res.concept;
  }

  async saveConcept(concept: Concept): Promise<void> {
    const raw = this.parser.stringify(concept);
    await this.repository.writeConcept(concept.filepath, raw);
    this.clearCache();
  }

  async createConcept(options: CreateConceptOptions): Promise<Concept> {
    const exists = await this.repository.exists(options.filepath);
    if (exists && !options.force) {
      throw new Error(`Concept file already exists: ${options.filepath}`);
    }

    const rawFrontmatter: Record<string, unknown> = {
      type: options.type ?? 'concept',
      title: options.title,
    };

    if (options.description !== undefined) {
      rawFrontmatter.description = options.description;
    }
    if (options.tags !== undefined) {
      rawFrontmatter.tags = options.tags;
    }
    if (options.status !== undefined) {
      rawFrontmatter.status = options.status;
    }
    if (options.stale_after !== undefined) {
      rawFrontmatter.stale_after = options.stale_after;
    }
    if (options.resource !== undefined) {
      rawFrontmatter.resource = options.resource;
    }

    const validation = FrontmatterSchema.safeParse(rawFrontmatter);
    if (!validation.success) {
      const errMsgs = validation.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`
      );
      throw new Error(
        `Invalid OKF frontmatter for concept '${options.filepath}': ${errMsgs.join(', ')}`
      );
    }

    const frontmatter: Frontmatter = { ...validation.data };
    if (frontmatter.verified !== undefined) {
      frontmatter.verified = normalizeVerified(frontmatter.verified);
    }

    const body =
      options.body !== undefined
        ? options.body
        : `# ${options.title}\n\n${options.description || ''}`.trimEnd() + '\n';

    const conceptId = options.filepath.endsWith('.md')
      ? options.filepath.slice(0, -3)
      : options.filepath;

    const concept: Concept = {
      id: conceptId,
      filepath: options.filepath,
      frontmatter,
      body,
    };

    const raw = this.parser.stringify(concept);
    await this.repository.writeConcept(options.filepath, raw);
    this.clearCache();
    return concept;
  }

  async listAllConcepts(subpath?: string): Promise<Concept[]> {
    const visitedDirs = new Set<string>();
    const collect = async (dir?: string): Promise<string[]> => {
      const normDir = dir || '';
      if (visitedDirs.has(normDir)) return [];
      visitedDirs.add(normDir);

      const direct = await this.repository.listConcepts(dir);
      const subdirs = this.repository.listSubdirectories
        ? await this.repository.listSubdirectories(dir)
        : [];
      const allPaths = [...direct];
      for (const sub of subdirs) {
        const nestedDir = dir ? `${dir}/${sub}` : sub;
        const nestedPaths = await collect(nestedDir);
        for (const np of nestedPaths) {
          allPaths.push(np);
        }
      }
      return allPaths;
    };

    const paths = await collect(subpath);
    const concepts: Concept[] = [];
    for (const p of paths) {
      try {
        const c = await this.getConcept(p);
        concepts.push(c);
      } catch (err) {
        this.onError?.(p, err);
        // Skip non-concept or invalid markdown files
      }
    }
    return concepts;
  }

  async findConcepts(
    filter: ConceptFilter,
    subpath?: string
  ): Promise<Concept[]> {
    if (
      !subpath &&
      'queryConcepts' in this.repository &&
      typeof (this.repository as { queryConcepts?: unknown }).queryConcepts ===
        'function'
    ) {
      return await (
        this.repository as {
          queryConcepts: (f: ConceptFilter) => Promise<Concept[]>;
        }
      ).queryConcepts(filter);
    }
    const all = await this.listAllConcepts(subpath);
    return filterConcepts(all, filter);
  }

  async buildGraph(
    subpath?: string,
    options?: { reload?: boolean }
  ): Promise<KnowledgeGraph> {
    const cacheKey = subpath ?? '';
    if (!options?.reload && this._graphCache.has(cacheKey)) {
      return this._graphCache.get(cacheKey)!;
    }
    const all = await this.listAllConcepts(subpath);
    const graph = buildGraph(all);
    this._graphCache.set(cacheKey, graph);
    return graph;
  }

  async getDependencies(
    conceptId: string,
    subpath?: string,
    graph?: KnowledgeGraph
  ): Promise<Concept[]> {
    const g = graph ?? (await this.buildGraph(subpath));
    return getDependencies(g, conceptId);
  }

  async getDependents(
    conceptId: string,
    subpath?: string,
    graph?: KnowledgeGraph
  ): Promise<Concept[]> {
    const g = graph ?? (await this.buildGraph(subpath));
    return getDependents(g, conceptId);
  }

  async getNeighbors(
    conceptId: string,
    options?: {
      depth?: number;
      direction?: 'both' | 'outgoing' | 'incoming';
      subpath?: string;
      graph?: KnowledgeGraph;
    }
  ): Promise<Concept[]> {
    const g = options?.graph ?? (await this.buildGraph(options?.subpath));
    return getNeighbors(g, conceptId, options);
  }
}
