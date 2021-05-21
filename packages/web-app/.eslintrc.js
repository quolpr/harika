module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ['react-app', 'plugin:jsx-a11y/recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['react', 'jsx-a11y'],
  rules: {},
};
