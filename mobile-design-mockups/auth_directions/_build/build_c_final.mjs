// Builds direction_c_finale/: the retained direction C, with the carousel proposals and the
// full-screen sign-in and sign-up screens, on mobile and on the web.
// Usage (from the repository root): node mobile-design-mockups/auth_directions/_build/build_c_final.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EMAIL, COVERS, ic, phone, desk, brand, apple, google, primary, btn, divider, legal,
  field, badges, otp, note, back, keyboard, cover, page, textTable,
} from "./kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "direction_c_finale");

// =====================================================================================
// Carousel slides: an illustration drawn in a 414 x 416 box, a title and a subtitle
// =====================================================================================
const box = (inner) => `<div style="position:relative;width:414px;height:416px">${inner}</div>`;
const card = (style, inner) => `<div style="position:absolute;background:var(--surface);border-radius:16px;box-shadow:var(--shadow-lift);${style}">${inner}</div>`;
const bar = (w, h = 8, c = "var(--surface-container-high)") => `<div style="width:${w};height:${h}px;border-radius:${h / 2}px;background:${c}"></div>`;
const thumb = (c, s = 40) => `<span style="width:${s}px;height:${s}px;border-radius:10px;background:${c.bg};flex:none;display:flex;align-items:center;justify-content:center;color:#fff">${ic(c.icon, s * 0.45)}</span>`;

// ---------- Sharing and importing: app logos, file tiles, the two system share icons ----------
// Logos are Simple Icons paths (CC0, simple-icons@11), kept in logos.json. The lists follow
// SHARE_TARGETS (media_summarizer/core/media_ingestion/adapters/share_targets.py): what is drawn
// here is what the workers really accept, and the shipped screen should render that list too.
const LOGOS = JSON.parse(readFileSync(join(HERE, "logos.json"), "utf8"));
const logo = (k, s, fill) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${fill}" d="${LOGOS[k]}"/></svg>`;
const SHARE_ICON = { ios: "share-outline", android: "share-social-outline" };
const APPS = {
  youtube: { name: "YouTube", bg: "#fff", fg: "#FF0000", line: true },
  tiktok: { name: "TikTok", bg: "#000", fg: "#fff" },
  instagram: { name: "Instagram", bg: "linear-gradient(45deg,#feda75,#fa7e1e 30%,#d62976 60%,#962fbf 85%,#4f5bd5)", fg: "#fff" },
  x: { name: "X", bg: "#000", fg: "#fff" },
  spotify: { name: "Spotify", bg: "#000", fg: "#1ED760" },
  applepodcasts: { name: "Apple Podcasts", short: "Podcasts", bg: "linear-gradient(180deg,#f452ff,#832bc1)", fg: "#fff" },
  deezer: { name: "Deezer", bg: "#A238FF", fg: "#fff" },
  whatsapp: { name: "WhatsApp", bg: "#25D366", fg: "#fff" },
  safari: { name: "Safari", bg: "#fff", fg: "#006CFF", line: true },
  googlechrome: { name: "Chrome", bg: "#fff", fg: "#4285F4", line: true },
  notes: { name: "Notes", bg: "#fff", line: true },
  googlekeep: { name: "Keep", bg: "#FFBB00", fg: "#fff" },
};
// Apple Podcasts has no Android app; podcasts arrive there from Spotify, Deezer or a link.
const APP_LIST = {
  ios: ["youtube", "tiktok", "instagram", "x", "spotify", "applepodcasts", "deezer", "whatsapp", "safari", "notes"],
  android: ["youtube", "tiktok", "instagram", "x", "spotify", "deezer", "whatsapp", "googlechrome", "googlekeep"],
};
const FORMATS_LINE = "PDF, DOCX, PPTX, XLSX, TXT, MD, RTF · JPG, PNG, HEIC · MP3, M4A, WAV…";

// An app tile like a home-screen icon: rounded square on iOS, circle on Android.
const appTile = (k, s = 44, os = "ios") => {
  const a = APPS[k];
  const r = os === "android" ? "50%" : `${Math.round(s * 0.23)}px`;
  const glyph = k === "notes"
    ? `<span style="position:absolute;inset:0;border-radius:inherit;overflow:hidden"><span style="display:block;height:30%;background:#ffd60a"></span>${[0, 1, 2].map((i) => `<span style="display:block;height:1px;background:#d8d8dc;margin:${i ? s * 0.12 : s * 0.14}px ${s * 0.14}px 0"></span>`).join("")}</span>`
    : logo(k, Math.round(s * 0.56), a.fg);
  return `<span style="width:${s}px;height:${s}px;border-radius:${r};background:${a.bg};flex:none;display:inline-flex;align-items:center;justify-content:center;position:relative;${a.line ? "box-shadow:inset 0 0 0 1px rgba(0,0,0,.1)" : ""}">${glyph}</span>`;
};
const pill = (icon, t, y = false) => `<span style="display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px 0 11px;border-radius:999px;background:${y ? "var(--primary)" : "var(--surface)"};color:${y ? "var(--on-primary)" : "var(--text-main)"};box-shadow:var(--shadow-lift);font-size:14px;font-weight:650;white-space:nowrap">${ic(icon, 18)}${t}</span>`;
const caps = (t) => `<div style="font-size:11.5px;font-weight:700;letter-spacing:.07em;color:var(--text-subtle);display:flex;align-items:center;gap:6px">${t}</div>`;

// Page 2 — Two gestures: « Depuis une app » (share icon, app logos) and « Depuis votre téléphone »
// (the rows of the app's own AddSourceSheet).
function twoGestures(os) {
  const arrow = `<span style="color:var(--outline)">${ic("chevron-forward", 18)}</span>`;
  const row = (i, t, d) => `<div class="row" style="gap:12px;padding:7px 0"><span class="halo" style="width:38px;height:38px">${ic(i, 19)}</span><div style="flex:1;min-width:0;font-size:14px;font-weight:600;line-height:1.3">${t}<div style="font-size:12px;font-weight:400;color:var(--text-subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d}</div></div></div>`;
  return box(`
    ${card("left:20px;right:20px;top:4px;padding:14px 16px 16px", `${caps(`${ic(SHARE_ICON[os], 14)} DEPUIS UNE APP`)}
      <div class="row" style="gap:10px;margin:12px 0 14px;justify-content:center">${appTile("youtube", 44, os)}${arrow}${pill(SHARE_ICON[os], "Partager")}${arrow}<span class="mark" style="width:44px;height:44px">${ic("layers-outline", 22)}</span></div>
      <div class="row" style="gap:6px;justify-content:center;flex-wrap:wrap">${APP_LIST[os].map((k) => appTile(k, 28, os)).join("")}</div>`)}
    ${card("left:20px;right:20px;top:176px;padding:14px 16px 8px", `${caps(`${ic("add", 15)} DEPUIS VOTRE TÉLÉPHONE`)}<div style="height:6px"></div>
      ${row("document-text-outline", "Importer un fichier", "PDF, DOCX, PPTX, XLSX, TXT, MP3, M4A…")}
      ${row("images-outline", "Importer une photo", "Depuis la photothèque")}
      ${row("link-outline", "Coller un lien", "Un article, une vidéo ou un épisode de podcast")}`)}`);
}

// ---------- Page 1: your media, and what you get from them ----------
// What you saved, and what you get from it, with no line and no « extracted text » step: the image
// says it alone. Rules applied (Material Design « Top user benefits », NN/g on onboarding): the
// benefit rather than the app's interface, only the essentials, every element legible at phone size.
const disc = (i, bg = "var(--primary)", fg = "var(--on-primary)", s = 26) => `<span style="width:${s}px;height:${s}px;border-radius:50%;background:${bg};color:${fg};display:inline-flex;align-items:center;justify-content:center;flex:none">${ic(i, Math.round(s * 0.55))}</span>`;
const wave = (n, h, c, w = 4, g = 3) => `<div class="row" style="gap:${g}px;align-items:center">${Array.from({ length: n }, (_, k) => `<span style="width:${w}px;height:${Math.max(4, Math.round(h * (0.35 + 0.65 * Math.abs(Math.sin(k * 1.7) * Math.cos(k * 0.6)))))}px;border-radius:${w / 2}px;background:${c}"></span>`).join("")}</div>`;

// Three media on one subject (a player, a sound wave, a page) lie on top of two cards, a chat with the
// AI and a quiz, covering only their empty heads, so every title stays readable. The link is said
// twice: by depth, and by the same media in small at the foot of both cards (« Sources »), while the
// AI « reads your sources » with the dots of an answer being written.
function p1Front() {
  const media = {
    video: [`linear-gradient(160deg,#4a5a80,#2b3550)`, "#fff", "play-circle-outline", "Vidéo", "Le cerveau la nuit"],
    podcast: ["var(--primary)", "var(--on-primary)", "headset-outline", "Podcast", "Sommeil et mémoire"],
    article: ["#c1ebec", "var(--text-main)", "document-text-outline", "Article", "Dormir pour apprendre"],
  };
  // What makes each format recognisable at a glance: a player, a sound wave, a page of text.
  const look = {
    video: `<div style="height:58px;border-radius:10px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;position:relative">${disc("play", "#fff", "#2b3550", 30)}<div style="position:absolute;left:8px;right:8px;bottom:7px;height:3px;border-radius:2px;background:rgba(255,255,255,.3)"><div style="width:40%;height:100%;border-radius:2px;background:#ff5a4f"></div></div></div>`,
    podcast: `<div style="height:58px;display:flex;align-items:center;gap:10px">${ic("headset-outline", 28)}${wave(10, 34, "rgba(28,27,26,.6)", 3, 3)}</div>`,
    article: `<div style="height:58px;border-radius:10px;background:rgba(255,255,255,.6);padding:9px 9px;box-sizing:border-box;display:flex;flex-direction:column;gap:5px">${bar("70%", 6, "rgba(28,27,26,.55)")}${bar("100%", 4, "rgba(28,27,26,.2)")}${bar("90%", 4, "rgba(28,27,26,.2)")}${bar("96%", 4, "rgba(28,27,26,.2)")}</div>`,
  };
  const src = (x, y, rot, k) => {
    const [bg, fg, , type, title] = media[k];
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:122px;height:142px;border-radius:18px;background:${bg};color:${fg};box-shadow:var(--shadow-lift);transform:rotate(${rot}deg);padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:4px">
      ${look[k]}<div style="margin-top:8px;font-size:11.5px;font-weight:650;opacity:.75">${type}</div><div style="font-size:14px;font-weight:750;line-height:1.2">${title}</div></div>`;
  };
  // The three media in small: the same colours and icons, overlapping like avatars.
  const tokens = `<span class="row" style="flex:none">${Object.values(media).map(([bg, fg, i], n) => `<span style="width:26px;height:26px;border-radius:50%;background:${bg};color:${fg};box-shadow:0 0 0 2px var(--surface);display:inline-flex;align-items:center;justify-content:center;margin-left:${n ? -5 : 0}px">${ic(i, 15)}</span>`).join("")}</span>`;
  // Quiz and chat: two separate cards, tilted apart like the media behind them.
  const front = (x, rot, i, t, body) => `<div style="position:absolute;left:${x}px;top:150px;width:182px;height:236px;box-sizing:border-box;border-radius:20px;background:var(--surface);box-shadow:var(--shadow-lift);transform:rotate(${rot}deg);padding:44px 14px 14px;display:flex;flex-direction:column;gap:10px">
    <div class="row" style="gap:8px;font-size:13px;font-weight:700">${disc(i, "var(--primary)", "var(--on-primary)", 24)}${t}</div>${body}</div>`;
  return box(`
    <div style="position:absolute;left:-40px;right:-40px;top:40px;height:360px;background:radial-gradient(closest-side,var(--primary-30),transparent)"></div>
    ${front(214, 3, "school-outline", "Quiz", `
      <div style="font-size:14.5px;font-weight:750;line-height:1.3">Quel sommeil fixe la mémoire ?</div>
      <div class="row" style="gap:6px">
        <div style="flex:1;height:34px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--outline-variant);display:flex;align-items:center;justify-content:center;font-size:13px">Léger</div>
        <div style="flex:1.3;height:34px;border-radius:10px;background:rgba(46,125,79,.10);box-shadow:inset 0 0 0 1.5px var(--success);display:flex;align-items:center;justify-content:center;gap:4px;font-size:13px;font-weight:700;color:var(--success)">${ic("checkmark", 14)}Profond</div>
      </div>
      <div class="row" style="gap:6px;margin-top:auto;font-size:12px;color:var(--text-subtle)">Sources ${tokens}</div>`)}
    ${front(18, -3, "chatbubbles-outline", "Chat IA", `
      <div style="align-self:flex-end;background:var(--text-main);color:var(--background);border-radius:16px 16px 4px 16px;padding:8px 12px;font-size:13px;font-weight:600;line-height:1.3">Le sommeil aide à retenir ?</div>
      <div class="row" style="align-self:flex-start;height:34px;box-sizing:border-box;gap:6px;background:var(--surface-container);border-radius:16px 16px 16px 4px;padding:0 12px;font-size:12.5px;font-style:italic;color:var(--text-subtle)">Lit vos sources<span class="row" style="gap:3px">${[1, .6, .3].map((o) => `<span style="width:5px;height:5px;border-radius:50%;background:var(--text-subtle);opacity:${o}"></span>`).join("")}</span></div>
      <div class="row" style="gap:6px;margin-top:auto;font-size:12px;color:var(--text-subtle)">Sources ${tokens}</div>`)}
    ${src(18, 30, -6, "video")}${src(274, 30, 6, "article")}${src(146, 16, 0, "podcast")}`);
}


const ART = {
  share: twoGestures("ios"),

  // From media to text to use: a video, a podcast and many other sources (the chips) become a
  // timestamped text, from which come questions, a summary, flash cards and a quiz.
  essentiel: p1Front(),

  // Every format lands in the same place.
  formats: box([
    ["Vidéo", "Un lien", "play-circle-outline", COVERS[0].bg, 30, 34, -4],
    ["Article", "Un lien", "document-text-outline", COVERS[1].bg, 151, 22, 2],
    ["Podcast", "Un lien", "headset-outline", COVERS[2].bg, 272, 38, 5],
    ["PDF", "Un fichier", "reader-outline", "linear-gradient(135deg,#a0574a,#6b3229)", 90, 200, 3],
    ["Photo", "Une page photographiée", "camera-outline", "linear-gradient(135deg,#6b5f8f,#41385e)", 211, 196, -3],
  ].map(([t, s, i, bg, x, y, r]) => card(`left:${x}px;top:${y}px;width:112px;overflow:hidden;transform:rotate(${r}deg)`,
    `<div style="height:70px;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff">${ic(i, 30)}</div>
    <div style="padding:9px 11px 11px;font-size:12px;line-height:1.3;color:var(--text-subtle)"><b style="display:block;font-size:13.5px;color:var(--text-main)">${t}</b>${s}</div>`)).join("")
    + `<div style="position:absolute;left:0;right:0;top:362px;display:flex;justify-content:center"><span class="row" style="gap:8px;background:var(--surface);border-radius:999px;padding:8px 16px 8px 8px;box-shadow:var(--shadow-soft);font-size:13.5px;font-weight:600"><span class="mark" style="width:26px;height:26px">${ic("layers-outline", 14)}</span>Tout arrive dans votre bibliothèque</span></div>`),

  // Ask the source: question, answer with its quoted passage, composer.
  chat: box(`
    <div style="position:absolute;right:28px;top:30px;max-width:270px;background:var(--surface-container-high);border-radius:18px 18px 4px 18px;padding:11px 15px;font-size:14.5px;line-height:1.45">Pourquoi le sommeil profond aide-t-il à retenir ?</div>
    ${card("left:28px;right:44px;top:108px;padding:14px 16px;font-size:14.5px;line-height:1.5;border-radius:4px 18px 18px 18px", `Pendant le sommeil lent profond, <span style="background:linear-gradient(transparent 55%, var(--primary-30) 55%);font-weight:600">le cerveau rejoue les apprentissages de la journée</span> et les transfère vers la mémoire durable.
      <div class="row" style="gap:6px;margin-top:10px;font-size:12px;color:var(--text-subtle);background:var(--surface-container-low);border-radius:999px;padding:5px 10px;width:max-content">${ic("play-circle-outline", 14)} Passage cité · 12:40</div>`)}
    <div style="position:absolute;left:28px;right:28px;top:330px;height:52px;border-radius:999px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--outline-variant);display:flex;align-items:center;padding:0 6px 0 18px;font-size:14.5px;color:var(--text-muted)">
      <span style="flex:1">Poser une question sur cette source…</span><span style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:var(--on-primary);display:flex;align-items:center;justify-content:center">${ic("arrow-up", 20)}</span></div>`),

  // Revise: a flash card and a quiz question.
  revise: box(`
    ${card("left:66px;top:40px;width:296px;height:196px;transform:rotate(5deg);opacity:.75", "")}
    ${card("left:48px;top:28px;width:306px;height:200px;transform:rotate(-3deg);padding:18px 20px;display:flex;flex-direction:column", `
      <div class="row" style="gap:6px;font-size:11.5px;font-weight:700;letter-spacing:.06em;color:var(--text-subtle)">${ic("school-outline", 15)} CARTE MÉMO · 3 / 12</div>
      <div style="font-size:19px;font-weight:700;line-height:1.3;margin-top:16px;letter-spacing:-.2px">Quelle phase du sommeil consolide la mémoire ?</div>
      <div class="sp"></div><div style="font-size:12.5px;color:var(--text-subtle)">Touchez pour voir la réponse</div>`)}
    ${card("left:40px;right:40px;top:256px;padding:14px 16px", `<div style="font-size:11.5px;font-weight:700;letter-spacing:.06em;color:var(--text-subtle);margin-bottom:10px">QUIZ · QUESTION 2 SUR 5</div>
      <div class="stack g8"><div style="height:40px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--outline-variant);display:flex;align-items:center;padding:0 14px;font-size:14px">Le sommeil paradoxal</div>
      <div style="height:40px;border-radius:12px;background:rgba(46,125,79,.10);box-shadow:inset 0 0 0 1.5px var(--success);display:flex;align-items:center;justify-content:space-between;padding:0 14px;font-size:14px;font-weight:600;color:var(--success)">Le sommeil lent profond ${ic("checkmark-circle", 18)}</div></div>`)}`),

  // Daily digest: the period, a stack of covers, « Lire ».
  digest: box(`
    <div style="position:absolute;left:0;right:0;top:26px;display:flex;justify-content:center"><span class="tag" style="background:var(--surface);box-shadow:var(--shadow-soft);height:30px;padding:0 14px;font-size:13px">${ic("time-outline", 14)} Quotidien · aujourd’hui</span></div>
    ${card(`left:88px;top:84px;width:200px;height:176px;overflow:hidden;transform:rotate(-8deg)`, `<div style="height:92px;background:${COVERS[2].bg}"></div>`)}
    ${card(`left:126px;top:80px;width:200px;height:176px;overflow:hidden;transform:rotate(7deg)`, `<div style="height:92px;background:${COVERS[1].bg}"></div>`)}
    ${cover(COVERS[0], "position:absolute;left:107px;top:92px;width:200px")}
    <div style="position:absolute;left:0;right:0;top:300px;display:flex;flex-direction:column;align-items:center;gap:12px">
    <span style="font-size:14px;color:var(--text-subtle)">4 médias enregistrés hier</span><span class="btn primary sm" style="width:140px;border-radius:999px">Lire</span></div>`),

  // Unsorted review: one new source, three decisions.
  sort: box(`
    ${card("left:44px;right:44px;top:16px;overflow:hidden", `<div style="height:112px;background:${COVERS[1].bg};padding:10px;display:flex;align-items:flex-end;justify-content:space-between"><span class="pill-type">${ic(COVERS[1].icon, 13)}${COVERS[1].type}</span><span class="pill-type">3 / 12</span></div>
      <div style="padding:12px 16px 16px;font-size:13px;line-height:1.45;color:var(--text-subtle)"><b style="display:block;font-size:15px;color:var(--text-main);margin-bottom:4px">${COVERS[1].title}</b>Pourquoi lire sur papier et lire sur écran ne mobilisent pas tout à fait la même attention.</div>`)}
    <div style="position:absolute;left:44px;right:44px;top:282px;display:flex;justify-content:space-between">
    ${[["trash-outline", "Jeter", ""], ["sparkles-outline", "Approfondir", ""], ["folder-outline", "Ranger", "y"]].map(([i, t, y]) =>
      `<div style="display:flex;flex-direction:column;align-items:center;gap:7px;width:96px;font-size:13px;font-weight:600"><span style="width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${y ? "var(--primary)" : "var(--surface)"};color:${y ? "var(--on-primary)" : "var(--text-main)"};box-shadow:var(--shadow-lift)">${ic(i, 24)}</span>${t}</div>`).join("")}</div>`),

  // Ask a whole folder.
  folder: box(`
    ${card("left:30px;right:30px;top:20px;padding:16px 16px 8px", `<div class="row" style="gap:12px;margin-bottom:10px"><span class="halo" style="width:42px;height:42px">${ic("folder-outline", 21)}</span><div style="font-size:16px;font-weight:700">Sommeil et mémoire<div style="font-size:12.5px;font-weight:400;color:var(--text-subtle)">8 sources</div></div></div>
      ${COVERS.map((c) => `<div class="row" style="gap:12px;padding:8px 0;border-top:1px solid var(--surface-container)">${thumb(c, 34)}<div style="flex:1;min-width:0;font-size:13px;line-height:1.3"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title}</b><span style="color:var(--text-subtle);font-size:12px">${c.type}</span></div></div>`).join("")}`)}
    <div style="position:absolute;left:30px;right:30px;top:296px;height:52px;border-radius:999px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--outline-variant);display:flex;align-items:center;padding:0 6px 0 18px;font-size:14.5px;color:var(--text-muted)">
      <span style="flex:1">Poser une question sur ce dossier…</span><span style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:var(--on-primary);display:flex;align-items:center;justify-content:center">${ic("arrow-up", 20)}</span></div>`),

  // Everywhere: the web app on a laptop, the app on a phone.
  everywhere: box(`
    <div style="position:absolute;left:28px;top:62px;width:310px;height:200px;border-radius:14px;background:#2b2d42;padding:8px">
      <div style="width:100%;height:100%;border-radius:7px;background:var(--background);display:flex;flex-direction:column;overflow:hidden">
        <div class="row" style="gap:6px;height:22px;padding:0 8px;border-bottom:1px solid var(--surface-container)"><span class="mark" style="width:12px;height:12px"></span>${bar("34px", 5)}${bar("34px", 5)}${bar("34px", 5)}</div>
        <div style="flex:1;display:flex;gap:6px;padding:8px">
          <div class="stack" style="gap:6px;width:70px">${thumb(COVERS[0], 70).replace("border-radius:10px", "border-radius:6px;height:42px")}${bar("60px", 5)}${bar("50px", 5)}${bar("64px", 5)}</div>
          <div class="stack" style="gap:6px;flex:1;background:var(--surface);border-radius:6px;padding:8px">${bar("80%", 5)}${bar("60%", 5)}<div style="margin-left:auto;width:60%;height:16px;border-radius:6px;background:var(--surface-container-high)"></div>${bar("70%", 5)}</div>
          <div class="stack" style="gap:5px;width:58px">${["", "", "", ""].map(() => `<div style="height:14px;border-radius:7px;background:var(--primary-12)"></div>`).join("")}</div></div></div></div>
    <div style="position:absolute;left:8px;top:262px;width:350px;height:12px;border-radius:0 0 10px 10px;background:#c9c4bf"></div>
    <div style="position:absolute;left:282px;top:118px;width:104px;height:212px;border-radius:22px;background:#1c1b1a;padding:5px;box-shadow:var(--shadow-lift)">
      <div style="width:100%;height:100%;border-radius:17px;background:var(--background);padding:18px 8px 8px;display:flex;flex-direction:column;gap:6px">
        ${bar("50px", 6, "var(--text-main)")}<div style="height:52px;border-radius:8px;background:${COVERS[1].bg}"></div>${bar("80%", 5)}<div style="height:52px;border-radius:8px;background:${COVERS[2].bg}"></div>${bar("70%", 5)}</div></div>
    <div style="position:absolute;left:0;right:0;top:350px;display:flex;justify-content:center;gap:8px;font-size:13px;color:var(--text-subtle)">${ic("desktop-outline", 16)} web app · app iOS et Android</div>`),
};

const SLIDES = [
  { id: "essentiel", n: 1, rec: true, title: "Gardez ce qui compte.<br>Approfondissez.<br>Apprenez.", sub: "Enregistrez podcasts, vidéos, reels, articles web, PDF et bien plus. Parlez de votre contenu avec l’IA. Créez des quiz, fiches et résumés pour réviser.", points: [
    ["layers-outline", "Enregistrez podcasts, vidéos, reels, articles web, PDF et bien plus."],
    ["chatbubbles-outline", "Parlez de votre contenu avec l’IA."],
    ["school-outline", "Créez des quiz, fiches et résumés pour réviser."]], why: "La promesse de l’app : vos médias, quel que soit leur format, et ce que vous en tirez. Trois médias sur un même sujet, posés sur un chat IA et un quiz ; les mêmes médias reviennent en pastilles au pied des deux cartes (« Sources »). Première page conseillée." },
  { id: "share", n: 2, rec: true, title: "Depuis vos apps ou votre téléphone", sub: "Tout ce que vous partagez ou importez arrive dans votre bibliothèque.", why: "Le geste qui fait vivre l’app, et le moins découvrable : le partage se fait hors de Deepn. En haut, l’icône Partager et les logos des apps compatibles ; en bas, les trois lignes de la feuille « Ajouter » de l’app, avec les formats. Version Android : section 2." },
  { id: "folder", n: 3, rec: true, title: "Interrogez tout un dossier", sub: "Une question, une réponse tirée de toutes ses sources.", why: "Variante plus ambitieuse de la page 3 ; à garder plutôt que la 3 si l’on veut parler aux gros lecteurs." },
  { id: "everywhere", n: 4, rec: true, title: "Sur votre téléphone et votre ordinateur", sub: "Votre bibliothèque vous suit dans l’app et sur le web.", why: "Rassure, mais n’illustre aucune capacité nouvelle : plutôt une phrase sur l’écran de création de compte." },
  { id: "chat", n: 5, title: "Posez vos questions à la source", sub: "Chaque réponse renvoie au passage d’où elle vient.", why: "Montre la discussion et la confiance qu’elle inspire (le passage cité, surligné à l’ambre)." },
  { id: "revise", n: 6, title: "Révisez sans rien préparer", sub: "Cartes mémo, quiz et notes de cours, générés depuis vos sources.", why: "Le « retenir » de la promesse, rendu concret." },
  { id: "formats", n: 7, title: "Un lien, un fichier, une photo", sub: "Vidéos, articles, podcasts, PDF ou pages photographiées : tout arrive au même endroit.", why: "Répond à « ça marche avec quoi ? ». Redondante avec les pages 1 et 2." },
  { id: "digest", n: 8, title: "Revoyez ce que vous avez enregistré", sub: "Chaque jour et chaque semaine, un digest de vos nouvelles sources, à lire d’un trait.", why: "Fonction propre à Deepn, mais elle ne prend son sens qu’après quelques jours d’usage." },
  { id: "sort", n: 9, title: "Triez en un geste", sub: "Les nouveautés attendent dans Non classés : rangez, approfondissez ou jetez.", why: "Utile, mais c’est de l’organisation : moins désirable avant d’avoir une bibliothèque." },
].map((s) => ({ ...s, art: ART[s.id] }));
const S = Object.fromEntries(SLIDES.map((s) => [s.id, s]));

// =====================================================================================
// Mobile
// =====================================================================================
const dots = (n, on) => Array.from({ length: n }, (_, i) => `<i${i === on ? ` class="on"` : ""}></i>`).join("");
const pager = (n, on) => `<div class="pager">${dots(n, on)}</div>`;
// A subtitle, or, when the slide has points, one short paragraph per promise.
const subBlock = (s, size = 15) => s.points
  ? `<div class="stack" style="gap:10px;margin-top:10px">${s.points.map(([, t]) => `<div style="font-size:${size}px;line-height:1.4;color:var(--text-subtle)">${t}</div>`).join("")}</div>`
  : `<p class="sub">${s.sub}</p>`;
const welcome = (s, on = 0, n = 4) => `<div style="position:absolute;left:0;right:0;top:0;height:470px;background:var(--surface-container-low);border-radius:0 0 36px 36px;overflow:hidden"><div style="position:absolute;left:0;top:54px">${s.art}</div></div>
  <div class="scr" style="padding-top:0"><div style="height:438px"></div>${pager(n, on)}<div style="height:${s.points ? 14 : 22}px"></div>
  <h1 class="h1"${s.points ? ` style="font-size:28px"` : ""}>${s.title}</h1>${s.extra ? `<div style="margin-top:14px">${s.extra}</div>` : subBlock(s)}
  <div class="sp"></div><div class="stack g8">${primary("Commencer")}${btn("J’ai déjà un compte", "ghost")}</div></div>`;

const RULES = ["12 caractères", "Une majuscule", "Une minuscule", "Un chiffre"];
const rules = (met) => badges(RULES.map((t, i) => [t, met[i]]));
const forgot = `<a class="lnk plain" style="font-size:14px">Mot de passe oublié ?</a>`;
const signInFoot = `<p class="foot" style="margin:0">Pas encore de compte ? <a class="lnk">Créer un compte</a></p>`;
const signUpFoot = `<p class="foot" style="margin:0">Déjà un compte ? <a class="lnk">Se connecter</a></p>`;

const providers = (mt = 20) => `<div class="stack g12" style="margin-top:${mt}px">${apple()}${google()}</div><div style="margin:16px 0 12px">${divider("ou")}</div>`;

// Sign-up: one screen, providers first, then e-mail, password with its badges, confirmation.
const register = ({ email = EMAIL, pw = "", met = [0, 0, 0, 0], confirm = "", confirmErr = "", confirmOk = false, ready = false, focus = "" } = {}) =>
  `<div class="scr">${back()}<h1 class="h1" style="font-size:30px;margin-top:4px">Créer votre compte</h1><p class="sub" style="margin-top:6px">Pour retrouver votre bibliothèque partout.</p>
  ${providers(18)}
  <div class="stack g16">${field({ label: "Adresse e-mail", value: email, ph: "vous@exemple.com" })}
  <div class="stack g8">${field({ label: "Mot de passe", value: pw, pw: true, focus: focus === "pw" })}${rules(met)}</div>
  ${field({ label: "Confirmer le mot de passe", value: confirm, pw: true, focus: focus === "confirm", err: confirmErr, ok: confirmOk ? "Les mots de passe correspondent." : "" })}
  ${primary("Créer mon compte", { off: !ready })}</div>
  <div class="sp"></div>${legal("En créant un compte")}<div style="height:8px"></div>${signUpFoot}</div>`;

const M = {};
M.registerEmpty = register({ email: "" });
M.registerTyping = `<div class="scr"><div class="row" style="height:44px;position:relative">${back()}<span style="position:absolute;left:0;right:0;text-align:center;font-weight:650;font-size:16.5px;pointer-events:none">Créer votre compte</span></div>
  <div style="height:10px"></div><div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}
  <div class="stack g8">${field({ label: "Mot de passe", value: "Lecture2", pw: true, focus: true, caret: true })}${rules([0, 1, 1, 1])}</div>
  ${field({ label: "Confirmer le mot de passe", value: "", pw: true })}</div></div>
  ${keyboard({ mode: "text", qt: [`${ic("key-outline", 15)} <b>Mot de passe fort suggéré</b><small>Enregistré dans le trousseau</small>`], ret: "Suivant" })}`;
M.registerValid = register({ pw: "Lecture2aaaa", met: [1, 1, 1, 1], confirm: "Lecture2aaaa", confirmOk: true, ready: true });
M.registerMismatch = register({ pw: "Lecture2aaaa", met: [1, 1, 1, 1], confirm: "Lecture2aaab", confirmErr: "Les deux mots de passe ne correspondent pas." });
M.registerExists = `<div class="scr">${back()}<h1 class="h1" style="font-size:30px;margin-top:4px">Créer votre compte</h1><p class="sub" style="margin-top:6px">Pour retrouver votre bibliothèque partout.</p>
  ${providers(18)}
  <div class="stack g12">${field({ label: "Adresse e-mail", value: EMAIL })}
  ${note("info", "person-circle-outline", "Vous avez déjà un compte", "Cette adresse est déjà inscrite sur Deepn.", `<span class="btn primary sm">Se connecter</span><span class="btn tonal sm">Mot de passe oublié</span>`)}</div>
  <div class="sp"></div>${signUpFoot}</div>`;

const login = ({ err = "" } = {}) => `<div class="scr">${back()}<h1 class="h1" style="font-size:30px;margin-top:4px">Se connecter</h1><p class="sub" style="margin-top:6px">Retrouvez votre bibliothèque.</p>
  ${providers(22)}
  <div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}
  ${field({ label: "Mot de passe", value: "a".repeat(err ? 11 : 14), pw: true, right: forgot, err })}
  <div style="margin-top:4px">${primary("Se connecter")}</div></div>
  <div class="sp"></div>${signInFoot}</div>`;
M.login = login();
M.loginError = login({ err: `Mot de passe incorrect. Réessayez, ou <a class="lnk">réinitialisez-le</a>.` });

M.code = `<div class="scr">${back()}<div style="height:10px"></div>
  <div class="halo" style="width:56px;height:56px">${ic("mail-open-outline", 26)}</div><div style="height:18px"></div>
  <h1 class="h1" style="font-size:28px">Un code vous attend</h1>
  <p class="sub">Code à 6 chiffres envoyé à<br><b style="color:var(--text-main)">${EMAIL}</b> · <a class="lnk">Modifier</a></p>
  <div style="height:24px"></div>${otp("4829")}<div style="height:18px"></div>
  <p class="small" style="margin:0">Pas reçu ? Vérifiez les courriers indésirables, ou <span style="color:var(--text-muted)">renvoyez le code dans 0:42</span>.</p></div>
  ${keyboard({ mode: "num", qt: [`<small>Depuis Mail</small><b>482 913</b>`] })}`;

// =====================================================================================
// Web: the carousel on the left, the form on the right
// =====================================================================================
const roundBtn = (i) => `<span style="width:36px;height:36px;border-radius:50%;background:var(--surface);box-shadow:inset 0 0 0 1px var(--outline-variant);display:flex;align-items:center;justify-content:center">${ic(i, 18)}</span>`;
const web = (s, on, inner) => `<div style="flex:1;display:flex">
  <div style="width:600px;flex:none;position:relative;background:var(--surface-container-low)">
    <div style="position:absolute;left:44px;top:30px">${brand()}</div>
    <div style="position:absolute;left:93px;top:70px">${s.art}</div>
    <div style="position:absolute;left:64px;right:64px;top:500px"><div class="h1" style="font-size:32px">${s.title}</div>${subBlock(s, 16)}</div>
    <div style="position:absolute;left:64px;right:64px;bottom:30px;display:flex;align-items:center;justify-content:space-between"><div class="pager" style="justify-content:flex-start">${dots(4, on)}</div><div class="row" style="gap:8px">${roundBtn("chevron-back")}${roundBtn("chevron-forward")}</div></div>
  </div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center"><div style="width:380px">${inner}</div></div></div>`;
const W = {};
W.register = web(S.essentiel, 0, `<h1 class="h1" style="font-size:28px">Créer votre compte</h1><p class="sub" style="font-size:15px;margin-top:6px">Pour retrouver votre bibliothèque partout.</p>
  ${providers(20)}<div class="stack g12">${field({ label: "Adresse e-mail", value: EMAIL })}
  <div class="stack g8">${field({ label: "Mot de passe", value: "Lecture2aa", pw: true, focus: true })}${rules([0, 1, 1, 1])}</div>
  ${field({ label: "Confirmer le mot de passe", value: "", pw: true })}<div style="margin-top:4px">${primary("Créer mon compte", { off: true })}</div></div>
  <div style="height:14px"></div>${legal("En créant un compte")}<div style="height:8px"></div>${signUpFoot}`);
W.login = web(S.folder, 2, `<h1 class="h1" style="font-size:28px">Se connecter</h1><p class="sub" style="font-size:15px;margin-top:6px">Retrouvez votre bibliothèque.</p>
  ${providers(22)}<div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}${field({ label: "Mot de passe", value: "a".repeat(14), pw: true, right: forgot, focus: true })}${primary("Se connecter")}</div>
  <div style="height:22px"></div>${signInFoot}`);
W.code = web(S.share, 1, `<div class="halo">${ic("mail-open-outline", 30)}</div><div style="height:20px"></div><h1 class="h1" style="font-size:28px">Un code vous attend</h1>
  <p class="sub" style="font-size:15px">Envoyé à <b style="color:var(--text-main)">${EMAIL}</b> · <a class="lnk">Modifier</a></p><div style="height:24px"></div>${otp("48")}
  <div style="height:16px"></div><p class="small" style="margin:0">Pas reçu ? Vérifiez les courriers indésirables, ou <span style="color:var(--text-muted)">renvoyez le code dans 0:42</span>.</p>
  <div style="height:20px"></div>${btn(`${ic("open-outline", 18)} Ouvrir Gmail`, "tonal")}`);

// =====================================================================================
// Page
// =====================================================================================
const TEXTS = [
  ["Accueil", "(aucun : l’app s’ouvre sur « Bon retour »)", "Une page de carrousel par facette ; la première : « Gardez ce qui compte. Approfondissez. Apprenez. » · « Enregistrez podcasts, vidéos, reels, articles web, PDF et bien plus. Parlez de votre contenu avec l’IA. Créez des quiz, fiches et résumés pour réviser. »"],
  ["Boutons d’accueil", "—", "« Commencer » · « J’ai déjà un compte », sur toutes les pages du carrousel"],
  ["Connexion", "« Bon retour » · « Connectez-vous pour accéder à votre bibliothèque »", "« Se connecter » · « Retrouvez votre bibliothèque. »"],
  ["Inscription", "« Créer un compte » · « Commencez à bâtir votre base de connaissances »", "« Créer votre compte » · « Pour retrouver votre bibliothèque partout. »"],
  ["Boutons sociaux", "« Continuer avec Google » · « Se connecter avec Apple »", "« Continuer avec Apple » · « Continuer avec Google », sur les deux écrans"],
  ["Mot de passe oublié", "lien sous le formulaire", "« Mot de passe oublié ? » sur la ligne du libellé « Mot de passe »"],
  ["Règles du mot de passe", "« 12 caractères min. · majuscule · minuscule · chiffre » en gris", "Badges « 12 caractères » · « Une majuscule » · « Une minuscule » · « Un chiffre », gris puis verts"],
  ["Confirmation", "(pas de champ)", "« Confirmer le mot de passe » ; « Les mots de passe correspondent. » ou « Les deux mots de passe ne correspondent pas. »"],
  ["Mauvais mot de passe", "Bandeau rouge en haut", "Sous le champ : « Mot de passe incorrect. Réessayez, ou réinitialisez-le. »"],
  ["Compte existant", "Bandeau rouge « error.emailAlreadyExists »", "Encart neutre : « Vous avez déjà un compte — Cette adresse est déjà inscrite sur Deepn. » [Se connecter] [Mot de passe oublié]"],
  ["Code", "« Vérifier l’e-mail » · « Saisissez le code reçu par e-mail. »", "« Un code vous attend » · « Code à 6 chiffres envoyé à … · Modifier »"],
  ["Après vérification", "(passage direct à la langue)", "Inchangé : la fenêtre de la langue de lecture s’ouvre directement (décision de l’owner du 2026-10-23)"],
  ["Mentions", "aucune", "« En créant un compte, vous acceptez les Conditions d’utilisation et la Politique de confidentialité de Deepn. »"],
];
const CONS = [
  ["Ce qui change", "Un écran d’accueil à carrousel (nouvelle route, devant <code>/(auth)/login</code>) ; <code>login.tsx</code> et <code>register.tsx</code> deviennent des écrans poussés depuis l’accueil, avec retour ; un composant de badges ; un champ de confirmation ; le code à 6 cases. Sur le web, <code>AuthPage.tsx</code> passe en écran partagé, carrousel à gauche."],
  ["Backend", "Aucun. La règle du mot de passe reste celle de <code>cognito.tf</code> ; si elle change, seuls les badges changent."],
  ["Carrousel", "Illustrations dessinées en composants (pas en images) pour être traduites dans les 11 langues et suivre le thème sombre. La page « Partager » a une variante Android (icône et feuille de partage du système). La liste des apps et des formats doit venir de <code>SHARE_TARGETS</code> (servie par <code>GET /api/pricing</code>, comme sur l’écran d’abonnement), pas être recopiée : elle suivra ainsi ce que les workers acceptent. Les logos tiers relèvent de leurs chartes (logo officiel, non modifié) : à vérifier une par une avant publication."],
  ["Effort", "M"],
];

const page_ = page({
  title: "Authentification — C — version finale",
  body: `<div class="kicker">Authentification · direction C retenue</div><h1>« Vitrine », version finale</h1>
  <p class="lede">Le premier écran montre ce que fait Deepn, page par page. « Commencer » et « J’ai déjà un compte » ouvrent chacun un écran plein, pas une feuille. Les deux écrans ont la même structure : Apple, Google, « ou », puis le formulaire e-mail directement, sans étape « Continuer avec un e-mail ».</p>

  <h2>1. Pages du carrousel : propositions</h2>
  <p>Neuf propositions, une facette chacune. Les quatre marquées <span class="tag y">Retenue</span> sont celles que l’owner a gardées le 2026-10-23, dans cet ordre ; les cinq autres restent pour mémoire. Les quatre marquées <span class="tag y">Conseillée</span> suivent la promesse de l’app (enregistrer, comprendre, retenir) ; au-delà de quatre pages, la plupart des gens ne vont plus au bout. Garde celles que tu veux : l’ordre suit les numéros.</p>
  <div class="cells">${SLIDES.map((s) => phone(welcome(s, s.rec ? s.n - 1 : 0, 4), { title: `${s.n}. ${s.title.replaceAll("<br>", " ")}${s.rec ? ` <span class="tag y">Retenue</span>` : ""}`, caption: s.why })).join("")}</div>

  <h2>2. Partager et importer : iOS et Android</h2>
  <p>La page 2 du carrousel sur les deux systèmes. Chaque version montre l’icône de partage de son système (carré et flèche sur iOS, trois points reliés sur Android). Les apps sont celles que Deepn accepte réellement (<code>SHARE_TARGETS</code>) : YouTube, TikTok, Instagram, X, Spotify, Apple Podcasts (iOS seulement), Deezer, WhatsApp (notes vocales), le navigateur (Safari, Chrome) et l’app de notes (Notes, Keep).</p>
  <div class="cells">${["ios", "android"].map((os) => phone(welcome({ ...S.share, art: twoGestures(os) }, 1, 4), { android: os === "android", title: os === "ios" ? "iOS" : "Android" })).join("")}</div>
  <p class="small" style="margin-top:20px">Sur Android : icône de partage d’Android, icônes rondes, Chrome et Keep à la place de Safari et Notes, pas d’Apple Podcasts. Formats acceptés à l’import : ${FORMATS_LINE}</p>

  <h2>3. Parcours mobile</h2>
  <div class="cells">
  ${phone(welcome(S.essentiel), { title: "Accueil", caption: "Le carrousel défile au doigt ; les deux boutons restent fixes, quelle que soit la page." })}
  ${phone(M.registerEmpty, { title: "Commencer → Créer votre compte", caption: "Écran plein, poussé depuis l’accueil (retour en haut à gauche). Les quatre critères sont visibles avant la saisie, en gris : on sait ce qu’on doit écrire avant d’essayer." })}
  ${phone(M.registerTyping, { title: "Saisie du mot de passe", caption: "Chaque badge passe au vert dès que le critère est rempli (ici, il manque la longueur). iOS propose un mot de passe fort, que les règles acceptent. L’écran défile pour garder le champ au-dessus du clavier." })}
  ${phone(M.registerValid, { title: "Tout est bon", caption: "Quatre badges verts, confirmation identique : le bouton s’active. Pas de rouge tant que rien n’a échoué." })}
  ${phone(M.registerMismatch, { title: "Confirmation différente", caption: "Message sous le champ de confirmation, affiché quand on le quitte, pas pendant la frappe. L’œil de chaque champ permet de comparer." })}
  ${phone(M.registerExists, { title: "Adresse déjà inscrite", caption: "Encart neutre, avec les deux issues en boutons (task-530). Les champs du mot de passe disparaissent : il n’y a plus rien à créer." })}
  ${phone(M.login, { title: "J’ai déjà un compte → Se connecter", caption: "Même structure que l’inscription : Apple, Google, « ou », adresse, mot de passe. Le trousseau remplit les deux champs d’un coup." })}
  ${phone(M.loginError, { title: "Mot de passe incorrect", caption: "L’erreur est sous le champ, avec la sortie dans la phrase. L’adresse est conservée." })}
  ${phone(M.code, { title: "Code de vérification", caption: "Après l’inscription par e-mail. Six cases sur un seul champ <code>oneTimeCode</code> : iOS propose le code reçu dans Mail ; validation au sixième chiffre." })}
  ${phone(login(), { dark: true, title: "Thème sombre", caption: "Bouton Apple blanc sur fond sombre, Google en variante sombre de sa charte." })}
  </div>

  <h2>4. Web app (ordinateur)</h2>
  <p class="small">Le carrousel occupe la moitié gauche et défile seul (flèches et points pour le piloter) ; le formulaire est à droite. Inscription et connexion sont deux pages, <code>/register</code> et <code>/login</code>, reliées par le lien du bas, comme sur mobile. Sur téléphone, la web app reprend les écrans mobiles (décision de l’owner du 2026-10-11).</p>
  <div class="cells">
  ${desk(W.register, { url: "‹domaine›/register", title: "Créer votre compte", caption: "Badges sous le mot de passe, confirmation en dessous." })}
  ${desk(W.login, { title: "Se connecter", caption: "Aucune étape intermédiaire : les champs sont là dès l’arrivée, le gestionnaire de mots de passe les remplit." })}
  ${desk(W.code, { url: "‹domaine›/register", title: "Code", caption: "Le code se colle d’un coup ; « Ouvrir Gmail » quand le domaine de l’adresse est connu." })}
  </div>

  <h2>Textes</h2><div class="panel">${textTable(TEXTS)}</div>
  <h2>Ce qui change</h2><div class="panel"><table class="t"><tbody>${CONS.map(([k, v]) => `<tr><th style="width:20%">${k}</th><td>${v}</td></tr>`).join("")}</tbody></table></div>`,
});
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "code.html"), page_);
console.log("ok");
