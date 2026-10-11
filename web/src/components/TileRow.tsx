import { useRef, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Icon, type IconName } from "./Icon";

/** Width of three tiles and their gaps: what one press of ‹ or › scrolls. */
const PAGE_PX = 648;

/** A titled horizontal row of tiles, with ‹ › to scroll it on a desktop without a trackpad. */
export function TileRow({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  const { tw } = useI18n();
  const track = useRef<HTMLDivElement>(null);
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
