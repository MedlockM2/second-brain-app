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

function Dashes({ paths }: { paths: string[] }) {
  return <svg width="414" height="416" style={{ position: "absolute", inset: 0, overflow: "visible" }} stroke="var(--outline)"
    strokeWidth="1.4" strokeDasharray="3 4" fill="none" aria-hidden="true">
    {paths.map((d) => <path key={d} d={d} />)}
  </svg>;
}

// 1 — Depth -------------------------------------------------------------------
type Source = "video" | "podcast" | "short" | "audio" | "photo" | "article" | "pdf" | "link";
const SOURCE: Record<Source, { fill: string; ink?: string; icon: IconName; label: TranslationKey }> = {
  video: { fill: "var(--error-container)", icon: "play-circle-outline", label: "welcome.art.video" },
  podcast: { fill: "var(--primary)", ink: "var(--on-primary)", icon: "headset-outline", label: "welcome.art.podcast" },
  short: { fill: "var(--short-video-container)", icon: "play-circle-outline", label: "welcome.art.short" },
  audio: { fill: "var(--audio-container)", icon: "mic-outline", label: "welcome.art.audio" },
  photo: { fill: "var(--image-post-container)", icon: "images-outline", label: "welcome.art.photo" },
  article: { fill: "var(--article-container)", icon: "document-text-outline", label: "welcome.art.article" },
  pdf: { fill: "var(--surface-container-high)", icon: "reader-outline", label: "welcome.art.pdf" },
  link: { fill: "var(--surface-container-high)", icon: "link-outline", label: "welcome.art.link" },
};
const FAN: [Source, number, number, number, number][] = [
  ["pdf", -61, 66, -15, 0.3], ["audio", 17, 44, -11, 0.45], ["article", 93, 24, -7, 1], ["video", 169, 10, -3, 1],
  ["podcast", 245, 10, 3, 1], ["short", 321, 24, 7, 1], ["photo", 397, 44, 11, 0.45], ["link", 475, 66, 15, 0.3],
];

export function DepthArt() {
  const { t } = useI18n();
  const use: CSSProperties = { ...card, top: 290, width: 136, height: 122, boxSizing: "border-box", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 };
  const lines = (widths: string[]) => <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4, alignSelf: "stretch" }}>{widths.map((w, i) => <div key={i}>{bar(w)}</div>)}</div>;
  const edgeHead = (icon: IconName, label: string) => <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}><AmberDot icon={icon} size={20} />{label}</div>;
  return <>
    <div style={{ position: "absolute", left: -40, right: -40, top: 96, height: 260, background: "radial-gradient(closest-side, var(--primary-30), transparent)" }} />
    <Dashes paths={[
      ...FAN.slice(1, 7).map(([, x, y]) => `M${x} ${y + 88} C${x} ${y + 116} 207 128 207 152`),
      ...[30, 136, 278, 384].map((x) => `M207 262 C207 276 ${x} 274 ${x} 290`),
    ]} />
    {[...FAN].sort((a, b) => Math.abs(b[1] - 207) - Math.abs(a[1] - 207)).map(([key, x, y, rotation, opacity]) => {
      const source = SOURCE[key];
      return <div key={key} style={{ position: "absolute", left: x - 39, top: y, width: 78, height: 84, borderRadius: 20, background: source.fill,
        boxShadow: "0 6px 14px rgba(43, 45, 66, 0.12)", transform: `rotate(${rotation}deg)`, opacity, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 6, color: source.ink ?? "var(--text-main)", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
        <Glyph name={source.icon} size={28} />{t(source.label)}
      </div>;
    })}
    <div style={{ ...card, left: 30, right: 30, top: 152, borderRadius: "4px 16px 16px 4px", boxShadow: "inset 4px 0 0 var(--primary), 0 8px 24px rgba(43, 45, 66, 0.08)",
      padding: "14px 16px 14px 20px" }}>
      <CardHead icon="color-wand-outline" label={t("welcome.art.extracted")} />
      <div style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.55, fontStyle: "italic" }}>
        {t("welcome.art.quoteStart")}
        <span style={{ background: "linear-gradient(transparent 55%, var(--primary-30) 55%)" }}>{t("welcome.art.quoteHighlight")}</span>
        {t("welcome.art.quoteEnd")}
      </div>
    </div>
    <div style={{ ...use, left: -62, padding: "10px 8px", alignItems: "flex-end", opacity: 0.45 }}>{edgeHead("reader-outline", t("welcome.art.summary"))}{lines(["90%", "100%", "70%", "85%"])}</div>
    <div style={{ ...use, left: 340, padding: "10px 8px", opacity: 0.45 }}>{edgeHead("copy-outline", t("welcome.art.cards"))}{lines(["80%", "95%", "60%"])}</div>
    <div style={{ ...use, left: 68 }}>
      <CardHead icon="chatbubbles-outline" label={t("welcome.art.chat")} />
      <div style={{ background: "var(--text-main)", color: "var(--background)", borderRadius: "14px 14px 4px 14px", padding: "6px 10px", fontSize: 12, lineHeight: 1.35, fontWeight: 600 }}>{t("welcome.art.chatQuestion")}</div>
      <div style={{ alignSelf: "flex-start", maxWidth: "100%", display: "flex", alignItems: "center", gap: 3, background: "var(--surface-container)",
        borderRadius: "14px 14px 14px 4px", padding: "6px 8px", fontSize: 11, fontStyle: "italic", color: "var(--text-subtle)", whiteSpace: "nowrap" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", marginRight: 2 }}>{t("welcome.art.chatThinking")}</span>
        {[1, 0.6, 0.3].map((o) => <span key={o} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-subtle)", opacity: o, flex: "none" }} />)}
      </div>
    </div>
    <div style={{ ...use, left: 210 }}>
      <CardHead icon="school-outline" label={t("welcome.art.quiz")} />
      <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{t("welcome.art.quizQuestion")}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 2, fontSize: 11.5 }}>
        <div style={{ flex: 1, height: 26, borderRadius: 8, boxShadow: "inset 0 0 0 1px var(--outline-variant)", display: "flex", alignItems: "center", justifyContent: "center" }}>{t("welcome.art.quizWrong")}</div>
        <div style={{ flex: 1.5, height: 26, borderRadius: 8, background: "var(--success-tint)", boxShadow: "inset 0 0 0 1.5px var(--success)",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--success)" }}>{t("welcome.art.quizRight")}</div>
      </div>
    </div>
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
