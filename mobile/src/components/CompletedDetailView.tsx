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
 *     source link · date · duration · language · length
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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  StyleSheet,
  Text,
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
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useAuth } from "../contexts/AuthContext";
import {
  MediaService,
  type RawContentResponse,
  type TranslationMetadata,
} from "../services/mediaService";
import { ArtifactService } from "../services/artifactService";
import type { ArtifactSummary } from "../types/artifacts";
import { OrganizationService } from "../services/organizationService";
import { getFriendlyErrorMessage } from "../lib/getFriendlyErrorMessage";
import { formatDuration } from "../lib/formatDuration";
import type { ArtifactTileState } from "./ArtifactTile";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { ScreenTabs, type ScreenTab } from "./ScreenTabs";
import { AnchoredContextMenu } from "./AnchoredContextMenu";
import {
  MediaDetailHero,
  MediaHeroMenuGlyph,
  getCoverBandLayout,
  type MediaCover,
} from "./MediaDetailHero";
import { MediaReaderBar, MEDIA_READER_BAR_HEIGHT } from "./MediaReaderBar";
import { RenameDialog } from "./RenameDialog";
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
import {
  Typography,
  Spacing,
  BorderRadius,
  type Theme,
} from "../constants/theme";
import {
  useTheme,
  useThemeColors,
  useThemedStyles,
} from "../contexts/ThemeContext";
import { LOCALE_ENDONYMS, formatDate, t, tCount } from "../i18n";
import { isSupportedLocale } from "../i18n/locales";
import type {
  MediaStatusResponse,
  MediaItemContract,
  ArtifactType,
} from "../types/media";
import { getMediaTypeIcon, getMediaTypeLabel } from "../lib/mediaTypeDisplay";
import { resolveMediaTitle } from "../lib/mediaTitle";
import { describeArtifactRefusal } from "../lib/artifactRefusal";
import { mergeArtifactIntoHistory } from "../lib/artifactHistory";

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
 * Some legacy items still carry the unscoped "summary" type from before the
 * short/detailed split. Surface them under the "Summary" tile instead of
 * dropping them on the floor.
 */
function buildInitialArtifactStates(): Record<ArtifactType, ArtifactTileState> {
  return {
    summary: { status: "idle", generationAvailable: true },
    summary_short: { status: "idle", generationAvailable: true },
    summary_detailed: { status: "idle", generationAvailable: true },
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
 * `content` outlives `shown`: the text is read once and kept, so the switch back
 * and every switch after it costs no network. `loading` is only ever true for the
 * one read that fetches it.
 */
type OriginalTextState = {
  /** The source text once read, or `null` while it has never been asked for. */
  content: string | null;
  /** Whether the source text is the body on screen. */
  shown: boolean;
  /** A read of `?variant=original` is in flight. */
  loading: boolean;
};

const NO_ORIGINAL_TEXT: OriginalTextState = {
  content: null,
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
 * The language of the text, as the metadata line names it.
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
 * the metadata line free of a link that goes nowhere.
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
  /**
   * Where the budget of the translation poll is kept, for a host that mounts
   * and unmounts this page while its screen stays open — the Digest carousel,
   * whose pages come and go with the swipes. Without it the budget lives with
   * the mount, which is right for the route: there, a mount is the opening of
   * the screen.
   */
  translationBudgets?: TranslationBudgets;
}

export function CompletedDetailView({
  mediaData,
  onBack,
  onDeleted,
  underStatusBar = true,
  translationBudgets,
}: CompletedDetailViewProps): React.JSX.Element {
  // `mode` for the status bar glyphs below, which are a prop rather than a
  // style and so cannot come from the sheet.
  const { mode } = useTheme();
  const Colors = useThemeColors();
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

  // Toast feedback state. The tone only swaps the glyph and its colour: one
  // surface carries both the folder confirmations and a failed source open,
  // instead of a second banner for errors.
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  // Not a ref: an Animated.Value is created once and read during render, which
  // is exactly `useMemo` and not `useRef().current`.
  const toastOpacity = useMemo(() => new Animated.Value(0), []);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      setToast({ message, tone });
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 2500);
    },
    [toastOpacity],
  );

  // --- Source preview ("Aperçu"), above the full text ---
  //
  // Declared before the focus refresh below, which is one of the two doors data
  // reaches it through.

  // Seeded from the item this screen was opened with, then owned here: the
  // detail poll stops the moment processing completes, and the preview is
  // generated *after* that — so nothing else would ever bring it in.
  const [preview, setPreview] = useState<SourcePreviewState>(() =>
    resolveSourcePreviewState(media_item),
  );

  // How many reads the current wait has already cost. A budget, not a lifetime
  // counter: the ceiling is what turns waiting into an answer, so every path that
  // brings in a fresh read hands back a full one.
  const previewPollCountRef = useRef(0);

  /**
   * Adopt what a fresh read of the item says about its preview.
   *
   * The one door for server data — the focus refresh, and the item the props
   * carry — and it refills the budget on the way in. Re-entering the wait on a
   * spent budget would end it again on the very next tick, which would make
   * coming back to the screen a no-op.
   */
  const adoptPreview = useCallback(
    (item: Pick<MediaItemContract, "review_blurb" | "review_blurb_status">) => {
      previewPollCountRef.current = 0;
      setPreview(resolveSourcePreviewState(item));
    },
    [],
  );

  // The preview belongs to an item, not to a mount. `/media/[id]` keeps this
  // instance across a change of route parameter; without this the second item
  // would inherit the first one's preview *and* its spent budget.
  const previewItemId = media_item.media_item_id;
  const previewItemIdRef = useRef(previewItemId);
  useEffect(() => {
    if (previewItemIdRef.current === previewItemId) return;
    previewItemIdRef.current = previewItemId;
    adoptPreview(media_item);
  }, [previewItemId, media_item, adoptPreview]);

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
          adoptPreview(response.media_item);
          const newFolderId = response.media_item.folder_id ?? null;
          setCurrentFolderId(newFolderId);

          // Show toast if folder changed
          if (newFolderId !== previousFolderIdRef.current) {
            if (newFolderId) {
              // Fetch folder name for the toast
              try {
                const folders =
                  await OrganizationService.getUserFolders();
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

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

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
  const [artifactHistory, setArtifactHistory] = useState<ArtifactSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [generationRefusal, setGenerationRefusal] = useState<string | null>(null);
  // The types whose POST is in flight. The history cannot know about them yet —
  // the entry only exists once the request answers, and that request reads every
  // source's transcript from S3 before it does. Without this, the tap stays
  // visually unanswered for the whole round-trip and reads as ignored.
  const [requestsInFlight, setRequestsInFlight] = useState<readonly ArtifactType[]>(
    [],
  );

  const mountedRef = useRef(true);
  const artifactPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rawContent, setRawContent] = useState<TranscriptContentState>({
    status: "idle",
  });
  // What the last read of `/raw-content` said about translation. Kept beside the
  // text rather than folded into it: it answers two questions the text does not
  // — whether the body on screen is a translation (so whether the switch exists
  // at all) and which language to announce for it.
  const [translation, setTranslation] = useState<TranslationMetadata | null>(
    null,
  );
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
      const response = await ArtifactService.listArtifacts(
        "media",
        media_item.media_item_id,
      );
      if (!mountedRef.current) return;
      setArtifactHistory(response.artifacts);
      setHistoryError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setHistoryError(
        getFriendlyErrorMessage(err, {
          fallback: t("folder.artifactsLoadFailed"),
        }),
      );
    }
  }, [isAuthenticated, media_item.media_item_id]);

  // `historyLoading` starts true and is only ever cleared: the spinner belongs
  // to the first fetch of a given scope, and `refreshArtifacts` is stable for as
  // long as the scope is.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshArtifacts();
      if (!cancelled) setHistoryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshArtifacts]);

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
        const created = await ArtifactService.generateArtifact(
          "media",
          media_item.media_item_id,
          artifactType,
        );
        if (!mountedRef.current) return;
        // The POST answers the entry itself, so it goes straight into the
        // history: no list call, hence no eventually-consistent GSI read that
        // could come back without it and hide a running generation. It also
        // arms the poll immediately, from the returned status.
        setArtifactHistory((current) =>
          mergeArtifactIntoHistory(current, created),
        );
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
  // which case the metadata line carries no link at all.
  const sourceLink = useMemo(
    () => resolveSourceLink(media_item.original_url),
    [media_item.original_url],
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

  const formattedDate = (() => {
    try {
      // The active UI locale, never a hardcoded language tag.
      return formatDate(new Date(media_item.created_at), {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  })();

  const durationLabel = media_item.transcript?.duration_seconds
    ? formatDuration(media_item.transcript.duration_seconds)
    : null;

  const mediaReady =
    media_item.status === "ready_for_artifacts" ||
    processing_job.status === "ready_for_artifacts" ||
    processing_job.status === "completed";

  const transcriptStatus = media_item.transcript?.status;

  // Every read of the text is numbered, and an answer older than the last one
  // applied is dropped. The poll does not wait for a read before sending the
  // next, so on a slow network two can be in flight — and a `pending` coming back
  // after a `ready` must not put the translation back on its way.
  const rawReadCountRef = useRef(0);
  const rawReadAppliedRef = useRef(0);
  const adoptRawRead = useCallback(
    (
      read: number,
      next: TranscriptContentState,
      meta: TranslationMetadata | null,
    ) => {
      if (!mountedRef.current || read < rawReadAppliedRef.current) return;
      rawReadAppliedRef.current = read;
      setRawContent(next);
      setTranslation(meta);
    },
    [],
  );

  // The read behind the translation poll: silent, so a tick leaves the text on
  // screen where it is, and a failure changes nothing — the line above the text
  // still says the translation is on its way, which is true.
  const refreshRawContent = useCallback(async () => {
    if (!isAuthenticated) return;
    const read = ++rawReadCountRef.current;
    try {
      const response = await MediaService.getRawContent(
        media_item.media_item_id,
      );
      adoptRawRead(
        read,
        resolveTranscriptContent(response),
        response.translation ?? null,
      );
    } catch {
      // The next tick retries.
    }
  }, [isAuthenticated, media_item.media_item_id, adoptRawRead]);

  // The wait for a translation still being produced: a bounded, re-armable poll
  // whose budget outlives a remount (task-415). Its end is `translation_stalled`
  // below, never `ready`.
  const translationRefresh = useTranslationRefresh({
    mediaItemId: media_item.media_item_id,
    isPending: rawContent.status === "translation_pending",
    refetch: refreshRawContent,
    budgets: translationBudgets,
  });

  const transcriptContent = useMemo<TranscriptContentState>(
    () =>
      rawContent.status === "translation_pending" && translationRefresh.isStalled
        ? { status: "translation_stalled", content: rawContent.content }
        : rawContent,
    [rawContent, translationRefresh.isStalled],
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
  const showingOriginal = isTranslationOnScreen && original.shown;
  const readerContent = useMemo<TranscriptContentState>(
    () =>
      transcriptContent.status === "ready" &&
      original.shown &&
      original.content !== null
        ? { status: "ready", content: original.content }
        : transcriptContent,
    [transcriptContent, original.shown, original.content],
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
    if (original.content !== null) {
      setOriginal((current) => ({ ...current, shown: true }));
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
        setOriginal({ content, shown: true, loading: false });
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
    original.content,
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

  // Everything known about the source, on the one line under the title. The
  // duration used to be printed twice — in the hero and again above the text.
  //
  // The language named there is the one the text on screen is written in, which
  // is the reading language while a translation is what the section shows, and
  // the source language the rest of the time — the switch above moves it. It used
  // to always name the source language, even under a translated body.
  const details = [
    formattedDate,
    durationLabel,
    describeLanguage(
      isTranslationOnScreen && !showingOriginal
        ? (targetLanguage ?? sourceLanguage)
        : sourceLanguage,
    ),
    media_item.transcript?.segments_count
      ? tCount("transcript.paragraphCount", media_item.transcript.segments_count)
      : null,
  ].filter((detail): detail is string => !!detail);

  // The first load, and the Retry of its error state: the one read that shows
  // the loading line.
  const fetchRawContent = useCallback(async () => {
    if (!isAuthenticated) return;
    setRawContent({ status: "loading" });
    const read = ++rawReadCountRef.current;

    try {
      const response = await MediaService.getRawContent(
        media_item.media_item_id,
      );
      adoptRawRead(
        read,
        resolveTranscriptContent(response),
        response.translation ?? null,
      );
    } catch (err) {
      const httpStatus = (err as { status?: number } | undefined)?.status;
      adoptRawRead(
        read,
        httpStatus === 404
          ? { status: "not_available" }
          : {
              status: "error",
              message: getFriendlyErrorMessage(err, {
                fallback: t("media.transcriptLoadFailed"),
              }),
            },
        null,
      );
    }
  }, [isAuthenticated, media_item.media_item_id, adoptRawRead]);

  // Whether the transcript fetch has already been kicked off for the media as it
  // currently stands. A flag rather than a read of `rawContent`: deciding from
  // the state would put the state in the dependencies and re-run the effect on
  // every transition it causes.
  const rawFetchStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!mediaReady) {
        // Reset whenever processing rewinds (e.g. user retries an item).
        rawFetchStartedRef.current = false;
        if (!cancelled) setRawContent({ status: "idle" });
        return;
      }
      if (transcriptStatus === "failed") {
        if (!cancelled) setRawContent({ status: "not_available" });
        return;
      }
      if (rawFetchStartedRef.current) return;
      rawFetchStartedRef.current = true;
      if (!cancelled) setRawContent({ status: "loading" });
      await fetchRawContent();
    })();
    return () => {
      cancelled = true;
    };
  }, [mediaReady, transcriptStatus, fetchRawContent]);

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
    if (!isAuthenticated || preview.status !== "pending") return undefined;

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
          setPreview(
            next.status === "pending" && budgetSpent()
              ? { status: "unavailable" }
              : next,
          );
        } catch {
          // A failed read is not news the reader needs — except on the last
          // attempt, where staying quiet would leave the spinner standing in
          // front of a poll that has stopped.
          if (armed && budgetSpent()) {
            setPreview({ status: "unavailable" });
          }
        }
      })();
    }, PREVIEW_POLL_DELAY_MS);

    return () => {
      armed = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, preview.status, previewItemId]);

  // --- The cover ---
  //
  // The one image of the detail contract. A failure is kept per item rather than
  // as a flag: the route can hand this instance another media, and a picture
  // that would not load for the previous one must not hide the next one's.
  const [failedCoverId, setFailedCoverId] = useState<string | null>(null);
  const coverUrl = media_item.media_image?.trim() ?? "";
  const cover = useMemo<MediaCover | null>(
    () =>
      coverUrl && failedCoverId !== media_item.media_item_id
        ? {
            uri: coverUrl,
            cacheKey: `${media_item.media_item_id}:${media_item.updated_at}`,
            recyclingKey: media_item.media_item_id,
          }
        : null,
    [coverUrl, failedCoverId, media_item.media_item_id, media_item.updated_at],
  );
  const handleCoverError = useCallback(
    () => setFailedCoverId(media_item.media_item_id),
    [media_item.media_item_id],
  );

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
          details={details}
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
          <View style={styles.readerContent}>
            {/* What this source is about, before the source itself. */}
            <SourcePreview state={preview} />
            <TranscriptReader
              transcript={media_item.transcript}
              processingStatus={processing_job.status}
              content={readerContent}
              onRetry={fetchRawContent}
              onCheckTranslation={translationRefresh.rearm}
              translationToggle={translationToggle}
            />
          </View>
        ) : (
          // No "N sources" line: a media item is a single source.
          <ArtifactsPanel
            tileStates={artifactStates}
            onGenerate={(artifactType) => void handleGenerate(artifactType)}
            refusal={generationRefusal}
            refusalTestID="media-ai-refusal"
            history={artifactHistory}
            historyLoading={historyLoading}
            historyError={historyError}
            onRetryHistory={() => void refreshArtifacts()}
            historyEmptyTestID="media-ai-history-empty"
            onOpenArtifact={(artifact) =>
              router.push(`/artifacts/${artifact.artifact_id}`)
            }
            showSourceCount={false}
          />
        )}
      </Animated.ScrollView>

      {/* Toast feedback, over the page and under where the collapsed bar ends,
          so it covers neither the controls over the cover nor the bar. */}
      {toast && (
        <View
          style={[
            styles.toastLayer,
            { top: barHeight + Spacing.sm },
          ]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
            <Ionicons
              name={toast.tone === "error" ? "alert-circle" : "checkmark-circle"}
              size={16}
              color={toast.tone === "error" ? Colors.error : Colors.primary}
            />
            <Text style={styles.toastText}>{toast.message}</Text>
          </Animated.View>
        </View>
      )}

      {/* Screen level, outside the scroll view: both are modals belonging to the
          screen's state, and the menu's backdrop covers the whole page. */}
      <AnchoredContextMenu
        {...mediaActions.menuProps}
        renderPreview={renderActionsPreview}
      />
      <RenameDialog {...mediaActions.renameProps} />
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

    // Toast feedback
    toastLayer: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 2,
    },
    toast: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      backgroundColor: Colors.surfaceContainer,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
    },
    toastText: {
      fontSize: Typography.small.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textMain,
    },

    // Intra-screen tabs, under the metadata line.
    tabsBar: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    // The Reader tab only. The AI tab is `ArtifactsPanel`, which brings the same
    // gutter and the same bottom inset with it.
    readerContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxl,
    },
  });
