// Expo's default Metro config, wrapped by Sentry (task-413).
//
// `getSentryExpoConfig` calls `expo/metro-config`'s `getDefaultConfig` itself and
// adds a serializer step that stamps a debug ID into every bundle and its source
// map. That ID is what Sentry matches a stack trace to a source map by, for both
// kinds of bundle this app ships: the one `eas build` embeds (uploaded by the
// native build phases the `@sentry/react-native/expo` plugin adds) and the one
// `eas update` publishes (uploaded by `sentry-expo-upload-sourcemaps` in
// .github/workflows/mobile-ota-or-build.yml). The OTA case is the one that needs
// it: an update runs under the release and dist of the binary it lands on, so
// matching by release would pick the embedded bundle's map, which describes
// different code.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

module.exports = config;
