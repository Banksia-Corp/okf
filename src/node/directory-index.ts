import fs from 'node:fs/promises';
import path from 'node:path';
import { FileSystemRepository } from './fs-repository.js';
import { Client } from '../client.js';
import { Concept } from '../schema.js';
import { generateIndexMarkdown } from '../indexer.js';

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
  const resolvedDir = path.resolve(dirPath);
  const indexPath = path.join(resolvedDir, 'index.md');
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, markdown, 'utf8');
  return indexPath.replace(/\\/g, '/');
}
