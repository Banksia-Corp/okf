/**
 * @fileoverview `okf skill` command implementation.
 *
 * Supports installing the OKF agent skill into project or global agent directories.
 *
 * @packageDocumentation
 */

import { defineCommand } from 'citty';
import { installSkill } from '../skill-installer.js';
import { setCliExitCode } from './common.js';

export const skillCommand = defineCommand({
  meta: {
    name: 'skill',
    description: 'Manage and install OKF Agent Skill files',
  },
  args: {
    action: {
      type: 'positional',
      description:
        'Skill subaction (install, init, add) or target destination path',
      required: false,
    },
    dest: {
      type: 'string',
      alias: 'd',
      description: 'Custom destination path',
    },
    agent: {
      type: 'string',
      description:
        'Target agent platform preset (antigravity, gemini, claude, generic)',
    },
    force: {
      type: 'boolean',
      alias: 'f',
      description: 'Overwrite existing skill files',
    },
    global: {
      type: 'boolean',
      alias: 'g',
      description: 'Install into user global skills directory',
    },
    'dry-run': {
      type: 'boolean',
      description: 'Preview destination path and files without copying',
    },
  },
  async run({ args, rawArgs }) {
    // Collect raw positional arguments to handle subcommands or target dirs
    const positional =
      typeof args.action === 'string' && args.action
        ? args.action
        : typeof args._?.[0] === 'string' && args._[0]
          ? args._[0]
          : undefined;

    // Check if second positional exists (e.g., `okf skill install <targetDir>`)
    const secondPositional =
      typeof args._?.[1] === 'string' && args._[1] ? args._[1] : undefined;

    const actionAliases = new Set(['install', 'init', 'add']);
    let destPath: string | undefined =
      typeof args.dest === 'string' ? args.dest : undefined;

    if (positional && !actionAliases.has(positional)) {
      // e.g. `okf skill ./custom-dir`
      if (!destPath) {
        destPath = positional;
      }
    } else if (secondPositional) {
      // e.g. `okf skill install ./custom-dir`
      if (!destPath) {
        destPath = secondPositional;
      }
    }

    const dryRun = Boolean(args['dry-run'] || rawArgs?.includes('--dry-run'));
    const force = Boolean(
      args.force || rawArgs?.includes('-f') || rawArgs?.includes('--force')
    );
    const isGlobal = Boolean(
      args.global || rawArgs?.includes('-g') || rawArgs?.includes('--global')
    );
    const agent = typeof args.agent === 'string' ? args.agent : undefined;

    try {
      const result = await installSkill({
        dest: destPath,
        agent,
        force,
        global: isGlobal,
        dryRun,
        cwd: process.cwd(),
      });

      if (dryRun) {
        console.log(`[DRY-RUN] Target destination: ${result.targetDir}`);
        console.log(`[DRY-RUN] Files to install (${result.files.length}):`);
        for (const file of result.files) {
          console.log(`  - ${file}`);
        }
      } else {
        console.log(
          `[SKILL INSTALLED] Successfully installed OKF Agent Skill to: ${result.targetDir}`
        );
        for (const file of result.files) {
          console.log(`  ✓ ${file}`);
        }
      }

      setCliExitCode(0);
      return 0;
    } catch (err: unknown) {
      console.error(
        `Error installing skill: ${err instanceof Error ? err.message : String(err)}`
      );
      setCliExitCode(1);
      return 1;
    }
  },
});
