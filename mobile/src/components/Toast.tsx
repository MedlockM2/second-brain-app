/**
 * The short-lived pill that confirms a folder move, or reports what went wrong
 * with one, without asking the user to dismiss anything.
 *
 * It used to live inside the media page alone. The "New folder" row of the
 * media actions menu (task-437) files a media without leaving the screen it was
 * pressed on, so every surface that mounts that menu needs the same pill to say
 * where the media went — hence one component and one hook, and no second copy
 * of the fade.
 *
 * Not a modal, on purpose: a failure reported through it survives the naming
 * dialog closing in the same frame, which an iOS alert presented over that
 * dialog would not.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BorderRadius,
  Spacing,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";

export type ToastTone = "success" | "error";

/** Shows a message in the screen's pill. */
export type ShowToast = (message: string, tone?: ToastTone) => void;

interface ToastState {
  message: string;
  tone: ToastTone;
}

export interface ToastProps {
  toast: ToastState | null;
  opacity: Animated.Value;
  /** Distance from the top of the screen, which only the screen knows. */
  top: number;
}

/**
 * The state behind one screen's pill. `toastProps` is spread onto `<Toast />`,
 * alongside the `top` the screen picks.
 */
export function useToast(): {
  showToast: ShowToast;
  toastProps: Omit<ToastProps, "top">;
} {
  // The tone only swaps the glyph and its colour: one surface carries both the
  // confirmations and the failures, instead of a second banner for errors.
  const [toast, setToast] = useState<ToastState | null>(null);
  // Not a ref: an Animated.Value is created once and read during render, which
  // is exactly `useMemo` and not `useRef().current`.
  const opacity = useMemo(() => new Animated.Value(0), []);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback<ShowToast>(
    (message, tone = "success") => {
      setToast({ message, tone });
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 2500);
    },
    [opacity],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { showToast, toastProps: { toast, opacity } };
}

export function Toast({
  toast,
  opacity,
  top,
}: ToastProps): React.JSX.Element | null {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  if (!toast) return null;

  return (
    <View style={[styles.layer, { top }]} pointerEvents="none">
      <Animated.View style={[styles.pill, { opacity }]}>
        <Ionicons
          name={toast.tone === "error" ? "alert-circle" : "checkmark-circle"}
          size={16}
          color={toast.tone === "error" ? Colors.error : Colors.primary}
        />
        <Text style={styles.text}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    layer: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
      // Gutters, so a long failure message wraps instead of running off screen.
      paddingHorizontal: Spacing.lg,
      zIndex: 2,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      backgroundColor: Colors.surfaceContainer,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
    },
    text: {
      // Shrinks so the text wraps beside the glyph rather than pushing past it.
      flexShrink: 1,
      fontSize: Typography.small.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textMain,
    },
  });
