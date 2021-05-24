/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
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
  ],
  packageOptions: {
    polyfillNode: true,
    external: ['react'],
    /* ... */
  },
};
