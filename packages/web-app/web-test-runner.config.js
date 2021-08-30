const vite = require('vite-web-test-runner-plugin');

process.env.NODE_ENV = 'test';

module.exports = {
  plugins: [vite()],
};
