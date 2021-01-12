const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const webpack = require('webpack');
const nrwlConfig = require('@nrwl/react/plugins/webpack.js');
const webpackTailwindConfig = require('../../webpack-tailwind.config');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = (config, context) => {
  nrwlConfig(config);

  config.module.rules[0].options = {
    ...config.module.rules[0].options,
    plugins: [
      // ... other plugins
      isDevelopment && require.resolve('react-refresh/babel'),
    ].filter(Boolean)
  }

  console.log(config);


  return {
    ...config,
    plugins: [
      ...config.plugins,
      isDevelopment && new webpack.HotModuleReplacementPlugin(),
      isDevelopment && new ReactRefreshWebpackPlugin(),
    ],
    module: {
      rules: [
        ...config.module.rules,
        webpackTailwindConfig.tailwindWebpackRule,
        {
          test: /\.worker\.js$/,
          use: { loader: 'worker-loader' }
        }
      ],
    },
    output: {
      ...config.output,
      // globalObject: 'this'
    },
    node: {
     fs: "empty"
    },
    devServer: {
      ...config.devServer,
      liveReload: false,
      hot: true
    }
  };
};

