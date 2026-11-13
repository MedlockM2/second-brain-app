// Builds chargement_import_media/code.html: the Reader tab of a media still being imported, and
// five ways to show the wait (TestFlight feedback AM6k6fv3QCFz8rAOZnqS9KM, build 27, 2026-11-13).
// Usage (from the repository root): node mobile-design-mockups/chargement_import_media/_build/build.mjs
// Render (Node 20 needs --experimental-websocket): DIRS=chargement_import_media node --experimental-websocket mobile-design-mockups/auth_directions/_build/shoot.mjs [frames-dir]
// The animations run in the browser; screen.png freezes them at an arbitrary frame.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ic, phone, page } from "../../auth_directions/_build/kit.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CSS = `
.rd-head { position: absolute; top: 54px; left: 0; right: 0; height: 64px; display: flex; align-items: center; gap: 12px; padding: 0 16px 0 20px; z-index: 6; background: var(--background); }
.rd-head .bk { color: var(--text-main); display: flex; transform: rotate(180deg); }
.rd-head .th { width: 32px; height: 32px; border-radius: 8px; flex: none; background: linear-gradient(135deg,#5a4a42,#2a2320 60%,#6b5a3a); }
.rd-head .tt { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rd-head .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--surface-container); flex: none; }
.rd-head .tabs span { width: 44px; height: 44px; border-radius: 22px; display: flex; align-items: center; justify-content: center; color: var(--text-subtle); }
.rd-head .tabs span.on { background: var(--primary); color: var(--on-primary); }
.rd-prog { position: absolute; top: 118px; left: 0; right: 0; height: 3px; background: var(--surface-container); z-index: 6; overflow: hidden; }
.rd { position: absolute; top: 121px; left: 0; right: 0; bottom: 96px; padding: 18px 24px 0; overflow: hidden; }
.rd h3 { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
.rd-ask { position: absolute; left: 16px; right: 16px; bottom: 30px; height: 56px; border-radius: 28px; background: var(--surface-container); display: flex; align-items: center; gap: 12px; padding: 0 20px; color: var(--text-muted); font-size: 16px; z-index: 6; }

/* The state, centred in the space the text will take. */
.wait { position: absolute; left: 24px; right: 24px; top: 210px; display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center; }
.wait .line { font-size: 16px; line-height: 25.6px; color: var(--text-subtle); }

/* Today: three spinners. */
.spin { width: 20px; height: 20px; border-radius: 50%; border: 2.5px solid var(--surface-container-high); border-top-color: var(--primary); animation: rot .8s linear infinite; flex: none; }
@keyframes rot { to { transform: rotate(360deg); } }
.now-c { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 8px 0 22px; }
.now-c .line { font-size: 15px; color: var(--text-subtle); }
.now-c a { font-size: 15px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.aside { border-left: 4px solid var(--primary); background: var(--primary-05); border-radius: 4px 12px 12px 4px; padding: 14px 16px; margin-bottom: 26px; }
.aside b { display: block; font-size: 15px; margin-bottom: 10px; }
.row { display: flex; align-items: center; gap: 10px; font-size: 15px; color: var(--text-subtle); }

/* A — the branch: the breathing dot of the chat. */
.dot { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; }
.dot i { width: 16px; height: 16px; border-radius: 50%; background: var(--text-main); animation: breathe 1.2s ease-in-out infinite alternate; }
@keyframes breathe { from { transform: scale(.65); } to { transform: scale(1); } }

/* B — the line itself shimmers. */
.shim { font-size: 17px; font-weight: 550; background: linear-gradient(100deg, var(--text-muted) 0%, var(--text-muted) 38%, var(--text-main) 50%, var(--text-muted) 62%, var(--text-muted) 100%); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: sweep 1.8s linear infinite; }
@keyframes sweep { from { background-position: 100% 0; } to { background-position: -150% 0; } }

/* C — the shape of the text, waiting. */
.sk-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-subtle); margin: 0 0 18px; }
.sk-label .pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--primary); animation: blink 1.2s ease-in-out infinite alternate; }
@keyframes blink { from { opacity: .3; } to { opacity: 1; } }
.sk { display: flex; flex-direction: column; gap: 12px; }
.sk i { display: block; height: 14px; border-radius: 7px; background: linear-gradient(90deg, var(--surface-container) 0%, var(--surface-container) 35%, var(--surface-container-high) 50%, var(--surface-container) 65%, var(--surface-container) 100%); background-size: 300% 100%; animation: sk 1.6s ease-in-out infinite; }
.sk i.title { height: 22px; width: 46%; border-radius: 8px; margin-bottom: 8px; }
.sk .gap { height: 14px; }
@keyframes sk { from { background-position: 100% 0; } to { background-position: 0 0; } }

/* D — the media's type, ringed by a turning arc. */
.ring { position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; color: var(--text-main); }
.ring::before { content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--surface-container); }
.ring::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 2.5px solid transparent; border-top-color: var(--primary); animation: rot 1.4s cubic-bezier(.5,.1,.5,.9) infinite; }
.ring .ic { position: relative; }

/* E — the progress bar under the tabs runs, and nothing else moves. */
.rd-prog .run { position: absolute; top: 0; height: 3px; width: 34%; background: var(--primary); border-radius: 2px; animation: run 1.5s ease-in-out infinite; }
@keyframes run { from { left: -34%; } to { left: 100%; } }

.labels { display: grid; grid-template-columns: repeat(3, auto); gap: 6px 28px; justify-content: start; margin: 4px 0 0; font-size: 14.5px; }
.labels span { color: var(--text-subtle); }
@media (prefers-reduced-motion: reduce) { .phone * { animation: none !important; } }
`;

const TITLE = "« Aux Etats-Unis, les démocrates ont deux ans pour redessiner une politique étrangère à partir d’un champ de ruines »";
const header = (bar = "") => `
<div class="rd-head"><span class="bk">${ic("arrow-forward", 24)}</span><span class="th"></span>
<span class="tt">${TITLE}</span>
<span class="tabs"><span class="on">${ic("book-outline", 20)}</span><span>${ic("sparkles-outline", 20)}</span></span></div>
<div class="rd-prog">${bar}</div>`;
const ask = `<div class="rd-ask">${ic("chatbubbles-outline", 22)}Poser une question sur cette source…</div>`;
const LABEL = "Extraction du contenu…";

// Today, after the tester's capture.
const today = `${header()}<div class="rd">
<div class="now-c"><span class="spin"></span><span class="line">Génération du texte…</span><a>Actualiser</a></div>
<div class="aside"><b>L’essentiel</b><div class="row"><span class="spin"></span>Chargement de l’aperçu…</div></div>
<h3>Texte complet</h3><div class="row"><span class="spin"></span>Extraction du contenu audio…</div>
</div>${ask}`;

const centred = (glyph, line = `<span class="line">${LABEL}</span>`, bar = "") =>
  `${header(bar)}<div class="rd"></div><div class="wait">${glyph}${line}</div>${ask}`;

const a = centred(`<span class="dot"><i></i></span>`);
const b = centred("", `<span class="shim">${LABEL}</span>`);
const c = `${header()}<div class="rd">
<div class="sk-label"><span class="pulse"></span>${LABEL}</div>
<div class="sk"><i class="title"></i>
<i style="width:100%"></i><i style="width:96%"></i><i style="width:99%"></i><i style="width:72%"></i><span class="gap"></span>
<i style="width:98%"></i><i style="width:100%"></i><i style="width:94%"></i><i style="width:58%"></i><span class="gap"></span>
<i style="width:97%"></i><i style="width:88%"></i></div></div>${ask}`;
const d = centred(`<span class="ring">${ic("newspaper-outline", 28)}</span>`);
const e = centred("", `<span class="line">${LABEL}</span>`, `<span class="run"></span>`);

const body = `
<div class="kicker">Retour TestFlight AM6k6fv3QCFz8rAOZnqS9KM · build 27 · iPhone 11 Pro Max, iOS 26.6</div>
<h1>Attendre un import, sans bruit</h1>
<p class="lede">« Globalement il faut simplifier et rendre plus premium l’écran de chargement d’un media en cours d’import. Il y a trop de textes et de spinners dans tous les sens. » Cinq façons de montrer l’attente, sur l’article du <i>Monde</i> de la capture. Les animations tournent dans cette page.</p>

<h2>Aujourd’hui</h2>
<div class="cells">
${phone(today, { dark: true, title: "D’après la capture", caption: "Trois spinners, trois textes et un lien « Actualiser ». « Extraction du contenu audio… » s’affiche alors qu’il s’agit d’un article." })}
</div>

<h2>Cinq propositions</h2>
<p class="lede" style="font-size:15.5px!important">Toutes partagent le même fond : un seul état tant que le texte n’est pas prêt, une seule ligne qui dépend du type de média, pas de bouton. « L’essentiel » et « Texte complet » n’apparaissent qu’une fois le texte prêt (sauf en C, qui en montre la forme).</p>
<div class="cells">
${phone(a, { dark: true, title: "A · Point qui respire (branche actuelle)", caption: "Le point du chat, qui grossit et rétrécit, au-dessus de la ligne. Même signe d’attente partout dans l’app." })}
${phone(b, { dark: true, title: "B · Texte qui scintille", caption: "Aucun glyphe : un reflet traverse la ligne elle-même, de gauche à droite. Le plus sobre ; l’attente se lit dans le texte." })}
${phone(c, { dark: true, title: "C · Forme du texte", caption: "Des lignes grises à la place du texte, parcourues par un reflet, sous une ligne d’état. On voit où le texte va arriver ; c’est le plus « chargé » des cinq." })}
</div>
<div class="cells" style="margin-top:28px">
${phone(d, { dark: true, title: "D · Type du média en anneau", caption: "L’icône du type (journal, micro, caméra) dans une pastille, avec un arc ambre qui tourne autour. Dit d’un coup d’œil ce qui est importé." })}
${phone(e, { dark: true, title: "E · Barre sous les onglets", caption: "La barre de lecture sous l’en-tête devient une barre de progression qui court ; le centre ne montre qu’une ligne immobile. Le mouvement le plus discret." })}
</div>

<section class="panel">
<h2 style="margin-top:0">La ligne, selon le type de média</h2>
<div class="labels"><b>Audio, podcast</b><b>Vidéo</b><b>Article, PDF, image, note</b>
<span>Transcription de l’audio…</span><span>Transcription de la vidéo…</span><span>Extraction du contenu…</span></div>
<p class="caption" style="padding:0;margin-top:12px">Identique dans les cinq propositions. Au-delà de 5 min : « Cela prend plus de temps que d’habitude. » et une pastille « Actualiser ». En échec : le message d’erreur et la carte support.</p>
</section>`;

writeFileSync(join(OUT, "code.html"), page({ title: "Chargement d’un import", body }).replace("</style>", `${CSS}</style>`));
console.log("wrote", join(OUT, "code.html"));
