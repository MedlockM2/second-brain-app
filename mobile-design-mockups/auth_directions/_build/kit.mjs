// Shared kit for the authentication mockups: tokens, frames (phone 414x896, browser 1200x780),
// and the building blocks every direction draws with. Tokens are those of
// mobile/src/constants/theme.ts and web/src/styles.css; icons are Ionicons outlines
// extracted from the font the app ships (extract_icons.py).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ICONS = JSON.parse(readFileSync(join(HERE, "icons.json"), "utf8"));

export const EMAIL = "camille.martin@gmail.com";

const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICONS.paths)
  .map(([n, d]) => `<symbol id="i-${n}" viewBox="${ICONS.viewBox}"><path d="${d}"/></symbol>`).join("")}</svg>`;

export const ic = (name, size = 20, cls = "") =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// The four-colour Google "G" of the Sign in with Google branding guidelines.
export const gLogo = (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

const CSS = `
:root {
  --primary: #ffcb05; --on-primary: #1c1b1a; --primary-05: rgba(255,203,5,.05); --primary-12: rgba(255,203,5,.14); --primary-30: rgba(255,203,5,.3);
  --background: #fcf9f6; --surface: #ffffff; --surface-container: #f1edea; --surface-container-high: #ebe7e5; --surface-container-low: #f7f3f0;
  --text-main: #2b2d42; --text-muted: #8d99ae; --text-subtle: #5c6880; --outline: #78776f; --outline-variant: #c8c7bd;
  --error: #ba1a1a; --error-tint: rgba(186,26,26,.08); --success: #2e7d4f;
  --scrim: rgba(28,27,26,.42); --kb: #d3d5db; --key: #ffffff; --key-alt: #abb0ba; --sheet: #ffffff;
  --shadow-soft: 0 8px 24px rgba(43,45,66,.04); --shadow-lift: 0 18px 40px rgba(43,45,66,.10);
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
.dark {
  --primary: #f0bf2a; --primary-05: rgba(240,191,42,.06); --primary-12: rgba(240,191,42,.14);
  --background: #171511; --surface: #211e19; --surface-container: #2d2a25; --surface-container-high: #37332c; --surface-container-low: #262320;
  --text-main: #f1ebe1; --text-muted: #9aa3b4; --text-subtle: #c6cdd9; --outline: #a8a69a; --outline-variant: #3d3932;
  --error: #ffb4ab; --error-tint: rgba(255,180,171,.08); --success: #7fd3a1;
  --kb: #2c2c2e; --key: #5a5a5e; --key-alt: #3a3a3c; --sheet: #211e19;
}
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 24px 64px; background: #e4e0dc; color: var(--text-main); font-family: var(--font); -webkit-font-smoothing: antialiased; }
.ic { fill: currentColor; flex: none; display: inline-block; vertical-align: middle; }
a { color: inherit; }
/* ---------- document ---------- */
.doc > h1 { font-size: 34px; font-weight: 750; letter-spacing: -.6px; margin: 0 0 8px; }
.doc > h2 { font-size: 22px; font-weight: 700; margin: 40px 0 12px; letter-spacing: -.2px; }
.doc h3 { font-size: 16px; font-weight: 650; margin: 18px 0 6px; }
.doc > p, .doc > ul > li, .panel p, .panel li { font-size: 15.5px; line-height: 1.6; margin: 0 0 8px; max-width: 92ch; }
.doc > ul, .panel ul { padding-inline-start: 22px; margin: 0 0 8px; }
.lede { color: var(--text-subtle); font-size: 17px !important; }
.kicker { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--outline); margin-bottom: 6px; }
.panel { background: var(--surface); border-radius: 18px; padding: 24px 28px; margin: 20px 0; max-width: 1420px; }
.panel.two { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.panel.three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
table.t { border-collapse: collapse; font-size: 14px; margin: 8px 0; width: 100%; }
table.t th, table.t td { text-align: left; padding: 9px 14px 9px 0; vertical-align: top; border-bottom: 1px solid var(--surface-container); line-height: 1.45; }
table.t th { color: var(--text-subtle); font-weight: 650; font-size: 13px; }
table.t td.old { color: var(--text-subtle); }
table.t td.new { font-weight: 550; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; background: var(--surface-container-low); border-radius: 4px; padding: 1px 5px; }
.cells { display: flex; flex-wrap: wrap; gap: 36px 28px; align-items: flex-start; }
.cell { display: flex; flex-direction: column; gap: 14px; margin: 0; }
.caption { font-size: 13.5px; color: var(--text-subtle); margin: 0; line-height: 1.5; padding: 0 6px; }
.caption b { color: var(--text-main); }
.phone + .caption, .cell > .caption { max-width: 434px; }
.desk-cell .caption { max-width: 1200px; }
.tag { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 650; padding: 3px 10px; border-radius: 999px; background: var(--surface-container); color: var(--text-subtle); }
.tag.y { background: var(--primary); color: var(--on-primary); }
/* ---------- phone frame ---------- */
.phone { width: 414px; height: 896px; border-radius: 52px; background: var(--background); color: var(--text-main); position: relative; overflow: hidden;
  box-shadow: 0 0 0 11px #1c1b1a, 0 0 0 12px #3a3836, 0 30px 60px rgba(28,27,26,.22); margin: 12px; flex: none; }
.sb { position: absolute; top: 0; left: 0; right: 0; height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 6px 30px 0 46px; font-size: 16.5px; font-weight: 600; z-index: 30; }
.sb .island { position: absolute; left: 50%; top: 11px; width: 124px; height: 36px; margin-left: -62px; background: #000; border-radius: 20px; }
.sb .sys { display: flex; gap: 6px; align-items: center; }
.phone.android .sb .island { width: 14px; height: 14px; margin-left: -7px; top: 17px; border-radius: 50%; }
.home { position: absolute; bottom: 8px; left: 50%; width: 140px; height: 5px; margin-left: -70px; border-radius: 3px; background: var(--text-main); z-index: 40; }
.scr { position: absolute; inset: 54px 0 0 0; display: flex; flex-direction: column; padding: 0 24px 40px; }
.scr.center { justify-content: center; }
/* ---------- browser frame ---------- */
.desk { width: 1200px; height: 780px; border-radius: 14px; overflow: hidden; background: var(--background); color: var(--text-main); box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 30px 60px rgba(28,27,26,.18); flex: none; display: flex; flex-direction: column; }
.chrome { height: 44px; background: #ece9e6; display: flex; align-items: center; gap: 16px; padding: 0 16px; flex: none; border-bottom: 1px solid #dcd8d4; }
.desk.dark .chrome { background: #0f0e0c; border-color: #2b2823; }
.dots { display: flex; gap: 8px; } .dots i { width: 12px; height: 12px; border-radius: 6px; background: #d6d2ce; display: block; }
.desk.dark .dots i { background: #3a3631; }
.url { flex: 1; max-width: 520px; margin: 0 auto; height: 28px; border-radius: 8px; background: #fff; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; color: #5c6880; }
.desk.dark .url { background: #211e19; color: #9aa3b4; }
.page { flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; }
.zoom-half { zoom: .5; }
/* ---------- text ---------- */
.brand { display: flex; align-items: center; gap: 10px; font-weight: 750; font-size: 19px; letter-spacing: -.3px; }
.mark { width: 34px; height: 34px; border-radius: 999px; background: var(--primary); color: var(--on-primary); display: inline-flex; align-items: center; justify-content: center; flex: none; }
.mark.lg { width: 64px; height: 64px; } .mark.xl { width: 76px; height: 76px; }
.h1 { font-size: 32px; font-weight: 750; letter-spacing: -.7px; line-height: 1.15; margin: 0; }
.h2 { font-size: 24px; font-weight: 720; letter-spacing: -.4px; line-height: 1.2; margin: 0; }
.sub { font-size: 16px; line-height: 1.5; color: var(--text-subtle); margin: 8px 0 0; }
.small { font-size: 13px; line-height: 1.5; color: var(--text-subtle); }
.legal { font-size: 12.5px; line-height: 1.5; color: var(--text-subtle); text-align: center; }
.legal a, .lnk { color: var(--text-main); font-weight: 600; text-decoration: underline; text-decoration-color: var(--outline-variant); text-underline-offset: 3px; }
.lnk.plain { text-decoration: none; }
.foot { font-size: 14.5px; color: var(--text-subtle); text-align: center; }
.foot b { color: var(--text-main); }
.sp { flex: 1; }
.stack { display: flex; flex-direction: column; } .g8 { gap: 8px; } .g12 { gap: 12px; } .g16 { gap: 16px; } .g20 { gap: 20px; } .g24 { gap: 24px; }
.row { display: flex; align-items: center; } .between { justify-content: space-between; } .ctr { justify-content: center; text-align: center; }
/* ---------- buttons ---------- */
.btn { height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 16.5px; font-weight: 600; border: 0; width: 100%; letter-spacing: -.1px; position: relative; }
.desk .btn { height: 46px; border-radius: 999px; font-size: 15px; }
.btn.primary { background: var(--primary); color: var(--on-primary); }
.btn.primary.off { opacity: .45; }
.btn.apple { background: #000; color: #fff; } .dark .btn.apple { background: #fff; color: #000; }
.btn.google { background: var(--surface); color: var(--text-main); box-shadow: inset 0 0 0 1px var(--outline-variant); }
.dark .btn.google { background: #131314; color: #e3e3e3; box-shadow: inset 0 0 0 1px #8e918f; }
.btn.tonal { background: var(--surface-container); color: var(--text-main); }
.btn.ghost { background: transparent; color: var(--text-main); }
.btn .lead { position: absolute; left: 18px; display: flex; }
.btn.sm { height: 40px; font-size: 14.5px; border-radius: 10px; width: auto; padding: 0 16px; }
.desk .btn.sm { height: 36px; border-radius: 999px; }
.spin { width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid rgba(28,27,26,.25); border-top-color: var(--on-primary); }
.divider { display: flex; align-items: center; gap: 12px; color: var(--text-subtle); font-size: 13.5px; margin: 4px 0; }
.divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: var(--outline-variant); opacity: .7; }
/* ---------- fields ---------- */
.fld { display: flex; flex-direction: column; gap: 7px; }
.fld .lbl { font-size: 14px; font-weight: 600; display: flex; justify-content: space-between; align-items: baseline; }
.fld .lbl a { font-weight: 600; font-size: 14px; }
.box { height: 52px; border-radius: 14px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--outline-variant); display: flex; align-items: center; gap: 10px; padding: 0 16px; font-size: 16.5px; color: var(--text-main); }
.desk .box { height: 46px; border-radius: 12px; font-size: 15px; }
.box.focus { box-shadow: inset 0 0 0 2px var(--primary), 0 0 0 4px var(--primary-12); }
.box.err { box-shadow: inset 0 0 0 1.5px var(--error); }
.box.ok { box-shadow: inset 0 0 0 1px var(--outline-variant); }
.box .ph { color: var(--text-muted); }
.box .val { flex: 1; white-space: nowrap; overflow: hidden; }
.box .dots-pw { letter-spacing: 2px; font-size: 18px; }
.box .tr { color: var(--text-subtle); display: flex; }
.caret { display: inline-block; width: 2px; height: 22px; background: #0a84ff; vertical-align: middle; margin-left: 1px; border-radius: 1px; }
.fld .msg { font-size: 13.5px; line-height: 1.45; display: flex; gap: 6px; align-items: flex-start; color: var(--text-subtle); }
.fld .msg.err { color: var(--error); }
.fld .msg.ok { color: var(--success); }
.fld .msg .ic { margin-top: 1px; }
.chipmail { display: flex; align-items: center; gap: 10px; padding: 10px 12px 10px 14px; border-radius: 14px; background: var(--surface-container-low); font-size: 15px; }
.chipmail .em { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* ---------- checklist ---------- */
.checks { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; font-size: 13.5px; color: var(--text-subtle); }
.checks.one { grid-template-columns: 1fr; }
.checks span { display: flex; align-items: center; gap: 6px; }
.checks .met { color: var(--text-main); }
.checks .met .ic { color: var(--success); }
.badges { display: flex; flex-wrap: wrap; gap: 6px; }
.badge { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 11px 0 8px; border-radius: 999px; background: var(--surface-container); font-size: 13px; font-weight: 550; color: var(--text-subtle); }
.badge.met { background: rgba(46,125,79,.11); color: var(--success); }
.dark .badge.met { background: rgba(127,211,161,.12); }
.meter { height: 4px; border-radius: 2px; background: var(--surface-container-high); overflow: hidden; }
.meter i { display: block; height: 100%; background: var(--primary); border-radius: 2px; }
/* ---------- otp ---------- */
.otp { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.otp.split { grid-template-columns: repeat(3, 1fr) 14px repeat(3, 1fr); }
.otp .c { height: 62px; border-radius: 14px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--outline-variant); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 650; font-variant-numeric: tabular-nums; }
.desk .otp .c { height: 58px; border-radius: 12px; }
.otp .c.on { box-shadow: inset 0 0 0 2px var(--primary), 0 0 0 4px var(--primary-12); }
.otp .c.err { box-shadow: inset 0 0 0 1.5px var(--error); color: var(--error); }
.otp .dash { align-self: center; height: 2px; background: var(--outline-variant); border-radius: 1px; }
/* ---------- notices ---------- */
.note { border-radius: 16px; padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start; font-size: 14.5px; line-height: 1.5; }
.note .ic { margin-top: 1px; }
.note.info { background: var(--surface-container-low); }
.note.amber { background: var(--primary-05); box-shadow: inset 4px 0 0 var(--primary); border-radius: 4px 16px 16px 4px; }
.note.err { background: var(--error-tint); color: var(--error); }
.note.ok { background: rgba(46,125,79,.08); color: var(--success); }
.note b { display: block; color: var(--text-main); font-size: 15px; margin-bottom: 2px; }
.note .acts { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.halo { width: 64px; height: 64px; border-radius: 999px; background: var(--primary-12); color: var(--text-main); display: flex; align-items: center; justify-content: center; }
.halo.lg { width: 84px; height: 84px; }
.back { width: 44px; height: 44px; margin-left: -10px; display: flex; align-items: center; justify-content: center; color: var(--text-main); }
.steps { display: flex; gap: 6px; } .steps i { width: 22px; height: 4px; border-radius: 2px; background: var(--surface-container-high); display: block; } .steps i.on { background: var(--primary); }
/* ---------- keyboard ---------- */
.kb { position: absolute; left: 0; right: 0; bottom: 0; background: var(--kb); padding: 0 4px 34px; z-index: 20; }
.qt { height: 46px; display: flex; align-items: center; justify-content: center; gap: 0; font-size: 15px; color: var(--text-main); }
.qt span { flex: 1; text-align: center; line-height: 1.2; }
.qt span + span { border-left: 1px solid rgba(0,0,0,.12); }
.qt small { display: block; font-size: 11.5px; color: var(--text-subtle); }
.qt b { font-weight: 600; }
.krow { display: flex; gap: 6px; justify-content: center; margin-bottom: 11px; padding: 0 2px; }
.k { height: 44px; flex: 1; max-width: 37px; background: var(--key); border-radius: 6px; box-shadow: 0 1px 0 rgba(0,0,0,.3); display: flex; align-items: center; justify-content: center; font-size: 22px; color: var(--text-main); }
.k.w { max-width: 50px; background: var(--key-alt); font-size: 15px; } .k.sp { max-width: none; flex: 4; font-size: 15px; } .k.ret { max-width: 92px; flex: 2; background: #0a84ff; color: #fff; font-size: 15px; }
.k.m { max-width: none; flex: 1.2; font-size: 15px; background: var(--key-alt); }
.np { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; padding: 4px 4px 0; }
.np .k { max-width: none; height: 48px; flex-direction: column; font-size: 25px; line-height: 1; }
.np .k small { font-size: 9.5px; letter-spacing: 2px; font-weight: 600; margin-top: 1px; }
.np .k.blank { background: transparent; box-shadow: none; }
/* ---------- sheet ---------- */
.scrim { position: absolute; inset: 0; background: var(--scrim); z-index: 10; }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; background: var(--sheet); border-radius: 28px 28px 0 0; z-index: 15; padding: 10px 24px 42px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 -10px 40px rgba(0,0,0,.12); }
.grab { width: 40px; height: 5px; border-radius: 3px; background: var(--outline-variant); margin: 0 auto 6px; }
/* ---------- covers ---------- */
.cover { border-radius: 14px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow-lift); display: flex; flex-direction: column; }
.cover .art { height: 92px; display: flex; align-items: flex-end; padding: 10px; color: #fff; }
.cover .meta { padding: 10px 12px 12px; font-size: 12.5px; line-height: 1.35; }
.cover .meta b { display: block; font-size: 13.5px; color: var(--text-main); margin-bottom: 3px; }
.cover .meta span { color: var(--text-subtle); }
.pill-type { display: inline-flex; align-items: center; gap: 4px; background: rgba(0,0,0,.35); backdrop-filter: blur(6px); color: #fff; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; }
.callout { background: var(--surface); border-radius: 4px 16px 16px 4px; box-shadow: inset 4px 0 0 var(--primary), var(--shadow-lift); padding: 14px 16px 14px 20px; font-size: 15px; line-height: 1.5; }
.callout .q { background: linear-gradient(transparent 55%, var(--primary-30) 55%); font-weight: 600; }
.callout small { display: block; margin-top: 8px; font-size: 12px; color: var(--text-subtle); }
.seg { display: flex; padding: 4px; border-radius: 999px; background: var(--surface-container); }
.seg span { flex: 1; text-align: center; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 999px; font-size: 14.5px; font-weight: 600; color: var(--text-subtle); }
.seg span.on { background: var(--primary); color: var(--on-primary); }
.pager { display: flex; gap: 6px; justify-content: center; } .pager i { width: 6px; height: 6px; border-radius: 3px; background: var(--outline-variant); display: block; } .pager i.on { width: 20px; background: var(--text-main); }
/* ---------- system sheet (iOS) ---------- */
.ios-sheet { position: absolute; left: 8px; right: 8px; bottom: 8px; border-radius: 36px; background: #f2f2f7; color: #000; z-index: 15; padding: 22px 20px 30px; text-align: center; font-family: var(--font); }
.dark .ios-sheet { background: #1c1c1e; color: #fff; }
.ios-sheet .x { position: absolute; right: 18px; top: 18px; width: 30px; height: 30px; border-radius: 15px; background: #e3e3e8; display: flex; align-items: center; justify-content: center; color: #6e6e73; }
.ios-sheet .btn { background: #0a84ff; color: #fff; border-radius: 14px; }
/* ---------- browser passkey autofill ---------- */
.autofill { position: absolute; background: #fff; border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,.16), 0 0 0 1px rgba(0,0,0,.06); padding: 6px; z-index: 5; font-size: 14px; color: #1c1b1a; }
.autofill .opt { display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 8px; }
.autofill .opt.hl { background: #eef3fe; }
.autofill small { display: block; color: #5c6880; font-size: 12.5px; }
.autofill hr { border: 0; height: 1px; background: #eee; margin: 4px 8px; }
`;

const statusBar = () => `<div class="sb"><span>9:41</span><span class="island"></span><span class="sys">
<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 .6C5.3.6 2.8 1.6.9 3.4L2 4.6a8.6 8.6 0 0 1 6-2.4Zm0 3.3c1.4 0 2.7.5 3.7 1.4l1.1-1.2A7.1 7.1 0 0 0 8 3.9c-1.8 0-3.5.7-4.8 1.8l1.1 1.2c1-.9 2.3-1.4 3.7-1.4Zm0 3.3c-.6 0-1.2.2-1.6.6L8 11l1.6-1.6c-.4-.4-1-.6-1.6-.6Z" fill="currentColor"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity=".45"/></svg></span></div>`;

export const phone = (inner, { dark = false, android = false, caption = "", title = "" } = {}) =>
  `<figure class="cell"><div class="phone${dark ? " dark" : ""}${android ? " android" : ""}">${statusBar()}${inner}<div class="home"></div></div>${
    caption ? `<figcaption class="caption">${title ? `<b>${title}.</b> ` : ""}${caption}</figcaption>` : ""}</figure>`;

export const desk = (inner, { dark = false, url = "‹domaine›/login", caption = "", title = "", half = false } = {}) => {
  const frame = `<div class="desk${dark ? " dark" : ""}"><div class="chrome"><span class="dots"><i></i><i></i><i></i></span><span class="url">${ic("lock-closed-outline", 13)} ${url}</span><span style="width:52px"></span></div><div class="page">${inner}</div></div>`;
  return `<figure class="cell desk-cell">${half ? `<div class="zoom-half">${frame}</div>` : frame}${
    caption ? `<figcaption class="caption">${title ? `<b>${title}.</b> ` : ""}${caption}</figcaption>` : ""}</figure>`;
};

// ---------- building blocks ----------
export const brand = (size = "") => `<div class="brand"><span class="mark ${size}">${ic("layers-outline", size === "lg" ? 32 : size === "xl" ? 38 : 18)}</span>${size ? "" : "Deepn"}</div>`;
export const apple = (label = "Continuer avec Apple") => `<div class="btn apple"><span class="lead">${ic("logo-apple", 20)}</span>${label}</div>`;
export const google = (label = "Continuer avec Google") => `<div class="btn google"><span class="lead">${gLogo(19)}</span>${label}</div>`;
export const mailBtn = (label = "Continuer avec un e-mail", cls = "tonal") => `<div class="btn ${cls}"><span class="lead">${ic("mail-outline", 20)}</span>${label}</div>`;
export const primary = (label, { off = false, loading = false, icon = "" } = {}) =>
  `<div class="btn primary${off ? " off" : ""}">${loading ? `<span class="spin"></span>` : `${label}${icon ? ic(icon, 18) : ""}`}</div>`;
export const btn = (label, cls = "tonal") => `<div class="btn ${cls}">${label}</div>`;
export const divider = (t = "ou") => `<div class="divider">${t}</div>`;
export const legal = (verb = "En continuant") => `<p class="legal">${verb}, vous acceptez les <a>Conditions d’utilisation</a> et la <a>Politique de confidentialité</a> de Deepn.</p>`;

export function field({ label = "", value = "", ph = "", pw = false, focus = false, err = "", hint = "", right = "", trailing = "", caret = false, show = false, ok = "" } = {}) {
  const content = value
    ? `<span class="val${pw && !show ? " dots-pw" : ""}">${pw && !show ? "•".repeat(value.length) : value}${caret ? `<span class="caret"></span>` : ""}</span>`
    : `<span class="val">${caret ? `<span class="caret"></span>` : ""}<span class="ph">${ph}</span></span>`;
  const tr = pw ? `<span class="tr">${ic(show ? "eye-off-outline" : "eye-outline", 21)}</span>` : trailing ? `<span class="tr">${trailing}</span>` : "";
  return `<div class="fld">${label ? `<div class="lbl"><span>${label}</span>${right}</div>` : ""}<div class="box${focus ? " focus" : ""}${err ? " err" : ""}">${content}${tr}</div>${
    err ? `<div class="msg err">${ic("alert-circle-outline", 17)}<span>${err}</span></div>` : ok ? `<div class="msg ok">${ic("checkmark-circle", 17)}<span>${ok}</span></div>` : hint ? `<div class="msg">${hint}</div>` : ""}</div>`;
}

// Password criteria as badges: neutral until met, green once met. Never red: nothing has failed yet.
export const badges = (items) =>
  `<div class="badges">${items.map(([t, met]) => `<span class="badge${met ? " met" : ""}">${ic(met ? "checkmark" : "ellipse-outline", met ? 15 : 12)}${t}</span>`).join("")}</div>`;

export const checks = (items, one = false) =>
  `<div class="checks${one ? " one" : ""}">${items.map(([t, met]) => `<span class="${met ? "met" : ""}">${ic(met ? "checkmark-circle" : "ellipse-outline", 16)}${t}</span>`).join("")}</div>`;

export function otp(code, { len = 6, err = false, split = false } = {}) {
  const cells = [];
  for (let i = 0; i < len; i++) {
    if (split && i === 3) cells.push(`<span class="dash"></span>`);
    const d = code[i] ?? "";
    const on = !err && i === code.length;
    cells.push(`<span class="c${on ? " on" : ""}${err ? " err" : ""}">${d}${on ? `<span class="caret" style="height:28px"></span>` : ""}</span>`);
  }
  return `<div class="otp${split ? " split" : ""}">${cells.join("")}</div>`;
}

export const note = (kind, icon, title, body, acts = "") =>
  `<div class="note ${kind}">${icon ? ic(icon, 20) : ""}<div>${title ? `<b>${title}</b>` : ""}${body}${acts ? `<div class="acts">${acts}</div>` : ""}</div></div>`;

export const chipMail = (email = EMAIL) => `<div class="chipmail">${ic("mail-outline", 18)}<span class="em">${email}</span><a class="lnk plain" style="font-size:14.5px">Modifier</a></div>`;
export const back = () => `<div class="back">${ic("chevron-back", 26)}</div>`;

const AZERTY = ["azertyuiop", "qsdfghjklm"];
export function keyboard({ qt = [], mode = "email", ret = "Continuer" } = {}) {
  const bar = `<div class="qt">${qt.map((s) => `<span>${s}</span>`).join("") || "<span></span>"}</div>`;
  if (mode === "num") {
    const keys = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["", ""], ["0", ""], ["⌫", ""]];
    return `<div class="kb">${bar}<div class="np">${keys.map(([d, l], i) => `<span class="k${i === 9 ? " blank" : ""}${i === 11 ? " blank" : ""}">${d}${l ? `<small>${l}</small>` : ""}</span>`).join("")}</div></div>`;
  }
  const r = (s) => `<div class="krow">${[...s].map((c) => `<span class="k">${c}</span>`).join("")}</div>`;
  return `<div class="kb">${bar}${r(AZERTY[0])}${r(AZERTY[1])}<div class="krow"><span class="k w">⇧</span>${[..."wxcvbn"].map((c) => `<span class="k">${c}</span>`).join("")}<span class="k">'</span><span class="k w">⌫</span></div>
<div class="krow"><span class="k m">123</span>${mode === "email" ? `<span class="k sp">espace</span><span class="k m">@</span><span class="k m">.</span>` : `<span class="k sp">espace</span>`}<span class="k ret">${ret}</span></div></div>`;
}

// Fictive library items, shared by the editorial directions.
export const COVERS = [
  { type: "Vidéo · 42 min", icon: "play-circle-outline", title: "Comment le sommeil consolide la mémoire", by: "Chaîne Neuro & Co", bg: "linear-gradient(135deg,#3d4a6b,#1f2740)" },
  { type: "Article · 12 min", icon: "document-text-outline", title: "La lecture profonde à l’ère des écrans", by: "Revue des idées", bg: "linear-gradient(135deg,#b88a3e,#7a5523)" },
  { type: "Podcast · 58 min", icon: "headset-outline", title: "Les mécanismes de l’attention", by: "Les Têtes chercheuses", bg: "linear-gradient(135deg,#4f6b5a,#2c4136)" },
];
export const cover = (c, style = "") =>
  `<div class="cover" style="${style}"><div class="art" style="background:${c.bg}"><span class="pill-type">${ic(c.icon, 13)}${c.type}</span></div><div class="meta"><b>${c.title}</b><span>${c.by}</span></div></div>`;

export function page({ title, body }) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>
<!--
  Authentification Deepn — maquette autonome : aucune balise <link>, <script> ni <img>.
  Police système, glyphes extraits de Ionicons.ttf, tokens de mobile/src/constants/theme.ts et web/src/styles.css,
  cadres aux dimensions logiques exactes (téléphone 414x896, navigateur 1200x780). Données fictives.
  Généré par _build/build.mjs — modifier la source, pas ce fichier.
-->
<style>${CSS}</style></head><body>${sprite}<main class="doc">${body}</main></body></html>`;
}

export const textTable = (rows) =>
  `<table class="t"><thead><tr><th style="width:22%">Où</th><th style="width:36%">Aujourd’hui</th><th>Proposé</th></tr></thead><tbody>${rows
    .map(([w, o, n]) => `<tr><td>${w}</td><td class="old">${o}</td><td class="new">${n}</td></tr>`).join("")}</tbody></table>`;
