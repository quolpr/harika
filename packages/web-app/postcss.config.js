const cssnano = require('cssnano');
const postcssPresetEnv = require('postcss-preset-env');

module.exports = {
  plugins: [
    cssnano(),
    postcssPresetEnv(),
    require('postcss-import'),
    require('autoprefixer'),
    require('tailwindcss/nesting'),
    require('tailwindcss'),
    require('postcss-rem'),
  ],
};
