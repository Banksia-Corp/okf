import { Concept } from './schema.js';
import { parseConceptContent } from './parser.js';
import { filterConcepts } from './graph.js';

export interface ConceptFilter {
  type?: string | string[];
  tags?: string[];
  status?: 'active' | 'draft' | 'deprecated' | 'archived';
  trustTier?: 'unverified' | 'machine-confirmed' | 'human-reviewed';
  stale?: boolean;
}

export interface Repository {
  readConcept(path: string): Promise<string>;
  writeConcept(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listConcepts(subpath?: string): Promise<string[]>;
  listSubdirectories(subpath?: string): Promise<string[]>;
  deleteConcept?(path: string): Promise<void>;
}

export interface QueryableRepository extends Repository {
  queryConcepts(filter: ConceptFilter): Promise<Concept[]>;
}

export class InMemoryRepository implements QueryableRepository {
  private files: Map<string, string> = new Map();

  constructor(initialFiles?: Record<string, string>) {
    if (initialFiles) {
      for (const [k, v] of Object.entries(initialFiles)) {
        this.files.set(this.normalizePath(k), v);
      }
    }
  }

  private normalizePath(p: string): string {
    const clean = p
      .replace(/\\/g, '/')
      .replace(/^\.\/?/, '')
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    const parts = clean.split('/');
    const safe: string[] = [];
    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        if (safe.length > 0 && safe[safe.length - 1] !== '..') {
          safe.pop();
        }
      } else {
        safe.push(part);
      }
    }
    return safe.join('/');
  }

  async readConcept(path: string): Promise<string> {
    const normalized = this.normalizePath(path);
    const content = this.files.get(normalized);
    if (content === undefined) {
      throw new Error(`Concept not found: ${path}`);
    }
    return content;
  }

  async writeConcept(path: string, content: string): Promise<void> {
    this.files.set(this.normalizePath(path), content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(this.normalizePath(path));
  }

  async listConcepts(subpath: string = ''): Promise<string[]> {
    const normSubpath = subpath ? this.normalizePath(subpath) : '';
    const prefix = normSubpath ? `${normSubpath}/` : '';
    const results: string[] = [];

    for (const key of this.files.keys()) {
      if (prefix && !key.startsWith(prefix)) continue;
      const relative = prefix ? key.slice(prefix.length) : key;
      if (
        !relative.includes('/') &&
        relative.endsWith('.md') &&
        relative !== 'index.md' &&
        relative !== 'log.md'
      ) {
        results.push(key);
      }
    }

    return results.sort();
  }

  async listSubdirectories(subpath: string = ''): Promise<string[]> {
    const normSubpath = subpath ? this.normalizePath(subpath) : '';
    const prefix = normSubpath ? `${normSubpath}/` : '';
    const subdirs = new Set<string>();

    for (const key of this.files.keys()) {
      if (prefix && !key.startsWith(prefix)) continue;
      const relative = prefix ? key.slice(prefix.length) : key;
      const parts = relative.split('/');
      if (parts.length > 1 && parts[0] && !parts[0].startsWith('.')) {
        subdirs.add(parts[0]);
      }
    }

    return Array.from(subdirs).sort();
  }

  async deleteConcept(path: string): Promise<void> {
    this.files.delete(this.normalizePath(path));
  }

  async queryConcepts(filter: ConceptFilter): Promise<Concept[]> {
    const concepts: Concept[] = [];
    for (const [key, content] of this.files.entries()) {
      if (!key.endsWith('.md') || key === 'index.md' || key === 'log.md') {
        continue;
      }
      const res = parseConceptContent(content, key);
      if (res.valid && res.concept) {
        concepts.push(res.concept);
      }
    }
    return filterConcepts(concepts, filter);
  }
}
