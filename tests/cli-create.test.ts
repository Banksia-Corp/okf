import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runCli } from '../src/node/cli.js';
import { parseConceptContent } from '../src/parser.js';

describe('CLI Create Command Integration', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-cli-create-test-'));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails if --title is omitted', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli(['create', 'test.md']);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Missing required option --title')
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('fails if target file path is omitted', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli(['create', '--title', 'Some Title']);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing file path for 'create' command")
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('scaffolds a valid concept with minimal parameters (default type: concept)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli([
      'create',
      'concepts/my-concept.md',
      '--title',
      'My First Concept',
    ]);

    expect(exitCode).toBe(0);

    const filePath = path.join(tmpDir, 'concepts/my-concept.md');
    const content = await fs.readFile(filePath, 'utf8');

    const parsed = parseConceptContent(content, 'concepts/my-concept.md');
    expect(parsed.valid).toBe(true);
    expect(parsed.concept?.frontmatter.title).toBe('My First Concept');
    expect(parsed.concept?.frontmatter.type).toBe('concept');
    expect(parsed.concept?.frontmatter.status).toBe('active');
    expect(parsed.concept?.body).toContain('# My First Concept');

    // Default audit log verification
    const logPath = path.join(tmpDir, 'log.md');
    const logContent = await fs.readFile(logPath, 'utf8');
    expect(logContent).toContain('my-concept.md');
    expect(logContent).toContain('create');
    expect(logContent).toContain('Created concept "My First Concept"');

    logSpy.mockRestore();
  });

  it('scaffolds a concept with alias "new" and custom metadata flags', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli([
      'new',
      'docs/guide.md',
      '--title',
      'Architecture Guide',
      '--type',
      'guide',
      '--desc',
      'Core architecture patterns',
      '--tags',
      'arch,patterns,core',
      '--status',
      'draft',
      '--stale-after',
      '2026-12-31',
      '--resource',
      'https://example.com/guide',
      '--body',
      '# Architecture Guide\n\nCustom body content.',
    ]);

    expect(exitCode).toBe(0);

    const filePath = path.join(tmpDir, 'docs/guide.md');
    const content = await fs.readFile(filePath, 'utf8');

    const parsed = parseConceptContent(content, 'docs/guide.md');
    expect(parsed.valid).toBe(true);
    expect(parsed.concept?.frontmatter.title).toBe('Architecture Guide');
    expect(parsed.concept?.frontmatter.type).toBe('guide');
    expect(parsed.concept?.frontmatter.description).toBe(
      'Core architecture patterns'
    );
    expect(parsed.concept?.frontmatter.tags).toEqual([
      'arch',
      'patterns',
      'core',
    ]);
    expect(parsed.concept?.frontmatter.status).toBe('draft');
    expect(parsed.concept?.frontmatter.stale_after).toBe('2026-12-31');
    expect(parsed.concept?.frontmatter.resource).toBe(
      'https://example.com/guide'
    );
    expect(parsed.concept?.body).toBe(
      '# Architecture Guide\n\nCustom body content.'
    );

    logSpy.mockRestore();
  });

  it('prevents accidental file overwrite unless --force / -f is specified', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // First creation succeeds
    const exitCode1 = await runCli([
      'create',
      'sample.md',
      '--title',
      'Original',
    ]);
    expect(exitCode1).toBe(0);

    // Second creation without --force fails
    const exitCode2 = await runCli([
      'create',
      'sample.md',
      '--title',
      'Overwritten',
    ]);
    expect(exitCode2).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('already exists')
    );

    // File content remains original
    let content = await fs.readFile(path.join(tmpDir, 'sample.md'), 'utf8');
    expect(content).toContain('title: Original');

    // Third creation with --force succeeds
    const exitCode3 = await runCli([
      'create',
      'sample.md',
      '--title',
      'Overwritten',
      '--force',
    ]);
    expect(exitCode3).toBe(0);

    content = await fs.readFile(path.join(tmpDir, 'sample.md'), 'utf8');
    expect(content).toContain('title: Overwritten');

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('bypasses audit logging when --no-log is passed', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli([
      'create',
      'nolog.md',
      '--title',
      'No Log Concept',
      '--no-log',
    ]);
    expect(exitCode).toBe(0);

    const logPath = path.join(tmpDir, 'log.md');
    let logExists = true;
    try {
      await fs.access(logPath);
    } catch {
      logExists = false;
    }
    expect(logExists).toBe(false);

    logSpy.mockRestore();
  });

  it('customizes audit log actor with --actor', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli([
      'create',
      'authored.md',
      '--title',
      'Authored Doc',
      '--actor',
      'process:generator-v1',
    ]);
    expect(exitCode).toBe(0);

    const logPath = path.join(tmpDir, 'log.md');
    const logContent = await fs.readFile(logPath, 'utf8');
    expect(logContent).toContain('`process:generator-v1`');

    logSpy.mockRestore();
  });

  it('validates status flag enum values', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli([
      'create',
      'invalid-status.md',
      '--title',
      'Invalid Status',
      '--status',
      'non-existent-status',
    ]);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid status 'non-existent-status'")
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('validates frontmatter schema rules (e.g. invalid stale_after date)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli([
      'create',
      'invalid-date.md',
      '--title',
      'Invalid Date',
      '--stale-after',
      'not-a-date',
    ]);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('stale_after: Date must follow YYYY-MM-DD format')
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('creates concept in custom configured repository (e.g. InMemoryRepository)', async () => {
    const configPath = path.join(tmpDir, 'okf.config.ts');
    const repoPath = path.resolve(originalCwd, 'src/repository.ts');
    const tsConfig = `
      import { InMemoryRepository } from '${repoPath}';
      export default {
        repository: new InMemoryRepository()
      };
    `;
    await fs.writeFile(configPath, tsConfig);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli([
      'create',
      'virtual-created.md',
      '--title',
      'Virtual Scaffolding',
      '--no-log',
    ]);

    expect(exitCode).toBe(0);

    logSpy.mockRestore();
  });
});
