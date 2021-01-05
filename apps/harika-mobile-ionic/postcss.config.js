const tailwindcss = require('tailwindcss');

module.exports = {
  plugins: [
    require('postcss-nested'),
    require('postcss-import'),
    tailwindcss('./tailwind.config.js'),
    require('autoprefixer'),
  ],
};
