import fs from 'node:fs/promises';
import path from 'node:path';
import { QueryableRepository } from '../repository.js';

export class FileSystemRepository implements QueryableRepository {
  readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  private resolvePath(subpath: string): string {
    const normalized = subpath
      .replace(/\\/g, '/')
      .replace(/^(\.\/|\.$)/, '')
      .replace(/^\/+/, '');
    const full = path.resolve(this.baseDir, normalized);
    const rel = path.relative(this.baseDir, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(
        `Access outside base directory is not permitted: ${subpath}`
      );
    }
    return full;
  }

  async readConcept(p: string): Promise<string> {
    const full = this.resolvePath(p);
    return await fs.readFile(full, 'utf8');
  }

  async writeConcept(p: string, content: string): Promise<void> {
    const full = this.resolvePath(p);
    const dir = path.dirname(full);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(full, content, 'utf8');
  }

  async exists(p: string): Promise<boolean> {
    const full = this.resolvePath(p);
    try {
      await fs.access(full);
      return true;
    } catch {
      return false;
    }
  }

  async listConcepts(subpath: string = ''): Promise<string[]> {
    const targetDir = this.resolvePath(subpath);
    try {
      const entries = await fs.readdir(targetDir, { withFileTypes: true });
      const results: string[] = [];
      const cleanSubpath = subpath
        ? subpath
            .replace(/\\/g, '/')
            .replace(/^(\.\/|\.$)/, '')
            .replace(/^\/+/, '')
            .replace(/\/+$/, '')
        : '';

      for (const entry of entries) {
        if (
          entry.isFile() &&
          entry.name.endsWith('.md') &&
          entry.name !== 'index.md' &&
          entry.name !== 'log.md'
        ) {
          const rel = cleanSubpath
            ? `${cleanSubpath}/${entry.name}`
            : entry.name;
          results.push(rel);
        }
      }

      return results.sort();
    } catch {
      return [];
    }
  }

  async listSubdirectories(subpath: string = ''): Promise<string[]> {
    const targetDir = this.resolvePath(subpath);
    try {
      const entries = await fs.readdir(targetDir, { withFileTypes: true });
      const subdirs: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          subdirs.push(entry.name);
        }
      }

      return subdirs.sort();
    } catch {
      return [];
    }
  }

  async deleteConcept(p: string): Promise<void> {
    const full = this.resolvePath(p);
    try {
      await fs.unlink(full);
    } catch {
      // Ignored if file does not exist
    }
  }
}
