/**
 * @fileoverview Node.js configuration file discovery, loader, and resolver for OKF projects.
 *
 * Discovers configuration files (`okf.config.ts`, `.okfrc.json`, etc.) by traversing upwards
 * from the working directory, and dynamically loads them using `jiti` with TypeScript transpilation support.
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {
  OKFConfig,
  OKFConfigSchema,
  ConfigContext,
  NormalizedRoot,
  normalizeKnowledgeRoots,
} from '../config.js';
import { Repository, QueryableRepository } from '../repository.js';
import { FileSystemRepository } from './fs-repository.js';
import { AuditLogger } from '../logger.js';
import { NodeFileAuditLogger } from './file-logger.js';
import { Parser, GrayMatterParser } from '../parser.js';

/**
 * Standard filenames checked when searching for an OKF configuration file.
 */
export const CONFIG_FILE_NAMES: readonly string[] = [
  'okf.config.ts',
  'okf.config.mts',
  'okf.config.js',
  'okf.config.mjs',
  'okf.config.cjs',
  'okf.config.json',
  '.okfrc.json',
];

/**
 * Searches upwards from `startDir` to monorepo root or filesystem root for an OKF config file.
 * Halts traversal when `.git` or `pnpm-workspace.yaml` is encountered.
 *
 * @param startDir - Starting directory to initiate the upwards search. Defaults to `process.cwd()`.
 * @returns Absolute filesystem path to the discovered config file, or `null` if not found.
 *
 * @example
 * ```ts
 * const configPath = findConfigFile('/workspace/projects/knowledge');
 * // '/workspace/projects/knowledge/okf.config.ts'
 * ```
 */
export function findConfigFile(startDir?: string): string | null {
  let current = path.resolve(startDir || process.cwd());

  while (true) {
    for (const name of CONFIG_FILE_NAMES) {
      const candidate = path.join(current, name);
      if (fsSync.existsSync(candidate)) {
        return candidate;
      }
    }

    const hasGit = fsSync.existsSync(path.join(current, '.git'));
    const hasWorkspace = fsSync.existsSync(
      path.join(current, 'pnpm-workspace.yaml')
    );

    const parent = path.dirname(current);
    if (hasGit || hasWorkspace || parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

/**
 * Options controlling configuration file loading and contextual resolution.
 */
export interface LoadConfigOptions {
  /** Optional explicit filesystem path to configuration file. */
  configPath?: string;
  /** Working directory context. Defaults to `process.cwd()`. */
  cwd?: string;
  /** CLI command being invoked (e.g. `'create'`, `'validate'`). */
  command?: string;
  /** Specific target file or directory path passed to the command. */
  targetPath?: string;
}

/**
 * Fully resolved and instantiated OKF configuration object with ready-to-use services.
 */
export interface ResolvedOKFConfig {
  /** Path to the resolved config file, or `undefined` if default fallback was used. */
  configPath?: string;
  /** Raw validated OKF configuration object. */
  config: OKFConfig;
  /** Normalized knowledge roots. */
  roots: NormalizedRoot[];
  /** Concrete repository instance. Defaults to {@link FileSystemRepository}. */
  repository: Repository | QueryableRepository;
  /** Concrete audit logger instance. Defaults to {@link NodeFileAuditLogger}. */
  logger: AuditLogger;
  /** Concrete markdown frontmatter parser. Defaults to {@link GrayMatterParser}. */
  parser: Parser;
  /** Optional error notification handler. */
  onError?: (path: string, error: unknown) => void;
  /** Command-specific configuration options. */
  commands?: OKFConfig['commands'];
}

/**
 * Loads and resolves the active OKF configuration for the project.
 *
 * Discovers config files via {@link findConfigFile} unless explicitly provided in `options.configPath`.
 * Evaluates factory functions for `repository`, `logger`, and `parser` abstractions, falling back
 * to standard Node.js implementations if unconfigured.
 *
 * @param options - Options controlling discovery and resolution context.
 * @returns A promise resolving to the {@link ResolvedOKFConfig}.
 * @throws Error if an explicit config file cannot be found or if schema validation fails.
 *
 * @example
 * ```ts
 * const resolved = await loadConfig({ cwd: process.cwd() });
 * console.log(`Config loaded from ${resolved.configPath}`);
 * const concepts = await resolved.repository.listConcepts();
 * ```
 */
export async function loadConfig(
  options: LoadConfigOptions = {}
): Promise<ResolvedOKFConfig> {
  const cwd = path.resolve(options.cwd || process.cwd());
  let resolvedConfigPath: string | undefined;

  if (options.configPath) {
    resolvedConfigPath = path.resolve(cwd, options.configPath);
    if (!fsSync.existsSync(resolvedConfigPath)) {
      throw new Error(`Configuration file not found: ${resolvedConfigPath}`);
    }
  } else {
    resolvedConfigPath = findConfigFile(cwd) || undefined;
  }

  let rawConfig: unknown = {};
  const configDir = resolvedConfigPath ? path.dirname(resolvedConfigPath) : cwd;

  const context: ConfigContext = {
    cwd,
    configPath: resolvedConfigPath,
    command: options.command,
    targetPath: options.targetPath,
  };

  if (resolvedConfigPath) {
    if (
      resolvedConfigPath.endsWith('.json') ||
      path.basename(resolvedConfigPath) === '.okfrc.json'
    ) {
      const content = await fs.readFile(resolvedConfigPath, 'utf8');
      const parsed = JSON.parse(content);
      const validated = OKFConfigSchema.safeParse(parsed);
      if (!validated.success) {
        const issues = validated.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', ');
        throw new Error(
          `Invalid configuration in ${resolvedConfigPath}: ${issues}`
        );
      }
      rawConfig = validated.data;
    } else {
      // TypeScript or JavaScript config loaded via jiti
      const { createJiti } = await import('jiti');
      const jiti = createJiti(import.meta.url, {
        interopDefault: true,
      });
      const exported = await jiti.import(resolvedConfigPath, { default: true });

      if (typeof exported === 'function') {
        rawConfig = await (exported as (ctx: ConfigContext) => unknown)(
          context
        );
      } else {
        rawConfig = exported;
      }

      const validated = OKFConfigSchema.safeParse(rawConfig);
      if (!validated.success) {
        const issues = validated.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', ');
        throw new Error(
          `Invalid configuration in ${resolvedConfigPath}: ${issues}`
        );
      }
      rawConfig = validated.data;
    }
  }

  const okfConfig = (rawConfig || {}) as OKFConfig;

  // Normalize roots
  const roots: NormalizedRoot[] = okfConfig.roots
    ? normalizeKnowledgeRoots(okfConfig.roots, (p) =>
        path.resolve(configDir, p)
      )
    : [];

  // Resolve abstractions
  let resolvedRepo: Repository | QueryableRepository;
  if (typeof okfConfig.repository === 'function') {
    resolvedRepo = await okfConfig.repository(context);
  } else if (okfConfig.repository) {
    resolvedRepo = okfConfig.repository;
  } else {
    // Default FileSystemRepository targeting specified targetPath or first root or cwd
    const defaultTarget =
      options.targetPath || (roots.length > 0 ? roots[0].resolvedPath : cwd);
    resolvedRepo = new FileSystemRepository(defaultTarget);
  }

  let resolvedLogger: AuditLogger;
  if (typeof okfConfig.logger === 'function') {
    resolvedLogger = await okfConfig.logger(context);
  } else if (okfConfig.logger) {
    resolvedLogger = okfConfig.logger;
  } else {
    const defaultTarget =
      options.targetPath || (roots.length > 0 ? roots[0].resolvedPath : cwd);
    resolvedLogger = new NodeFileAuditLogger(defaultTarget);
  }

  let resolvedParser: Parser;
  if (typeof okfConfig.parser === 'function') {
    resolvedParser = await okfConfig.parser(context);
  } else if (okfConfig.parser) {
    resolvedParser = okfConfig.parser;
  } else {
    resolvedParser = new GrayMatterParser();
  }

  return {
    configPath: resolvedConfigPath,
    config: okfConfig,
    roots,
    repository: resolvedRepo,
    logger: resolvedLogger,
    parser: resolvedParser,
    onError: okfConfig.onError,
    commands: okfConfig.commands,
  };
}
