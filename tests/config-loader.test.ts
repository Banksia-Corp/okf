import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { findConfigFile, loadConfig } from '../src/node/config-loader.js';
import { normalizeKnowledgeRoots } from '../src/config.js';

describe('Config Loader & Roots Normalization', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-config-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('normalizeKnowledgeRoots', () => {
    it('normalizes string definition', () => {
      const roots = normalizeKnowledgeRoots('./docs', (p) => `/base/${p}`);
      expect(roots).toEqual([
        {
          path: './docs',
          resolvedPath: '/base/./docs',
        },
      ]);
    });

    it('normalizes array of strings and objects', () => {
      const roots = normalizeKnowledgeRoots(
        ['./docs', { path: './rfcs', name: 'rfcs', description: 'RFC specs' }],
        (p) => `/base/${p}`
      );
      expect(roots).toEqual([
        {
          path: './docs',
          resolvedPath: '/base/./docs',
        },
        {
          name: 'rfcs',
          path: './rfcs',
          resolvedPath: '/base/./rfcs',
          description: 'RFC specs',
          options: undefined,
        },
      ]);
    });

    it('normalizes record/dictionary format', () => {
      const roots = normalizeKnowledgeRoots(
        {
          docs: './docs',
          rfcs: { path: './specs/rfcs', description: 'RFC specs' },
        },
        (p) => `/base/${p}`
      );
      expect(roots).toEqual([
        {
          name: 'docs',
          path: './docs',
          resolvedPath: '/base/./docs',
        },
        {
          name: 'rfcs',
          path: './specs/rfcs',
          resolvedPath: '/base/./specs/rfcs',
          description: 'RFC specs',
          options: undefined,
        },
      ]);
    });
  });

  describe('findConfigFile', () => {
    it('finds config in current directory', async () => {
      const configPath = path.join(tmpDir, 'okf.config.json');
      await fs.writeFile(configPath, JSON.stringify({ roots: './docs' }));

      const found = findConfigFile(tmpDir);
      expect(found).toBe(configPath);
    });

    it('finds config in parent directory up to monorepo boundary', async () => {
      const monorepoRoot = path.join(tmpDir, 'repo');
      const subDir = path.join(monorepoRoot, 'packages', 'pkg-a');
      await fs.mkdir(subDir, { recursive: true });

      // Create .git boundary
      await fs.mkdir(path.join(monorepoRoot, '.git'));
      const configPath = path.join(monorepoRoot, '.okfrc.json');
      await fs.writeFile(configPath, JSON.stringify({ roots: './docs' }));

      const found = findConfigFile(subDir);
      expect(found).toBe(configPath);
    });

    it('stops at .git boundary and does not escape repo root', async () => {
      const outerDir = tmpDir;
      const repoDir = path.join(tmpDir, 'repo');
      const innerDir = path.join(repoDir, 'sub');
      await fs.mkdir(innerDir, { recursive: true });
      await fs.mkdir(path.join(repoDir, '.git'));

      // Config outside repo
      await fs.writeFile(
        path.join(outerDir, 'okf.config.json'),
        JSON.stringify({ roots: './outer' })
      );

      const found = findConfigFile(innerDir);
      expect(found).toBeNull();
    });
  });

  describe('loadConfig - JSON Config', () => {
    it('loads and validates okf.config.json', async () => {
      const configPath = path.join(tmpDir, 'okf.config.json');
      await fs.writeFile(
        configPath,
        JSON.stringify({
          roots: ['./knowledge', './specs'],
          commands: {
            graph: { json: true },
          },
        })
      );

      const resolved = await loadConfig({ cwd: tmpDir });
      expect(resolved.configPath).toBe(configPath);
      expect(resolved.roots).toHaveLength(2);
      expect(resolved.roots[0].resolvedPath).toBe(
        path.resolve(tmpDir, './knowledge')
      );
      expect(resolved.commands?.graph?.json).toBe(true);
    });

    it('throws on invalid JSON config schema', async () => {
      const configPath = path.join(tmpDir, 'okf.config.json');
      await fs.writeFile(
        configPath,
        JSON.stringify({
          roots: 12345, // invalid
        })
      );

      await expect(loadConfig({ cwd: tmpDir })).rejects.toThrow(
        /Invalid configuration/
      );
    });
  });

  describe('loadConfig - TypeScript/JavaScript Config with Jiti', () => {
    it('evaluates okf.config.ts with custom abstractions', async () => {
      const configPath = path.join(tmpDir, 'okf.config.ts');
      const tsContent = `
        import { defineConfig } from '${path.resolve(process.cwd(), 'src/config.ts')}';
        import { InMemoryRepository } from '${path.resolve(process.cwd(), 'src/repository.ts')}';

        export default defineConfig({
          roots: {
            docs: './docs'
          },
          repository: new InMemoryRepository({
            'concept.md': '---\\ntitle: Concept\\ntype: concept\\n---\\nContent'
          })
        });
      `;
      await fs.writeFile(configPath, tsContent);

      const resolved = await loadConfig({ cwd: tmpDir });
      expect(resolved.configPath).toBe(configPath);
      expect(resolved.roots).toHaveLength(1);
      expect(typeof resolved.repository.readConcept).toBe('function');
      expect(await resolved.repository.exists('concept.md')).toBe(true);
      expect(await resolved.repository.readConcept('concept.md')).toContain(
        'title: Concept'
      );
    });

    it('evaluates function/factory config with ConfigContext', async () => {
      const configPath = path.join(tmpDir, 'okf.config.js');
      const jsContent = `
        export default (context) => ({
          roots: './docs',
          commands: {
            validate: { strict: context.command === 'validate' }
          }
        });
      `;
      await fs.writeFile(configPath, jsContent);

      const resolved = await loadConfig({
        cwd: tmpDir,
        command: 'validate',
      });
      expect(resolved.commands?.validate?.strict).toBe(true);
    });

    it('evaluates pluggable abstraction factories with ConfigContext', async () => {
      const configPath = path.join(tmpDir, 'okf.config.ts');
      const tsContent = `
        import { InMemoryRepository } from '${path.resolve(process.cwd(), 'src/repository.ts')}';

        export default {
          repository: async (context) => {
            return new InMemoryRepository({
              'target.md': context.targetPath || 'default'
            });
          }
        };
      `;
      await fs.writeFile(configPath, tsContent);

      const resolved = await loadConfig({
        cwd: tmpDir,
        targetPath: 'custom-target',
      });
      expect(await resolved.repository.readConcept('target.md')).toBe(
        'custom-target'
      );
    });
  });
});
