#!/usr/bin/env node

/**
 * Version synchronizer for @banksia/okf
 * Keeps jsr.json aligned with package.json version during Changesets releases.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const jsrPath = path.join(rootDir, 'jsr.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const jsr = JSON.parse(fs.readFileSync(jsrPath, 'utf8'));

if (jsr.version !== pkg.version) {
  console.log(
    `[OKF] Syncing jsr.json version from ${jsr.version} to ${pkg.version}...`
  );
  jsr.version = pkg.version;
  fs.writeFileSync(jsrPath, JSON.stringify(jsr, null, 2) + '\n');
  console.log(`[OKF] Updated jsr.json to version ${pkg.version}`);
} else {
  console.log(
    `[OKF] jsr.json version already matches package.json (${pkg.version})`
  );
}
