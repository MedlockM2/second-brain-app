import { Stack } from "expo-router";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { useThemeColors } from "../../src/contexts/ThemeContext";

export const unstable_settings = { anchor: "index" };

/** Review and its reader share one full-screen presentation and measured safe area. */
export default function ReviewLayout() {
  const colors = useThemeColors();
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="media/[id]" options={{ animation: "slide_from_right", fullScreenGestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
