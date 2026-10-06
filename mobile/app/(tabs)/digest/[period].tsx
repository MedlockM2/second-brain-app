/**
 * Digest — the carousel of one period: one full media page per swipe (task-409,
 * the owner's decision on the task-408 benchmark).
 *
 * Pushed from the choice screen (`index.tsx`), or opened straight from a Digest
 * notification with the choice anchored under it (`_layout.tsx`). The media of
 * the period, oldest first, and each page is `CompletedDetailView` with its
 * chrome — cover, `‹` and `…` over it, metadata, the Reader / AI segment,
 * "L'essentiel", the full text, the bar that folds in on scroll. It is the very
 * page `/media/[id]` renders, with one difference: the cover starts under this
 * screen's band instead of running under the status bar (`underStatusBar`).
 *
 * No period segment and no period title here any more: the period was chosen on
 * the way in, and those two rows are what made this screen dense (task-408).
 *
 * ## The band
 *
 * One fixed strip under the status bar, and nothing else above the pages: the
 * dots and, beside them, the position ("3 / 7"). The dots cap at seven and say
 * nothing to a screen reader, so the position is where the information lives —
 * for the eye and for VoiceOver alike. The band never scrolls and nothing is
 * drawn over it: the pages start under it, so the bar a page folds in while
 * reading shows up under the band too. A single media gets its position and no
 * dots — one dot is not a carousel.
 *
 * ## Which period is showing
 *
 * The route's `period` param, and anything but `weekly` is the daily Digest, so
 * a malformed param opens the usual period rather than nothing. Everything that
 * belongs to a period — the digest, its loading and error states, the page the
 * user is on, the media deleted from it — lives in `DigestCarousel`, keyed by
 * the period: a notification landing here for the other period remounts it, and
 * that is the whole reset.
 *
 * ## Going back
 *
 * `‹` over the cover and in the folded bar, and in the header of every state
 * that has no cover, leads back to the choice. So does the iOS back gesture, from
 * the screen edge only (`fullScreenGestureEnabled: false` in `_layout.tsx`), so
 * that it never takes the horizontal swipe from the carousel.
 *
 * ## The gestures
 *
 * A page scrolls vertically and carries its own tabs, inside a pager that scrolls
 * horizontally. Four things keep the two apart, and all four are load-bearing:
 *
 * 1. **The pager is the only horizontal scrollable in the tree.** Nothing in the
 *    media page subtree scrolls sideways, so no descendant ever competes for a
 *    horizontal pan.
 * 2. **`directionalLockEnabled` on both scroll views.** A drag commits to one
 *    axis. Without it a diagonal drag scrolls the page *and* drags the pager, and
 *    a page ends up parked between two.
 * 3. **Every page is exactly `SCREEN_WIDTH` wide, mounted or not.** The content
 *    width of the pager is therefore `ids.length * SCREEN_WIDTH` at all times and
 *    the page boundaries never move — which is what makes lazy mounting safe. A
 *    placeholder that measured 0 would shift every boundary past it under the
 *    finger.
 * 4. **The intra-page tabs are `Pressable`s, not a swipe.** A tab change is a tap
 *    — it cannot consume a pan — and it repaints inside one page, leaving the
 *    pager's content width untouched.
 *
 * One accepted consequence on iOS: a touch that lands while a page is still
 * gliding is claimed by that page's scroll view to stop it, so the swipe in that
 * same touch does not turn the page. The next swipe does.
 *
 * ## What gets mounted
 *
 * Only the current page and its two neighbours. Three pages, so three sets of the
 * artifact/translation/preview polls `CompletedDetailView` runs — the reason the
 * window is closed behind the user rather than left to grow: a period can hold
 * dozens of media. The price is that a page left three or more behind refetches
 * when it comes back, which no single swipe can cause.
 *
 * What a refetch does not bring back is a fresh wait for a translation. Its
 * budget is kept by the carousel (`TranslationBudgets`), not by the page, so a
 * page that comes back into the window resumes the wait where it stood instead
 * of starting it over (task-415). Leaving the screen and coming back, or
 * bringing the app back to the foreground, is what grants a new one.
 *
 * ## Deleting from here
 *
 * The `…` menu of a page is the page's own, whole: Move, Rename, Delete. A media
 * deleted here leaves the carousel on the spot, and when it was the last one the
 * screen goes back to the choice. The digest itself is a capture frozen by the
 * server, so the deleted id stays in it; it is kept out of this carousel for as
 * long as the carousel lives, including across a retry.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../src/contexts/AuthContext";
import { DigestService } from "../../../src/services/digestService";
import { CompletedDetailView } from "../../../src/components/CompletedDetailView";
import { MediaDetailHeader } from "../../../src/components/MediaDetailHeader";
import { PaginationDots } from "../../../src/components/PaginationDots";
import { useMediaDetailPolling } from "../../../src/hooks/useMediaDetailPolling";
import { TranslationBudgets } from "../../../src/hooks/useTranslationRefresh";
import { getFriendlyErrorMessage } from "../../../src/lib/getFriendlyErrorMessage";
import { TAB_BAR_CLEARANCE } from "../../../src/constants/tabBar";
import {
  BorderRadius,
  Spacing,
  TouchTarget,
  Typography,
  type Theme,
} from "../../../src/constants/theme";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../src/contexts/ThemeContext";
import { t, useTranslation } from "../../../src/i18n";
import type { Digest, DigestPeriod } from "../../../src/types/digest";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/** How many pages either side of the current one stay mounted. */
const MOUNT_RADIUS = 1;

/** Where `‹` leads from every state of this screen: the choice of a period. */
const DIGEST_CHOICE_HREF = "/(tabs)/digest";

export default function DigestPeriodScreen(): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  // Resolved-on-render copy: the screen has to redraw with the language.
  useTranslation();

  const { period: periodParam } = useLocalSearchParams<{ period?: string }>();
  const period: DigestPeriod = periodParam === "weekly" ? "weekly" : "daily";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Keyed by the period: see the note at the top of the file. */}
      <DigestCarousel key={period} period={period} />
    </SafeAreaView>
  );
}

// --- Sub-components ---

/**
 * One period, and everything that belongs to it.
 *
 * Mounted per period and never reused across two, so its state — the digest,
 * the error, the refresh flag, the page the user is on and the media deleted
 * from it — and the pager's own scroll offset all start clean without anyone
 * resetting them.
 */
function DigestCarousel({
  period,
}: {
  period: DigestPeriod;
}): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [digest, setDigest] = useState<Digest | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // The translation waits of the period's pages, which outlive the pages
  // themselves: see "What gets mounted" at the top of the file.
  const [translationBudgets] = useState(() => new TranslationBudgets());
  const pagerRef = useRef<ScrollView>(null);

  const fetchDigest = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setDigest(
        period === "daily"
          ? await DigestService.getDailyDigest()
          : await DigestService.getWeeklyDigest(),
      );
      setError(null);
    } catch (err: unknown) {
      setError(
        getFriendlyErrorMessage(err, { fallback: t("digest.loadFailed") }),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthenticated, period]);

  // Read once, on mount. This screen only mounts when it is opened — unlike the
  // tab root, which `NativeTabs` mounts on every cold start — and the list of a
  // period is frozen at capture: reading it again on focus could only reshuffle
  // the pages under the user's finger. Deferred by a tick, because a `setState`
  // reached synchronously from an effect cascades a render.
  useEffect(() => {
    const timer = setTimeout(() => void fetchDigest(), 0);
    return () => clearTimeout(timer);
  }, [fetchDigest]);

  const handleRetry = useCallback(() => {
    setIsRefreshing(true);
    setError(null);
    void fetchDigest();
  }, [fetchDigest]);

  const ids = useMemo(
    () =>
      (digest?.media_item_ids ?? []).filter((id) => !deletedIds.has(id)),
    [digest, deletedIds],
  );

  // Back to the choice, whether it was the screen this one was pushed from or
  // the anchor a notification put under it. Replaces this screen with the choice
  // should the stack ever hold nothing under it.
  const goToChoice = useCallback(() => {
    router.dismissTo(DIGEST_CHOICE_HREF);
  }, [router]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      // Clamped: a bounce past the last page, or a scroll event arriving in the
      // same frame as a deletion, must not point outside the period.
      setActiveIndex(Math.max(0, Math.min(index, ids.length - 1)));
    },
    [ids.length],
  );

  /**
   * Drop a deleted media from the carousel, once the server has confirmed it.
   *
   * The pager is then put back on a page boundary by hand, as the unsorted review
   * does after a removal: the content width shrinks by one page while the scroll
   * view keeps its offset, which would leave it parked between two pages — or
   * past the end, when the last page is the one that went. Not animated: the next
   * page slid into the vacated slot on its own. After a frame, so the scroll lands
   * on the list as laid out without the page.
   */
  const handleDeleted = useCallback(
    (mediaItemId: string) => {
      const index = ids.indexOf(mediaItemId);
      if (index === -1) return;

      const remaining = ids.length - 1;
      if (remaining === 0) {
        // Nothing left to show in this period: back to the choice, rather than
        // to an empty state that would claim the period never held anything.
        goToChoice();
        return;
      }

      const nextIndex =
        index < activeIndex
          ? activeIndex - 1
          : Math.min(activeIndex, remaining - 1);
      setDeletedIds((current) => new Set(current).add(mediaItemId));
      setActiveIndex(nextIndex);
      requestAnimationFrame(() => {
        pagerRef.current?.scrollTo({
          x: nextIndex * SCREEN_WIDTH,
          animated: false,
        });
      });
    },
    [ids, activeIndex, goToChoice],
  );

  // Nothing has come back yet. A digest with no media is an answer and comes back
  // as an empty list, so "still null" means the request is in flight.
  const isLoading = digest === null && error === null;

  if (isLoading) {
    return (
      <>
        <MediaDetailHeader onBack={goToChoice} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <MediaDetailHeader onBack={goToChoice} />
        {/* `contentInsetAdjustmentBehavior` is set by hand, not left to
            `NativeTabs`: the tab bar only insets the first scroll view on the
            screen's first-subview chain (`RNSScrollViewFinder`), and the header
            above comes first, so that walk dead-ends before this one.
            `automatic` is the very value the native helper would have set. */}
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRetry}
              tintColor={Colors.primary}
            />
          }
        >
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={Colors.textMuted}
          />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={handleRetry}
            accessibilityLabel={t("digest.tryAgain")}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>{t("digest.tryAgain")}</Text>
          </Pressable>
        </ScrollView>
      </>
    );
  }

  if (ids.length === 0) {
    return (
      <>
        <MediaDetailHeader onBack={goToChoice} />
        {/* Nothing was saved in the period, so the backend wrote no digest for
            it and there is nothing to page through — and no notification was
            sent for it either. Sober, and deliberately without a way out to
            another period: an empty day is a true answer, and answering with
            another day's media would be a lie about which one was chosen.
            Same hand-set inset as the error state above. */}
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRetry}
              tintColor={Colors.primary}
            />
          }
        >
          <Text style={styles.emptyTitle}>
            {period === "daily"
              ? t("digest.emptyDaily")
              : t("digest.emptyWeekly")}
          </Text>
          <Text style={styles.emptyHint}>
            {period === "daily"
              ? t("digest.emptyDailyHint")
              : t("digest.emptyWeeklyHint")}
          </Text>
        </ScrollView>
      </>
    );
  }

  const position = { current: activeIndex + 1, total: ids.length };

  return (
    /* No automatic inset on the pager: it is the one scrollable here that
       scrolls horizontally, and an automatic adjustment would inset the paging
       axis. `collapsable={false}` keeps the wrapper a real view so the pager
       below it stays where the layout puts it.

       No `RefreshControl` either. It only works on a vertical scroll view, and
       there would be nothing for it to fetch: the list of a period is frozen at
       capture and cannot change until the next send. */
    <View style={styles.pagerContainer} collapsable={false}>
      <View style={styles.band}>
        {ids.length > 1 ? (
          <PaginationDots
            count={ids.length}
            activeIndex={activeIndex}
            testID="digest-dots"
          />
        ) : null}
        <Text
          style={styles.position}
          accessibilityLabel={t("digest.positionA11y", position)}
          numberOfLines={1}
          testID="digest-position"
        >
          {t("digest.position", position)}
        </Text>
      </View>

      <ScrollView
        ref={pagerRef}
        style={styles.pager}
        horizontal
        pagingEnabled
        directionalLockEnabled
        // One media is not a carousel: no sideways bounce to compete with the
        // page's own scroll.
        scrollEnabled={ids.length > 1}
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        testID="digest-pager"
      >
        {ids.map((id, index) =>
          Math.abs(index - activeIndex) <= MOUNT_RADIUS ? (
            <DigestPage
              key={id}
              mediaItemId={id}
              onBack={goToChoice}
              onDeleted={handleDeleted}
              translationBudgets={translationBudgets}
            />
          ) : (
            <View key={id} style={styles.page} />
          ),
        )}
      </ScrollView>
    </View>
  );
}

/**
 * One page of the carousel: a media, fetched by the page itself.
 *
 * The fetch is the route's hook, unchanged — a digest page goes through the same
 * states a media does when opened directly, including still being processed or
 * having failed, which an item saved minutes before the send can be. Mounting is
 * what starts it and unmounting is what stops it, so the mount window *is* the
 * loading policy: there is no second mechanism to keep in step with it.
 *
 * The states before the page carry the route's header, so `‹` is on screen
 * whatever the page is doing. No retry button in them: the swipe out of the page
 * is the way on, and the item is one tap away in the library.
 *
 * The page always occupies a full screen width, whichever state it is in. A
 * spinner in a narrower box would move every page boundary after it.
 */
function DigestPage({
  mediaItemId,
  onBack,
  onDeleted,
  translationBudgets,
}: {
  mediaItemId: string;
  onBack: () => void;
  onDeleted: (mediaItemId: string) => void;
  translationBudgets: TranslationBudgets;
}): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { state, mediaData, fetchError, processingError, processingMessage } =
    useMediaDetailPolling(mediaItemId);

  const handleDeleted = useCallback(
    () => onDeleted(mediaItemId),
    [onDeleted, mediaItemId],
  );

  if (state === "completed" && mediaData) {
    return (
      <View style={styles.page}>
        <CompletedDetailView
          mediaData={mediaData}
          onBack={onBack}
          onDeleted={handleDeleted}
          underStatusBar={false}
          translationBudgets={translationBudgets}
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <MediaDetailHeader onBack={onBack} />
      <View style={styles.pageCentered}>
        {state === "loading" || state === "processing" ? (
          <>
            <ActivityIndicator size="large" color={Colors.primary} />
            {state === "processing" ? (
              <Text style={styles.pageStateTitle}>{processingMessage}</Text>
            ) : null}
          </>
        ) : (
          // Failed, timed out, or unreachable.
          <>
            <Ionicons
              name={state === "timeout" ? "time-outline" : "alert-circle-outline"}
              size={40}
              color={Colors.textMuted}
            />
            <Text style={styles.pageStateTitle}>
              {state === "timeout"
                ? t("media.timeoutTitle")
                : state === "failed"
                  ? t("media.failedTitle")
                  : t("media.loadFailed")}
            </Text>
            <Text style={styles.pageStateBody}>
              {state === "timeout"
                ? t("media.timeoutHint")
                : (processingError ?? fetchError ?? t("media.failedFallback"))}
            </Text>
          </>
        )}
      </View>
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

    // Loading / error / empty
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.xl,
      gap: Spacing.md,
    },
    errorText: {
      fontSize: Typography.body.fontSize,
      color: Colors.textMain,
      textAlign: "center",
    },
    retryButton: {
      minHeight: TouchTarget.minimum,
      justifyContent: "center",
      paddingHorizontal: Spacing.xl,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.primary,
    },
    retryButtonPressed: {
      opacity: 0.9,
    },
    retryButtonText: {
      fontSize: Typography.label.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.onPrimary,
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
      lineHeight: Typography.body.lineHeight,
    },

    // Pager
    pagerContainer: {
      flex: 1,
      // The band the tab bar owns. See TAB_BAR_CLEARANCE.
      paddingBottom: TAB_BAR_CLEARANCE,
    },
    // The band: on the page background, as the status bar above it is, so the two
    // read as one strip the pages start under.
    band: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      minHeight: Spacing.xl,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    position: {
      fontSize: Typography.small.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textSubtle,
    },
    pager: {
      flex: 1,
    },
    // Exactly one screen width, in every state of a page. See the gesture note at
    // the top of the file: the page boundaries are `index * SCREEN_WIDTH` and
    // nothing about mounting is allowed to move them.
    page: {
      width: SCREEN_WIDTH,
    },
    pageCentered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.xl,
      gap: Spacing.md,
    },
    pageStateTitle: {
      fontSize: Typography.headline.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
      textAlign: "center",
    },
    pageStateBody: {
      fontSize: Typography.body.fontSize,
      color: Colors.textMuted,
      textAlign: "center",
      lineHeight: Typography.body.lineHeight,
    },
  });
