/**
 * @fileoverview Directory index generator for OKF knowledge roots and concept hierarchies.
 *
 * Synthesizes Markdown tables for `index.md` files displaying concept titles, types,
 * descriptions, and nested subdirectory navigation links.
 *
 * @packageDocumentation
 */

import { Concept, sanitizeMarkdownCell } from './schema.js';

/**
 * Representation of an individual concept row rendered within a generated directory index table.
 */
export interface IndexEntry {
  /** Relative filename of the concept markdown file. */
  filename: string;
  /** Concept type (e.g. `'concept'`, `'architecture'`). */
  type: string;
  /** Title of the concept. */
  title: string;
  /** Summary description of the concept. */
  description: string;
}

/**
 * Generates formatted `index.md` Markdown content containing navigation links and concept tables.
 *
 * @param options - Directory options containing subdirectories and concept documents.
 * @returns Formatted Markdown string ready for writing to `index.md`.
 *
 * @example
 * ```ts
 * const markdown = generateIndexMarkdown({
 *   subdirs: ['networking', 'storage'],
 *   concepts: [conceptA, conceptB],
 * });
 * ```
 */
export function generateIndexMarkdown(options: {
  subdirs?: string[];
  concepts?: Concept[];
}): string {
  const subdirs = options.subdirs || [];
  const concepts = options.concepts || [];

  let markdown = '# Directory Index\n\n';

  if (subdirs.length > 0) {
    markdown += '## Subdirectories\n\n';
    for (const sub of subdirs) {
      const cleanSub = sanitizeMarkdownCell(sub);
      markdown += `- [${cleanSub}/](./${cleanSub}/index.md)\n`;
    }
    markdown += '\n';
  }

  if (concepts.length > 0) {
    markdown += '## Concepts\n\n';
    markdown += '| Concept | Type | Description |\n';
    markdown += '| --- | --- | --- |\n';
    for (const c of concepts) {
      const rawFilename = c.filepath.includes('/')
        ? c.filepath.split('/').pop()!
        : c.filepath;
      const rawTitle = c.frontmatter.title || rawFilename.replace('.md', '');
      const rawDesc = c.frontmatter.description || 'No description provided.';
      const rawType = c.frontmatter.type;

      const title = sanitizeMarkdownCell(rawTitle);
      const filename = sanitizeMarkdownCell(rawFilename);
      const type = sanitizeMarkdownCell(rawType);
      const desc = sanitizeMarkdownCell(rawDesc);

      markdown += `| [${title}](./${filename}) | \`${type}\` | ${desc} |\n`;
    }
  }

  return markdown;
}
