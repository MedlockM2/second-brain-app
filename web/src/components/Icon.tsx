import { ICON_PATHS, ICON_VIEWBOX } from "./icons.generated";

/**
 * An Ionicon — the set the mobile app uses — drawn from the outlines of its own
 * font. To add one, list its name in web/scripts/extract_icons.py and rerun it.
 */
export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size }: { name: IconName; size?: 14 | 18 | 24 }) {
  return (
    <svg
      className={size ? `ico s${size}` : "ico"}
      viewBox={ICON_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
