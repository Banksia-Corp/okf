/**
 * @fileoverview `okf graph` command implementation.
 *
 * @packageDocumentation
 */

import { defineCommand } from 'citty';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from '../../client.js';
import { loadConfig } from '../config-loader.js';
import {
  resolvePathFallback,
  resolveTargets,
  setCliExitCode,
} from './common.js';

export const graphCommand = defineCommand({
  meta: {
    name: 'graph',
    description: 'Generate and display knowledge graph',
  },
  args: {
    dir: {
      type: 'positional',
      description: 'Directory path to render graph for',
      required: false,
    },
    json: {
      type: 'boolean',
      description: 'Output graph as JSON',
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
        command: 'graph',
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

    const jsonOutput =
      Boolean(args.json) ||
      Boolean(
        resolvedConfig.commands?.graph &&
        (resolvedConfig.commands.graph as { json?: boolean }).json
      );

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
          command: 'graph',
          targetPath,
        });
      }

      const isFs =
        'baseDir' in targetConfig.repository &&
        typeof (targetConfig.repository as unknown as { baseDir: string })
          .baseDir === 'string';

      let subpath: string | undefined;
      if (isFs) {
        try {
          const stat = await fs.stat(targetPath);
          if (!stat.isDirectory()) {
            console.error(`Error: Path is not a directory: ${targetPath}`);
            overallExitCode = 1;
            continue;
          }
          const repoBase = (
            targetConfig.repository as unknown as { baseDir: string }
          ).baseDir;
          const rel = path
            .relative(repoBase, path.resolve(targetPath))
            .replace(/\\/g, '/');
          if (rel && rel !== '.' && !rel.startsWith('..')) {
            subpath = rel;
          }
        } catch {
          console.error(`Error: Path does not exist: ${targetPath}`);
          overallExitCode = 1;
          continue;
        }
      }

      const client = new Client({
        repository: targetConfig.repository,
        parser: targetConfig.parser,
        onError: targetConfig.onError,
      });
      const graph = await client.buildGraph(subpath);

      if (jsonOutput) {
        console.log(JSON.stringify(graph, null, 2));
        continue;
      }

      console.log(
        `Knowledge Graph (${graph.nodes.length} nodes, ${graph.edges.length} edges):`
      );
      console.log('\nNodes:');
      for (const node of graph.nodes) {
        const title = node.frontmatter.title
          ? ` - ${node.frontmatter.title}`
          : '';
        console.log(`  - ${node.id} (${node.frontmatter.type}${title})`);
      }
      console.log('\nEdges:');
      for (const edge of graph.edges) {
        const label = edge.label ? ` [${edge.label}]` : '';
        console.log(`  - ${edge.source} -> ${edge.target}${label}`);
      }
    }

    setCliExitCode(overallExitCode);
    return overallExitCode;
  },
});
