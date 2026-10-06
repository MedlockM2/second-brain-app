/**
 * The media page once its Reader / AI segment has scrolled away: one bar
 * instead of a header and a sticky segment.
 *
 * Direction C of the task-410 benchmark, as retained for task-411. The band of
 * `MediaDetailHero` "retracts" into this: back, a 32pt thumbnail of the same
 * cover, the title on one line, the Reader / AI segment folded to its two
 * glyphs, and a 4pt reading progress along the bottom edge. 112pt of fixed
 * chrome on an iPhone 11 where the header and the sticky segment took 180.
 *
 * It is a fixed layer over the page that fades in, not a block whose height
 * changes: only opacity and transforms run on the native driver, so the host
 * interpolates the fade from the scroll offset and hands it down. The whole bar
 * fades in at once, and only once the page's own Reader / AI segment slides
 * under it — so the title and the segment are never on screen twice.
 *
 * Hidden means hidden to everyone: while transparent the bar takes no touches
 * and is out of the accessibility tree, so the controls over the cover under it
 * stay reachable and a screen reader never lands on an invisible back button.
 */

import React from "react";
import {
  Animated,
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenTabs, type ScreenTab } from "./ScreenTabs";
import { MediaCoverImage, type MediaCover } from "./MediaDetailHero";
import {
  MEDIA_HEADER_BUTTON_HIT_SLOP,
  MEDIA_HEADER_BUTTON_SIZE,
} from "./MediaDetailHeader";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { t } from "../i18n";

/** The height of the bar under the status bar. */
export const MEDIA_READER_BAR_HEIGHT = TouchTarget.large;

/** 32pt, the thumbnail of the mockup: the cover recognisable, not readable. */
const THUMB_SIZE = Spacing.xl;

type Fade = Animated.AnimatedInterpolation<number> | number;

interface MediaReaderBarProps<K extends string> {
  /** The status bar height when the page draws under it, else 0. */
  topInset: number;
  opacity: Fade;
  /** Whether the bar currently takes touches and is announced. */
  visible: boolean;
  onBack: () => void;
  title: string;
  cover: MediaCover | null;
  onCoverError: () => void;
  mediaTypeIcon: keyof typeof Ionicons.glyphMap;
  tabs: readonly ScreenTab<K>[];
  activeKey: K;
  onTabChange: (key: K) => void;
  tabsAccessibilityLabel: string;
  /** 0 to 1; `null` hides the progress (the AI tab is not read through). */
  progress: Fade | null;
  /** The same progress, rounded, for screen readers. */
  progressPercent: number;
}

export function MediaReaderBar<K extends string>({
  topInset,
  opacity,
  visible,
  onBack,
  title,
  cover,
  onCoverError,
  mediaTypeIcon,
  tabs,
  activeKey,
  onTabChange,
  tabsAccessibilityLabel,
  progress,
  progressPercent,
}: MediaReaderBarProps<K>): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <Animated.View
      style={[styles.bar, { opacity }]}
      pointerEvents={visible ? "auto" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <View style={[styles.surface, { paddingTop: topInset }]}>
        <View style={styles.row}>
          <Pressable
            style={styles.backButton}
            onPress={onBack}
            hitSlop={MEDIA_HEADER_BUTTON_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t("common.goBack")}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textMain} />
          </Pressable>

          <View
            style={styles.thumb}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            {cover ? (
              <MediaCoverImage
                cover={cover}
                onError={onCoverError}
                style={styles.thumbImage}
              />
            ) : (
              <Ionicons name={mediaTypeIcon} size={18} color={Colors.textMuted} />
            )}
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          <ScreenTabs
            tabs={tabs}
            activeKey={activeKey}
            onChange={onTabChange}
            accessibilityLabel={tabsAccessibilityLabel}
            iconOnly
          />
        </View>

        {progress !== null ? (
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityLabel={t("media.readingProgressA11y")}
            accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
          >
            <Animated.View
              style={[styles.progressFill, { transform: [{ scaleX: progress }] }]}
            />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) =>
  StyleSheet.create({
    // The one floating layer of the page, hence the one soft shadow.
    bar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1,
      ...Shadows.soft,
    },
    // Opaque: the page scrolls under this bar, and a cover seen through it
    // made the title unreadable.
    surface: {
      overflow: "hidden",
      backgroundColor: Colors.background,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      minHeight: MEDIA_READER_BAR_HEIGHT,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    backButton: {
      width: MEDIA_HEADER_BUTTON_SIZE,
      height: MEDIA_HEADER_BUTTON_SIZE,
      borderRadius: BorderRadius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: BorderRadius.sm,
      backgroundColor: Colors.surfaceContainerLow,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    thumbImage: {
      width: "100%",
      height: "100%",
    },
    // The only element of the row allowed to shrink: a long title costs an
    // ellipsis here, never a collision with the segment. The whole title is one
    // scroll away, at the top of the page.
    title: {
      flex: 1,
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
    },
    progressTrack: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: Spacing.xs,
      backgroundColor: Colors.surfaceContainerLow,
    },
    // Scaled from the reading edge, which is the right one in Arabic.
    progressFill: {
      height: "100%",
      backgroundColor: Colors.primary,
      transformOrigin: I18nManager.isRTL ? "right" : "left",
    },
  });
