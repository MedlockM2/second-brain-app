/**
 * The `+` that creates a folder: a round glass button holding the plus glyph.
 *
 * One component so the library heading of the Search tab and the "My folders"
 * heading of the folder picker draw the same button — the picker had grown its
 * own bare yellow `+` and a tester asked for it to be the Search one.
 *
 * The press feedback is a scale, never an opacity: an alpha below 1 on any
 * ancestor of a `GlassSurface` stops the material rendering (see there), so the
 * disabled state is not faded either.
 */

import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BorderRadius, TouchTarget, type Theme } from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { GlassSurface } from "./GlassSurface";

export const NEW_FOLDER_BUTTON_SIZE = 40;

export interface NewFolderButtonProps {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function NewFolderButton({
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: NewFolderButtonProps): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      <GlassSurface style={styles.surface} tintStyle={styles.tint}>
        <Ionicons name="add" size={22} color={Colors.textMain} />
      </GlassSurface>
    </Pressable>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    button: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      alignItems: "center",
      justifyContent: "center",
      // Pulled into the gutter so the circle, not its invisible target, lines up
      // with the end of the content beside it.
      marginEnd: -(TouchTarget.minimum - NEW_FOLDER_BUTTON_SIZE) / 2,
    },
    pressed: {
      transform: [{ scale: 0.94 }],
    },
    surface: {
      width: NEW_FOLDER_BUTTON_SIZE,
      height: NEW_FOLDER_BUTTON_SIZE,
      borderRadius: BorderRadius.full,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    // On the bare page the tint is the page's own tone: the hairline is its edge.
    tint: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.outlineVariant,
    },
  });
