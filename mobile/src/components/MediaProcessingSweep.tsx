import React, { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  I18nManager,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Colors } from "../constants/theme";
import { t } from "../i18n";

/**
 * The marker that says a saved media is still on its way, over the cover of its
 * Home tile (task-402).
 *
 * This is variant **B — « Balayage flou »** of the task-401 mockup
 * (`mobile-design-mockups/home_tile_processing_state/`), the one the owner
 * retained on 2026-09-16 with no requested deviation: no badge and no icon, a
 * sheer translucent band that sweeps the cover in a loop and leaves the real
 * picture visible underneath. The mockup's own argument for not covering the
 * picture is a fact of `HomeTile`: the cover is drawn as soon as `imageUrl`
 * exists, whatever the status, so during the processing of a personal photo the
 * image already *is* the final content — an opaque skeleton would hide data that
 * is already correct.
 *
 * It reuses the one blur idiom the app already has (`expo-blur`, the Top Bar's
 * glassmorphism per DESIGN.md §4) and animates it with the core React Native
 * `Animated`, so it adds no dependency. The 1.9 s period is the mockup's, set
 * well above a generic spinner's ~800 ms because "Amber Clarity … rejects the
 * frantic energy of modern social interfaces" (DESIGN.md §1).
 *
 * The band carries no text and no accessible node: the tile announces the state
 * inside its single label (see `describeWithProcessing`) and prints it in its
 * subtitle line, so a screen reader must not stop here as well.
 *
 * One thing it cannot do is stop on its own. `useMediaPolling` fetches once on
 * mount and then only refetches when the screen regains focus ("V1 design: no
 * recurring network requests while the inbox is open"), so the sweep keeps
 * running until the next refetch even if the server finished in the meantime.
 * That is a property of the repo today, not of this component.
 */

/**
 * How much of the cover's width the band spans: 45 % is the mockup's 90 px over
 * a 200 px cover. A ratio rather than a fixed size so the band keeps its
 * proportions if a caller sweeps a different width.
 */
const SWEEP_BAND_RATIO = 0.45;

/** The mockup's period. See the note above on why it is this slow. */
const SWEEP_DURATION_MS = 1900;

/**
 * `expo-blur`'s `intensity` is a 0-100 scale, not a radius, so the mockup's CSS
 * `blur(6px)` has no exact transcription. This sits below the 60 `GlassSurface`
 * gives the Top Bar and the search pill: those are surfaces that have to hide
 * scrolling content behind their own text, where this one only has to read as a
 * pass of blur over a picture that must stay recognisable.
 */
const SWEEP_BLUR_INTENSITY = 40;

/**
 * Read once at module scope, which is all `I18nManager.isRTL` allows: the flag
 * only takes effect after the bundle reloads (see `applyLayoutDirection` in
 * `src/i18n`), so it cannot change while the app is running. The band is
 * anchored and translated in physical pixels — `transform: translateX` is not
 * direction-aware the way `start`/`end` are — so the direction of travel is
 * flipped here rather than left to the layout.
 */
const SWEEPS_TOWARDS_END = !I18nManager.isRTL;

interface MediaProcessingSweepProps {
  /**
   * Width of the cover being swept, in dp. Passed in rather than measured: the
   * caller declares a fixed tile width, and an `onLayout` round trip would cost
   * a frame with no band on it for no gain.
   */
  width: number;
}

export function MediaProcessingSweep({
  width,
}: MediaProcessingSweepProps): React.JSX.Element {
  const reduceMotion = useReduceMotion();
  // Not a ref: an Animated.Value is created once and read during render, which
  // is exactly `useMemo` and not `useRef().current`.
  const progress = useMemo(() => new Animated.Value(0), []);
  const bandWidth = Math.round(width * SWEEP_BAND_RATIO);

  useEffect(() => {
    if (reduceMotion) return;

    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SWEEP_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();

    // Stopped rather than left running: a horizontal `FlatList` cell is
    // recycled, and an animation nobody draws any more still burns frames.
    return () => loop.stop();
  }, [progress, reduceMotion]);

  // The user has asked the system for less motion, so the band stops being a
  // band: the same material covers the whole cover, still sheer, still leaving
  // the picture legible. Rendering nothing at all would drop the only signal
  // this variant puts on the cover, since it carries neither badge nor icon.
  if (reduceMotion) {
    return (
      <View style={styles.overlay} pointerEvents="none" accessible={false}>
        <SweepMaterial />
      </View>
    );
  }

  return (
    <View style={styles.overlay} pointerEvents="none" accessible={false}>
      <Animated.View
        style={[
          styles.band,
          {
            width: bandWidth,
            transform: [
              {
                // Each pass starts and ends entirely off the cover, so the loop
                // restarting at 0 is never visible as a jump back.
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: SWEEPS_TOWARDS_END
                    ? [-bandWidth, width]
                    : [width, -bandWidth],
                }),
              },
            ],
          },
        ]}
      >
        <SweepMaterial />
      </Animated.View>
    </View>
  );
}

/**
 * The material the band is made of: a blurred backdrop with the sheer veil over
 * it, stacked in that order so the veil lightens the blur rather than being
 * blurred itself — the mockup's `backdrop-filter` under a white background.
 *
 * Android takes the veil alone, for the two reasons `GlassSurface` already
 * documents for the Top Bar: blur support is uneven across devices and vendors
 * there, and it silently degrades when the system disables animations — which
 * is precisely the state this component is in. The task-401 mockup flags the
 * cost of an `expo-blur` animated continuously on Android as the one thing to
 * settle at implementation time; this settles it without losing the sweep, since
 * what carries the signal is the moving band, not the blur inside it.
 */
function SweepMaterial(): React.JSX.Element {
  return (
    <>
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={SWEEP_BLUR_INTENSITY}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.veil]} />
    </>
  );
}

/**
 * Whether the user has asked the system for less motion.
 *
 * Same shape as `GlassSurface`'s reduce-transparency reader: queried once on
 * mount and then kept live, because it is a toggle the user can flip while the
 * app is on screen. Both calls are safe on Android — React Native resolves the
 * query to `false` and hands back an inert subscription — so this needs no
 * platform guard, and it starts at `false`, which is the only thing an
 * asynchronous query allows.
 */
function useReduceMotion(): boolean {
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

/**
 * The library-entry statuses that are still on their way, and the only ones.
 *
 * Sibling of `isFailedLibraryStatus`, and disjoint from it by construction:
 * `ready_for_artifacts` is the norm and `failed` has its own marker, so neither
 * belongs here. `cancelled` is left out too, and that is a decision rather than
 * an omission — a cancelled import is not on its way any more, and sweeping its
 * cover would promise a result that is never coming. A vignette with no status
 * at all is a search hit or an engagement entry, which carry none by contract.
 */
export function isProcessingLibraryStatus(status?: string | null): boolean {
  return (
    status === "ingested" || status === "resolving" || status === "processing"
  );
}

/**
 * The vignette's accessibility label, with the processing state folded into it.
 *
 * Pendant of `describeWithFailure`, and a wrapper key for the same reason: where
 * the clause goes and what separates it from what precedes it is a property of
 * the language, and the four base labels already in the catalogues stay the
 * single source of the sentence. It matters more here than for a failure: this
 * variant puts its visible state text in the tile's subtitle, and the tile's
 * single `accessibilityLabel` means a screen reader never reaches that line.
 */
export function describeWithProcessing(
  label: string,
  processing: boolean,
): string {
  return processing ? t("mediaStatus.a11yProcessing", { label }) : label;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // The cover already clips to its own radius; this clips again so the band
    // cannot paint past the overlay's box on either platform.
    overflow: "hidden",
  },
  band: {
    position: "absolute",
    top: 0,
    bottom: 0,
    // Physical, not `start`: the band is placed by the same axis that
    // `translateX` moves it along. See `SWEEPS_TOWARDS_END`.
    left: 0,
  },
  veil: {
    backgroundColor: Colors.processingVeil,
  },
});
