import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runCli } from '../src/node/cli.js';

describe('CLI Config Integration', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-cli-test-'));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('runs validation on configured roots when no path argument is provided', async () => {
    const docsDir = path.join(tmpDir, 'docs');
    await fs.mkdir(docsDir, { recursive: true });
    await fs.writeFile(
      path.join(docsDir, 'guide.md'),
      `---
title: Guide Concept
type: concept
status: active
---
This is a valid concept.
`
    );

    const configPath = path.join(tmpDir, 'okf.config.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        roots: ['./docs'],
      })
    );

    process.chdir(tmpDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await runCli(['validate']);
    logSpy.mockRestore();

    expect(exitCode).toBe(0);
  });

  it('prioritizes explicit positional CLI argument over config roots', async () => {
    const customDir = path.join(tmpDir, 'custom');
    await fs.mkdir(customDir, { recursive: true });
    await fs.writeFile(
      path.join(customDir, 'item.md'),
      `---
title: Item Concept
type: concept
status: active
---
Content
`
    );

    const configPath = path.join(tmpDir, 'okf.config.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        roots: ['./non-existent-roots-dir'],
      })
    );

    process.chdir(tmpDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Explicit positional path should override non-existent config roots
    const exitCode = await runCli(['validate', './custom']);
    logSpy.mockRestore();

    expect(exitCode).toBe(0);
  });

  it('supports --config / -c option', async () => {
    const customConfigDir = path.join(tmpDir, 'nested');
    await fs.mkdir(customConfigDir, { recursive: true });
    const docsDir = path.join(tmpDir, 'docs');
    await fs.mkdir(docsDir, { recursive: true });
    await fs.writeFile(
      path.join(docsDir, 'item.md'),
      `---
title: Item
type: concept
status: active
---
Content
`
    );

    const customConfigPath = path.join(customConfigDir, 'custom.json');
    await fs.writeFile(
      customConfigPath,
      JSON.stringify({
        roots: ['../docs'],
      })
    );

    process.chdir(tmpDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await runCli(['validate', '-c', './nested/custom.json']);
    logSpy.mockRestore();

    expect(exitCode).toBe(0);
  });

  it('executes in-memory repository from okf.config.ts without disk files', async () => {
    const configPath = path.join(tmpDir, 'okf.config.ts');
    const tsConfig = `
      import { InMemoryRepository } from '${path.resolve(process.cwd(), 'src/repository.ts')}';
      export default {
        repository: new InMemoryRepository({
          'virtual.md': \`---
title: Virtual Concept
type: concept
status: active
---
Virtual body content
\`
        })
      };
    `;
    await fs.writeFile(configPath, tsConfig);

    process.chdir(tmpDir);

    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    const exitCode = await runCli(['validate']);
    logSpy.mockRestore();

    expect(exitCode).toBe(0);
    expect(logs.some((l) => l.includes('[VALID] virtual.md'))).toBe(true);
  });
});
