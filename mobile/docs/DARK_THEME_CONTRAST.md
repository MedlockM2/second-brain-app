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
| `textMain` on `audioContainer` `#275029` | 7.82 ✅ | 10.53 | 4.5:1 |
| `textMain` on `imagePostContainer` `#603962` | 7.84 ✅ | 10.49 | 4.5:1 |
| `textMain` on `articleContainer` `#0b4f51` | 7.87 ✅ | 10.51 | 4.5:1 |

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

### `audioContainer`, `imagePostContainer`, `articleContainer`: three more families

AUDIO, PHOTOS and ARTICLE used to share the neutral `surfaceContainerHigh` with
every other type. They each get a fill on the recipe `shortVideoContainer` set —
`errorContainer`'s weight, a new hue:

| Token | Mode | `L*` | `C*` | `h` |
| --- | --- | --- | --- | --- |
| `audioContainer` `#d4e9d2` | light | 90.3 | 14.2 | 141.6° |
| `audioContainer` `#275029` | dark | 30.2 | 30.2 | 142.0° |
| `imagePostContainer` `#f3dcf2` | light | 90.2 | 14.1 | 326.1° |
| `imagePostContainer` `#603962` | dark | 30.1 | 30.0 | 325.1° |
| `articleContainer` `#c1ebec` | light | 90.2 | 14.2 | 200.6° |
| `articleContainer` `#0b4f51` | dark | 30.1 | 20.0 | 200.3° |

- **Hues placed in the gaps** of the circle the first three left: red 29°, amber
  85°, green 142°, sea-green 200°, blue-grey 271°, orchid 325°. No two
  neighbours are closer than 54°.
- **The dark sea-green is the one chroma below 29.8**: sRGB stops at about 20 at
  `L*` 30 and 200°, so it is held there rather than clipped into another hue.
- **A violet at 305° was rejected** for PHOTOS: ΔE 7.8 from the light SHORT
  fill, under the ~10 needed to tell two pills apart at a glance. The orchid
  moved it to 12.8.

Closest pairs as ΔE (CIE76), dark then light — the tightest light-mode pair of
each new fill:

| Pair | Dark ΔE | Light ΔE |
| --- | --- | --- |
| `audioContainer` vs `articleContainer` | 26.1 | 14.0 |
| `audioContainer` vs `surfaceContainerHigh` | 29.0 | 14.3 |
| `imagePostContainer` vs `shortVideoContainer` (SHORT) | 27.0 | 12.8 |
| `imagePostContainer` vs `errorContainer` (VIDEO) | 63.5 | 14.6 |
| `imagePostContainer` vs `surfaceContainerHigh` | 34.1 | 14.3 |
| `articleContainer` vs `surfaceContainerHigh` | 24.1 | 15.7 |
| `articleContainer` vs `shortVideoContainer` (SHORT) | 29.9 | 16.1 |

### The artifact formats: four tints, four inks (task-534)

The AI tab's "Generate" grid gives each format a tile filled with its *tint*
and an icon drawn in its *ink*; the list under it draws the same ink alone, on
the page, in front of each entry; the row of a generation in progress puts the
ink on the tint inside a box on `surface`. The light values are the task-534
mockup's (`mobile-design-mockups/ai_tab_notebooklm/`). The dark ones are
re-derived: every tint at `L*` 22, every ink at `L*` 76, on the light hues.

| Token | Light | `L*` `C*` `h` | Dark | `L*` `C*` `h` |
| --- | --- | --- | --- | --- |
| `artifactSummaryTint` | `#fff3c4` | 95.7 24.4 97.5° | `#3f331a` | 21.9 17.8 85.1° |
| `artifactSummaryInk` | `#9c7400` | 51.3 58.0 83.1° | `#e2b55a` | 76.0 52.0 83.2° |
| `artifactNotesTint` | `#e3eee4` | 93.1 6.5 146.8° | `#28392b` | 22.1 12.3 147.9° |
| `artifactNotesInk` | `#3f7048` | 42.9 31.2 146.5° | `#93c89a` | 76.0 31.7 146.4° |
| `artifactFlashcardsTint` | `#f5e1e1` | 91.1 7.3 19.8° | `#472e2f` | 21.9 12.3 19.0° |
| `artifactFlashcardsInk` | `#9b4a52` | 42.0 36.4 18.1° | `#faa4a9` | 75.9 34.1 18.1° |
| `artifactQuizTint` | `#e2e8f4` | 91.9 6.5 272.1° | `#2a3546` | 21.9 12.0 272.0° |
| `artifactQuizInk` | `#46598a` | 38.3 30.4 283.5° | `#a9baf4` | 76.1 31.5 283.3° |

The one hue that moves is the dark summary tint, from 97.5° to its ink's 85°:
at `L*` 22 the light tint's hue reads as olive rather than as amber.

The pairs that are drawn, dark then light. The label of a tile is `textMain`
on the tint (4.5:1); an ink is a graphic (3:1), measured on its tint, on
`background` (a list row) and on `surface` (the row in progress):

| Format | `textMain` on tint | ink on tint | ink on `background` | ink on `surface` |
| --- | --- | --- | --- | --- |
| Summary | 10.42 ✅ / 12.12 ✅ | 6.47 ✅ / 3.84 ✅ | 9.54 ✅ / 4.08 ✅ | 8.69 ✅ / 4.28 ✅ |
| Notes | 10.35 ✅ / 11.32 ✅ | 6.41 ✅ / 4.86 ✅ | 9.52 ✅ / 5.53 ✅ | 8.68 ✅ / 5.80 ✅ |
| Flashcards | 10.42 ✅ / 10.75 ✅ | 6.44 ✅ / 4.79 ✅ | 9.51 ✅ / 5.73 ✅ | 8.66 ✅ / 6.01 ✅ |
| Quiz | 10.44 ✅ / 10.97 ✅ | 6.50 ✅ / 5.59 ✅ | 9.57 ✅ / 6.55 ✅ | 8.71 ✅ / 6.87 ✅ |

The four tiles sit side by side, so they have to be told apart. The closest
pairs as ΔE (CIE76), dark then light:

| Pair | Dark ΔE | Light ΔE |
| --- | --- | --- |
| Flashcards vs quiz | 19.6 | 11.2 |
| Notes vs quiz | 21.5 | 11.6 |
| Notes vs flashcards | 22.2 | 12.5 |
| Summary vs notes | 16.4 | 20.9 |

`primaryInk` draws the two sparkles of the row in progress. In the light
palette it is `#b88a00`, the amber darkened to 3.15:1 on `surface` (the light
`primary` is 1.24:1, a fill only); in the dark one it is `primary` itself,
9.64:1 on `surface`. The sparkles are decorative — the row's text says what is
happening — so this is legibility, not a conformance requirement.

The amber sheen that crosses that row is `primary` at 28 % at its peak. Text
stays readable under it: over `surface`, the peak resolves to `#fff0b9` light
(`textMain` 11.83, `textSubtle` 4.92) and `#5b4b1e` dark (`textMain` 7.17,
`textSubtle` 5.32).

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
| `ArtifactTile` generate button label (amber fill; the button went with the tile in task-534) | `textMain` | 1.45 ❌ | `onPrimary` | 9.98 ✅ |
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
