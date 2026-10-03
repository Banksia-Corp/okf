/**
 * @fileoverview Node.js automated directory index generator for OKF knowledge hierarchies.
 *
 * Scans directories on disk using {@link FileSystemRepository}, discovers concept documents and subdirectories,
 * and writes a formatted `index.md` file.
 *
 * @packageDocumentation
 */

import path from 'node:path';
import { FileSystemRepository } from './fs-repository.js';
import { Client } from '../client.js';
import { Concept } from '../schema.js';
import { generateIndexMarkdown } from '../indexer.js';

/**
 * Generates and writes an `index.md` navigation file for the specified directory path.
 *
 * @param dirPath - Filesystem path to the directory to index.
 * @returns A promise resolving to the normalized path of the generated `index.md`.
 *
 * @example
 * ```ts
 * const indexPath = await writeDirectoryIndex('./docs/concepts');
 * console.log(`Index generated at: ${indexPath}`);
 * ```
 */
export async function writeDirectoryIndex(dirPath: string): Promise<string> {
  const repo = new FileSystemRepository(dirPath);
  const client = new Client({ repository: repo });
  const conceptFiles = await repo.listConcepts();

  const concepts = (
    await Promise.all(
      conceptFiles.map(async (f) => {
        try {
          return await client.getConcept(f);
        } catch {
          return null;
        }
      })
    )
  ).filter((c): c is Concept => c !== null);

  const subdirs = await repo.listSubdirectories();
  const markdown = generateIndexMarkdown({ subdirs, concepts });
  await repo.writeConcept('index.md', markdown);
  const resolvedDir = path.resolve(dirPath);
  const indexPath = path.join(resolvedDir, 'index.md');
  return indexPath.replace(/\\/g, '/');
}
