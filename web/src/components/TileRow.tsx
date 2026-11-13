import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Icon, type IconName } from "./Icon";

/** Width of three tiles and their gaps: what one press of ‹ or › scrolls. */
const PAGE_PX = 648;

/** A titled horizontal row of tiles, with ‹ › to scroll it on a desktop without a trackpad. */
export function TileRow({
  icon,
  title,
  restartKey = 0,
  children,
}: {
  icon: IconName;
  title: string;
  /**
   * Each new value sends the row back to its first tile. "Recently added" bumps
   * it once the list holding a fresh import is drawn: the import sits at the head,
   * and a row scrolled along — or re-snapped by `scroll-snap` onto the tile that
   * used to be first — would hide it.
   */
  restartKey?: number;
  children: ReactNode;
}) {
  const { tw } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  // After paint rather than in a layout effect: CSS Scroll Snap re-snaps a
  // container to the target it was snapped to when content is inserted before
  // it ("re-snapping after layout changes"), and that has to be over before the
  // start is asked for. `left: 0` is the start in a right-to-left page too.
  useEffect(() => {
    if (restartKey) track.current?.scrollTo({ left: 0 });
  }, [restartKey]);
  const scroll = (direction: 1 | -1) => {
    // In a right-to-left page "forward" is towards the left.
    const sign = document.documentElement.dir === "rtl" ? -1 : 1;
    track.current?.scrollBy({ left: direction * sign * PAGE_PX, behavior: "smooth" });
  };
  return (
    <section>
      <div className="row-head">
        <Icon name={icon} size={18} />
        <h2 className="headline grow">{title}</h2>
        <button type="button" className="icon-btn flip-rtl" aria-label={tw("home.rowBackA11y")} onClick={() => scroll(-1)}>
          <Icon name="chevron-back" size={18} />
        </button>
        <button type="button" className="icon-btn flip-rtl" aria-label={tw("home.rowForwardA11y")} onClick={() => scroll(1)}>
          <Icon name="chevron-forward" size={18} />
        </button>
      </div>
      <div className="track" ref={track}>
        {children}
      </div>
    </section>
  );
}
