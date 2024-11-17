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
          50: '#FFFFFE', // Almost pure white with barely perceptible warmth
          100: '#FDF8F6',
          200: '#FAF6F3',
          300: '#F1EDE9',
          400: '#EBE7E3',
          500: '#DDD8D4',
          600: '#C5C0BB', // Getting darker with warm undertone
          700: '#ABA5A0', // Medium-dark warm gray
          800: '#8C8681', // Dark warm gray
          900: '#6E6A66', // Very dark warm gray
          950: '#403E3C',
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
