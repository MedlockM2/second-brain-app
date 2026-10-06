import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useShareIntake } from "../../src/contexts/ShareIntentContext";
import { usePurchases } from "../../src/contexts/PurchasesContext";
import { useMediaList } from "../../src/hooks/useMediaList";
import { useHomeSections } from "../../src/hooks/useHomeSections";
import { useProcessingRefresh } from "../../src/hooks/useProcessingRefresh";
import { isProcessingLibraryStatus } from "../../src/components/MediaProcessingSweep";
import { t, tCount, useTranslation } from "../../src/i18n";
import { AddSourceSheet } from "../../src/components/AddSourceSheet";
import { UrlEntryDialog } from "../../src/components/UrlEntryDialog";
import { MinutesWarningBanner } from "../../src/components/MinutesWarningBanner";
import { FreeTrialNotice } from "../../src/components/FreeTrialNotice";
import {
  HomeTile,
  TILE_COVER_HEIGHT,
  TILE_GAP,
  TILE_HEIGHT,
  TILE_WIDTH,
  type HomeTileItem,
} from "../../src/components/HomeTile";
import {
  capturePhotoToImport,
  pickFileToImport,
  pickPhotoFromLibrary,
  type LocalImportResult,
} from "../../src/lib/localImport";
import { validateShareIntentPayload } from "../../src/lib/urlValidation";
import {
  Typography,
  Spacing,
  BorderRadius,
  TouchTarget,
  type Theme,
} from "../../src/constants/theme";
import {
  useThemeColors,
  useThemedStyles,
} from "../../src/contexts/ThemeContext";
import { HOME_BLOCK_GAP } from "../../src/constants/homeRhythm";
import { TAB_BAR_CLEARANCE } from "../../src/constants/tabBar";
import type { MediaListItem, MediaType } from "../../src/types/media";
import type { RecentEngagement } from "../../src/types/engagements";

/**
 * Home screen — the unsorted review entry point and two horizontal
 * rows of tiles: "Recently added" and "Continue learning" (task-307).
 *
 * The vertical list of every media item that used to live here is gone: task-306
 * moved the full library to the Search tab, which is where a list of everything
 * belongs. What is left is a landing screen — what just arrived, and what you
 * were in the middle of — and it is deliberately short.
 *
 * The Daily Digest card that used to sit at the top is gone too (task-324): it
 * pushed the Digest tab, which is one tap away in the tab bar. Its place is now
 * held by the entry into the triage of the default folder, which is the one
 * thing on this screen with a backlog behind it.
 *
 * Three sources feed it and each fails alone: "Recently added" comes from the
 * media list `useMediaList` holds, while `useHomeSections` brings the engagement
 * row and the unsorted count, now on two independent requests (task-417). Only the
 * very first media fetch may show a full-screen spinner.
 *
 * Each hook reads itself when this screen gains focus, and that single path is the
 * whole of what an open costs: three requests leave, not six (task-421). This
 * screen's own focus effect is left with the entitlements alone.
 *
 * The other two blocks hold their own space while their first answer is in flight
 * — `SectionPlaceholder` below — instead of appearing out of nothing once it
 * lands. The three requests leave together but land whenever they land, and the
 * unsorted card sits *above* both rows, so an arrival used to push content the
 * user had already started reading. Held space only ever means "not answered yet":
 * once a source has answered, an empty section is absent exactly as before.
 *
 * The media list re-reads itself while a tile of "Recently added" is still being
 * processed, and stops as soon as none is (`useProcessingRefresh`, task-405): a
 * media shared from another app used to keep its loading marker until the user
 * opened it and came back. Both sources also re-read themselves once when a save
 * is created behind this screen (`mediaSaveNotice`), which no schedule can cover:
 * a share that arrived on a signed-out session is ingested after this screen has
 * mounted and read itself, so there was no vignette here to arm anything with.
 *
 * Also hosts the ingestion gestures (task-264): a camera button that shoots
 * straight away, and an "add" button opening the choice between a link, a file
 * and a gallery photo (task-379). All four hand the result to the share
 * confirmation screen, which asks the one question left — whether to file it in
 * a folder — over a run already under way: since task-389 none of the four waits
 * for a tap to be sent.
 */

/**
 * How many tiles "Recently added" holds. The row is a landing strip, not a
 * library: past a dozen the user is better served by the Search tab, and every
 * extra tile is a cover to fetch on a screen that already has two rows.
 */
const RECENTLY_ADDED_LIMIT = 12;

export default function InboxScreen() {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  // The screen's copy is resolved on render, so it redraws with the language.
  useTranslation();
  const router = useRouter();
  const { startLocalUpload, startUrlEntry } = useShareIntake();
  const { refreshEntitlements } = usePurchases();
  const [isSourceSheetVisible, setSourceSheetVisible] = useState(false);
  const [isUrlDialogVisible, setUrlDialogVisible] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  /**
   * Whether the address currently in the field has already been handed over.
   *
   * A tap on Add starts an ingestion, so a second tap landing in the same frame
   * as the first — before the dialog has closed — would start a second one, on
   * the same URL, and the server has no idempotency key to fold them back
   * together. Reset when the dialog is opened, so a new deliberate entry is a new
   * ingestion.
   */
  const urlHandedOver = useRef(false);
  const {
    items,
    isLoading,
    isRefreshing,
    error,
    refresh,
    refetch,
    retry,
  } = useMediaList();
  const {
    continueLearning,
    hasLoadedContinueLearning,
    unsortedCount,
    hasLoadedUnsortedCount,
    refresh: refreshSections,
  } = useHomeSections();

  const recentTiles = useMemo(() => buildRecentlyAdded(items), [items]);

  /**
   * Whether a tile of "Recently added" is still being processed.
   *
   * Read off the twelve tiles the row actually holds rather than off the whole
   * list: a media that fell past the cap is not on this screen, and polling for
   * something the user cannot see is exactly the recurring request this app
   * declined to make.
   */
  const hasProcessing = useMemo(
    () =>
      recentTiles.some(
        (tile) => tile.kind === "media" && isProcessingLibraryStatus(tile.status),
      ),
    [recentTiles],
  );

  const { isStalled: isProcessingStalled, rearm: rearmProcessingRefresh } =
    useProcessingRefresh({ hasProcessing, refetch });

  // Entitlements, on focus: the minutes warning lives in this header, and minutes
  // are spent by imports made from this very screen, so reading the figure fetched
  // at sign-in would keep the banner a period behind.
  //
  // The three data sources are deliberately **not** here. Each hook hangs its own
  // read on its own `useFocusEffect`, which is the one path an open goes through;
  // calling them from this callback as well is what made a cold open issue all
  // three requests twice, since it fires in the same tick as a mount effect
  // (task-421). The multi-device sync this used to be about is unchanged — it just
  // lives in the hooks now.
  useFocusEffect(
    useCallback(() => {
      void refreshEntitlements();
    }, [refreshEntitlements]),
  );

  const handleRefresh = useCallback(async () => {
    // Both, together: the spinner belongs to the gesture, not to one endpoint,
    // and `refreshSections` never rejects.
    await Promise.all([refresh(), refreshSections()]);
    // The gesture is also what gives a spent refresh budget another one: a media
    // that outlived it is still on its way, and pulling down is how the user asks
    // again (task-404 §7.4).
    rearmProcessingRefresh();
  }, [refresh, refreshSections, rearmProcessingRefresh]);

  const handleUnsortedReviewPress = useCallback(() => {
    router.push("/media/unsorted-review");
  }, [router]);

  const handleTilePress = useCallback(
    (item: HomeTileItem) => {
      if (item.kind === "media") {
        router.push(`/media/${item.id}`);
      } else {
        router.push(`/media/folders/${item.id}`);
      }
    },
    [router],
  );

  /**
   * Route a picking outcome: a refusal (unsupported format, oversized file,
   * camera permission denied) is stated plainly and the screen stays as it was;
   * an accepted file opens the confirmation screen.
   */
  const handleImportResult = useCallback(
    (result: LocalImportResult, contentType: "file" | "photo") => {
      if (result.status === "cancelled") return;
      if (result.status === "error") {
        Alert.alert(result.title, result.message);
        return;
      }
      startLocalUpload(result.file, contentType);
    },
    [startLocalUpload],
  );

  // Both are fired by the sheet once it has finished closing, so the system
  // picker never has to present itself over a modal on its way out.
  const handleImportFile = useCallback(async () => {
    handleImportResult(await pickFileToImport(), "file");
  }, [handleImportResult]);

  const handleImportPhoto = useCallback(async () => {
    handleImportResult(await pickPhotoFromLibrary(), "photo");
  }, [handleImportResult]);

  const handleTakePhoto = useCallback(async () => {
    handleImportResult(await capturePhotoToImport(), "photo");
  }, [handleImportResult]);

  /**
   * Fired by the sheet once it has closed, for the same reason the two pickers
   * are: the dialog is a modal presented on the controller the sheet is leaving.
   */
  const handleEnterUrl = useCallback(() => {
    setUrlDraft("");
    setUrlError(null);
    urlHandedOver.current = false;
    setUrlDialogVisible(true);
  }, []);

  const handleCloseUrlDialog = useCallback(() => {
    setUrlDialogVisible(false);
    setUrlDraft("");
    setUrlError(null);
  }, []);

  /**
   * The one gate before an ingestion starts: the same extraction the share intent
   * goes through, so a link pasted with the sentence around it or typed without
   * its scheme is accepted here exactly as it is when it arrives from another app.
   *
   * A refusal stays in the dialog — no save is created, and the confirmation
   * screen is not opened — and leaves the field as it was, so a missing character
   * costs a correction rather than a retype.
   */
  const handleSubmitUrl = useCallback(
    (text: string) => {
      if (urlHandedOver.current) return;

      const validation = validateShareIntentPayload(text);
      if (!validation.valid) {
        setUrlError(t("addUrl.error.invalid"));
        return;
      }

      urlHandedOver.current = true;
      setUrlDialogVisible(false);
      setUrlDraft("");
      setUrlError(null);
      startUrlEntry(validation.url);
    },
    [startUrlEntry],
  );

  const continueTiles = useMemo(
    () => continueLearning.map(toEngagementTile),
    [continueLearning],
  );

  // Loading state — the only spinner on this screen, and only on the very first
  // media fetch. Every later refresh happens under the existing content.
  if (isLoading) {
    return (
      <SafeAreaView testID="inbox-screen" style={styles.container} edges={["top"]}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t("home.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state — only when the media list failed *and* has nothing cached. The
  // other two sections are decorations on a screen that cannot show its content.
  if (error && items.length === 0) {
    return (
      <SafeAreaView testID="inbox-screen" style={styles.container} edges={["top"]}>
        <View style={styles.centeredContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={Colors.textMuted}
            style={styles.errorIcon}
          />
          <Text style={styles.errorTitle}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={retry}
            accessibilityLabel={t("home.retryA11y")}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={18} color={Colors.onPrimary} />
            <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hasAnything = continueTiles.length > 0 || recentTiles.length > 0;
  // Not while a source can still turn out to have something: the empty state says
  // "share something to get started", and saying it over a block that is still
  // loading would be both wrong and one more thing to take away a moment later.
  const showEmptyState = !hasAnything && hasLoadedContinueLearning;

  return (
    <SafeAreaView testID="inbox-screen" style={styles.container} edges={["top"]}>
      {/* First child of the screen root, and it has to stay there: under
          `NativeTabs` the scrollable UIKit insets and hangs the scroll-edge
          effect on is found by walking the first-subview chain down from the
          screen (`RNSScrollViewFinder.findScrollViewInFirstDescendantChainFrom`
          in react-native-screens), so anything inserted above this loses both.
          The floating buttons below are fine: they come after it. */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Both read the entitlement state themselves and render nothing until
            they have something true to say — the trial notice while a trial is
            running, the minutes warning once the allowance is nearly spent. They
            stack in that order and, like every block below them, each carries the
            screen's one inter-block gap above itself and nothing below, so a
            trial user who is also low on minutes sees both, neither displacing
            the other, and an absent one costs the column nothing. */}
        <FreeTrialNotice />
        <MinutesWarningBanner />

        {/* The card's own space, held from the first paint: it sits above both
            rows, so it is the one block whose late arrival pushed content the user
            was already reading. Once the count is in, the card is drawn or — at
            zero — nothing is, exactly as before. */}
        {hasLoadedUnsortedCount ? (
          <UnsortedReviewButton
            count={unsortedCount}
            onPress={handleUnsortedReviewPress}
          />
        ) : (
          <UnsortedReviewPlaceholder />
        )}

        {recentTiles.length > 0 && (
          <TileRow
            testID="home-recently-added-row"
            icon="sparkles"
            title={t("home.recentlyAdded")}
            tiles={recentTiles}
            onTilePress={handleTilePress}
            processingStalled={isProcessingStalled}
          />
        )}

        {/* Once answered, absent entirely when there is nothing to continue: no
            heading, no empty box, no placeholder tiles. A brand-new account has
            engaged with nothing, and entries age out of the server's window on
            their own. Until then the row holds its exact height, heading included,
            so the tiles do not drop into place under a heading that was not there
            a frame earlier. */}
        {hasLoadedContinueLearning ? (
          continueTiles.length > 0 && (
            <TileRow
              testID="home-continue-learning-row"
              icon="play-circle"
              title={t("home.continueLearning")}
              tiles={continueTiles}
              onTilePress={handleTilePress}
            />
          )
        ) : (
          <TileRowPlaceholder
            icon="play-circle"
            title={t("home.continueLearning")}
          />
        )}

        {showEmptyState && <EmptyState />}
      </ScrollView>

      {/* box-none: the row now spans the full width, so without this it would
          swallow taps on the content sitting behind it. */}
      <View style={styles.fabStack} pointerEvents="box-none">
        <Pressable
          testID="inbox-camera-button"
          style={({ pressed }) => [
            styles.cameraButton,
            pressed && styles.addButtonPressed,
          ]}
          onPress={handleTakePhoto}
          accessibilityLabel={t("home.takePhotoA11y")}
          accessibilityRole="button"
        >
          <Ionicons name="camera" size={24} color={Colors.surface} />
        </Pressable>

        <Pressable
          testID="inbox-add-button"
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          onPress={() => setSourceSheetVisible(true)}
          accessibilityLabel={t("addSource.title")}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={28} color={Colors.onPrimary} />
        </Pressable>
      </View>

      <AddSourceSheet
        visible={isSourceSheetVisible}
        onClose={() => setSourceSheetVisible(false)}
        onEnterUrl={handleEnterUrl}
        onImportFile={handleImportFile}
        onImportPhoto={handleImportPhoto}
      />

      <UrlEntryDialog
        visible={isUrlDialogVisible}
        value={urlDraft}
        onChangeText={setUrlDraft}
        errorMessage={urlError}
        onClose={handleCloseUrlDialog}
        onSubmit={handleSubmitUrl}
      />
    </SafeAreaView>
  );
}

// --- Sub-components ---

interface UnsortedReviewButtonProps {
  count: number;
  onPress: () => void;
}

/**
 * The entry into the triage of the default folder — variant **F, "Layering
 * Principle — Deck tactile"** of `mobile-design-mockups/home_unsorted_review_card/`
 * (the second round, in `code2.html`), retained by the owner on 2026-09-07 with
 * no requested deviation.
 *
 * Nothing waiting, nothing to show: at zero the card is absent from the screen
 * altogether rather than sitting there inert with a `0` on it. A card offering
 * to sort an empty queue is one more thing to read on a landing screen that is
 * deliberately short.
 *
 * **The shape says the destination.** Two tonal plates peek out of the card's
 * bottom-end corner, so what waits reads as a deck to go through — DESIGN.md's
 * Layering Principle applied literally ("use the `surface-container` tiers to
 * stack information"), with the theme's own surfaces rather than a tint of the
 * card's own. Nothing here survives from the Daily Digest card that used to hold
 * this slot: the hairline border is gone (the No-Line rule calls a full-width
 * frame a "broad layout division"), `Shadows.soft` is gone (it was on three of
 * this screen's four interactive surfaces, so it distinguished nothing), and so
 * is `file-tray-outline` — which is the glyph of the very tab this card sits in,
 * and a piece of 20th-century office furniture the product does not handle.
 *
 * The count is a sticker on the icon plate instead of a chip in a trailing
 * cluster, and the chevron sits on a `textMain` disc instead of floating in pale
 * amber: the two corrections the second round of the mockup was made for.
 *
 * Two things the plates deliberately do *not* have, because the mockup flags
 * this variant as the most decorative of its round and the plates sit right
 * above the real media tiles: no shadow and no amber. They are tonal shifts of
 * the background, which keeps the deck an announcement over the list rather than
 * a fourth tile inside it.
 *
 * The three plates are declared back-to-front, because React Native paints
 * siblings in tree order. The two rear ones are absolute against the pressable's
 * own box and the front surface gives up the margin they show through, so no
 * plate ever escapes the card — and `start`/`end` mirror the whole deck in RTL
 * for free.
 */
function UnsortedReviewButton({ count, onPress }: UnsortedReviewButtonProps) {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  if (count <= 0) return null;

  return (
    <Pressable
      testID="home-unsorted-review-button"
      style={({ pressed }) => [
        styles.reviewDeck,
        pressed && styles.reviewDeckPressed,
      ]}
      onPress={onPress}
      accessibilityLabel={t("home.unsortedReviewA11y", {
        count: tCount("common.itemCount", count),
      })}
      accessibilityRole="button"
    >
      <View style={styles.reviewDeckPlateBack} />
      <View style={styles.reviewDeckPlateMid} />
      <View style={styles.reviewDeckSurface}>
        <View style={styles.reviewDeckIconPlate}>
          <Ionicons name="albums-outline" size={22} color={Colors.textMain} />
          <View style={styles.reviewDeckCount}>
            <Text style={styles.reviewDeckCountText}>{count}</Text>
          </View>
        </View>
        <Text style={styles.reviewDeckLabel} numberOfLines={2}>
          {t("home.unsortedReview")}
        </Text>
        <View style={styles.reviewDeckArrow}>
          <Ionicons name="chevron-forward" size={20} color={Colors.surface} />
        </View>
      </View>
    </Pressable>
  );
}

interface TileRowProps {
  testID: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tiles: HomeTileItem[];
  onTilePress: (item: HomeTileItem) => void;
  /**
   * Forwarded to every tile of the row. Only "Recently added" sets it: the
   * engagement row carries no status, so none of its tiles has a marker to still.
   */
  processingStalled?: boolean;
}

/**
 * A heading and one horizontally scrollable row of tiles.
 *
 * The heading is Title Case with an icon in the primary tint, replacing the
 * uppercase muted `YOUR MEDIA` label the vertical list used. The icon is an
 * Ionicon rather than an emoji: Ionicons is the app's icon language everywhere
 * else, and an emoji renders differently on each platform.
 *
 * The heading wraps rather than truncates. "Reprendre l'apprentissage" takes
 * 242 of the 246 points a 320-point screen leaves beside the icon, and
 * "Adicionados recentemente" takes all 246: one step up in the system text
 * size and a single line would cut off the very word that names the row.
 * Nothing below it has a fixed height, so a second line costs nothing.
 */
function TileRow({
  testID,
  icon,
  title,
  tiles,
  onTilePress,
  processingStalled = false,
}: TileRowProps) {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <FlatList
        testID={testID}
        data={tiles}
        keyExtractor={(tile) => `${tile.kind}:${tile.id}`}
        renderItem={({ item }) => (
          <HomeTile
            item={item}
            onPress={onTilePress}
            processingStalled={processingStalled}
          />
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
      />
    </View>
  );
}

// --- First-paint placeholders (task-417) ---

/**
 * What a block of this screen shows while its own first answer is in flight.
 *
 * Two of the three sources answer after the media list does, and the screen used
 * to render nothing at all for them until they did — so the column grew under the
 * user's eyes, and the unsorted card, which sits above both rows, pushed tiles
 * that were already on screen. These hold the exact height of what they stand in
 * for, so the swap costs no movement.
 *
 * They are tonal plates and nothing else: no spinner, no text, no amber. A
 * spinner per block would put three of them on one screen, and text would be one
 * more string to translate into twelve languages for something that is visible for
 * a fraction of a second. `surfaceContainer` on `background` is the shift DESIGN.md
 * prescribes for exactly this — a surface that is *there* without being content —
 * and the tile covers reuse `surfaceContainerLow`, which is already what a real
 * tile with no cover is drawn on.
 *
 * Invisible to a screen reader, which reads content and has no use for the absence
 * of any: nothing here is announced, and nothing here is focusable.
 */
const PLACEHOLDER_TILES = 2;

function UnsortedReviewPlaceholder() {
  const styles = useThemedStyles(makeStyles);

  return (
    <View
      testID="home-unsorted-review-placeholder"
      style={styles.reviewDeck}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* The same three plates in the same order as the card itself, so the
          silhouette is the one that is about to be there. The front surface has no
          children, which is what leaves it at its own `minHeight` — the height the
          loaded card settles at too. */}
      <View style={styles.reviewDeckPlateBack} />
      <View style={styles.reviewDeckPlateMid} />
      <View style={styles.reviewDeckSurface}>
        <View style={styles.placeholderIconPlate} />
        <View style={styles.placeholderLabelBar} />
      </View>
    </View>
  );
}

/**
 * The heading is the real one, with its real icon and its real string: it is what
 * makes the swap free. A skeleton bar in its place would be a different height
 * than the text that replaces it, which is the very shift this exists to remove.
 * Same style, same width, so it wraps onto exactly as many lines as `TileRow`'s.
 */
function TileRowPlaceholder({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <View
      testID="home-continue-learning-placeholder"
      style={styles.section}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.sectionHeaderRow}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {/* A plain View, not a FlatList: nothing here scrolls, and the second plate
          is cut by `overflow` at the edge the way the real row's second tile is
          cut by the viewport. */}
      <View style={styles.placeholderRow}>
        {Array.from({ length: PLACEHOLDER_TILES }, (_, index) => (
          <View key={index} style={styles.placeholderTile}>
            <View style={styles.placeholderCover} />
            <View style={styles.placeholderTextLine} />
            <View
              style={[styles.placeholderTextLine, styles.placeholderTextLineShort]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function EmptyState() {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="share-outline"
        size={48}
        color={Colors.textMuted}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>{t("home.empty")}</Text>
      <Text style={styles.emptyHint}>{t("home.emptyHint")}</Text>
    </View>
  );
}

// --- Tile assembly ---

/**
 * The engagement row is already merged, ordered and signed server-side, so this
 * only maps the wire shape onto the tile shape — and keeps the order it came in.
 */
function toEngagementTile(entry: RecentEngagement): HomeTileItem {
  if (entry.kind === "folder") {
    return {
      kind: "folder",
      id: entry.id,
      name: entry.title?.trim() || t("home.untitledFolder"),
      itemCount: entry.item_count ?? 0,
      previewImages: entry.preview_images ?? [],
    };
  }
  return {
    kind: "media",
    id: entry.id,
    title: entry.title ?? null,
    // What names a media nothing named (task-400). `created_at` on this payload
    // is the media's *save* date, not the engagement's — `engaged_at` would date
    // the tile by when it was last read, which is not what it is called.
    titleLabelKey: entry.title_label_key ?? null,
    savedAt: entry.created_at ?? null,
    creator: entry.creator_name ?? null,
    imageUrl: entry.image_url ?? null,
    // No `updated_at` on this payload, and `engaged_at` would churn the cache on
    // every engagement — the id alone is the stable identity here.
    cacheKey: entry.id,
    mediaType: (entry.media_type ?? "unknown") as MediaType,
  };
}

/**
 * "Recently added": what just arrived to read, and nothing else.
 *
 * Newest-first on `created_at`, and the whole row is capped. What makes a share
 * appear here before its processing is over is the backend, which emits a cover
 * as soon as it has one (task-353) — the row has no client-side optimistic tile
 * of its own, and the local-inbox path that would have fed one is gone
 * (task-356).
 *
 * Folders do not appear here (task-348): a folder is not something that just
 * arrived to read, and one created from the confirmation screen used to double
 * every filed save into two tiles. They keep their place in "Continue learning",
 * where picking a reading back up is the point.
 */
function buildRecentlyAdded(media: MediaListItem[]): HomeTileItem[] {
  const mediaTiles = media
    .map((item) => ({
      at: toTimestamp(item.created_at),
      tile: {
        kind: "media" as const,
        id: item.media_item_id,
        title: item.title ?? null,
        titleLabelKey: item.title_label_key ?? null,
        savedAt: item.created_at,
        creator: item.creator_name ?? null,
        imageUrl: item.media_image ?? null,
        cacheKey: `${item.media_item_id}:${item.updated_at}`,
        mediaType: (item.media_type ?? "unknown") as MediaType,
        // The row this tile is built from carries the library entry's status, so
        // an import that failed is marked here as it is in the Library — this is
        // the first surface a tester looks at after sharing something.
        status: item.status,
      },
    }))
    .sort((a, b) => b.at - a.at)
    .map((entry) => entry.tile);

  return mediaTiles.slice(0, RECENTLY_ADDED_LIMIT);
}

function toTimestamp(value?: string | null): number {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}


// --- Styles ---

const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    scrollContent: {
      // No top padding on purpose: whichever block comes first carries the gap
      // under the safe area itself, through the same `HOME_BLOCK_GAP` as every
      // other. Padding here would stack on top of it and make the head of the
      // screen the one place with a different rhythm — which is what it was, at 32
      // above the trial pill against 16 below it.
      // Room for the floating buttons so they never cover the last row, on top of
      // the band the tab bar owns. Derived from the same `TAB_BAR_CLEARANCE` the
      // buttons are pinned at rather than restated as a second figure: the row is
      // `TouchTarget.large` tall and sits that far above the screen bottom, and
      // `Spacing.sm` is the gap left between the last tile and it — the same 8 the
      // previous pair of values produced (64 + 32 against a 24 pt offset).
      paddingBottom: TAB_BAR_CLEARANCE + TouchTarget.large + Spacing.sm,
    },

    // Loading state
    centeredContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
    },
    loadingText: {
      fontSize: Typography.body.fontSize,
      color: Colors.textMuted,
      marginTop: Spacing.md,
    },

    // Error state
    errorIcon: {
      marginBottom: Spacing.md,
    },
    errorTitle: {
      fontSize: Typography.body.fontSize,
      color: Colors.textMain,
      textAlign: "center",
      marginBottom: Spacing.lg,
      lineHeight: 24,
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      backgroundColor: Colors.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm + 4,
      borderRadius: BorderRadius.lg,
      minHeight: TouchTarget.minimum,
    },
    retryButtonText: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.onPrimary,
    },

    // Unsorted review card — variant F, "Deck tactile" (task-362)
    reviewDeck: {
      marginHorizontal: Spacing.md,
      // Its share of the column's rhythm, above only — see `HOME_BLOCK_GAP`.
      marginTop: HOME_BLOCK_GAP,
    },
    reviewDeckPressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.9,
    },
    // The deepest plate: the furthest down and out, and the darkest of the three
    // tiers, so the stack reads as receding rather than as three stacked cards.
    reviewDeckPlateBack: {
      position: "absolute",
      top: Spacing.sm,
      start: Spacing.sm,
      end: 0,
      bottom: 0,
      borderRadius: BorderRadius.xl,
      backgroundColor: Colors.surfaceContainerHigh,
    },
    reviewDeckPlateMid: {
      position: "absolute",
      top: Spacing.xs,
      start: Spacing.xs,
      end: Spacing.xs / 2,
      bottom: Spacing.xs,
      borderRadius: BorderRadius.xl,
      backgroundColor: Colors.surfaceContainer,
    },
    reviewDeckSurface: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      minHeight: TouchTarget.comfortable + Spacing.xl,
      padding: Spacing.md,
      // The room the two rear plates show through, given up by the front surface
      // rather than taken as padding on the pressable: the plates are positioned
      // against the pressable's own box, and a padded box would move them.
      marginEnd: Spacing.xs,
      marginBottom: Spacing.sm,
      borderRadius: BorderRadius.xl,
      backgroundColor: Colors.surface,
    },
    reviewDeckIconPlate: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    reviewDeckCount: {
      position: "absolute",
      // Hangs off the plate's bottom-end corner and into the surface's own
      // padding — 8 of the 16 there is, so the sticker never reaches the card's
      // edge and the leading column stays 48 wide for the label's sake.
      end: -Spacing.sm,
      bottom: -Spacing.sm,
      minWidth: Spacing.lg,
      minHeight: Spacing.lg,
      // Grows inwards from that corner: the count is `media_count` of the default
      // folder, with no clamp on the client, so four digits have to fit.
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    reviewDeckCountText: {
      fontSize: Typography.small.fontSize,
      fontWeight: "700",
      color: Colors.onPrimary,
    },
    reviewDeckLabel: {
      flex: 1,
      fontSize: Typography.body.fontSize,
      fontWeight: "600",
      color: Colors.textMain,
    },
    reviewDeckArrow: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.textMain,
      alignItems: "center",
      justifyContent: "center",
    },

    // Rows
    section: {
      // Same gap as every other block, and on the same side of it, so the space
      // between the review card and the first heading and the space between the
      // first row and the second heading are one value. The row's own height no
      // longer varies with the kinds of tile it holds (`TILE_HEIGHT`), so this is
      // now the whole of what separates two rows.
      marginTop: HOME_BLOCK_GAP,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    sectionTitle: {
      // Claims the room left by the icon, so a second line starts beside the
      // icon rather than under it.
      flex: 1,
      fontSize: Typography.headline.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
    },
    rowContent: {
      paddingHorizontal: Spacing.md,
      gap: TILE_GAP,
    },

    // First-paint placeholders (task-417). Every dimension is borrowed from the
    // thing it stands in for — the deck's own plate styles above, the tile module's
    // exported geometry — so neither can be retuned without the other following.
    placeholderIconPlate: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surfaceContainer,
    },
    placeholderLabelBar: {
      // Half the card, which is about what the label takes on one line; a bar the
      // full remaining width would read as a loaded card with its text missing.
      width: "50%",
      height: Spacing.md,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.surfaceContainer,
    },
    placeholderRow: {
      flexDirection: "row",
      // Same gutter and same gap as `rowContent`, so the first plate starts where
      // the first tile will.
      paddingHorizontal: Spacing.md,
      gap: TILE_GAP,
      height: TILE_HEIGHT,
      overflow: "hidden",
    },
    placeholderTile: {
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
    },
    placeholderCover: {
      width: TILE_WIDTH,
      height: TILE_COVER_HEIGHT,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surfaceContainerLow,
    },
    placeholderTextLine: {
      height: Spacing.md,
      marginTop: Spacing.sm,
      borderRadius: BorderRadius.sm,
      backgroundColor: Colors.surfaceContainer,
    },
    placeholderTextLineShort: {
      width: "60%",
    },

    // Floating ingestion controls (task-264)
    fabStack: {
      position: "absolute",
      left: 0,
      right: 0,
      // Absolutely positioned, so nothing insets it for the bar: this row is the
      // reason `TAB_BAR_CLEARANCE` exists.
      bottom: TAB_BAR_CLEARANCE,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: Spacing.md,
    },
    addButton: {
      width: TouchTarget.large,
      height: TouchTarget.large,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      ...Shadows.soft,
    },
    cameraButton: {
      width: TouchTarget.large,
      height: TouchTarget.large,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.textMain,
      alignItems: "center",
      justifyContent: "center",
      ...Shadows.soft,
    },
    addButtonPressed: {
      transform: [{ scale: 0.96 }],
      opacity: 0.9,
    },

    // Empty state
    emptyContainer: {
      paddingTop: 100,
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
    },
    emptyIcon: {
      marginBottom: Spacing.md,
    },
    emptyTitle: {
      fontSize: Typography.headline.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
      textAlign: "center",
    },
    emptyHint: {
      fontSize: Typography.body.fontSize,
      color: Colors.textMuted,
      textAlign: "center",
      marginTop: Spacing.sm,
    },
  });
