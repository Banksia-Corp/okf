import { parseArgs } from 'node:util';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { FileSystemRepository } from './fs-repository.js';
import { Client } from '../client.js';
import { writeDirectoryIndex } from './index.js';
import { evaluateAttestedComputation } from '../attester.js';
import { parseConceptContent } from '../parser.js';

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
  okf validate <path>       Validate OKF frontmatter schema in a file or directory
  okf index <dir>           Generate or update directory index.md
  okf attest <file>         Evaluate Attested Computation concept
  okf graph <dir> [--json]  Generate and display knowledge graph
  okf --help, -h            Show this help message
`);
}

async function handleValidate(targetPath: string): Promise<number> {
  let stat;
  try {
    stat = await fs.stat(targetPath);
  } catch {
    console.error(`Error: Path does not exist: ${targetPath}`);
    return 1;
  }

  if (stat.isFile()) {
    const content = await fs.readFile(targetPath, 'utf8');
    const res = parseConceptContent(content, targetPath);
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

  if (stat.isDirectory()) {
    const errors: { path: string; error: unknown }[] = [];
    const repo = new FileSystemRepository(targetPath);
    const client = new Client({
      repository: repo,
      onError: (filePath, error) => {
        errors.push({ path: filePath, error });
      },
    });

    const concepts = await client.listAllConcepts();

    for (const c of concepts) {
      console.log(
        `[VALID] ${path.join(targetPath, c.filepath).replace(/\\/g, '/')}`
      );
    }
    for (const e of errors) {
      const msg = e.error instanceof Error ? e.error.message : String(e.error);
      console.error(
        `[INVALID] ${path.join(targetPath, e.path).replace(/\\/g, '/')}: ${msg}`
      );
    }

    console.log(
      `\nValidation complete: ${concepts.length} valid, ${errors.length} invalid.`
    );
    return errors.length > 0 ? 1 : 0;
  }

  console.error(`Error: Path is neither a file nor a directory: ${targetPath}`);
  return 1;
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

async function handleAttest(targetPath: string): Promise<number> {
  let stat;
  try {
    stat = await fs.stat(targetPath);
  } catch {
    console.error(`Error: File does not exist: ${targetPath}`);
    return 1;
  }

  if (!stat.isFile()) {
    console.error(`Error: Path is not a file: ${targetPath}`);
    return 1;
  }

  const content = await fs.readFile(targetPath, 'utf8');
  const parseRes = parseConceptContent(content, targetPath);
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

async function handleGraph(targetPath: string, json: boolean): Promise<number> {
  let stat;
  try {
    stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      console.error(`Error: Path is not a directory: ${targetPath}`);
      return 1;
    }
  } catch {
    console.error(`Error: Path does not exist: ${targetPath}`);
    return 1;
  }

  const repo = new FileSystemRepository(targetPath);
  const client = new Client({ repository: repo });
  const graph = await client.buildGraph();

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
  let targetPath = positionals[1] || '.';
  targetPath = resolvePathFallback(targetPath);

  switch (command) {
    case 'validate':
      return await handleValidate(targetPath);
    case 'index':
      return await handleIndex(targetPath);
    case 'attest':
      return await handleAttest(targetPath);
    case 'graph':
      return await handleGraph(targetPath, Boolean(values.json));
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      return 1;
  }
}
