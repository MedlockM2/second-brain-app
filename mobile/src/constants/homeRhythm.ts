import { Spacing } from "./theme";

/**
 * The one vertical gap between two stacked blocks of the Home screen (task-332).
 *
 * The convention is the one task-290 settled on for the media and folder
 * screens: **each block declares the space above itself, none declares space
 * below it.** A block that declares both writes its own rhythm — and the Home
 * column had two of those, so the gap above the first row heading came out of a
 * different pair of values than the gap above the second, and the column silently
 * changed shape whenever the unsorted-review card (absent at count 0) or the trial
 * pill (absent without a trial) was not there.
 *
 * It lives in its own module because three files declare it: the screen, for the
 * review card, both `TileRow`s, the empty state and the room kept above the
 * floating buttons (the column's last block), and the two notices that only ever
 * render at the top of it (`FreeTrialNotice`, `MinutesWarningBanner`). Importing
 * the same constant is what keeps a later edit to one of them from quietly
 * desynchronising the head of the screen from its body. It is an alias of
 * `Spacing.lg`, never a value of its own.
 *
 * The screen centres the column in its viewport, and this same gap at both ends
 * (under the safe area, above the buttons) is what makes that centring symmetric.
 */
export const HOME_BLOCK_GAP = Spacing.lg;
