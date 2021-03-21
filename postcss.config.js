const tailwindcss = require('tailwindcss');

module.exports = {
  plugins: [
    require('postcss-nested'),
    require('postcss-import'),
    require('@tailwindcss/jit'),
    require('autoprefixer'),
  ],
};
