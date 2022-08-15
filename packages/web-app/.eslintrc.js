const rootDir = process.cwd().includes('packages/web-app')
  ? './'
  : './packages/web-app';

module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'plugin:jsx-a11y/recommended',
    'prettier',
    'plugin:rxjs/recommended',
    'plugin:promise/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
    tsconfigRootDir: rootDir,
    project: './tsconfig.json',
  },
  plugins: [
    'jsx-a11y',
    'rxjs',
    'simple-import-sort',
    'promise',
    '@typescript-eslint',
  ],
  root: true,
  rules: {
    'simple-import-sort/imports': 'warn',
    'simple-import-sort/exports': 'warn',
    '@typescript-eslint/no-floating-promises': ['warn'],
    'import/prefer-default-export': 'off',
    'no-console': 'off',
    'no-bitwise': 'off',
    'import/extensions': 'off',
    'no-use-before-define': 'off',
    'no-await-in-loop': 'off',
    'import/no-unresolved': 'off',
    'class-methods-use-this': 'off',
    'no-restricted-syntax': 'off',
    'no-underscore-dangle': 'off',
    'no-plusplus': 'off',
    'no-cond-assign': ['warn', 'except-parens'],
  },
};
