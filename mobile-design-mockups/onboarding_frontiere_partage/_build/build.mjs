// Builds onboarding_frontiere_partage/code.html: the share page of the intro carousel, with a clearer
// border between the share-sheet example and the rest of the screen (TestFlight feedback
// ADZeDymcOHjaBxBEw0v01wY, build 21, 2026-11-01).
// Usage (from the repository root): node mobile-design-mockups/onboarding_frontiere_partage/_build/build.mjs
// Render (Node 20 needs --experimental-websocket): DIRS=../onboarding_frontiere_partage node --experimental-websocket mobile-design-mockups/auth_directions/_build/shoot.mjs [frames-dir]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COVERS, ic, phone, primary, page } from "../../auth_directions/_build/kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..");

// =====================================================================================
// Pieces taken from onboarding_apres_connexion/_build/build.mjs (the shipped intro), unchanged
// =====================================================================================
const thumb = (c, s = 40) => `<span style="width:${s}px;height:${s}px;border-radius:10px;background:${c.bg};flex:none;display:flex;align-items:center;justify-content:center;color:#fff">${ic(c.icon, s * 0.45)}</span>`;
const hairline = `<div style="height:1px;background:var(--sheet-line)"></div>`;
const FAVICON = readFileSync(join(HERE, "../../../web/public/favicon.svg"), "utf8");
const PLANES = FAVICON.match(/<g[\s\S]*<\/g>/)[0].replace('stroke="#1c1b1a"', 'stroke="currentColor"');
const logoPlanes = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 512 512" aria-hidden="true" style="position:absolute;inset:0">${PLANES}</svg>`;
const appIcon = (s = 64, round = false) => `<span style="position:relative;width:${s}px;height:${s}px;border-radius:${round ? "50%" : `${Math.round(s * 0.23)}px`};background:var(--primary);color:var(--on-primary);display:inline-flex;flex:none;overflow:hidden">${logoPlanes(s)}</span>`;
const LOGOS = JSON.parse(readFileSync(join(HERE, "../../auth_directions/_build/logos.json"), "utf8"));
const logo = (k, s, fill) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${fill}" d="${LOGOS[k]}"/></svg>`;
const SHARE_ICON = { ios: "share-outline", android: "share-social-outline" };
const APPS = {
  youtube: { bg: "#fff", fg: "#FF0000", line: true },
  tiktok: { bg: "#000", fg: "#fff" },
  instagram: { bg: "linear-gradient(45deg,#feda75,#fa7e1e 30%,#d62976 60%,#962fbf 85%,#4f5bd5)", fg: "#fff" },
  x: { bg: "#000", fg: "#fff" },
  spotify: { bg: "#000", fg: "#1ED760" },
  applepodcasts: { bg: "linear-gradient(180deg,#f452ff,#832bc1)", fg: "#fff" },
  deezer: { bg: "#A238FF", fg: "#fff" },
  whatsapp: { bg: "#25D366", fg: "#fff" },
  safari: { bg: "#fff", fg: "#006CFF", line: true },
  googlechrome: { bg: "#fff", fg: "#4285F4", line: true },
  notes: { bg: "#fff", line: true },
  googlekeep: { bg: "#FFBB00", fg: "#fff" },
};
const APP_LIST = {
  ios: ["youtube", "tiktok", "instagram", "x", "spotify", "applepodcasts", "deezer", "whatsapp", "safari", "notes"],
  android: ["youtube", "tiktok", "instagram", "x", "spotify", "deezer", "whatsapp", "googlechrome", "googlekeep"],
};
const appTile = (k, s = 44, os = "ios") => {
  const a = APPS[k];
  const r = os === "android" ? "50%" : `${Math.round(s * 0.23)}px`;
  const glyph = k === "notes"
    ? `<span style="position:absolute;inset:0;border-radius:inherit;overflow:hidden"><span style="display:block;height:30%;background:#ffd60a"></span>${[0, 1, 2].map((i) => `<span style="display:block;height:1px;background:#d8d8dc;margin:${i ? s * 0.12 : s * 0.14}px ${s * 0.14}px 0"></span>`).join("")}</span>`
    : logo(k, Math.round(s * 0.56), a.fg);
  return `<span style="width:${s}px;height:${s}px;border-radius:${r};background:${a.bg};flex:none;display:inline-flex;align-items:center;justify-content:center;position:relative;${a.line ? "box-shadow:inset 0 0 0 1px rgba(0,0,0,.1)" : ""}">${glyph}</span>`;
};
const dim = (inner) => `<div style="opacity:.32">${inner}</div>`;
const person = (n) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:62px"><span style="width:52px;height:52px;border-radius:50%;background:var(--sheet-chip);display:flex;align-items:center;justify-content:center;color:var(--text-subtle)">${ic("person-outline", 24)}</span><span style="font-size:11px;color:var(--text-subtle)">${n}</span></div>`;
const sysApp = (label, tile, on = false) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:70px;${on ? "" : "opacity:.32"}">
  <span style="position:relative;display:inline-flex">${on ? `<span style="position:absolute;inset:-6px;border-radius:20px;box-shadow:0 0 0 2.5px var(--primary);"></span>` : ""}${tile}</span>
  <span style="font-size:11.5px;white-space:nowrap;${on ? "font-weight:700;color:var(--text-main)" : "color:var(--text-subtle)"}">${label}</span></div>`;
const plainTile = (bg, fg, icon, s = 56, round = false) => `<span style="width:${s}px;height:${s}px;border-radius:${round ? "50%" : `${Math.round(s * 0.23)}px`};background:${bg};color:${fg};display:inline-flex;align-items:center;justify-content:center;flex:none">${ic(icon, Math.round(s * 0.5))}</span>`;

// The sheet's own colours are variables, so each direction can lift it without touching the drawing.
// Defaults are today's: surface on the screen, rules and chips in the container greys.
const SHEET_VARS = "--sheet-bg:var(--surface);--sheet-line:var(--surface-container);--sheet-chip:var(--surface-container-high)";

function sheetBody(os, { people: withPeople = true } = {}) {
  const ios = os === "ios";
  const head = `<div class="row" style="gap:12px;padding:14px 16px 12px">${thumb(COVERS[0], 44)}<div style="flex:1;min-width:0;font-size:14px;font-weight:650;line-height:1.3">Le cerveau la nuit<div style="font-size:12px;font-weight:400;color:var(--text-subtle)">youtube.com</div></div>${ios ? `<span style="width:30px;height:30px;border-radius:50%;background:var(--sheet-line);display:flex;align-items:center;justify-content:center;color:var(--text-subtle)">${ic("close", 16)}</span>` : ""}</div>`;
  const people = `<div class="row" style="gap:10px;padding:12px 14px;justify-content:space-between">${["Léa", "Hugo", "Inès", "Paul", "Zoé"].map(person).join("")}</div>`;
  const apps = ios
    ? `<div class="row" style="gap:4px;padding:14px 10px 12px;justify-content:space-between">${sysApp("Deepn", appIcon(56), true)}${sysApp("Messages", plainTile("#34c759", "#fff", "chatbubble-outline"))}${sysApp("Mail", plainTile("#1f8bff", "#fff", "mail-outline"))}${sysApp("Notes", appTile("notes", 56))}${sysApp("Plus", plainTile("var(--sheet-chip)", "var(--text-subtle)", "ellipsis-horizontal"))}</div>`
    : `<div class="row" style="gap:4px;padding:14px 10px 12px;justify-content:space-between">${sysApp("Deepn", appIcon(56, true), true).replace("border-radius:20px", "border-radius:50%")}${sysApp("Messages", plainTile("#1a73e8", "#fff", "chatbubble-outline", 56, true))}${sysApp("Gmail", plainTile("#fff", "#ea4335", "mail-outline", 56, true))}${sysApp("Keep", appTile("googlekeep", 56, "android"))}${sysApp("Drive", plainTile("#fff", "#188038", "cloud-upload-outline", 56, true))}</div>`;
  const actions = (ios ? [["copy-outline", "Copier le lien"], ["book-outline", "Ajouter à la liste de lecture"], ["heart-outline", "Ajouter aux favoris"], ["search-outline", "Rechercher dans la page"]] : [["copy-outline", "Copier le lien"], ["open-outline", "Ouvrir dans le navigateur"], ["download-outline", "Enregistrer"]])
    .map(([i, t], n) => `<div class="row" style="gap:12px;padding:13px 16px;font-size:14px;${n ? "border-top:1px solid var(--sheet-line)" : ""}">${ic(i, 18)}${t}</div>`).join("");
  return `${ios ? "" : `<div style="width:36px;height:4px;border-radius:2px;background:var(--outline-variant);margin:10px auto 0"></div>`}${head}${withPeople ? `${hairline}${dim(people)}` : ""}${hairline}${apps}${hairline}${dim(actions)}`;
}
const sheet = (os, style, opts) => `<div style="position:absolute;background:var(--sheet-bg);border-radius:${os === "ios" ? 22 : 26}px;overflow:hidden;${style}">${sheetBody(os, opts)}</div>`;

// =====================================================================================
// The directions — each returns the illustration placed under the text, in screen coordinates
// =====================================================================================
const ART_TOP = 326; // where today's sheet starts, under « Fonctionne avec »
const glow = (top = 330) => `<div style="position:absolute;left:-80px;right:-80px;top:${top}px;height:460px;background:radial-gradient(closest-side,var(--primary-30),transparent)"></div>`;

// Today: the sheet drawn straight on the screen's background, with a shadow dark mode cannot show.
const today = (os) => `${glow()}<div style="position:absolute;left:0;right:0;top:${ART_TOP}px;height:760px;${SHEET_VARS}">${sheet(os, "left:20px;right:20px;top:8px;box-shadow:var(--shadow-lift)")}</div>`;

// A — Contour: same sheet, lifted one step (surface-container) and outlined, as the system draws its own
// sheets in dark mode. Smallest change; the border is a line, nothing more.
const contour = (os) => `${glow()}<div style="position:absolute;left:0;right:0;top:${ART_TOP}px;height:760px;--sheet-bg:var(--lift-bg);--sheet-line:var(--lift-line);--sheet-chip:var(--lift-chip)">${sheet(os, "left:20px;right:20px;top:8px;box-shadow:0 0 0 1px var(--lift-edge),0 24px 48px rgba(0,0,0,.28)")}</div>`;

// B — In a phone: the share sheet is shown where it lives, on a phone, over the app it was opened from
// (YouTube, dimmed under the system scrim). The frame is the border; it is the same device as the one on
// page 2 (« Sur votre téléphone et votre ordinateur »), so the two pages draw the same object.
// The screen is drawn at 392 points wide and scaled into the frame. The people row is left out: drawn at
// 82 % it would push the row of apps under the fade, and it says nothing about Deepn.
const PHONE_W = 340, BEZEL = 9, SCREEN_W = PHONE_W - 2 * BEZEL, INNER_W = 392, K = SCREEN_W / INNER_W;
function youtube(os) {
  const ios = os === "ios";
  const bars = (ws) => ws.map((w) => `<div style="height:9px;width:${w};border-radius:5px;background:var(--yt-bar)"></div>`).join("");
  return `<div style="position:absolute;inset:0;background:var(--yt-bg)">
    <div style="height:${ios ? 54 : 40}px"></div>
    <div style="height:220px;background:${COVERS[0].bg};display:flex;align-items:center;justify-content:center;color:#fff">${ic("play-circle-outline", 54)}</div>
    <div style="padding:16px 14px;display:flex;flex-direction:column;gap:10px">${bars(["86%", "54%"])}
      <div class="row" style="gap:10px;margin-top:8px"><span style="width:34px;height:34px;border-radius:50%;background:var(--yt-bar)"></span>${bars(["30%"])}</div></div>
    <div style="position:absolute;inset:0;background:rgba(0,0,0,.42)"></div></div>`;
}
function inPhone(os, { top = ART_TOP + 8, sheetTop = 196 } = {}) {
  const ios = os === "ios";
  const left = (414 - PHONE_W) / 2;
  const notch = ios
    ? `<span style="position:absolute;left:50%;top:10px;width:96px;height:28px;margin-left:-48px;border-radius:16px;background:#000;z-index:3"></span>`
    : `<span style="position:absolute;left:50%;top:13px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#000;z-index:3"></span>`;
  const sheetStyle = ios ? `left:6px;right:6px;top:${sheetTop}px;border-radius:30px` : `left:0;right:0;top:${sheetTop}px;border-radius:26px 26px 0 0`;
  return `${glow(top - 20)}
  <div style="position:absolute;left:${left}px;top:${top}px;width:${PHONE_W}px;height:720px;border-radius:${ios ? 50 : 40}px;background:var(--bezel);padding:${BEZEL}px;box-shadow:inset 0 0 0 1.5px var(--bezel-edge),0 30px 60px rgba(0,0,0,.22)">
    <div style="position:relative;width:${SCREEN_W}px;height:100%;border-radius:${ios ? 41 : 32}px;overflow:hidden">${notch}
      <div style="position:absolute;left:0;top:0;width:${INNER_W}px;height:${Math.round(720 / K)}px;transform:scale(${K});transform-origin:0 0;--sheet-bg:var(--sys-sheet);--sheet-line:var(--sys-line);--sheet-chip:var(--sys-chip)">
        ${youtube(os)}${sheet(os, sheetStyle, { people: false })}
      </div></div></div>`;
}

// C — Stage: the illustration sits on its own panel, a darker (light: warmer) ground with a hairline edge,
// the glow inside it. The border is the panel's edge; the sheet keeps today's drawing.
const stage = (os) => `<div style="position:absolute;left:16px;right:16px;top:${ART_TOP - 14}px;height:700px;border-radius:30px;background:var(--stage-bg);box-shadow:inset 0 0 0 1px var(--stage-edge);overflow:hidden;${SHEET_VARS}">
    <div style="position:absolute;left:-90px;right:-90px;top:10px;height:440px;background:radial-gradient(closest-side,var(--primary-30),transparent)"></div>
    ${sheet(os, "left:26px;right:26px;top:26px;box-shadow:var(--shadow-lift)")}</div>`;

// =====================================================================================
// The intro screen (as shipped: text on top, art below fading under « Suivant », dots)
// =====================================================================================
const pager = (n, on) => `<div class="pager">${Array.from({ length: n }, (_, i) => `<i${i === on ? ` class="on"` : ""}></i>`).join("")}</div>`;
const inlineIcon = (name) => `<span style="display:inline-flex;vertical-align:-3px;color:var(--text-main)">${ic(name, 17)}</span>`;
const introFade = `<div style="position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(to bottom,transparent,var(--surface-container-low) 46%)"></div>`;
const worksWith = (os) => `<div style="margin:22px 8px 0">
  <div class="row" style="gap:10px;margin-bottom:12px;font-size:12px;color:var(--text-subtle)"><span style="flex:1;height:1px;background:var(--outline-variant)"></span>Fonctionne avec<span style="flex:1;height:1px;background:var(--outline-variant)"></span></div>
  <div class="row" style="gap:6px;justify-content:center">${APP_LIST[os].map((k) => appTile(k, 28, os)).join("")}</div></div>`;
const shareIntro = (art, os = "ios") => `<div style="position:absolute;inset:0;overflow:hidden;background:var(--surface-container-low)">${art(os)}${introFade}</div>
  <div class="scr" style="padding-top:0;text-align:center">
  <div style="height:30px"></div><h1 class="h1" style="font-size:30px">Enregistrez depuis<br>n’importe quelle app</h1>
  <p class="sub" style="margin-top:10px">${os === "ios"
    ? `Dans YouTube, Instagram, Spotify ou Safari, touchez ${inlineIcon(SHARE_ICON.ios)} puis <b style="color:var(--text-main)">Deepn</b>. Le média arrive dans votre bibliothèque.`
    : `Dans YouTube, Instagram, Spotify ou Chrome, touchez ${inlineIcon(SHARE_ICON.android)} Partager, puis <b style="color:var(--text-main)">Deepn</b>. Le média arrive dans votre bibliothèque.`}</p>
  ${worksWith(os)}
  <div class="sp"></div>${primary("Suivant")}<div style="height:18px"></div>${pager(2, 0)}</div>`;

// Direction tokens, light then dark. Everything comes from mobile/src/constants/theme.ts except the
// device colours (bezel: the #1c1b1a of page 2's phone; its edge, a titanium grey so the frame still
// reads on a dark screen) and the system sheet (iOS's own grouped greys, since the sheet is the system's).
const TOKENS = `<style>
.phone { --lift-bg:#ffffff; --lift-line:#f1edea; --lift-chip:#ebe7e5; --lift-edge:#c8c7bd;
  --bezel:#1c1b1a; --bezel-edge:#3d3a36; --sys-sheet:#ffffff; --sys-line:#ececec; --sys-chip:#e9e9eb; --yt-bg:#ffffff; --yt-bar:#e5e5e5;
  --stage-bg:#f1edea; --stage-edge:#e3ded9; }
.phone.dark { --lift-bg:#2d2a25; --lift-line:#37332c; --lift-chip:#403b33; --lift-edge:#4a453d;
  --bezel:#0b0a09; --bezel-edge:#5a544c; --sys-sheet:#1c1c1e; --sys-line:#2c2c2e; --sys-chip:#3a3a3c; --yt-bg:#0f0f0f; --yt-bar:#272727;
  --stage-bg:#171511; --stage-edge:#3d3932; }
.reco { display:inline-block; margin-left:8px; padding:2px 9px; border-radius:999px; background:var(--primary); color:var(--on-primary); font-size:12px; font-weight:700; vertical-align:2px; }
</style>`;

// =====================================================================================
// Page
// =====================================================================================
const CONS = [
  ["Mobile", "<code>ShareSheetArt</code> (<code>mobile/src/components/intro/IntroArt.tsx</code>) est posé dans un cadre de téléphone, sur un écran YouTube grisé ; la feuille prend les gris du système (iOS) au lieu de <code>surface</code>. Le cadre reprend celui du téléphone de <code>EverywhereArt</code> (#1c1b1a), avec un bord titane pour le thème sombre. <code>intro.tsx</code> ne change pas : le téléphone sort par le bas et s’efface sous « Suivant » comme la feuille aujourd’hui."],
  ["Android", "Même cadre, coins moins arrondis, caméra ronde au lieu de la Dynamic Island ; la feuille garde sa poignée et colle au bas de l’écran."],
  ["Textes", "Aucun changement."],
  ["Taille", "La feuille est dessinée à 82 % de sa taille actuelle : l’icône Deepn passe de 56 à 46 pt à l’écran, toujours la plus grande et la seule en couleur pleine. La rangée de contacts grisée est retirée : à cette taille, elle repoussait la rangée des apps sous le dégradé du bouton, et elle ne dit rien de Deepn."],
];

const page_ = page({
  title: "Intro : frontière de l’exemple de partage",
  body: `${TOKENS}<div class="kicker">Retour TestFlight ADZeDymcOHjaBxBEw0v01wY · build 21 · 2026-11-01</div>
  <h1>Marquer la frontière entre l’exemple de partage et le reste</h1>
  <p class="lede">Retour : « Il faut plus marquer visuellement la frontière entre l’écran qui montre l’exemple de partage depuis YouTube, et le reste. » La capture est en thème sombre. La feuille y est dessinée en <code>surface</code> (#211e19) sur le fond <code>surfaceContainerLow</code> (#262320), un contraste de 1,06:1. L’ombre portée ne se voit pas sur un fond sombre. Rien ne dit où finit l’exemple et où commence l’écran (en clair, c’est à peine mieux : 1,10:1).</p>

  <h2>Trois façons de marquer la frontière (thème sombre, celui du retour)</h2>
  <div class="cells">
  ${phone(shareIntro(today), { dark: true, title: "Aujourd’hui", caption: "La feuille se fond dans le fond de l’écran ; seules les rangées grisées la délimitent." })}
  ${phone(shareIntro(contour), { dark: true, title: "A · Contour", caption: "Même feuille, un ton plus clair que le fond et cernée d’un filet. Changement minimal, mais elle reste un rectangle posé sur l’écran : on ne voit toujours pas qu’il s’agit d’une autre app." })}
  ${phone(shareIntro((os) => inPhone(os)), { dark: true, title: "B · Dans un téléphone (recommandé)", caption: "La feuille est montrée là où on la verra : sur un iPhone, par-dessus YouTube grisé. Le cadre du téléphone fait la frontière, et dit en plus « ceci se passe dans une autre app ». C’est aussi l’objet de la page 2, donc les deux pages se répondent." })}
  ${phone(shareIntro(stage), { dark: true, title: "C · Scène", caption: "L’illustration posée sur un panneau plus sombre, bord fin. La frontière est nette, mais c’est un cadre de plus, sans rien dire du contexte." })}
  </div>

  <h2>B, recommandé : thème clair et Android</h2>
  <p>Le cadre est le téléphone noir de la page 2 (#1c1b1a). En sombre, un bord titane le détache du fond, sinon un téléphone noir sur fond sombre aurait le même défaut. La feuille et YouTube prennent les couleurs du système et de YouTube, pas celles de Deepn : c’est ce que la personne verra en vrai. Seuls l’icône Deepn et son anneau ambre restent en couleur pleine.</p>
  <div class="cells">
  ${phone(shareIntro((os) => inPhone(os)), { title: "B · iOS, clair" })}
  ${phone(shareIntro((os) => inPhone(os), "android"), { android: true, dark: true, title: "B · Android, sombre", caption: "Feuille du bas avec poignée, collée au bas de l’écran ; caméra ronde." })}
  ${phone(shareIntro((os) => inPhone(os), "android"), { android: true, title: "B · Android, clair" })}
  </div>

  <h2>Ce qui change si B est retenu</h2><div class="panel"><table class="t"><tbody>${CONS.map(([k, v]) => `<tr><th style="width:18%">${k}</th><td>${v}</td></tr>`).join("")}</tbody></table></div>`,
});
writeFileSync(join(OUT, "code.html"), page_);
console.log("ok");
