#!/usr/bin/env node

/**
 * Distribution Audit & Size Gate Validator for @banksia/okf
 *
 * Verifies:
 * 1. Required build and schema artifacts exist in dist/
 * 2. Tarball packaging audit (no leaked tests, internal helpers, source maps, or src files)
 * 3. File size and compression gates (Raw, Gzip, Brotli) across distribution entrypoints
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

/**
 * Budget configurations for package entrypoints.
 * Sizes in bytes.
 */
const BUDGETS = [
  {
    name: '@banksia/okf (Universal Core ESM)',
    files: ['dist/index.js'],
    maxGzipBytes: 5000,
    maxBrotliBytes: 4500,
    description: 'Universal decoupled core entrypoint (ESM)',
  },
  {
    name: '@banksia/okf (Universal Core CJS)',
    files: ['dist/index.cjs'],
    maxGzipBytes: 15000,
    maxBrotliBytes: 13000,
    description: 'Universal decoupled core entrypoint (CJS)',
  },
  {
    name: '@banksia/okf/node (Node Adapter ESM)',
    files: ['dist/node/index.js'],
    maxGzipBytes: 12000,
    maxBrotliBytes: 10000,
    description: 'Node.js filesystem & CLI adapter (ESM)',
  },
  {
    name: '@banksia/okf/node (Node Adapter CJS)',
    files: ['dist/node/index.cjs'],
    maxGzipBytes: 20000,
    maxBrotliBytes: 18000,
    description: 'Node.js filesystem & CLI adapter (CJS)',
  },
];

const REQUIRED_FILES = [
  'dist/index.js',
  'dist/index.cjs',
  'dist/node/index.js',
  'dist/node/index.cjs',
  'dist/okf.schema.json',
  'dist/okf-frontmatter.schema.json',
  'dist/index.d.ts',
  'dist/node/index.d.ts',
  'bin/okf.js',
  'README.md',
  'LICENSE',
  'package.json',
];

const FORBIDDEN_PATTERNS = [
  /^src\//,
  /^tests\//,
  /^scripts\//,
  /\.test\./,
  /\.spec\./,
  /\.map$/,
  /\.tsbuildinfo$/,
  /tsconfig/,
  /lefthook/,
  /eslint/,
  /\.log$/,
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} kB`;
}

function calculateCompression(filePaths) {
  let combinedContent = '';
  let rawBytes = 0;

  for (const relPath of filePaths) {
    const fullPath = path.join(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath);
      rawBytes += content.length;
      combinedContent += '\n' + content.toString('utf-8');
    }
  }

  const buf = Buffer.from(combinedContent, 'utf-8');
  const gzipBytes = zlib.gzipSync(buf, { level: 9 }).length;
  const brotliBytes = zlib.brotliCompressSync(buf, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    },
  }).length;

  return { rawBytes, gzipBytes, brotliBytes };
}

function runAudit() {
  console.log('\n📦 Running @banksia/okf Distribution & Build Size Audit...\n');

  let hasFailure = false;

  // 1. Verify existence of required build artifacts
  console.log('🔍 Checking required distribution files...');
  for (const relPath of REQUIRED_FILES) {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Missing required file: ${relPath}`);
      hasFailure = true;
    } else {
      console.log(`  ✓ ${relPath}`);
    }
  }

  // 2. Perform Tarball Packaging Audit (npm pack --dry-run)
  console.log('\n🔍 Auditing package tarball contents...');
  try {
    const rawOutput = execSync('npm pack --dry-run --json', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Handle possible stdout prefix before JSON (e.g., hooks message)
    const jsonStart = rawOutput.indexOf('[');
    if (jsonStart === -1) {
      throw new Error(`Unable to parse npm pack output as JSON: ${rawOutput}`);
    }
    const packJson = JSON.parse(rawOutput.slice(jsonStart));
    const packagedFiles = packJson[0].files.map((f) => f.path);

    for (const file of packagedFiles) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(file)) {
          console.error(
            `❌ Leaked file detected in package tarball: ${file} (matches ${pattern})`
          );
          hasFailure = true;
        }
      }
    }

    if (!hasFailure) {
      console.log(
        `  ✓ Tarball contents clean (${packagedFiles.length} files, no leaked test/src files)`
      );
    }
  } catch (err) {
    console.error('❌ Failed to audit npm pack tarball:', err.message);
    hasFailure = true;
  }

  // 3. Check Size Budgets
  console.log('\n📊 Evaluating size budget gates...');
  const results = [];
  const markdownRows = [];

  for (const budget of BUDGETS) {
    let allFilesExist = true;
    for (const file of budget.files) {
      const fullPath = path.join(rootDir, file);
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Missing file for budget check: ${file}`);
        allFilesExist = false;
        hasFailure = true;
      }
    }

    if (!allFilesExist) continue;

    const { rawBytes, gzipBytes, brotliBytes } = calculateCompression(
      budget.files
    );

    const gzipPassed = gzipBytes <= budget.maxGzipBytes;
    const brotliPassed = brotliBytes <= budget.maxBrotliBytes;
    const passed = gzipPassed && brotliPassed;

    if (!passed) {
      hasFailure = true;
    }

    const gzipPercent = ((gzipBytes / budget.maxGzipBytes) * 100).toFixed(1);
    const brotliPercent = ((brotliBytes / budget.maxBrotliBytes) * 100).toFixed(
      1
    );

    results.push({
      entry: budget.name,
      raw: formatBytes(rawBytes),
      gzip: `${formatBytes(gzipBytes)} / ${formatBytes(budget.maxGzipBytes)} (${gzipPercent}%)`,
      brotli: `${formatBytes(brotliBytes)} / ${formatBytes(budget.maxBrotliBytes)} (${brotliPercent}%)`,
      status: passed ? '✅ PASS' : '❌ FAIL',
    });

    markdownRows.push(
      `| \`${budget.name}\` | ${formatBytes(rawBytes)} | ${formatBytes(gzipBytes)} / ${formatBytes(budget.maxGzipBytes)} (${gzipPercent}%) | ${formatBytes(brotliBytes)} / ${formatBytes(budget.maxBrotliBytes)} (${brotliPercent}%) | ${passed ? '✅ PASS' : '❌ FAIL'} |`
    );
  }

  console.table(results);

  // Write GitHub Actions Step Summary if running in CI
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryMd = `### 📦 @banksia/okf Build Size & Distribution Audit Results

| Subpath Export | Raw Size | Gzip / Budget | Brotli / Budget | Status |
| :--- | :---: | :---: | :---: | :---: |
${markdownRows.join('\n')}

${hasFailure ? '❌ **Distribution audit or build size budget exceeded!**' : '✅ **All distribution gates passed.**'}
`;
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMd + '\n');
    } catch (e) {
      console.warn('Could not write to GITHUB_STEP_SUMMARY:', e.message);
    }
  }

  if (hasFailure) {
    console.error('\n❌ Distribution audit failed.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All distribution and size audit checks passed!\n');
  }
}

runAudit();
