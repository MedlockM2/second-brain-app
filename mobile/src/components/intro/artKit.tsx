import { useMemo } from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import type { Theme } from "../../constants/theme";

/**
 * The pieces the intro illustrations are drawn with. Every illustration is laid
 * out in a 414-point-wide box, the width of the mockup (`mobile-design-
 * mockups/onboarding_apres_connexion`): positions below are the mockup's, in its
 * pixels, and each illustration multiplies every length by the `scale` the intro
 * screen gives it (the device's width over 414).
 *
 * Drawn at its final size, never shrunk with `transform: scale`: a transform
 * resamples what is already drawn, and on iOS every Text and every Ionicons glyph
 * is a bitmap at its layout size, so a scaled drawing came out blurred and jagged
 * next to the crisp text above it (TestFlight feedback AOtRbx0iVvGnJhQHFNYLy4Q).
 */
export const ART_WIDTH = 414;
export const ART_HEIGHT = 416;

/**
 * Builds an illustration's style sheet at the scale it is drawn at; `factory` is a
 * module-level constant, so the sheet is rebuilt only when the theme or the scale
 * changes.
 */
export function useArtStyles<T>(factory: (theme: Theme, scale: number) => T, scale: number): T {
  const theme = useTheme();
  return useMemo(() => factory(theme, scale), [factory, theme, scale]);
}

/** A grey line standing for text; its lengths are already scaled. */
export function Bar({ width, height = 6, color }: { width: number | `${number}%`; height?: number; color?: string }) {
  const { colors } = useTheme();
  return <View style={{ width, height, borderRadius: height / 2, backgroundColor: color ?? colors.surfaceContainerHigh }} />;
}

/** The amber halo behind the focal point: three soft ellipses instead of a radial gradient. */
export function Glow({ top, height, scale }: { top: number; height: number; scale: number }) {
  const { colors } = useTheme();
  return <>{[1, 0.72, 0.46].map((ratio) =>
    <View key={ratio} style={{ position: "absolute", left: ((ART_WIDTH - 440 * ratio) / 2) * scale, top: (top + (height - height * ratio) / 2) * scale,
      width: 440 * ratio * scale, height: height * ratio * scale, borderRadius: 999, backgroundColor: colors.primary, opacity: 0.07 }} />)}</>;
}
