// Writes ../code.html: the current flashcards screen and three UX directions.
// Usage (from the repository root): node mobile-design-mockups/flashcards_ux/_build/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const icons = JSON.parse(readFileSync(join(HERE, "icons.json"), "utf8"));
const defs = Object.entries(icons.paths)
  .map(([n, d]) => `<symbol id="ion-${n}" viewBox="${icons.viewBox}"><path d="${d}" fill="currentColor"/></symbol>`)
  .join("");
const ic = (n, s = 20, c = "currentColor") => `<svg class="ic" width="${s}" height="${s}" style="color:${c}"><use href="#ion-${n}"/></svg>`;

// --- Fictitious data -------------------------------------------------------
const SOURCE = "Comment le sommeil consolide la mémoire";
const CARDS = [
  ["Que décrit la courbe de l’oubli d’Ebbinghaus ?", "La chute rapide de ce qu’on retient après un apprentissage : sans révision, environ la moitié est perdue en un jour."],
  ["Pendant quelle phase du sommeil l’hippocampe rejoue-t-il les souvenirs de la journée ?", "Le sommeil lent profond, surtout en début de nuit."],
  ["Pourquoi espacer les révisions plutôt que les regrouper ?", "Chaque rappel fait juste avant l’oubli renforce davantage la trace qu’une répétition immédiate."],
  ["Qu’est-ce que l’effet de test ?", "Se forcer à retrouver une réponse ancre mieux le souvenir que relire la même information."],
];
const TOTAL = 12;

// --- Frame chrome ------------------------------------------------------------
const sb = `<div class="sb"><span>9:41</span><span class="sb-right"><svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="6" rx="1"/><rect x="10" y="2.5" width="3" height="8.5" rx="1"/><rect x="15" y="0" width="3" height="11" rx="1"/></svg><svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="16" height="8" rx="2"/><rect x="24" y="4" width="1.6" height="4" rx=".8" opacity=".45"/></svg></span></div>`;
const hdr = (right = ic("ellipsis-horizontal", 24)) =>
  `<div class="hdr"><span class="hbtn filled">${ic("arrow-back", 24)}</span><span class="right"><span class="hbtn">${right}</span></span></div>`;
const chip = `<span class="chip">${ic("copy-outline", 14, "var(--fc-ink)")}CARTES MÉMO</span>`;
const frame = (body, cls = "") => `<div class="frame ${cls}">${sb}${body}<span class="home-ind"></span></div>`;
const cell = (title, f, caption) => `<div class="cell"><p class="ftitle">${title}</p>${f}<p class="caption">${caption}</p></div>`;

// --- Current screen ------------------------------------------------------------
const curCard = (i, [q, a], revealed) => `
  <div class="cur-card">
    <div class="cur-row"><span class="cur-idx">#${i}</span>${ic(revealed ? "eye-off-outline" : "eye-outline", 16, "var(--text-muted)")}</div>
    <div class="cur-lab">QUESTION</div><div class="cur-q">${q}</div>
    <div class="cur-div"></div>
    <div class="cur-lab">ANSWER</div>
    ${revealed ? `<div class="cur-a">${a}</div>` : `<div class="cur-hint">Touchez pour révéler</div>`}
  </div>`;
const current = frame(`${hdr()}<div class="scroll"><div class="pad">
  <div class="cur-chip">${ic("copy-outline", 14)}CARTES MÉMO</div>
  <div class="cur-hero">${SOURCE}</div>
  <div class="cur-sec">12 cartes</div>
  ${curCard(1, CARDS[0], true)}${curCard(2, CARDS[1], false)}${curCard(3, CARDS[2], false)}
</div></div>`);

// --- Shared pieces of the one-card-at-a-time directions -------------------------
const ident = `<div class="ident">${chip}<div class="ident-title">${SOURCE}</div></div>`;
const progress = (n, extra = "") => `
  <div class="prog"><div class="prog-row"><span class="prog-lab">Carte ${n} sur ${TOTAL}</span>${extra}</div>
  <div class="track"><i style="width:${(n / TOTAL) * 100}%"></i></div></div>`;
const deck = (inner, flipped = false) => `
  <div class="deck"><span class="edge e2"></span><span class="edge e1"></span>
  <div class="card ${flipped ? "back" : ""}">${inner}</div></div>`;
const front = (q, hint) => `
  <div class="face"><div class="kick">QUESTION</div><div class="q">${q}</div></div>
  ${hint ? `<div class="hint">${ic("sync-outline", 16)}${hint}</div>` : ""}`;
const back = (q, a) => `
  <div class="face top"><div class="q-small">${q}</div><div class="rule"></div>
  <div class="kick ink">RÉPONSE</div><div class="a">${a}</div></div>`;

// --- A. Paquet ------------------------------------------------------------------
const navA = `<div class="navA"><span class="round">${ic("chevron-back", 24)}</span>
  <span class="ghost">${ic("shuffle-outline", 18)}Mélanger</span>
  <span class="round fill">${ic("chevron-forward", 24)}</span></div>`;
const A1 = frame(`${hdr(ic("list-outline", 24))}${ident}${progress(3)}${deck(front(CARDS[2][0], "Touchez pour retourner"))}${navA}`);
const A2 = frame(`${hdr(ic("list-outline", 24))}${ident}${progress(3)}${deck(back(CARDS[2][0], CARDS[2][1]), true)}${navA}`);

// --- B. Je savais / À revoir -------------------------------------------------------
const tally = `<span class="tally"><span class="t-ok">${ic("checkmark", 14)}5</span><span class="t-ko">${ic("refresh-outline", 14)}2</span></span>`;
const revealBtn = `<div class="actions"><span class="btn primary">${ic("eye-outline", 20)}Voir la réponse</span></div>`;
const rateBtns = `<div class="actions pair"><span class="btn ko">${ic("refresh-outline", 20)}À revoir</span><span class="btn ok">${ic("checkmark", 20)}Je savais</span></div>`;
const B1 = frame(`${hdr(ic("list-outline", 24))}${ident}${progress(8, tally)}${deck(front(CARDS[3][0]))}${revealBtn}`);
const B2 = frame(`${hdr(ic("list-outline", 24))}${ident}${progress(8, tally)}${deck(back(CARDS[3][0], CARDS[3][1]), true)}${rateBtns}`);
const missed = [CARDS[1][0], "Quel neurotransmetteur domine pendant le sommeil paradoxal ?", "Combien de cycles de sommeil compte une nuit moyenne ?", CARDS[3][0]];
const B3 = frame(`<div class="hdr"><span></span><span class="hbtn">${ic("close", 24)}</span></div><div class="scroll"><div class="pad end">
  <div class="score">
    <svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-container-high)" stroke-width="10"/>
    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--success)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(8 / 12) * 326.7} 400" transform="rotate(-90 60 60)"/></svg>
    <div class="score-n"><b>8</b><span>sur 12</span></div>
  </div>
  <div class="end-title">Session terminée</div>
  <div class="end-sub">Vous connaissiez 8 cartes. Revoyez les 4 autres maintenant, tant que c’est frais.</div>
  <div class="sec">À revoir <span class="count">4</span></div>
  <div class="miss">${missed.map((q) => `<div class="miss-row">${ic("refresh-outline", 16, "var(--fc-ink)")}<span class="two">${q}</span></div>`).join("")}</div>
  </div></div>
  <div class="actions stack-btn"><span class="btn primary">${ic("refresh-outline", 20)}Revoir les 4 cartes</span><span class="btn quiet">Tout recommencer</span></div>`);
const B4 = frame(`${hdr(ic("list-outline", 22))}<div class="ident sm">${chip}<div class="ident-title">${SOURCE}</div></div>${progress(8, tally)}${deck(front(CARDS[1][0]))}${revealBtn}`, "narrow");

// --- C. Liste allégée --------------------------------------------------------------
const cRow = (n, [q, a], open) => `
  <div class="ccard"><div class="cq"><span class="cn">${n}</span><span>${q}</span></div>
  ${open ? `<div class="cans">${a}</div>` : `<div class="cveil">${ic("eye-outline", 18)}Afficher la réponse</div>`}</div>`;
const C1 = frame(`${hdr()}<div class="scroll"><div class="pad">
  ${chip}<div class="ident-title big">${SOURCE}</div>
  <div class="seg"><span class="sg">${ic("albums-outline", 18)}Réviser</span><span class="sg sel">${ic("list-outline", 18)}Liste</span></div>
  <div class="lhead"><span>12 cartes</span><span class="link">${ic("eye-outline", 16)}Tout afficher</span></div>
  ${cRow(1, CARDS[0], true)}${cRow(2, CARDS[1], false)}${cRow(3, CARDS[2], false)}${cRow(4, CARDS[3], false)}
</div></div>`);

// --- Page ----------------------------------------------------------------------------
const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Cartes mémo — UX</title>
<!-- Maquette autonome générée par _build/build.mjs. Tokens de mobile/src/constants/theme.ts (thème clair), glyphes Ionicons.ttf, cadres 414x896 et 320x568. Données fictives. -->
<style>
:root {
  --primary: #ffcb05; --on-primary: #1c1b1a; --primary-05: rgba(255,203,5,.05); --primary-ink: #b88a00;
  --background: #fcf9f6; --surface: #ffffff; --surface-container: #f1edea; --surface-container-high: #ebe7e5; --surface-container-low: #f7f3f0;
  --text-main: #2b2d42; --text-muted: #8d99ae; --text-subtle: #5c6880; --outline-variant: #c8c7bd;
  --fc-tint: #f5e1e1; --fc-ink: #9b4a52; --success: #2e7d4f; --success-tint: rgba(46,125,79,.11);
  --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px; --radius-full: 9999px;
  --shadow-soft: 0 8px 24px rgba(43,45,66,.04);
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 24px 48px; background: var(--surface-container-high); color: var(--text-main); font-family: var(--font); -webkit-font-smoothing: antialiased; }
h1 { font-size: 32px; font-weight: 700; letter-spacing: -.5px; margin: 0 0 8px; }
h2 { font-size: 20px; font-weight: 600; margin: 0 0 6px; }
p, li { font-size: 16px; line-height: 1.6; margin: 0 0 8px; max-width: 92ch; }
ul { padding-inline-start: 24px; margin: 0 0 8px; }
.lede { color: var(--text-subtle); }
.panel { background: var(--surface); border-radius: var(--radius-xl); padding: 24px; margin: 24px 0; max-width: 1452px; }
.reco { box-shadow: inset 4px 0 0 var(--primary); background: var(--primary-05); }
.cells { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; margin-top: 16px; }
.cell { display: flex; flex-direction: column; gap: 8px; }
.ftitle { font-size: 13px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--text-subtle); margin: 0 0 0 8px; }
.caption { font-size: 13px; color: var(--text-subtle); margin: 0 0 0 8px; max-width: 414px; line-height: 1.45; }
.ic { flex: 0 0 auto; display: block; }

/* frame */
.frame { position: relative; width: 414px; height: 896px; background: var(--background); border-radius: 28px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 0 0 8px #1c1b1a; margin: 8px; }
.frame.narrow { width: 320px; height: 568px; border-radius: 12px; }
.sb { flex: 0 0 48px; display: flex; align-items: center; justify-content: space-between; padding: 6px 30px 0 34px; font-size: 16px; font-weight: 600; }
.narrow .sb { flex-basis: 20px; padding-top: 0; font-size: 12px; }
.sb-right { display: flex; gap: 6px; align-items: center; fill: currentColor; }
.hdr { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; }
.narrow .hdr { padding: 4px 12px; }
.hbtn { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.hbtn.filled { background: var(--surface-container-high); }
.narrow .hbtn { width: 40px; height: 40px; }
.scroll { flex: 1; overflow: hidden; position: relative; }
.pad { padding: 4px 24px 120px; }
.home-ind { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: 134px; height: 5px; border-radius: 3px; background: var(--text-main); opacity: .9; }
.narrow .home-ind { display: none; }

/* current */
.cur-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-full); background: var(--surface); box-shadow: inset 0 0 0 .5px var(--outline-variant); font-size: 12px; font-weight: 700; letter-spacing: .5px; margin: 8px 0 12px; }
.cur-hero { font-size: 32px; font-weight: 700; letter-spacing: -.5px; line-height: 38px; margin-bottom: 24px; }
.cur-sec { font-size: 20px; font-weight: 600; margin-bottom: 16px; }
.cur-card { background: var(--surface); border-radius: var(--radius-xl); padding: 24px; margin-bottom: 16px; box-shadow: inset 0 0 0 .5px var(--outline-variant), var(--shadow-soft); }
.cur-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.cur-idx { font-size: 13px; font-weight: 700; color: var(--text-muted); letter-spacing: .5px; }
.cur-lab { font-size: 11px; font-weight: 800; color: var(--text-muted); letter-spacing: .8px; margin-bottom: 4px; }
.cur-q { font-size: 16px; font-weight: 600; line-height: 24px; }
.cur-a { font-size: 16px; line-height: 24px; }
.cur-hint { font-size: 16px; font-style: italic; color: var(--text-muted); }
.cur-div { height: .5px; background: var(--outline-variant); margin: 16px 0; }

/* identity + progress */
.chip { display: inline-flex; align-self: flex-start; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-full); background: var(--fc-tint); color: var(--fc-ink); font-size: 12px; font-weight: 700; letter-spacing: .5px; }
.ident { display: flex; flex-direction: column; gap: 8px; padding: 4px 24px 16px; }
.ident.sm { padding: 0 16px 8px; gap: 4px; }
.ident-title { font-size: 20px; font-weight: 600; line-height: 1.3; letter-spacing: -.2px; }
.ident.sm .ident-title { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ident-title.big { font-size: 24px; font-weight: 700; letter-spacing: -.4px; margin: 10px 0 20px; }
.prog { padding: 0 24px; }
.narrow .prog { padding: 0 16px; }
.prog-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.prog-lab { font-size: 14px; font-weight: 600; color: var(--text-subtle); }
.track { height: 4px; border-radius: 2px; background: var(--surface-container-high); overflow: hidden; }
.track i { display: block; height: 100%; border-radius: 2px; background: var(--primary); }
.tally { display: flex; gap: 12px; font-size: 14px; font-weight: 700; }
.tally span { display: flex; align-items: center; gap: 3px; }
.t-ok { color: var(--success); } .t-ko { color: var(--fc-ink); }

/* deck */
.deck { flex: 1; position: relative; margin: 20px 24px 0; padding-bottom: 16px; display: flex; }
.narrow .deck { margin: 12px 16px 0; padding-bottom: 12px; }
.edge { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; border-radius: var(--radius-xl); background: var(--surface); box-shadow: inset 0 0 0 .5px var(--outline-variant); }
.edge.e1 { left: 10px; right: 10px; bottom: 8px; }
.edge.e1 { background: var(--surface-container-low); }
.edge.e2 { left: 22px; right: 22px; bottom: 0; background: var(--surface-container); }
.narrow .edge.e1 { bottom: 6px; }
.card { position: relative; flex: 1; background: var(--surface); border-radius: var(--radius-xl); box-shadow: inset 0 0 0 .5px var(--outline-variant), 0 8px 24px rgba(43,45,66,.08); padding: 28px 24px; display: flex; flex-direction: column; }
.narrow .card { padding: 18px 16px; }
.face { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12px; }
.face.top { justify-content: center; gap: 10px; }
.kick { font-size: 12px; font-weight: 700; letter-spacing: .7px; color: var(--text-subtle); }
.kick.ink { color: var(--fc-ink); }
.q { font-size: 24px; font-weight: 600; line-height: 1.35; letter-spacing: -.3px; }
.narrow .q { font-size: 19px; }
.q-small { font-size: 15px; font-weight: 600; line-height: 1.45; color: var(--text-subtle); }
.rule { height: 4px; width: 40px; border-radius: 2px; background: var(--primary); margin: 4px 0 8px; }
.a { font-size: 20px; line-height: 1.55; }
.hint { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; font-weight: 500; color: var(--text-subtle); }

/* A nav */
.navA { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 40px; }
.round { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--surface-container-high); }
.round.fill { background: var(--primary); color: var(--on-primary); }
.ghost { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 600; color: var(--text-subtle); min-height: 48px; padding: 0 12px; }

/* B actions */
.actions { flex: 0 0 auto; display: flex; gap: 12px; padding: 20px 24px 40px; }
.narrow .actions { padding: 12px 16px 16px; }
.btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 56px; border-radius: var(--radius-lg); font-size: 16px; font-weight: 600; }
.narrow .btn { min-height: 48px; }
.btn.primary { background: var(--primary); color: var(--on-primary); }
.btn.ko { background: var(--fc-tint); color: var(--fc-ink); }
.btn.ok { background: var(--success-tint); color: var(--success); }
.btn.quiet { color: var(--text-subtle); min-height: 48px; }
.stack-btn { flex-direction: column; gap: 4px; padding-bottom: 32px; }
.end { padding-top: 12px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.score { position: relative; width: 120px; height: 120px; margin: 8px 0 16px; }
.score svg { position: absolute; inset: 0; }
.score-n { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.score-n b { font-size: 34px; font-weight: 700; letter-spacing: -.5px; line-height: 1; }
.score-n span { font-size: 13px; color: var(--text-subtle); margin-top: 2px; }
.end-title { font-size: 24px; font-weight: 700; letter-spacing: -.3px; margin-bottom: 6px; }
.end-sub { font-size: 15px; line-height: 1.5; color: var(--text-subtle); max-width: 320px; margin-bottom: 24px; }
.sec { align-self: stretch; text-align: left; font-size: 13px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--text-subtle); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
.count { background: var(--fc-tint); color: var(--fc-ink); border-radius: var(--radius-full); padding: 0 8px; font-size: 12px; }
.miss { align-self: stretch; background: var(--surface); border-radius: var(--radius-xl); overflow: hidden; text-align: left; }
.miss-row { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; font-size: 15px; line-height: 1.45; }
.miss-row + .miss-row { box-shadow: inset 0 .5px 0 var(--surface-container-high); }
.miss-row .ic { margin-top: 3px; }
.two { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* C */
.seg { display: flex; background: var(--surface-container-low); border-radius: var(--radius-full); padding: 4px; margin-bottom: 20px; }
.sg { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border-radius: var(--radius-full); font-size: 14px; font-weight: 500; color: var(--text-subtle); }
.sg.sel { background: var(--primary); color: var(--on-primary); font-weight: 600; }
.lhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--text-subtle); }
.link { display: flex; align-items: center; gap: 6px; text-transform: none; letter-spacing: 0; font-size: 14px; font-weight: 600; color: var(--text-main); min-height: 44px; }
.ccard { background: var(--surface); border-radius: var(--radius-xl); padding: 16px; margin-bottom: 12px; box-shadow: var(--shadow-soft); }
.cq { display: flex; gap: 12px; font-size: 16px; font-weight: 600; line-height: 1.5; margin-bottom: 12px; }
.cn { flex: 0 0 24px; height: 24px; border-radius: 50%; background: var(--fc-tint); color: var(--fc-ink); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
.cans { margin-left: 36px; padding: 10px 14px; border-radius: var(--radius-md); background: var(--primary-05); box-shadow: inset 4px 0 0 var(--primary); font-size: 15px; line-height: 1.6; }
.cveil { margin-left: 36px; min-height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-radius: var(--radius-md); background: var(--surface-container-low); font-size: 14px; font-weight: 600; color: var(--text-subtle); }
</style></head><body>
<svg width="0" height="0" style="position:absolute">${defs}</svg>

<h1>Cartes mémo — pistes UX</h1>
<p class="lede">L’écran actuel (<code>FlashcardsBody</code> dans <code>mobile/app/artifacts/[artifactId].tsx</code>) puis trois pistes, toutes dans les tokens Amber Clarity : fond <code>background</code>, cartes <code>surface</code> rayon 16, ambre réservé à l’action principale et à la progression, teinte du format cartes mémo (<code>artifactFlashcardsTint/Ink</code>) pour l’identité et « À revoir », <code>success</code> pour « Je savais ».</p>

<div class="panel"><h2>Actuel — ce qui coince</h2>
<ul>
<li><b>Tout est visible d’un coup.</b> En lisant la réponse 1, on voit déjà les questions 2 et 3 : pas de concentration, pas d’effort de rappel.</li>
<li><b>Le titre de 32 px et l’en-tête « 12 cartes »</b> repoussent la première carte à mi-écran.</li>
<li><b>Bruit</b> : « #1 », l’œil, les libellés QUESTION / ANSWER (en anglais quand la langue de lecture l’est) sur chaque carte.</li>
<li><b>« Touchez pour révéler »</b> est en <code>textMuted</code> italique, 2,9:1 sur <code>surface</code>, sous les 4,5:1 demandés.</li>
<li><b>Aucune suite</b> : on ne sait pas où on en est, ce qu’on savait, ni quoi revoir.</li>
</ul>
<div class="cells">${cell("Actuel", current, "Liste verticale, chaque carte se déplie au toucher.")}</div></div>

<div class="panel"><h2>A — Paquet : une carte à la fois</h2>
<p class="lede">Le plus petit pas. La carte occupe l’écran, on la retourne d’un toucher, on passe à la suivante par glissement ou par les flèches. Progression reprise du quiz (barre ambrée de 4 px), pour que les deux formats se ressemblent.</p>
<div class="cells">
${cell("A1 · Question", A1, "Question à 24 px au centre de la carte. Le bord de deux cartes en dessous dit « il y en a d’autres ». L’icône liste en haut à droite rouvre la vue liste.")}
${cell("A2 · Réponse", A2, "Retournée : la question reste en rappel, en petit, au-dessus du trait ambré ; la réponse passe à 20 px. « Mélanger » pour ne pas apprendre l’ordre.")}
</div></div>

<div class="panel reco"><h2>B — Je savais / À revoir &nbsp;<span class="count" style="background:var(--primary);color:var(--on-primary)">recommandée</span></h2>
<p class="lede">A, plus une auto-évaluation après chaque carte. C’est ce qui transforme la fiche en outil de révision : un bouton explicite pour révéler (plus de « touchez » caché), deux réponses honnêtes, puis un bilan qui propose de ne revoir que ce qui a manqué. L’état de la session vit dans l’écran ; le garder entre deux ouvertures demanderait un champ côté serveur, à trancher à part.</p>
<div class="cells">
${cell("B1 · Question", B1, "Un seul bouton ambré, « Voir la réponse ». Le compteur ✓ 5 · ↺ 2 à droite de la progression.")}
${cell("B2 · Réponse", B2, "Deux boutons pleine largeur, même poids : « À revoir » dans la teinte du format, « Je savais » en vert succès. Le choix passe à la carte suivante.")}
${cell("B3 · Bilan", B3, "Anneau 8 sur 12, la liste des cartes manquées, et l’action utile en premier : « Revoir les 4 cartes ».")}
${cell("B4 · Petit écran (320×568)", B4, "Le titre de la source tient sur une ligne, la question descend à 19 px : la carte et le bouton restent visibles sans défiler.")}
</div></div>

<div class="panel"><h2>C — Liste allégée</h2>
<p class="lede">Pour qui veut parcourir ou relire avant un examen. Se combine avec A ou B via un sélecteur « Réviser / Liste » (le contrôle segmenté du design system).</p>
<div class="cells">
${cell("C1 · Liste", C1, "Plus de #, d’œil ni de libellés : un numéro dans une pastille teintée, la question en gras, la réponse dans l’encadré ambré du design system (barre 4 px + fond 5 %). « Tout afficher » d’un coup ; le voile « Afficher la réponse » passe en textSubtle (5,6:1).")}
</div></div>

<div class="panel"><h2>Proposition</h2>
<p>B comme mode par défaut, C comme vue secondaire derrière l’icône liste (ou le segmenté). A n’est que l’étape intermédiaire de B : on peut livrer A d’abord si on veut avancer en deux fois.</p>
</div>
</body></html>`;

writeFileSync(join(HERE, "..", "code.html"), html);
console.log("code.html written", html.length, "bytes");
