# Dark theme contrast — measured pairs

The measured contrast of the dark palette of `mobile/src/constants/theme.ts`
(task-433). Every number here is a WCAG 2.1 contrast ratio computed from sRGB
relative luminance:

```
C = srgb(c/255) = c/255 ≤ 0.03928 ? (c/255)/12.92 : ((c/255 + 0.055)/1.055)^2.4
Y = 0.2126·C(R) + 0.7152·C(G) + 0.0722·C(B)
ratio = (Y_lighter + 0.05) / (Y_darker + 0.05)
```

Translucent tokens are resolved first (`alpha·fg + (1−alpha)·bg`) and the
resulting opaque colour is the one measured — a ratio against an `rgba()` value
is meaningless. `L*` is CIE lightness, used where the question is "is this step
visible?" rather than "is this text readable?".

## Thresholds this palette is held to

| Case | Threshold | Source |
| --- | --- | --- |
| Text below 18.66px (every size in `Typography`) | **4.5:1** | WCAG 2.1 SC 1.4.3 (AA) |
| Non-text graphic that carries meaning (`outline`, `defaultFolderTint`, glyph shapes) | **3:1** | WCAG 2.1 SC 1.4.11 |
| Text laid over a photograph, through a veil | **4.5:1 at both extremes** (a black cover and a white one) | 1.4.3, applied to the worst case the content can produce |

AAA (7:1) is **not** a target. It is cleared anyway by most pairs below, which
is a consequence of a dark ground, not a goal.

## Surfaces

The tonal ladder, with the light palette beside it. Note the direction: in the
light palette each container tier departs *downward* from `surface`; here each
departs *upward*, while `surface` stays lifted off `background` in both.

| Token | Dark | Dark L\* | Light | Light L\* |
| --- | --- | --- | --- | --- |
| `background` | `#171511` | 6.9 | `#fcf9f6` | 98.1 |
| `surface` | `#211e19` | 11.4 | `#ffffff` | 100.0 |
| `surfaceContainerLow` | `#262320` | 13.9 | `#f7f3f0` | 96.1 |
| `surfaceContainer` | `#2d2a25` | 17.2 | `#f1edea` | 94.0 |
| `surfaceContainerHigh` | `#37332c` | 21.4 | `#ebe7e5` | 91.9 |

## Every foreground on every surface

Threshold 4.5:1 for the text rows, 3:1 for `outline` / `defaultFolderTint`.
The last column is the same foreground's *worst* ratio in the light palette, for
comparison only.

| Foreground | `background` | `surface` | `…Low` | `…Container` | `…High` | worst | light worst |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `textMain` `#f1ebe1` | 15.38 | 14.01 | 13.18 | 12.05 | 10.59 | **10.59** ✅ | 10.98 |
| `textSubtle` `#c6cdd9` | 11.40 | 10.39 | 9.78 | 8.94 | 7.85 | **7.85** ✅ | 4.56 |
| `textMuted` `#9aa3b4` | 7.18 | 6.54 | 6.16 | 5.63 | 4.95 | **4.95** ✅ | 2.34 ❌ |
| `primary` `#f0bf2a` | 10.58 | 9.64 | 9.07 | 8.30 | 7.29 | **7.29** ✅ | 1.24 ❌ |
| `outline` / `defaultFolderTint` `#a8a69a` | 7.45 | 6.79 | 6.39 | 5.84 | 5.13 | **5.13** ✅ (3:1) | 3.66 |
| `error` `#ffb4ab` | 10.74 | 9.78 | 9.20 | 8.42 | 7.40 | **7.40** ✅ | 5.26 |

Two of those light-palette columns are failures, and both are deliberately not
reproduced here:

- **`textMuted` at 2.34:1** is the debt that forced `textSubtle` into existence
  (see its comment in `theme.ts`). The dark variant clears AA on all five
  surfaces, so the two tokens keep their distinct *roles* without one of them
  being formally unreadable.
- **`primary` at 1.24:1** means the light amber is never legible as a glyph or a
  word — it is only ever safe as a *fill* with `onPrimary` on top. The dark amber
  reaches 7.29:1 at worst, so an amber icon is readable here in its own right.
  This is why the dark primary was deepened rather than kept at `#ffcb05`: the
  value that makes it legible is also the value that stops it blooming.

## Paired tokens (`onX` on `X`)

| Pair | Dark | Light | Threshold |
| --- | --- | --- | --- |
| `onPrimary` `#1c1b1a` on `primary` `#f0bf2a` | 9.98 ✅ | 11.30 | 4.5:1 |
| `onHighlight` `#ffe9a8` on `highlight` `#5c4a12` | 7.15 ✅ | 15.04 | 4.5:1 |
| `onError` `#690005` on `error` `#ffb4ab` | 7.72 ✅ | 6.46 | 4.5:1 |
| `textMain` on `errorContainer` `#93000a` | 7.89 ✅ | 10.44 | 4.5:1 |
| `textMain` on `shortVideoContainer` `#1a4975` | 7.86 ✅ | 10.52 | 4.5:1 |

The highlight pair inverts polarity between the modes: a pale `#fff0b3` band
carrying dark text by day, a deep amber block carrying bright text by night.
A pale band in a dark list of search snippets flashes.

`highlight` has a second role beyond the search match — the paywall's
alert-tone box and its selected tier card use it as a surface, with the ordinary
text tokens on top rather than `onHighlight`. Both clear AA in both modes:

| Pair | Dark | Light | Threshold |
| --- | --- | --- | --- |
| `textMain` on `highlight` | 7.25 ✅ | 11.80 | 4.5:1 |
| `textSubtle` on `highlight` | 5.38 ✅ | 4.90 | 4.5:1 |

### `shortVideoContainer`, the video red mirrored on the ink hue

The SHORT media-type badge needed a fill no other type uses (task-435), and it
was built by moving `errorContainer` — the VIDEO fill — onto the blue-grey hue
of the palette's ink family, keeping its weight. `L*`/`C*`/`h` are CIE LCh:

| Token | Mode | `L*` | `C*` | `h` |
| --- | --- | --- | --- | --- |
| `shortVideoContainer` `#d6e4fd` | light | 90.3 | 13.7 | 271.2° |
| `errorContainer` `#ffdad6` | light | 90.0 | 13.9 | 28.8° |
| `textMuted` `#8d99ae` (the hue it borrows) | light | 62.9 | 12.4 | 271.3° |
| `shortVideoContainer` `#1a4975` | dark | 30.1 | 29.8 | 271.3° |
| `errorContainer` `#93000a` | dark | 30.0 | 66.3 | 36.5° |
| `textMuted` `#9aa3b4` | dark | 66.8 | 9.9 | 272.1° |

Lightness and hue are matched on purpose, chroma only in the light mode:

- **Equal `L*`** is what makes the two pills read as peers rather than as two
  strengths of one colour, and it is why no other badge had to move.
- **The borrowed hue** is `textMuted`'s to within 0.1°, so the fourth family is
  one Amber Clarity already owns — the olive-and-blue-grey secondary tones — and
  not an imported accent.
- **Chroma is pulled back at night** (29.8 against the deep red's 66.3, where
  sRGB would allow past 50 at this lightness). Same reasoning as decision 3 of
  the dark palette: a fully saturated navy on a warm dark canvas reads as
  borrowed system chrome.

Separation from the fills it sits beside, as ΔE (CIE76), well past the ~10 at
which two surfaces are told apart at a glance:

| Pair | Dark ΔE | Light ΔE |
| --- | --- | --- |
| `shortVideoContainer` vs `errorContainer` (VIDEO) | 87.0 | 23.6 |
| `shortVideoContainer` vs `primary` (PODCAST) | 115.3 | 98.6 |
| `shortVideoContainer` vs `surfaceContainerHigh` (every other type) | 35.9 | 15.2 |

## Text over a photograph, through a veil

`coverTitleVeil` is the contrast *floor* of the strips laid over a media's cover
(`MediaDetailHero`'s title band, `DigestCoverStack`'s caption). It is painted
over the `GlassSurface` material, so these numbers hold whatever the material
below resolves to. Both extremes of what a photograph can be are measured.

| Veil over | Resolves to | `textMain` | `textSubtle` |
| --- | --- | --- | --- |
| dark `coverTitleVeil` `rgba(23,21,17,0.72)` over a black cover | `#110f0c` | 16.14 ✅ | 11.97 ✅ |
| dark `coverTitleVeil` over a white cover | `#585754` | **6.09** ✅ | **4.52** ✅ |
| light `coverTitleVeil` `rgba(252,249,246,0.72)` over a black cover | `#b5b3b1` | 6.45 ✅ | 2.68 ❌ |
| light `coverTitleVeil` over a white cover | `#fdfbf9` | 13.07 ✅ | 5.43 ✅ |

The dark veil is the better of the two: it lifts the light palette's ceiling,
where `textSubtle` bottomed out at 2.68:1 and forced those strips to write their
small-caps line in `textMain`. It still only reaches 4.52:1, so the rule stays
the same in both modes — a strip on a cover writes in `textMain`.

`glassFallback` is the opaque stand-in `GlassSurface` uses where no blur can be
drawn (Android, and iOS under "reduce transparency"):

| Veil over | Resolves to | `textMain` | `textSubtle` |
| --- | --- | --- | --- |
| dark `glassFallback` `rgba(33,30,25,0.92)` over black | `#1e1c17` | 14.36 ✅ | 10.65 ✅ |
| dark `glassFallback` over white | `#33302b` | 11.08 ✅ | 8.22 ✅ |

## Translucent tokens that are not text backgrounds

These answer "is the step visible?", not "is the text readable?", so they are
given in `L*` against the `surface` they sit on (`L* 11.4` dark, `100.0` light).

| Token | Dark | Resolves to | ΔL\* | Light | ΔL\* |
| --- | --- | --- | --- | --- | --- |
| `primaryTint` | `rgba(240,191,42,0.05)` | `#2b261a` | +3.9 | `rgba(255,203,5,0.05)` → `#fffcf3` | −1.0 |
| `errorTint` | `rgba(255,180,171,0.08)` | `#332a25` | +6.5 | `rgba(186,26,26,0.1)` → `#f8e8e8` | −6.8 |
| `outlineVariant` (hairline divider) | `#3d3932` | — | +12.7 | `#c8c7bd` | −19.9 |
| `scrim` (over `surface`) | `rgba(0,0,0,0.6)` | `#0d0c0a` | −8.1 | `rgba(43,45,66,0.35)` → `#b5b6bd` | −25.8 |
| `processingVeil` (over a mid-grey `#808080` cover) | `rgba(255,255,255,0.22)` | `#9c9c9c` | +10.8 | `rgba(255,255,255,0.4)` → `#b3b3b3` | +19.4 |

Notes on the three that are not a straight translation of the light value:

- **`primaryTint` keeps the prescribed 5 %** even though 5 % buys ×3.9 more
  lightness on a dark ground than on paper. Nothing lower survives an 8-bit
  channel: 2 % over `#211e19` rounds to a one-step shift in one channel. 5 % is
  the floor at which a tint exists at all here, not a value tuned upward.
  An amber glyph on it still measures 8.74:1.
- **`errorTint` drops to 8 %**, the alpha that matches the light variant's
  *step* (−6.8 L\* against +6.5 here) rather than its number. An error glyph on
  it measures 8.25:1.
- **`scrim` goes flat black**, the one place the warm-base rule is broken on
  purpose: ink-coloured dimming over an already dark page is invisible, so the
  scrim has to reach below the darkest surface the app can draw.

## Call sites the dark palette forced to change

Six places were drawing a token that is only a near-black, or only a
near-white, *in the light palette*. Each had a correct-looking ratio by day and
an unreadable one at night, and each was repaired with a token that flips (or
deliberately does not) rather than with a literal.

| Site | Was | Measured dark | Now | Measured dark |
| --- | --- | --- | --- | --- |
| `MediaListCard` media-type badge, podcast (amber fill) | `textMain` | 1.45 ❌ | `onPrimary` | 9.98 ✅ |
| `app/media/[id].tsx` retry button label (amber fill) | `textMain` | 1.45 ❌ | `onPrimary` | 9.98 ✅ |
| `ArtifactTile` generate button label (amber fill) | `textMain` | 1.45 ❌ | `onPrimary` | 9.98 ✅ |
| `artifacts/[artifactId]` correct quiz option, row text (amber fill) | `textMain` | 1.45 ❌ | `onPrimary` | 9.98 ✅ |
| `artifacts/[artifactId]` correct quiz option, letter badge (`onPrimary` fill) | `surface` | 1.04 ❌ | `primary` | 9.98 ✅ |
| `MediaDetailHero` status-bar scrim over a cover | `textMain` as a dark ink | brightened the cover | `coverScrimInk` (mode-invariant) | — |

The wrong quiz option needed no change: its fill is `errorContainer`, which
flips with the mode, so `textMain` on it holds at 7.89 dark / 10.44 light, and
its letter badge moved from `surface` to `onError` to follow the `error` fill it
sits on (7.72 dark / 6.46 light).

What this illustrates is the one real trap of a two-palette system: a token
whose *value* happens to be dark is not the same thing as a token whose *role*
is "ink on a light fill". `onPrimary` and `coverScrimInk` are the only two
mode-invariant colours in the palette, and they are mode-invariant because what
they sit on is too — an amber fill, and a photograph.

## Reproducing these numbers

No script is committed for this: duplicating the palette into one would let the
two drift. The formula at the top of this file and the hex values in
`mobile/src/constants/theme.ts` are everything a contrast checker needs. When a
token changes, recompute its row and edit it here.
