/**
 * @fileoverview Universal decoupled repository abstraction and in-memory implementation for OKF concepts.
 *
 * Provides storage-agnostic I/O contracts ({@link Repository} and {@link QueryableRepository})
 * ensuring core business logic remains independent from physical filesystems or cloud backends.
 *
 * @packageDocumentation
 */

import { Concept } from './schema.js';
import { parseConceptContent } from './parser.js';
import { filterConcepts } from './graph.js';

/**
 * Filter predicate parameters used when querying concepts from a repository.
 */
export interface ConceptFilter {
  /** Filter by one or more concept types (e.g. `'concept'`, `'architecture'`). */
  type?: string | string[];
  /** Filter by tags; matches if the concept contains any of the specified tags. */
  tags?: string[];
  /** Filter by lifecycle status. */
  status?: 'active' | 'draft' | 'deprecated' | 'archived';
  /** Filter by derived verification trust tier. */
  trustTier?: 'unverified' | 'machine-confirmed' | 'human-reviewed';
  /**
   * Filter by freshness; `true` returns only fresh concepts, `false` returns only stale concepts.
   */
  stale?: boolean;
}

/**
 * Core I/O interface abstracting document storage and directory listing.
 */
export interface Repository {
  /**
   * Reads raw content of a concept file at the specified subpath.
   *
   * @param path - Relative path to the concept document.
   * @returns Raw string content.
   * @throws Error if concept does not exist.
   */
  readConcept(path: string): Promise<string>;

  /**
   * Writes raw string content to a concept file at the specified subpath.
   *
   * @param path - Relative path to write.
   * @param content - Document content string.
   */
  writeConcept(path: string, content: string): Promise<void>;

  /**
   * Checks whether a concept exists at the given relative path.
   *
   * @param path - Relative path to check.
   * @returns `true` if document exists, `false` otherwise.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Lists relative paths to concept documents within an optional subdirectory.
   * Excludes index and log files.
   *
   * @param subpath - Subdirectory path to scope listing to.
   * @returns Sorted array of relative concept file paths.
   */
  listConcepts(subpath?: string): Promise<string[]>;

  /**
   * Lists immediate child subdirectories within a directory path.
   *
   * @param subpath - Subdirectory path to inspect.
   * @returns Sorted array of subdirectory names.
   */
  listSubdirectories(subpath?: string): Promise<string[]>;

  /**
   * Deletes a concept file at the specified path if supported.
   *
   * @param path - Relative path of the concept to delete.
   */
  deleteConcept?(path: string): Promise<void>;
}

/**
 * Extended repository abstraction supporting direct concept querying and filtering.
 */
export interface QueryableRepository extends Repository {
  /**
   * Queries and returns parsed concepts matching the provided {@link ConceptFilter}.
   *
   * @param filter - Query criteria.
   * @returns Filtered array of {@link Concept} objects.
   */
  queryConcepts(filter: ConceptFilter): Promise<Concept[]>;
}

/**
 * Ephemeral in-memory implementation of {@link QueryableRepository} suitable for unit tests,
 * Edge environments, and browser runtimes.
 */
export class InMemoryRepository implements QueryableRepository {
  private files: Map<string, string> = new Map();

  /**
   * Creates a new `InMemoryRepository` optionally pre-populated with files.
   *
   * @param initialFiles - Key-value map of normalized filepaths to string contents.
   *
   * @example
   * ```ts
   * const repo = new InMemoryRepository({
   *   'concepts/arch.md': '---\ntype: architecture\n---\n# Arch',
   * });
   * ```
   */
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
      .replace(/^(\.\/)+/, '')
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

  /**
   * Reads raw content of a stored file.
   *
   * @param path - Stored file path.
   * @returns Raw file text.
   * @throws Error if path is not stored.
   */
  async readConcept(path: string): Promise<string> {
    const normalized = this.normalizePath(path);
    const content = this.files.get(normalized);
    if (content === undefined) {
      throw new Error(`Concept not found: ${path}`);
    }
    return content;
  }

  /**
   * Stores raw content at the given path.
   *
   * @param path - File path to store under.
   * @param content - File content.
   */
  async writeConcept(path: string, content: string): Promise<void> {
    this.files.set(this.normalizePath(path), content);
  }

  /**
   * Checks if a file exists in the in-memory map.
   *
   * @param path - File path to check.
   * @returns `true` if stored, `false` otherwise.
   */
  async exists(path: string): Promise<boolean> {
    return this.files.has(this.normalizePath(path));
  }

  /**
   * Lists all concept files directly within `subpath` (non-recursive).
   *
   * @param subpath - Directory path scope.
   * @returns Sorted array of concept file paths.
   */
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

  /**
   * Lists immediate child subdirectories within `subpath`.
   *
   * @param subpath - Directory path scope.
   * @returns Sorted array of subdirectory names.
   */
  async listSubdirectories(subpath: string = ''): Promise<string[]> {
    const normSubpath = subpath ? this.normalizePath(subpath) : '';
    const prefix = normSubpath ? `${normSubpath}/` : '';
    const subdirs = new Set<string>();

    for (const key of this.files.keys()) {
      if (prefix && !key.startsWith(prefix)) continue;
      const relative = prefix ? key.slice(prefix.length) : key;
      const parts = relative.split('/');
      if (
        parts.length > 1 &&
        parts[0] &&
        !parts[0].startsWith('.') &&
        !key.startsWith('.')
      ) {
        subdirs.add(parts[0]);
      }
    }

    return Array.from(subdirs).sort();
  }

  /**
   * Deletes a concept from the in-memory map.
   *
   * @param path - Path of concept to remove.
   */
  async deleteConcept(path: string): Promise<void> {
    this.files.delete(this.normalizePath(path));
  }

  /**
   * Parses all in-memory concepts and filters them using {@link filterConcepts}.
   *
   * @param filter - Concept filtering criteria.
   * @returns Filtered array of concepts.
   */
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
