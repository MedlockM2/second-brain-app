/**
 * The top of a media page: the cover, edge to edge, and what names the source.
 *
 * Direction C of the task-410 benchmark ("Bandeau rétractable"), the one the
 * owner picked for task-411. The band runs under the status bar; the creator and
 * the title sit at the bottom of the picture on a strip of the `GlassSurface`
 * material; back and `…` float over its top on the same material. Under the band,
 * one line carries the way back to the original and everything else worth
 * knowing about the source — date, duration, language, length — which the page
 * used to split between a chip, the hero and a second line above the transcript.
 * Once the band has scrolled away, `MediaReaderBar` takes over at the top.
 *
 * ## The picture
 *
 * The one image of the detail contract, `media_item.media_image` — no favicon, no
 * creator avatar, no second field (task-410 §2.3). It is cropped `cover`,
 * centred, and loaded under the key the lists use, so a page opened from a list
 * finds it already on disk.
 *
 * The band is 4:3 on a screen at least twice as tall as it is wide — every
 * current phone — and 16:9 on the shorter 16:9-class screens (iPhone SE, and the
 * 320pt width in Display Zoom), where a 4:3 band would take close to half the
 * screen. On a 16:9 band the title no longer fits on the picture and moves under
 * it, onto the page background; it does the same on a 4:3 band once it needs
 * more than two lines, which is what large Dynamic Type sizes do to it.
 *
 * With no picture — none in the contract, or one that failed to load — the band
 * shrinks to 96pt of `surfaceContainerLow` carrying the type glyph, and the title
 * sits under it. The glyph is decorative (2.6:1 on its tone), so the eyebrow
 * writes the type out in that case. While a picture is loading the band keeps
 * its full size as a bare tonal frame: no spinner, no placeholder.
 *
 * ## The status bar
 *
 * A picture under the status bar needs protecting, and the benchmark named the
 * only two ways to draw a gradient in React Native: `expo-linear-gradient`, a
 * native module and therefore a new binary, or `experimental_backgroundImage`,
 * which React Native marks as not for production. Neither is used. The scrim is
 * a stack of `textMain` strips whose opacity falls from 50% to 0 — the ramp the
 * mockup specifies — which keeps the page shippable over the air and every colour
 * a token. The host switches the status bar to light while the picture is under
 * it.
 */

import React, { useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextLayoutEventData,
} from "react-native";
import { Image, type ImageStyle } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "./GlassSurface";
import { MENU_GLYPH } from "./ScreenHeader";
import {
  MEDIA_HEADER_BUTTON_HIT_SLOP,
  MEDIA_HEADER_BUTTON_SIZE,
} from "./MediaDetailHeader";
import type { AnchorRect } from "./AnchoredContextMenu";
import {
  BorderRadius,
  Colors,
  Spacing,
  TouchTarget,
  Typography,
} from "../constants/theme";
import { t } from "../i18n";

type IoniconName = keyof typeof Ionicons.glyphMap;

/** The picture of a media, as the page loads it. */
export interface MediaCover {
  uri: string;
  /**
   * `<media_item_id>:<updated_at>`, the key every list builds for the same
   * picture: stable across the rotating signature of a re-hosted cover, and
   * renewed when the item — and so possibly its cover — changes.
   */
  cacheKey: string;
  /** The media id, so a recycled view never shows the previous item's picture. */
  recyclingKey: string;
}

/**
 * The band's box. `tall` is the 4:3 band, `short` the 16:9 one, `fallback` the
 * 96pt band of a media without a picture.
 */
export interface CoverBandLayout {
  /** Height of the band, the status bar included when the page draws under it. */
  height: number;
  shape: "tall" | "short" | "fallback";
}

/**
 * A screen at least this many times taller than wide gets the 4:3 band.
 *
 * It separates the two families of phone the benchmark drew: the tall ones
 * (19.5:9 and the like, ratio above 2) and the 16:9 ones (ratio 1.78), where a
 * 4:3 band would leave the title and the metadata under the fold.
 */
const TALL_SCREEN_RATIO = 2;

/** 96pt: a glyph does not justify the height of a picture (task-410 §2.3). */
const FALLBACK_BAND_HEIGHT = Spacing.xxl * 2;
const FALLBACK_GLYPH_SIZE = 32;

/**
 * Past two lines the title covers most of the picture it sits on: it moves under
 * the band instead (task-410 §12, large text sizes).
 */
const MAX_TITLE_LINES_ON_COVER = 2;

/** The opacity the scrim starts from under the status bar, per the mockup. */
const SCRIM_MAX_OPACITY = 0.5;
/**
 * Strips in the scrim. Twelve over ~100pt is a step of about 4% opacity every
 * 8pt, which a photograph hides entirely.
 */
const SCRIM_STEPS = 12;
const SCRIM_STEP_OPACITIES = Array.from(
  { length: SCRIM_STEPS },
  (_, index) => SCRIM_MAX_OPACITY * (1 - (index + 0.5) / SCRIM_STEPS),
);

export function getCoverBandLayout({
  windowWidth,
  windowHeight,
  topInset,
  hasCover,
}: {
  windowWidth: number;
  windowHeight: number;
  /** The status bar height when the page draws under it, else 0. */
  topInset: number;
  hasCover: boolean;
}): CoverBandLayout {
  if (!hasCover) {
    return { height: topInset + FALLBACK_BAND_HEIGHT, shape: "fallback" };
  }
  const tall = windowHeight >= windowWidth * TALL_SCREEN_RATIO;
  const pictureHeight = Math.round(
    tall ? (windowWidth * 3) / 4 : (windowWidth * 9) / 16,
  );
  return { height: topInset + pictureHeight, shape: tall ? "tall" : "short" };
}

/**
 * A cover, drawn. The band and the thumbnail of the collapsed bar load the same
 * picture with the same props; one component keeps them from drifting apart.
 * Decorative: the title next to it already says what it shows.
 */
export function MediaCoverImage({
  cover,
  onError,
  style,
}: {
  cover: MediaCover;
  onError: () => void;
  style: StyleProp<ImageStyle>;
}): React.JSX.Element {
  return (
    <Image
      source={{ uri: cover.uri, cacheKey: cover.cacheKey }}
      recyclingKey={cover.recyclingKey}
      cachePolicy="memory-disk"
      contentFit="cover"
      transition={150}
      style={style}
      onError={onError}
      accessible={false}
    />
  );
}

interface MediaDetailHeroProps {
  layout: CoverBandLayout;
  /** The status bar height when the page draws under it, else 0. */
  topInset: number;
  /** `null` when there is no picture to draw, or it failed to load. */
  cover: MediaCover | null;
  onCoverError: () => void;
  mediaTypeIcon: IoniconName;
  /** Over the title: the creator, or the type written out. */
  eyebrow: string;
  title: string;
  /** Host of an original the OS can open; `null` when there is none. */
  sourceHost: string | null;
  onOpenSource: () => void;
  /** Date, duration, language, length — whichever are known, in that order. */
  details: readonly string[];
  onBack: () => void;
  onActionsPress: (anchor: AnchorRect) => void;
}

export function MediaDetailHero({
  layout,
  topInset,
  cover,
  onCoverError,
  mediaTypeIcon,
  eyebrow,
  title,
  sourceHost,
  onOpenSource,
  details,
  onBack,
  onActionsPress,
}: MediaDetailHeroProps): React.JSX.Element {
  // How many lines the title takes, for the title it was measured on: a rename
  // has to be measured again before it is trusted.
  const [titleFit, setTitleFit] = useState<{
    title: string;
    lines: number;
  } | null>(null);
  const measuredLines = titleFit?.title === title ? titleFit.lines : null;
  const titleOnCover =
    layout.shape === "tall" &&
    cover !== null &&
    (measuredLines === null || measuredLines <= MAX_TITLE_LINES_ON_COVER);

  // Both placements have the same width, so a measure taken in one holds in the
  // other and the title cannot bounce between them.
  const handleTitleLayout = (
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    const lines = event.nativeEvent.lines.length;
    setTitleFit((previous) =>
      previous?.title === title && previous.lines === lines
        ? previous
        : { title, lines },
    );
  };

  const titleBlock = (
    <>
      {eyebrow ? (
        <Text style={styles.eyebrow} numberOfLines={2}>
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={styles.title}
        accessibilityRole="header"
        onTextLayout={handleTitleLayout}
      >
        {title}
      </Text>
    </>
  );

  return (
    <View>
      <View style={[styles.band, { height: layout.height }]}>
        {cover && layout.shape !== "fallback" ? (
          <MediaCoverImage
            cover={cover}
            onError={onCoverError}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[styles.fallback, { paddingTop: topInset }]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <Ionicons
              name={mediaTypeIcon}
              size={FALLBACK_GLYPH_SIZE}
              color={Colors.textMuted}
            />
          </View>
        )}

        {/* Only over a picture, and only where there is a status bar to
            protect: a tonal fallback band is light enough for dark icons. */}
        {cover && layout.shape !== "fallback" && topInset > 0 ? (
          <StatusBarScrim height={topInset + TouchTarget.comfortable} />
        ) : null}

        {/* The controls come first in the tree so a screen reader reaches back
            and the menu before the title; they sit at opposite ends of the band
            from it, so the order draws nothing over anything. */}
        <View
          style={[styles.controls, { top: topInset + Spacing.sm }]}
          pointerEvents="box-none"
        >
          <GlassButton
            icon="arrow-back"
            accessibilityLabel={t("common.goBack")}
            onPress={onBack}
          />
          <GlassMenuButton onPress={onActionsPress} />
        </View>

        {titleOnCover ? (
          // Invisible until measured: a title that turns out to need a third
          // line is drawn under the band from its first visible frame instead
          // of jumping there.
          <GlassSurface
            style={[styles.titleBand, measuredLines === null && styles.unmeasured]}
          >
            {titleBlock}
          </GlassSurface>
        ) : null}
      </View>

      {titleOnCover ? null : <View style={styles.titleBelow}>{titleBlock}</View>}

      {sourceHost || details.length > 0 ? (
        <View style={styles.metaLine}>
          {sourceHost ? (
            <Pressable
              style={({ pressed }) => [
                styles.sourceLink,
                pressed && styles.sourceLinkPressed,
              ]}
              onPress={onOpenSource}
              accessibilityRole="link"
              accessibilityLabel={t("media.openSourceA11y", {
                host: sourceHost,
              })}
              // The line is ~18pt tall by design; the slop takes the touch area
              // past the 48pt floor without making the line taller.
              hitSlop={{
                top: Spacing.md,
                bottom: Spacing.md,
                left: Spacing.sm,
                right: Spacing.sm,
              }}
            >
              <Text style={styles.sourceLinkText}>{sourceHost}</Text>
              <Ionicons name="open-outline" size={14} color={Colors.textSubtle} />
            </Pressable>
          ) : null}
          {sourceHost && details.length > 0 ? (
            <Text
              style={styles.metaText}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {"·"}
            </Text>
          ) : null}
          {details.length > 0 ? (
            <Text style={styles.metaText}>{details.join(" · ")}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The `…` over the cover, inert, as the context menu lifts it above its blur:
 * the control that opened the menu stays sharp on the measured rect.
 */
export function MediaHeroMenuGlyph(): React.JSX.Element {
  return (
    <GlassSurface style={styles.glassButtonSurface}>
      <Ionicons name={MENU_GLYPH} size={24} color={Colors.textMain} />
    </GlassSurface>
  );
}

/** The top of the band darkened under the status bar, strip by strip. */
function StatusBarScrim({ height }: { height: number }): React.JSX.Element {
  return (
    <View
      style={[styles.scrim, { height }]}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {SCRIM_STEP_OPACITIES.map((opacity, index) => (
        // `flex: 1` rather than a computed height: the layout engine rounds the
        // strips onto the pixel grid together, so no hairline opens between two.
        <View key={index} style={[styles.scrimStep, { opacity }]} />
      ))}
    </View>
  );
}

function GlassButton({
  icon,
  accessibilityLabel,
  onPress,
}: {
  icon: IoniconName;
  accessibilityLabel: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={styles.glassButton}
      onPress={onPress}
      hitSlop={MEDIA_HEADER_BUTTON_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <GlassSurface style={styles.glassButtonSurface}>
        <Ionicons name={icon} size={24} color={Colors.textMain} />
      </GlassSurface>
    </Pressable>
  );
}

/**
 * Measures itself when pressed, like `HeaderMenuButton`: the rect is only needed
 * on the frame the menu opens, and the band moves with the scroll.
 */
function GlassMenuButton({
  onPress,
}: {
  onPress: (anchor: AnchorRect) => void;
}): React.JSX.Element {
  const buttonRef = useRef<View>(null);

  const handlePress = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      onPress({ x, y, width, height });
    });
  };

  return (
    <Pressable
      ref={buttonRef}
      style={styles.glassButton}
      onPress={handlePress}
      hitSlop={MEDIA_HEADER_BUTTON_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={t("mediaActions.moreA11y")}
      testID="media-header-actions"
    >
      <GlassSurface style={styles.glassButtonSurface}>
        <Ionicons name={MENU_GLYPH} size={24} color={Colors.textMain} />
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The tone is what a loading picture shows: the frame, bare.
  band: {
    backgroundColor: Colors.surfaceContainerLow,
    overflow: "hidden",
  },
  fallback: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: Spacing.xl,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  scrimStep: {
    flex: 1,
    backgroundColor: Colors.textMain,
  },
  // `overflow: hidden` is what `GlassSurface` asks of its caller, so the
  // material is clipped to the strip whichever branch renders it.
  titleBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    overflow: "hidden",
  },
  unmeasured: {
    opacity: 0,
  },
  titleBelow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  // `textSubtle`: a line to read, at 5.3:1 on the page and on the glass tint.
  // The letter spacing is the one every small-caps label of the app uses.
  eyebrow: {
    fontSize: Typography.small.fontSize,
    fontWeight: Typography.label.fontWeight,
    color: Colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  // The display title the page has always had, 38pt leading included.
  title: {
    fontSize: Typography.display.fontSize,
    fontWeight: Typography.display.fontWeight,
    letterSpacing: Typography.display.letterSpacing,
    lineHeight: 38,
    color: Colors.textMain,
  },
  // Where the lifecycle header puts its arrow, so the button does not move when
  // the processing state hands over to the page.
  controls: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  glassButton: {
    width: MEDIA_HEADER_BUTTON_SIZE,
    height: MEDIA_HEADER_BUTTON_SIZE,
  },
  glassButtonSurface: {
    width: MEDIA_HEADER_BUTTON_SIZE,
    height: MEDIA_HEADER_BUTTON_SIZE,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  metaLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: Spacing.xs,
    rowGap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  sourceLinkPressed: {
    backgroundColor: Colors.surfaceContainerHigh,
  },
  sourceLinkText: {
    fontSize: Typography.small.fontSize,
    fontWeight: Typography.label.fontWeight,
    color: Colors.textSubtle,
  },
  metaText: {
    fontSize: Typography.small.fontSize,
    color: Colors.textSubtle,
  },
});
