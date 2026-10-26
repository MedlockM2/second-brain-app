import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useI18n } from "../../i18n/I18nProvider";
import { Icon } from "../Icon";
import { LogoMark } from "../Logo";
import { DepthArt, EverywhereArt, SearchArt, ShareArt } from "./WelcomeArt";

/** The four pages of the mobile welcome carousel, in the same order. */
const SLIDES: { key: string; Art: ComponentType; title: TranslationKey; body: TranslationKey[] }[] = [
  { key: "deep", Art: DepthArt, title: "welcome.deep.title", body: ["welcome.deep.save", "welcome.deep.chat", "welcome.deep.review"] },
  { key: "share", Art: ShareArt, title: "welcome.share.title", body: ["welcome.share.body"] },
  { key: "search", Art: SearchArt, title: "welcome.search.title", body: ["welcome.search.body"] },
  { key: "everywhere", Art: EverywhereArt, title: "welcome.everywhere.title", body: ["welcome.everywhere.body"] },
];

/** Long enough to read three short paragraphs. */
const ADVANCE_MS = 8000;

/**
 * Sign-in, sign-up and the e-mail code on a desktop: the welcome carousel on the
 * left, turning on its own (arrows and dots to drive it), the form on the right.
 * Under 960px the carousel gives way and the form stands alone.
 */
export function AuthSplit({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (paused || reduced) return;
    const timer = window.setTimeout(() => setPage((current) => (current + 1) % SLIDES.length), ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [page, paused]);
  const go = (next: number) => setPage((next + SLIDES.length) % SLIDES.length);
  const { Art, title, body } = SLIDES[page];
  return <div className="auth-split">
    <section className="auth-showcase" aria-roledescription="carousel" aria-label={t("welcome.carouselA11y")}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="row auth-brand"><LogoMark /><b className="headline">Deepn</b></div>
      <div className="auth-art" aria-hidden="true"><div className="auth-art-box"><Art /></div></div>
      <div className="auth-slide" aria-live={paused ? "polite" : "off"}>
        <h2 className="auth-slide-title">{t(title)}</h2>
        {body.map((key) => <p key={key} className={body.length > 1 ? "auth-slide-body short" : "auth-slide-body"}>{t(key)}</p>)}
      </div>
      <div className="auth-pager">
        <div className="auth-dots">
          {SLIDES.map((slide, index) => <button key={slide.key} type="button" className={index === page ? "on" : undefined}
            aria-label={`${index + 1} / ${SLIDES.length}`} aria-current={index === page || undefined} onClick={() => go(index)} />)}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="auth-round" aria-label={t("welcome.previous")} onClick={() => go(page - 1)}><Icon name="chevron-back" size={18} /></button>
          <button type="button" className="auth-round" aria-label={t("welcome.next")} onClick={() => go(page + 1)}><Icon name="chevron-forward" size={18} /></button>
        </div>
      </div>
    </section>
    <main className="auth-form-side"><div className="auth-form">{children}</div></main>
  </div>;
}
