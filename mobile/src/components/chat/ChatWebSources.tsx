/**
 * "Web pages consulted": the pages an answer cites, under it (task-615, option B
 * of the `chat_web_sources` mockup, validated 2026-11-06).
 *
 * Drawn only when the answer cites at least one web page. One row per page,
 * deduplicated by URL in order of first citation: its title, then its site.
 * A row opens the page in the browser, like the citation in the text.
 *
 * The hairline above it is the mockup's, validated by the owner: it separates
 * what the answer says from what it read, inside one answer, rather than
 * sectioning a screen.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BorderRadius, Spacing, TouchTarget, Typography, type Theme } from "../../constants/theme";
import { useThemeColors, useThemedStyles } from "../../contexts/ThemeContext";
import { t } from "../../i18n";
import type { ChatWebSource } from "@media-summarizer/core/types/chat";
import { webDomain, webTitle } from "@media-summarizer/core/chat/webSources";
import { openWebPage } from "../../lib/openWebPage";

export function ChatWebSources({ sources }: { sources: readonly ChatWebSource[] }): React.JSX.Element | null {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  if (sources.length === 0) return null;
  return (
    <View style={styles.box}>
      <View style={styles.header} accessibilityRole="header">
        <Ionicons name="globe-outline" size={Typography.label.fontSize} color={colors.textSubtle} />
        <Text style={styles.headerLabel}>{t("chat.thread.webSourcesTitle")}</Text>
      </View>
      {sources.map((source) => (
        <Pressable
          key={source.url}
          onPress={() => openWebPage(source)}
          accessibilityRole="link"
          accessibilityLabel={t("chat.thread.openWebSourceA11y", { title: webTitle(source) })}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.title}>{webTitle(source)}</Text>
          <Text style={styles.domain}>{webDomain(source.url)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    box: {
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.outlineVariant,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    headerLabel: {
      fontSize: Typography.small.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textSubtle,
    },
    row: {
      minHeight: TouchTarget.minimum,
      justifyContent: "center",
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
    },
    rowPressed: {
      backgroundColor: Colors.surfaceContainer,
    },
    title: {
      fontSize: Typography.label.fontSize,
      color: Colors.textMain,
    },
    domain: {
      fontSize: Typography.small.fontSize,
      color: Colors.textSubtle,
    },
  });
