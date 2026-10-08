/**
 * Design system tokens from "Amber Clarity" design system.
 * Source: mobile-design-mockups/my_design_system/DESIGN.md
 *
 * Two kinds of token live here, and the split is the whole structure of this
 * file:
 *
 * - **Mode-dependent tokens** — colours and shadows. They come in a `light` and
 *   a `dark` variant, bundled into the `Theme` objects at the bottom, and are
 *   only ever read through `ThemeContext` (`useThemeColors`, `useThemedStyles`).
 *   There is deliberately no static `Colors` export: a module-level import would
 *   freeze whichever palette happened to be bundled, which is exactly the bug
 *   the dark theme exists to fix. See `src/contexts/ThemeContext.tsx`.
 * - **Mode-invariant tokens** — `Typography`, `Spacing`, `BorderRadius`,
 *   `TouchTarget`. A 16px gutter is a 16px gutter at night, so these keep their
 *   plain static exports and are imported directly everywhere.
 *
 * The measured contrast of every text/background pair of the dark palette is in
 * `mobile/docs/DARK_THEME_CONTRAST.md`.
 */

import type { ViewStyle } from "react-native";

/**
 * The light palette — "The Illuminated Archive" by day, and the reference
 * variant: `ThemeColors` is derived from its keys, so a token added here is a
 * `tsc` error until the dark palette defines it too.
 */
const lightColors = {
  primary: "#ffcb05",
  onPrimary: "#1c1b1a",
  /**
   * The amber wash the system prescribes for a tinted surface — "Signature
   * Textures: Use a 5% opacity tint of the Primary color (Amber) for callouts
   * and blockquotes to create a 'highlighted' tactile feel".
   *
   * It is a token because the one place that used it wrote the value inline, and
   * at 10% rather than the prescribed 5% (the Home unsorted-review card, before
   * task-362). A tint of the primary belongs beside the primary it derives from,
   * not in one screen's `StyleSheet`.
   */
  primaryTint: "rgba(255, 203, 5, 0.05)",

  background: "#fcf9f6",
  surface: "#ffffff",
  surfaceContainer: "#f1edea",
  surfaceContainerHigh: "#ebe7e5",
  surfaceContainerLow: "#f7f3f0",

  textMain: "#2b2d42",
  textMuted: "#8d99ae",
  /**
   * Secondary text that still has to be *read*, not merely glanced at.
   *
   * `textMuted` measures 2.75:1 on `background` and 2.88:1 on `surface`, well
   * under the 4.5:1 WCAG AA asks for below 18.66px — which made every small
   * grey line on the paywall (the per-import ceiling, the whole legal block, the
   * close button) formally unreadable. This is the same blue-grey hue darkened
   * to 5.3:1 on `background` and 5.6:1 on `surface`.
   *
   * `textMuted` is kept for what it is genuinely good at — inactive icons, tab
   * bar glyphs, decoration — and the two are not interchangeable: anything the
   * user has to read uses this one. Generalising the swap to the rest of the app
   * is a design-system pass of its own.
   */
  textSubtle: "#5c6880",

  outline: "#78776f",
  outlineVariant: "#c8c7bd",

  /**
   * Tint of the default folder wherever it is listed, so it reads as a system
   * container and not as one more user folder.
   *
   * The olive-grey `outline` tone instead of the amber accent, which DESIGN.md
   * reserves for "high-value interactions (CTAs, active states) and meaningful
   * accents" -- a catch-all bin is none of those. `textMuted` was the other
   * candidate but falls under the 3:1 that WCAG 1.4.11 asks of a non-text
   * graphic (2.9:1 on `surface`); `outline` clears it on every system surface.
   *
   * A named alias of `outline` rather than three screens reading `outline`
   * directly, because the reasoning above is what has to survive: it moved here
   * from `lib/folderTree.ts`, which could not hold it once the value had to
   * depend on the mode — a module constant is read at import time, before any
   * theme exists.
   */
  defaultFolderTint: "#78776f",

  /** Background of a search match inside a snippet */
  highlight: "#fff0b3",
  onHighlight: "#1c1b1a",

  /**
   * The sheer white of the band that sweeps a cover still being processed
   * (`MediaProcessingSweep`, task-402, variant B "Balayage flou").
   *
   * White at 40 %, the value the task-401 mockup settled on. It is a token and
   * not an inline literal for the reason `primaryTint` is one: a translucent
   * material belongs beside the palette it is made of. Deliberately sheer — the
   * chosen variant lets the picture stay readable underneath rather than hiding
   * it behind an opaque skeleton, because a personal photo's cover is already
   * the final content while its metadata is still resolving.
   */
  processingVeil: "rgba(255, 255, 255, 0.4)",

  /**
   * The fill of a strip of text laid over a media's cover — the title band of
   * `MediaDetailHero`, the caption of `DigestCoverStack`.
   *
   * `background` at 72 %, the value the task-410 mockup gives the band
   * (`direction_c_bandeau_retractable`: `background: rgba(252, 249, 246, 0.72)`
   * under a `backdrop-filter`). It is a token for the reason `processingVeil` is
   * one: a translucent material belongs beside the palette it is made of, and
   * two components draw the same strip.
   *
   * It is the **contrast floor** of those strips, and it is painted over the
   * `GlassSurface` material rather than under it — the order CSS gives a
   * `background` over a `backdrop-filter`. Over it, no matter what the material
   * below resolves to, `textMain` measures 6.5:1 against a black cover and
   * 13.0:1 against a white one, so text sits above 4.5:1 on any picture. That is
   * what the material alone cannot promise: Liquid Glass adapts to what it
   * covers and a photograph can leave it drawing close to nothing, which is the
   * degradation the task-410 benchmark predicted for this direction
   * ("lisibilité du titre dépendante du matériau sur iOS").
   *
   * 72 % is also the ceiling on legibility here: `textSubtle` only reaches
   * 2.7:1 against a black cover through it, which is why a strip on a cover
   * writes its small-caps line in `textMain` and keeps `textSubtle` for the same
   * line drawn on the page.
   */
  coverTitleVeil: "rgba(252, 249, 246, 0.72)",

  /**
   * The solid ink of the gradient scrim drawn over a *photograph* — the strips
   * `MediaDetailHero` stacks under the status bar, each at its own opacity.
   *
   * Mode-invariant, and that is the whole point of giving it a name: it exists
   * to darken a picture so the light status-bar glyphs over it stay legible, and
   * a picture is a picture at any hour. It used to be `textMain`, which was a
   * near-black only by accident of the light palette — on the dark one that same
   * token is a warm off-white, and the scrim would have *brightened* the top of
   * every cover.
   */
  coverScrimInk: "#1c1b1a",

  /**
   * The dimming layer behind a centred dialog — the rename, URL-entry and
   * folder-save sheets, and the context menu's backdrop.
   *
   * `textMain` at 35 %, which is what all four of them wrote inline before the
   * dark theme needed them to move: a scrim that stays warm ink rather than
   * going flat black is what keeps the page visible underneath instead of
   * erasing it, and a scrim is the one thing in the app whose value *has* to
   * flip with the mode (dimming a dark page with dark-blue ink does nothing).
   */
  scrim: "rgba(43, 45, 66, 0.35)",

  /**
   * The opaque stand-in `GlassSurface` falls back to where no blur can be drawn
   * — every Android device, and iOS under "reduce transparency".
   *
   * `background` at 92 %: opaque enough that the surface stays legible with no
   * blur under it at all, sheer enough to still read as a material. It moved out
   * of that component's `StyleSheet` for the dark theme, which is also what
   * answers the comment it used to carry ("the design system has no token for a
   * partially transparent background"): it has one now, because the value
   * depends on the mode and a mode-dependent value cannot live in a module
   * constant.
   */
  glassFallback: "rgba(252, 249, 246, 0.92)",

  /**
   * The fill of the SHORT media-type badge, and the palette's one filled tone
   * taken from its blue-grey *ink* family (task-435).
   *
   * A short video used to share the red `errorContainer` with a YouTube video,
   * so the two pills were the same colour and the same glyph and only the word
   * differed — nothing to find in a scrolling list. It needed a fourth family,
   * since the first three are spoken for: amber for a podcast, red for a video,
   * the tonal containers for everything that is read.
   *
   * It is the **mirror of the video red on the ink hue**, which is what keeps it
   * inside Amber Clarity rather than importing a foreign accent. Its Lab hue is
   * 271.2°, that of `textMuted` (271.3°) and its family `textSubtle` (275.2°) —
   * the olive-and-blue-grey "secondary tones [that] ground the interface" the
   * system prescribes beside the amber. Its lightness and chroma are
   * `errorContainer`'s to within a rounding step (L\* 90.3 vs 90.0, C\* 13.7 vs
   * 13.9), so the SHORT pill weighs exactly what the VIDEO pill weighs and the
   * row's chromatic balance is unchanged — only the hue moves.
   *
   * Pairs with `textMain`, like the red and the tonal fills and unlike the
   * amber: **10.52:1** here (`errorContainer` gives 10.44), **7.86:1** on the
   * dark variant. Both clear AA for the badge's 13px, in both modes.
   */
  shortVideoContainer: "#d6e4fd",

  error: "#ba1a1a",
  onError: "#ffffff",
  errorContainer: "#ffdad6",
  /**
   * The destructive counterpart of `primaryTint`: the wash behind the icon of a
   * row that deletes something (Sign Out, Delete Account).
   *
   * Same alpha as `primaryTint` would give, and it exists for the same reason —
   * the Account menu wrote `rgba(186, 26, 26, 0.1)` inline, which no mode switch
   * can reach.
   */
  errorTint: "rgba(186, 26, 26, 0.1)",

  // Tab bar
  tabActive: "#ffcb05",
  tabInactive: "#8d99ae",
} as const;

/**
 * Every mode-dependent colour token, derived from the light palette.
 *
 * This is what makes "no token exists on one side only" a compile-time fact
 * rather than a review item: `darkColors` is annotated with it, so a key missing
 * from the dark palette fails `tsc` and a key only the dark palette has is an
 * excess-property error.
 */
export type ThemeColors = {
  readonly [K in keyof typeof lightColors]: string;
};

/**
 * The dark palette — "The Illuminated Archive" after dark.
 *
 * It is a re-derivation of the system's rules on a dark canvas, not an
 * inversion of the light values. Four decisions carry it:
 *
 * 1. **The base stays warm.** The light base is a warm neutral (`#fcf9f6`)
 *    chosen to reduce eye strain; the dark base keeps the same hue bias
 *    (≈40°, very low chroma) instead of going blue-black or pure black. Pure
 *    black was rejected on purpose: it makes the amber bloom and it kills the
 *    tonal steps the "No-Line" rule depends on, since there is nothing below
 *    `#000` to put a container on.
 * 2. **Elevation changes direction, not meaning.** In the light palette each
 *    container tier departs *downward* from `surface` (L\* 100 → 96.1 → 94.0 →
 *    91.9). Here each tier departs *upward* (L\* 11.4 → 13.9 → 17.2 → 21.4),
 *    with `surface` still lifted off `background` the way white is lifted off
 *    `#fcf9f6`. So `surfaceContainerHigh` is still "furthest from the canvas",
 *    which is all any call site ever assumed.
 * 3. **The amber is lamplight, not a highlighter.** `#ffcb05` at full chroma on
 *    a dark field blooms, and the accent is used as large fills (the paywall
 *    CTA, the subscription disc). The dark primary pulls the chroma back ~12 %
 *    and the value ~6 % at the same hue: it reads as a lit lamp in an archive
 *    rather than as a marker stroke, keeps `onPrimary` at 10.0:1 on an amber
 *    fill, and — unlike the light amber, which measures 1.45:1 on `background`
 *    and is therefore only ever safe *behind* dark text — reaches 9.6:1 on
 *    `surface`, so an amber glyph is legible here in its own right.
 * 4. **A pair that must be read clears AA on both sides.** `textMuted` is the
 *    light palette's known debt (2.75:1 on `background`, which is why
 *    `textSubtle` had to be invented). The dark palette is being born now, so it
 *    is born without that debt: `textMuted` measures 4.95:1 at its worst
 *    (`surfaceContainerHigh`) and `textSubtle` 7.85:1, which also means the two
 *    keep their distinct roles — `textSubtle` is still the stronger of the two,
 *    reached by *lightening* rather than darkening, since contrast runs the
 *    other way on a dark ground.
 *
 * Every ratio, per pair, is tabulated in `mobile/docs/DARK_THEME_CONTRAST.md`.
 */
const darkColors: ThemeColors = {
  primary: "#f0bf2a",
  // Unchanged: the amber fill is light in both modes, so what goes on it is
  // dark in both modes. A token is allowed to be mode-invariant in value; what
  // it is not allowed to be is absent.
  onPrimary: "#1c1b1a",
  // The same 5 % the system prescribes, and the effect is deliberately *not*
  // identical: over white, 5 % amber moves the surface by 1.0 L*; over `surface`
  // the same alpha moves it by 3.9, because lightness is steep near black. The
  // number is kept anyway because nothing lower survives an 8-bit channel —
  // 2 % over `#211e19` rounds to a one-step shift in a single channel — so 5 %
  // is the floor at which a tint exists at all on this ground, not a value
  // tuned upward.
  primaryTint: "rgba(240, 191, 42, 0.05)",

  background: "#171511",
  surface: "#211e19",
  surfaceContainer: "#2d2a25",
  surfaceContainerHigh: "#37332c",
  surfaceContainerLow: "#262320",

  // Not pure white, for the reason DESIGN.md gives for not using pure black:
  // the "soft, ink-on-paper feel". A warm off-white at 14.0:1 on `surface`.
  textMain: "#f1ebe1",
  textMuted: "#9aa3b4",
  textSubtle: "#c6cdd9",

  // Lightened to clear the 3:1 WCAG 1.4.11 asks of a non-text graphic on every
  // dark surface (5.1:1 at worst), which is what `outline` is for here — the
  // default folder's tint, chip strokes, inactive glyph shapes.
  outline: "#a8a69a",
  defaultFolderTint: "#a8a69a",
  // A divider on a dark ground is a *lighter* line, not a darker one. It sits
  // +12.7 L* above `surface` where the light `#c8c7bd` sits -19.9 below
  // `#ffffff`: a smaller step, because a light line on a dark ground reads more
  // strongly than the reverse at one `hairlineWidth`.
  outlineVariant: "#3d3932",

  // The marker metaphor survives the mode switch, but it changes polarity: a
  // pale `#fff0b3` band would flash in a dark list of snippets, so the match
  // becomes a deep amber block carrying bright amber-tinted text (7.2:1).
  highlight: "#5c4a12",
  onHighlight: "#ffe9a8",

  // Still white, because a sheen has to be lighter than what it sweeps — but at
  // 22 % rather than 40 %: the band passes over a photograph on a dark page,
  // where 40 % white reads as a flash rather than as a sheen on paper.
  processingVeil: "rgba(255, 255, 255, 0.22)",
  // The contrast floor over a cover, flipped: a dark veil with the light
  // `textMain` over it. It holds at both extremes of what a photograph can be —
  // 16.1:1 over a black cover, 6.1:1 over a white one — so text on a picture
  // stays above 4.5:1 here as it does in the light palette. It also lifts the
  // light palette's ceiling: `textSubtle` reaches 4.5:1 through this veil at
  // worst, where through the light one it bottomed out at 2.7:1.
  coverTitleVeil: "rgba(23, 21, 17, 0.72)",

  // Unchanged, like `onPrimary`: what darkens a photograph cannot depend on the
  // mode, because the photograph does not.
  coverScrimInk: "#1c1b1a",

  // Flat black, and this is the one place the warm-base rule is deliberately
  // broken: ink-coloured dimming over an already dark page is invisible, so the
  // scrim has to reach below the darkest surface the app can draw.
  scrim: "rgba(0, 0, 0, 0.6)",
  glassFallback: "rgba(33, 30, 25, 0.92)",

  // Same mirror as in the light palette, re-derived rather than inverted: the
  // ink hue (271.3°, `textMuted`'s own) at the lightness of the dark
  // `errorContainer` (L* 30.1 vs 30.0), so SHORT and VIDEO stay twins by weight
  // at night too, and `textMain` measures 7.86:1 on it where it measures 7.89 on
  // the red.
  //
  // The chroma is the one number that is *not* matched: 29.8 against the deep
  // red's 66.3. That is rule 3 of this palette applied to a second hue — a fully
  // saturated navy on a warm dark canvas reads as borrowed system chrome, where a
  // slate blue reads as ink in an archive. sRGB could reach past 50 here; the
  // restraint is deliberate, not a gamut limit.
  shortVideoContainer: "#1a4975",

  // `#ba1a1a` measures 1.8:1 on `background` — unreadable, not merely weak — so
  // the error family inverts wholesale: a light red carrying dark text (7.7:1),
  // with the deep red kept for the filled container.
  error: "#ffb4ab",
  onError: "#690005",
  errorContainer: "#93000a",
  // 8 % rather than the light variant's 10 %, which is the alpha that matches
  // its *step*: 10 % of a dark red over white costs 6.8 L*, and 8 % of a light
  // red over `surface` buys 6.5.
  errorTint: "rgba(255, 180, 171, 0.08)",

  tabActive: "#f0bf2a",
  tabInactive: "#9aa3b4",
};

/**
 * The light elevation: "Ambient Shadows … nearly imperceptible but provides
 * just enough lift to separate interactive layers from content"
 * (`0 8px 24px rgba(43, 45, 66, 0.04)`).
 */
const lightShadows = {
  soft: {
    shadowColor: "#2b2d42",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
} as const;

/** Derived from the light variant, for the reason `ThemeColors` is. */
export type ThemeShadows = {
  readonly [K in keyof typeof lightShadows]: ViewStyle;
};

/**
 * The dark elevation: same geometry, different ink.
 *
 * A 4 % blue-grey shadow on a dark canvas is mathematically invisible, so the
 * ink goes to black at an opacity that still registers. The offset and the 24px
 * radius are untouched, which is what keeps "soft and atmospheric, prioritizing
 * layering over hard shadows" true in both modes — and the real work of
 * separating layers is done by the `surfaceContainer` tiers, exactly as
 * DESIGN.md's layering principle asks.
 */
const darkShadows: ThemeShadows = {
  soft: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 2,
  },
};

/** Which of the two palettes is being drawn. Never the user's *choice* — that is `ThemePreference`. */
export type ThemeMode = "light" | "dark";

/** Everything a style sheet needs that depends on the mode, and nothing that does not. */
export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  shadows: ThemeShadows;
}

export const lightTheme: Theme = {
  mode: "light",
  colors: lightColors,
  shadows: lightShadows,
};

export const darkTheme: Theme = {
  mode: "dark",
  colors: darkColors,
  shadows: darkShadows,
};

export const THEMES: Record<ThemeMode, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};

export const Typography = {
  display: {
    fontSize: 32,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 25.6, // 1.6x
  },
  label: {
    fontSize: 14,
    fontWeight: "500" as const,
  },
  small: {
    fontSize: 13,
    fontWeight: "400" as const,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/**
 * Touch target size constraints per platform accessibility guidelines.
 * iOS: minimum 44pt, Android: minimum 48dp.
 * We use 48px as the floor for both platforms (AC#2).
 */
export const TouchTarget = {
  /** Absolute minimum for any interactive element (48px) */
  minimum: 48,
  /** Comfortable touch target for primary actions (56px) */
  comfortable: 56,
  /** Large touch target for hero/CTA buttons (64px) */
  large: 64,
} as const;
