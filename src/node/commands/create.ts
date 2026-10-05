/**
 * @fileoverview `okf create` (alias: `new`) command implementation.
 *
 * @packageDocumentation
 */

import { defineCommand } from 'citty';
import path from 'node:path';
import { Client } from '../../client.js';
import { ActorSchema } from '../../schema.js';
import { loadConfig } from '../config-loader.js';
import { resolveDefaultActor, setCliExitCode } from './common.js';

export const createCommand = defineCommand({
  meta: {
    name: 'create',
    description: 'Create a new OKF concept document (alias: okf new)',
    alias: ['new'],
  },
  args: {
    path: {
      type: 'positional',
      description: 'Concept document file path',
      required: false,
    },
    title: {
      type: 'string',
      alias: 't',
      description: 'Concept title (required)',
    },
    type: {
      type: 'string',
      description: "Concept type (default: 'concept')",
    },
    desc: {
      type: 'string',
      alias: 'd',
      description: 'Concept description',
    },
    tags: {
      type: 'string',
      description: 'Comma-separated tags',
    },
    status: {
      type: 'string',
      description:
        "Status: active | draft | deprecated | archived (default: 'active')",
    },
    'stale-after': {
      type: 'string',
      description: 'Stale expiration date (YYYY-MM-DD)',
    },
    resource: {
      type: 'string',
      description: 'Resource identifier or URI',
    },
    body: {
      type: 'string',
      description: 'Initial body markdown content',
    },
    force: {
      type: 'boolean',
      alias: 'f',
      description: 'Overwrite existing file',
    },
    actor: {
      type: 'string',
      description: 'Actor identifier for audit log (default: human:$USER)',
    },
    log: {
      type: 'boolean',
      default: true,
      description: 'Append creation to log.md',
    },
    'no-log': {
      type: 'boolean',
      description: 'Skip appending creation to log.md',
    },
    config: {
      type: 'string',
      alias: 'c',
      description: 'Path to configuration file',
    },
  },
  async run({ args, rawArgs }) {
    const targetPath =
      typeof args.path === 'string' && args.path
        ? args.path
        : typeof args._?.[0] === 'string' && args._[0]
          ? args._[0]
          : undefined;

    if (!targetPath) {
      console.error("Error: Missing file path for 'create' command");
      setCliExitCode(1);
      return 1;
    }

    if (!args.title || typeof args.title !== 'string') {
      console.error('Error: Missing required option --title, -t <title>');
      setCliExitCode(1);
      return 1;
    }

    const configPath =
      typeof args.config === 'string' ? args.config : undefined;

    let resolvedConfig;
    try {
      resolvedConfig = await loadConfig({
        configPath,
        cwd: process.cwd(),
        command: 'create',
      });
    } catch (err: unknown) {
      console.error(
        `Error loading configuration: ${err instanceof Error ? err.message : String(err)}`
      );
      setCliExitCode(1);
      return 1;
    }

    const client = new Client({
      repository: resolvedConfig.repository,
      parser: resolvedConfig.parser,
      onError: resolvedConfig.onError,
    });

    const tags = args.tags
      ? args.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    const validStatuses = [
      'active',
      'draft',
      'deprecated',
      'archived',
    ] as const;
    let status: (typeof validStatuses)[number] | undefined;
    if (args.status) {
      if (
        !validStatuses.includes(args.status as (typeof validStatuses)[number])
      ) {
        console.error(
          `Error: Invalid status '${args.status}'. Must be one of: ${validStatuses.join(', ')}`
        );
        setCliExitCode(1);
        return 1;
      }
      status = args.status as (typeof validStatuses)[number];
    }

    try {
      await client.createConcept({
        filepath: targetPath,
        title: args.title,
        type: args.type,
        description: args.desc,
        tags,
        status,
        stale_after: args['stale-after'],
        resource: args.resource,
        body: args.body,
        force: Boolean(args.force),
      });

      console.log(`[CREATED] ${targetPath}`);

      const skipLog =
        Boolean(args['no-log']) ||
        args.log === false ||
        rawArgs.includes('--no-log');
      if (!skipLog) {
        const actor = args.actor || resolveDefaultActor();
        const actorRes = ActorSchema.safeParse(actor);
        if (!actorRes.success) {
          console.error(
            `Error: Invalid actor '${actor}'. Actor must follow <role>/<version>, human:<id>, or process:<id>`
          );
          setCliExitCode(1);
          return 1;
        }
        const targetBase = path.basename(targetPath);
        await resolvedConfig.logger.append({
          actor,
          action: 'create',
          target: targetBase,
          summary: `Created concept "${args.title}"`,
        });
      }

      setCliExitCode(0);
      return 0;
    } catch (err: unknown) {
      console.error(
        `Error creating concept: ${err instanceof Error ? err.message : String(err)}`
      );
      setCliExitCode(1);
      return 1;
    }
  },
});
