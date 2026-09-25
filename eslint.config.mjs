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
    ignores: ['**/dist/**', '**/node_modules/**', 'build/**', 'coverage/**'],
  },
];
