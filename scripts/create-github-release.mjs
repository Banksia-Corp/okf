#!/usr/bin/env node

/**
 * Creates GitHub Release and pushes git tags for the current package version
 * if not already created on GitHub.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkg = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
);
const version = pkg.version;
const tagName = `v${version}`;

console.log(`[OKF Release] Checking GitHub release for ${tagName}...`);

// Check if release already exists on GitHub
let releaseExists = false;
try {
  const result = execFileSync('gh', ['release', 'view', tagName], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.trim().length > 0) {
    releaseExists = true;
  }
} catch {
  releaseExists = false;
}

if (releaseExists) {
  console.log(`[OKF Release] GitHub release for ${tagName} already exists.`);
  process.exit(0);
}

// Extract release notes for this version from CHANGELOG.md
let notes = '';
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
if (fs.existsSync(changelogPath)) {
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const escapedVersion = version.replace(/\./g, '\\.');
  const regex = new RegExp(
    `##\\s+${escapedVersion}[\\s\\S]*?(?=\\n##\\s+\\d|$)`
  );
  const match = changelog.match(regex);
  if (match) {
    // Strip the "## <version>" heading to leave the body
    notes = match[0]
      .replace(new RegExp(`^##\\s+${escapedVersion}\\s*`), '')
      .trim();
  }
}

if (!notes) {
  notes = `Release ${tagName}`;
}

console.log(`[OKF Release] Creating GitHub release ${tagName}...`);
try {
  execFileSync(
    'gh',
    ['release', 'create', tagName, '--title', tagName, '--notes', notes],
    {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: 'inherit',
    }
  );
  console.log(
    `[OKF Release] Successfully created GitHub release for ${tagName}`
  );
} catch (error) {
  console.error(`[OKF Release] Error creating GitHub release:`, error);
  process.exit(1);
}
