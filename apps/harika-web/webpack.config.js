const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const webpack = require('webpack');
const nrwlConfig = require('@nrwl/react/plugins/webpack.js');
const webpackTailwindConfig = require('../../webpack-tailwind.config');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin;
const WorkboxPlugin = require('workbox-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = (config, context) => {
  nrwlConfig(config);

  config.module.rules[0].options = {
    ...config.module.rules[0].options,
    plugins: [
      // ... other plugins
      isDevelopment && require.resolve('react-refresh/babel'),
    ].filter(Boolean),
  };

  return {
    ...config,
    plugins: [
      ...config.plugins,
      isDevelopment && new webpack.HotModuleReplacementPlugin(),
      isDevelopment && new ReactRefreshWebpackPlugin({ overlay: false }),
      // new BundleAnalyzerPlugin({ analyzerMode: 'static' }),
      new WorkboxPlugin.InjectManifest({
        swSrc: './serviceWorker.ts',
        maximumFileSizeToCacheInBytes: 1024 * 1024 * 50,
        additionalManifestEntries: [
          // TODO: investigate why index.html is not adding
          { url: '/index.html', revision: new Date().getTime().toString() },
        ],
      }),
    ].filter(Boolean),
    module: {
      rules: [
        ...config.module.rules,
        webpackTailwindConfig.tailwindWebpackRule,
        {
          test: /\.worker\.js$/,
          use: { loader: 'worker-loader' },
        },
      ],
    },
    output: {
      ...config.output,
      // globalObject: 'this'
    },
    node: {
      fs: 'empty',
    },
    devServer: {
      ...config.devServer,
      liveReload: false,
      hot: true,
    },
  };
};
