import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Distribution and Artifact Verification', () => {
  it('generates all expected build outputs in dist/', () => {
    const required = [
      'dist/index.js',
      'dist/index.cjs',
      'dist/node/index.js',
      'dist/node/index.cjs',
      'dist/okf.schema.json',
      'dist/okf-frontmatter.schema.json',
      'dist/index.d.ts',
      'dist/node/index.d.ts',
    ];

    for (const relPath of required) {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath), `Expected ${relPath} to exist`).toBe(
        true
      );
    }
  });

  it('generates valid canonical JSON schemas', () => {
    const okfSchemaPath = path.join(rootDir, 'dist/okf.schema.json');
    const frontmatterSchemaPath = path.join(
      rootDir,
      'dist/okf-frontmatter.schema.json'
    );

    const okfSchema = JSON.parse(fs.readFileSync(okfSchemaPath, 'utf8'));
    const frontmatterSchema = JSON.parse(
      fs.readFileSync(frontmatterSchemaPath, 'utf8')
    );

    expect(okfSchema).toBeTypeOf('object');
    expect(okfSchema.type).toBe('object');
    expect(okfSchema.properties).toBeDefined();
    expect(okfSchema.properties.frontmatter).toBeDefined();

    expect(frontmatterSchema).toBeTypeOf('object');
    expect(frontmatterSchema.type).toBe('object');
    expect(frontmatterSchema.properties).toBeDefined();
    expect(frontmatterSchema.properties.type).toBeDefined();
    expect(frontmatterSchema.properties.status).toBeDefined();
  });

  it('ensures executable bin/okf.js has node shebang and executable permissions', () => {
    const binPath = path.join(rootDir, 'bin/okf.js');
    expect(fs.existsSync(binPath)).toBe(true);

    const content = fs.readFileSync(binPath, 'utf8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);

    const stats = fs.statSync(binPath);
    // Mode should include executable bit (0o111)
    expect((stats.mode & 0o111) !== 0).toBe(true);
  });

  it('ensures jsr.json and package.json versions are synchronized', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
    );
    const jsr = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'jsr.json'), 'utf8')
    );
    expect(jsr.version).toBe(pkg.version);
  });
});
