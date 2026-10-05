/**
 * @fileoverview `okf attest` command implementation.
 *
 * @packageDocumentation
 */

import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import { evaluateAttestedComputation } from '../../attester.js';
import { loadConfig } from '../config-loader.js';
import {
  resolvePathFallback,
  resolveTargets,
  setCliExitCode,
} from './common.js';

export const attestCommand = defineCommand({
  meta: {
    name: 'attest',
    description: 'Evaluate Attested Computation concept',
  },
  args: {
    file: {
      type: 'positional',
      description: 'Path to concept file',
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
      typeof args.file === 'string' && args.file
        ? args.file
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
        command: 'attest',
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
          command: 'attest',
          targetPath,
        });
      }

      let content: string;
      try {
        const isFs =
          'baseDir' in targetConfig.repository &&
          typeof (targetConfig.repository as { baseDir: string }).baseDir ===
            'string';

        if (isFs) {
          content = await fs.readFile(targetPath, 'utf8');
        } else {
          content = await targetConfig.repository.readConcept(targetPath);
        }
      } catch {
        console.error(`Error: File does not exist: ${targetPath}`);
        overallExitCode = 1;
        continue;
      }

      const parseRes = targetConfig.parser.parse(content, targetPath);
      if (!parseRes.valid || !parseRes.concept) {
        console.error(
          `Error: Invalid OKF document: ${parseRes.errors?.join(', ') || 'Unknown parsing error'}`
        );
        overallExitCode = 1;
        continue;
      }

      const attestRes = evaluateAttestedComputation(parseRes.concept);
      if (attestRes.passed) {
        console.log(`[ATTESTATION READY] ${attestRes.message}`);
      } else {
        console.error(`[ATTESTATION FAILED] ${attestRes.message}`);
        overallExitCode = 1;
      }
    }

    setCliExitCode(overallExitCode);
    return overallExitCode;
  },
});
