import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  sanitizeMarkdownCell,
  ActorSchema,
  GeneratedSchema,
  VerifiedEntrySchema,
} from '../src/schema.js';
import { InMemoryRepository } from '../src/repository.js';
import { FileSystemRepository } from '../src/node/fs-repository.js';
import { NodeFileAuditLogger } from '../src/node/file-logger.js';
import { generateIndexMarkdown } from '../src/indexer.js';
import { resolveRelativePosix } from '../src/graph.js';
import { Client } from '../src/client.js';
import { runCli } from '../src/node/cli.js';
import { loadConfig } from '../src/node/config-loader.js';

describe('Security & Architecture Audit Verification', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-audit-test-'));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('OWASP A03: Injection & Sanitization', () => {
    it('sanitizes pipe characters and carriage returns/newlines', () => {
      const raw = 'Title with | pipe\r\nand newline | characters';
      const sanitized = sanitizeMarkdownCell(raw);
      expect(sanitized).toBe('Title with \\| pipe and newline \\| characters');
      expect(sanitized.includes('\n')).toBe(false);
      expect(sanitized.includes('\r')).toBe(false);
    });

    it('neutralizes log injection attacks in NodeFileAuditLogger', async () => {
      const logger = new NodeFileAuditLogger(tmpDir);
      const forgedPayload =
        'Fake title"\n| 2020-01-01T00:00:00Z | `human:hacker` | wipe | [all.md](./all.md) | Injected Log Row |';

      await logger.append({
        actor: 'human:alice',
        action: 'create',
        target: 'doc.md',
        summary: forgedPayload,
      });

      const logContent = await fs.readFile(path.join(tmpDir, 'log.md'), 'utf8');
      const lines = logContent.trim().split('\n');

      // Header is 3 lines (# Bundle Update Log, empty line, table header, table separator = 4 lines total)
      // Exactly 1 appended row must exist; no additional rows injected
      const dataRows = lines.filter((l) => l.startsWith('| 20'));
      expect(dataRows).toHaveLength(1);
      expect(dataRows[0]).toContain('Fake title"');
      expect(dataRows[0]).toContain('\\| Injected Log Row \\|');
    });

    it('sanitizes Markdown table cells in generateIndexMarkdown', () => {
      const markdown = generateIndexMarkdown({
        subdirs: ['sub|dir\nbreak'],
        concepts: [
          {
            id: 'concept-1',
            filepath: 'concept-1.md',
            frontmatter: {
              type: 'concept',
              title: 'Concept | Break\nRow',
              description: 'Desc with | pipe\nand newline',
            },
            body: 'Body',
          },
        ],
      });

      expect(markdown).toContain('[Concept \\| Break Row]');
      expect(markdown).toContain('Desc with \\| pipe and newline');
      expect(markdown).toContain('[sub\\|dir break/]');
      // Ensure all rows have correct table pipe structure
      const tableLines = markdown
        .split('\n')
        .filter((l) => l.startsWith('| ['));
      expect(tableLines).toHaveLength(1);
    });
  });

  describe('OWASP A01: Access Control & Path Traversal', () => {
    it('prevents symlink-based directory escape in FileSystemRepository', async () => {
      const repoDir = path.join(tmpDir, 'repo');
      const secretDir = path.join(tmpDir, 'secret');
      await fs.mkdir(repoDir, { recursive: true });
      await fs.mkdir(secretDir, { recursive: true });

      const secretFile = path.join(secretDir, 'secret.txt');
      await fs.writeFile(secretFile, 'super-secret-content', 'utf8');

      // Create symlink inside repo pointing outside to secretDir
      const symlinkPath = path.join(repoDir, 'linked-secret');
      await fs.symlink(secretDir, symlinkPath, 'dir');

      const repo = new FileSystemRepository(repoDir);

      await expect(
        repo.readConcept('linked-secret/secret.txt')
      ).rejects.toThrow(
        /Access outside base directory via symlink is not permitted/
      );
    });

    it('guards resolveRelativePosix against popping beyond root boundary', () => {
      // From root file, link attempting to escape root
      const resolved = resolveRelativePosix('root.md', '../../escaped.md');
      expect(resolved).toBe('../../escaped');

      // From deep path, valid relative navigation
      const resolvedDeep = resolveRelativePosix(
        'concepts/core/item.md',
        '../utils/helper.md'
      );
      expect(resolvedDeep).toBe('concepts/utils/helper');
    });
  });

  describe('OWASP A04: Schema Validation for Actors and Dates', () => {
    it('strictly validates ActorSchema format', () => {
      expect(ActorSchema.safeParse('human:luis').success).toBe(true);
      expect(ActorSchema.safeParse('process:indexer-v1').success).toBe(true);
      expect(ActorSchema.safeParse('bot/v1.0').success).toBe(true);

      expect(ActorSchema.safeParse('invalid-actor-format').success).toBe(false);
      expect(ActorSchema.safeParse('human:with spaces').success).toBe(false);
    });

    it('enforces ActorSchema and IsoDateTimeSchema in GeneratedSchema and VerifiedEntrySchema', () => {
      const validGen = GeneratedSchema.safeParse({
        by: 'human:alice',
        at: '2026-09-26T12:00:00Z',
      });
      expect(validGen.success).toBe(true);

      const invalidGenActor = GeneratedSchema.safeParse({
        by: 'not-an-actor',
        at: '2026-09-26T12:00:00Z',
      });
      expect(invalidGenActor.success).toBe(false);

      const invalidGenDate = GeneratedSchema.safeParse({
        by: 'human:alice',
        at: 'yesterday',
      });
      expect(invalidGenDate.success).toBe(false);

      const validVerified = VerifiedEntrySchema.safeParse({
        by: 'process:validator-1',
        at: '2026-09-26T12:00:00Z',
        tier: 'machine-confirmed',
      });
      expect(validVerified.success).toBe(true);
    });

    it('fails okf create when given an invalid --actor', async () => {
      process.chdir(tmpDir);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const exitCode = await runCli([
        'create',
        'invalid-actor.md',
        '--title',
        'Invalid Actor Doc',
        '--actor',
        'malicious|actor',
      ]);

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid actor 'malicious|actor'")
      );
      errorSpy.mockRestore();
    });
  });

  describe('SOLID Principles & Architecture', () => {
    it('implements queryConcepts on InMemoryRepository', async () => {
      const repo = new InMemoryRepository({
        'c1.md': `---
title: Doc One
type: concept
status: active
tags: [core]
---
Content 1`,
        'c2.md': `---
title: Doc Two
type: guide
status: draft
tags: [guide]
---
Content 2`,
      });

      const active = await repo.queryConcepts({ status: 'active' });
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('c1');

      const byType = await repo.queryConcepts({ type: 'guide' });
      expect(byType).toHaveLength(1);
      expect(byType[0].id).toBe('c2');
    });

    it('implements queryConcepts on FileSystemRepository', async () => {
      const repoDir = path.join(tmpDir, 'fs-repo');
      await fs.mkdir(repoDir, { recursive: true });
      await fs.writeFile(
        path.join(repoDir, 'c1.md'),
        `---
title: FS Doc 1
type: concept
status: active
---
FS Content`
      );

      const repo = new FileSystemRepository(repoDir);
      const active = await repo.queryConcepts({ status: 'active' });
      expect(active).toHaveLength(1);
      expect(active[0].frontmatter.title).toBe('FS Doc 1');
    });

    it('Client.findConcepts delegates to repository.queryConcepts', async () => {
      const repo = new InMemoryRepository({
        'doc.md': `---
title: Delegated
type: concept
status: active
---
Content`,
      });

      const spy = vi.spyOn(repo, 'queryConcepts');
      const client = new Client({ repository: repo });

      const results = await client.findConcepts({ status: 'active' });
      expect(results).toHaveLength(1);
      expect(spy).toHaveBeenCalledWith({ status: 'active' });
      spy.mockRestore();
    });

    it('enforces static schema validation on okf.config.ts via loadConfig', async () => {
      const configPath = path.join(tmpDir, 'okf.config.ts');
      // roots must not be a number
      await fs.writeFile(configPath, 'export default { roots: 99999 };');

      await expect(loadConfig({ cwd: tmpDir })).rejects.toThrow(
        /Invalid configuration/
      );
    });
  });
});
