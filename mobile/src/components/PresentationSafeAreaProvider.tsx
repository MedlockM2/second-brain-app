/**
 * The safe-area provider of a surface that iOS presents in a view controller of
 * its own: a `fullScreenModal` route, or a React Native `<Modal>`.
 *
 * Such a surface is rendered under the app's root `SafeAreaProvider` in React,
 * but not in UIKit. react-native-screens and `<Modal>` hand its views to
 * `presentViewController`, which moves them out of the root provider's view
 * tree. A `SafeAreaView` finds its provider by walking up its native
 * superviews; finding none, it falls back to its own UIKit insets, and it reads
 * those only when it is attached to the window or receives new props, never
 * when UIKit later settles the safe area of the presented controller. Read
 * while the presentation is still being set up, the insets are zero and stay
 * zero: the header lays out at y = 0 with its close button on the clock and the
 * battery, and the bottom of the screen sits on the home indicator (TestFlight
 * feedback on the "Customize" screen, and on the Unsorted review before
 * task-521).
 *
 * A provider inside the presented surface is what the `SafeAreaView` finds
 * instead. It hears every change UIKit makes to its safe area and passes it on,
 * so the insets settle on the device's own values whatever the order of the
 * events: notch, Dynamic Island, no cutout, Display Zoom. On Android the
 * `SafeAreaView` re-measures against the window insets before every frame, so
 * it never kept a stale value; the provider measures the same full-screen
 * surface and changes nothing there.
 *
 * Wrap the whole presented surface, outermost, so that the provider spans the
 * full screen: a `SafeAreaView` takes the provider's insets as its own.
 * `initialWindowMetrics` is the starting value, so a child that reads the
 * insets with `useSafeAreaInsets` starts from the window's rather than from the
 * provider of the screen underneath.
 */

import type { ReactNode } from "react";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

interface PresentationSafeAreaProviderProps {
  children: ReactNode;
}

export function PresentationSafeAreaProvider({
  children,
}: PresentationSafeAreaProviderProps): React.JSX.Element {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {children}
    </SafeAreaProvider>
  );
}
