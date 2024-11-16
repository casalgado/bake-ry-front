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
          light: '#EBA052',
          DEFAULT: '#D9842A',
          dark: '#6D4D34',
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
