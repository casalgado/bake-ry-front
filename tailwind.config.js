/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}', // Include all Vue components
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        'custom-200-1fr': '200px 1fr',
        'custom-50-1fr': '50px 1fr',
      },
      colors: {
        primary: {
          100: '#FFF1E4',  /* Very light peachy */
          200: '#FFE0C4',  /* Light peachy */
          300: '#F5C9A4',  /* Soft peach */
          400: '#EBB084',  /* Light orange */
          DEFAULT: '#D9842A',  /* BASE COLOR - DEFAULT */
          600: '#B86D1F',  /* Darker orange */
          700: '#965716',  /* Deep orange-brown */
          800: '#744210',  /* Dark brown */
          900: '#522D09',  /* Very dark brown */
        },
        secondary: {
          light: '#425E9D',
          DEFAULT: '#284891',
          dark: '#09225C',
        },
        tertiary: {
          light: '#FFFFFF',
          DEFAULT: '#FFFFFF',
          dark: '#FFFFFF',
        },
        neutral: {
          50: '#FAF8F5',   // Lightest brown
          100: '#F5F0EB',  // Very light brown
          150: '#EDE7E1',  // Between 100-200
          200: '#E6DFD8',  // Light brown
          250: '#DDD4CB',  // Between 200-300
          300: '#D4C8BC',  // Soft brown
          350: '#C5B8AB',  // Between 300-400
          400: '#B7A99A',  // Medium light brown
          450: '#A18E77',  // Between 400-500
          DEFAULT: '#8B7355',  // BASE COLOR (was DEFAULT)
          550: '#7E684D',  // Between 500-600
          600: '#725F46',  // Darker brown
          650: '#66553F',  // Between 600-700
          700: '#5A4A37',  // Deep brown
          750: '#4E412F',  // Between 700-800
          800: '#423628',  // Very dark brown
          850: '#362C20',  // Between 800-900
          900: '#2A231A',  // Almost black brown
          950: '#1F1914',  // Darkest brown
        },
        gray: {
          100: '#FFFFFF',
          200: '#FDFDFD',
          300: '#FAFAFA',
          400: '#F1F1F1',
          500: '#EBEBEB',
          600: '#DDDDDD',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#7f1d1d',
        accent: '#EC4899',
        black: '#303030',
        white: '#FFFFFE',
      },
      fontFamily: {
        sans: ['Inter'],
      },
    },
  },
  plugins: [],
};
