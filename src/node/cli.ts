import { parseArgs } from 'node:util';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Client } from '../client.js';
import { ActorSchema } from '../schema.js';
import { writeDirectoryIndex } from './index.js';
import { evaluateAttestedComputation } from '../attester.js';
import { loadConfig, ResolvedOKFConfig } from './config-loader.js';

function resolvePathFallback(targetPath: string): string {
  if (fsSync.existsSync(targetPath)) {
    return targetPath;
  }
  // Try walking upwards from process.cwd() to locate monorepo root
  let current = process.cwd();
  while (current !== path.dirname(current)) {
    const candidate = path.resolve(current, targetPath);
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
    if (
      fsSync.existsSync(path.join(current, '.git')) ||
      fsSync.existsSync(path.join(current, 'pnpm-workspace.yaml'))
    ) {
      break;
    }
    current = path.dirname(current);
  }
  return targetPath;
}

export function printHelp(): void {
  console.log(`
Open Knowledge Format (OKF v0.2) CLI

Usage:
  okf create <file> [options]  Create a new OKF concept document (alias: okf new)
  okf validate [path]          Validate OKF frontmatter schema in a file or directory
  okf index [dir]              Generate or update directory index.md
  okf attest <file>            Evaluate Attested Computation concept
  okf graph [dir] [--json]     Generate and display knowledge graph
  okf --config, -c <path>      Path to configuration file
  okf --help, -h               Show this help message

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
`);
}

interface CreateFlags {
  title?: string;
  type?: string;
  desc?: string;
  tags?: string;
  status?: string;
  staleAfter?: string;
  resource?: string;
  body?: string;
  force?: boolean;
  actor?: string;
  noLog?: boolean;
}

function resolveDefaultActor(): string {
  try {
    const raw =
      process.env.USER ||
      process.env.USERNAME ||
      os.userInfo().username ||
      'unknown';
    const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '_') || 'anonymous';
    return `human:${sanitized}`;
  } catch {
    return 'human:anonymous';
  }
}

async function handleCreate(
  targetPath: string,
  flags: CreateFlags,
  resolvedConfig: ResolvedOKFConfig
): Promise<number> {
  if (!flags.title || typeof flags.title !== 'string') {
    console.error('Error: Missing required option --title, -t <title>');
    printHelp();
    return 1;
  }

  const client = new Client({
    repository: resolvedConfig.repository,
    parser: resolvedConfig.parser,
    onError: resolvedConfig.onError,
  });

  const tags = flags.tags
    ? flags.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  const validStatuses = ['active', 'draft', 'deprecated', 'archived'] as const;
  let status: (typeof validStatuses)[number] | undefined;
  if (flags.status) {
    if (
      !validStatuses.includes(flags.status as (typeof validStatuses)[number])
    ) {
      console.error(
        `Error: Invalid status '${flags.status}'. Must be one of: ${validStatuses.join(', ')}`
      );
      return 1;
    }
    status = flags.status as (typeof validStatuses)[number];
  }

  try {
    await client.createConcept({
      filepath: targetPath,
      title: flags.title,
      type: flags.type,
      description: flags.desc,
      tags,
      status,
      stale_after: flags.staleAfter,
      resource: flags.resource,
      body: flags.body,
      force: Boolean(flags.force),
    });

    console.log(`[CREATED] ${targetPath}`);

    if (!flags.noLog) {
      const actor = flags.actor || resolveDefaultActor();
      const actorRes = ActorSchema.safeParse(actor);
      if (!actorRes.success) {
        console.error(
          `Error: Invalid actor '${actor}'. Actor must follow <role>/<version>, human:<id>, or process:<id>`
        );
        return 1;
      }
      const targetBase = path.basename(targetPath);
      await resolvedConfig.logger.append({
        actor,
        action: 'create',
        target: targetBase,
        summary: `Created concept "${flags.title}"`,
      });
    }

    return 0;
  } catch (err: unknown) {
    console.error(
      `Error creating concept: ${err instanceof Error ? err.message : String(err)}`
    );
    return 1;
  }
}

async function handleValidate(
  targetPath: string,
  resolvedConfig: ResolvedOKFConfig
): Promise<number> {
  const repo = resolvedConfig.repository;
  const parser = resolvedConfig.parser;

  // If repo is not a FileSystemRepository (e.g. InMemoryRepository or mock), use repo directly
  const isFs =
    'baseDir' in repo &&
    typeof (repo as { baseDir: string }).baseDir === 'string';

  if (isFs) {
    let stat;
    try {
      stat = await fs.stat(targetPath);
    } catch {
      console.error(`Error: Path does not exist: ${targetPath}`);
      return 1;
    }

    if (stat.isFile()) {
      const content = await fs.readFile(targetPath, 'utf8');
      const res = parser.parse(content, targetPath);
      if (res.valid) {
        console.log(`[VALID] ${targetPath}`);
        return 0;
      } else {
        console.error(
          `[INVALID] ${targetPath}: ${res.errors?.join(', ') || 'Unknown validation error'}`
        );
        return 1;
      }
    }
  }

  const errors: { path: string; error: unknown }[] = [];
  const client = new Client({
    repository: repo,
    parser,
    onError: (filePath, error) => {
      resolvedConfig.onError?.(filePath, error);
      errors.push({ path: filePath, error });
    },
  });

  const concepts = await client.listAllConcepts();

  for (const c of concepts) {
    console.log(`[VALID] ${c.filepath}`);
  }
  for (const e of errors) {
    const msg = e.error instanceof Error ? e.error.message : String(e.error);
    console.error(`[INVALID] ${e.path}: ${msg}`);
  }

  console.log(
    `\nValidation complete: ${concepts.length} valid, ${errors.length} invalid.`
  );
  return errors.length > 0 ? 1 : 0;
}

async function handleIndex(targetPath: string): Promise<number> {
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${targetPath}`);
    }
    const indexPath = await writeDirectoryIndex(targetPath);
    console.log(`[INDEX UPDATED] ${indexPath}`);
    return 0;
  } catch (err: unknown) {
    console.error(
      `Error generating index: ${err instanceof Error ? err.message : String(err)}`
    );
    return 1;
  }
}

async function handleAttest(
  targetPath: string,
  resolvedConfig: ResolvedOKFConfig
): Promise<number> {
  let content: string;
  try {
    content = await resolvedConfig.repository.readConcept(targetPath);
  } catch {
    console.error(`Error: File does not exist: ${targetPath}`);
    return 1;
  }

  const parseRes = resolvedConfig.parser.parse(content, targetPath);
  if (!parseRes.valid || !parseRes.concept) {
    console.error(
      `Error: Invalid OKF document: ${parseRes.errors?.join(', ') || 'Unknown parsing error'}`
    );
    return 1;
  }

  const attestRes = evaluateAttestedComputation(parseRes.concept);
  if (attestRes.passed) {
    console.log(`[ATTESTATION READY] ${attestRes.message}`);
    return 0;
  } else {
    console.error(`[ATTESTATION FAILED] ${attestRes.message}`);
    return 1;
  }
}

async function handleGraph(
  targetPath: string,
  json: boolean,
  resolvedConfig: ResolvedOKFConfig
): Promise<number> {
  const isFs =
    'baseDir' in resolvedConfig.repository &&
    typeof (resolvedConfig.repository as unknown as { baseDir: string })
      .baseDir === 'string';

  let subpath: string | undefined;
  if (isFs) {
    try {
      const stat = await fs.stat(targetPath);
      if (!stat.isDirectory()) {
        console.error(`Error: Path is not a directory: ${targetPath}`);
        return 1;
      }
      const repoBase = (
        resolvedConfig.repository as unknown as { baseDir: string }
      ).baseDir;
      const rel = path
        .relative(repoBase, path.resolve(targetPath))
        .replace(/\\/g, '/');
      if (rel && rel !== '.' && !rel.startsWith('..')) {
        subpath = rel;
      }
    } catch {
      console.error(`Error: Path does not exist: ${targetPath}`);
      return 1;
    }
  }

  const client = new Client({
    repository: resolvedConfig.repository,
    parser: resolvedConfig.parser,
    onError: resolvedConfig.onError,
  });
  const graph = await client.buildGraph(subpath);

  if (json) {
    console.log(JSON.stringify(graph, null, 2));
    return 0;
  }

  console.log(
    `Knowledge Graph (${graph.nodes.length} nodes, ${graph.edges.length} edges):`
  );
  console.log('\nNodes:');
  for (const node of graph.nodes) {
    const title = node.frontmatter.title ? ` - ${node.frontmatter.title}` : '';
    console.log(`  - ${node.id} (${node.frontmatter.type}${title})`);
  }
  console.log('\nEdges:');
  for (const edge of graph.edges) {
    const label = edge.label ? ` [${edge.label}]` : '';
    console.log(`  - ${edge.source} -> ${edge.target}${label}`);
  }
  return 0;
}

export async function runCli(args: string[]): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args,
      options: {
        help: { type: 'boolean', short: 'h' },
        json: { type: 'boolean' },
        config: { type: 'string', short: 'c' },
        title: { type: 'string', short: 't' },
        type: { type: 'string' },
        desc: { type: 'string', short: 'd' },
        tags: { type: 'string' },
        status: { type: 'string' },
        'stale-after': { type: 'string' },
        resource: { type: 'string' },
        body: { type: 'string' },
        force: { type: 'boolean', short: 'f' },
        actor: { type: 'string' },
        'no-log': { type: 'boolean' },
      },
      allowPositionals: true,
      strict: false,
    });
  } catch (err: unknown) {
    console.error(
      `Error parsing arguments: ${err instanceof Error ? err.message : String(err)}`
    );
    printHelp();
    return 1;
  }

  const { values, positionals } = parsed;

  if (values.help || positionals.length === 0 || positionals[0] === 'help') {
    printHelp();
    return 0;
  }

  const command = positionals[0];
  const positionalPath = positionals[1];
  const configPath =
    typeof values.config === 'string' ? values.config : undefined;

  let resolvedConfig: ResolvedOKFConfig;
  try {
    resolvedConfig = await loadConfig({
      configPath,
      cwd: process.cwd(),
      command,
      targetPath:
        command === 'create' || command === 'new'
          ? undefined
          : positionalPath
            ? resolvePathFallback(positionalPath)
            : undefined,
    });
  } catch (err: unknown) {
    console.error(
      `Error loading configuration: ${err instanceof Error ? err.message : String(err)}`
    );
    return 1;
  }

  if (command === 'create' || command === 'new') {
    if (!positionalPath) {
      console.error(`Error: Missing file path for '${command}' command`);
      printHelp();
      return 1;
    }

    const createFlags: CreateFlags = {
      title: typeof values.title === 'string' ? values.title : undefined,
      type: typeof values.type === 'string' ? values.type : undefined,
      desc: typeof values.desc === 'string' ? values.desc : undefined,
      tags: typeof values.tags === 'string' ? values.tags : undefined,
      status: typeof values.status === 'string' ? values.status : undefined,
      staleAfter:
        typeof values['stale-after'] === 'string'
          ? values['stale-after']
          : undefined,
      resource:
        typeof values.resource === 'string' ? values.resource : undefined,
      body: typeof values.body === 'string' ? values.body : undefined,
      force: Boolean(values.force),
      actor: typeof values.actor === 'string' ? values.actor : undefined,
      noLog: Boolean(values['no-log']),
    };

    return await handleCreate(positionalPath, createFlags, resolvedConfig);
  }

  // Precedence: positional path overrides config roots for this invocation
  // If no positional path is provided, operate over configured roots (or default to '.')
  let targets: string[] = [];
  if (positionalPath) {
    targets = [resolvePathFallback(positionalPath)];
  } else if (resolvedConfig.roots.length > 0) {
    targets = resolvedConfig.roots.map((r) => r.resolvedPath);
  } else {
    targets = [resolvePathFallback('.')];
  }

  // Determine options with fallback to config commands
  const jsonOutput =
    Boolean(values.json) ||
    Boolean(
      resolvedConfig.commands?.graph &&
      (resolvedConfig.commands.graph as { json?: boolean }).json
    );

  let overallExitCode = 0;

  for (const targetPath of targets) {
    // If multiple targets and repo is using default FileSystemRepository, create scoped config per target
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
        command,
        targetPath,
      });
    }

    let code = 0;
    switch (command) {
      case 'validate':
        code = await handleValidate(targetPath, targetConfig);
        break;
      case 'index':
        code = await handleIndex(targetPath);
        break;
      case 'attest':
        code = await handleAttest(targetPath, targetConfig);
        break;
      case 'graph':
        code = await handleGraph(targetPath, jsonOutput, targetConfig);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        return 1;
    }
    if (code !== 0) {
      overallExitCode = code;
    }
  }

  return overallExitCode;
}
