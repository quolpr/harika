// tailwind.config.js

// To add all colors support
const colors = require('tailwindcss/colors');

console.log(colors);

module.exports = {
  important: true,
  mode: 'jit',
  purge: ['./public/**/*.html', './src/**/*.{js,jsx,ts,tsx,vue}'],
  theme: {
    extend: {},
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      ...colors,
    },
  },
};
