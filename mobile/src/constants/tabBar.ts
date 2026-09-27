import { Platform } from "react-native";
import { Spacing, TouchTarget } from "./theme";

/**
 * The band at the bottom of a tab screen that the tab bar owns, kept clear of
 * anything the screen lays out by hand.
 *
 * One figure for every tab that needs it (the Home and the two screens of the
 * Digest tab), where each used to carry its own copy.
 *
 * It is written down rather than measured: `NativeTabs` exposes no tab bar
 * height, because the bar is a `UITabBar` / Material `BottomNavigationView` the
 * system lays out itself (task-350).
 *
 * On iOS 26 the bar is a capsule detached from the screen edges with the content
 * passing under it, and a screen whose `SafeAreaView` takes `edges={["top"]}`
 * has a safe area that runs all the way to the screen bottom — the 24 pt a
 * control used to sit at now lands *inside* the glass. `TouchTarget.large` is the
 * strip the capsule itself needs, and it is the same 64 the deleted Android
 * branch of `tabBarStyle` gave a bottom bar; `Spacing.lg` is the gap the capsule
 * floats above the screen bottom plus the room that keeps the content visibly
 * off it rather than tangent to it.
 *
 * On Android the native bottom navigation is opaque and `NativeTabs` already
 * wraps the screen in a `SafeAreaView` with the bottom inset applied, so there is
 * no glass to clear and the old 24 dp margin is still the whole of it. That is
 * the one reason this value branches on the platform.
 */
export const TAB_BAR_CLEARANCE =
  Platform.OS === "ios" ? TouchTarget.large + Spacing.lg : Spacing.lg;
