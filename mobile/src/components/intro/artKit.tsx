import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * The pieces the intro illustrations are drawn with. Every illustration is laid
 * out in a fixed 414-point-wide box, the width of the mockup (`mobile-design-
 * mockups/onboarding_apres_connexion`), and the intro screen scales the box to
 * the device: positions below are the mockup's, in its pixels.
 */
export const ART_WIDTH = 414;
export const ART_HEIGHT = 416;

/** A grey line standing for text. */
export function Bar({ width, height = 6, color }: { width: number | `${number}%`; height?: number; color?: string }) {
  const { colors } = useTheme();
  return <View style={{ width, height, borderRadius: height / 2, backgroundColor: color ?? colors.surfaceContainerHigh }} />;
}

/** The amber halo behind the focal point: three soft ellipses instead of a radial gradient. */
export function Glow({ top, height }: { top: number; height: number }) {
  const { colors } = useTheme();
  return <>{[1, 0.72, 0.46].map((scale) =>
    <View key={scale} style={{ position: "absolute", left: (ART_WIDTH - 440 * scale) / 2, top: top + (height - height * scale) / 2,
      width: 440 * scale, height: height * scale, borderRadius: 999, backgroundColor: colors.primary, opacity: 0.07 }} />)}</>;
}
