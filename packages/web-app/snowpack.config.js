/** @type {import("snowpack").SnowpackUserConfig } */

process.env.SNOWPACK_PUBLIC_SERVICE_WORKER = 'sw.js';

module.exports = {
  mount: {
    public: { url: '/', static: true },
    src: { url: '/dist' },
    '../web-core': '/@harika/web-core',
    '../common': '/@harika/common',
  },
  plugins: [
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
    [
      '@snowpack/plugin-webpack',
      {
        sourceMap: true,
        collapseWhitespace: false,
        extendConfig: (config) => {
          const { glob } = require('glob');
          const { InjectManifest } = require('workbox-webpack-plugin');

          const additionalManifestEntries = [
            ...glob.sync('*.{png,html,json,txt,css}', { cwd: './build' }),
          ].map((e) => ({
            url: e,
            revision: process.env.SNOWPACK_PUBLIC_PACKAGE_VERSION,
          }));

          config.plugins.push(
            new InjectManifest({
              mode: 'development',
              additionalManifestEntries: additionalManifestEntries,
              swSrc: './dist/serviceWorker.js',
              swDest: process.env.SNOWPACK_PUBLIC_SERVICE_WORKER,
              navigateFallback: '/index.html',
            }),
          );

          const BundleAnalyzerPlugin =
            require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

          config.plugins.push(
            new BundleAnalyzerPlugin({
              analyzerMode: 'static',
              defaultSizes: 'gzip',
            }),
          );

          return config;
        },
      },
    ],
  ],
  routes: [
    /* Enable an SPA Fallback in development: */
    { match: 'routes', src: '.*', dest: '/index.html' },
  ],
  optimize: {
    /* Example: Bundle your final build: */
    target: 'es2017',
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
  },
  alias: {
    '@harika/web-core': '../web-core',
    '@harika/common': '../common',
  },
};
