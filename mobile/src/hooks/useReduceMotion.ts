import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the user has asked the system for less motion ("Reduce Motion" on
 * iOS, "Remove animations" on Android).
 *
 * Queried once on mount and then kept live, because it is a toggle the user can
 * flip while the app is on screen. Both calls are safe on Android — React
 * Native resolves the query to `false` there when nothing is set and hands back
 * an inert subscription — so this needs no platform guard, and it starts at
 * `false`, which is the only thing an asynchronous query allows.
 *
 * Shared by the looping animations that must stop under that setting: the
 * band that sweeps a cover still being processed (`MediaProcessingSweep`) and
 * the row of an artifact being generated (`ArtifactGeneratingRow`) and the
 * chat's waiting dot (`ChatWaitingIndicator`).
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      // Rejects where there is no native accessibility manager to ask — web, in
      // practice. The default then stands.
      .catch(() => false)
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
