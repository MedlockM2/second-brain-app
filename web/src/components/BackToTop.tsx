import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { Icon } from "./Icon";

/** How far down the page has to be before the way back up is offered. */
const SHOW_AFTER_PX = 900;

/**
 * A floating way back to the top of a long list (task-511, task-523): it
 * appears once the page has scrolled well down and brings it back up smoothly,
 * keeping every page already loaded. It watches the app's scrolling body.
 */
export function BackToTop() {
  const { t } = useI18n();
  const anchor = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const scroller = anchor.current?.closest(".shell-body");
    if (!scroller) return;
    const onScroll = () => setShown(scroller.scrollTop > SHOW_AFTER_PX);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <span ref={anchor}>
      {shown && (
        <button
          type="button"
          className="to-top"
          aria-label={t("search.backToTop")}
          title={t("search.backToTop")}
          onClick={() => anchor.current?.closest(".shell-body")?.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <Icon name="arrow-up" size={18} />
        </button>
      )}
    </span>
  );
}
