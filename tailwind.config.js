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
          100: '#FBF8F4',
          200: '#F0EDEA',
          300: '#ECE7E2',
          900: '#000000',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        accent: '#EC4899',
        black: '#040003',
        white: '#FFFFFF',
      },
    },
  },
  plugins: [],
};
