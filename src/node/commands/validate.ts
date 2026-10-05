/**
 * @fileoverview `okf validate` command implementation.
 *
 * @packageDocumentation
 */

import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import { Client } from '../../client.js';
import { loadConfig } from '../config-loader.js';
import {
  resolvePathFallback,
  resolveTargets,
  setCliExitCode,
} from './common.js';

export const validateCommand = defineCommand({
  meta: {
    name: 'validate',
    description: 'Validate OKF frontmatter schema in a file or directory',
  },
  args: {
    path: {
      type: 'positional',
      description: 'Path to concept file or directory',
      required: false,
    },
    config: {
      type: 'string',
      alias: 'c',
      description: 'Path to configuration file',
    },
  },
  async run({ args }) {
    const positionalPath =
      typeof args.path === 'string' && args.path
        ? args.path
        : typeof args._?.[0] === 'string' && args._[0]
          ? args._[0]
          : undefined;

    const configPath =
      typeof args.config === 'string' ? args.config : undefined;

    let resolvedConfig;
    try {
      resolvedConfig = await loadConfig({
        configPath,
        cwd: process.cwd(),
        command: 'validate',
        targetPath: positionalPath
          ? resolvePathFallback(positionalPath)
          : undefined,
      });
    } catch (err: unknown) {
      console.error(
        `Error loading configuration: ${err instanceof Error ? err.message : String(err)}`
      );
      setCliExitCode(1);
      return 1;
    }

    const targets = resolveTargets(positionalPath, resolvedConfig);
    let overallExitCode = 0;

    for (const targetPath of targets) {
      let targetConfig = resolvedConfig;
      if (
        targets.length > 1 &&
        'baseDir' in resolvedConfig.repository &&
        typeof (resolvedConfig.repository as { baseDir: string }).baseDir ===
          'string'
      ) {
        targetConfig = await loadConfig({
          configPath,
          cwd: process.cwd(),
          command: 'validate',
          targetPath,
        });
      }

      const repo = targetConfig.repository;
      const parser = targetConfig.parser;

      const isFs =
        'baseDir' in repo &&
        typeof (repo as { baseDir: string }).baseDir === 'string';

      if (isFs) {
        let stat;
        try {
          stat = await fs.stat(targetPath);
        } catch {
          console.error(`Error: Path does not exist: ${targetPath}`);
          overallExitCode = 1;
          continue;
        }

        if (stat.isFile()) {
          const content = await fs.readFile(targetPath, 'utf8');
          const res = parser.parse(content, targetPath);
          if (res.valid) {
            console.log(`[VALID] ${targetPath}`);
          } else {
            console.error(
              `[INVALID] ${targetPath}: ${res.errors?.join(', ') || 'Unknown validation error'}`
            );
            overallExitCode = 1;
          }
          continue;
        }
      }

      const errors: { path: string; error: unknown }[] = [];
      const client = new Client({
        repository: repo,
        parser,
        onError: (filePath, error) => {
          targetConfig.onError?.(filePath, error);
          errors.push({ path: filePath, error });
        },
      });

      const concepts = await client.listAllConcepts();

      for (const c of concepts) {
        console.log(`[VALID] ${c.filepath}`);
      }
      for (const e of errors) {
        const msg =
          e.error instanceof Error ? e.error.message : String(e.error);
        console.error(`[INVALID] ${e.path}: ${msg}`);
      }

      console.log(
        `\nValidation complete: ${concepts.length} valid, ${errors.length} invalid.`
      );
      if (errors.length > 0) {
        overallExitCode = 1;
      }
    }

    setCliExitCode(overallExitCode);
    return overallExitCode;
  },
});
