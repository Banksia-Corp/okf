import fs from 'node:fs/promises';
import path from 'node:path';
import { AuditLogger, LogEntry } from '../logger.js';
import { sanitizeMarkdownCell } from '../schema.js';

export class NodeFileAuditLogger implements AuditLogger {
  readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

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

// Backward Compatibility helper
export function appendAuditLog(
  bundleDir: string,
  entry: LogEntry
): Promise<string> {
  const logger = new NodeFileAuditLogger(bundleDir);
  return logger.append(entry);
}
