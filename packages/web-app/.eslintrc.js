const rootDir = process.cwd().includes('packages/web-app')
  ? './'
  : './packages/web-app';

module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'react-app',
    'plugin:jsx-a11y/recommended',
    'prettier',
    'plugin:rxjs/recommended',
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
  plugins: ['react', 'jsx-a11y', 'rxjs'],
  rules: {},
};
