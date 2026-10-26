import type { CSSProperties, ReactNode } from "react";
import type { TranslationKey } from "@media-summarizer/core/i18n/runtime";
import { useI18n } from "../../i18n/I18nProvider";
import { ICON_PATHS, ICON_VIEWBOX } from "../icons.generated";
import { APP_LOGOS } from "./appLogos";

/**
 * The four illustrations of the welcome carousel, drawn like the mobile ones
 * (`mobile/src/components/welcome/WelcomeArt.tsx`) in the 414 × 416 box of the
 * owner's mockup (`mobile-design-mockups/auth_directions/direction_c_finale`).
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

// 2 — Share or import ----------------------------------------------------------
function AppTile({ name, size }: { name: string; size: number }) {
  const logo = APP_LOGOS[name];
  return <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.23), background: logo.background, flex: "none",
    display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: logo.outlined ? "inset 0 0 0 1px rgba(0,0,0,.1)" : undefined }}>
    <svg width={Math.round(size * 0.56)} height={Math.round(size * 0.56)} viewBox="0 0 24 24" aria-hidden="true"><path fill={logo.color} d={logo.path} /></svg>
  </span>;
}

export function ShareArt() {
  const { t } = useI18n();
  const caps = (icon: IconName, key: TranslationKey) => <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700,
    letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-subtle)" }}><Glyph name={icon} size={14} />{t(key)}</div>;
  const arrow = <Glyph name="chevron-forward" size={18} color="var(--outline)" />;
  const row = (icon: IconName, title: TranslationKey, detail: string) => <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0" }}>
    <span style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--highlight)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Glyph name={icon} size={19} /></span>
    <div style={{ minWidth: 0, flex: 1, lineHeight: 1.3 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{t(title)}</div>
      <div style={{ fontSize: 12, color: "var(--text-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</div>
    </div>
  </div>;
  return <>
    <div style={{ ...card, left: 20, right: 20, top: 4, padding: "14px 16px 16px" }}>
      {caps("share-outline", "welcome.art.fromApp")}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "12px 0 14px" }}>
        <AppTile name="youtube" size={44} />{arrow}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 14px 0 11px", borderRadius: 999, background: "var(--surface)",
          boxShadow: "0 4px 14px rgba(43, 45, 66, 0.12)", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}><Glyph name="share-outline" size={18} />{t("welcome.art.share")}</span>
        {arrow}
        <span className="logo-mark" style={{ width: 44, height: 44 }}><Glyph name="layers-outline" size={22} /></span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>{Object.keys(APP_LOGOS).map((name) => <AppTile key={name} name={name} size={28} />)}</div>
    </div>
    <div style={{ ...card, left: 20, right: 20, top: 176, padding: "14px 16px 8px" }}>
      {caps("add", "welcome.art.fromPhone")}
      <div style={{ marginTop: 6 }}>
        {row("document-text-outline", "addSource.importFile.label", "PDF, DOCX, PPTX, XLSX, TXT, MP3, M4A…")}
        {row("images-outline", "addSource.importPhoto.label", t("welcome.art.photoLibrary"))}
        {row("link-outline", "addSource.enterUrl.label", t("welcome.art.linkKinds"))}
      </div>
    </div>
  </>;
}

// 3 — A whole folder -------------------------------------------------------------
const COVERS: { title: TranslationKey; type: TranslationKey; color: string; icon: IconName }[] = [
  { title: "welcome.art.cover1", type: "welcome.art.cover1Type", color: "linear-gradient(135deg,#3d4a6b,#1f2740)", icon: "play-circle-outline" },
  { title: "welcome.art.cover2", type: "welcome.art.cover2Type", color: "linear-gradient(135deg,#b88a3e,#7a5523)", icon: "document-text-outline" },
  { title: "welcome.art.cover3", type: "welcome.art.cover3Type", color: "linear-gradient(135deg,#4f6b5a,#2c4136)", icon: "headset-outline" },
];

export function FolderArt() {
  const { t } = useI18n();
  return <>
    <div style={{ ...card, left: 30, right: 30, top: 20, padding: "16px 16px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--highlight)", display: "flex", alignItems: "center", justifyContent: "center" }}><Glyph name="folder-outline" size={21} /></span>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{t("welcome.art.folderName")}<div style={{ fontSize: 12.5, fontWeight: 400, color: "var(--text-subtle)" }}>{t("welcome.art.folderCount")}</div></div>
      </div>
      {COVERS.map((cover) => <div key={cover.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid var(--surface-container)" }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: cover.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Glyph name={cover.icon} size={15} /></span>
        <div style={{ minWidth: 0, flex: 1, fontSize: 13, lineHeight: 1.3 }}>
          <b style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(cover.title)}</b>
          <span style={{ color: "var(--text-subtle)", fontSize: 12 }}>{t(cover.type)}</span>
        </div>
      </div>)}
    </div>
    <div style={{ position: "absolute", left: 30, right: 30, top: 296, height: 52, borderRadius: 999, background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--outline-variant)",
      display: "flex", alignItems: "center", padding: "0 6px 0 18px", fontSize: 14.5, color: "var(--text-muted)" }}>
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("welcome.art.askFolder")}</span>
      <span style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--primary)", color: "var(--on-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Glyph name="arrow-up" size={20} /></span>
    </div>
  </>;
}

// 4 — Everywhere -------------------------------------------------------------------
export function EverywhereArt() {
  const { t } = useI18n();
  const column = (style: CSSProperties, children: ReactNode) => <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>{children}</div>;
  return <>
    <div style={{ position: "absolute", left: 28, top: 62, width: 310, height: 200, borderRadius: 14, background: "#2b2d42", padding: 8, boxSizing: "border-box" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 7, background: "var(--background)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 22, padding: "0 8px", borderBottom: "1px solid var(--surface-container)" }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--primary)" }} />{bar(34, 5)}{bar(34, 5)}{bar(34, 5)}
        </div>
        <div style={{ flex: 1, display: "flex", gap: 6, padding: 8 }}>
          {column({ width: 70 }, <><div style={{ height: 42, borderRadius: 6, background: COVERS[0].color }} />{bar(60, 5)}{bar(50, 5)}{bar(64, 5)}</>)}
          {column({ flex: 1, background: "var(--surface)", borderRadius: 6, padding: 8 }, <>{bar("80%", 5)}{bar("60%", 5)}
            <div style={{ marginLeft: "auto", width: "60%", height: 16, borderRadius: 6, background: "var(--surface-container-high)" }} />{bar("70%", 5)}</>)}
          {column({ width: 58, gap: 5 }, [0, 1, 2, 3].map((i) => <div key={i} style={{ height: 14, borderRadius: 7, background: "var(--highlight)" }} />))}
        </div>
      </div>
    </div>
    <div style={{ position: "absolute", left: 8, top: 262, width: 350, height: 12, borderRadius: "0 0 10px 10px", background: "#c9c4bf" }} />
    <div style={{ position: "absolute", left: 282, top: 118, width: 104, height: 212, borderRadius: 22, background: "#1c1b1a", padding: 5, boxSizing: "border-box", boxShadow: "0 8px 24px rgba(43, 45, 66, 0.18)" }}>
      {column({ width: "100%", height: "100%", borderRadius: 17, background: "var(--background)", padding: "18px 8px 8px", boxSizing: "border-box" }, <>
        {bar(50, 6, "var(--text-main)")}<div style={{ height: 52, borderRadius: 8, background: COVERS[1].color }} />{bar("80%", 5)}
        <div style={{ height: 52, borderRadius: 8, background: COVERS[2].color }} />{bar("70%", 5)}</>)}
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 350, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-subtle)" }}>
      <Glyph name="desktop-outline" size={16} />{t("welcome.art.platforms")}
    </div>
  </>;
}
