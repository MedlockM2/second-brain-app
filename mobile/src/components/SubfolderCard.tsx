import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  TouchTarget,
} from "../constants/theme";
import { t, tCount } from "../i18n";
import type { FolderNode } from "../lib/folderTree";
import {
  COVER_HEIGHT,
  COVER_WIDTH,
  type MediaCardItem,
} from "./MediaListCard";

/**
 * A subfolder, as the Sources tab of a folder lists it above the sources: the
 * same card as the `MediaListCard` rows under it (task-412, variant A), with a
 * collage of what the subfolder holds where a source has its cover.
 *
 * Same gabarit on purpose — the 112 x 63 frame is imported rather than restated,
 * and the card box is the one `MediaListCard` draws — so the list reads as one
 * column of vignettes, subfolders first, instead of two kinds of rows.
 *
 * **The collage** takes at most three covers, the newest first, among the
 * sources of the subfolder *and of its descendants*: a folder that only holds
 * folders still shows what is inside it. The caller hands over those sources,
 * regrouped from the page's own `getFolderMedia` response (which is inclusive of
 * descendants), so the card never fetches anything. A cover that fails to load
 * gives its slot to the next one, and with none left — or none to begin with —
 * the frame shows the folder glyph on the amber wash: never an empty cell.
 *
 * **The count line** says what the subfolder opens onto: its items stored
 * *directly*, as the server counts them (`Folder.media_count`, the same count
 * the Home tile and the folders list show) — hence the same number as the
 * "Sources · N" caption once it is opened — then its own subfolders when it has
 * any, which is where the rest of the collage comes from.
 */

/** How many covers the collage holds: one lead picture and a column of two. */
const COLLAGE_SIZE = 3;

/** What the collage reads off a source: its picture and the cover cache key. */
export type SubfolderCoverItem = Pick<
  MediaCardItem,
  "media_item_id" | "media_image" | "updated_at"
>;

interface SubfolderCardProps {
  node: FolderNode;
  /**
   * Every source stored in the subfolder or in one of its descendants, newest
   * first — the order the collage picks its covers in.
   */
  subtreeMedia: readonly SubfolderCoverItem[];
  onPress: (node: FolderNode) => void;
  /** Set by the list rendering the card so a flow can address it. */
  testID?: string;
}

export function SubfolderCard({
  node,
  subtreeMedia,
  onPress,
  testID,
}: SubfolderCardProps): React.JSX.Element {
  // Ids rather than a flag: one failed picture must not take the others with it.
  const [failedCoverIds, setFailedCoverIds] = useState<readonly string[]>([]);

  // Every source that has a cover, in order. Not capped here: a cover that
  // fails is dropped below, and the next candidate is what takes its slot.
  const candidates = useMemo(
    () =>
      subtreeMedia.filter((item) => (item.media_image?.trim() ?? "").length > 0),
    [subtreeMedia],
  );
  const covers = useMemo(
    () =>
      candidates
        .filter((item) => !failedCoverIds.includes(item.media_item_id))
        .slice(0, COLLAGE_SIZE),
    [candidates, failedCoverIds],
  );

  const handleCoverError = (mediaItemId: string) => {
    setFailedCoverIds((current) =>
      current.includes(mediaItemId) ? current : [...current, mediaItemId],
    );
  };

  const itemCount = tCount("common.itemCount", node.media_count);
  const childCount = node.children.length;
  const folderCount =
    childCount > 0 ? tCount("folders.childCount", childCount) : null;
  // The separator the folders list already joins the same two counts with.
  const subtitle = folderCount ? `${itemCount} · ${folderCount}` : itemCount;

  // One label for the whole card, counts included: they are what the card says
  // beyond the name, and the label replaces its children for a screen reader.
  const accessibilityLabel = folderCount
    ? t("folder.subfolderWithChildrenA11y", {
        name: node.name,
        items: itemCount,
        folders: folderCount,
      })
    : t("folder.subfolderA11y", { name: node.name, items: itemCount });

  const [lead, ...side] = covers;

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(node)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {lead ? (
        // Seams in the card's own colour between the pictures, so the collage
        // reads as three covers rather than one picture cut into pieces.
        <View style={[styles.frame, styles.collage]}>
          <CollageCell
            item={lead}
            style={styles.leadCell}
            onError={handleCoverError}
          />
          {side.length > 0 ? (
            <View style={styles.sideColumn}>
              {side.map((item) => (
                <CollageCell
                  key={item.media_item_id}
                  item={item}
                  style={styles.sideCell}
                  onError={handleCoverError}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.frame, styles.fallback]}>
          <Ionicons name="folder" size={28} color={Colors.primary} />
        </View>
      )}

      <View style={styles.textSection}>
        <Text style={styles.name} numberOfLines={1}>
          {node.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
    </Pressable>
  );
}

interface CollageCellProps {
  item: SubfolderCoverItem;
  style: StyleProp<ViewStyle>;
  onError: (mediaItemId: string) => void;
}

/**
 * One cover of the collage, loaded exactly as `MediaListCard` loads it: the same
 * cache key, so opening the subfolder draws from the pictures fetched here.
 */
function CollageCell({ item, style, onError }: CollageCellProps) {
  return (
    <View style={style}>
      <Image
        source={{
          uri: item.media_image?.trim() ?? "",
          cacheKey: `${item.media_item_id}:${item.updated_at}`,
        }}
        recyclingKey={item.media_item_id}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={150}
        priority="low"
        style={styles.cellImage}
        onError={() => onError(item.media_item_id)}
        accessible={false}
      />
    </View>
  );
}

/** Half a spacing step: a seam, not a gutter. */
const SEAM = Spacing.xs / 2;

const styles = StyleSheet.create({
  // The box `MediaListCard` draws, token for token, so a subfolder and a source
  // stacked in one list are the same card.
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm + Spacing.xs,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    minHeight: TouchTarget.comfortable,
    ...Shadows.soft,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  frame: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  collage: {
    flexDirection: "row",
    gap: SEAM,
    backgroundColor: Colors.surface,
  },
  // Two thirds of the frame for the newest cover, the column of the next two
  // beside it. With a single cover the lead fills the frame on its own.
  leadCell: {
    flex: 2,
    backgroundColor: Colors.surfaceContainerLow,
  },
  sideColumn: {
    flex: 1,
    gap: SEAM,
  },
  sideCell: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
  },
  cellImage: {
    width: "100%",
    height: "100%",
  },
  // The 5 % amber wash the design system prescribes for a tinted surface, under
  // the same amber glyph the Library draws its folder tiles with.
  fallback: {
    backgroundColor: Colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  textSection: {
    flex: 1,
    paddingVertical: Spacing.xs,
    gap: SEAM,
  },
  name: {
    fontSize: Typography.body.fontSize,
    fontWeight: "700",
    color: Colors.textMain,
  },
  subtitle: {
    fontSize: Typography.small.fontSize,
    color: Colors.textSubtle,
  },
});
