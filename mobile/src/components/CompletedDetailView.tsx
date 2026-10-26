import { SourceSupportRequestCard } from "./SourceSupportRequestCard";
import { ResourceRefreshNotice } from "./ResourceRefreshNotice";
import { useUserPreferences } from "../contexts/UserPreferencesContext";
import type { ArtifactListResponse } from "@media-summarizer/core/types/artifacts";
import { useResourceSnapshot } from "../contexts/ResourceCacheContext";
import { resourceKeys } from "../services/resourceCache";
import { isResourceGone } from "@media-summarizer/core/cache/resourceCache";
/**
 * A media item that has finished processing, as a page.
 *
 * The cover and what names the source (`MediaDetailHero`), then two intra-screen
 * tabs: the text ("Reader") and artifact generation ("AI"). Everything it shows
 * comes from the `mediaData` prop — it reads no route parameter and holds no
 * polling of its own, so the same component renders the `/media/[id]` route and a
 * page of the Digest carousel (`app/(tabs)/digest/[period].tsx`). That is the
 * point of it living here rather than in the route: a change to the media page
 * lands in both by construction, chrome included — the carousel shows the back
 * and `…` buttons too (task-409).
 *
 * The composition is direction C of the task-410 benchmark, the owner's pick for
 * task-411, with the preview block of its direction A:
 *
 *     cover band (under the status bar; creator and title on glass; back and …)
 *     Reader | AI
 *     "L'essentiel" (Callout Aside)      ← `SourcePreview`
 *     Full text                          ← `TranscriptReader`
 *
 * Once the Reader | AI segment has scrolled under the top edge, `MediaReaderBar`
 * fades in over the top: back, a thumbnail, the title, the segment folded to two glyphs, and the reading
 * progress. It replaces the header and the sticky segment the page used to keep
 * on screen. Filing the item moved into the `…` menu with it.
 *
 * The route keeps what belongs to a route: the fetch, and the loading,
 * processing, timeout and failure states of the item on its way here.
 *
 * `useRouter()` stays — the folder picker and an artifact are pushed the
 * same way from a route as from the carousel. What does not stay is any read of
 * the URL segment.
 */

import { useRecoverableImage } from "../hooks/useRecoverableImage";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  ActivityIndicator,
  Pressable,
  Text,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { useAuth } from "../contexts/AuthContext";
import {
  MediaService,
  type RawContentResponse,
} from "../services/mediaService";
import { ArtifactService } from "../services/artifactService";
import type { ArtifactSummary } from "@media-summarizer/core/types/artifacts";
import { OrganizationService } from "../services/organizationService";
import { getFriendlyErrorMessage } from "../lib/getFriendlyErrorMessage";
import type { ArtifactTileState } from "./ArtifactTile";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { ScreenTabs, type ScreenTab } from "./ScreenTabs";
import { ChatDock } from "./chat/ChatDock";
import { AnchoredContextMenu } from "./AnchoredContextMenu";
import {
  MediaDetailHero,
  MediaHeroMenuGlyph,
  getCoverBandLayout,
  type MediaCover,
} from "./MediaDetailHero";
import { MediaReaderBar, MEDIA_READER_BAR_HEIGHT } from "./MediaReaderBar";
import { RenameDialog } from "./RenameDialog";
import { Toast, useToast } from "./Toast";
import { useMediaActions } from "../hooks/useMediaActions";
import {
  useTranslationRefresh,
  type TranslationBudgets,
} from "../hooks/useTranslationRefresh";
import {
  TranscriptReader,
  type TranscriptContentState,
  type TranscriptTranslationToggle,
} from "./TranscriptReader";
import {
  SourcePreview,
  resolveSourcePreviewState,
  type SourcePreviewState,
} from "./SourcePreview";
import { Spacing, type Theme } from "../constants/theme";
import { useTheme, useThemedStyles } from "../contexts/ThemeContext";
import { LOCALE_ENDONYMS, t } from "../i18n";
import { isSupportedLocale } from "@media-summarizer/core/i18n/locales";
import type {
  MediaStatusResponse,
  MediaItemContract,
  ArtifactType,
} from "@media-summarizer/core/types/media";
import { getMediaTypeIcon, getMediaTypeLabel } from "../lib/mediaTypeDisplay";
import { resolveMediaTitle } from "../lib/mediaTitle";
import { describeArtifactRefusal } from "../lib/artifactRefusal";

/**
 * The two intra-screen tabs of a media item: what it says, and what the models
 * can make of it. Reader is the default — the content comes first, generating
 * something out of it is a deliberate second step.
 */
type MediaDetailTabKey = "reader" | "ai";

const MEDIA_DETAIL_TABS: readonly ScreenTab<MediaDetailTabKey>[] = [
  { key: "reader", labelKey: "media.tab.reader", icon: "book-outline" },
  { key: "ai", labelKey: "media.tab.ai", icon: "sparkles-outline" },
];

/**
 * Some legacy items still carry the unscoped "summary" type from before
 * `summary_short`. Surface them under the "Summary" tile instead of dropping
 * them on the floor.
 */
function buildInitialArtifactStates(): Record<ArtifactType, ArtifactTileState> {
  return {
    summary: { status: "idle", generationAvailable: true },
    summary_short: { status: "idle", generationAvailable: true },
    notes: { status: "idle", generationAvailable: true },
    flashcards: { status: "idle", generationAvailable: true },
    quiz: { status: "idle", generationAvailable: true },
  };
}

const ARTIFACT_POLL_INTERVAL_MS = 3000;

/**
 * What a read of `/raw-content` says the Reader should show.
 *
 * The one reading of the response, shared by the first load and by the silent
 * re-reads of the translation poll, so the two cannot drift apart. A pending
 * translation is the original text *with* its pending status — never `ready`:
 * how long the wait has lasted is the poll's business (`useTranslationRefresh`),
 * and running out of patience does not turn the original into the translation.
 */
function resolveTranscriptContent(
  response: RawContentResponse,
): TranscriptContentState {
  const content = (response.content ?? "").trim();
  if (!content) return { status: "not_available" };
  // Failed for good: the original, with the failure said.
  if (response.translation?.translation_status === "failed") {
    return { status: "translation_failed", content };
  }
  if (response.translation?.translation_pending === true) {
    return { status: "translation_pending", content };
  }
  return { status: "ready", content };
}

/**
 * Where the Reader stands on showing the source text of a translated media
 * (task-419).
 *
 * The body lives in the session cache; this state only owns the visible switch
 * and the first read's indicator. Revalidation keeps an available body visible.
 */
type OriginalTextState = {
  /** Whether the source text is the body on screen. */
  shown: boolean;
  /** A read of `?variant=original` is in flight. */
  loading: boolean;
};

const NO_ORIGINAL_TEXT: OriginalTextState = {
  shown: false,
  loading: false,
};

/** Delay between polls while the source preview is still being generated (ms). */
const PREVIEW_POLL_DELAY_MS = 3000;
/**
 * Maximum number of preview reads, i.e. one minute of waiting.
 *
 * The generation runs off the completion event and takes seconds, so a preview
 * that has not landed by then is not going to land while the screen is open.
 * Reaching this bound is therefore an answer, and the section says so — a
 * terminal line, not a waiting line kept alive by nothing. Coming back to the
 * screen re-reads the item and buys a fresh minute if the API still calls the
 * generation pending, which is the only thing that could still change it.
 */
const PREVIEW_POLL_MAX_ATTEMPTS = 20;

/**
 * The reading progress is announced in steps of this many percent: fine enough
 * to tell where one is, coarse enough that scrolling does not re-render the page
 * on every frame to update a number nobody is listening to.
 */
const PROGRESS_ANNOUNCE_STEP = 10;

/**
 * The language of the text, as the translation switch names it.
 *
 * One of the app's eleven languages is named in its own script — "Français",
 * "日本語" — which is how the text under it is written, and the same name the
 * language settings use. Anything else keeps its code in capitals, as the page
 * has always shown it: there is no localised name for it to fall back on.
 */
function describeLanguage(code: string | null | undefined): string | null {
  const primary = code?.trim().split(/[-_]/)[0]?.toLowerCase();
  if (!primary) return null;
  return isSupportedLocale(primary)
    ? LOCALE_ENDONYMS[primary]
    : primary.toUpperCase();
}

/**
 * The same language as a short tag — "EN", "FR", "JA".
 *
 * What the translation switch puts in its visible label, where the row it sits on
 * has a title to share and no width to give to "Français". The name spelled out
 * is what the screen reader gets instead (task-419).
 */
function languageTag(code: string | null | undefined): string | null {
  const primary = code?.trim().split(/[-_]/)[0]?.toUpperCase();
  return primary || null;
}

/** An `original_url` that is actually a destination the OS can open. */
type SourceLink = {
  /** The http(s) URL handed to `Linking.openURL`, verbatim. */
  url: string;
  /** Host without the `www.` prefix, used to name the destination out loud. */
  host: string;
};

/**
 * Decides whether the stored source URL is something we can offer to reopen.
 *
 * Only http(s) qualifies, and that is deliberate: on iOS and Android an
 * `instagram.com` / `youtube.com` https URL is claimed by the installed app and
 * opens it natively, so a universal link needs no per-source custom scheme (and
 * no `LSApplicationQueriesSchemes` entry per platform).
 *
 * Everything else stored in `source_url` is not a destination. Checked against
 * `user_media-dev` on 2026-08-17: uploads carry no `source_url` attribute at all
 * (the API defaults it to `""`), and shared audio and text carry a synthetic
 * `share://<platform>/...` marker. Both return `null` here, which is what keeps
 * the title from linking to a synthetic marker.
 */
function resolveSourceLink(rawUrl: string): SourceLink | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    const host = parsed.hostname.replace(/^www\./, "");
    if (!host) return null;
    return { url: trimmed, host };
  } catch {
    return null;
  }
}

export interface CompletedDetailViewProps {
  mediaData: MediaStatusResponse;
  /**
   * Leave the item: the back arrow over the cover and the one in the collapsed
   * bar.
   */
  onBack: () => void;
  /**
   * The item was deleted from the `…` menu, once the server has confirmed it.
   * Where that leaves the user is the host's call: the route goes back, the
   * Digest carousel drops the page and stays on the period.
   */
  onDeleted: () => void;
  /**
   * Whether the page is mounted straight under the status bar, which is the
   * route (the default): the cover then runs under the status bar, and the page
   * sets the status bar's style — light over the picture, dark once the bar is
   * under it. The Digest carousel mounts it under a band of its own instead, so
   * there the page starts at 0 and leaves the status bar to the screen. Nothing
   * else differs between the two: both carry the back and `…` buttons.
   */
  underStatusBar?: boolean;
  processingNotice?: { message: string; failed: boolean; retry: () => void };
  /**
   * Where the budget of the translation poll is kept, for a host that mounts
   * and unmounts this page while its screen stays open — the Digest carousel,
   * whose pages come and go with the swipes. Without it the budget lives with
   * the mount, which is right for the route: there, a mount is the opening of
   * the screen.
   */
  translationBudgets?: TranslationBudgets;
}

const EMPTY_ARTIFACTS: ArtifactSummary[] = [];

export function CompletedDetailView({
  mediaData,
  onBack,
  onDeleted,
  underStatusBar = true,
  translationBudgets,
  processingNotice,
}: CompletedDetailViewProps): React.JSX.Element {
  // `mode` for the status bar glyphs below, which are a prop rather than a
  // style and so cannot come from the sheet.
  const { mode, colors: Colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { media_item, processing_job } = mediaData;

  // --- Folder state ---
  //
  // Read back from the item on every return to the screen: the picker the `…`
  // menu opens writes the move to the item, not to this screen. It is what the
  // next "Move" preselects, and what the toast below compares against.
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    media_item.folder_id ?? null,
  );
  const previousFolderIdRef = useRef<string | null>(currentFolderId);

  // Toast feedback: the folder confirmations, a folder made from the `…` menu,
  // and a failed source open, all in the one pill.
  const { showToast, toastProps } = useToast();

  // --- Source preview ("Aperçu"), above the full text ---
  //
  // Declared before the focus refresh below, which is one of the two doors data
  // reaches it through.

  // The shared detail snapshot owns the prose; only the bounded wait budget
  // stays local. Extraction updates enrich the same mounted reader.
  const [previewStalled, setPreviewStalled] = useState(false);
  const previewPollCountRef = useRef(0);
  const previewItemId = media_item.media_item_id;
  const adoptPreview = useCallback(() => {
    previewPollCountRef.current = 0;
    setPreviewStalled(false);
  }, []);

  // One read on every return to the screen, and everything on it is used.
  //
  // The folder, because the picker is pushed from here and answers by writing to
  // the item rather than back to this screen. And the source preview, which used
  // to be dropped with the rest of the response: coming back is the gesture a
  // reader makes when the section was still writing itself, so it is also what
  // hands the wait a fresh budget after the poll has spent its own.
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;

      const refreshOnFocus = async () => {
        try {
          const response = await MediaService.getMediaStatus(
            media_item.media_item_id,
          );
          adoptPreview();
          const newFolderId = response.media_item.folder_id ?? null;
          setCurrentFolderId(newFolderId);

          // Show toast if folder changed
          if (newFolderId !== previousFolderIdRef.current) {
            if (newFolderId) {
              // Fetch folder name for the toast
              try {
                const folders = await OrganizationService.getUserFolders();
                const found = folders.find((c) => c.id === newFolderId);
                showToast(
                  found
                    ? t("media.movedToNamed", { name: found.name })
                    : t("media.movedToFolder"),
                );
              } catch {
                showToast(t("media.movedToFolder"));
              }
            } else {
              showToast(t("media.removedFromFolder"));
            }
            previousFolderIdRef.current = newFolderId;
          }
        } catch {
          // Silent fail: the main view already has data
        }
      };

      void refreshOnFocus();
    }, [isAuthenticated, media_item.media_item_id, showToast, adoptPreview]),
  );

  // The title as this screen shows it: whatever the library row holds, or the
  // label key it carries instead, read as "<label> — <save date>" in the reader's
  // language (task-400). The URL-then-"Untitled" chain that used to be here is
  // gone from every screen. A rename patches it in place: this screen holds no
  // list to reload, so the new name has to land on the hero directly.
  const [renamedTitle, setRenamedTitle] = useState<string | null>(null);
  const displayTitle = renamedTitle ?? resolveMediaTitle(media_item);

  // The `…` over the cover, and what it offers: the move, the rename and the
  // delete a long press already offers in Library, reachable from the item
  // itself. The move is a row of this menu since the folder button left the top
  // of the page with the header it sat in (task-411).
  const mediaActions = useMediaActions<MediaItemContract>({
    // Nothing left to show once the deletion is confirmed: the host decides
    // what replaces the page.
    onDeleted,
    onRenamed: (_mediaItemId, title) => setRenamedTitle(title),
    // "New folder" files the item without leaving the page, so no focus
    // refresh will bring the folder back: it is taken here, and recorded as the
    // one already announced so the next return does not toast it a second time.
    onMovedToFolder: (_mediaItemId, folder) => {
      setCurrentFolderId(folder.id);
      previousFolderIdRef.current = folder.id;
    },
    showToast,
  });

  // What the menu acts on, carrying the title currently on screen — a second
  // rename has to start from the name the first one stored — and the folder the
  // item is in now, which the picker preselects.
  const menuTarget = useMemo<MediaItemContract>(
    () => ({ ...media_item, title: displayTitle, folder_id: currentFolderId }),
    [media_item, displayTitle, currentFolderId],
  );

  // The copy of the pressed control the menu lifts above its blur. A button has
  // no row to redraw, so it redraws itself: the `…` stays sharp and the card
  // visibly hangs from it.
  const renderActionsPreview = useCallback(() => <MediaHeroMenuGlyph />, []);

  const [activeTab, setActiveTab] = useState<MediaDetailTabKey>("reader");
  // Artifacts are a per-scope append-only history: the media detail response
  // carries no artifact projection any more. This screen holds the history and
  // derives its tiles from it — the newest entry per type — so there is one
  // source of truth behind both the tiles and the list under them.
  const { readingLanguage } = useUserPreferences();
  const [generationRefusal, setGenerationRefusal] = useState<string | null>(
    null,
  );
  // The types whose POST is in flight. The history cannot know about them yet —
  // the entry only exists once the request answers, and that request reads every
  // source's transcript from S3 before it does. Without this, the tap stays
  // visually unanswered for the whole round-trip and reads as ignored.
  const [requestsInFlight, setRequestsInFlight] = useState<
    readonly ArtifactType[]
  >([]);

  const mountedRef = useRef(true);
  const artifactPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cachedDetail = useResourceSnapshot<MediaStatusResponse>(
    resourceKeys.media(media_item.media_item_id),
  );
  const cachedText = useResourceSnapshot<RawContentResponse>(
    resourceKeys.text(media_item.media_item_id),
  );
  const cachedOriginal = useResourceSnapshot<RawContentResponse>(
    resourceKeys.text(media_item.media_item_id, "original"),
  );
  const cachedArtifacts = useResourceSnapshot<ArtifactListResponse>(
    resourceKeys.artifacts("media", media_item.media_item_id),
  );
  const resolvedPreview = resolveSourcePreviewState(cachedDetail.data?.media_item ?? media_item);
  const preview: SourcePreviewState = resolvedPreview.status === "pending" && previewStalled
    ? { status: "unavailable" } : resolvedPreview;
  const displayedRawContent = useMemo<TranscriptContentState>(
    () =>
      cachedText.data
        ? resolveTranscriptContent(cachedText.data)
        : cachedText.error
          ? isResourceGone(cachedText.error)
            ? { status: "not_available" }
            : {
                status: "error",
                message: getFriendlyErrorMessage(cachedText.error, {
                  fallback: t("media.transcriptLoadFailed"),
                }),
              }
          : media_item.transcript?.status === "failed"
            ? { status: "not_available" }
            : { status: "loading" },
    [cachedText.data, cachedText.error, media_item.transcript?.status],
  );
  const artifactHistory = cachedArtifacts.data?.artifacts ?? EMPTY_ARTIFACTS;
  // What the last read of `/raw-content` said about translation. Kept beside the
  // text rather than folded into it: it answers two questions the text does not
  // — whether the body on screen is a translation (so whether the switch exists
  // at all) and which language to announce for it.
  const translation = cachedText.data?.translation ?? null;
  // The source text of a media served translated, once the reader has asked for
  // it. Held next to the translation rather than replacing it, so going back is a
  // re-render and not a second request — and so is every switch after that.
  const [original, setOriginal] = useState<OriginalTextState>(NO_ORIGINAL_TEXT);

  // The source text belongs to an item. `/media/[id]` keeps this instance across
  // a change of route parameter, and nothing else would clear a text that is no
  // longer the one being read — the same reason the preview is re-seeded above,
  // and guarded the same way so the effect only ever fires on a real change.
  const originalItemIdRef = useRef(media_item.media_item_id);
  useEffect(() => {
    if (originalItemIdRef.current === media_item.media_item_id) return;
    originalItemIdRef.current = media_item.media_item_id;
    setOriginal(NO_ORIGINAL_TEXT);
  }, [media_item.media_item_id]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (artifactPollRef.current) {
        clearInterval(artifactPollRef.current);
      }
    };
  }, []);

  // One request per scope serves both the history and the in-flight progress, so
  // there is never a request per artifact type. A failure is surfaced rather
  // than swallowed: the panel then offers a Retry instead of claiming the scope
  // has nothing generated.
  const refreshArtifacts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      await ArtifactService.listArtifacts(
        "media",
        media_item.media_item_id,
        undefined,
        readingLanguage,
      );
    } catch {
      /* The resource snapshot retains readable data and exposes the failure. */
    }
  }, [isAuthenticated, media_item.media_item_id, readingLanguage]);
  useFocusEffect(
    useCallback(() => {
      void refreshArtifacts();
    }, [refreshArtifacts]),
  );

  // The list itself says whether anything is in flight, so the poll starts and
  // stops from its own content rather than from a separate flag.
  const hasArtifactInFlight = useMemo(
    () =>
      artifactHistory.some(
        (artifact) =>
          artifact.status === "queued" || artifact.status === "generating",
      ),
    [artifactHistory],
  );

  // The newest entry per type, for the tiles. The list comes back newest-first,
  // so the first entry seen for a type wins.
  const artifactStates = useMemo(() => {
    const states = buildInitialArtifactStates();
    const seen = new Set<ArtifactType>();
    for (const artifact of artifactHistory) {
      const type = artifact.artifact_type;
      if (seen.has(type) || !(type in states)) continue;
      seen.add(type);
      states[type] = {
        status: artifact.status,
        error: artifact.error_code ?? undefined,
        // A media item's sources never change, so one entry closes the type for
        // good (task-322): asking again would answer this very artifact. Only a
        // failure leaves the door open — it holds nothing to read, and the
        // backend reruns it under the same id.
        generationAvailable: artifact.status === "failed",
      };
    }
    // A request still in flight wins over whatever the history says about that
    // type — a previous `ready` or `failed` entry included, since the button
    // that was just tapped belongs to the newest attempt. `queued` is the state
    // the entry itself comes back with, so the tile shows the spinner from the
    // tap frame and nothing changes visually when the POST answers. It also
    // takes the button out of the tile, which is what stops a second tap from
    // firing a second POST.
    for (const type of requestsInFlight) {
      states[type] = { status: "queued", generationAvailable: false };
    }
    return states;
  }, [artifactHistory, requestsInFlight]);

  const startArtifactPolling = useCallback(() => {
    if (artifactPollRef.current) return;

    artifactPollRef.current = setInterval(() => {
      void refreshArtifacts();
    }, ARTIFACT_POLL_INTERVAL_MS);
  }, [refreshArtifacts]);

  useEffect(() => {
    if (hasArtifactInFlight) {
      startArtifactPolling();
      return;
    }
    if (artifactPollRef.current) {
      clearInterval(artifactPollRef.current);
      artifactPollRef.current = null;
    }
  }, [hasArtifactInFlight, startArtifactPolling]);

  const handleGenerate = useCallback(
    async (artifactType: ArtifactType) => {
      if (!isAuthenticated || !mountedRef.current) return;
      setGenerationRefusal(null);
      // Before the POST, with nothing awaited in between: this is the update
      // that flips the tile, and it must land on the frame the finger lifts.
      setRequestsInFlight((current) =>
        current.includes(artifactType) ? current : [...current, artifactType],
      );

      try {
        await ArtifactService.generateArtifact(
          "media",
          media_item.media_item_id,
          artifactType,
        );
        if (!mountedRef.current) return;
      } catch (err) {
        if (!mountedRef.current) return;
        // A refusal is typed and carries its reason (a quota reached, a
        // translation the provider refused for good). Showing it beats the
        // silent retry loop that used to hide it behind a spinner. An unfinished
        // preparation is not among them any more: the backend accepts the
        // request and holds the entry until the text lands (task-360).
        setGenerationRefusal(describeArtifactRefusal(err, { scope: "media" }));
      } finally {
        // Both paths: the merged entry carries a real status from here, and a
        // refusal has to give the button back — keeping the type in the set
        // would lock the tile on a spinner nothing will ever clear.
        if (mountedRef.current) {
          setRequestsInFlight((current) =>
            current.filter((type) => type !== artifactType),
          );
        }
      }
    },
    [isAuthenticated, media_item.media_item_id],
  );

  // The way back to the thing itself. `null` for anything we cannot open, in
  // which case the title stays inert.
  const sourceLink = useMemo(
    () => resolveSourceLink(media_item.origin_url ?? "") ?? resolveSourceLink(media_item.original_url),
    [media_item.origin_url, media_item.original_url],
  );

  const handleOpenSource = useCallback(async () => {
    if (!sourceLink) return;
    try {
      await Linking.openURL(sourceLink.url);
    } catch {
      // No handler, or the OS refused: say so instead of letting the rejection
      // bubble out of the press handler.
      showToast(t("media.openFailed", { host: sourceLink.host }), "error");
    }
  }, [sourceLink, showToast]);

  const mediaReady =
    media_item.status === "ready_for_artifacts" ||
    processing_job.status === "ready_for_artifacts" ||
    processing_job.status === "completed";

  const transcriptStatus = media_item.transcript?.status;

  // Transport deduplication and invalidation are owned by the shared resource.
  const refreshRawContent = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      await MediaService.getRawContent(
        media_item.media_item_id,
        {},
        readingLanguage,
      );
    } catch {
      /* The snapshot distinguishes transient failures from unavailable content. */
    }
  }, [isAuthenticated, media_item.media_item_id, readingLanguage]);

  // The wait for a translation still being produced: a bounded, re-armable poll
  // whose budget outlives a remount (task-415). Its end is `translation_stalled`
  // below, never `ready`.
  const translationRefresh = useTranslationRefresh({
    mediaItemId: media_item.media_item_id,
    isPending: displayedRawContent.status === "translation_pending",
    refetch: refreshRawContent,
    budgets: translationBudgets,
  });

  const transcriptContent = useMemo<TranscriptContentState>(
    () =>
      displayedRawContent.status === "translation_pending" &&
      translationRefresh.isStalled
        ? {
            status: "translation_stalled",
            content: displayedRawContent.content,
          }
        : displayedRawContent,
    [displayedRawContent, translationRefresh.isStalled],
  );

  // --- The translation, and the way back to what was actually said (task-419) ---
  //
  // Only `ready` can carry the switch. Every other state is either the original
  // already — a translation still on its way, stalled, or failed for good, each
  // under a line that says so — or no text at all: there is nothing to switch
  // between, and a disabled control would only raise the question.
  const isTranslationOnScreen =
    transcriptContent.status === "ready" && translation?.is_translated === true;

  // The source language as the server read it, falling back to what the item says
  // about its own transcript. The two can disagree: `detected_language` comes from
  // a detection run over the text at read time, `transcript.language` from
  // whichever provider produced it.
  const sourceLanguage =
    translation?.translated_from ??
    translation?.detected_language ??
    media_item.transcript?.language ??
    null;
  const targetLanguage = translation?.target_language ?? null;

  // The text on screen, which is the translation unless the reader has asked for
  // the source and it has arrived.
  const showingOriginal =
    isTranslationOnScreen && original.shown && Boolean(cachedOriginal.data);
  const readerContent = useMemo<TranscriptContentState>(
    () =>
      transcriptContent.status === "ready" &&
      original.shown &&
      cachedOriginal.data
        ? { status: "ready", content: cachedOriginal.data.content }
        : transcriptContent,
    [transcriptContent, original.shown, cachedOriginal.data],
  );

  /**
   * Switch between the translation and the source text.
   *
   * The source text is read once and kept, so only the first tap goes to the
   * network; from there both directions are a re-render. A read that fails leaves
   * the translation where it is and says so through the screen's toast — losing
   * the text one was reading would be a worse answer than not getting the other
   * one.
   */
  const handleToggleOriginal = useCallback(() => {
    if (original.shown) {
      setOriginal((current) => ({ ...current, shown: false }));
      return;
    }
    if (cachedOriginal.data) {
      setOriginal({ shown: true, loading: false });
      void MediaService.getRawContent(media_item.media_item_id, {
        variant: "original",
      }).catch(() => {});
      return;
    }
    if (original.loading || !isAuthenticated) return;
    setOriginal((current) => ({ ...current, loading: true }));

    void (async () => {
      try {
        const response = await MediaService.getRawContent(
          media_item.media_item_id,
          { variant: "original" },
        );
        if (!mountedRef.current) return;
        const content = (response.content ?? "").trim();
        if (!content) {
          setOriginal((current) => ({ ...current, loading: false }));
          showToast(t("transcript.originalLoadFailed"), "error");
          return;
        }
        setOriginal({ shown: true, loading: false });
      } catch (err) {
        if (!mountedRef.current) return;
        setOriginal((current) => ({ ...current, loading: false }));
        showToast(
          getFriendlyErrorMessage(err, {
            fallback: t("transcript.originalLoadFailed"),
          }),
          "error",
        );
      }
    })();
  }, [
    original.shown,
    cachedOriginal.data,
    original.loading,
    isAuthenticated,
    media_item.media_item_id,
    showToast,
  ]);

  // The switch itself, or nothing. It names the language it switches *to*, so
  // both halves have to be nameable: without a language to put in the label there
  // is no honest way to say where a tap leads.
  const translationToggle = useMemo<TranscriptTranslationToggle | null>(() => {
    if (!isTranslationOnScreen) return null;
    const next = showingOriginal ? targetLanguage : sourceLanguage;
    const languageCode = languageTag(next);
    const languageName = describeLanguage(next);
    if (!languageCode || !languageName) return null;
    return {
      showingOriginal,
      languageCode,
      languageName,
      busy: original.loading,
      onToggle: handleToggleOriginal,
    };
  }, [
    isTranslationOnScreen,
    showingOriginal,
    sourceLanguage,
    targetLanguage,
    original.loading,
    handleToggleOriginal,
  ]);

  const fetchRawContent = refreshRawContent;
  useFocusEffect(
    useCallback(() => {
      if (mediaReady && transcriptStatus !== "failed") void refreshRawContent();
    }, [mediaReady, transcriptStatus, refreshRawContent]),
  );

  /**
   * The poll behind the waiting line — armed by that line, and by nothing else.
   *
   * An interval owned by the effect, the shape the artifact poll above already
   * uses, rather than a chain of timeouts that reschedules itself. A chain has to
   * be re-armed by each of its own ticks, so one tick that cannot read — signed
   * out for a moment while a token refreshes — ends it for good and leaves a
   * spinner with nothing running under it. Here the effect decides: it does not
   * arm while unauthenticated, and it arms again the moment that changes.
   *
   * It stops by answering. The ceiling turns the last read into a terminal state,
   * and a terminal state is exactly what disarms this effect.
   */
  useEffect(() => {
    if (!isAuthenticated || !mediaReady || preview.status !== "pending") return undefined;

    // Torn down by the cleanup: an item swapped underneath us, or the screen
    // gone. A read that comes back after that belongs to nobody.
    let armed = true;

    // Asked after the read comes back, never before it: a return to the screen
    // may have refilled the budget while this attempt was in flight, and closing
    // the section on a budget that is no longer spent would undo that refresh.
    const budgetSpent = () =>
      previewPollCountRef.current >= PREVIEW_POLL_MAX_ATTEMPTS;

    const interval = setInterval(() => {
      void (async () => {
        // Every attempt is spent, including one the network refuses: a free retry
        // is how a flapping connection turns a bounded wait into an endless one.
        previewPollCountRef.current += 1;

        try {
          const response = await MediaService.getMediaStatus(previewItemId);
          if (!armed) return;
          const next = resolveSourcePreviewState(response.media_item);
          if (next.status === "pending" && budgetSpent()) setPreviewStalled(true);
        } catch {
          // A failed read is not news the reader needs — except on the last
          // attempt, where staying quiet would leave the spinner standing in
          // front of a poll that has stopped.
          if (armed && budgetSpent()) {
            setPreviewStalled(true);
          }
        }
      })();
    }, PREVIEW_POLL_DELAY_MS);

    return () => {
      armed = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, mediaReady, preview.status, previewItemId]);

  // --- The cover ---
  //
  // A failed URL can recover after a new snapshot, focus or foreground event.
  const coverUrl = media_item.media_image?.trim() ?? "";
  const coverImage = useRecoverableImage(
    coverUrl,
    media_item.media_item_id,
    media_item,
  );
  const cover = useMemo<MediaCover | null>(
    () =>
      coverImage.showImage
        ? {
            uri: coverUrl,
            cacheKey: `${media_item.media_item_id}:${media_item.updated_at}`,
            recyclingKey: `${media_item.media_item_id}:${coverImage.attempt}`,
          }
        : null,
    [
      coverUrl,
      coverImage.showImage,
      coverImage.attempt,
      media_item.media_item_id,
      media_item.updated_at,
    ],
  );
  const handleCoverError = coverImage.onError;

  // Over a picture, the eyebrow names who published it; the picture says the
  // rest. Without one, the glyph standing in for it is decorative, so the type
  // is written out in words (task-410 §2.3).
  const creator = media_item.creator_name?.trim() ?? "";
  const typeLabel = getMediaTypeLabel(media_item.media_type);
  const eyebrow = cover
    ? creator || typeLabel
    : [typeLabel, creator].filter(Boolean).join(" · ");
  const mediaTypeIcon = getMediaTypeIcon(media_item.media_type);

  // --- Layout under the status bar ---
  //
  // The route draws the band under the status bar and the collapsed bar over
  // it. The Digest carousel starts the page under its own band, below the
  // status bar, so there the page starts at 0.
  const insets = useSafeAreaInsets();
  const topInset = underStatusBar ? insets.top : 0;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const bandLayout = getCoverBandLayout({
    windowWidth,
    windowHeight,
    topInset,
    hasCover: cover !== null,
  });
  const barHeight = topInset + MEDIA_READER_BAR_HEIGHT;

  // --- Scroll: the collapsed bar, the progress ---
  //
  // Every threshold is a scroll offset. The bar — title and folded segment
  // together — fades in while the page's own Reader / AI segment slides under
  // it, and not before: until then the page's title and segment are still on
  // screen, and the bar would repeat them. So there is always exactly one title
  // and one segment in view.
  const [tabsFrame, setTabsFrame] = useState<{
    y: number;
    height: number;
  } | null>(null);
  const handleTabsLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setTabsFrame((current) =>
      current?.y === y && current.height === height ? current : { y, height },
    );
  }, []);
  // Before the segment is measured the bar stays hidden: `null` thresholds.
  const barFadeFrom = tabsFrame
    ? Math.max(0, tabsFrame.y + Spacing.md - barHeight)
    : null;
  const barShownAt =
    tabsFrame && barFadeFrom !== null
      ? Math.max(
          barFadeFrom + 1,
          tabsFrame.y + tabsFrame.height - Spacing.md - barHeight,
        )
      : null;

  // Where the cover band stops sitting under the status bar, which decides the
  // colour of its icons now that the bar no longer arrives with that moment.
  const bandLeavesStatusBarAt = bandLayout.height - topInset;

  // The reading progress runs over the whole page, so both heights are needed.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const maxScroll = Math.max(1, contentHeight - viewportHeight);

  // Driven natively: the fades and the progress never wait on the JS thread.
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const barOpacity = useMemo(
    () =>
      barFadeFrom === null || barShownAt === null
        ? 0
        : scrollY.interpolate({
            inputRange: [barFadeFrom, barShownAt],
            outputRange: [0, 1],
            extrapolate: "clamp",
          }),
    [scrollY, barFadeFrom, barShownAt],
  );
  const progress = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, maxScroll],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
    [scrollY, maxScroll],
  );

  // What the JS side has to know about the scroll, and nothing finer: whether
  // the bar takes touches (and is announced), which way the status bar goes,
  // and the progress in announced steps. Each is set only as it changes, so a
  // scroll re-renders the page a handful of times, not per frame.
  const [barVisible, setBarVisible] = useState(false);
  const [bandUnderStatusBar, setBandUnderStatusBar] = useState(true);
  const [progressPercent, setProgressPercent] = useState(0);

  // Rebuilt when a threshold moves — a picture that failed, a text that landed,
  // a rename that rewrapped the title — which re-attaches it to the scroll view.
  // The offset itself stays on the native side; the listener only ever sees it
  // to decide the three values above.
  const handleScroll = useMemo(() => {
    const barMidpoint =
      barFadeFrom === null || barShownAt === null
        ? null
        : (barFadeFrom + barShownAt) / 2;
    return Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      {
        useNativeDriver: true,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const offset = event.nativeEvent.contentOffset.y;
          setBarVisible(barMidpoint !== null && offset >= barMidpoint);
          setBandUnderStatusBar(offset < bandLeavesStatusBarAt);
          const ratio = Math.min(Math.max(offset / maxScroll, 0), 1);
          setProgressPercent(
            Math.round((ratio * 100) / PROGRESS_ANNOUNCE_STEP) *
              PROGRESS_ANNOUNCE_STEP,
          );
        },
      },
    );
  }, [scrollY, barFadeFrom, barShownAt, bandLeavesStatusBarAt, maxScroll]);

  const scrollRef = useRef<ScrollView>(null);
  const readerScrollOffset = useRef(0);
  const readerContentTop = useRef(0);
  const transcriptTop = useRef(0);
  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      readerScrollOffset.current = value;
    });
    return () => scrollY.removeListener(listener);
  }, [scrollY]);

  // A tab picked from the collapsed bar — the only segment on screen once it is
  // shown, the page's own having slid under it — opens at its own top, right
  // under the bar, rather than wherever a deep offset lands in content of another length. From
  // the page's own segment nothing moves.
  const handleTabChange = useCallback(
    (key: MediaDetailTabKey) => {
      setActiveTab(key);
      if (barVisible && barShownAt !== null) {
        scrollRef.current?.scrollTo({ y: barShownAt, animated: false });
      }
    },
    [barVisible, barShownAt],
  );

  // Light over the picture, dark once the picture — or a tonal band — has
  // scrolled out from under it.
  // Only while this screen is the one in front: the entry stays on the status
  // bar's stack for as long as it is mounted, and a screen pushed over this one
  // would otherwise inherit light icons on its light background. Only under the
  // status bar, too: the carousel's band keeps the default dark icons.
  // In the dark theme the page is dark wherever the cover is not, so the
  // "scrolled past" branch keeps the light glyphs rather than flipping back.
  const isFocused = useIsFocused();
  const statusBarStyle =
    (cover && bandUnderStatusBar) || mode === "dark" ? "light" : "dark";

  const transcript = (
    <>
      <ResourceRefreshNotice
        error={
          cachedDetail.error ??
          cachedText.error ??
          (original.shown ? cachedOriginal.error : null)
        }
        onRetry={() => {
          void MediaService.getMediaStatus(media_item.media_item_id).catch(
            () => {},
          );
          void refreshRawContent();
          if (original.shown)
            void MediaService.getRawContent(media_item.media_item_id, {
              variant: "original",
            }).catch(() => {});
        }}
      />
      <TranscriptReader
        transcript={media_item.transcript}
        processingStatus={processing_job.status}
        content={readerContent}
        onRetry={fetchRawContent}
        onCheckTranslation={translationRefresh.rearm}
        translationToggle={translationToggle}
      />
    </>
  );

  return (
    <View style={styles.container}>
      {underStatusBar && isFocused ? (
        <StatusBar style={statusBarStyle} animated />
      ) : null}

      {/* Before the scroll view in the tree, so a screen reader meets it first
          when it is shown; drawn over it by its own `zIndex`. */}
      <MediaReaderBar
        topInset={topInset}
        opacity={barOpacity}
        visible={barVisible}
        onBack={onBack}
        title={displayTitle}
        sourceHost={sourceLink?.host ?? null}
        onOpenSource={handleOpenSource}
        cover={cover}
        onCoverError={handleCoverError}
        mediaTypeIcon={mediaTypeIcon}
        tabs={MEDIA_DETAIL_TABS}
        activeKey={activeTab}
        onTabChange={handleTabChange}
        tabsAccessibilityLabel={t("media.sectionsA11y")}
        progress={activeTab === "reader" ? progress : null}
        progressPercent={progressPercent}
      />

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onLayout={(event: LayoutChangeEvent) =>
          setViewportHeight(event.nativeEvent.layout.height)
        }
        onContentSizeChange={(_width: number, height: number) =>
          setContentHeight(height)
        }
        // One axis per drag, which is what makes this page swipeable when the
        // Digest nests it in its horizontal carousel: a drag that starts sideways
        // is not half-absorbed here as a diagonal scroll before the carousel
        // takes it.
        // Never a constraint on the route, where this is the only scrollable and
        // there is nothing horizontal to lock out.
        directionalLockEnabled
      >
        <MediaDetailHero
          layout={bandLayout}
          topInset={topInset}
          cover={cover}
          onCoverError={handleCoverError}
          mediaTypeIcon={mediaTypeIcon}
          eyebrow={eyebrow}
          title={displayTitle}
          sourceHost={sourceLink?.host ?? null}
          onOpenSource={handleOpenSource}
          onBack={onBack}
          onActionsPress={(anchor) => mediaActions.open(menuTarget, anchor)}
        />

        {/* Intra-screen tabs. They scroll away with the page; the collapsed bar
            carries their folded copy from there. */}
        <View style={styles.tabsBar} onLayout={handleTabsLayout}>
          <ScreenTabs
            tabs={MEDIA_DETAIL_TABS}
            activeKey={activeTab}
            onChange={handleTabChange}
            accessibilityLabel={t("media.sectionsA11y")}
          />
        </View>

        {/* Tab content. Artifact polling and the transcript fetch both live in
            this component, so neither stops when its tab is hidden. Each branch
            carries the page gutter itself — `ArtifactsPanel` owns the one it
            shares with the folder screen. */}
        {activeTab === "reader" ? (
          <View
            style={styles.readerContent}
            onLayout={(event) => {
              readerContentTop.current = event.nativeEvent.layout.y;
            }}
          >
            {/* What this source is about, before the source itself. */}
            {processingNotice ? <View style={{ gap: Spacing.md, paddingVertical: Spacing.md }}>
              {!processingNotice.failed ? <ActivityIndicator color={Colors.primary} /> : null}
              <Text style={{ color: Colors.textMain }}>{processingNotice.message}</Text>
              {processingNotice.failed ? <SourceSupportRequestCard mediaItemId={media_item.media_item_id}
                errorCode={processing_job.error_code} /> : null}
              <Pressable onPress={processingNotice.retry} accessibilityRole="button">
                <Text style={{ color: Colors.textMain }}>{t("media.refresh")}</Text>
              </Pressable>
            </View> : null}
            <SourcePreview state={mediaReady ? preview : { status: processingNotice?.failed ? "unavailable" : "pending" }} />
            <View
              onLayout={(event) => {
                transcriptTop.current = event.nativeEvent.layout.y;
              }}
            >
              {transcript}
            </View>
          </View>
        ) : (
          // No "N sources" line: a media item is a single source.
          <ArtifactsPanel
            tileStates={artifactStates}
            onGenerate={(artifactType) => void handleGenerate(artifactType)}
            refusal={generationRefusal}
            refusalTestID="media-ai-refusal"
            history={artifactHistory}
            historyLoading={!cachedArtifacts.data && !cachedArtifacts.error}
            historyError={
              cachedArtifacts.error
                ? getFriendlyErrorMessage(cachedArtifacts.error, {
                    fallback: t("folder.artifactsLoadFailed"),
                  })
                : null
            }
            onRetryHistory={() => void refreshArtifacts()}
            historyEmptyTestID="media-ai-history-empty"
            onOpenArtifact={(artifact) =>
              router.push(`/artifacts/${artifact.artifact_id}`)
            }
            showSourceCount={false}
          />
        )}
      </Animated.ScrollView>

      {/* The chat composer, on the Reader tab only (owner decision of task-434):
          anchored under the page, so the transcript scrolls above it. On the
          route the safe area is below it; in the Digest the tab bar is. */}
      {activeTab === "reader" ? (
        <ChatDock
          key={media_item.media_item_id}
          scope="media"
          scopeId={media_item.media_item_id}
          title={displayTitle}
          imageUrl={coverUrl}
          mediaTypeIcon={mediaTypeIcon}
          sourceReady={mediaReady}
          sourceContent={<View style={styles.chatSource}>{transcript}</View>}
          getSourceOffset={() =>
            Math.max(
              0,
              readerScrollOffset.current -
                readerContentTop.current -
                transcriptTop.current,
            )
          }
          bottomInset={underStatusBar ? insets.bottom : 0}
        />
      ) : null}

      {/* Toast feedback, over the page and under where the collapsed bar ends,
          so it covers neither the controls over the cover nor the bar. */}
      <Toast {...toastProps} top={barHeight + Spacing.sm} />

      {/* Screen level, outside the scroll view: all three are modals belonging
          to the screen's state, and the menu's backdrop covers the whole page. */}
      <AnchoredContextMenu
        {...mediaActions.menuProps}
        renderPreview={renderActionsPreview}
      />
      <RenameDialog {...mediaActions.renameProps} />
      <RenameDialog {...mediaActions.newFolderProps} />
    </View>
  );
}

// --- Styles ---

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    scrollView: {
      flex: 1,
    },

    // Intra-screen tabs under the cover.
    tabsBar: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    // The Reader tab only. The AI tab is `ArtifactsPanel`, which brings the same
    // gutter and the same bottom inset with it.
    chatSource: {
      paddingHorizontal: Spacing.lg,
    },
    readerContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxl,
    },
  });
