import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import { injectManifest } from 'rollup-plugin-workbox';
import { visualizer } from 'rollup-plugin-visualizer';
import Checker from 'vite-plugin-checker';

const { glob } = require('glob');
const reactSvgPlugin = require('vite-plugin-react-svg');

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
    minify: 'terser',
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  plugins: [
    reactRefresh(),
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
    visualizer({ open: true, filename: 'dist/stats.html' }),
    Checker({ typescript: true }),
  ],
});
