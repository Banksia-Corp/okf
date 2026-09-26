import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FileSystemRepository } from '../src/node/fs-repository.js';
import { NodeFileAuditLogger } from '../src/node/file-logger.js';

describe('Node Adapter FileSystemRepository & NodeFileAuditLogger', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-node-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('FileSystemRepository', () => {
    it('prevents directory traversal outside baseDir', async () => {
      const repo = new FileSystemRepository(tmpDir);

      await expect(repo.readConcept('../outside.md')).rejects.toThrow(
        /Access outside base directory is not permitted/
      );

      await expect(
        repo.writeConcept('../../escaped.md', 'malicious')
      ).rejects.toThrow(/Access outside base directory is not permitted/);

      await expect(repo.exists('../../../etc/passwd')).rejects.toThrow(
        /Access outside base directory is not permitted/
      );
    });

    it('writes and reads concepts creating nested directories automatically', async () => {
      const repo = new FileSystemRepository(tmpDir);
      await repo.writeConcept('deeply/nested/guide.md', '# Nested Guide\n');

      expect(await repo.exists('deeply/nested/guide.md')).toBe(true);
      const content = await repo.readConcept('deeply/nested/guide.md');
      expect(content).toBe('# Nested Guide\n');
    });

    it('lists concepts in directories while ignoring index.md and log.md', async () => {
      const repo = new FileSystemRepository(tmpDir);
      await repo.writeConcept('alpha.md', 'Alpha');
      await repo.writeConcept('beta.md', 'Beta');
      await repo.writeConcept('index.md', 'Index');
      await repo.writeConcept('log.md', 'Log');
      await fs.writeFile(path.join(tmpDir, 'ignored.txt'), 'Not MD');

      const concepts = await repo.listConcepts();
      expect(concepts).toEqual(['alpha.md', 'beta.md']);
    });

    it('lists subdirectories and ignores hidden dot-directories', async () => {
      const repo = new FileSystemRepository(tmpDir);
      await repo.writeConcept('folder1/doc.md', 'Doc 1');
      await repo.writeConcept('folder2/doc.md', 'Doc 2');
      await fs.mkdir(path.join(tmpDir, '.git'), { recursive: true });

      const subdirs = await repo.listSubdirectories();
      expect(subdirs).toEqual(['folder1', 'folder2']);
    });

    it('deletes concepts safely', async () => {
      const repo = new FileSystemRepository(tmpDir);
      await repo.writeConcept('temp.md', 'Temporary');
      expect(await repo.exists('temp.md')).toBe(true);

      await repo.deleteConcept('temp.md');
      expect(await repo.exists('temp.md')).toBe(false);
    });
  });

  describe('NodeFileAuditLogger', () => {
    it('creates log.md with table header and appends entries', async () => {
      const logger = new NodeFileAuditLogger(tmpDir);
      const logFilePath = await logger.append({
        actor: 'human:luis',
        action: 'create',
        target: 'guide.md',
        summary: 'Created guide concept',
        timestamp: '2026-09-26T12:00:00.000Z',
      });

      expect(logFilePath).toBe(path.join(tmpDir, 'log.md').replace(/\\/g, '/'));
      const content = await fs.readFile(logFilePath, 'utf8');

      expect(content).toContain('# Bundle Update Log');
      expect(content).toContain(
        '| Timestamp | Actor | Action | Target | Summary |'
      );
      expect(content).toContain(
        '| 2026-09-26T12:00:00.000Z | `human:luis` | create | [guide.md](./guide.md) | Created guide concept |'
      );
    });

    it('appends multiple entries sequentially without overwriting header', async () => {
      const logger = new NodeFileAuditLogger(tmpDir);
      await logger.append({
        actor: 'process:ci',
        action: 'validate',
        target: 'bundle',
        summary: 'Passed validation',
        timestamp: '2026-09-26T12:00:00Z',
      });

      await logger.append({
        actor: 'agent/v1.0.0',
        action: 'update',
        target: 'concept.md',
        summary: 'Updated concept tags',
        timestamp: '2026-09-26T13:00:00Z',
      });

      const logContent = await fs.readFile(path.join(tmpDir, 'log.md'), 'utf8');
      const lines = logContent.trim().split('\n');

      // Header is 4 lines: # Bundle Update Log, blank line, table header, separator; plus 2 data rows = 6 lines
      expect(lines.length).toBe(6);
      expect(lines[4]).toContain('process:ci');
      expect(lines[5]).toContain('agent/v1.0.0');
    });
  });
});
