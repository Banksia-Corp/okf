/**
 * @fileoverview Node.js installer for the official OKF Agent Skill (`skills/okf`).
 *
 * Copies bundled skill templates and instructions into project-local or user-global
 * skill directories with platform awareness (Gemini, Claude, generic).
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * Supported agent platforms for skill presets.
 */
export type AgentPlatform = 'antigravity' | 'gemini' | 'claude' | 'generic';

/**
 * Options passed to {@link installSkill}.
 */
export interface InstallSkillOptions {
  /**
   * Custom target destination directory.
   */
  dest?: string;
  /**
   * Target agent platform preset.
   */
  agent?: AgentPlatform | string;
  /**
   * Overwrite existing skill directory if already present.
   */
  force?: boolean;
  /**
   * Install into the user's global agent skills directory.
   */
  global?: boolean;
  /**
   * Preview destination path and files without copying.
   */
  dryRun?: boolean;
  /**
   * Working directory used to resolve relative paths and detect workspace.
   * Defaults to `process.cwd()`.
   */
  cwd?: string;
}

/**
 * Result returned by {@link installSkill}.
 */
export interface InstallSkillResult {
  /**
   * Absolute resolved destination directory.
   */
  targetDir: string;
  /**
   * Relative file paths installed (relative to targetDir).
   */
  files: string[];
  /**
   * True if operation was dry-run only.
   */
  dryRun: boolean;
}

/**
 * Locates the bundled source `skills/okf` directory across local build and packaged distribution.
 */
export function resolveSourceSkillDir(): string {
  // 1. Try resolving relative to this module file (e.g. from dist/node/ or src/node/)
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(currentDir, '../../skills/okf'),
      path.resolve(currentDir, '../../../skills/okf'),
      path.resolve(currentDir, '../skills/okf'),
    ];

    for (const candidate of candidates) {
      if (
        fsSync.existsSync(candidate) &&
        fsSync.existsSync(path.join(candidate, 'SKILL.md'))
      ) {
        return candidate;
      }
    }
  } catch {
    // Continue fallback
  }

  // 2. Try walking upwards from process.cwd()
  let curr = process.cwd();
  while (curr !== path.dirname(curr)) {
    const candidate = path.join(curr, 'skills', 'okf');
    if (
      fsSync.existsSync(candidate) &&
      fsSync.existsSync(path.join(candidate, 'SKILL.md'))
    ) {
      return candidate;
    }
    curr = path.dirname(curr);
  }

  throw new Error(
    'Unable to locate bundled OKF skill directory (skills/okf/SKILL.md)'
  );
}

/**
 * Recursively collects all relative file paths inside a directory.
 */
async function collectFiles(
  dir: string,
  baseDir: string = dir
): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFiles(fullPath, baseDir);
      files.push(...nested);
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, fullPath).replace(/\\/g, '/'));
    }
  }

  return files;
}

/**
 * Resolves the destination directory for the OKF skill based on flags and workspace layout.
 */
export function resolveTargetDir(options: InstallSkillOptions): string {
  const cwd = options.cwd || process.cwd();

  // 1. Custom destination specified directly
  if (options.dest) {
    return path.resolve(cwd, options.dest);
  }

  const homedir = os.homedir();
  const agent = options.agent?.toLowerCase();

  // 2. Global installation flag
  if (options.global) {
    if (agent === 'gemini' || agent === 'antigravity') {
      return path.join(homedir, '.gemini', 'config', 'skills', 'okf');
    }
    if (agent === 'claude') {
      return path.join(homedir, '.claude', 'skills', 'okf');
    }
    // Auto-detect existing global config roots
    if (fsSync.existsSync(path.join(homedir, '.gemini', 'config', 'skills'))) {
      return path.join(homedir, '.gemini', 'config', 'skills', 'okf');
    }
    return path.join(homedir, '.agents', 'skills', 'okf');
  }

  // 3. Platform preset in project workspace
  if (agent === 'gemini' || agent === 'antigravity' || agent === 'generic') {
    return path.resolve(cwd, '.agents/skills/okf');
  }
  if (agent === 'claude') {
    return path.resolve(cwd, '.claude/skills/okf');
  }

  // 4. Auto-detect workspace skill directories
  const checkPaths = [
    path.join(cwd, '.agents', 'skills'),
    path.join(cwd, '.claude', 'skills'),
  ];

  for (const p of checkPaths) {
    if (fsSync.existsSync(p)) {
      return path.join(p, 'okf');
    }
  }

  // Default workspace fallback
  return path.resolve(cwd, '.agents/skills/okf');
}

/**
 * Installs the OKF Agent Skill into the resolved target directory.
 *
 * @param options - Configuration options for destination, agent platform, and overwrite behavior.
 * @returns Result object with resolved destination and list of copied files.
 */
export async function installSkill(
  options: InstallSkillOptions = {}
): Promise<InstallSkillResult> {
  const sourceDir = resolveSourceSkillDir();
  const targetDir = resolveTargetDir(options);
  const files = await collectFiles(sourceDir);

  if (options.dryRun) {
    return {
      targetDir,
      files,
      dryRun: true,
    };
  }

  const targetExists = fsSync.existsSync(targetDir);
  if (targetExists) {
    if (!options.force) {
      throw new Error(
        `Target skill directory already exists: ${targetDir}. Use --force to overwrite.`
      );
    }
  }

  await fs.mkdir(targetDir, { recursive: true });

  for (const relFile of files) {
    const srcFile = path.join(sourceDir, relFile);
    const destFile = path.join(targetDir, relFile);
    await fs.mkdir(path.dirname(destFile), { recursive: true });
    await fs.copyFile(srcFile, destFile);
  }

  return {
    targetDir,
    files,
    dryRun: false,
  };
}
