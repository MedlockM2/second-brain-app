import { useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemedStyles } from "../contexts/ThemeContext";
import { BorderRadius, type Theme } from "../constants/theme";
import { t } from "../i18n";

export const CODE_LENGTH = 6;

/**
 * Six boxes over one invisible field: the field keeps `oneTimeCode`, so iOS
 * offers the code it read in Mail and Android its SMS/e-mail autofill, and a
 * pasted code lands in one go. The boxes only draw what the field holds.
 */
export function OtpInput({ value, onChange, editable = true, invalid = false, testID }: {
  value: string;
  onChange: (code: string) => void;
  editable?: boolean;
  invalid?: boolean;
  testID?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const input = useRef<TextInput>(null);
  return <Pressable onPress={() => input.current?.focus()} accessible={false}>
    <View style={styles.row}>
      {Array.from({ length: CODE_LENGTH }, (_, index) => {
        const current = index === Math.min(value.length, CODE_LENGTH - 1);
        return <View key={index} style={[styles.box, current && editable && styles.boxCurrent, invalid && styles.boxInvalid]}>
          <Text style={styles.digit}>{value[index] ?? ""}</Text>
        </View>;
      })}
    </View>
    <TextInput
      ref={input}
      testID={testID}
      style={styles.hidden}
      value={value}
      onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, CODE_LENGTH))}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={CODE_LENGTH}
      autoFocus
      editable={editable}
      caretHidden
      accessibilityLabel={t("auth.code")}
    />
  </Pressable>;
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  box: { flex: 1, aspectRatio: 0.86, maxHeight: 64, borderRadius: BorderRadius.lg, borderWidth: 1,
    borderColor: colors.outlineVariant, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  boxCurrent: { borderColor: colors.primary, borderWidth: 2 },
  boxInvalid: { borderColor: colors.error },
  digit: { fontSize: 26, fontWeight: "700", color: colors.textMain },
  // Covers the boxes so a long press still offers "Paste", yet draws nothing.
  hidden: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity: 0.02, color: "transparent" },
});
