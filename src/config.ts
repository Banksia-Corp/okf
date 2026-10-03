/**
 * @fileoverview Universal configuration schemas, types, and root normalization for OKF projects.
 *
 * This module defines configuration types (`okf.config.ts`), pluggable factories for repositories,
 * parsers, and loggers, along with multi-root knowledge path resolution.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { Repository, QueryableRepository } from './repository.js';
import { Parser } from './parser.js';
import { AuditLogger } from './logger.js';

/**
 * Execution context supplied to dynamic configuration functions and pluggable factories.
 */
export interface ConfigContext {
  /** The current working directory of the process. */
  cwd: string;
  /** Resolved filesystem path to the loaded configuration file, if any. */
  configPath?: string;
  /** Invoked CLI command name (e.g. `'create'`, `'validate'`, `'graph'`). */
  command?: string;
  /** Explicit target path or directory passed as an argument. */
  targetPath?: string;
}

/**
 * Structured descriptor configuration for an individual knowledge root directory.
 */
export interface KnowledgeRootConfig {
  /** Relative or absolute filesystem path to the knowledge root directory. */
  path: string;
  /** Optional human-readable identifier or namespace name for this root. */
  name?: string;
  /** Optional summary description of the knowledge corpus contained within this root. */
  description?: string;
  /** Optional engine or adapter-specific options for this root. */
  options?: Record<string, unknown>;
}

/**
 * Flexible knowledge root definition: either a simple directory path string or a {@link KnowledgeRootConfig} object.
 */
export type KnowledgeRootDefinition = string | KnowledgeRootConfig;

/**
 * Configurable knowledge roots structure supporting single strings, arrays, or mapped dictionary records.
 */
export type KnowledgeRoots =
  | KnowledgeRootDefinition
  | KnowledgeRootDefinition[]
  | Record<string, string | Omit<KnowledgeRootConfig, 'name'>>;

/**
 * Standardized representation of a resolved knowledge root directory.
 */
export interface NormalizedRoot {
  /** Optional name or namespace assigned to this knowledge root. */
  name?: string;
  /** Original configured path string. */
  path: string;
  /** Fully resolved absolute filesystem path. */
  resolvedPath: string;
  /** Optional summary description of this knowledge root. */
  description?: string;
  /** Optional engine or adapter-specific options. */
  options?: Record<string, unknown>;
}

/**
 * Factory function producing an instance or resolving an asynchronous promise to an instance given a {@link ConfigContext}.
 */
export type PluggableFactory<T> = (context: ConfigContext) => T | Promise<T>;

/**
 * Root configuration interface for `@banksia/okf` projects (`okf.config.ts` or `okf.config.js`).
 */
export interface OKFConfig {
  /**
   * One or more knowledge directory roots to index, validate, or traverse.
   */
  roots?: KnowledgeRoots;
  /**
   * Storage repository abstraction or factory function. Defaults to {@link FileSystemRepository}.
   */
  repository?:
    | Repository
    | QueryableRepository
    | PluggableFactory<Repository | QueryableRepository>;
  /**
   * Audit logger abstraction or factory function. Defaults to {@link NodeFileAuditLogger}.
   */
  logger?: AuditLogger | PluggableFactory<AuditLogger>;
  /**
   * Markdown frontmatter parser abstraction or factory function. Defaults to {@link GrayMatterParser}.
   */
  parser?: Parser | PluggableFactory<Parser>;
  /**
   * Optional error notification handler invoked when non-fatal concept parsing or traversal errors occur.
   */
  onError?: (path: string, error: unknown) => void;
  /**
   * Command-specific default options (e.g. `graph`, `validate`).
   */
  commands?: {
    graph?: { json?: boolean };
    validate?: { strict?: boolean };
    [key: string]: unknown;
  };
  /**
   * Optional list of plugins or extensions.
   */
  plugins?: unknown[];
}

/**
 * Dynamic configuration function accepting a {@link ConfigContext} and returning an {@link OKFConfig}.
 */
export type ConfigFn = (
  context: ConfigContext
) => OKFConfig | Promise<OKFConfig>;

/**
 * Supported export shapes for OKF configuration files: static object, promise, or dynamic function.
 */
export type ConfigExport = OKFConfig | Promise<OKFConfig> | ConfigFn;

/**
 * Helper function providing TypeScript autocomplete and type checking for OKF configuration definitions.
 *
 * @param config - The OKF configuration object, promise, or factory function.
 * @returns The unaltered configuration input.
 *
 * @example
 * ```ts
 * // okf.config.ts
 * import { defineConfig } from '@banksia/okf';
 *
 * export default defineConfig({
 *   roots: ['./docs/concepts'],
 *   commands: {
 *     graph: { json: false },
 *   },
 * });
 * ```
 */
export function defineConfig(config: ConfigExport): ConfigExport {
  return config;
}

const InternalKnowledgeRootConfigSchema = z.object({
  path: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Zod schema validating a {@link KnowledgeRootConfig} object.
 */
export const KnowledgeRootConfigSchema: z.ZodType<KnowledgeRootConfig> =
  InternalKnowledgeRootConfigSchema;

/**
 * Zod schema validating a single {@link KnowledgeRootDefinition} (string or object).
 */
export const KnowledgeRootDefinitionSchema: z.ZodType<KnowledgeRootDefinition> =
  z.union([z.string(), InternalKnowledgeRootConfigSchema]);

/**
 * Zod schema validating the flexible {@link KnowledgeRoots} configuration format.
 */
export const KnowledgeRootsSchema: z.ZodType<KnowledgeRoots> = z.union([
  KnowledgeRootDefinitionSchema,
  z.array(KnowledgeRootDefinitionSchema),
  z.record(
    z.string(),
    z.union([
      z.string(),
      InternalKnowledgeRootConfigSchema.omit({ name: true }),
    ])
  ),
]);

/**
 * Zod schema for static validation of {@link OKFConfig} configuration objects.
 */
export const OKFConfigSchema: z.ZodType<OKFConfig> = z.object({
  roots: KnowledgeRootsSchema.optional(),
  repository: z
    .custom<
      | Repository
      | QueryableRepository
      | PluggableFactory<Repository | QueryableRepository>
    >(
      (val) =>
        typeof val === 'function' || (typeof val === 'object' && val !== null),
      { message: 'repository must be an object or factory function' }
    )
    .optional(),
  logger: z
    .custom<AuditLogger | PluggableFactory<AuditLogger>>(
      (val) =>
        typeof val === 'function' || (typeof val === 'object' && val !== null),
      { message: 'logger must be an object or factory function' }
    )
    .optional(),
  parser: z
    .custom<Parser | PluggableFactory<Parser>>(
      (val) =>
        typeof val === 'function' || (typeof val === 'object' && val !== null),
      { message: 'parser must be an object or factory function' }
    )
    .optional(),
  onError: z
    .custom<(path: string, error: unknown) => void>(
      (val) => typeof val === 'function',
      {
        message: 'onError must be a function',
      }
    )
    .optional(),
  commands: z
    .object({
      graph: z
        .object({
          json: z.boolean().optional(),
        })
        .optional(),
      validate: z
        .object({
          strict: z.boolean().optional(),
        })
        .optional(),
    })
    .catchall(z.unknown())
    .optional(),
  plugins: z.array(z.unknown()).optional(),
});

/**
 * Universal root normalization logic converting diverse root configurations into an array of {@link NormalizedRoot} descriptors.
 *
 * @param roots - Configured roots specification (string, array, or record).
 * @param resolvePath - Path resolver callback function converting relative paths to absolute paths.
 * @returns An array of {@link NormalizedRoot} descriptors.
 *
 * @example
 * ```ts
 * const roots = normalizeKnowledgeRoots('./concepts', (p) => `/workspace/${p}`);
 * // [{ path: './concepts', resolvedPath: '/workspace/./concepts' }]
 * ```
 */
export function normalizeKnowledgeRoots(
  roots: KnowledgeRoots,
  resolvePath: (p: string) => string
): NormalizedRoot[] {
  const result: NormalizedRoot[] = [];

  if (typeof roots === 'string') {
    result.push({
      path: roots,
      resolvedPath: resolvePath(roots),
    });
  } else if (Array.isArray(roots)) {
    for (const item of roots) {
      if (typeof item === 'string') {
        result.push({
          path: item,
          resolvedPath: resolvePath(item),
        });
      } else if (item && typeof item === 'object') {
        result.push({
          name: item.name,
          path: item.path,
          resolvedPath: resolvePath(item.path),
          description: item.description,
          options: item.options,
        });
      }
    }
  } else if (typeof roots === 'object' && roots !== null) {
    for (const [key, value] of Object.entries(roots)) {
      if (typeof value === 'string') {
        result.push({
          name: key,
          path: value,
          resolvedPath: resolvePath(value),
        });
      } else if (value && typeof value === 'object') {
        result.push({
          name: key,
          path: value.path,
          resolvedPath: resolvePath(value.path),
          description: value.description,
          options: value.options,
        });
      }
    }
  }

  return result;
}
