import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  installSkill,
  resolveTargetDir,
  resolveSourceSkillDir,
} from '../src/node/skill-installer.js';
import { runCli } from '../src/node/cli.js';

describe('Skill Installer and CLI Subcommand', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-skill-test-suite-'));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('resolveSourceSkillDir', () => {
    it('locates the bundled skills/okf directory', () => {
      const srcDir = resolveSourceSkillDir();
      expect(fsSync.existsSync(srcDir)).toBe(true);
      expect(fsSync.existsSync(path.join(srcDir, 'SKILL.md'))).toBe(true);
    });
  });

  describe('resolveTargetDir', () => {
    it('resolves explicit destination path', () => {
      const dest = resolveTargetDir({
        dest: 'my-custom-skills/okf',
        cwd: tmpDir,
      });
      expect(dest).toBe(path.resolve(tmpDir, 'my-custom-skills/okf'));
    });

    it('resolves claude agent preset', () => {
      const dest = resolveTargetDir({
        agent: 'claude',
        cwd: tmpDir,
      });
      expect(dest).toBe(path.resolve(tmpDir, '.claude/skills/okf'));
    });

    it('resolves generic agent preset', () => {
      const dest = resolveTargetDir({
        agent: 'generic',
        cwd: tmpDir,
      });
      expect(dest).toBe(path.resolve(tmpDir, '.agents/skills/okf'));
    });

    it('resolves global destination when --global flag is passed', () => {
      const homedir = os.homedir();
      const destGemini = resolveTargetDir({
        global: true,
        agent: 'gemini',
        cwd: tmpDir,
      });
      expect(destGemini).toBe(
        path.join(homedir, '.gemini/antigravity/skills/okf')
      );

      const destClaude = resolveTargetDir({
        global: true,
        agent: 'claude',
        cwd: tmpDir,
      });
      expect(destClaude).toBe(path.join(homedir, '.claude/skills/okf'));

      const destGeneric = resolveTargetDir({
        global: true,
        agent: 'generic',
        cwd: tmpDir,
      });
      expect(destGeneric).toBe(path.join(homedir, '.agents/skills/okf'));
    });

    it('auto-detects existing .agents/skills directory in workspace', async () => {
      await fs.mkdir(path.join(tmpDir, '.agents/skills'), { recursive: true });
      const dest = resolveTargetDir({ cwd: tmpDir });
      expect(dest).toBe(path.join(tmpDir, '.agents/skills/okf'));
    });

    it('falls back to .gemini/skills/okf if no existing skills folder found', () => {
      const dest = resolveTargetDir({ cwd: tmpDir });
      expect(dest).toBe(path.resolve(tmpDir, '.gemini/skills/okf'));
    });
  });

  describe('installSkill core logic', () => {
    it('performs dry-run without writing files', async () => {
      const targetDir = path.join(tmpDir, 'dry-run-target');
      const result = await installSkill({
        dest: targetDir,
        dryRun: true,
        cwd: tmpDir,
      });

      expect(result.dryRun).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files).toContain('SKILL.md');
      expect(fsSync.existsSync(targetDir)).toBe(false);
    });

    it('installs all skill files, references, and templates to target directory', async () => {
      const targetDir = path.join(tmpDir, 'installed-skill');
      const result = await installSkill({
        dest: targetDir,
        cwd: tmpDir,
      });

      expect(result.dryRun).toBe(false);
      expect(fsSync.existsSync(targetDir)).toBe(true);
      expect(fsSync.existsSync(path.join(targetDir, 'SKILL.md'))).toBe(true);
      expect(
        fsSync.existsSync(path.join(targetDir, 'references/schema-spec.md'))
      ).toBe(true);
      expect(
        fsSync.existsSync(path.join(targetDir, 'references/cli-reference.md'))
      ).toBe(true);
      expect(
        fsSync.existsSync(path.join(targetDir, 'references/attestation.md'))
      ).toBe(true);
      expect(
        fsSync.existsSync(path.join(targetDir, 'assets/templates/concept.md'))
      ).toBe(true);
      expect(
        fsSync.existsSync(path.join(targetDir, 'assets/templates/decision.md'))
      ).toBe(true);
      expect(
        fsSync.existsSync(
          path.join(targetDir, 'assets/templates/attestation.md')
        )
      ).toBe(true);
    });

    it('throws error when target exists without force flag', async () => {
      const targetDir = path.join(tmpDir, 'existing-skill');
      await fs.mkdir(targetDir, { recursive: true });

      await expect(
        installSkill({
          dest: targetDir,
          force: false,
          cwd: tmpDir,
        })
      ).rejects.toThrow('Target skill directory already exists');
    });

    it('overwrites existing files when force: true is specified', async () => {
      const targetDir = path.join(tmpDir, 'overwrite-skill');
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(path.join(targetDir, 'SKILL.md'), 'old content');

      const result = await installSkill({
        dest: targetDir,
        force: true,
        cwd: tmpDir,
      });

      expect(result.dryRun).toBe(false);
      const updated = await fs.readFile(
        path.join(targetDir, 'SKILL.md'),
        'utf8'
      );
      expect(updated).not.toBe('old content');
      expect(updated).toContain('name: okf');
    });
  });

  describe('CLI Command Integration: okf skill', () => {
    it('installs skill via `okf skill install` with --dest', async () => {
      const targetDest = path.join(tmpDir, 'cli-skill-dest');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const exitCode = await runCli(['skill', 'install', '--dest', targetDest]);

      logSpy.mockRestore();

      expect(exitCode).toBe(0);
      expect(fsSync.existsSync(path.join(targetDest, 'SKILL.md'))).toBe(true);
    });

    it('supports positional destination `okf skill install <dir>`', async () => {
      const targetDest = path.join(tmpDir, 'cli-positional-dest');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const exitCode = await runCli(['skill', 'install', targetDest]);

      logSpy.mockRestore();

      expect(exitCode).toBe(0);
      expect(fsSync.existsSync(path.join(targetDest, 'SKILL.md'))).toBe(true);
    });

    it('supports dry-run via CLI', async () => {
      const targetDest = path.join(tmpDir, 'cli-dryrun');
      const logs: string[] = [];
      const logSpy = vi.spyOn(console, 'log').mockImplementation((...msg) => {
        logs.push(msg.join(' '));
      });

      const exitCode = await runCli([
        'skill',
        'install',
        '--dest',
        targetDest,
        '--dry-run',
      ]);

      logSpy.mockRestore();

      expect(exitCode).toBe(0);
      expect(fsSync.existsSync(targetDest)).toBe(false);
      expect(logs.some((l) => l.includes('[DRY-RUN]'))).toBe(true);
    });

    it('returns error code 1 when target already exists without --force', async () => {
      const targetDest = path.join(tmpDir, 'cli-existing');
      await fs.mkdir(targetDest, { recursive: true });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const exitCode = await runCli(['skill', 'install', '--dest', targetDest]);

      errorSpy.mockRestore();

      expect(exitCode).toBe(1);
    });
  });

  describe('Trigger Evaluation Queries Verification', () => {
    it('ensures tests/skill-eval-queries.json conforms to benchmark requirements', async () => {
      const evalPath = path.resolve(
        __dirname,
        '../tests/skill-eval-queries.json'
      );
      const content = JSON.parse(await fs.readFile(evalPath, 'utf8'));

      expect(content.train).toBeDefined();
      expect(content.validation).toBeDefined();

      const trainList = content.train;
      const valList = content.validation;

      // 60/40 train/val split (12 train, 8 validation = 20 total)
      expect(trainList.length).toBe(12);
      expect(valList.length).toBe(8);

      const all = [...trainList, ...valList];
      expect(all.length).toBe(20);

      const shouldTrigger = all.filter((q) => q.should_trigger);
      const shouldNotTrigger = all.filter((q) => !q.should_trigger);

      expect(shouldTrigger.length).toBe(10);
      expect(shouldNotTrigger.length).toBe(10);

      // Verify each query has query, should_trigger, intent
      for (const item of all) {
        expect(typeof item.query).toBe('string');
        expect(typeof item.should_trigger).toBe('boolean');
        expect(typeof item.intent).toBe('string');
      }
    });
  });
});
