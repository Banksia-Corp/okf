import { Concept } from './schema.js';

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
      markdown += `- [${sub}/](./${sub}/index.md)\n`;
    }
    markdown += '\n';
  }

  if (concepts.length > 0) {
    markdown += '## Concepts\n\n';
    markdown += '| Concept | Type | Description |\n';
    markdown += '| --- | --- | --- |\n';
    for (const c of concepts) {
      const filename = c.filepath.includes('/')
        ? c.filepath.split('/').pop()!
        : c.filepath;
      const title = c.frontmatter.title || filename.replace('.md', '');
      const desc = c.frontmatter.description || 'No description provided.';
      markdown += `| [${title}](./${filename}) | \`${c.frontmatter.type}\` | ${desc} |\n`;
    }
  }

  return markdown;
}
