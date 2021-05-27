// tailwind.config.js

// To add all colors support
const colors = require('tailwindcss/colors');

module.exports = {
  important: true,
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
