import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { FrontmatterSchema } from '../src/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Generate Frontmatter Schema aligned with SchemaStore okf-0.2.json
const frontmatterJsonSchema = z.toJSONSchema(FrontmatterSchema, {
  target: 'jsonSchema2020-12',
  unrepresentable: 'any',
});

// Generate Full OKF Document / Graph Schema
const conceptJsonSchema = z.toJSONSchema(
  z.object({
    id: z.string(),
    filepath: z.string(),
    frontmatter: FrontmatterSchema,
    body: z.string(),
  }),
  {
    target: 'jsonSchema2020-12',
    unrepresentable: 'any',
  }
);

fs.writeFileSync(
  path.join(distDir, 'okf-frontmatter.schema.json'),
  JSON.stringify(frontmatterJsonSchema, null, 2),
  'utf8'
);

fs.writeFileSync(
  path.join(distDir, 'okf.schema.json'),
  JSON.stringify(conceptJsonSchema, null, 2),
  'utf8'
);

console.log('[OKF] Codified JSON Schemas generated in dist/');
