/**
 * "L'essentiel": what a source is about, above its full text on the Reader tab.
 *
 * The content is the triage card of the internal `review_blurb` artifact
 * (task-323), mirrored on the library row and served by
 * `GET /api/media/{id}`. Until task-363 the only surface that read it was the
 * unsorted-review screen, so the answer to "what is in here again?" disappeared
 * the moment an item was sorted — which is precisely when it is asked.
 *
 * Drawn as the *Callout Aside* of Amber Clarity — the 4pt amber bar on the 5%
 * amber wash, the system's editorial "pull quote" — under a small "L'essentiel"
 * label (task-411: the owner's pick for the Reader tab is direction C of the
 * task-410 benchmark, with this block taken from its direction A). It replaced
 * the "Aperçu" heading over a grey card: the block is the lede of the page, not
 * one more section of it.
 *
 * Rendering only: the owning screen holds the state and the bounded poll that
 * resolves the waiting state, the same split `TranscriptReader` already uses.
 *
 * The block is always present, in all three states. A preview being generated
 * and a preview that will never exist look identical from the content alone
 * (both are a null blurb), so the status travels with it and the two get
 * different, honest lines instead of a block that silently vanishes. The
 * waiting line is the one that has to be earned: it is the only state that makes
 * a promise, so it is drawn only when the status actually makes that promise.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Bullets } from "./Bullets";
import {
  BorderRadius,
  Spacing,
  Typography,
  type Theme,
} from "../constants/theme";
import { useThemeColors, useThemedStyles } from "../contexts/ThemeContext";
import { t } from "../i18n";
import type { MediaItemContract } from "../types/media";

/**
 * What the block renders, once content and status have been reconciled.
 *
 * `unavailable` is one state for every way of not having a preview — the
 * generation failed, it was lost, or the wait ran out — because they read the
 * same to someone looking at the page: there is nothing here, and nothing is
 * coming. What is *not* among them is a fourth, silent state where the block
 * waits with nothing behind it.
 */
export type SourcePreviewState =
  | { status: "ready"; hook: string; points: string[] }
  | { status: "pending" }
  | { status: "unavailable" };

/**
 * Reconciles the two contract fields into the one thing the block draws.
 *
 * Content wins: a blurb with a hook is a preview, whatever the artifact entry
 * says about itself.
 *
 * Without content, the wait has to be *claimed*. The two fields are separate
 * sources of truth — the blurb is a mirror on the library row, the status is
 * read off the internal artifact entry — so they can disagree, and `ready` with
 * no hook is precisely that disagreement: the generation is over and the mirror
 * was never written, so no amount of waiting will produce one. Defaulting to
 * `pending` turned that into a spinner that outlived the item by days, which is
 * what a build-9 tester saw on articles saved the previous morning.
 *
 * So only an explicit `pending` waits. `failed`, the incoherent `ready`, and any
 * value outside the union all land on the terminal line — an unknown status is
 * not a promise either.
 */
export function resolveSourcePreviewState(
  item: Pick<MediaItemContract, "review_blurb" | "review_blurb_status">,
): SourcePreviewState {
  const hook = item.review_blurb?.hook?.trim() ?? "";
  const points = (item.review_blurb?.points ?? [])
    .map((point) => point.trim())
    .filter(Boolean);

  if (hook) {
    return { status: "ready", hook, points };
  }
  return item.review_blurb_status === "pending"
    ? { status: "pending" }
    : { status: "unavailable" };
}

export function SourcePreview({
  state,
}: {
  state: SourcePreviewState;
}): React.JSX.Element {
  const Colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.callout}>
      {/* A header for screen readers: after the tabs, it is the next landmark
          on the page, then "Full text". */}
      <Text style={styles.label} accessibilityRole="header">
        {t("preview.essentials")}
      </Text>
      {state.status === "ready" ? (
        <>
          <Text style={styles.hook}>{state.hook}</Text>
          {/* The same bullets the triage card draws. One bullet style in the
              app, and it lives in `Bullets`. */}
          {state.points.length > 0 ? <Bullets items={state.points} /> : null}
        </>
      ) : state.status === "pending" ? (
        <View style={styles.statusRow}>
          <ActivityIndicator
            size="small"
            color={Colors.primary}
            style={styles.statusGlyph}
          />
          <Text style={styles.statusText}>{t("preview.pending")}</Text>
        </View>
      ) : (
        /* No button: the generation is internal and `POST /api/artifacts`
           refuses this type outright, so there is nothing here a tap could
           ask for. Leaving the screen and coming back re-reads the item, which
           is what picks up a preview that landed late. A calm line, and the
           full text below is untouched — the preview was never what the reader
           came for. */
        <View style={styles.statusRow}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={Colors.textMuted}
            style={styles.statusGlyph}
          />
          <Text style={styles.statusText}>{t("preview.unavailable")}</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = ({ colors: Colors }: Theme) =>
  StyleSheet.create({
    /**
     * The Callout Aside. The amber bar sits on the *start* edge, so it moves to
     * the right in Arabic along with the text it introduces; only the two corners
     * away from it are rounded. The bar is the one stroke of the page, and it is
     * the design system's own component rather than a divider ("No-Line" rule).
     *
     * The gap to the full text is the block's own: the Reader tab stacks the two
     * directly, and only this one knows how much air it needs under itself.
     */
    callout: {
      borderStartWidth: Spacing.xs,
      borderStartColor: Colors.primary,
      backgroundColor: Colors.primaryTint,
      borderTopEndRadius: BorderRadius.md,
      borderBottomEndRadius: BorderRadius.md,
      padding: Spacing.md,
      gap: Spacing.sm,
      marginBottom: Spacing.xl,
    },
    // `textSubtle`, not `textMuted`: a label to read, at 5.2:1 on the amber wash.
    // The letter spacing is the one every small-caps label of the app uses.
    label: {
      fontSize: Typography.small.fontSize,
      fontWeight: Typography.label.fontWeight,
      color: Colors.textSubtle,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    // Body size, headline weight: the hook is a sentence to read, not a title, but
    // it has to lead the bullets under it. Both values are tokens.
    hook: {
      fontSize: Typography.body.fontSize,
      fontWeight: Typography.headline.fontWeight,
      color: Colors.textMain,
      lineHeight: Typography.body.lineHeight,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    statusGlyph: {
      marginEnd: Spacing.sm,
    },
    statusText: {
      flex: 1,
      fontSize: Typography.body.fontSize,
      color: Colors.textSubtle,
      lineHeight: Typography.body.lineHeight,
    },
  });
