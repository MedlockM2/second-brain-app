/**
 * One period of the Digest, drawn as a pack of cards: the root of the Digest tab
 * holds two of them, Daily then Weekly (task-409).
 *
 * The owner's decision for the task-408 benchmark ("deux piles de couvertures"):
 * a period is a pack made of the covers of its first three media, in the order
 * of `media_item_ids`, stacked so it reads as a pile, and it carries the name of
 * the period and how many media it holds. The whole pack is the tap target. Its
 * exact form was left to the design system, and this is it.
 *
 * ## The pile
 *
 * Three cards fanned out on a tonal tile: the first media in front, the second
 * tilted towards the trailing edge — where the carousel's next page comes from —
 * and the third towards the leading one. Each card is a print: a `surface` matte
 * around the picture. The matte is what tells two overlapping covers apart
 * without a stroke between them (the No-Line rule of Amber Clarity), and the
 * cards carry `Shadows.soft` because they are the one thing on the screen that
 * floats over something else.
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
 * The pile takes whatever height the screen leaves it, and the cards are sized
 * from the pile as measured: as wide as the fan can be inside the tile, as tall
 * as the tilted cards can be inside the pile, whichever binds first. That is what
 * keeps two packs on one screen at 414 x 896 pt and at 320 pt alike, and a pile
 * that cannot shrink any further (large Dynamic Type) makes the screen scroll
 * rather than clip.
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
import { MediaCoverImage, type MediaCover } from "./MediaDetailHero";
import {
  BorderRadius,
  Colors,
  Shadows,
  Spacing,
  Typography,
} from "../constants/theme";
import { getMediaTypeIcon } from "../lib/mediaTypeDisplay";
import { tCount } from "../i18n";
import type { MediaListItem, MediaType } from "../types/media";

type IoniconName = keyof typeof Ionicons.glyphMap;

/** How many covers make a pack. */
const PACK_SIZE = 3;

/** Height over width of a card: the 4:3 of the media page's cover band. */
const CARD_ASPECT = 3 / 4;

/** How far each back card is tilted, in degrees. */
const FAN_ANGLE_DEG = 6;
const FAN_ANGLE_RAD = (FAN_ANGLE_DEG * Math.PI) / 180;

/** How far each back card is pushed sideways, as a share of a card's width. */
const FAN_SHIFT = 0.3;

/**
 * The share of the pile's width one card may take. With the two back cards
 * shifted by `FAN_SHIFT` either way, the fan spans ~94% of the pile.
 */
const CARD_WIDTH_SHARE = 0.56;

/** Height of a tilted card's bounding box, as a multiple of its own height. */
const TILTED_HEIGHT_FACTOR =
  Math.cos(FAN_ANGLE_RAD) + Math.sin(FAN_ANGLE_RAD) / CARD_ASPECT;

/**
 * Below this the covers stop being recognisable, so the screen scrolls instead.
 * 80 pt: an iPhone SE at 320 x 568 pt leaves each pile ~95 pt under the default
 * text size, which has to fit without scrolling.
 */
const PILE_MIN_HEIGHT = Spacing.xxl + Spacing.xl;

/** The glyph of the media page's fallback band. */
const GLYPH_SIZE = 32;

/**
 * The sign of the trailing edge, for the transforms: they are not mirrored by
 * React Native in a right-to-left layout, so the fan is. Read once, at module
 * scope, as `MediaProcessingSweep` reads it: the flag only changes on a reload.
 */
const TRAILING = I18nManager.isRTL ? -1 : 1;

/**
 * Which card goes where, back to front: the tree order is the drawing order, so
 * the first media comes last and lands on top.
 */
const POSES: readonly { index: number; side: number }[] = [
  { index: 2, side: -TRAILING },
  { index: 1, side: TRAILING },
  { index: 0, side: 0 },
];

/** A no-break space: keeps the count line's height while the count is unknown. */
const BLANK_LINE = " ";

type CardFace =
  | { kind: "cover"; mediaItemId: string; cover: MediaCover }
  | { kind: "glyph"; icon: IoniconName }
  | { kind: "blank" };

interface CardBox {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface DigestCoverStackProps {
  /** The name of the period, as the tile shows it and a screen reader says it. */
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

  const [pileSize, setPileSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const handlePileLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPileSize((current) =>
      current?.width === width && current.height === height
        ? current
        : { width, height },
    );
  }, []);

  const cardBox = useMemo<CardBox | null>(() => {
    if (!pileSize) return null;
    const height = Math.min(
      pileSize.width * CARD_WIDTH_SHARE * CARD_ASPECT,
      pileSize.height / TILTED_HEIGHT_FACTOR,
    );
    const width = height / CARD_ASPECT;
    return {
      width,
      height,
      left: (pileSize.width - width) / 2,
      top: (pileSize.height - height) / 2,
    };
  }, [pileSize]);

  // The length of `media_item_ids`, as the decision defines the count. Unknown
  // while the digest is: a zero there would state an empty period that nobody
  // has read yet.
  const countLabel =
    mediaItemIds === null
      ? null
      : tCount("common.itemCount", mediaItemIds.length);

  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={countLabel ? { text: countLabel } : undefined}
      testID={testID}
    >
      {/* Decorative: the label and the count say what the pile shows. */}
      <View
        style={styles.pile}
        onLayout={handlePileLayout}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        {cardBox
          ? POSES.map(({ index, side }) => (
              <View
                key={index}
                style={[
                  styles.card,
                  {
                    width: cardBox.width,
                    height: cardBox.height,
                    left: cardBox.left,
                    top: cardBox.top,
                    transform: [
                      { translateX: side * FAN_SHIFT * cardBox.width },
                      { rotate: `${side * FAN_ANGLE_DEG}deg` },
                    ],
                  },
                ]}
              >
                <CardFaceView
                  face={faces[index]}
                  onCoverError={handleCoverError}
                />
              </View>
            ))
          : null}
      </View>

      <View style={styles.caption}>
        <View style={styles.captionText}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.count} numberOfLines={1}>
            {countLabel ?? BLANK_LINE}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </View>
    </Pressable>
  );
}

function CardFaceView({
  face,
  onCoverError,
}: {
  face: CardFace;
  onCoverError: (mediaItemId: string) => void;
}): React.JSX.Element {
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

  return <View style={[styles.face, styles.faceBlank]} />;
}

const styles = StyleSheet.create({
  // `flexGrow` rather than `flex: 1`: the tile keeps its content height as a
  // floor and takes an equal share of what the screen has left above it, so two
  // tiles fill the screen together and scroll together once they cannot.
  tile: {
    flexGrow: 1,
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceContainerLow,
  },
  tilePressed: {
    backgroundColor: Colors.surfaceContainer,
  },
  pile: {
    flexGrow: 1,
    minHeight: PILE_MIN_HEIGHT,
  },
  card: {
    position: "absolute",
    padding: Spacing.xs,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.soft,
  },
  face: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  faceTonal: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  faceBlank: {
    backgroundColor: Colors.surfaceContainer,
  },
  caption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  captionText: {
    flex: 1,
    gap: Spacing.xs,
  },
  label: {
    ...Typography.headline,
    color: Colors.textMain,
  },
  count: {
    fontSize: Typography.small.fontSize,
    color: Colors.textSubtle,
  },
});
