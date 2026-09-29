/**
 * The top of a media page: the cover, edge to edge, and what names the source.
 *
 * Direction C of the task-410 benchmark ("Bandeau rétractable"), the one the
 * owner picked for task-411. The band runs under the status bar; the creator and
 * the title sit at the bottom of the picture on a strip of `Colors.coverTitleVeil`
 * over the `GlassSurface` material; back and `…` float over its top on the same
 * material, bare. Under the band,
 * one line carries the way back to the original and everything else worth
 * knowing about the source — date, duration, language, length — which the page
 * used to split between a chip, the hero and a second line above the transcript.
 * Once the Reader / AI segment has scrolled away, `MediaReaderBar` takes over
 * at the top.
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
 * it, onto the page background. On a 4:3 band it always stays on the picture,
 * whatever its length: past two lines it is cut with an ellipsis, never moved.
 *
 * With no picture — none in the contract, or one that failed to load — the band
 * shrinks to 96pt of `surfaceContainerLow` carrying the type glyph, and the title
 * sits under it. The glyph is decorative (2.6:1 on its tone), so the eyebrow
 * writes the type out in that case. While a picture is loading the band keeps
 * its full size as a bare tonal frame: no spinner, no placeholder.
 *
 * ## The title strip, and why it does not trust the material
 *
 * The strip is `Colors.coverTitleVeil` — the mockup's 72 % wash — painted over
 * the `GlassSurface` material, not under it: that is the order CSS gives a
 * `background` over a `backdrop-filter`, and the only order that bounds the
 * contrast. `GlassSurface` was written for two surfaces over *scrolling content*;
 * a strip over an arbitrary photograph is a third site, and the material cannot
 * carry it alone. Liquid Glass adapts to what it covers, so over a bright busy
 * picture it can draw close to nothing and leave dark text on dark leaves — the
 * degradation the benchmark predicted for this direction, and the one two beta
 * reports arrived on. With the wash on top, `textMain` never drops below 6.5:1
 * whatever the material resolves to; `textSubtle` would only reach 2.7:1 through
 * it, so the small-caps line switches to `textMain` while it is on the cover and
 * keeps `textSubtle` when it is drawn on the page instead.
 *
 * The strip never carries an `opacity` below 1, and there is nothing left in this
 * file that would want to give it one. An `opacity` under 1 on a glass view, or on
 * any of its ancestors, stops its material rendering at all — the constraint
 * `AnchoredContextMenu`'s `CARD_MIN_OPACITY` is named for — and
 * `expo-glass-effect` installs the effect on the view's first layout pass only, so
 * a band laid out while invisible stayed an untinted empty box for the rest of the
 * page's life. That is what made the same media come up two different ways: the
 * strip used to be hidden at `opacity: 0` until the title's line count came back,
 * and which rendering the user got depended on whether that measure landed before
 * the first layout pass. Truncating instead of relocating removed the measure, and
 * with it the hidden pass and the race — the placement is known from the band's
 * shape before the first frame.
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

import React, { useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
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
 * Past two lines the title covers most of the picture it sits on, so it is cut
 * there with an ellipsis rather than moved off the picture.
 *
 * task-410 §12 had it relocate under the band instead, and a beta tester read the
 * two placements as a glitch ("et parfois le texte apparait en dessous de
 * l'image ???"): the rule keyed on a line count nothing on screen shows, so the
 * same page looked like two. The owner chose truncation on 2026-09-29 — one
 * placement for every title.
 *
 * The tail of a long title is then not readable anywhere on the page: the
 * collapsed `MediaReaderBar` cuts it to a single line too. That is the accepted
 * cost of one placement, and it is why the `Text` carries an explicit
 * `accessibilityLabel` — sighted readers lose the tail, a screen reader does not.
 */
const MAX_TITLE_LINES_ON_COVER = 2;

/**
 * 28pt, where `Typography.display` is 32: the page's own title size, four points
 * under the display style it otherwise borrows weight and letter spacing from.
 *
 * Not a change to `Typography.display` itself — `StartupErrorScreen` is the other
 * caller and has nothing to do with this band. Smaller is worth the most here
 * precisely because the title is clamped: it is roughly a word more per line
 * before the ellipsis lands, on the placement that cannot spill onto a third.
 */
const TITLE_FONT_SIZE = 28;

/** The 1.19 leading ratio of the 32/38 pair this size replaces. */
const TITLE_LINE_HEIGHT = 33;

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
  // Known before the first frame, from the band's shape and whether there is a
  // picture at all — never from how long the title turns out to be. So there is
  // no measure, nothing to wait for, and no pass to hide: the strip is drawn on
  // the first frame in its final placement.
  const titleOnCover = layout.shape === "tall" && cover !== null;

  // `onCover` carries the two things that differ between the placements. The
  // colour of the small-caps line: the wash the strip is drawn on leaves
  // `textSubtle` at 2.7:1 over a dark picture, while on the page it is the 5.3:1
  // that token exists for. And the clamp: on the picture the title is cut at
  // `MAX_TITLE_LINES_ON_COVER` so it never swallows the cover, whereas on the page
  // it has the room to run as long as it needs and is given no limit.
  //
  // `accessibilityLabel` restates the title because of that clamp — the tail is
  // cut for the eye, never for a screen reader.
  const renderTitleBlock = (onCover: boolean) => (
    <>
      {eyebrow ? (
        <Text
          style={[styles.eyebrow, onCover && styles.eyebrowOnCover]}
          numberOfLines={2}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={styles.title}
        accessibilityRole="header"
        accessibilityLabel={title}
        numberOfLines={onCover ? MAX_TITLE_LINES_ON_COVER : undefined}
        // `tail` is React Native's default, written out because it is the only
        // mode that behaves correctly on Android above one line (task-231 §11.5):
        // leaving it implicit invites someone to try `middle` or `head` here.
        ellipsizeMode="tail"
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
          <GlassSurface style={styles.titleBand}>
            {/* Over the material, under the text: the floor the material
                cannot promise on a picture it has no say over. */}
            <View style={styles.titleVeil} pointerEvents="none" />
            {renderTitleBlock(true)}
          </GlassSurface>
        ) : null}
      </View>

      {titleOnCover ? null : (
        <View style={styles.titleBelow}>{renderTitleBlock(false)}</View>
      )}

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
  // The strip's contrast floor. Absolute so it does not take part in the strip's
  // layout, and first in the tree so the text is drawn over it.
  titleVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.coverTitleVeil,
  },
  titleBelow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  // `textSubtle`: a line to read, at 5.3:1 on the page. The letter spacing is the
  // one every small-caps label of the app uses.
  eyebrow: {
    fontSize: Typography.small.fontSize,
    fontWeight: Typography.label.fontWeight,
    color: Colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  // On the cover, `textSubtle` measures 2.7:1 through the wash against a dark
  // picture, so the line takes the title's colour — 6.5:1 at worst. Size, weight
  // and caps still set it apart from the title it sits over.
  eyebrowOnCover: {
    color: Colors.textMain,
  },
  // The display title, at `TITLE_FONT_SIZE` rather than the 32pt of
  // `Typography.display`: the weight and the letter spacing of the display style,
  // four points smaller. Leading follows at the 1.19 ratio the 32/38 pair had.
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: Typography.display.fontWeight,
    letterSpacing: Typography.display.letterSpacing,
    lineHeight: TITLE_LINE_HEIGHT,
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
