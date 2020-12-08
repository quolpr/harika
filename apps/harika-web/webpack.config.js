const nrwlConfig = require('@nrwl/react/plugins/webpack.js');
const webpackTailwindConfig = require('../../webpack-tailwind.config');

module.exports = (config, context) => {
  nrwlConfig(config);
  return {
    ...config,
    plugins: [
      ...config.plugins
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
    }
  };
};

