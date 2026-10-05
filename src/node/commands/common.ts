/**
 * @fileoverview Shared utilities and helpers for OKF CLI commands.
 *
 * @packageDocumentation
 */

import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ResolvedOKFConfig } from '../config-loader.js';

/**
 * Resolves target path fallback by traversing upwards to monorepo root if needed.
 */
export function resolvePathFallback(targetPath: string): string {
  if (fsSync.existsSync(targetPath)) {
    return targetPath;
  }
  let current = process.cwd();
  while (current !== path.dirname(current)) {
    const candidate = path.resolve(current, targetPath);
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
    if (
      fsSync.existsSync(path.join(current, '.git')) ||
      fsSync.existsSync(path.join(current, 'pnpm-workspace.yaml'))
    ) {
      break;
    }
    current = path.dirname(current);
  }
  return targetPath;
}

/**
 * Resolves default actor string based on system environment.
 */
export function resolveDefaultActor(): string {
  try {
    const raw =
      process.env.USER ||
      process.env.USERNAME ||
      os.userInfo().username ||
      'unknown';
    const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '_') || 'anonymous';
    return `human:${sanitized}`;
  } catch {
    return 'human:anonymous';
  }
}

/**
 * Resolves targets based on positional path or config roots.
 */
export function resolveTargets(
  positionalPath: string | undefined,
  resolvedConfig: ResolvedOKFConfig
): string[] {
  if (positionalPath) {
    return [resolvePathFallback(positionalPath)];
  } else if (resolvedConfig.roots.length > 0) {
    return resolvedConfig.roots.map((r) => r.resolvedPath);
  } else {
    return [resolvePathFallback('.')];
  }
}

let currentExitCode = 0;

export function resetCliExitCode(): void {
  currentExitCode = 0;
}

export function setCliExitCode(code: number): void {
  if (code !== 0) {
    currentExitCode = code;
  }
}

export function getCliExitCode(): number {
  return currentExitCode;
}
