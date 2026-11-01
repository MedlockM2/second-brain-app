// Builds onboarding_apres_connexion/code.html: the two-page carousel shown once after the first sign-in,
// the sign-in screen with the app's logo (new signed-out entry point), the « Signaler un bug » screen of
// the iOS beta, and the left panel of the web sign-in pages (TestFlight feedback AHZj_EmKyk_-POh6f05H_SE).
// Usage (from the repository root): node mobile-design-mockups/onboarding_apres_connexion/_build/build.mjs
// Render: DIRS=../onboarding_apres_connexion node mobile-design-mockups/auth_directions/_build/shoot.mjs [frames-dir]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EMAIL, COVERS, ic, phone, desk, brand, apple, google, primary, btn, divider, field, page, textTable,
} from "../../auth_directions/_build/kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..");
const EXTRA = JSON.parse(readFileSync(join(HERE, "icons-extra.json"), "utf8"));
const extraSprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(EXTRA.paths)
  .map(([n, d]) => `<symbol id="i-${n}" viewBox="${EXTRA.viewBox}"><path d="${d}"/></symbol>`).join("")}</svg>`;

// =====================================================================================
// Shared pieces
// =====================================================================================
const box = (inner, h = 416) => `<div style="position:relative;width:414px;height:${h}px">${inner}</div>`;
const card = (style, inner) => `<div style="position:absolute;background:var(--surface);border-radius:16px;box-shadow:var(--shadow-lift);${style}">${inner}</div>`;
const bar = (w, h = 8, c = "var(--surface-container-high)") => `<div style="width:${w};height:${h}px;border-radius:${h / 2}px;background:${c}"></div>`;
const thumb = (c, s = 40) => `<span style="width:${s}px;height:${s}px;border-radius:10px;background:${c.bg};flex:none;display:flex;align-items:center;justify-content:center;color:#fff">${ic(c.icon, s * 0.45)}</span>`;
const hairline = `<div style="height:1px;background:var(--surface-container)"></div>`;

// The Deepn logo itself: the three planes of web/public/favicon.svg, the source mobile/scripts/make_icons.py
// renders icon.png and splash.png from. Not Ionicons' « layers-outline », whose planes are drawn differently.
// Drawn at the place they hold in icon.png (full-bleed 512 square, scale 1), so the glyph is exactly the icon's.
const FAVICON = readFileSync(join(HERE, "../../../web/public/favicon.svg"), "utf8");
const PLANES = FAVICON.match(/<g[\s\S]*<\/g>/)[0].replace('stroke="#1c1b1a"', 'stroke="currentColor"');
const logoPlanes = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 512 512" aria-hidden="true" style="position:absolute;inset:0">${PLANES}</svg>`;
// The app icon as the store and the home screen show it (mobile/assets/icon.png): rounded square on iOS,
// circle where Android masks it.
const appIcon = (s = 64, round = false) => `<span style="position:relative;width:${s}px;height:${s}px;border-radius:${round ? "50%" : `${Math.round(s * 0.23)}px`};background:var(--primary);color:var(--on-primary);display:inline-flex;flex:none;overflow:hidden">${logoPlanes(s)}</span>`;

// Logos: Simple Icons paths (CC0) kept in auth_directions/_build/logos.json. Same list as the shipped
// carousel (mobile/src/components/welcome/WelcomeArt.tsx, TILES), i.e. SHARE_TARGETS.
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
// « Fonctionne avec » between two hairlines, then every app that can share to Deepn.
const worksWith = (os, top, size = 28) => `<div style="position:absolute;left:28px;right:28px;top:${top}px">
  <div class="row" style="gap:10px;margin-bottom:12px;font-size:12px;color:var(--text-subtle)"><span style="flex:1;height:1px;background:var(--outline-variant)"></span>Fonctionne avec<span style="flex:1;height:1px;background:var(--outline-variant)"></span></div>
  <div class="row" style="gap:6px;justify-content:center">${APP_LIST[os].map((k) => appTile(k, size, os)).join("")}</div></div>`;

// =====================================================================================
// Carousel page A — the system share sheet, Deepn singled out (after Readwise Reader)
// =====================================================================================
// What is drawn is what the system really shows: on iOS the row of apps names it « Deepn », as the owner
// sees it on an iPhone (not the « Deepn Share » of iosShareExtensionName in mobile/app.config.ts); Deepn has no action
// extension, so no « Enregistrer dans Deepn » row is invented. The rest of the sheet is dimmed, as in
// Readwise, so the eye goes to the one icon to touch.
const dim = (inner) => `<div style="opacity:.32">${inner}</div>`;
const person = (n, os) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:62px"><span style="width:52px;height:52px;border-radius:50%;background:var(--surface-container-high);display:flex;align-items:center;justify-content:center;color:var(--text-subtle)">${ic("person-outline", 24)}</span><span style="font-size:11px;color:var(--text-subtle)">${n}</span></div>`;
const sysApp = (label, tile, on = false) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:70px;${on ? "" : "opacity:.32"}">
  <span style="position:relative;display:inline-flex">${on ? `<span style="position:absolute;inset:-6px;border-radius:20px;box-shadow:0 0 0 2.5px var(--primary);"></span>` : ""}${tile}</span>
  <span style="font-size:11.5px;white-space:nowrap;${on ? "font-weight:700;color:var(--text-main)" : "color:var(--text-subtle)"}">${label}</span></div>`;
const plainTile = (bg, fg, icon, s = 56, round = false) => `<span style="width:${s}px;height:${s}px;border-radius:${round ? "50%" : `${Math.round(s * 0.23)}px`};background:${bg};color:${fg};display:inline-flex;align-items:center;justify-content:center;flex:none">${ic(icon, Math.round(s * 0.5))}</span>`;

function shareSheet(os) {
  const ios = os === "ios";
  const head = `<div class="row" style="gap:12px;padding:14px 16px 12px">${thumb(COVERS[0], 44)}<div style="flex:1;min-width:0;font-size:14px;font-weight:650;line-height:1.3">Le cerveau la nuit<div style="font-size:12px;font-weight:400;color:var(--text-subtle)">youtube.com</div></div>${ios ? `<span style="width:30px;height:30px;border-radius:50%;background:var(--surface-container);display:flex;align-items:center;justify-content:center;color:var(--text-subtle)">${ic("close", 16)}</span>` : ""}</div>`;
  const people = `<div class="row" style="gap:10px;padding:12px 14px;justify-content:space-between">${["Léa", "Hugo", "Inès", "Paul", "Zoé"].map((n) => person(n, os)).join("")}</div>`;
  const apps = ios
    ? `<div class="row" style="gap:4px;padding:14px 10px 12px;justify-content:space-between">${sysApp("Deepn", appIcon(56), true)}${sysApp("Messages", plainTile("#34c759", "#fff", "chatbubble-outline"))}${sysApp("Mail", plainTile("#1f8bff", "#fff", "mail-outline"))}${sysApp("Notes", appTile("notes", 56))}${sysApp("Plus", plainTile("var(--surface-container-high)", "var(--text-subtle)", "ellipsis-horizontal"))}</div>`
    : `<div class="row" style="gap:4px;padding:14px 10px 12px;justify-content:space-between">${sysApp("Deepn", appIcon(56, true), true).replace("border-radius:20px", "border-radius:50%")}${sysApp("Messages", plainTile("#1a73e8", "#fff", "chatbubble-outline", 56, true))}${sysApp("Gmail", plainTile("#fff", "#ea4335", "mail-outline", 56, true))}${sysApp("Keep", appTile("googlekeep", 56, "android"))}${sysApp("Drive", plainTile("#fff", "#188038", "cloud-upload-outline", 56, true))}</div>`;
  // iOS: a card with rounded corners all round, the system sheet; Android: the bottom sheet's grab handle.
  return card(`left:20px;right:20px;top:8px;border-radius:${ios ? 22 : 26}px;overflow:hidden`,
    `${ios ? "" : `<div style="width:36px;height:4px;border-radius:2px;background:var(--outline-variant);margin:10px auto 0"></div>`}${head}${hairline}${dim(people)}${hairline}${apps}${hairline}${dim((ios ? [["copy-outline", "Copier le lien"], ["book-outline", "Ajouter à la liste de lecture"], ["heart-outline", "Ajouter aux favoris"], ["search-outline", "Rechercher dans la page"]] : [["copy-outline", "Copier le lien"], ["open-outline", "Ouvrir dans le navigateur"], ["download-outline", "Enregistrer"]]).map(([i, t], n) => `<div class="row" style="gap:12px;padding:13px 16px;font-size:14px;${n ? "border-top:1px solid var(--surface-container)" : ""}">${ic(i, 18)}${t}</div>`).join(""))}`);
}

// =====================================================================================
// Carousel page B — the web app on a laptop, the app on a phone (EverywhereArt, unchanged)
// =====================================================================================
const everywhereBody = `
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
`;

// =====================================================================================
// Mobile screens
// =====================================================================================
const pager = (n, on) => `<div class="pager">${Array.from({ length: n }, (_, i) => `<i${i === on ? ` class="on"` : ""}></i>`).join("")}</div>`;
const inlineIcon = (name) => `<span style="display:inline-flex;vertical-align:-3px;color:var(--text-main)">${ic(name, 17)}</span>`;
const PAGES = {
  share: (os) => ({
    kind: "share", os, title: "Enregistrez depuis<br>n’importe quelle app",
    sub: os === "ios"
      ? `Dans YouTube, Instagram, Spotify ou Safari, touchez ${inlineIcon(SHARE_ICON.ios)} puis <b style="color:var(--text-main)">Deepn</b>. Le média arrive dans votre bibliothèque.`
      : `Dans YouTube, Instagram, Spotify ou Chrome, touchez ${inlineIcon(SHARE_ICON.android)} Partager, puis <b style="color:var(--text-main)">Deepn</b>. Le média arrive dans votre bibliothèque.`,
  }),
  everywhere: () => ({ kind: "everywhere", title: "Sur votre téléphone et votre ordinateur", sub: "Votre bibliothèque vous suit dans l’app et sur le web." }),
};
// Readwise-style frame (owner, 2026-11-01): the text at the top, centred; the illustration below it, in
// the same background, running off the bottom of the screen and fading out under the button; « Suivant »
// then the dots under it. No swipe and no way back: « Suivant » is the only way forward, so there is no
// « Passer » either, and the last page ends on « C’est parti », which opens the home screen.
const introFade = `<div style="position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(to bottom,transparent,var(--surface-container-low) 46%)"></div>`;
const worksWithInline = (os) => `<div style="margin:22px 8px 0">
  <div class="row" style="gap:10px;margin-bottom:12px;font-size:12px;color:var(--text-subtle)"><span style="flex:1;height:1px;background:var(--outline-variant)"></span>Fonctionne avec<span style="flex:1;height:1px;background:var(--outline-variant)"></span></div>
  <div class="row" style="gap:6px;justify-content:center">${APP_LIST[os].map((k) => appTile(k, 28, os)).join("")}</div></div>`;
const intro = ({ kind, os = "ios", title, sub }, on) => `<div style="position:absolute;inset:0;overflow:hidden;background:var(--surface-container-low)">
    <div style="position:absolute;left:-80px;right:-80px;top:${kind === "share" ? 330 : 260}px;height:460px;background:radial-gradient(closest-side,var(--primary-30),transparent)"></div>
    <div style="position:absolute;left:0;right:0;top:${kind === "share" ? 326 : 286}px;height:760px">${kind === "share" ? shareSheet(os) : `<div style="position:relative;width:414px;height:416px;transform:scale(1.12);transform-origin:207px 0">${everywhereBody}</div>`}</div>
    ${introFade}</div>
  <div class="scr" style="padding-top:0;text-align:center">
  <div style="height:30px"></div><h1 class="h1" style="font-size:30px">${title}</h1><p class="sub" style="margin-top:10px">${sub}</p>
  ${kind === "share" ? worksWithInline(os) : ""}
  <div class="sp"></div>${primary(on ? "C’est parti" : "Suivant")}<div style="height:18px"></div>${pager(2, on)}</div>`;

// « Deepn » in the design system's amber for text: `primaryInk` (mobile/src/constants/theme.ts), #b88a00 in
// light — the fill amber #ffcb05 measures 1.24:1 on the background, unreadable as type; #b88a00 gives 3:1,
// the WCAG floor for large text — and the dark primary #f0bf2a in dark, legible there in its own right.
const inkStyle = `<style>.ink{color:#b88a00}.phone.dark .ink{color:#f0bf2a}</style>`;
// Sign-in, the new signed-out entry point: no back arrow any more (nothing behind it), the app's logo above
// the title. The rest is today's screen.
const forgot = `<a class="lnk plain" style="font-size:14px">Mot de passe oublié ?</a>`;
const signInFoot = `<p class="foot" style="margin:0">Pas encore de compte ? <a class="lnk">Créer un compte</a></p>`;
const providers = (mt = 20) => `<div class="stack g12" style="margin-top:${mt}px">${apple()}${google()}</div><div style="margin:16px 0 12px">${divider("ou")}</div>`;
// The logo, centred and larger: flat amber and the plain glyph, with one edge of light along the top and a
// very thin light rim, as the glass of iOS 26 icons catches it, over one soft neutral shadow. No sheen, no
// dome, no halo (owner, 2026-11-01: texture E of the six proposed; the 2010-style « premium » was dropped).
const premiumIcon = (s = 92) => `<span style="position:relative;width:${s}px;height:${s}px;border-radius:${Math.round(s * 0.23)}px;background:var(--primary);color:var(--on-primary);display:inline-flex;flex:none;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 0 0 1px rgba(255,255,255,.22),0 1px 1px rgba(28,27,26,.04),0 12px 24px -14px rgba(28,27,26,.28)">${logoPlanes(s)}</span>`;
const login = () => `<div class="scr"><div style="height:14px"></div><div style="display:flex;justify-content:center">${premiumIcon(92)}</div><div style="height:26px"></div>
  <h1 class="h1" style="font-size:30px;text-align:center">Bienvenue sur <span class="ink">Deepn</span></h1>
  ${providers(28)}
  <div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}
  ${field({ label: "Mot de passe", value: "a".repeat(14), pw: true, right: forgot })}
  <div style="margin-top:4px">${primary("Se connecter")}</div></div>
  <div class="sp"></div>${signInFoot}</div>`;

// « Signaler un bug », iOS beta: how to send TestFlight feedback, down to the step the TestFlight screen
// leaves out. The phone is drawn in the app's style, not TestFlight's: the two buttons to press together,
// and the screenshot's thumbnail in the bottom-left corner, where iOS puts it.
const pulse = (x, y) => `<span style="position:absolute;left:${x}px;top:${y}px;width:26px;height:26px;border-radius:50%;background:var(--primary-30);box-shadow:0 0 0 5px var(--primary-12)"></span>`;
const phoneArt = box(`
  <div style="position:absolute;left:148px;top:6px;width:118px;height:196px;border-radius:24px;background:#1c1b1a;padding:5px;box-sizing:border-box;box-shadow:0 0 0 1.5px var(--outline-variant)">
    <div style="width:100%;height:100%;border-radius:19px;background:var(--surface-container-low);position:relative;overflow:hidden;padding:20px 10px 0;box-sizing:border-box;display:flex;flex-direction:column;gap:6px">
      ${bar("46px", 6, "var(--text-main)")}<div style="height:36px;border-radius:7px;background:${COVERS[1].bg}"></div>${bar("80%", 5)}${bar("64%", 5)}
      <div style="position:absolute;left:8px;bottom:10px;width:34px;height:56px;border-radius:6px;background:var(--surface);box-shadow:0 0 0 2px #fff,var(--shadow-lift);transform:rotate(-4deg)"></div>
      <span style="position:absolute;left:9px;bottom:24px;width:30px;height:30px;border-radius:50%;box-shadow:0 0 0 2.5px var(--primary)"></span></div></div>
  <span style="position:absolute;left:145px;top:48px;width:3px;height:24px;border-radius:2px;background:var(--outline)"></span>
  <span style="position:absolute;left:145px;top:78px;width:3px;height:24px;border-radius:2px;background:var(--outline)"></span>
  <span style="position:absolute;left:266px;top:62px;width:3px;height:36px;border-radius:2px;background:var(--outline)"></span>
  ${pulse(134, 47)}${pulse(254, 67)}
  <span style="position:absolute;left:58px;top:52px;font-size:11.5px;font-weight:650;color:var(--text-subtle);text-align:right;width:70px">Volume +</span>
  <span style="position:absolute;left:290px;top:72px;font-size:11.5px;font-weight:650;color:var(--text-subtle)">Bouton latéral</span>`, 206);
const STEPS = [
  "Allez sur l’écran où se trouve le problème.",
  "Faites une capture : bouton latéral et volume +, en même temps.",
  "Touchez la vignette en bas à gauche, entourez le problème si besoin, puis touchez <b>OK</b>.",
  "Choisissez <b>Partager l’évaluation bêta</b>.",
  "Décrivez ce qui ne va pas, puis touchez <b>Envoyer</b>.",
];
const step = (n, t) => `<div class="row" style="gap:12px;align-items:flex-start"><span style="width:26px;height:26px;border-radius:50%;background:var(--primary);color:var(--on-primary);font-size:13.5px;font-weight:750;display:inline-flex;align-items:center;justify-content:center;flex:none">${n}</span><div style="font-size:15px;line-height:1.45;padding-top:2px">${t}</div></div>`;
const header = (title) => `<div class="row" style="height:48px;position:relative;margin:0 -8px"><span style="width:40px;height:40px;display:flex;align-items:center;justify-content:center">${ic("chevron-back", 26)}</span><span style="position:absolute;left:0;right:0;text-align:center;font-weight:700;font-size:17px;pointer-events:none">${title}</span></div>`;
const betaFeedback = () => `<div class="scr" style="padding-bottom:36px">${header("Signaler un bug")}
  <p class="sub" style="margin:6px 0 0;font-size:15px">Pendant la bêta, vos retours passent par TestFlight : ils nous arrivent avec la capture d’écran et le modèle de votre iPhone.</p>
  <div style="margin:14px -24px 0;height:206px;display:flex;justify-content:center"><div style="width:414px">${phoneArt}</div></div>
  <div class="stack" style="gap:13px;margin-top:10px">${STEPS.map((t, i) => step(i + 1, t)).join("")}</div>
  <p class="small" style="margin:16px 0 0;color:var(--text-subtle)">Autre chemin : ouvrez l’app TestFlight, choisissez Deepn, puis <b>Envoyer une évaluation bêta</b>.</p>
  <div class="sp"></div>${primary("J’ai compris")}</div>`;

// =====================================================================================
// Web: the left panel of /login and /register, three pages made for a computer
// =====================================================================================
const disc = (i, bg = "var(--primary)", fg = "var(--on-primary)", s = 26) => `<span style="width:${s}px;height:${s}px;border-radius:50%;background:${bg};color:${fg};display:inline-flex;align-items:center;justify-content:center;flex:none">${ic(i, Math.round(s * 0.55))}</span>`;
const wave = (n, h, c, w = 4, g = 3) => `<div class="row" style="gap:${g}px;align-items:center">${Array.from({ length: n }, (_, k) => `<span style="width:${w}px;height:${Math.max(4, Math.round(h * (0.35 + 0.65 * Math.abs(Math.sin(k * 1.7) * Math.cos(k * 0.6)))))}px;border-radius:${w / 2}px;background:${c}"></span>`).join("")}</div>`;
// W1 — today's first page (DepthArt), copied from auth_directions/_build/build_c_final.mjs.
function artDepth() {
  const media = {
    video: [`linear-gradient(160deg,#4a5a80,#2b3550)`, "#fff", "play-circle-outline", "Vidéo", "Le cerveau la nuit"],
    podcast: ["var(--primary)", "var(--on-primary)", "headset-outline", "Podcast", "Sommeil et mémoire"],
    article: ["#c1ebec", "var(--text-main)", "document-text-outline", "Article", "Dormir pour apprendre"],
  };
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
  const tokens = `<span class="row" style="flex:none">${Object.values(media).map(([bg, fg, i], n) => `<span style="width:26px;height:26px;border-radius:50%;background:${bg};color:${fg};box-shadow:0 0 0 2px var(--surface);display:inline-flex;align-items:center;justify-content:center;margin-left:${n ? -5 : 0}px">${ic(i, 15)}</span>`).join("")}</span>`;
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

// W2 — from the browser: the extension in the toolbar and its confirmation, then the two other ways in
// (paste a link, drop a file: AddSourceDialog and AppShell accept both).
const artBrowser = box(`
  ${card("left:14px;right:14px;top:8px;height:212px;overflow:hidden;border-radius:14px", `
    <div class="row" style="gap:8px;height:38px;padding:0 12px;background:var(--surface-container-low);border-bottom:1px solid var(--surface-container)">
      <span class="row" style="gap:5px">${["#ff5f57", "#febc2e", "#28c840"].map((c) => `<i style="width:9px;height:9px;border-radius:50%;background:${c};display:block"></i>`).join("")}</span>
      <span class="row" style="flex:1;gap:6px;height:24px;border-radius:12px;background:var(--surface);padding:0 10px;font-size:11.5px;color:var(--text-subtle)">${ic("lock-closed-outline", 11)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">lemonde.fr/sciences</span></span>
      <span style="position:relative;display:inline-flex"><span style="position:absolute;inset:-4px;border-radius:50%;box-shadow:0 0 0 2px var(--primary)"></span>${appIcon(22, true)}</span>
      <span style="color:var(--text-subtle);display:inline-flex">${ic("extension-puzzle-outline", 17)}</span></div>
    <div class="stack" style="gap:8px;padding:16px 18px">${bar("62%", 11, "var(--text-main)")}${bar("40%", 6)}<div style="height:6px"></div>${bar("96%", 6)}${bar("90%", 6)}${bar("94%", 6)}${bar("70%", 6)}</div>`)}
  ${card("left:150px;right:24px;top:52px;padding:12px 14px;border-radius:14px", `<div class="row" style="gap:10px"><span style="color:var(--success);display:inline-flex">${ic("checkmark-circle", 22)}</span><div style="font-size:13.5px;font-weight:700;line-height:1.3">Enregistré dans Deepn<div style="font-size:12px;font-weight:400;color:var(--text-subtle)">Dormir pour apprendre</div></div></div>`)}
  ${card("left:14px;right:14px;top:240px;padding:6px 16px", [
    ["link-outline", "Coller un lien", "Un article, une vidéo ou un épisode de podcast"],
    ["cloud-upload-outline", "Glisser un fichier", "PDF, DOCX, MP3, M4A… déposé sur la page"],
  ].map(([i, t, d], n) => `<div class="row" style="gap:12px;padding:10px 0;${n ? "border-top:1px solid var(--surface-container)" : ""}"><span class="mark" style="width:38px;height:38px">${ic(i, 19)}</span><div style="flex:1;min-width:0;font-size:14px;font-weight:650;line-height:1.3">${t}<div style="font-size:12px;font-weight:400;color:var(--text-subtle)">${d}</div></div></div>`).join(""))}`);

// W3 — on the phone: the iOS share sheet of page A, in a phone, with the apps that work.
const artPhone = box(`
  <div style="position:absolute;left:107px;top:0;width:200px;height:316px;border-radius:32px;background:#1c1b1a;padding:6px;box-sizing:border-box;box-shadow:var(--shadow-lift)">
    <div style="width:100%;height:100%;border-radius:26px;background:var(--surface-container-high);position:relative;overflow:hidden">
      <div style="position:absolute;left:0;right:0;top:0;height:110px;background:${COVERS[0].bg};display:flex;align-items:center;justify-content:center;color:#fff">${ic("play-circle-outline", 34)}</div><div class="stack" style="position:absolute;left:12px;right:12px;top:122px;gap:7px">${bar("80%", 7, "var(--text-subtle)")}${bar("50%", 5, "var(--outline-variant)")}</div>
      <div style="position:absolute;left:6px;right:6px;bottom:6px;border-radius:18px;background:var(--surface);padding:10px 8px 12px">
        <div class="row" style="gap:7px;padding:0 2px 8px">${thumb(COVERS[0], 24)}<div style="font-size:10px;font-weight:650;line-height:1.2">Le cerveau la nuit<div style="font-weight:400;color:var(--text-subtle)">youtube.com</div></div></div>
        ${hairline}
        <div class="row" style="justify-content:space-between;padding:10px 2px 0">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:40px"><span style="position:relative;display:inline-flex"><span style="position:absolute;inset:-4px;border-radius:12px;box-shadow:0 0 0 2px var(--primary)"></span>${appIcon(36)}</span><span style="font-size:8px;font-weight:700;white-space:nowrap">Deepn</span></div>
          ${[["#34c759", "chatbubble-outline"], ["#1f8bff", "mail-outline"], ["var(--surface-container-high)", "ellipsis-horizontal"]].map(([bg, i]) => `<div style="opacity:.32;display:flex;flex-direction:column;align-items:center;gap:4px;width:40px">${plainTile(bg, bg.startsWith("var") ? "var(--text-subtle)" : "#fff", i, 36)}<span style="font-size:8.5px">&nbsp;</span></div>`).join("")}</div></div></div></div>
  ${worksWith("ios", 334)}`);

const roundBtn = (i) => `<span style="width:36px;height:36px;border-radius:50%;background:var(--surface);box-shadow:inset 0 0 0 1px var(--outline-variant);display:flex;align-items:center;justify-content:center">${ic(i, 18)}</span>`;
const WEB_PAGES = [
  { art: artDepth(), title: "Gardez ce qui compte.<br>Approfondissez.<br>Apprenez.", sub: "Enregistrez podcasts, vidéos, reels, articles web, PDF et bien plus. Parlez de votre contenu avec l’IA. Créez des quiz, fiches et résumés pour réviser.", why: "Inchangée : c’est la page 1 actuelle du web. Le doublon avec l’écran TestFlight ne concerne que l’iPhone." },
  { art: artBrowser, title: "Enregistrez depuis votre navigateur", sub: "L’extension Chrome et Edge garde la page que vous lisez en un clic. Vous pouvez aussi coller un lien ou glisser un fichier.", why: "Remplace « Enregistrez un média en un clic » : sur ordinateur, on enregistre avec l’extension, un lien collé ou un fichier glissé, pas avec une feuille de partage." },
  { art: artPhone, title: "Et depuis votre téléphone", sub: "Avec l’app Deepn pour iPhone et Android, partagez une vidéo, un podcast ou un article depuis n’importe quelle app.", why: "Remplace « Sur votre téléphone et votre ordinateur », qui n’a pas de sens quand on est déjà sur le web. Le partage depuis les apps vit ici, puisqu’il ne se fait que sur téléphone." },
];
const webLogin = `<h1 class="h1" style="font-size:28px">Se connecter</h1><p class="sub" style="font-size:15px;margin-top:6px">Retrouvez votre bibliothèque.</p>
  ${providers(22)}<div class="stack g16">${field({ label: "Adresse e-mail", value: EMAIL })}${field({ label: "Mot de passe", value: "a".repeat(14), pw: true, right: forgot })}${primary("Se connecter")}</div>
  <div style="height:22px"></div>${signInFoot}`;
const web = (p, on) => `<div style="flex:1;display:flex">
  <div style="width:600px;flex:none;position:relative;background:var(--surface-container-low)">
    <div style="position:absolute;left:44px;top:30px">${brand()}</div>
    <div style="position:absolute;left:93px;top:70px">${p.art}</div>
    <div style="position:absolute;left:64px;right:64px;top:${p.title.includes("<br>") ? 486 : 500}px"><div class="h1" style="font-size:${p.title.includes("<br>") ? 28 : 32}px">${p.title}</div><p class="sub" style="font-size:${p.title.includes("<br>") ? 15 : 16}px">${p.sub}</p></div>
    <div style="position:absolute;left:64px;right:64px;bottom:30px;display:flex;align-items:center;justify-content:space-between">${pager(3, on).replace(`class="pager"`, `class="pager" style="justify-content:flex-start"`)}<div class="row" style="gap:8px">${roundBtn("chevron-back")}${roundBtn("chevron-forward")}</div></div>
  </div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center"><div style="width:380px">${webLogin}</div></div></div>`;

// =====================================================================================
// Page
// =====================================================================================
const TEXTS = [
  ["Entrée déconnectée", "Carrousel de 4 pages · « Commencer » · « J’ai déjà un compte »", "Écran de connexion directement, sans flèche de retour : logo de l’app centré, puis « Bienvenue sur Deepn » (« Deepn » en ambre) à la place de « Se connecter » · « Retrouvez votre bibliothèque. ». « Pas encore de compte ? Créer un compte » inchangé"],
  ["Carrousel : moment", "Avant le compte, à chaque visite déconnectée", "Une fois, après la première connexion ou inscription (et la langue de lecture pour un nouveau compte), seulement sur une première installation"],
  ["Carrousel page 1", "« Gardez ce qui compte. Approfondissez. Apprenez. »", "Retirée sur mobile : l’écran TestFlight « Du développeur » présente déjà l’app"],
  ["Carrousel page A (iOS)", "« Enregistrez un média en un clic » · « Tout ce que vous partagez ou importez arrive dans votre bibliothèque. »", "« Enregistrez depuis n’importe quelle app » · « Dans YouTube, Instagram, Spotify ou Safari, touchez ⇧ puis Deepn. Le média arrive dans votre bibliothèque. »"],
  ["Carrousel page A (Android)", "idem", "« … ou Chrome, touchez ⋖ Partager, puis Deepn. Le média arrive dans votre bibliothèque. »"],
  ["Carrousel page 3 (recherche)", "« Retrouvez ce que vous avez entendu »", "Supprimée"],
  ["Carrousel page B", "« Sur votre téléphone et votre ordinateur » · « Votre bibliothèque vous suit dans l’app et sur le web. »", "Inchangée"],
  ["Boutons du carrousel", "« Commencer » · « J’ai déjà un compte »", "Page A : « Suivant », points dessous ; page B : « C’est parti » (ouvre l’Accueil). Pas de « Passer », pas de glissement au doigt, pas de retour"],
  ["Signaler un bug (iOS, beta)", "Formulaire objet, description, pièce jointe", "« Pendant la bêta, vos retours passent par TestFlight : ils nous arrivent avec la capture d’écran et le modèle de votre iPhone. » · 5 étapes · « Autre chemin : ouvrez l’app TestFlight, choisissez Deepn, puis Envoyer une évaluation bêta. » · « J’ai compris »"],
  ["Signaler un bug (Android, web, après lancement)", "Formulaire", "Inchangé"],
  ["Web, panneau gauche", "Les 4 pages du carrousel mobile", "« Gardez ce qui compte… » (inchangée) · « Enregistrez depuis votre navigateur » · « Et depuis votre téléphone »"],
];
const CONS = [
  ["Mobile", "<code>app/(auth)/welcome.tsx</code> supprimé ; nouvel écran <code>app/onboarding/intro.tsx</code> ; <code>SIGNED_OUT_ENTRY_POINT</code> devient <code>/(auth)/login</code> ; logo sur la connexion, plus de flèche de retour ; nouvelle route <code>app/beta-feedback.tsx</code>, ouverte depuis le Compte quand <code>Platform.OS === \"ios\" &amp;&amp; isBetaAccess</code>."],
  ["Première installation", "Repère « intro vue » dans un fichier du dossier Documents de l’app (effacé à la désinstallation, gardé à la mise à jour). Une session restaurée sans repère est une installation existante : on écrit le repère sans montrer le carrousel. Pas de trousseau : sur iOS, il survit à la désinstallation."],
  ["Web", "Panneau gauche de <code>AuthSplit.tsx</code> : trois pages propres à l’ordinateur. Le formulaire de bug du web ne change pas."],
  ["Hors app", "Les écrans TestFlight « Du développeur » et « Partager l’évaluation » restent, ni masquables ni déplaçables. Seul le texte « Éléments à tester » est le nôtre : version française proposée dans <code>docs/store-listing/pre-beta-review.md</code>."],
  ["À vérifier sur iPhone", "Les libellés iOS exacts : « OK » après l’annotation, « Partager l’évaluation bêta », « Envoyer une évaluation bêta » dans TestFlight. Ils viennent de l’aide Apple et des forums, pas d’un iOS 26 en français."],
];

const page_ = page({
  title: "Onboarding après connexion et retour bêta",
  body: `${extraSprite}${inkStyle}<div class="kicker">Retour TestFlight · build 21 · 2026-11-01</div><h1>Carrousel après la connexion, retour bêta expliqué</h1>
  <p class="lede">Ordre au premier lancement sur iPhone : les deux écrans de TestFlight (« Du développeur », « Partager l’évaluation »), puis la connexion, la langue de lecture pour un nouveau compte, ce carrousel de deux pages, et l’Accueil. Sur Android et en production, la connexion est le premier écran.</p>

  <h2>1. Carrousel après la première connexion</h2>
  <p>Deux pages, une seule fois par installation. La page « concept » est retirée : l’écran TestFlight « Du développeur » la dit déjà. Mise en page de Readwise : le texte en haut, l’illustration dessous dans le même fond, qui sort par le bas de l’écran et s’efface sous le bouton ; « Suivant », puis les points. On n’avance qu’en touchant « Suivant » : pas de glissement au doigt, pas de retour, pas de « Passer ». La page du partage montre la feuille de partage du système, le reste grisé, pour que l’œil aille à l’icône à toucher ; au-dessus, toutes les apps qui partagent vers Deepn (<code>SHARE_TARGETS</code>).</p>
  <div class="cells">
  ${phone(intro(PAGES.share("ios"), 0), { title: "A · iOS", caption: "Le libellé sous l’icône est celui qu’affiche l’iPhone, « Deepn ». Pas de ligne « Enregistrer dans Deepn » : l’app n’a pas d’extension d’action, on ne dessine que ce qui existe." })}
  ${phone(intro(PAGES.share("android"), 0), { android: true, title: "A · Android", caption: "Feuille de partage d’Android : poignée, icônes rondes, Gmail, Keep et Drive ; Chrome et Keep dans la liste des apps, pas d’Apple Podcasts." })}
  ${phone(intro(PAGES.everywhere(), 1), { title: "B", caption: "Même illustration qu’aujourd’hui, dans la nouvelle mise en page. « C’est parti » ouvre l’Accueil." })}
  ${phone(intro(PAGES.share("ios"), 0), { dark: true, title: "A · thème sombre" })}
  </div>

  <h2>2. Connexion, nouvel écran d’entrée</h2>
  <p>Une personne déconnectée arrive directement ici : plus d’écran d’accueil, donc plus de flèche de retour. Le logo de l’app ouvre l’écran, centré et agrandi, en finition « arête de verre » : ambre plat et glyphe net, une seule arête de lumière sur le bord supérieur et un bord clair très fin, comme le verre des icônes d’iOS 26, sur une ombre douce et neutre. Ni reflet, ni bombé, ni halo. Sous lui, un seul titre centré, « Bienvenue sur Deepn », « Deepn » dans l’ambre du design system pour le texte (<code>primaryInk</code>). L’inscription reste au bout du lien du bas.</p>
  <div class="cells">
  ${phone(login(), { title: "Se connecter", caption: "Le reste de l’écran est celui d’aujourd’hui." })}
  ${phone(login(), { dark: true, title: "Thème sombre" })}
  </div>

  <h2>3. Signaler un bug, iPhone pendant la bêta</h2>
  <p>Remplace le formulaire sur iOS tant que la bêta est ouverte (<code>isBetaAccess</code>). Il dit ce que l’écran TestFlight « Partager l’évaluation » ne dit pas : quoi toucher après la capture. Android, le web et l’après-lancement gardent le formulaire.</p>
  <div class="cells">
  ${phone(betaFeedback(), { title: "Signaler un bug", caption: "Les deux boutons à presser ensemble, et la vignette en bas à gauche, là où iOS la pose. Les libellés en gras sont ceux d’iOS, à vérifier sur l’iPhone." })}
  ${phone(betaFeedback(), { dark: true, title: "Thème sombre" })}
  </div>

  <h2>4. Web : panneau gauche des pages de connexion</h2>
  <p class="small">Le web ne reprend pas les pages mobiles : sur ordinateur, pas de feuille de partage, et « disponible sur le web » n’a pas de sens quand on y est. Le panneau défile seul, comme aujourd’hui ; le formulaire à droite ne change pas.</p>
  <div class="cells">${WEB_PAGES.map((p, i) => desk(web(p, i), { title: `W${i + 1}. ${p.title.replaceAll("<br>", " ")}`, caption: p.why })).join("")}</div>

  <h2>Textes</h2><div class="panel">${textTable(TEXTS)}</div>
  <h2>Ce qui change</h2><div class="panel"><table class="t"><tbody>${CONS.map(([k, v]) => `<tr><th style="width:20%">${k}</th><td>${v}</td></tr>`).join("")}</tbody></table></div>`,
});
writeFileSync(join(OUT, "code.html"), page_);
console.log("ok");
