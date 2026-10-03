/**
 * @fileoverview High-level client API orchestrating OKF concept lifecycle, querying, and graph traversal.
 *
 * The {@link Client} class integrates repositories, parsers, error handlers, and graph engines
 * into an ergonomic interface for reading, authoring, querying, and linking knowledge concepts.
 *
 * @packageDocumentation
 */

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

/**
 * Options supplied when creating a new OKF concept document via {@link Client.createConcept}.
 */
export interface CreateConceptOptions {
  /** Relative file path for the new concept markdown document (e.g. `'concepts/auth.md'`). */
  filepath: string;
  /** Human-readable title of the concept document. */
  title: string;
  /** OKF concept type (e.g. `'concept'`, `'architecture'`). Defaults to `'concept'`. */
  type?: string;
  /** Optional summary description of the concept. */
  description?: string;
  /** Optional list of categorization tags. */
  tags?: string[];
  /** Lifecycle status of the concept. Defaults to `'active'`. */
  status?: 'active' | 'draft' | 'deprecated' | 'archived';
  /** Optional stale expiration calendar date (YYYY-MM-DD) or ISO timestamp. */
  stale_after?: string;
  /** Optional canonical resource URI or URN identifier. */
  resource?: string;
  /** Optional body content markdown. If omitted, a default `# <title>` heading is generated. */
  body?: string;
  /** When true, allows overwriting an existing document at `filepath`. */
  force?: boolean;
}

/**
 * Configuration options for initializing an OKF {@link Client} instance.
 */
export interface Config {
  /** The storage repository backend implementation. */
  repository: Repository;
  /** Optional frontmatter parser implementation. Defaults to {@link GrayMatterParser}. */
  parser?: Parser;
  /** Optional error callback invoked when non-fatal errors occur during batch indexing or traversal. */
  onError?: (path: string, error: unknown) => void;
}

/**
 * Primary high-level interface for interacting with an OKF knowledge repository.
 */
export class Client {
  /** Configured storage repository backend. */
  readonly repository: Repository;
  /** Configured frontmatter parser. */
  readonly parser: Parser;
  /** Optional error callback handler. */
  readonly onError?: (path: string, error: unknown) => void;
  private readonly _graphCache = new Map<string, KnowledgeGraph>();

  /**
   * Initializes a new OKF Client.
   *
   * @param config - Configuration settings and backend services.
   *
   * @example
   * ```ts
   * import { Client, InMemoryRepository } from '@banksia/okf';
   *
   * const client = new Client({
   *   repository: new InMemoryRepository(),
   * });
   * ```
   */
  constructor(config: Config) {
    this.repository = config.repository;
    this.parser = config.parser ?? new GrayMatterParser();
    this.onError = config.onError;
  }

  /**
   * Clears the internal in-memory cache of constructed knowledge graphs.
   */
  clearCache(): void {
    this._graphCache.clear();
  }

  /**
   * Reads, parses, and validates a concept document from the repository.
   *
   * @param path - Relative file path to the concept document.
   * @returns A promise resolving to the validated {@link Concept}.
   * @throws Error if the document cannot be found or fails schema validation.
   *
   * @example
   * ```ts
   * const concept = await client.getConcept('concepts/overview.md');
   * console.log(concept.frontmatter.title);
   * ```
   */
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

  /**
   * Serializes and writes an existing {@link Concept} object back to the repository.
   * Automatically invalidates cached graphs.
   *
   * @param concept - The concept object to persist.
   */
  async saveConcept(concept: Concept): Promise<void> {
    const raw = this.parser.stringify(concept);
    await this.repository.writeConcept(concept.filepath, raw);
    this.clearCache();
  }

  /**
   * Creates, validates, and persists a brand new concept document.
   *
   * @param options - Concept creation parameters.
   * @returns A promise resolving to the newly created and stored {@link Concept}.
   * @throws Error if the file already exists and `force` is not set, or if frontmatter validation fails.
   *
   * @example
   * ```ts
   * const newConcept = await client.createConcept({
   *   filepath: 'concepts/indexing.md',
   *   title: 'Automated Indexing',
   *   type: 'concept',
   *   tags: ['search', 'graph'],
   * });
   * ```
   */
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

  /**
   * Recursively traverses and collects all valid OKF concept documents within an optional subpath.
   *
   * Non-concept files or files with invalid schemas are skipped, triggering {@link onError} if configured.
   *
   * @param subpath - Starting subpath or directory to scope the recursive traversal.
   * @returns Array of valid {@link Concept} objects.
   */
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

  /**
   * Queries concepts matching the provided {@link ConceptFilter}.
   * Delegates to `queryConcepts` on the repository if implemented, otherwise performs client-side filtering.
   *
   * @param filter - Concept criteria filter.
   * @param subpath - Optional directory subpath to scope search.
   * @returns Array of matching {@link Concept} objects.
   *
   * @example
   * ```ts
   * const deprecatedConcepts = await client.findConcepts({ status: 'deprecated' });
   * ```
   */
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

  /**
   * Constructs (or retrieves from cache) the directed {@link KnowledgeGraph} of all concepts in `subpath`.
   *
   * @param subpath - Optional directory path scope.
   * @param options - Options; set `reload: true` to bypass and refresh cache.
   * @returns A promise resolving to the {@link KnowledgeGraph}.
   */
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

  /**
   * Finds all concept documents that the specified concept links to directly.
   *
   * @param conceptId - Source concept ID.
   * @param subpath - Optional scope subpath.
   * @param graph - Optional precomputed knowledge graph.
   * @returns Array of target {@link Concept} dependencies.
   */
  async getDependencies(
    conceptId: string,
    subpath?: string,
    graph?: KnowledgeGraph
  ): Promise<Concept[]> {
    const g = graph ?? (await this.buildGraph(subpath));
    return getDependencies(g, conceptId);
  }

  /**
   * Finds all concept documents that link directly to the specified concept.
   *
   * @param conceptId - Target concept ID.
   * @param subpath - Optional scope subpath.
   * @param graph - Optional precomputed knowledge graph.
   * @returns Array of dependent consumer {@link Concept} objects.
   */
  async getDependents(
    conceptId: string,
    subpath?: string,
    graph?: KnowledgeGraph
  ): Promise<Concept[]> {
    const g = graph ?? (await this.buildGraph(subpath));
    return getDependents(g, conceptId);
  }

  /**
   * Finds neighboring concepts reachable within a given hop depth and direction.
   *
   * @param conceptId - Root concept ID.
   * @param options - Depth, direction, and scoping options.
   * @returns Array of neighbor {@link Concept} objects.
   */
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
