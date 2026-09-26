import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: ['node 24'],
      dts: true,
      source: {
        entry: {
          index: './src/index.ts',
          'node/index': './src/node/index.ts',
        },
        tsconfigPath: './tsconfig.build.json',
      },
    },
    {
      format: 'cjs',
      syntax: ['node 24'],
      dts: false,
      source: {
        entry: {
          index: './src/index.ts',
          'node/index': './src/node/index.ts',
        },
      },
    },
  ],
});
