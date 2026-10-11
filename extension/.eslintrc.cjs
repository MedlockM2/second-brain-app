// The extension shares code with the apps through packages/core only; it never
// reaches into mobile/ or web/.
module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: { browser: true, es2022: true, webextensions: true },
  ignorePatterns: ['.wxt', '.output'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['**/mobile/**', '**/web/**', 'expo', 'expo-*', 'react-native', 'react-native-*'], message: 'Share code through @media-summarizer/core only.' },
        ],
      },
    ],
  },
};
