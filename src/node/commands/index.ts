/**
 * @fileoverview `okf index` command implementation.
 *
 * @packageDocumentation
 */

import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import { writeDirectoryIndex } from '../directory-index.js';
import { loadConfig } from '../config-loader.js';
import {
  resolvePathFallback,
  resolveTargets,
  setCliExitCode,
} from './common.js';

export const indexCommand = defineCommand({
  meta: {
    name: 'index',
    description: 'Generate or update directory index.md',
  },
  args: {
    dir: {
      type: 'positional',
      description: 'Directory path to index',
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
      typeof args.dir === 'string' && args.dir
        ? args.dir
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
        command: 'index',
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
      try {
        const stat = await fs.stat(targetPath);
        if (!stat.isDirectory()) {
          throw new Error(`Path is not a directory: ${targetPath}`);
        }
        const indexPath = await writeDirectoryIndex(targetPath);
        console.log(`[INDEX UPDATED] ${indexPath}`);
      } catch (err: unknown) {
        console.error(
          `Error generating index: ${err instanceof Error ? err.message : String(err)}`
        );
        overallExitCode = 1;
      }
    }

    setCliExitCode(overallExitCode);
    return overallExitCode;
  },
});
