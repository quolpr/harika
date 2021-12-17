const rootDir = process.cwd().includes('packages/new-harika-api')
  ? './'
  : './packages/harika-api';

module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ['react-app', 'prettier', 'plugin:rxjs/recommended'],
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
