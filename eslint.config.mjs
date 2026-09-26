import gts from 'gts';

export default [
  ...gts,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['bin/**/*.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'build/**', 'coverage/**'],
  },
];
