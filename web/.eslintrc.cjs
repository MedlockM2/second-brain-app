// The web app imports the shared code from packages/core, never from mobile/src:
// modules there reach for Expo and React Native, which a browser cannot run.
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-hooks'],
  env: { browser: true, es2022: true },
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/mobile/**', 'expo', 'expo-*', 'react-native', 'react-native-*'],
            message: 'The web app shares code through @media-summarizer/core only (AGENTS.md, "packages/core").',
          },
        ],
      },
    ],
  },
};
