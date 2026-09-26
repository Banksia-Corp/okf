#!/usr/bin/env node

import { runCli } from '../src/node/cli.js';

runCli(process.argv.slice(2))
  .then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
