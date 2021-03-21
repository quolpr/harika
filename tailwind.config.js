const colors = require('tailwindcss/colors');

module.exports = {
  purge: ['./libs/**/*.{js,jsx,ts,tsx,vue}', './apps/**/*.{js,jsx,ts,tsx,vue}'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      ...colors,
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
