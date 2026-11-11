import { Stack } from "expo-router";
import { PresentationSafeAreaProvider } from "../../src/components/PresentationSafeAreaProvider";
import { useThemeColors } from "../../src/contexts/ThemeContext";

export const unstable_settings = { anchor: "index" };

/** Review and its reader share one full-screen presentation and its own safe-area provider. */
export default function ReviewLayout() {
  const colors = useThemeColors();
  return (
    <PresentationSafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="media/[id]" options={{ animation: "slide_from_right", fullScreenGestureEnabled: false }} />
      </Stack>
    </PresentationSafeAreaProvider>
  );
}
