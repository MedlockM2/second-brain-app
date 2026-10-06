import React from "react";
import { Stack } from "expo-router";
import { useThemeColors } from "../../../src/contexts/ThemeContext";

/**
 * The Digest tab: a choice of period, then the carousel of that period, pushed
 * on a stack of the tab's own (task-409).
 *
 * A stack inside the tab rather than a route of the root stack, because the
 * carousel is still the Digest tab: the tab bar stays under it, tapping the
 * Digest item again pops back to the choice (the `NativeTabs` default), and the
 * other tabs keep their own place while this one is deep.
 *
 * The choice screen is the anchor of the stack. A notification opens the
 * carousel of its period directly, without going through the choice
 * (`usePushNotifications`), and the anchor is what still puts the choice under
 * it — so `‹` and the back gesture lead there from either entry. Nothing
 * remembers the period: a cold start opens on the choice.
 */
export const unstable_settings = {
  anchor: "index",
};

export default function DigestLayout(): React.JSX.Element {
  const Colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[period]"
        options={{
          animation: "slide_from_right",
          // The back gesture from the screen edge only. iOS 26 turns a swipe
          // from anywhere in the content into a back gesture by default, and
          // react-native-screens follows it unless told otherwise: on a screen
          // whose whole business is a horizontal carousel, that would take the
          // swipe to the next media and turn it into a way out.
          fullScreenGestureEnabled: false,
        }}
      />
    </Stack>
  );
}
