import { ICON_PATHS } from "./icons.generated";

export type IconName = keyof typeof ICON_PATHS;

/** An Ionicon, as the app draws it (`scripts/icons.py`). Decorative: the control carries the label. */
export function icon(name: IconName, size = 18, className = ""): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 512 512");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `ic ${className}`.trim());
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", ICON_PATHS[name]);
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}
