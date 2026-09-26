import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runCli } from '../src/node/cli.js';

describe('CLI Commands End-to-End Integration', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-cli-test-suite-'));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('help and option flags', () => {
    it('displays help when no command or --help is specified', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const code1 = await runCli([]);
      expect(code1).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Open Knowledge Format (OKF v0.2) CLI')
      );

      const code2 = await runCli(['--help']);
      expect(code2).toBe(0);
      logSpy.mockRestore();
    });

    it('returns error code for unknown command', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const code = await runCli(['unknown-command']);
      expect(code).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown command: unknown-command')
      );

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('validate command', () => {
    it('validates a single valid OKF markdown file', async () => {
      const validDoc = `---
type: concept
title: Valid Concept
status: active
---
# Content
Valid body.
`;
      await fs.writeFile(path.join(tmpDir, 'valid.md'), validDoc);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const code = await runCli(['validate', 'valid.md']);
      logSpy.mockRestore();

      expect(code).toBe(0);
    });

    it('returns exit code 1 for invalid frontmatter', async () => {
      const invalidDoc = `---
status: active
---
Missing type.
`;
      await fs.writeFile(path.join(tmpDir, 'invalid.md'), invalidDoc);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const code = await runCli(['validate', 'invalid.md']);
      errorSpy.mockRestore();

      expect(code).toBe(1);
    });

    it('validates directory of concepts and summarizes count', async () => {
      await fs.writeFile(
        path.join(tmpDir, 'concept1.md'),
        '---\ntype: concept\ntitle: One\n---\nBody\n'
      );
      await fs.writeFile(
        path.join(tmpDir, 'concept2.md'),
        '---\ntype: concept\ntitle: Two\n---\nBody\n'
      );

      const logs: string[] = [];
      const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.join(' '));
      });

      const code = await runCli(['validate', tmpDir]);
      logSpy.mockRestore();

      expect(code).toBe(0);
      expect(
        logs.some((l) => l.includes('Validation complete: 2 valid, 0 invalid.'))
      ).toBe(true);
    });
  });

  describe('index command', () => {
    it('generates index.md in target directory', async () => {
      await fs.writeFile(
        path.join(tmpDir, 'auth.md'),
        `---
type: security
title: Authentication
description: Authentication mechanics
---
# Auth
`
      );

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const code = await runCli(['index', tmpDir]);
      logSpy.mockRestore();

      expect(code).toBe(0);

      const indexPath = path.join(tmpDir, 'index.md');
      const content = await fs.readFile(indexPath, 'utf8');
      expect(content).toContain('# Directory Index');
      expect(content).toContain(
        '| [Authentication](./auth.md) | `security` | Authentication mechanics |'
      );
    });

    it('fails when index is targeted on a non-directory file', async () => {
      const filePath = path.join(tmpDir, 'file.md');
      await fs.writeFile(filePath, 'plain file');

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const code = await runCli(['index', filePath]);
      errorSpy.mockRestore();

      expect(code).toBe(1);
    });
  });

  describe('attest command', () => {
    it('attests a valid Attested Computation concept', async () => {
      const attestDoc = `---
type: Attested Computation
title: Run Build Verification
status: active
executor:
  type: shell
  run: pnpm test
---
Computation details.
`;
      await fs.writeFile(path.join(tmpDir, 'task.md'), attestDoc);

      const logs: string[] = [];
      const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.join(' '));
      });

      const code = await runCli(['attest', 'task.md']);
      logSpy.mockRestore();

      expect(code).toBe(0);
      expect(
        logs.some((l) =>
          l.includes(
            '[ATTESTATION READY] Attestation command ready for execution: pnpm test'
          )
        )
      ).toBe(true);
    });

    it('fails attestation if concept type is not Attested Computation', async () => {
      const plainDoc = `---
type: concept
title: Plain Concept
---
Not a computation.
`;
      await fs.writeFile(path.join(tmpDir, 'plain.md'), plainDoc);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const code = await runCli(['attest', 'plain.md']);

      expect(code).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('is not an Attested Computation')
      );
      errorSpy.mockRestore();
    });
  });

  describe('graph command', () => {
    beforeEach(async () => {
      await fs.writeFile(
        path.join(tmpDir, 'node-a.md'),
        `---
type: service
title: Node A
---
Points to [Node B](./node-b.md)
`
      );

      await fs.writeFile(
        path.join(tmpDir, 'node-b.md'),
        `---
type: database
title: Node B
---
Leaf node
`
      );
    });

    it('outputs human-readable graph representation', async () => {
      const logs: string[] = [];
      const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.join(' '));
      });

      const code = await runCli(['graph', tmpDir]);
      logSpy.mockRestore();

      expect(code).toBe(0);
      expect(
        logs.some((l) => l.includes('Knowledge Graph (2 nodes, 1 edges)'))
      ).toBe(true);
      expect(logs.some((l) => l.includes('node-a -> node-b'))).toBe(true);
    });

    it('outputs valid JSON when --json flag is provided', async () => {
      let jsonOutput = '';
      const logSpy = vi.spyOn(console, 'log').mockImplementation((output) => {
        jsonOutput = String(output);
      });

      const code = await runCli(['graph', tmpDir, '--json']);
      logSpy.mockRestore();

      expect(code).toBe(0);
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.version).toBe('0.2');
      expect(parsed.nodes).toHaveLength(2);
      expect(parsed.edges).toHaveLength(1);
      expect(parsed.edges[0].source).toBe('node-a');
      expect(parsed.edges[0].target).toBe('node-b');
    });
  });
});
