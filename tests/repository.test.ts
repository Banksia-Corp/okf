import { describe, it, expect } from 'vitest';
import { InMemoryRepository } from '../src/repository.js';

describe('InMemoryRepository', () => {
  it('normalizes input paths with forward slashes and removes leading ./ or slashes', async () => {
    const repo = new InMemoryRepository({
      './concepts/item.md': 'content 1',
      'docs\\guide.md': 'content 2',
      '/nested//deep/file.md': 'content 3',
    });

    expect(await repo.exists('concepts/item.md')).toBe(true);
    expect(await repo.exists('./concepts/item.md')).toBe(true);
    expect(await repo.exists('concepts\\item.md')).toBe(true);

    expect(await repo.exists('docs/guide.md')).toBe(true);
    expect(await repo.exists('nested/deep/file.md')).toBe(true);
  });

  it('reads concept contents and throws for missing keys', async () => {
    const repo = new InMemoryRepository({
      'test.md': 'test content',
    });

    const content = await repo.readConcept('test.md');
    expect(content).toBe('test content');

    await expect(repo.readConcept('missing.md')).rejects.toThrow(
      'Concept not found: missing.md'
    );
  });

  it('writes and overwrites concept content', async () => {
    const repo = new InMemoryRepository();

    expect(await repo.exists('item.md')).toBe(false);
    await repo.writeConcept('item.md', 'first draft');
    expect(await repo.exists('item.md')).toBe(true);
    expect(await repo.readConcept('item.md')).toBe('first draft');

    await repo.writeConcept('item.md', 'updated draft');
    expect(await repo.readConcept('item.md')).toBe('updated draft');
  });

  it('lists concepts in root while excluding index.md and log.md', async () => {
    const repo = new InMemoryRepository({
      'a.md': 'concept a',
      'b.md': 'concept b',
      'index.md': 'directory index',
      'log.md': 'audit log',
      'notes.txt': 'non-markdown',
      'nested/c.md': 'concept in subfolder',
    });

    const rootList = await repo.listConcepts();
    expect(rootList).toEqual(['a.md', 'b.md']);
  });

  it('lists concepts within a specific subpath', async () => {
    const repo = new InMemoryRepository({
      'a.md': 'root a',
      'docs/guide.md': 'guide',
      'docs/api.md': 'api',
      'docs/index.md': 'sub index',
      'docs/log.md': 'sub log',
      'docs/nested/item.md': 'nested deep',
    });

    const docsList = await repo.listConcepts('docs');
    expect(docsList).toEqual(['docs/api.md', 'docs/guide.md']);

    const deepList = await repo.listConcepts('docs/nested');
    expect(deepList).toEqual(['docs/nested/item.md']);
  });

  it('lists immediate subdirectories without duplicates or hidden directories', async () => {
    const repo = new InMemoryRepository({
      'concepts/a.md': 'a',
      'concepts/b.md': 'b',
      'guides/one.md': '1',
      'guides/subguide/two.md': '2',
      '.git/config': 'git info',
      'root.md': 'root',
    });

    const rootSubdirs = await repo.listSubdirectories();
    expect(rootSubdirs).toEqual(['concepts', 'guides']);

    const guidesSubdirs = await repo.listSubdirectories('guides');
    expect(guidesSubdirs).toEqual(['subguide']);
  });

  it('deletes concepts successfully', async () => {
    const repo = new InMemoryRepository({
      'to-delete.md': 'content',
    });

    expect(await repo.exists('to-delete.md')).toBe(true);
    await repo.deleteConcept('to-delete.md');
    expect(await repo.exists('to-delete.md')).toBe(false);
  });
});
