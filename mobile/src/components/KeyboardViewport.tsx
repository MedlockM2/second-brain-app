import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useKeyboardViewport } from "../hooks/useKeyboardViewport";

export interface KeyboardViewportHandle {
  refresh: () => void;
}

interface KeyboardViewportProps {
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: ReactNode | ((keyboardVisible: boolean) => ReactNode);
}

/** Measure the unmodified host, resize only its content: no feedback/double resize. */
export const KeyboardViewport = forwardRef<KeyboardViewportHandle, KeyboardViewportProps>(
  function KeyboardViewport({ active = true, style, contentContainerStyle, children }, ref) {
    const viewport = useRef<View>(null);
    const keyboard = useKeyboardViewport(viewport, active);
    useImperativeHandle(ref, () => ({ refresh: keyboard.refresh }), [keyboard.refresh]);

    return (
      <View
        ref={viewport}
        style={[styles.fill, style]}
        onLayout={keyboard.measure}
        pointerEvents="box-none"
        collapsable={false}
      >
        <View
          style={[
            styles.fill,
            contentContainerStyle,
            keyboard.height !== null && { flex: 0, height: keyboard.height },
          ]}
          pointerEvents="box-none"
        >
          {typeof children === "function" ? children(keyboard.keyboardVisible) : children}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({ fill: { flex: 1 } });
