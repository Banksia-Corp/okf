import { z } from 'zod';
import { Repository, QueryableRepository } from './repository.js';
import { Parser } from './parser.js';
import { AuditLogger } from './logger.js';

export interface ConfigContext {
  cwd: string;
  configPath?: string;
  command?: string;
  targetPath?: string;
}

export interface KnowledgeRootConfig {
  path: string;
  name?: string;
  description?: string;
  options?: Record<string, unknown>;
}

export type KnowledgeRootDefinition = string | KnowledgeRootConfig;

export type KnowledgeRoots =
  | KnowledgeRootDefinition
  | KnowledgeRootDefinition[]
  | Record<string, string | Omit<KnowledgeRootConfig, 'name'>>;

export interface NormalizedRoot {
  name?: string;
  path: string;
  resolvedPath: string;
  description?: string;
  options?: Record<string, unknown>;
}

export type PluggableFactory<T> = (context: ConfigContext) => T | Promise<T>;

export interface OKFConfig {
  roots?: KnowledgeRoots;
  repository?:
    | Repository
    | QueryableRepository
    | PluggableFactory<Repository | QueryableRepository>;
  logger?: AuditLogger | PluggableFactory<AuditLogger>;
  parser?: Parser | PluggableFactory<Parser>;
  onError?: (path: string, error: unknown) => void;
  commands?: {
    graph?: { json?: boolean };
    validate?: { strict?: boolean };
    [key: string]: unknown;
  };
  plugins?: unknown[];
}

export type ConfigFn = (
  context: ConfigContext
) => OKFConfig | Promise<OKFConfig>;
export type ConfigExport = OKFConfig | Promise<OKFConfig> | ConfigFn;

export function defineConfig(config: ConfigExport): ConfigExport {
  return config;
}

// Zod Schema for static validation (e.g. JSON configs or static object validation)
export const KnowledgeRootConfigSchema = z.object({
  path: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const KnowledgeRootDefinitionSchema = z.union([
  z.string(),
  KnowledgeRootConfigSchema,
]);

export const KnowledgeRootsSchema = z.union([
  KnowledgeRootDefinitionSchema,
  z.array(KnowledgeRootDefinitionSchema),
  z.record(
    z.string(),
    z.union([z.string(), KnowledgeRootConfigSchema.omit({ name: true })])
  ),
]);

export const OKFConfigSchema = z.object({
  roots: KnowledgeRootsSchema.optional(),
  repository: z
    .custom(
      (val) =>
        typeof val === 'function' || (typeof val === 'object' && val !== null),
      { message: 'repository must be an object or factory function' }
    )
    .optional(),
  logger: z
    .custom(
      (val) =>
        typeof val === 'function' || (typeof val === 'object' && val !== null),
      { message: 'logger must be an object or factory function' }
    )
    .optional(),
  parser: z
    .custom(
      (val) =>
        typeof val === 'function' || (typeof val === 'object' && val !== null),
      { message: 'parser must be an object or factory function' }
    )
    .optional(),
  onError: z
    .custom((val) => typeof val === 'function', {
      message: 'onError must be a function',
    })
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
 * Universal root normalization logic (path resolution is handled by resolver using relative base)
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
