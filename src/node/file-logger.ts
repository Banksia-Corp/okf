/**
 * @fileoverview Node.js audit logger appending operational records to markdown `log.md` tables.
 *
 * Implements {@link AuditLogger} using Node filesystem APIs, formatting table rows
 * and sanitizing markdown cells against delimiter breakage.
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { AuditLogger, LogEntry } from '../logger.js';
import { sanitizeMarkdownCell } from '../schema.js';

/**
 * Audit logger writing to a markdown `log.md` file within a designated base directory.
 */
export class NodeFileAuditLogger implements AuditLogger {
  /** Directory containing or destined to contain the `log.md` file. */
  readonly baseDir: string;

  /**
   * Initializes a NodeFileAuditLogger targeting `baseDir`.
   *
   * @param baseDir - Directory path where `log.md` resides.
   *
   * @example
   * ```ts
   * const logger = new NodeFileAuditLogger('./docs/knowledge');
   * await logger.append({
   *   actor: 'human:luis',
   *   action: 'create',
   *   target: 'intro.md',
   *   summary: 'Created introduction concept',
   * });
   * ```
   */
  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  /**
   * Ensures `log.md` exists with standard table headers, creating it safely if missing.
   *
   * @param logPath - Absolute path to `log.md`.
   */
  private async ensureInitialized(logPath: string): Promise<void> {
    try {
      await fs.access(logPath);
    } catch {
      const header =
        '# Bundle Update Log\n\n| Timestamp | Actor | Action | Target | Summary |\n| --- | --- | --- | --- | --- |\n';
      await fs.mkdir(this.baseDir, { recursive: true });
      try {
        await fs.writeFile(logPath, header, { encoding: 'utf8', flag: 'wx' });
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err?.code !== 'EEXIST') {
          throw e;
        }
      }
    }
  }

  /**
   * Appends an audit record row to `log.md`.
   *
   * @param entry - Audit record information.
   * @returns Resolved normalized posix path to `log.md`.
   */
  async append(entry: LogEntry): Promise<string> {
    const logPath = path.join(this.baseDir, 'log.md');
    await this.ensureInitialized(logPath);

    const timestamp = sanitizeMarkdownCell(
      entry.timestamp || new Date().toISOString()
    );
    const actor = sanitizeMarkdownCell(entry.actor);
    const action = sanitizeMarkdownCell(entry.action);
    const target = sanitizeMarkdownCell(entry.target);
    const summary = sanitizeMarkdownCell(entry.summary);
    const newRow = `| ${timestamp} | \`${actor}\` | ${action} | [${target}](./${target}) | ${summary} |\n`;

    await fs.appendFile(logPath, newRow, 'utf8');
    return logPath.replace(/\\/g, '/');
  }
}

/**
 * Convenient helper to append an audit log entry to a knowledge bundle directory.
 *
 * @param bundleDir - Directory containing `log.md`.
 * @param entry - Log entry record.
 * @returns Path to the updated `log.md`.
 *
 * @example
 * ```ts
 * await appendAuditLog('./docs', {
 *   actor: 'process:ci',
 *   action: 'verify',
 *   target: 'concept.md',
 *   summary: 'Verified in CI',
 * });
 * ```
 */
export function appendAuditLog(
  bundleDir: string,
  entry: LogEntry
): Promise<string> {
  const logger = new NodeFileAuditLogger(bundleDir);
  return logger.append(entry);
}
