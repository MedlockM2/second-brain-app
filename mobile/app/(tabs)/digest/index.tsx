/**
 * Digest — the root of the tab: the choice of a period, as two stacks of covers
 * (task-409, the owner's decision on the task-408 benchmark).
 *
 * Two packs, Daily then Weekly (`DigestCoverStack`), and nothing else but the
 * title: the period segment that used to sit above the reading screen lives here
 * now, as the two things to choose between, and a tap on a pack pushes the
 * carousel of that period (`[period].tsx`). No dates on this screen — for the
 * record, the weekly pack is the Monday-to-Sunday week already *over*, the one
 * the Monday 09:30 send announced, not the week in progress (`digestService.ts`).
 *
 * ## What is read, and when
 *
 * Three requests, and only these: the two digests and one page of the library.
 * A pack's covers are the `media_image` of the library rows whose id is in its
 * digest — no detail read per cover, and nothing new on the server. The library
 * page is the largest the list endpoint serves, newest first: the weekly pack
 * opens on the *oldest* media of a week that is already over, and a page of
 * twenty would miss them as soon as the user saves a few media a day.
 *
 * Read on focus, not on mount: `NativeTabs` mounts every tab on the first render
 * of the bar (task-350), so a mount-time read would cost three requests on every
 * cold start, including the ones where the Digest is never opened. Coming back
 * from a carousel is a focus too, so the covers follow what was done there: a
 * media deleted from the carousel leaves the cached composition and library
 * page together. The pack's count and covers follow those known removals.
 *
 * A read that fails leaves its part as the previous one knew it — unknown on a
 * first read. Neither pack ever waits on anything: both are drawn and pressable
 * while loading and after a failure. The carousel reuses the same cached digest
 * composition and revalidates it on opening. Pull to refresh reads all three again.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../src/contexts/AuthContext";
import { DigestService } from "../../../src/services/digestService";
import { MediaService } from "../../../src/services/mediaService";
import { useResourceSnapshot } from "../../../src/contexts/ResourceCacheContext";
import { resourceKeys } from "../../../src/services/resourceCache";
import { DigestCoverStack } from "../../../src/components/DigestCoverStack";
import { TAB_BAR_CLEARANCE } from "../../../src/constants/tabBar";
import { Spacing, Typography, type Theme } from "../../../src/constants/theme";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../src/contexts/ThemeContext";
import { t, useTranslation } from "../../../src/i18n";
import type { Digest, DigestPeriod } from "@media-summarizer/core/types/digest";
import type { ListMediaResponse } from "@media-summarizer/core/types/media";

/** The periods, in the order the screen stacks them. */
const PERIODS: readonly DigestPeriod[] = ["daily", "weekly"];

/** The largest page `GET /api/media` serves (the server clamps to 100). */
const LIBRARY_PAGE_SIZE = 100;

export default function DigestChoiceScreen(): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  // Resolved-on-render copy: the screen has to redraw with the language.
  useTranslation();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const daily = useResourceSnapshot<Digest>(resourceKeys.digest("daily"));
  const weekly = useResourceSnapshot<Digest>(resourceKeys.digest("weekly"));
  const media = useResourceSnapshot<ListMediaResponse>(
    resourceKeys.mediaPage({ limit: LIBRARY_PAGE_SIZE }),
  );
  const periodMedia = {
    daily: daily.data?.media_item_ids ?? null,
    weekly: weekly.data?.media_item_ids ?? null,
  };
  const library = useMemo(
    () =>
      media.data
        ? new Map(media.data.items.map((item) => [item.media_item_id, item]))
        : null,
    [media.data],
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;

    // Each service publishes its response independently; one failing leaves the
    // other parts and any previously retained response visible.
    await Promise.allSettled([
      DigestService.getDailyDigest(),
      DigestService.getWeeklyDigest(),
      MediaService.listMedia({ limit: LIBRARY_PAGE_SIZE }),
    ]);
  }, [isAuthenticated]);

  // Deferred by a tick: a `setState` reached synchronously from an effect
  // cascades a render, and the lint rule that says so is on.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => void load(), 0);
      return () => clearTimeout(timer);
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const openPeriod = useCallback(
    (period: DigestPeriod) => {
      router.push({ pathname: "/(tabs)/digest/[period]", params: { period } });
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t("tabs.digest")}
        </Text>
      </View>

      {/* The insets are this screen's own business: the packs share the height
          left above the tab bar, which an automatic inset would count twice.
          `never` is also what the tab bar leaves alone here — its walk down the
          first-subview chain dead-ends in the title above, before any scroll
          view (`RNSScrollViewFinder`). */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={Colors.primary}
          />
        }
      >
        {PERIODS.map((period) => (
          <DigestCoverStack
            key={period}
            label={period === "daily" ? t("digest.daily") : t("digest.weekly")}
            mediaItemIds={periodMedia[period]}
            library={library}
            onPress={() => openPeriod(period)}
            testID={`digest-stack-${period}`}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
    },
    title: {
      ...Typography.display,
      color: Colors.textMain,
    },
    scroll: {
      flex: 1,
    },
    // `flexGrow` so the two packs fill the height down to the tab bar between
    // them; past that height the content scrolls instead of clipping.
    content: {
      flexGrow: 1,
      gap: Spacing.xl,
      paddingTop: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingBottom: TAB_BAR_CLEARANCE,
    },
  });
