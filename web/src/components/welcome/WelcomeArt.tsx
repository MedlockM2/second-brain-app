import type { CSSProperties, ReactNode } from "react";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useI18n } from "../../i18n/I18nProvider";
import { ICON_PATHS, ICON_VIEWBOX } from "../icons.generated";
import { APP_LOGOS } from "./appLogos";

/**
 * The three illustrations of the sign-in panel, in the 414 × 416 box of the
 * owner's mockups: what Deepn does (`mobile-design-mockups/auth_directions/
 * direction_c_finale`), then saving from the browser and from the phone
 * (`mobile-design-mockups/onboarding_apres_connexion`, section 4). The web does
 * not repeat the mobile intro: a computer has no share sheet, and « on the web
 * too » means nothing to someone already on it.
 */
type IconName = keyof typeof ICON_PATHS;

function Glyph({ name, size, color }: { name: IconName; size: number; color?: string }) {
  return <svg width={size} height={size} viewBox={ICON_VIEWBOX} aria-hidden="true" style={{ flex: "none", color }}>
    <path d={ICON_PATHS[name]} fill="currentColor" />
  </svg>;
}

const card: CSSProperties = { position: "absolute", background: "var(--surface)", borderRadius: 16, boxShadow: "0 8px 24px rgba(43, 45, 66, 0.08)" };
const bar = (width: number | string, height = 6, color = "var(--surface-container-high)") =>
  <div style={{ width, height, borderRadius: height / 2, background: color }} />;

function AmberDot({ icon, size = 22 }: { icon: IconName; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: "var(--primary)", color: "var(--on-primary)",
    display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Glyph name={icon} size={Math.round(size * 0.6)} /></span>;
}

function CardHead({ icon, label, size = 22 }: { icon: IconName; label: string; size?: number }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
    <AmberDot icon={icon} size={size} />{label}
  </div>;
}

// 1 — Depth -------------------------------------------------------------------
// Three media on one subject lie on top of what you get from them, a chat with
// the AI and a quiz; the same media come back in small at the foot of both cards.
type Medium = "video" | "podcast" | "article";
const VIDEO_FILL = "#3d4a6b";
const MEDIA: Record<Medium, { fill: string; ink: string; icon: IconName; type: TranslationKey; title: TranslationKey }> = {
  video: { fill: VIDEO_FILL, ink: "#fff", icon: "play-circle-outline", type: "welcome.art.video", title: "welcome.art.videoTitle" },
  podcast: { fill: "var(--primary)", ink: "var(--on-primary)", icon: "headset-outline", type: "welcome.art.podcast", title: "welcome.art.podcastTitle" },
  article: { fill: "var(--article-container)", ink: "var(--text-main)", icon: "document-text-outline", type: "welcome.art.article", title: "welcome.art.articleTitle" },
};
// [medium, left, top, rotation]: the podcast at the centre, a little higher.
const SPREAD: [Medium, number, number, number][] = [["video", 18, 30, -6], ["article", 274, 30, 6], ["podcast", 146, 16, 0]];
const WAVE = Array.from({ length: 10 }, (_, k) => Math.max(4, Math.round(34 * (0.35 + 0.65 * Math.abs(Math.sin(k * 1.7) * Math.cos(k * 0.6))))));
const row: CSSProperties = { display: "flex", alignItems: "center" };

export function DepthArt() {
  const { t } = useI18n();
  const front: CSSProperties = { ...card, top: 150, width: 182, height: 236, boxSizing: "border-box", borderRadius: 20, padding: "44px 14px 14px",
    display: "flex", flexDirection: "column", gap: 10 };
  const sources = <div style={{ ...row, marginTop: "auto", fontSize: 12, color: "var(--text-subtle)" }}>
    <span style={{ marginRight: 6 }}>{t("welcome.art.sources")}</span>
    {(["video", "podcast", "article"] as const).map((key, n) => <span key={key} style={{ width: 26, height: 26, borderRadius: "50%", background: MEDIA[key].fill,
      color: MEDIA[key].ink, boxShadow: "0 0 0 2px var(--surface)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: n ? -5 : 0 }}>
      <Glyph name={MEDIA[key].icon} size={15} /></span>)}
  </div>;
  const look: Record<Medium, ReactNode> = {
    video: <div style={{ height: 58, borderRadius: 10, background: "rgba(255, 255, 255, 0.14)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", color: VIDEO_FILL, display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 2, boxSizing: "border-box" }}><Glyph name="play" size={16} /></span>
      <div style={{ position: "absolute", left: 8, right: 8, bottom: 7, height: 3, borderRadius: 2, background: "rgba(255, 255, 255, 0.3)" }}><div style={{ width: "40%", height: 3, borderRadius: 2, background: "#ff5a4f" }} /></div>
    </div>,
    podcast: <div style={{ ...row, height: 58, gap: 10 }}><Glyph name="headset-outline" size={28} />
      <div style={{ ...row, gap: 3 }}>{WAVE.map((h, k) => <span key={k} style={{ width: 3, height: h, borderRadius: 1.5, background: "rgba(28, 27, 26, 0.6)" }} />)}</div></div>,
    article: <div style={{ height: 58, borderRadius: 10, background: "rgba(255, 255, 255, 0.6)", padding: 9, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 5 }}>
      {bar("70%", 6, "rgba(28, 27, 26, 0.55)")}{["100%", "90%", "96%"].map((w) => <div key={w}>{bar(w, 4, "rgba(28, 27, 26, 0.2)")}</div>)}</div>,
  };
  return <>
    <div style={{ position: "absolute", left: -40, right: -40, top: 40, height: 360, background: "radial-gradient(closest-side, var(--primary-30), transparent)" }} />
    <div style={{ ...front, left: 18, transform: "rotate(-3deg)" }}>
      <CardHead icon="chatbubbles-outline" label={t("welcome.art.chat")} size={24} />
      <div style={{ alignSelf: "flex-end", background: "var(--text-main)", color: "var(--background)", borderRadius: "16px 16px 4px 16px", padding: "8px 12px", fontSize: 13, lineHeight: 1.3, fontWeight: 600 }}>{t("welcome.art.chatQuestion")}</div>
      <div style={{ ...row, alignSelf: "flex-start", maxWidth: "100%", boxSizing: "border-box", height: 34, gap: 3, background: "var(--surface-container)", borderRadius: "16px 16px 16px 4px",
        padding: "0 12px", fontSize: 12.5, fontStyle: "italic", color: "var(--text-subtle)", whiteSpace: "nowrap" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", marginRight: 3 }}>{t("welcome.art.chatThinking")}</span>
        {[1, 0.6, 0.3].map((o) => <span key={o} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-subtle)", opacity: o, flex: "none" }} />)}
      </div>
      {sources}
    </div>
    <div style={{ ...front, left: 214, transform: "rotate(3deg)" }}>
      <CardHead icon="school-outline" label={t("welcome.art.quiz")} size={24} />
      <div style={{ fontSize: 14.5, fontWeight: 750, lineHeight: 1.3 }}>{t("welcome.art.quizQuestion")}</div>
      <div style={{ display: "flex", gap: 6, fontSize: 13 }}>
        <div style={{ flex: 1, height: 34, borderRadius: 10, boxShadow: "inset 0 0 0 1px var(--outline-variant)", display: "flex", alignItems: "center", justifyContent: "center" }}>{t("welcome.art.quizWrong")}</div>
        <div style={{ flex: 1.3, height: 34, borderRadius: 10, background: "var(--success-tint)", boxShadow: "inset 0 0 0 1.5px var(--success)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontWeight: 700, color: "var(--success)" }}><Glyph name="checkmark" size={14} />{t("welcome.art.quizRight")}</div>
      </div>
      {sources}
    </div>
    {SPREAD.map(([key, x, y, rotation]) => {
      const medium = MEDIA[key];
      return <div key={key} style={{ position: "absolute", left: x, top: y, width: 122, height: 142, boxSizing: "border-box", borderRadius: 18, padding: 12,
        background: medium.fill, color: medium.ink, boxShadow: "0 18px 40px rgba(43, 45, 66, 0.10)", transform: `rotate(${rotation}deg)`, display: "flex", flexDirection: "column", gap: 4 }}>
        {look[key]}
        <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 650, opacity: 0.75 }}>{t(medium.type)}</div>
        <div style={{ fontSize: 14, fontWeight: 750, lineHeight: 1.2 }}>{t(medium.title)}</div>
      </div>;
    })}
  </>;
}

// The Deepn logo itself: the three planes of `web/public/favicon.svg` (the source
// of every app icon), on the amber square of the iOS icon or the disc of a
// browser toolbar. Not Ionicons' « layers-outline », whose planes differ.
function DeepnIcon({ size, round = false }: { size: number; round?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" style={{ flex: "none", display: "block" }}>
    {round ? <circle cx="256" cy="256" r="256" fill="#ffcb05" /> : <rect width="512" height="512" rx="118" fill="#ffcb05" />}
    <g fill="none" stroke="#1c1b1a" strokeWidth="28" strokeLinejoin="round" transform={round ? "translate(256 256) scale(.78) translate(-256 -256)" : undefined}>
      <path d="M256 136 116 206l140 70 140-70z" /><path d="m140 258-24 12 140 70 140-70-24-12" /><path d="m140 322-24 12 140 70 140-70-24-12" />
    </g>
  </svg>;
}

function AppTile({ name, size }: { name: string; size: number }) {
  const logo = APP_LOGOS[name];
  return <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.23), background: logo.background, flex: "none",
    display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: logo.outlined ? "inset 0 0 0 1px rgba(0,0,0,.1)" : undefined }}>
    <svg width={Math.round(size * 0.56)} height={Math.round(size * 0.56)} viewBox="0 0 24 24" aria-hidden="true"><path fill={logo.color} d={logo.path} /></svg>
  </span>;
}

const ring = (radius: number | string): CSSProperties => ({ position: "absolute", inset: -4, borderRadius: radius, boxShadow: "0 0 0 2px var(--primary)" });

// 2 — From the browser ---------------------------------------------------------
// The extension in the toolbar, ringed, and its confirmation; then the two other
// ways in on a computer, a pasted link and a dropped file (the add dialog and the
// whole app shell accept both).
export function BrowserArt() {
  const { t } = useI18n();
  const way = (icon: IconName, title: TranslationKey, detail: TranslationKey, first: boolean) => <div style={{ ...row, gap: 12, padding: "10px 0",
    borderTop: first ? undefined : "1px solid var(--surface-container)" }}>
    <span style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--primary)", color: "var(--on-primary)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Glyph name={icon} size={19} /></span>
    <div style={{ minWidth: 0, flex: 1, lineHeight: 1.3 }}>
      <div style={{ fontSize: 14, fontWeight: 650 }}>{t(title)}</div>
      <div style={{ fontSize: 12, color: "var(--text-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(detail)}</div>
    </div>
  </div>;
  return <>
    <div style={{ ...card, left: 14, right: 14, top: 8, height: 212, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ ...row, gap: 8, height: 38, padding: "0 12px", background: "var(--surface-container-low)", borderBottom: "1px solid var(--surface-container)" }}>
        <span style={{ ...row, gap: 5 }}>{["#ff5f57", "#febc2e", "#28c840"].map((c) => <i key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c, display: "block" }} />)}</span>
        <span style={{ ...row, flex: 1, minWidth: 0, gap: 6, height: 24, borderRadius: 12, background: "var(--surface)", padding: "0 10px", fontSize: 11.5, color: "var(--text-subtle)" }}>
          <Glyph name="globe-outline" size={11} /><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>lemonde.fr/sciences</span>
        </span>
        <span style={{ position: "relative", display: "inline-flex" }}><span style={ring("50%")} /><DeepnIcon size={22} round /></span>
        <Glyph name="extension-puzzle-outline" size={17} color="var(--text-subtle)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 18px" }}>
        {bar("62%", 11, "var(--text-main)")}{bar("40%", 6)}<div style={{ height: 6 }} />{bar("96%", 6)}{bar("90%", 6)}{bar("94%", 6)}{bar("70%", 6)}
      </div>
    </div>
    <div style={{ ...card, left: 150, right: 24, top: 52, padding: "12px 14px", borderRadius: 14 }}>
      <div style={{ ...row, gap: 10 }}>
        <Glyph name="checkmark-circle" size={22} color="var(--success)" />
        <div style={{ minWidth: 0, fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{t("welcome.art.saved")}
          <div style={{ fontSize: 12, fontWeight: 400, color: "var(--text-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("welcome.art.articleTitle")}</div>
        </div>
      </div>
    </div>
    <div style={{ ...card, left: 14, right: 14, top: 240, padding: "6px 16px" }}>
      {way("link-outline", "welcome.art.pasteLink", "welcome.art.linkKinds", true)}
      {way("cloud-upload-outline", "welcome.art.dropFile", "welcome.art.dropFileDetail", false)}
    </div>
  </>;
}

// 3 — From the phone ------------------------------------------------------------
// The iOS share sheet of the mobile intro, in a phone: Deepn's own icon ringed in
// the row of apps, the others dimmed; under it, every app that shares to Deepn.
export function PhoneArt() {
  const { t } = useI18n();
  const dimmed = (background: string, color: string, icon: IconName) => <span style={{ opacity: 0.32, width: 36, height: 36, borderRadius: 8, background, color,
    display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Glyph name={icon} size={18} /></span>;
  return <>
    <div style={{ position: "absolute", left: 107, top: 0, width: 200, height: 316, borderRadius: 32, background: "#1c1b1a", padding: 6, boxSizing: "border-box",
      boxShadow: "0 8px 24px rgba(43, 45, 66, 0.18)" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 26, background: "var(--surface-container-high)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 110, background: VIDEO_FILL, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <Glyph name="play-circle-outline" size={34} />
        </div>
        <div style={{ position: "absolute", left: 12, right: 12, top: 122, display: "flex", flexDirection: "column", gap: 7 }}>{bar("80%", 7, "var(--text-subtle)")}{bar("50%", 5, "var(--outline-variant)")}</div>
        <div style={{ position: "absolute", left: 6, right: 6, bottom: 6, borderRadius: 18, background: "var(--surface)", padding: "10px 8px 12px" }}>
          <div style={{ ...row, gap: 7, padding: "0 2px 8px" }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: VIDEO_FILL, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Glyph name="play" size={11} /></span>
            <div style={{ minWidth: 0, fontSize: 10, fontWeight: 650, lineHeight: 1.2 }}>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("welcome.art.videoTitle")}</div>
              <div style={{ fontWeight: 400, color: "var(--text-subtle)" }}>youtube.com</div>
            </div>
          </div>
          <div style={{ height: 1, background: "var(--surface-container)" }} />
          <div style={{ ...row, justifyContent: "space-between", padding: "10px 2px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 40 }}>
              <span style={{ position: "relative", display: "inline-flex" }}><span style={ring(12)} /><DeepnIcon size={36} /></span>
              <span style={{ fontSize: 8.5, fontWeight: 700, whiteSpace: "nowrap" }}>Deepn</span>
            </div>
            {dimmed("#34c759", "#fff", "chatbubbles-outline")}{dimmed("#1f8bff", "#fff", "mail-open-outline")}{dimmed("var(--surface-container-high)", "var(--text-subtle)", "ellipsis-horizontal")}
          </div>
        </div>
      </div>
    </div>
    <div style={{ position: "absolute", left: 28, right: 28, top: 334 }}>
      <div style={{ ...row, gap: 10, marginBottom: 12, fontSize: 12, color: "var(--text-subtle)" }}>
        <span style={{ flex: 1, height: 1, background: "var(--outline-variant)" }} />{t("intro.worksWith")}<span style={{ flex: 1, height: 1, background: "var(--outline-variant)" }} />
      </div>
      <div style={{ ...row, gap: 6, justifyContent: "center" }}>{Object.keys(APP_LOGOS).map((name) => <AppTile key={name} name={name} size={28} />)}</div>
    </div>
  </>;
}
