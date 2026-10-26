import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ArtifactSource } from "@media-summarizer/core/artifacts/sources";
import { formatDuration } from "@media-summarizer/core/i18n/duration";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { t } from "../i18n";
import {
  mediaTypeIconName,
  mediaTypeLabelKey,
} from "@media-summarizer/core/media/mediaDisplay";
import { resolveMediaTitle } from "../lib/mediaTitle";
import { HeaderIconButton, ScreenHeader } from "./ScreenHeader";

export function ArtifactSourcePicker({
  sources,
  selected,
  loading,
  error,
  single,
  disabled,
  onRetry,
  onChange,
}: {
  sources: readonly ArtifactSource[];
  selected: ReadonlySet<string>;
  loading: boolean;
  error: boolean;
  single: boolean;
  disabled: boolean;
  onRetry: () => void;
  onChange: (ids: Set<string>) => void;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const close = () => setDraft(null);
  return (
    <>
      <Text style={styles.label}>{t("artifacts.customize.sources")}</Text>
      <Pressable
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel={t("artifacts.customize.sources")}
        disabled={disabled || loading || error}
        onPress={() => setDraft(new Set(selected))}
      >
        <Ionicons name="documents-outline" size={20} color={colors.textMain} />
        <Text style={styles.text}>{single ? 1 : selected.size}</Text>
        {loading ? (
          <ActivityIndicator color={colors.textMain} />
        ) : (
          <Ionicons name="chevron-down" size={18} color={colors.textMain} />
        )}
      </Pressable>
      {error ? (
        <View>
          <Text style={styles.error} accessibilityRole="alert">
            {t("artifacts.customize.sourcesFailed")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.retry")}
            style={styles.control}
            onPress={onRetry}
          >
            <Text style={styles.text}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : null}
      <Modal
        visible={draft !== null}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          />
          <SafeAreaView style={styles.sheet} edges={["bottom"]}>
            <ScreenHeader
              title={t("artifacts.customize.sources")}
              trailing={
                <HeaderIconButton
                  icon="close"
                  variant="plain"
                  onPress={close}
                  accessibilityLabel={t("common.close")}
                />
              }
            />
            {!single ? (
              <View style={styles.header}>
                <Text style={styles.text}>
                  {t("artifacts.customize.selectedSources", {
                    selected: draft?.size ?? 0,
                    total: sources.length,
                  })}
                </Text>
                <Pressable
                  style={styles.control}
                  accessibilityRole="button"
                  accessibilityLabel={t("artifacts.customize.selectAll")}
                  onPress={() =>
                    setDraft(new Set(sources.map((s) => s.media_item_id)))
                  }
                >
                  <Text style={styles.text}>
                    {t("artifacts.customize.selectAll")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <ScrollView contentContainerStyle={styles.list}>
              {sources.map((source) => {
                const checked = draft?.has(source.media_item_id) ?? false;
                return (
                  <Pressable
                    key={source.media_item_id}
                    style={styles.row}
                    accessibilityRole="checkbox"
                    accessibilityLabel={resolveMediaTitle(source)}
                    accessibilityState={{ checked, disabled: single }}
                    disabled={single}
                    onPress={() =>
                      setDraft((current) => {
                        const next = new Set(current);
                        if (next.has(source.media_item_id))
                          next.delete(source.media_item_id);
                        else next.add(source.media_item_id);
                        return next;
                      })
                    }
                  >
                    {source.media_image ? (
                      <Image
                        source={{ uri: source.media_image }}
                        style={styles.cover}
                      />
                    ) : (
                      <View style={styles.cover}>
                        <Ionicons
                          name={
                            mediaTypeIconName(
                              source.media_type,
                            ) as keyof typeof Ionicons.glyphMap
                          }
                          size={24}
                          color={colors.textMain}
                        />
                      </View>
                    )}
                    <View style={styles.grow}>
                      <Text style={styles.text} numberOfLines={2}>
                        {resolveMediaTitle(source)}
                      </Text>
                      <Text style={styles.meta}>
                        {t(mediaTypeLabelKey(source.media_type))}
                        {source.duration_seconds
                          ? ` · ${formatDuration(source.duration_seconds)}`
                          : ""}
                      </Text>
                    </View>
                    <Ionicons
                      name={checked ? "checkbox" : "square-outline"}
                      size={24}
                      color={colors.textMain}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={styles.confirm}
              accessibilityRole="button"
              accessibilityLabel={t("artifacts.customize.confirmSources", {
                count: draft?.size ?? 0,
              })}
              accessibilityState={{ disabled: !draft?.size }}
              disabled={!draft?.size}
              onPress={() => {
                if (draft?.size) onChange(draft);
                close();
              }}
            >
              <Text style={styles.confirmText}>
                {t("artifacts.customize.confirmSources", {
                  count: draft?.size ?? 0,
                })}
              </Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    label: {
      ...Typography.body,
      fontWeight: "600",
      color: colors.textMain,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    text: { ...Typography.body, color: colors.textMain },
    meta: { ...Typography.small, color: colors.textSubtle },
    error: { ...Typography.small, color: colors.error },
    control: {
      minHeight: TouchTarget.minimum,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.surfaceContainerLow,
      flexDirection: "row",
      gap: Spacing.md,
      alignItems: "center",
    },
    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.textMain,
      opacity: 0.35,
    },
    sheet: {
      maxHeight: "85%",
      backgroundColor: colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
    },
    header: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    list: { padding: Spacing.lg, gap: Spacing.md },
    row: {
      minHeight: TouchTarget.minimum,
      flexDirection: "row",
      gap: Spacing.md,
      alignItems: "center",
    },
    cover: {
      width: TouchTarget.comfortable,
      height: TouchTarget.minimum,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.surfaceContainerLow,
      alignItems: "center",
      justifyContent: "center",
    },
    grow: { flex: 1 },
    confirm: {
      minHeight: TouchTarget.minimum,
      margin: Spacing.lg,
      padding: Spacing.md,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmText: { ...Typography.label, color: colors.onPrimary },
  });
