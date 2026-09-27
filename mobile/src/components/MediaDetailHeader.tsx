/**
 * The media route's title bar while the item is on its way: the back arrow,
 * alone.
 *
 * The route (`app/media/[id].tsx`) draws it over its loading, processing,
 * timeout and failure states, and the Digest carousel
 * (`app/(tabs)/digest/[period].tsx`) over the same states of a page and over
 * its own loading, failure and empty states. The resolved item never uses it:
 * its page opens on the cover, and its back and `…` float over that picture
 * (`MediaDetailHero`, task-411) before collapsing into `MediaReaderBar`. The
 * lifecycle states hold no title to seed a rename field with and nothing to file
 * yet, so the arrow is all they need.
 *
 * The size of its button is exported: the glass buttons over the cover and the
 * back arrow of the collapsed bar are the same control on another material, and
 * one number is what keeps the arrow from jumping by a few points when the
 * processing state hands over to the page.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BorderRadius,
  Colors,
  Spacing,
  TouchTarget,
} from "../constants/theme";
import { t } from "../i18n";

/**
 * The drawn size of a media-page top-bar button. The touch area reaches past
 * `TouchTarget.minimum` through `MEDIA_HEADER_BUTTON_HIT_SLOP` rather than by
 * growing the circle, which would make every bar taller.
 */
export const MEDIA_HEADER_BUTTON_SIZE = 44;
export const MEDIA_HEADER_BUTTON_HIT_SLOP = Spacing.xs;

export function MediaDetailHeader({
  onBack,
}: {
  onBack: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.headerButton}
        onPress={onBack}
        accessibilityLabel={t("common.goBack")}
        accessibilityRole="button"
        hitSlop={MEDIA_HEADER_BUTTON_HIT_SLOP}
      >
        <Ionicons name="arrow-back" size={24} color={Colors.textMain} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: TouchTarget.comfortable,
  },
  headerButton: {
    width: MEDIA_HEADER_BUTTON_SIZE,
    height: MEDIA_HEADER_BUTTON_SIZE,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
});
