/** @type {import("snowpack").SnowpackUserConfig } */

module.exports = {
  mount: {
    public: { url: '/', static: true },
    src: { url: '/dist' },
    '../web-core': '/@harika/web-core',
    '../common': '/@harika/common',
  },
  plugins: [
    ['@snowpack/plugin-webpack', { sourceMap: true }],
    '@snowpack/plugin-react-refresh',
    '@snowpack/plugin-dotenv',
    [
      '@snowpack/plugin-typescript',
      {
        /* Yarn PnP workaround: see https://www.npmjs.com/package/@snowpack/plugin-typescript */
        ...(process.versions.pnp ? { tsc: 'yarn pnpify tsc' } : {}),
      },
    ],
    '@snowpack/plugin-postcss',
  ],
  routes: [
    /* Enable an SPA Fallback in development: */
    { match: 'routes', src: '.*', dest: '/index.html' },
  ],
  optimize: {
    /* Example: Bundle your final build: */
    bundle: true,
    minify: true,
    target: 'es2018',
    sourcemap: true,
    treeshake: true,
  },
  packageOptions: {
    knownEntrypoints: ['@welldone-software/why-did-you-render'],
    /* ... */
  },
  devOptions: {
    /* ... */
    sourcemap: true,
  },
  buildOptions: {
    /* ... */
    sourcemap: true,
  },
  alias: {
    '@harika/web-core': '../web-core',
    '@harika/common': '../common',
  },
};
