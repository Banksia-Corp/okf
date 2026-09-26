import { Concept, sanitizeMarkdownCell } from './schema.js';

export interface IndexEntry {
  filename: string;
  type: string;
  title: string;
  description: string;
}

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
