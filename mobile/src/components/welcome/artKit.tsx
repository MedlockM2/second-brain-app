import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * The pieces the welcome illustrations are drawn with. Every illustration is laid
 * out in a fixed 414 × 416 box, the size of the mockup (`mobile-design-mockups/
 * auth_directions/direction_c_finale`), and the welcome screen scales the box to
 * the device: positions below are the mockup's, in its pixels.
 */
export const ART_WIDTH = 414;
export const ART_HEIGHT = 416;

type IconName = keyof typeof Ionicons.glyphMap;

/** A white card lifted off the background, absolutely placed. */
export function Card({ style, children }: { style: StyleProp<ViewStyle>; children?: ReactNode }) {
  const { colors, shadows } = useTheme();
  return <View style={[{ position: "absolute", backgroundColor: colors.surface, borderRadius: 16 }, shadows.soft, style]}>{children}</View>;
}

/** A grey line standing for text. */
export function Bar({ width, height = 6, color }: { width: number | `${number}%`; height?: number; color?: string }) {
  const { colors } = useTheme();
  return <View style={{ width, height, borderRadius: height / 2, backgroundColor: color ?? colors.surfaceContainerHigh }} />;
}

/** An amber disc carrying an icon: the title marker of the cards. */
export function AmberDot({ icon, size = 22 }: { icon: IconName; size?: number }) {
  const { colors } = useTheme();
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
    <Ionicons name={icon} size={Math.round(size * 0.6)} color={colors.onPrimary} />
  </View>;
}

/** The title row of a card: amber disc, then a short bold label. */
export function CardHead({ icon, label, size = 22 }: { icon: IconName; label: string; size?: number }) {
  const { colors } = useTheme();
  return <View style={styles.head}>
    <AmberDot icon={icon} size={size} />
    <Text numberOfLines={1} style={[styles.headText, { color: colors.textMain }]}>{label}</Text>
  </View>;
}

/** The amber halo behind the focal point: three soft ellipses instead of a radial gradient. */
export function Glow({ top, height }: { top: number; height: number }) {
  const { colors } = useTheme();
  return <>{[1, 0.72, 0.46].map((scale) =>
    <View key={scale} style={{ position: "absolute", left: (ART_WIDTH - 440 * scale) / 2, top: top + (height - height * scale) / 2,
      width: 440 * scale, height: height * scale, borderRadius: 999, backgroundColor: colors.primary, opacity: 0.07 }} />)}</>;
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 7 },
  headText: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
});
