import globals from 'globals';
import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import jest from 'eslint-plugin-jest';

// First, extend the base configurations
const baseConfig = [
  js.configs.recommended,
  ...vue.configs['flat/essential'],
];

export default [
  ...baseConfig,  // Put base configs first
  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    ignores: ['node_modules/**', 'dist/**'],
    plugins: {
      vue,  // Add Vue plugin here
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        parser: 'espree',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Disable problematic rules
      'no-unused-vars': ['off', { 'args': 'none' }],
      'no-undef': 'off',

      // Basic formatting
      'semi': ['error', 'always'],
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'comma-dangle': ['error', 'always-multiline'],

      // Spacing
      'array-bracket-spacing': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'comma-spacing': ['error', { 'before': false, 'after': true }],
      'space-before-blocks': ['error', 'always'],
      'space-before-function-paren': ['error', {
        'anonymous': 'always',
        'named': 'never',
        'asyncArrow': 'always',
      }],
      'space-in-parens': ['error', 'never'],
      'space-infix-ops': 'error',
      'key-spacing': ['error', {
        'beforeColon': false,
        'afterColon': true,
      }],
      'keyword-spacing': ['error', {
        'before': true,
        'after': true,
      }],

      // Line breaks
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 0 }],
      'eol-last': ['error', 'always'],

      // Add some Vue-specific rules
      'vue/html-indent': ['error', 2],
      'vue/html-quotes': ['error', 'double'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/multi-word-component-names': 'off',  // This should now take precedence
    },
  },
  {
    files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js', '**/__tests__/**/*.js'],
    plugins: {
      jest,
    },
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      ...jest.configs.recommended.rules,
    },
  },
  {
    files: ['**/*.vue'],
    plugins: {
      vue,
    },
    processor: vue.processors['.vue'],
  },
];
