#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// If running in development (dist not built yet), fall back to source
const distPath = path.resolve(__dirname, '../dist/node/index.js');
const srcPath = path.resolve(__dirname, '../src/node/cli.js');

const targetModule = fs.existsSync(distPath) ? distPath : srcPath;
const { runCli } = await import(targetModule);

runCli(process.argv.slice(2))
  .then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
