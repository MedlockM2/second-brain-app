import { useResourceCache, useResourceState } from "../../src/contexts/ResourceCacheContext";
import { resourceKeys } from "../../src/services/resourceCache";
/**
 * Unsorted review — the triage pass over the default folder.
 *
 * One media at a time, oldest first, with three ways out: throw it away, open it
 * to have a proper look, or file it. What this screen is fighting is the default
 * folder filling up at every ingestion with nothing ever pushing the user to
 * empty it.
 *
 * Moving through the queue works the way stories do: a tap on the left third of
 * the card goes back one, a tap anywhere else goes forward. Only the current card
 * is mounted — there is no horizontal pager, so nothing can be left parked
 * between two pages, and a removal is a state change and nothing more. Screen
 * readers get the same two moves as the card's increment and decrement actions.
 *
 * One thing about this screen is unusual enough to be spelled out where it
 * happens: the queue is frozen from the user's first gesture (see `load`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { Image } from "expo-image";
import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../../src/constants/theme";
import {
  useThemeColors,
  useThemedStyles,
} from "../../src/contexts/ThemeContext";
import { t, useTranslation } from "../../src/i18n";
import { Bullets } from "../../src/components/Bullets";
import { ResourceRefreshNotice } from "../../src/components/ResourceRefreshNotice";
import { FolderSaveSheet } from "../../src/components/FolderSaveSheet";
import { buildFolderTree } from "../../src/lib/folderTree";
import { getFriendlyErrorMessage } from "../../src/lib/getFriendlyErrorMessage";
import {
  getMediaTypeBadgeTones,
  getMediaTypeIcon,
  getMediaTypeLabel,
} from "../../src/lib/mediaTypeDisplay";
import { getRelativeTime } from "../../src/lib/relativeTime";
import { resolveMediaTitle } from "../../src/lib/mediaTitle";
import { MediaService } from "../../src/services/mediaService";
import { OrganizationService } from "../../src/services/organizationService";
import type {
  MediaListItem,
  ListMediaResponse,
  MediaType,
} from "@media-summarizer/core/types/media";
import type { Folder } from "@media-summarizer/core/types/organization";

/**
 * How deep a single triage pass goes. The list endpoint caps a page at 100 and
 * the queue is one request by design — a hundred decisions is already more than
 * anyone makes in a sitting, and the next pass picks up where this one stopped.
 */
const QUEUE_LIMIT = 100;

/**
 * The most lines the triage card ever gives one bullet, and the value it starts
 * from before measuring. Past three a bullet stops being glanceable, and three is
 * what the blurb prompt's lengths need on a 390 pt-wide screen.
 */
const MAX_BULLET_LINES = 3;

/**
 * The longest queue the progress bar draws one segment per card for. Past it a
 * segment would be a few points wide — 100 cards on a 350 pt bar is 0.5 pt each,
 * with the gaps eating the rest — so the bar turns continuous instead.
 */
const MAX_PROGRESS_SEGMENTS = 20;

/** Side of the square cover on the card. */
const CARD_COVER_SIZE = 104;

/**
 * Height of one drawn edge of the cards below, and how many at most. They say
 * "there are more after this one", so a card with one left behind it shows one
 * edge and the last card shows none.
 */
const STACK_EDGE_HEIGHT = 10;
const MAX_STACK_EDGES = 2;

/**
 * The share of the screen width, from the left edge, that a tap reads as "back".
 * A third, as in stories: going forward is what a triage pass mostly does, so it
 * gets the larger target.
 */
const BACK_TAP_ZONE = 1 / 3;

/** Card padding: 20 pt, a step above the 16 pt the vignettes use. */
const CARD_PADDING = Spacing.md + Spacing.xs;

export default function UnsortedReviewScreen(): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  // Copy resolved on render: the screen redraws with the interface language.
  useTranslation();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  // This presentation owns its provider; insets are relative to its full-screen surface.
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  const bottomInset = insets.bottom;

  const cache = useResourceCache();
  const [initialQueue] = useState(() => {
    const folders = cache.snapshot<Folder[]>(resourceKeys.folders).data;
    const defaultFolder = folders && buildFolderTree(folders).defaultFolder;
    const page = defaultFolder ? cache.snapshot<ListMediaResponse>(
      resourceKeys.mediaPage({ folderId: defaultFolder.id, limit: QUEUE_LIMIT, sort: "asc" }),
    ).data : undefined;
    return {
      folderId: defaultFolder?.id,
      items: page?.items.filter((item) => item.folder_id === defaultFolder?.id),
    };
  });
  const [items, setItems] = useState<MediaListItem[]>(initialQueue.items ?? []);
  const hasQueue = useRef(initialQueue.items !== undefined);
  /**
   * Whether the user has touched the queue since the screen opened: moved
   * between cards, discarded, filed, or opened one to deepen it. Until then the
   * queue on screen is only the cache's guess and the server's answer may
   * replace it; from then on it is the user's and stays put (see `load`).
   */
  const hasActed = useRef(false);
  const [queueReady, setQueueReady] = useState(initialQueue.items !== undefined);
  const [folders, setFolders] = useResourceState<Folder[]>(
    resourceKeys.folders,
    [],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(initialQueue.items === undefined);
  const [error, setError] = useState<string | null>(null);
  const [saveTargetId, setSaveTargetId] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  /**
   * The queue as the handlers read it, mirroring `items`.
   *
   * Written by `commitQueue` alongside the state, and read by the action handlers
   * instead of the render's closure. Discard no longer waits for the server, so
   * two taps can land inside one render: the second one reading the pre-removal
   * array would act on a card that is already gone. The ref is the queue as of the
   * last mutation, `items` is the queue on screen, and between the two they are
   * never a tap apart.
   */
  const itemsRef = useRef<MediaListItem[]>(initialQueue.items ?? []);

  /** Replace the queue and say which card of it is now on screen. */
  const commitQueue = useCallback(
    (next: MediaListItem[], nextIndex: number) => {
      itemsRef.current = next;
      setItems(next);
      setActiveIndex(nextIndex);
    },
    [],
  );

  const load = useCallback(async () => {
    setIsLoading(!hasQueue.current);
    setError(null);
    try {
      const foldersRequest = OrganizationService.getUserFolders();
      // A known default id lets the page revalidate while folders revalidate.
      const defaultId = initialQueue.folderId ??
        buildFolderTree(await foldersRequest).defaultFolder?.id;
      const queueRequest = defaultId
        ? OrganizationService.getFolderMedia(defaultId, { limit: QUEUE_LIMIT, sort: "asc" })
        : Promise.resolve([]);
      const [, page] = await Promise.all([foldersRequest, queueRequest]);
      if (!isMountedRef.current) return;
      // The cached queue is a guess: the page keeps the cards filed or discarded
      // in the last pass out of it, but an import since only marks it stale, so
      // it can open empty on media the server already has. As long as the user
      // has not touched the queue, the server's answer replaces it, back on the
      // first card. Once they have, it never reshuffles under their next tap and
      // only prepares the next visit.
      if (!hasActed.current) {
        commitQueue(page.filter((item) => item.folder_id === defaultId), 0);
        hasQueue.current = true;
        setQueueReady(true);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(
        getFriendlyErrorMessage(err, {
          fallback: t("unsortedReview.loadFailed"),
        }),
      );
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [commitQueue, initialQueue.folderId]);

  /**
   * Loaded once, at mount, and never on focus.
   *
   * Deliberately against the convention of the rest of the app, where a screen
   * refetches in a `useFocusEffect` so several devices stay in step. Here the
   * user comes back from Deepen with a finger already on the card: a refetch
   * would reshuffle the queue and renumber every index under it, and the next
   * tap would land somewhere else. The mount load's answer replaces the queue
   * opened from cache only while nothing has been touched yet; after the first
   * gesture the queue is frozen, and what the server has meanwhile is next
   * pass's business.
   *
   * Deferred by a tick — a `setState` reached synchronously from an effect
   * cascades a render, and the lint rule that says so is on.
   */
  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;
    };
  }, [load]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/inbox");
  }, [router]);

  /**
   * Move one card back or forward, clamped to the queue: a tap past either end
   * stays where it is rather than wrapping round, since the first card is the
   * oldest and the last is the newest and nothing lies beyond either.
   */
  const step = useCallback((delta: number) => {
    hasActed.current = true;
    setActiveIndex((index) =>
      Math.max(0, Math.min(index + delta, itemsRef.current.length - 1)),
    );
  }, []);

  /**
   * The stories tap. Read from `pageX`, the position on the screen, and not from
   * `locationX`, which is relative to whichever child of the card the finger
   * landed on — the cover, a bullet — and would put the zone in a different
   * place on every element.
   */
  const handleCardPress = useCallback(
    (event: GestureResponderEvent) => {
      step(event.nativeEvent.pageX < windowWidth * BACK_TAP_ZONE ? -1 : 1);
    },
    [step, windowWidth],
  );

  const handleCardAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === "increment") step(1);
      if (event.nativeEvent.actionName === "decrement") step(-1);
    },
    [step],
  );

  /**
   * Drop one media from the queue, wherever it currently sits.
   *
   * Keyed on the id and not on an index, which makes it idempotent: a media
   * already out of the queue is a no-op rather than a removal of whatever took
   * its place. That is what lets discard fire on the tap without a lock.
   *
   * Returns the index it removed, so a caller that has to undo the removal knows
   * where to put the card back.
   */
  const removeById = useCallback(
    (mediaItemId: string): number => {
      const queue = itemsRef.current;
      const index = queue.findIndex(
        (item) => item.media_item_id === mediaItemId,
      );
      if (index === -1) return -1;
      const remaining = queue.filter((_, i) => i !== index);
      commitQueue(
        remaining,
        Math.min(index, Math.max(0, remaining.length - 1)),
      );
      return index;
    },
    [commitQueue],
  );

  /**
   * Put a media back where it was and bring it back on screen.
   *
   * The undo half of an optimistic discard. The index is the one the card held
   * when it left, clamped to what the queue has become — the user may have
   * discarded or filed other cards while the failing request was in flight — and
   * the screen shows it so the error message and the card it is about are the
   * same thing on screen.
   */
  const restoreAt = useCallback(
    (index: number, item: MediaListItem) => {
      const queue = itemsRef.current;
      const at = Math.min(Math.max(index, 0), queue.length);
      commitQueue([...queue.slice(0, at), item, ...queue.slice(at)], at);
    },
    [commitQueue],
  );

  const current = items[activeIndex];
  // What the three action labels say they act on. Named through the catalogues
  // like the card itself, so a media nothing named is announced as the card
  // shows it rather than as an empty string (task-400).
  const currentTitle = current ? resolveMediaTitle(current) : "";

  /**
   * Discard: the deletion goes out on the first tap, with no confirmation.
   *
   * An owner decision, and a deliberate divergence from the long-press menu in
   * Library (task-319), which does ask. Two contexts: there, one media is singled
   * out among the ones being kept; here the user is going through a backlog at
   * the rhythm of a tap, and a dialog per item turns a triage into a chore. Not
   * to be "harmonised" in either direction.
   *
   * And the card leaves on the tap, not on the server's answer.
   *
   * It used to leave on the answer: the handler awaited the DELETE and only then
   * dropped the page, which put a round trip — a second, on the tester's
   * network — between the tap and anything moving. Worse, the in-flight flag it
   * raised meanwhile set `disabled` on a Pressable that has no disabled style, so
   * the press state was dropped with nothing put in its place and the next tap was
   * swallowed too. The report is exact: "le bouton ne réagit presque pas [...] ça
   * donne l'impression que rien ne s'est passé pendant une seconde".
   *
   * So the queue advances first and the request follows. A discard is a good fit
   * for that: the media is the user's, the endpoint is idempotent enough for a
   * queue this screen will not reload anyway, and the failure path has somewhere
   * to put the card back — `restoreAt`, which brings it back on screen under the
   * alert that says the deletion did not go through. Nothing is lost by being
   * optimistic; a triage pass stopping dead on every item is.
   */
  const handleDiscard = useCallback(() => {
    const target = itemsRef.current[activeIndex];
    if (!target) return;
    hasActed.current = true;
    const index = removeById(target.media_item_id);
    if (index === -1) return;
    void (async () => {
      try {
        await MediaService.deleteMedia(target.media_item_id);
      } catch (err) {
        // The card comes back: the media is still in the library, and a queue
        // that hid it would be lying about what the server holds.
        if (!isMountedRef.current) return;
        restoreAt(index, target);
        Alert.alert(
          t("common.error"),
          getFriendlyErrorMessage(err, {
            fallback: t("unsortedReview.discardFailed"),
          }),
        );
      }
    })();
  }, [activeIndex, removeById, restoreAt]);

  /**
   * Deepen: open the media and come back. Not a decision — the item stays in the
   * queue, and since nothing reloads on focus the same card is under the finger
   * on return, at the same index — which is also why opening one counts as
   * touching the queue.
   */
  const handleDeepen = useCallback(() => {
    if (!current) return;
    hasActed.current = true;
    router.push(`/review/media/${current.media_item_id}`);
  }, [current, router]);

  const handleSavePress = useCallback(() => {
    if (!current) return;
    setSaveTargetId(current.media_item_id);
  }, [current]);

  const handleFolderCreated = useCallback(
    (folder: Folder) => {
      setFolders((prev) =>
        prev.some((entry) => entry.id === folder.id) ? prev : [...prev, folder],
      );
    },
    [setFolders],
  );

  const handleSaved = useCallback(
    (mediaItemId: string) => {
      setSaveTargetId(null);
      hasActed.current = true;
      removeById(mediaItemId);
    },
    [removeById],
  );

  const positionLabel = useMemo(
    () =>
      t("unsortedReview.position", {
        current: items.length === 0 ? 0 : activeIndex + 1,
        total: items.length,
      }),
    [activeIndex, items.length],
  );

  const positionA11yLabel = useMemo(
    () =>
      t("unsortedReview.positionA11y", {
        current: items.length === 0 ? 0 : activeIndex + 1,
        total: items.length,
      }),
    [activeIndex, items.length],
  );

  return (
    <View
      testID="unsorted-review-screen"
      style={[
        styles.container,
        { paddingTop: topInset, paddingBottom: bottomInset },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
          onPress={handleClose}
          testID="unsorted-review-close"
          accessibilityLabel={t("unsortedReview.closeA11y")}
          accessibilityRole="button"
        >
          <Ionicons name="close" size={22} color={Colors.textMain} />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {t("unsortedReview.title")}
        </Text>

        {/* The one place the position is written out, for the eye and for a
            screen reader alike: the bar below draws it, it does not state it.
            The width matches the close button's, so the title stays centred. */}
        <Text
          style={styles.headerPosition}
          accessibilityLabel={positionA11yLabel}
          numberOfLines={1}
        >
          {items.length > 0 ? positionLabel : ""}
        </Text>
      </View>

      {items.length > 0 ? (
        <QueueProgress count={items.length} activeIndex={activeIndex} />
      ) : null}

      {error && queueReady ? (
        <ResourceRefreshNotice message={error} onRetry={() => void load()} />
      ) : null}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error && !queueReady ? (
        <View style={styles.centered}>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={Colors.textMuted}
          />
          <Text style={styles.centeredTitle}>{error}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={() => void load()}
            accessibilityLabel={t("common.retry")}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonLabel}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        // Completion, and no auto-dismiss: pulling the screen away at the moment
        // the last card is dealt with steals the confirmation of having finished.
        <View style={styles.centered} testID="unsorted-review-done">
          <Ionicons
            name="checkmark-circle-outline"
            size={56}
            color={Colors.primary}
          />
          <Text style={styles.centeredTitle}>
            {t("unsortedReview.doneTitle")}
          </Text>
          <Text style={styles.centeredBody}>
            {t("unsortedReview.doneBody")}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={handleClose}
            testID="unsorted-review-done-close"
            accessibilityLabel={t("common.done")}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonLabel}>{t("common.done")}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {current ? (
            <Pressable
              style={styles.stage}
              onPress={handleCardPress}
              testID="unsorted-review-card"
              accessibilityRole="adjustable"
              accessibilityLabel={currentTitle}
              accessibilityValue={{ text: positionA11yLabel }}
              accessibilityActions={[
                { name: "increment" },
                { name: "decrement" },
              ]}
              onAccessibilityAction={handleCardAccessibilityAction}
            >
              {/* Keyed on the media, so each card starts its own bullet fit
                  and its own cover state instead of inheriting the last one's. */}
              <ReviewCard
                key={current.media_item_id}
                item={current}
                cardsBehind={items.length - 1 - activeIndex}
              />
            </Pressable>
          ) : null}

          {/* Deepen is centred on the *screen*, whatever the widths of the two
              controls beside it, which is why it sits between two `flex: 1`
              gutters instead of in a `space-between` row — that would only
              spread the three, putting Deepen off centre as soon as Discard
              and Save differ in width.

              Size and fill carry the hierarchy, from the action that loses
              something to the one the screen exists for: a tonal red disc, a
              neutral one, then a larger amber one. */}
          <View style={styles.actionBar}>
            <View style={styles.gutterStart}>
              <Pressable
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.actionPressed,
                ]}
                onPress={handleDiscard}
                testID="unsorted-review-discard"
                accessibilityLabel={t("unsortedReview.discardA11y", {
                  title: currentTitle,
                })}
                accessibilityRole="button"
              >
                {/* A bin, not the cross: the cross is the close button's, and
                    this one deletes on the tap with no dialog behind it. */}
                <View style={[styles.actionDisc, styles.discardDisc]}>
                  <Ionicons name="trash-outline" size={24} color={Colors.error} />
                </View>
                <Text
                  style={[styles.actionLabel, styles.discardLabel]}
                  numberOfLines={1}
                >
                  {t("unsortedReview.discard")}
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.action,
                pressed && styles.actionPressed,
              ]}
              onPress={handleDeepen}
              testID="unsorted-review-deepen"
              accessibilityLabel={t("unsortedReview.deepenA11y", {
                title: currentTitle,
              })}
              accessibilityRole="button"
            >
              <View style={[styles.actionDisc, styles.deepenDisc]}>
                <Ionicons name="book-outline" size={24} color={Colors.textMain} />
              </View>
              <Text style={styles.actionLabel} numberOfLines={1}>
                {t("unsortedReview.deepen")}
              </Text>
            </Pressable>

            <View style={styles.gutterEnd}>
              <Pressable
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.actionPressed,
                ]}
                onPress={handleSavePress}
                testID="unsorted-review-save"
                accessibilityLabel={t("unsortedReview.saveA11y", {
                  title: currentTitle,
                })}
                accessibilityRole="button"
              >
                <View style={styles.saveDisc}>
                  <Ionicons
                    name="folder-open"
                    size={26}
                    color={Colors.onPrimary}
                  />
                </View>
                <Text
                  style={[styles.actionLabel, styles.saveLabel]}
                  numberOfLines={1}
                >
                  {t("unsortedReview.save")}
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      <FolderSaveSheet
        visible={saveTargetId !== null}
        mediaItemId={saveTargetId}
        folders={folders}
        onClose={() => setSaveTargetId(null)}
        onFolderCreated={handleFolderCreated}
        onSaved={handleSaved}
      />
    </View>
  );
}

// --- Sub-components ---

/**
 * Where the user is in the queue, drawn under the header the way a stories
 * viewer draws it: one segment per card, the ones behind in ink, the current one
 * in amber, the ones ahead on the tonal track.
 *
 * Only the queue as it is now. A card that is discarded or filed leaves the
 * queue (`removeById`) and takes its segment with it, so the bar and the
 * "3 / 12" beside the title always count the same thing.
 *
 * Past `MAX_PROGRESS_SEGMENTS` the segments would be too thin to see, so the bar
 * becomes one continuous track filled up to the current card. Purely visual:
 * the count in the header is what a screen reader hears.
 */
function QueueProgress({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);

  if (count > MAX_PROGRESS_SEGMENTS) {
    return (
      <View
        style={styles.progress}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((activeIndex + 1) / count) * 100}%` },
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.progress, styles.progressSegments]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            i < activeIndex && styles.progressSegmentPast,
            i === activeIndex && styles.progressSegmentCurrent,
          ]}
        />
      ))}
    </View>
  );
}

/**
 * The card on screen: centred on the stage, resting on the
 * edges of the cards still behind it.
 *
 * The card holds the cover (a square, top-left), then beside it the same lines
 * as the Search and Library vignette — the type pill in its colour and the age,
 * the title, the creator — then a rule, the hook and the bullets. One surface:
 * the grey box the summary used to sit in is gone, and with it 32 pt of padding
 * the text column paid for on every line.
 *
 * Sized by its content and centred, not stretched. A content-sized card on a
 * tall phone used to leave a third of a screen of background between it and the
 * actions; centred, the same room is air around an object, above and below, and
 * the edges under it say that the queue goes on.
 *
 * The card never scrolls. A summary you have to scroll is not a summary you can
 * decide on, and a nested vertical scroller would fight the taps that move
 * through the queue. So `fitBullets` gives each bullet as many lines as the page can
 * actually spare, measured, not assumed: a fixed three lines a bullet is what the
 * prompt's lengths need on a 390 pt screen, and a 320 pt one (an iPhone 13 in
 * Display Zoom) wraps the same text onto more lines in less height. It lowers the
 * per-bullet cap by one and lets the layout re-measure until the list fits, so
 * the text that does not fit is paid for with an ellipsis spread over the
 * bullets rather than taken out of one of them — dropping bullets loses whole
 * topics, and tightening the type writes a per-screen exception into a design
 * system that fixes body text at 16/1.6.
 *
 * The caps stay a backstop and not a layout mechanism: the prompt asks for lengths
 * the card can render, so an ellipsis on a roomy screen still means the model
 * overran. Raising `MAX_BULLET_LINES` instead of shortening the text is the wrong
 * fix — a clipped bullet carries less than a shorter one.
 */
function ReviewCard({
  item,
  cardsBehind,
}: {
  item: MediaListItem;
  cardsBehind: number;
}): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  // Kept per card rather than per screen: a cover that failed on one media says
  // nothing about the next one's.
  const [coverFailed, setCoverFailed] = useState(false);

  const [bulletLines, setBulletLines] = useState(MAX_BULLET_LINES);

  const edges = Math.min(MAX_STACK_EDGES, Math.max(0, cardsBehind));

  /**
   * The measurements `fitBullets` works from, in refs and not in state.
   *
   * Refs because they are inputs to a decision, not things to render: holding them
   * in state would redraw the card once per measurement for nothing. And the
   * decision runs from the layout handlers rather than from an effect watching
   * them — `react-hooks/set-state-in-effect` is an error in this project, and a
   * layout event is exactly where a layout-driven `setState` belongs.
   */
  /**
   * The page, which the stage stretches to its own height: the one height on this
   * card that no amount of text can move, and therefore the one to budget from.
   */
  const pageHeight = useRef<number | null>(null);
  /** The cover-and-title block, whose height the bullet cap has no bearing on. */
  const headerHeight = useRef<number | null>(null);
  const hookHeight = useRef<number | null>(null);
  const listHeight = useRef<number | null>(null);
  /** The room the cap currently in force was fitted against. */
  const fittedRoom = useRef<number | null>(null);

  /**
   * Shrink the bullets by one line if they overrun the room the page leaves them,
   * one measurement at a time.
   *
   * Called from all four layout handlers, so whichever of them fires last in a
   * layout pass is the one that has the full picture — the order they arrive in is
   * not guaranteed and does not matter. Each shrink re-lays out the list, which
   * fires its handler again, which is how this converges: three passes at worst,
   * and at one line a bullet `Math.max` returns the value already held and React
   * stops re-rendering.
   *
   * Deliberately monotonic. It only ever shrinks within a given room, so the sole
   * way back up is a room that actually grew — a live text-size change, say —
   * which resets the cap rather than leaving the list stuck at what an earlier,
   * smaller room could take.
   */
  const fitBullets = useCallback(() => {
    const page = pageHeight.current;
    const header = headerHeight.current;
    const hook = hookHeight.current;
    const list = listHeight.current;
    if (page === null || header === null || hook === null || list === null) {
      return;
    }

    /**
     * What the page has left for the bullets, spelled out rather than measured off
     * the card: the card is content-sized, so its height *is* the list plus the
     * rest, and comparing the list against it would compare the list against
     * itself. The page cannot do that — the stage fixes its height — and neither
     * the header block nor the stack edges care how many lines a bullet gets.
     */
    const room =
      page -
      2 * Spacing.sm - // the page's padding
      edges * STACK_EDGE_HEIGHT - // the cards behind
      2 * CARD_PADDING -
      header -
      Spacing.md - // the card's gap under the header
      StyleSheet.hairlineWidth - // the rule
      Spacing.md - // the card's gap under the rule
      hook -
      Spacing.md; // the card's gap under the hook

    if (fittedRoom.current !== null && room > fittedRoom.current + 1) {
      fittedRoom.current = room;
      setBulletLines(MAX_BULLET_LINES);
      return;
    }
    fittedRoom.current = room;

    if (list > room) setBulletLines((prev) => Math.max(1, prev - 1));
  }, [edges]);

  const handlePageLayout = useCallback(
    (event: LayoutChangeEvent) => {
      pageHeight.current = event.nativeEvent.layout.height;
      fitBullets();
    },
    [fitBullets],
  );

  const handleHeaderLayout = useCallback(
    (event: LayoutChangeEvent) => {
      headerHeight.current = event.nativeEvent.layout.height;
      fitBullets();
    },
    [fitBullets],
  );

  const handleHookLayout = useCallback(
    (event: LayoutChangeEvent) => {
      hookHeight.current = event.nativeEvent.layout.height;
      fitBullets();
    },
    [fitBullets],
  );

  const handleBulletsLayout = useCallback(
    (event: LayoutChangeEvent) => {
      listHeight.current = event.nativeEvent.layout.height;
      fitBullets();
    },
    [fitBullets],
  );

  const mediaType = (item.media_type ?? "unknown") as MediaType;
  const coverUrl = item.media_image?.trim() ?? "";
  const showCover = coverUrl.length > 0 && !coverFailed;
  const badge = getMediaTypeBadgeTones(mediaType, Colors);

  const creator = item.creator_name?.trim() ?? "";
  // Same subtitle policy as `MediaListCard`: five sources can never have a
  // creator, and the domain is then the only thing that says where this came
  // from. The line is never doubled up.
  let subtitle = creator;
  if (!subtitle) {
    const sourceUrl = item.source_url ?? "";
    try {
      subtitle = new URL(sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      subtitle = sourceUrl;
    }
  }

  const blurb = item.review_blurb ?? null;
  const hook = blurb?.hook?.trim() ?? "";
  const points = (blurb?.points ?? []).map((p) => p.trim()).filter(Boolean);

  return (
    <View style={styles.page} onLayout={handlePageLayout}>
      <View style={styles.deck}>
        <View style={styles.card}>
          <View style={styles.cardHeader} onLayout={handleHeaderLayout}>
            <View style={styles.coverContainer}>
              {showCover ? (
                <Image
                  source={{
                    uri: coverUrl,
                    // The signature of a re-hosted cover rotates; keying the cache
                    // on the item and its last change is what stops a re-download
                    // on every read (task-302 §6.2).
                    cacheKey: `${item.media_item_id}:${item.updated_at}`,
                  }}
                  recyclingKey={item.media_item_id}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  transition={150}
                  priority="low"
                  style={styles.cover}
                  onError={() => setCoverFailed(true)}
                  accessible={false}
                />
              ) : (
                <Ionicons
                  name={getMediaTypeIcon(mediaType)}
                  size={32}
                  color={Colors.textMuted}
                />
              )}
            </View>

            <View style={styles.cardHeading}>
              {/* The vignette's own meta row, so a media wears the same pill
                  here as in Search and Library. */}
              <View style={styles.cardMeta}>
                <View style={[styles.typeBadge, { backgroundColor: badge.fill }]}>
                  <Text style={[styles.typeBadgeText, { color: badge.ink }]}>
                    {getMediaTypeLabel(mediaType)}
                  </Text>
                </View>
                <Text style={styles.cardAge} numberOfLines={1}>
                  {getRelativeTime(item.created_at)}
                </Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={3}>
                {resolveMediaTitle(item)}
              </Text>
              {subtitle ? (
                <Text style={styles.cardCreator} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.rule} />

          {hook ? (
            <>
              <Text
                style={styles.blurbHook}
                numberOfLines={3}
                onLayout={handleHookLayout}
              >
                {hook}
              </Text>
              {/* The wrapper is there to be measured. `Bullets` is shared with the
                  artifact screen, which has no use for a layout callback, so the
                  one screen that needs the height reads it from a view of its own
                  rather than putting an `onLayout` prop on the component. */}
              {points.length > 0 ? (
                <View onLayout={handleBulletsLayout}>
                  <Bullets items={points} numberOfLines={bulletLines} />
                </View>
              ) : null}
            </>
          ) : (
            /* No blurb yet — generation in flight, failed, or an item ingested
               before the artifact existed. A quiet line, and the three actions
               stay live: a decision does not need the summary. No spinner and no
               polling either; the blurb is not what the user is waiting for. */
            <Text style={styles.blurbMissing}>
              {t("unsortedReview.noBlurb")}
            </Text>
          )}
        </View>

        {edges >= 1 ? <View style={[styles.stackEdge, styles.stackEdgeNear]} /> : null}
        {edges >= 2 ? <View style={[styles.stackEdge, styles.stackEdgeFar]} /> : null}
      </View>
    </View>
  );
}

// --- Styles ---

const makeStyles = ({ colors: Colors, shadows: Shadows }: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.md,
      // Below the status bar, not against it: the safe area inset stops the
      // content overlapping the clock, it does not give the header any air.
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      gap: Spacing.md,
    },
    closeButton: {
      width: TouchTarget.minimum,
      height: TouchTarget.minimum,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.surfaceContainerHigh,
      alignItems: "center",
      justifyContent: "center",
    },
    closeButtonPressed: {
      opacity: 0.7,
    },
    // 16/700 rather than the 20 pt headline: in French the 20 pt title ran past
    // the room two 48 pt controls leave it on a 375 pt phone, and the card below
    // has a title of its own that should not compete with the screen's.
    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: Typography.body.fontSize,
      fontWeight: "700",
      color: Colors.textMain,
    },
    headerPosition: {
      width: TouchTarget.minimum,
      textAlign: "right",
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
      color: Colors.textSubtle,
      fontVariant: ["tabular-nums"],
    },

    // Progress
    progress: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.xs,
    },
    progressSegments: {
      flexDirection: "row",
      gap: 3,
    },
    progressSegment: {
      flex: 1,
      height: 3,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.surfaceContainerHigh,
    },
    progressSegmentPast: {
      backgroundColor: Colors.textMain,
    },
    progressSegmentCurrent: {
      backgroundColor: Colors.primary,
    },
    progressTrack: {
      height: 3,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.surfaceContainerHigh,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.textMain,
    },

    // Loading / error / completion
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.xl,
      gap: Spacing.md,
    },
    centeredTitle: {
      fontSize: Typography.headline.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
      textAlign: "center",
    },
    centeredBody: {
      fontSize: Typography.body.fontSize,
      color: Colors.textSubtle,
      textAlign: "center",
      lineHeight: Typography.body.lineHeight,
    },
    primaryButton: {
      minHeight: TouchTarget.minimum,
      justifyContent: "center",
      paddingHorizontal: Spacing.xl,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
      marginTop: Spacing.sm,
      ...Shadows.soft,
    },
    primaryButtonPressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.9,
    },
    primaryButtonLabel: {
      fontSize: Typography.label.fontSize,
      fontWeight: "600",
      color: Colors.onPrimary,
    },

    // Stage: the tap target between the header and the actions.
    stage: {
      flex: 1,
    },
    // Centres the deck on the page's height, which the stage fixes: the card is
    // content-sized, so whatever room it does not use is shared above and below.
    page: {
      flex: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      justifyContent: "center",
    },
    // Gives ground with the card when the content overruns the page, instead of
    // spilling past the stage and getting clipped — which is what hands the card
    // the bounded height `fitBullets` budgets against.
    deck: {
      flexShrink: 1,
    },
    card: {
      flexShrink: 1,
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.xl,
      padding: CARD_PADDING,
      gap: Spacing.md,
      // The floor under `fitBullets`: at one line a bullet it stops shrinking, and
      // on a page too small even for that the spill is cut by the card's edge.
      overflow: "hidden",
      ...Shadows.soft,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.md - 2,
    },
    // The container is both the frame of the cover and the fallback surface, so a
    // card with a picture and one without keep the same silhouette.
    coverContainer: {
      width: CARD_COVER_SIZE,
      height: CARD_COVER_SIZE,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surfaceContainerLow,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    cover: {
      width: "100%",
      height: "100%",
    },
    cardHeading: {
      flex: 1,
      gap: Spacing.xs + 2,
    },
    // Same row, pill and age as `MediaListCard`'s `cardMeta`.
    cardMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    typeBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.md,
    },
    // No `color` here: the ink comes from `getMediaTypeBadgeTones` with the
    // fill it has to sit on.
    typeBadgeText: {
      fontSize: Typography.small.fontSize,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    cardAge: {
      flexShrink: 1,
      fontSize: Typography.small.fontSize,
      color: Colors.textMuted,
    },
    cardTitle: {
      fontSize: 18,
      lineHeight: 23,
      fontWeight: "700",
      color: Colors.textMain,
    },
    cardCreator: {
      fontSize: Typography.small.fontSize,
      color: Colors.textSubtle,
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.outlineVariant,
    },
    // A step above the bullets, so the two read as headline and detail rather
    // than as one list at one size.
    blurbHook: {
      fontSize: 18,
      fontWeight: "600",
      color: Colors.textMain,
      lineHeight: 26,
    },
    blurbMissing: {
      fontSize: Typography.body.fontSize,
      color: Colors.textSubtle,
      lineHeight: Typography.body.lineHeight,
      fontStyle: "italic",
    },
    // The cards behind: two bare strips of the card's surface, narrower and
    // fainter the further back, tucked under its bottom edge.
    stackEdge: {
      height: STACK_EDGE_HEIGHT,
      backgroundColor: Colors.surface,
      borderBottomLeftRadius: BorderRadius.xl,
      borderBottomRightRadius: BorderRadius.xl,
      ...Shadows.soft,
    },
    stackEdgeNear: {
      marginHorizontal: Spacing.md - 4,
      opacity: 0.75,
    },
    stackEdgeFar: {
      marginHorizontal: Spacing.lg + 2,
      opacity: 0.45,
    },

    // Footer: the three actions
    actionBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
    },
    gutterStart: {
      flex: 1,
      alignItems: "flex-start",
    },
    gutterEnd: {
      flex: 1,
      alignItems: "flex-end",
    },
    // The disc and its label are one target, so the hit area is the whole
    // column and never less than the 72 pt the labels need side by side.
    action: {
      minWidth: 72,
      alignItems: "center",
      gap: Spacing.xs + 2,
    },
    // Opacity *and* a scale, the same pair every pressable in the app uses, at the
    // 0.96 the round controls take. One finger on the disc covers most of what
    // dims, so the shrink is the part that is actually seen.
    actionPressed: {
      opacity: 0.6,
      transform: [{ scale: 0.96 }],
    },
    actionDisc: {
      width: TouchTarget.comfortable,
      height: TouchTarget.comfortable,
      borderRadius: BorderRadius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    discardDisc: {
      backgroundColor: Colors.errorContainer,
    },
    deepenDisc: {
      backgroundColor: Colors.surfaceContainerHigh,
    },
    // The one the screen exists for: larger, and the only filled one.
    saveDisc: {
      width: TouchTarget.large,
      height: TouchTarget.large,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      ...Shadows.soft,
    },
    actionLabel: {
      fontSize: Typography.small.fontSize,
      fontWeight: "600",
      color: Colors.textMain,
    },
    discardLabel: {
      color: Colors.error,
    },
    saveLabel: {
      fontWeight: "700",
    },
  });
