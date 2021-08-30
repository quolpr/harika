import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation';
import { injectManifest } from 'rollup-plugin-workbox';
import { visualizer } from 'rollup-plugin-visualizer';

const { glob } = require('glob');
const reactSvgPlugin = require('vite-plugin-react-svg');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    reactRefresh(),
    crossOriginIsolation(),
    reactSvgPlugin(),
    injectManifest({
      swSrc: './src/serviceWorker.ts',
      swDest: './dist/sw.js',
      globDirectory: 'dist',
      additionalManifestEntries: [
        ...glob.sync('./assets/*.{json,wasm}', { cwd: './dist' }),
      ],
      mode: 'production', // this inlines the module imports when using yarn build
    }),
    visualizer({ open: true }),
  ],
});
