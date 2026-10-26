import { SourceActions } from "../../../src/components/SourceActions";
import {
  useResourceSnapshot,
  useResourceState,
  useFolderMediaState,
} from "../../../src/contexts/ResourceCacheContext";
import { resourceKeys } from "../../../src/services/resourceCache";
import type { ListMediaResponse } from "@media-summarizer/core/types/media";
import type { Folder } from "@media-summarizer/core/types/organization";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { OrganizationService } from "../../../src/services/organizationService";
import { useScopeArtifacts } from "../../../src/hooks/useScopeArtifacts";
import { ArtifactsPanel } from "../../../src/components/ArtifactsPanel";
import { ChatDock } from "../../../src/components/chat/ChatDock";
import { AnchoredContextMenu } from "../../../src/components/AnchoredContextMenu";
import { MediaListCard } from "../../../src/components/MediaListCard";
import { isProcessingLibraryStatus } from "../../../src/components/MediaProcessingSweep";
import { RenameDialog } from "../../../src/components/RenameDialog";
import { Toast, useToast } from "../../../src/components/Toast";
import { ScreenTabs, type ScreenTab } from "../../../src/components/ScreenTabs";
import { SubfolderCard } from "../../../src/components/SubfolderCard";
import { useMediaActions } from "../../../src/hooks/useMediaActions";
import { useFolderActions } from "../../../src/hooks/useFolderActions";
import { useProcessingRefresh } from "../../../src/hooks/useProcessingRefresh";
import { getFriendlyErrorMessage } from "../../../src/lib/getFriendlyErrorMessage";
import {
  buildFolderTree,
  getDefaultFolderLabel,
  groupMediaBySubtree,
  type FolderNode,
} from "../../../src/lib/folderTree";
import {
  Typography,
  Spacing,
  BorderRadius,
  TouchTarget,
  type Theme,
} from "../../../src/constants/theme";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../src/contexts/ThemeContext";
import { t, useTranslation } from "../../../src/i18n";
import {
  ScreenHeader,
  HeaderIconButton,
  HeaderMenuButton,
  HeaderMenuGlyph,
  SCREEN_HEADER_HEIGHT,
} from "../../../src/components/ScreenHeader";
import type { MediaListItem } from "@media-summarizer/core/types/media";

/**
 * Folders explorer — single folder view, split in two intra-screen tabs
 * along the NotebookLM reference of task-263.
 *
 * **Sources** lists what the folder holds, subfolders before media, as the
 * Library lists it (task-412, variant A of the folder Sources mockups): every
 * source is a `MediaListCard`, the Library's own vignette reused as is — cover,
 * type badge, age, two-line title, creator — and every subfolder a
 * `SubfolderCard` of the same gabarit, whose frame is a collage of the covers
 * it holds. In a folder of reels, where every row used to carry the same play
 * glyph, the covers are what tells the sources apart. When there are subfolders
 * the two groups are captioned, "Folders" then "Sources · N"; a folder of
 * sources only needs no caption. The vignette brings its import markers along,
 * and the bounded refresh that ends a processing sweep is armed here as it is
 * in the Library.
 *
 * **AI** generates artifacts over the **whole folder** (subfolders
 * included, as the backend resolves the folder and all its descendants), then
 * lists what has already been produced, newest first, under the generations
 * still running. That list is an append-only history:
 * several entries of the same type coexist, each keeping the sources it was
 * generated over even after the folder has changed. Nothing here expires,
 * and nothing is regenerated automatically.
 *
 * The header carries the folder itself: a `…` beside the title renames or
 * deletes the one being looked at, so filing does not require going back to the
 * grid to long-press its tile. It is absent on the default folder, whose two
 * rows the backend would both refuse.
 *
 * A new entry only exists when the sources differ (task-322): an artifact is
 * keyed on the set of sources behind it, so asking again over an unchanged
 * folder answers the entry already stored, which then opens. The grid is
 * therefore always offered (task-534) — there is no comparison of the
 * folder's sources with what its last artifacts read.
 */

/**
 * The lifted copy of a pressed card is inert — the context menu draws it with
 * `pointerEvents="none"` — but `MediaListCard` requires a tap handler, so this
 * is the one it gets.
 */
const noopOpenMedia = () => {};

type FolderTabKey = "sources" | "ai";

const FOLDER_TABS: readonly ScreenTab<FolderTabKey>[] = [
  { key: "sources", labelKey: "folder.tab.sources", icon: "documents-outline" },
  { key: "ai", labelKey: "folder.tab.ai", icon: "sparkles-outline" },
];

/**
 * A group caption, drawn only when the folder has subfolders to set apart. Its
 * copy is resolved at render time, never stored here, so a change of interface
 * language redraws it.
 */
type CaptionListRow =
  | { kind: "caption"; key: "folders" }
  | { kind: "caption"; key: "sources"; count: number };

interface FolderListRow {
  kind: "folder";
  node: FolderNode;
  /** Every source under the subfolder, descendants included: its collage. */
  subtreeMedia: readonly MediaListItem[];
}

interface MediaListRow {
  kind: "media";
  media: MediaListItem;
}

type Row = CaptionListRow | FolderListRow | MediaListRow;

function rowKey(row: Row): string {
  switch (row.kind) {
    case "caption":
      return `caption:${row.key}`;
    case "folder":
      return `folder:${row.node.id}`;
    case "media":
      return `media:${row.media.media_item_id}`;
  }
}

export default function FolderDetailScreen() {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  // Copy resolved on render: redraw when the interface language changes.
  useTranslation();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const folderId = params.id;

  const [activeTab, setActiveTab] = useState<FolderTabKey>("sources");
  const [cachedFolders] = useResourceState<Folder[]>(resourceKeys.folders, []);
  const cachedFolderPage = useResourceSnapshot<ListMediaResponse>(
    resourceKeys.mediaPage({ folderId, limit: 100 }),
  );
  const cachedFolderList = useResourceSnapshot<Folder[]>(resourceKeys.folders);
  const currentFolder = useMemo(
    () => buildFolderTree(cachedFolders).nodeById.get(folderId) ?? null,
    [cachedFolders, folderId],
  );
  const childFolders = useMemo(
    () =>
      [...(currentFolder?.children ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [currentFolder],
  );
  // The folder's `getFolderMedia` response as it came: descendants included,
  // newest first. Held whole because three things read it — the sources stored
  // directly here, which the Sources list shows; the subtree of each subfolder,
  // which its collage is drawn from; and every media id, which is exactly the
  // scope a generation over this folder reads.
  const [folderMedia, setFolderMedia] = useFolderMediaState(folderId);
  const title = currentFolder?.is_default
    ? getDefaultFolderLabel()
    : (currentFolder?.name ?? params.name ?? t("search.folders"));
  // The folder itself, as the tree knows it. Held because the header menu
  // needs more than a name: the subfolders a deletion would take with it,
  // and the `is_default` flag that decides whether the menu exists at all.
  const folder = currentFolder;
  const [isLoading, setIsLoading] = useState(true);
  const loadRequest = useRef(0);
  const hasContent =
    cachedFolderPage.data !== undefined && cachedFolderList.data !== undefined;
  const readError = cachedFolderPage.error ?? cachedFolderList.error;
  const error = readError
    ? getFriendlyErrorMessage(readError, { fallback: t("folder.loadFailed") })
    : null;

  const load = useCallback(async () => {
    if (!isAuthenticated || !folderId) return;
    const request = ++loadRequest.current;
    try {
      const [, folderMedia] = await Promise.all([
        OrganizationService.getUserFolders(),
        OrganizationService.getFolderMedia(folderId),
      ]);

      if (request !== loadRequest.current) return;
      // Both services publish into the shared resources before resolving.
      setFolderMedia(folderMedia);
    } catch {
      /* Shared snapshots publish failures without hiding saved responses. */
    }
  }, [isAuthenticated, folderId, setFolderMedia]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);
      load().finally(() => {
        if (active) setIsLoading(false);
      });
      return () => {
        active = false;
        loadRequest.current += 1;
      };
    }, [load]),
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  const handleOpenFolder = useCallback(
    (node: FolderNode) => {
      router.push({
        pathname: "/media/folders/[id]",
        params: { id: node.id, name: node.name },
      });
    },
    [router],
  );

  const handleOpenMedia = useCallback(
    (mediaItemId: string) => {
      router.push(`/media/${mediaItemId}`);
    },
    [router],
  );

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // The backend folder filter includes descendants; the list keeps only the
  // media stored directly in this folder, so subfolders own their own items.
  const media = useMemo(
    () => folderMedia.filter((item) => item.folder_id === folderId),
    [folderMedia, folderId],
  );

  // What each subfolder card draws its collage from, regrouped from the
  // response already on screen: no request per subfolder.
  const subtreeMediaByFolder = useMemo(
    () => groupMediaBySubtree(childFolders, folderMedia),
    [childFolders, folderMedia],
  );

  /**
   * The silent re-read the processing refresh ticks on: the media only, since a
   * folder has no lifecycle of its own, and never the full-screen spinner — a
   * tick must leave the cards where they are. A failed tick changes nothing on
   * screen, where the card still truthfully says "on its way", and the next one
   * retries.
   */
  const refreshMedia = useCallback(async () => {
    if (!isAuthenticated || !folderId) return;
    const request = ++loadRequest.current;
    try {
      const media = await OrganizationService.getFolderMedia(folderId);
      if (request === loadRequest.current) setFolderMedia(media);
    } catch {
      // Deliberately silent, see above.
    }
  }, [isAuthenticated, folderId, setFolderMedia]);

  /**
   * Whether a source card on screen is still being processed. Read off the
   * direct sources, and only while the Sources tab is the one drawn: a
   * subfolder's collage carries no sweep, and the AI tab shows no card at all.
   */
  const hasProcessingMedia =
    activeTab === "sources" &&
    !isLoading &&
    !error &&
    media.some((item) => isProcessingLibraryStatus(item.status));

  // The same bounded schedule as the Library: a fast minute, then a slower
  // tick, up to a budget after which the sweep stands still (task-404 §7.4).
  const { isStalled: isProcessingStalled, rearm: rearmProcessingRefresh } =
    useProcessingRefresh({
      hasProcessing: hasProcessingMedia,
      refetch: refreshMedia,
    });

  // Pull-to-refresh reloads the folder under the list already on screen, and is
  // one of the gestures that grants a spent refresh budget another one, as it is
  // in the Library.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void load().finally(() => setIsRefreshing(false));
    rearmProcessingRefresh();
  }, [load, rearmProcessingRefresh]);

  // Removed from the whole response, not only from the list: a deleted media
  // also leaves the scope a generation over this folder would read.
  const handleMediaDeleted = useCallback(
    (mediaItemId: string) => {
      loadRequest.current += 1;
      setFolderMedia((current) =>
        current.filter((item) => item.media_item_id !== mediaItemId),
      );
    },
    [setFolderMedia],
  );

  // Patched in place rather than refetched: the rename already returned the
  // stored title, and the card has to carry it before the user leaves the screen.
  const handleMediaRenamed = useCallback(
    (mediaItemId: string, title: string) => {
      loadRequest.current += 1;
      setFolderMedia((current) =>
        current.map((item) =>
          item.media_item_id === mediaItemId ? { ...item, title } : item,
        ),
      );
    },
    [setFolderMedia],
  );

  // Says where "New folder" put a source, just under the header.
  const insets = useSafeAreaInsets();
  const { showToast, toastProps } = useToast();

  // The long-press menu of a source card. A move out of this folder needs no
  // handling here: the focus refetch above runs when the picker is popped, and
  // the card is gone because the folder no longer holds that media. "New
  // folder" leaves no screen, so its card is dropped here: the folder it made is
  // a root one, never this folder nor one under it.
  const mediaActions = useMediaActions({
    onDeleted: handleMediaDeleted,
    onRenamed: handleMediaRenamed,
    onMovedToFolder: handleMediaDeleted,
    showToast,
  });

  // The copy of the pressed card the menu lifts above its blur: the same card,
  // with its own margins dropped so it lands exactly on its measured rect. The
  // stall is carried too — a sweeping band lifted over a still one would be the
  // very mismatch the lift exists to hide.
  const renderSourcePreview = useCallback(
    (item: MediaListItem) => (
      <MediaListCard
        item={item}
        onPress={noopOpenMedia}
        processingStalled={isProcessingStalled}
        style={styles.sourceCardPreview}
      />
    ),
    [isProcessingStalled, styles.sourceCardPreview],
  );

  // Patched in place rather than refetched: the rename already returned the
  // stored name, and it has to reach the header before the user leaves.
  const handleFolderRenamed = useCallback(() => {
    void load();
  }, [load]);

  // The header `…`: rename or delete the folder being looked at, without
  // going back to the grid to long-press its tile.
  const folderActions = useFolderActions({
    // Nothing left to show: this screen is about a folder that no longer
    // exists. What became of its sources and subfolders is the business of
    // the surface behind, which refetches on focus.
    onDeleted: handleBack,
    onRenamed: handleFolderRenamed,
  });

  // The copy of the pressed control the menu lifts above its blur. A header
  // button has no row to redraw, so it redraws itself: the `…` stays sharp and
  // the card visibly hangs from it.
  const renderActionsPreview = useCallback(() => <HeaderMenuGlyph />, []);

  // The default folder is left out, exactly as its tile is in Library: the
  // backend refuses to rename or delete it (`folder_service.update_folder` /
  // `delete_folder` both raise on `is_default`), and a menu whose two rows would
  // both fail is worse than no menu. Same answer before the first load answers,
  // when nothing is known about the folder yet.
  const managedFolder = folder && folder.is_default !== true ? folder : null;

  // Subfolders first, then the sources. The captions only exist to set the two
  // groups apart, so a folder without subfolders is one caption-less list.
  const rows = useMemo<Row[]>(() => {
    const folderRows = childFolders.map(
      (node): Row => ({
        kind: "folder",
        node,
        subtreeMedia: subtreeMediaByFolder.get(node.id) ?? [],
      }),
    );
    const mediaRows = media.map((m): Row => ({ kind: "media", media: m }));
    if (folderRows.length === 0) return mediaRows;
    return [
      { kind: "caption", key: "folders" },
      ...folderRows,
      { kind: "caption", key: "sources", count: media.length },
      ...mediaRows,
    ];
  }, [childFolders, media, subtreeMediaByFolder]);

  const sourceOffset = useRef(0);
  const renderSourceRow = (item: Row, inConversation = false) => {
    switch (item.kind) {
      case "caption":
        return (
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {item.key === "folders"
              ? t("folder.section.folders")
              : t("folder.section.sources", { count: item.count })}
          </Text>
        );
      case "folder":
        return (
          <SubfolderCard
            node={item.node}
            subtreeMedia={item.subtreeMedia}
            onPress={handleOpenFolder}
            testID={`folder-source-folder-${item.node.id}`}
          />
        );
      case "media":
        return (
          <MediaListCard
            item={item.media}
            onPress={handleOpenMedia}
            onLongPress={inConversation ? undefined : mediaActions.open}
            processingStalled={isProcessingStalled}
            testID={`folder-source-media-${item.media.media_item_id}`}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={title}
        leading={
          <HeaderIconButton
            icon="arrow-back"
            onPress={handleBack}
            accessibilityLabel={t("common.goBack")}
          />
        }
        trailing={
          managedFolder ? (
            <HeaderMenuButton
              onPress={(anchor) => folderActions.open(managedFolder, anchor)}
              accessibilityLabel={t("folderActions.moreA11y")}
              testID="folder-header-actions"
            />
          ) : undefined
        }
      />

      <View style={styles.tabsContainer}>
        <ScreenTabs
          tabs={FOLDER_TABS}
          activeKey={activeTab}
          onChange={setActiveTab}
          accessibilityLabel={t("folder.sectionsA11y")}
        />
      </View>

      {error && hasContent ? (
        <Pressable
          onPress={handleRetry}
          accessibilityRole="button"
          style={styles.tabsContainer}
        >
          <Text style={styles.centeredText}>
            {error} · {t("common.retry")}
          </Text>
        </Pressable>
      ) : null}
      {isLoading && !hasContent ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centeredText}>{t("common.loading")}</Text>
        </View>
      ) : error && !hasContent ? (
        <View style={styles.centered}>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={Colors.textMuted}
            style={styles.centeredIcon}
          />
          <Text style={styles.centeredTitle}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={handleRetry}
            accessibilityLabel={t("folder.retryA11y")}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={18} color={Colors.onPrimary} />
            <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : activeTab === "sources" ? (
        <View style={styles.sourcesBody} collapsable={false}>
        <FlatList
          data={rows}
          keyExtractor={rowKey}
          renderItem={({ item }) => renderSourceRow(item)}
          onScroll={(event) => {
            sourceOffset.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={<EmptyState />}
          testID="folder-sources-list"
        />
        {folderId ? <SourceActions folder={{ id: folderId, path: title }} bottomOffset={0} /> : null}
        </View>
      ) : (
        <AiTab folderId={folderId} />
      )}

      {/* The chat composer, on the Sources tab only (owner decision of
          task-434), under the list. The SafeAreaView already keeps the bottom
          inset. */}
      {hasContent && activeTab === "sources" && folderId ? (
        <ChatDock
          key={folderId}
          scope="folder"
          scopeId={folderId}
          title={title}
          getSourceOffset={() => sourceOffset.current}
          sourceContent={
            <View style={styles.chatSources}>
              {rows.length ? (
                rows.map((row) => (
                  <View key={rowKey(row)}>{renderSourceRow(row, true)}</View>
                ))
              ) : (
                <EmptyState />
              )}
            </View>
          }
        />
      ) : null}

      {/* Screen level, outside the list: the menu belongs to the screen's
          state, and mounting it inside a row would tie a modal to a cell the
          virtualizer is free to recycle. */}
      <AnchoredContextMenu
        {...mediaActions.menuProps}
        renderPreview={renderSourcePreview}
      />
      <RenameDialog {...mediaActions.renameProps} />
      <RenameDialog {...mediaActions.newFolderProps} />
      <Toast
        {...toastProps}
        top={insets.top + SCREEN_HEADER_HEIGHT + Spacing.sm}
      />

      {/* The folder's own menu, opened from the header rather than from a
          row. Two menus, never both up: each is driven by its own visibility. */}
      <AnchoredContextMenu
        {...folderActions.menuProps}
        renderPreview={renderActionsPreview}
      />
      <RenameDialog {...folderActions.renameProps} />
    </SafeAreaView>
  );
}

// --- AI tab ---

interface AiTabProps {
  folderId: string;
}

/**
 * The folder's half of the AI tab. Everything visible is `ArtifactsPanel` and
 * everything it reads is `useScopeArtifacts`, both shared verbatim with the
 * AI tab of a media item so the two cannot drift apart again. The scope is
 * the folder and all its descendants, which the backend resolves.
 */
function AiTab({ folderId }: AiTabProps) {
  const artifacts = useScopeArtifacts("folder", folderId);

  return (
    <ScrollView showsVerticalScrollIndicator={false} testID="folder-ai-tab">
      {/* Generation is always offered, whatever state the sources are in: one
          still being transcribed or translated no longer forbids the request —
          the entry is held and starts by itself when the text lands (task-360). */}
      <ArtifactsPanel scope="folder" artifacts={artifacts} />
    </ScrollView>
  );
}

// --- Sub-components ---

function EmptyState() {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="file-tray-outline"
        size={48}
        color={Colors.textMuted}
        style={styles.centeredIcon}
      />
      <Text style={styles.emptyTitle}>{t("folder.empty")}</Text>
      <Text style={styles.emptyHint}>{t("folder.emptyHint")}</Text>
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    // One page gutter for the whole screen, `Spacing.lg`, the same the header
    // already used and the same `ArtifactsPanel` brings to the AI tab: the tab bar
    // and the cards of the Sources list line up with the tiles under them.
    tabsContainer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    // The cards bring their own `Spacing.md` side margin, the Library's gutter;
    // the list adds the difference so they land on this screen's `Spacing.lg`,
    // under the tabs, without either card being told about this page.
    chatSources: {
      paddingHorizontal: Spacing.lg - Spacing.md,
    },
    sourcesBody: { flex: 1 },
    listContent: {
      paddingHorizontal: Spacing.lg - Spacing.md,
      paddingTop: Spacing.sm,
      // The overlay sits above the chat dock; the SafeAreaView owns the bottom
      // inset. Leave enough scroll room to reveal the last card above it.
      paddingBottom: TouchTarget.large + Spacing.sm * 2 + Spacing.md,
    },
    // A group caption of the Sources list. The uppercase muted caption stays
    // confined to it — the AI tab's headings are section openers and use
    // `Typography.headline`. Side margin as the cards', so it starts where they do.
    sectionTitle: {
      fontSize: Typography.label.fontSize,
      fontWeight: "700",
      color: Colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    // The card as the context menu redraws it: its margins are what the measured
    // rect already excludes, so keeping them would shift the copy.
    sourceCardPreview: {
      marginHorizontal: 0,
      marginBottom: 0,
    },

    // Centered states
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
    },
    centeredText: {
      fontSize: Typography.body.fontSize,
      color: Colors.textMuted,
      marginTop: Spacing.md,
    },
    centeredIcon: {
      marginBottom: Spacing.md,
    },
    centeredTitle: {
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

    // Empty state
    emptyContainer: {
      paddingTop: 100,
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
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
      lineHeight: Typography.body.lineHeight,
    },
  });
