import { Concept } from './schema.js';
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

  async listAllConcepts(subpath?: string): Promise<Concept[]> {
    const collect = async (dir?: string): Promise<string[]> => {
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
