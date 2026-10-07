/**
 * @fileoverview Command-line interface runner for Open Knowledge Format (OKF v0.2) tools.
 *
 * Implements CLI commands:
 * - `okf create` (alias: `new`): Scaffolds new concept documents with validated frontmatter.
 * - `okf validate`: Validates schema conformance across concept documents.
 * - `okf index`: Generates or updates navigation tables in `index.md`.
 * - `okf attest`: Evaluates computational attestations.
 * - `okf graph`: Renders the knowledge graph in terminal text or JSON formats.
 *
 * @packageDocumentation
 */

import { defineCommand, runCommand } from 'citty';
import { createCommand } from './commands/create.js';
import { validateCommand } from './commands/validate.js';
import { indexCommand } from './commands/index.js';
import { attestCommand } from './commands/attest.js';
import { graphCommand } from './commands/graph.js';
import { skillCommand } from './commands/skill.js';

import { resetCliExitCode, getCliExitCode } from './commands/common.js';

const mainCommand = defineCommand({
  meta: {
    name: 'okf',
    version: '0.2',
    description: 'Open Knowledge Format (OKF v0.2) CLI',
  },
  subCommands: {
    create: createCommand,
    new: createCommand,
    validate: validateCommand,
    index: indexCommand,
    attest: attestCommand,
    graph: graphCommand,
    skill: skillCommand,
  },
});

/**
 * Prints the OKF CLI help message to standard output.
 */
export function printHelp(): void {
  console.log(`
Open Knowledge Format (OKF v0.2) CLI

Usage:
  okf create <file> [options]         Create a new OKF concept document (alias: okf new)
  okf validate [path]                 Validate OKF frontmatter schema in a file or directory
  okf index [dir]                     Generate or update directory index.md
  okf attest <file>                   Evaluate Attested Computation concept
  okf graph [dir] [--json]            Generate and display knowledge graph
  okf skill install [dir] [options]   Install OKF Agent Skill into workspace or user directory
  okf --config, -c <path>             Path to configuration file
  okf --help, -h                      Show this help message

Options for 'create':
  --title, -t <title>          Concept title (required)
  --type <type>                Concept type (default: 'concept')
  --desc, -d <description>     Concept description
  --tags <tag1,tag2>           Comma-separated tags
  --status <status>            Status: active | draft | deprecated | archived (default: 'active')
  --stale-after <YYYY-MM-DD>   Stale expiration date
  --resource <uri>             Resource identifier or URI
  --body <body>                Initial body markdown content
  --force, -f                  Overwrite existing file
  --actor <id>                 Actor identifier for audit log (default: human:$USER)
  --no-log                     Skip appending creation to log.md

Options for 'skill':
  --dest, -d <path>            Custom destination path
  --agent <platform>           Target agent platform preset: antigravity | gemini | claude | generic
  --force, -f                  Overwrite existing skill files
  --global, -g                 Install into user global skills directory
  --dry-run                    Preview files to be installed without copying
`);
}

/**
 * Main command-line dispatcher for the `okf` CLI binary.
 *
 * Parses arguments and dispatches to appropriate handlers: `create`, `validate`, `index`, `attest`, `graph`, `skill`.
 *
 * @param args - Command line arguments vector (excluding `node` and binary name, e.g. `process.argv.slice(2)`).
 * @returns Exit code promise (0 for success, non-zero on failure).
 *
 * @example
 * ```ts
 * const exitCode = await runCli(['validate', './docs/concepts']);
 * ```
 */
export async function runCli(args: string[]): Promise<number> {
  resetCliExitCode();

  if (
    args.length === 0 ||
    args.includes('--help') ||
    args.includes('-h') ||
    args[0] === 'help'
  ) {
    printHelp();
    return 0;
  }

  const validCommands = new Set([
    'create',
    'new',
    'validate',
    'index',
    'attest',
    'graph',
    'skill',
  ]);
  const firstNonFlag = args.find((a) => !a.startsWith('-'));

  if (firstNonFlag && !validCommands.has(firstNonFlag)) {
    console.error(`Unknown command: ${firstNonFlag}`);
    printHelp();
    return 1;
  }

  try {
    await runCommand(mainCommand, {
      rawArgs: args,
      showUsage: false,
    });

    const exitCode = getCliExitCode();
    if (exitCode !== 0) {
      if (args[0] === 'create' || args[0] === 'new') {
        printHelp();
      }
    }

    return exitCode;
  } catch (err: unknown) {
    console.error(
      `Error executing command: ${err instanceof Error ? err.message : String(err)}`
    );
    printHelp();
    return 1;
  }
}
