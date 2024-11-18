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
          100: '#F5F0EB',  // Very light brown
          200: '#E6DFD8',  // Light brown
          300: '#D4C8BC',  // Soft brown
          400: '#B7A99A',  // Medium light brown
          DEFAULT: '#8B7355', // BASE COLOR - DEFAULT
          600: '#725F46',  // Darker brown
          700: '#5A4A37',  // Deep brown
          800: '#423628',  // Very dark brown
          900: '#2A231A',  // Almost black brown
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
        error: '#EF4444',
        accent: '#EC4899',
        black: '#303030',
        white: '#FFFFFE',
      },
    },
  },
  plugins: [],
};
