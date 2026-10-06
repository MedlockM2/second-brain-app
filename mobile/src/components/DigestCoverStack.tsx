/**
 * One period of the Digest, drawn as a pack of cards: the root of the Digest tab
 * holds two of them, Daily then Weekly (task-409).
 *
 * The owner's decision for the task-408 benchmark ("deux piles de couvertures"):
 * a period is a pack made of the covers of its first three media, in the order
 * of `media_item_ids`, stacked so it reads as a pile, and it carries the name of
 * the period and how many media it holds. The whole pack is the tap target.
 *
 * ## The pile
 *
 * Three cards as wide as the screen's gutters allow, the first media in front
 * and upright, the two others behind it, each raised a step and tilted a few
 * degrees in opposite directions so their edges show above and beside it — a
 * deck left on a table, not a fan. The front card carries the caption on the same
 * strip the media page lays its title on over a cover: `Colors.coverTitleVeil`
 * over the `GlassSurface` material, the wash on top, because the material adapts
 * to the picture under it and cannot promise `textMain` any contrast of its own
 * (`MediaDetailHero`, "The title strip, and why it does not trust the material").
 * On the strip: the period's name, and its count on an amber pill. The cards carry
 * `Shadows.soft` because they are the one thing on the screen that floats over
 * something else; no stroke separates them (the No-Line rule of Amber Clarity).
 *
 * A card always shows something, and never a spinner:
 *
 * - the cover, `media_image` of the library row, cropped like the media page's
 *   band (`MediaCoverImage`, same cache key as every list);
 * - the glyph of the media type when the row has no cover or the cover failed to
 *   load — the fallback `MediaDetailHero` applies to the page itself;
 * - a bare tonal face when there is no media for that card (a period with fewer
 *   than three, or none: "paquet sans couverture") or when nothing is known about
 *   it yet — the digest or the library still loading, a read that failed, or a
 *   media older than the page of the library that was read.
 *
 * So the pack is drawn, and pressable, before any cover — and whether or not any
 * read succeeded. The covers are an enrichment; they never gate the choice.
 *
 * ## Size
 *
 * The pack takes whatever height the screen leaves it, and the front card is
 * sized from the pack as measured: the full width, and as tall as the pack
 * minus the rise of the cards behind, capped at `CARD_MAX_ASPECT` so a tall
 * screen does not turn a card into a poster. That keeps two packs on one screen
 * at 414 x 896 pt and at 320 pt alike, and a pack that cannot shrink any further
 * (large Dynamic Type) makes the screen scroll rather than clip.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "./GlassSurface";
import { MediaCoverImage, type MediaCover } from "./MediaDetailHero";
import {
  BorderRadius,
  Spacing,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { getMediaTypeIcon } from "../lib/mediaTypeDisplay";
import { tCount } from "../i18n";
import type { MediaListItem, MediaType } from "../types/media";

type IoniconName = keyof typeof Ionicons.glyphMap;

/** How many covers make a pack. */
const PACK_SIZE = 3;

/** The tallest a card may be, over its width: 16:10, a print rather than a poster. */
const CARD_MAX_ASPECT = 0.65;

/** How far each card behind the front one is raised above it. */
const RISE_STEP = Spacing.md;

/**
 * Below this the covers stop being recognisable, so the screen scrolls instead.
 * An iPhone SE at 320 x 568 pt leaves each pack ~150 pt under the default text
 * size, which has to fit without scrolling.
 */
const PACK_MIN_HEIGHT = Spacing.xxl * 3;

/** The glyph of the media page's fallback band. */
const GLYPH_SIZE = 32;

/**
 * The sign of the trailing edge, for the transforms: they are not mirrored by
 * React Native in a right-to-left layout, so the deck is. Read once, at module
 * scope, as `MediaProcessingSweep` reads it: the flag only changes on a reload.
 */
const TRAILING = I18nManager.isRTL ? -1 : 1;

/**
 * Which card goes where, back to front: the tree order is the drawing order, so
 * the first media comes last and lands on top. `rise` counts steps of
 * `RISE_STEP`, `angle` is in degrees, `shift` in points, all towards the
 * trailing edge when positive.
 */
const POSES: readonly {
  index: number;
  rise: number;
  angle: number;
  shift: number;
}[] = [
  { index: 2, rise: 2, angle: -4 * TRAILING, shift: -Spacing.xs * TRAILING },
  { index: 1, rise: 1, angle: 3 * TRAILING, shift: Spacing.sm * TRAILING },
  { index: 0, rise: 0, angle: 0, shift: 0 },
];

type CardFace =
  | { kind: "cover"; mediaItemId: string; cover: MediaCover }
  | { kind: "glyph"; icon: IoniconName }
  | { kind: "blank" };

interface CardBox {
  width: number;
  height: number;
  /** Top of the front card; the cards behind sit `RISE_STEP` higher each. */
  top: number;
}

interface DigestCoverStackProps {
  /** The name of the period, as the pack shows it and a screen reader says it. */
  label: string;
  /**
   * The period's media, in digest order. `null` while it is not known: still
   * loading, or the read failed.
   */
  mediaItemIds: readonly string[] | null;
  /**
   * The page of the library the covers are read from, by media id. `null`
   * while it is not known.
   */
  library: ReadonlyMap<string, MediaListItem> | null;
  onPress: () => void;
  testID?: string;
}

export function DigestCoverStack({
  label,
  mediaItemIds,
  library,
  onPress,
  testID,
}: DigestCoverStackProps): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  // Kept per media, not as one flag: a refetch can reorder the covers, and a
  // picture that would not load must not take another media's with it.
  const [failedCoverIds, setFailedCoverIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const handleCoverError = useCallback((mediaItemId: string) => {
    setFailedCoverIds((current) =>
      current.has(mediaItemId) ? current : new Set(current).add(mediaItemId),
    );
  }, []);

  const faces = useMemo<CardFace[]>(
    () =>
      Array.from({ length: PACK_SIZE }, (_, index): CardFace => {
        const mediaItemId = mediaItemIds?.[index];
        const item = mediaItemId ? library?.get(mediaItemId) : undefined;
        if (!mediaItemId || !item) return { kind: "blank" };

        const uri = item.media_image?.trim() ?? "";
        if (uri && !failedCoverIds.has(mediaItemId)) {
          return {
            kind: "cover",
            mediaItemId,
            cover: {
              uri,
              cacheKey: `${mediaItemId}:${item.updated_at}`,
              recyclingKey: mediaItemId,
            },
          };
        }
        return {
          kind: "glyph",
          icon: getMediaTypeIcon((item.media_type ?? "unknown") as MediaType),
        };
      }),
    [mediaItemIds, library, failedCoverIds],
  );

  const [packSize, setPackSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const handlePackLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPackSize((current) =>
      current?.width === width && current.height === height
        ? current
        : { width, height },
    );
  }, []);

  // The deck is centred in the pack: the front card and the two rises above it.
  const cardBox = useMemo<CardBox | null>(() => {
    if (!packSize) return null;
    const rise = RISE_STEP * (PACK_SIZE - 1);
    const height = Math.min(
      packSize.width * CARD_MAX_ASPECT,
      packSize.height - rise,
    );
    return {
      width: packSize.width,
      height,
      top: (packSize.height - height - rise) / 2 + rise,
    };
  }, [packSize]);

  // The length of `media_item_ids`, as the decision defines the count. Unknown
  // while the digest is: a zero there would state an empty period that nobody
  // has read yet, so the pill waits.
  const countLabel =
    mediaItemIds === null
      ? null
      : tCount("digest.mediaCount", mediaItemIds.length);

  return (
    <Pressable
      style={({ pressed }) => [styles.pack, pressed && styles.packPressed]}
      onPress={onPress}
      onLayout={handlePackLayout}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={countLabel ? { text: countLabel } : undefined}
      testID={testID}
    >
      {cardBox
        ? POSES.map(({ index, rise, angle, shift }) => (
            <View
              key={index}
              style={[
                styles.card,
                {
                  width: cardBox.width,
                  height: cardBox.height,
                  top: cardBox.top - rise * RISE_STEP,
                  transform: [
                    { translateX: shift },
                    { rotate: `${angle}deg` },
                  ],
                },
              ]}
              // The front card is announced through the pack; the covers are
              // decorative, the caption says what the pack is.
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              <CardFaceView
                face={faces[index]}
                isFront={index === 0}
                onCoverError={handleCoverError}
              />
              {index === 0 ? (
                <GlassSurface style={styles.caption}>
                  {/* Over the material, under the text: the contrast floor the
                      material cannot promise on a cover it has no say over. */}
                  <View style={styles.captionVeil} pointerEvents="none" />
                  <Text style={styles.label} numberOfLines={1}>
                    {label}
                  </Text>
                  {countLabel ? (
                    <View style={styles.pill}>
                      <Text style={styles.pillText} numberOfLines={1}>
                        {countLabel}
                      </Text>
                    </View>
                  ) : null}
                </GlassSurface>
              ) : null}
            </View>
          ))
        : null}
    </Pressable>
  );
}

function CardFaceView({
  face,
  isFront,
  onCoverError,
}: {
  face: CardFace;
  isFront: boolean;
  onCoverError: (mediaItemId: string) => void;
}): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  if (face.kind === "cover") {
    // The tone is what a loading picture shows: the frame, bare.
    return (
      <View style={[styles.face, styles.faceTonal]}>
        <MediaCoverImage
          cover={face.cover}
          onError={() => onCoverError(face.mediaItemId)}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  if (face.kind === "glyph") {
    return (
      <View style={[styles.face, styles.faceTonal]}>
        <Ionicons name={face.icon} size={GLYPH_SIZE} color={Colors.textMuted} />
      </View>
    );
  }

  // Bare cards a step darker behind the front one, so a pack with no cover
  // still reads as three cards.
  return (
    <View
      style={[styles.face, isFront ? styles.faceBlank : styles.faceBlankBack]}
    />
  );
}

const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) =>
  StyleSheet.create({
    // `flexGrow` rather than `flex: 1`: the pack keeps its minimum as a floor and
    // takes an equal share of what the screen has left, so two packs fill the
    // screen together and scroll together once they cannot.
    pack: {
      flexGrow: 1,
      minHeight: PACK_MIN_HEIGHT,
    },
    packPressed: {
      opacity: 0.85,
    },
    // The shadow on the card, the clipping on its face: a view that clips its
    // children clips its own shadow on iOS.
    card: {
      position: "absolute",
      left: 0,
      borderRadius: BorderRadius.xl,
      backgroundColor: Colors.surface,
      ...Shadows.soft,
    },
    face: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.xl,
      overflow: "hidden",
    },
    faceTonal: {
      backgroundColor: Colors.surfaceContainerLow,
    },
    faceBlank: {
      backgroundColor: Colors.surfaceContainer,
    },
    faceBlankBack: {
      backgroundColor: Colors.surfaceContainerHigh,
    },
    // Across the bottom of the front card, clipped to its lower corners.
    caption: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomLeftRadius: BorderRadius.xl,
      borderBottomRightRadius: BorderRadius.xl,
      overflow: "hidden",
    },
    // Absolute so it does not take part in the row's layout, and first in the tree
    // so the label and the pill are drawn over it. The strip's `overflow: hidden`
    // clips it to the card's bottom corners.
    captionVeil: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: Colors.coverTitleVeil,
    },
    label: {
      flex: 1,
      ...Typography.headline,
      color: Colors.textMain,
    },
    pill: {
      paddingHorizontal: Spacing.sm + Spacing.xs,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
    },
    pillText: {
      fontSize: Typography.small.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.onPrimary,
    },
  });
