// The guard that keeps this package neutral (task-493): it is imported by the
// mobile app and by the web app, so nothing here may reach for a platform.
// What belongs here, and why, is in AGENTS.md, "packages/core".
const PLATFORM_MODULES = [
  'expo',
  'expo/*',
  'expo-*',
  'react-native',
  'react-native/*',
  'react-native-*',
  '@react-native/*',
  '@react-native-*/*',
  '@sentry/react-native',
  '@sentry/react-native/*',
];

module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: { es2022: true },
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: PLATFORM_MODULES,
            message:
              'packages/core is shared by the mobile and web apps: no platform import. Inject the platform piece from the app instead.',
          },
        ],
      },
    ],
    'no-restricted-globals': [
      'error',
      { name: 'window', message: 'packages/core runs outside the browser too: inject what you need from the app.' },
      { name: 'document', message: 'packages/core runs outside the browser too: inject what you need from the app.' },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
