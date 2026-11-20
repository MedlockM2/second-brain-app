// Writes ../code.html: the browser extension's side panel, a copy of the app's media page.
// Usage (from the repository root): node mobile-design-mockups/extension_panneau_lateral/_build/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

// --- Icons: the web app's Ionicons outlines (web/src/components/icons.generated.ts) ----------
const source = readFileSync(join(ROOT, "web/src/components/icons.generated.ts"), "utf8");
const paths = Object.fromEntries([...source.matchAll(/^\s*"([a-z-]+)":\s*"([^"]+)"/gm)].map((m) => [m[1], m[2]]));
const USED = ["book-outline", "sparkles-outline", "sparkles", "document-text-outline", "copy-outline", "help-circle-outline",
  "chevron-down", "chevron-forward", "chevron-back", "open-outline", "folder-outline", "checkmark-circle", "checkmark",
  "arrow-up", "ellipsis-horizontal", "sync-outline", "refresh-outline", "log-out-outline", "close", "search-outline", "add",
  "alert-circle-outline", "newspaper", "create-outline", "globe-outline", "eye-outline", "extension-puzzle-outline", "time-outline"];
for (const name of USED) if (!paths[name]) throw new Error(`icon missing: ${name}`);
const defs = USED.map((n) => `<symbol id="i-${n}" viewBox="0 0 512 512"><path d="${paths[n]}" fill="currentColor"/></symbol>`).join("");
const LOGO = `data:image/png;base64,${readFileSync(join(ROOT, "extension/public/icon/128.png")).toString("base64")}`;
const logo = (size) => `<span class="logo" style="width:${size}px;height:${size}px"></span>`;
const ic = (n, s = 18, cls = "") => `<svg class="ic ${cls}" width="${s}" height="${s}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

// --- Fictitious content -----------------------------------------------------------------------
const TITLE = "Pourquoi la meilleure pause ne demande rien";
const SITE = "lentement.media";
const ESSENTIAL = {
  hook: "Une pause ne répare l'attention que si elle ne lui demande plus rien : ni écran, ni message, ni décision.",
  points: [
    "La fatigue vient de l'effort d'inhibition, pas de la durée de la tâche.",
    "Consulter son téléphone pendant la pause sollicite le même effort : elle ne repose pas.",
    "Dix minutes à regarder loin, dehors, valent mieux qu'une courte sieste.",
  ],
};
const PARAGRAPHS = [
  "On confond souvent deux états : être fatigué d'une tâche et s'ennuyer pendant une tâche. De l'extérieur ils se ressemblent ; dans le cerveau, ils n'ont presque rien en commun.",
  "L'ennui est un signal de valeur : la tâche ne rapporte pas assez pour ce qu'elle coûte. La fatigue attentionnelle, elle, vient de l'effort qui consiste à tenir à distance tout ce qui n'est pas la tâche.",
  "Cet effort d'inhibition s'use. Au bout de quarante à soixante minutes, il a un coût mesurable en temps de réaction, même quand la tâche passionne.",
  "Une bonne pause est donc une pause qui ne sollicite plus ce système : regarder loin, marcher sans but, ne rien décider. Le téléphone fait exactement l'inverse.",
];

// --- Pieces --------------------------------------------------------------------------------------
const chromeBar = `<div class="cbar"><span class="cbar-name">${logo(16)}Deepn</span><span class="cbar-x">${ic("close", 16)}</span></div>`;

const header = ({ status = "saved", folder = "Écriture", open = false } = {}) => {
  const statusChip = {
    saved: `<span class="chip ok">${ic("checkmark-circle", 15)}Enregistré</span>`,
    already: `<span class="chip ok">${ic("checkmark-circle", 15)}Déjà dans votre bibliothèque</span>`,
    processing: `<span class="chip">${ic("sync-outline", 15, "spin")}Traitement en cours</span>`,
  }[status];
  return `
  <header class="mh">
    <div class="mh-row">
      <span class="thumb">${ic("newspaper", 24)}</span>
      <div class="mh-id"><div class="kicker">LENTEMENT · ${SITE}</div><h2 class="mh-title">${TITLE}</h2></div>
      <div class="mh-btns"><span class="ibtn" title="Ouvrir dans Deepn">${ic("open-outline", 18)}</span><span class="ibtn" title="Plus">${ic("ellipsis-horizontal", 18)}</span></div>
    </div>
    <div class="mh-meta">${statusChip}<span class="chip folder ${open ? "on" : ""}">${ic("folder-outline", 15)}${folder}${ic("chevron-down", 13)}</span></div>
  </header>`;
};

const tabs = (active) => `
  <div class="tabs"><span class="tab ${active === "reader" ? "on" : ""}">${ic("book-outline", 17)}Lecture</span><span class="tab ${active === "ai" ? "on" : ""}">${ic("sparkles-outline", 17)}Cahier</span></div>`;

const essential = (pending = false) => pending
  ? `<section class="ess pending"><div class="lab">L'ESSENTIEL</div><p class="muted">L'aperçu est en cours de rédaction…</p><i class="sk"></i><i class="sk"></i><i class="sk short"></i></section>`
  : `<section class="ess"><div class="lab">L'ESSENTIEL</div><p class="hook">${ESSENTIAL.hook}</p><ul>${ESSENTIAL.points.map((p) => `<li>${p}</li>`).join("")}</ul></section>`;

const fullText = (state) => {
  if (state === "pending") return `<div class="fold off">${ic("document-text-outline", 18)}<span class="fold-t">Texte complet</span><span class="fold-m">en préparation</span></div>`;
  const row = `<div class="fold ${state === "open" ? "on" : ""}">${ic("document-text-outline", 18)}<span class="fold-t">Texte complet</span><span class="fold-m">14 paragraphes</span>${ic("chevron-down", 16, state === "open" ? "flip" : "")}</div>`;
  if (state !== "open") return row;
  return `${row}<div class="text">${PARAGRAPHS.map((p, i) => `<p><span class="pn">§${i + 1}</span>${p}</p>`).join("")}<p class="more">… §5 à §14</p></div>`;
};

const chat = (state) => {
  const head = `<div class="sec-head"><h3>Discussion</h3>${state === "empty" || state === "waiting" ? "" : `<span class="link">${ic("create-outline", 15)}Nouvelle conversation</span>`}</div>`;
  if (state === "waiting") return `${head}<p class="note">La discussion s'ouvre une fois le traitement terminé.</p>`;
  if (state === "empty") return `${head}<p class="note">Posez une question : la réponse s'appuie sur le texte de cette page.</p>`;
  const answer = `<div class="ans"><p>Une pause qui <b>ne demande rien</b> : dix à quinze minutes dehors ou face à une fenêtre, ou une marche sans but et sans écouteurs.</p><p>À éviter : le téléphone, qui sollicite le même effort d'inhibition que la relecture.</p></div>`;
  const second = state === "writing"
    ? `<div class="q">Et une sieste, ça marche ?</div><div class="typing"><span></span><span></span><span></span>La réponse s'écrit.</div>`
    : `<div class="q">Et une sieste, ça marche ?</div><div class="ans"><p>Courte, elle aide surtout la vigilance ; pour l'attention dirigée, l'article la juge moins efficace qu'un regard au loin <a class="cite-web">${ic("globe-outline", 13)}inserm.fr</a>.</p></div>`;
  return `${head}<div class="thread"><div class="q">Quelle pause pour un après-midi de relecture ?</div>${answer}${second}</div>`;
};

const composer = (disabled = false) => `<div class="composer ${disabled ? "off" : ""}"><span class="web-search" title="Rechercher sur le web">${ic("globe-outline", 18)}</span><span class="field">Interroger cette source…</span><span class="send">${ic("arrow-up", 18)}</span></div>`;

const panel = (body, { foot = "", cls = "", h = 900 } = {}) =>
  `<div class="frame panel ${cls}" style="height:${h}px">${chromeBar}<div class="pbody">${body}</div>${foot}</div>`;

const cell = (title, f, caption, w = 400) => `<div class="cell" style="width:${w}px"><p class="ftitle">${title}</p>${f}<p class="caption">${caption}</p></div>`;

// --- Notebook --------------------------------------------------------------------------------------
const FORMATS = [
  ["f-summary", "document-text-outline", "Résumé"],
  ["f-notes", "book-outline", "Notes de cours"],
  ["f-flashcards", "copy-outline", "Cartes mémo"],
  ["f-quiz", "help-circle-outline", "Quiz"],
];
const grid = `<h3 class="h3">Générer</h3><div class="grid">${FORMATS.map(([t, i, l]) => `<span class="tile ${t}">${ic(i, 18)}${l}</span>`).join("")}</div>`;
const row = (tone, icon, title, meta, extra = "") => `<div class="arow ${extra}"><span class="aic ${tone}">${ic(icon, 17)}</span><span class="atx"><span class="at">${title}</span><span class="am">${meta}</span></span>${extra.includes("gen") ? "" : ic("chevron-forward", 16, "muted")}</div>`;
const notebookList = `
  <div class="alist">
    <div class="arow gen"><span class="aic f-flashcards">${ic("copy-outline", 17)}<i class="spark">${ic("sparkles", 10)}</i></span><span class="atx"><span class="at">Génération…</span><span class="am">Cartes mémo · Quelques secondes · vous pouvez fermer le panneau</span></span></div>
    ${row("f-summary", "document-text-outline", "La pause qui ne demande rien", "Résumé · il y a 2 min")}
    ${row("f-quiz", "help-circle-outline", "Quiz", "Échec de la génération · toucher pour réessayer", "fail")}
    ${row("f-notes", "book-outline", "Attention, inhibition et récupération", "Notes de cours · hier")}
  </div>
  <p class="aside">Personnaliser, renommer ou supprimer une fiche : <span class="link">dans Deepn ${ic("open-outline", 13)}</span></p>`;

const artifactTop = (kind, tone, icon, title, meta) => `
  <div class="crumb">${ic("chevron-back", 16)}Cahier</div>
  <div class="akick ${tone}">${ic(icon, 14)}${kind}</div>
  <h2 class="atitle">${title}</h2>
  <p class="ameta">${meta}</p>`;

const summaryOpen = `
  ${artifactTop("RÉSUMÉ", "f-summary", "document-text-outline", "La pause qui ne demande rien", "Généré il y a 2 min · 1 source")}
  <ul class="kp"><li>La fatigue attentionnelle vient de l'effort d'inhibition, qui s'use en 40 à 60 minutes.</li><li>L'ennui est un signal de valeur ; la fatigue, un coût : ils ne se soignent pas pareil.</li><li>Une pause répare si elle ne sollicite plus ce système : regard au loin, marche sans but.</li><li>Le téléphone pendant la pause entretient la fatigue qu'on veut réparer.</li></ul>
  <div class="take">À retenir : on ne se repose pas en changeant de tâche, mais en cessant de choisir.</div>`;

const flashOpen = `
  ${artifactTop("CARTES MÉMO", "f-flashcards", "copy-outline", "Attention et pauses", "12 cartes · généré hier")}
  <div class="prog"><div class="prog-row"><span>Carte 3 sur 12</span><span class="tally"><span class="ok">${ic("checkmark", 12)}2</span><span class="again">${ic("refresh-outline", 12)}0</span></span></div><div class="track"><i style="width:25%"></i></div></div>
  <div class="deck"><span class="edge e2"></span><span class="edge e1"></span><div class="card"><div class="kq">QUESTION</div><div class="cq">Pourquoi consulter son téléphone pendant une pause ne repose-t-il pas ?</div></div></div>
  <span class="btn primary">${ic("eye-outline", 17)}Voir la réponse</span>`;

const quizOpen = `
  ${artifactTop("QUIZ", "f-quiz", "help-circle-outline", "Fatigue ou ennui ?", "10 questions · généré hier")}
  <div class="prog"><div class="prog-row"><span>Question 3 sur 10</span></div><div class="track"><i style="width:30%"></i></div></div>
  <p class="qq">Au bout de combien de temps l'effort d'inhibition a-t-il un coût mesurable ?</p>
  <div class="opts"><span class="opt"><b>A</b>10 à 15 minutes</span><span class="opt right"><b>B</b>40 à 60 minutes${ic("checkmark-circle", 18)}</span><span class="opt"><b>C</b>Deux heures</span><span class="opt"><b>D</b>Il n'a pas de coût mesurable</span></div>
  <div class="expl"><div class="lab">EXPLICATION</div>L'article situe la baisse mesurable entre quarante et soixante minutes d'attention dirigée (§3).</div>
  <span class="btn primary">Question suivante${ic("chevron-forward", 16)}</span>`;

// --- Frames -----------------------------------------------------------------------------------------
const readerCollapsed = panel(`${header()}${tabs("reader")}<div class="pad">${essential()}${fullText("closed")}${chat("answered")}</div>`, { foot: composer(), h: 1010 });
const readerOpen = panel(`${header({ status: "already" })}${tabs("reader")}<div class="pad">${essential()}${fullText("open")}${chat("writing")}</div>`, { foot: composer(), h: 1100 });
const readerPending = panel(`${header({ status: "processing" })}${tabs("reader")}<div class="pad">${essential(true)}${fullText("pending")}${chat("waiting")}</div>`, { foot: composer(true), h: 700 });
const notebook = panel(`${header({ status: "already" })}${tabs("ai")}<div class="pad">${grid}${notebookList}</div>`, { h: 760 });
const summary = panel(`${header({ status: "already" })}${tabs("ai")}<div class="pad">${summaryOpen}</div>`, { h: 760 });
const flash = panel(`${header({ status: "already" })}${tabs("ai")}<div class="pad">${flashOpen}</div>`, { h: 760 });
const quiz = panel(`${header({ status: "already" })}${tabs("ai")}<div class="pad">${quizOpen}</div>`, { h: 860 });

const folderMenu = `<div class="menu"><div class="msearch">${ic("search-outline", 16)}neur<i class="caret"></i></div>
  <div class="mrow on">Neurosciences</div><div class="mrow">Neurologie clinique</div><div class="mrow create">${ic("add", 16)}Créer « neur »</div></div>`;
const folderOpen = panel(`${header({ open: true })}${folderMenu}${tabs("reader")}<div class="pad">${essential()}</div>`, { h: 640, cls: "has-menu" });
const moreMenu = `<div class="menu right"><div class="mrow muted-row">${ic("time-outline", 16)}Raccourci : ⌥S</div><div class="mrow">${ic("log-out-outline", 16)}Se déconnecter</div></div>`;
const more = panel(`${header()}${moreMenu}${tabs("reader")}<div class="pad">${essential()}</div>`, { h: 640, cls: "has-menu" });
const unlinked = panel(`<div class="pad link-pad">
  ${logo(56)}
  <h2 class="lt">Reliez l'extension à votre compte</h2>
  <p class="lp">Ouvrez Deepn sur le web, allez dans Mon compte › Extension navigateur, puis cliquez sur « Relier cette extension ».</p>
  <span class="btn primary">Ouvrir Mon compte</span>
  <p class="lp small">Ou saisissez le code affiché là-bas, avec l'e-mail de votre compte :</p>
  <span class="input">E-mail de votre compte</span><span class="input">Code à 6 chiffres</span><span class="btn">Relier</span></div>`, { h: 640 });
const accountBox = `<div class="account"><span class="account-label">Compte relié</span><span class="account-email">camille.martin@gmail.com</span></div>`;
const otherAccount = `<div class="warn" role="alert">${ic("alert-circle-outline", 20)}<div class="warn-body">
  <p class="warn-t">Un autre compte est connecté sur le web</p>
  <p>Sur Deepn, vous utilisez <b class="mail">c.martin@atelier-lumen.fr</b></p><p>Vos enregistrements vont dans le compte relié ci‑dessus.</p>
  <div class="warn-acts"><span class="wbtn primary">Passer à ce compte</span><span class="wbtn">Garder l'actuel</span></div></div></div>`;
const mismatch = panel(`${accountBox}${otherAccount}${header()}${tabs("reader")}<div class="pad">${essential()}</div>`, { h: 760 });
const dark = panel(`${header()}${tabs("reader")}<div class="pad">${essential()}${fullText("closed")}${chat("answered")}</div>`, { foot: composer(), cls: "dark" });

// --- In the browser -------------------------------------------------------------------------------------
const browser = `<div class="frame browser">
  <div class="bbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">${ic("globe-outline", 13)}${SITE}/pause-ideale</span><span class="ext on">${logo(18)}</span></div>
  <div class="bmain">
    <article class="site"><div class="site-name">LENTEMENT</div><h1>${TITLE}</h1><p class="by">Par la rédaction · 9 min de lecture</p>${PARAGRAPHS.map((p) => `<p>${p}</p>`).join("")}</article>
    <div class="side">${panel(`${header()}${tabs("reader")}<div class="pad">${essential()}${fullText("closed")}${chat("empty")}</div>`, { foot: composer(), h: 760 }).replace('class="frame panel ', 'class="panel inset ')}</div>
  </div></div>`;

// --- Page ----------------------------------------------------------------------------------------------------
const css = `
:root{--primary:#ffcb05;--on-primary:#1c1b1a;--background:#fcf9f6;--surface:#fff;--sc:#f1edea;--sch:#ebe7e5;--text:#2b2d42;--muted:#8d99ae;--subtle:#5c6880;--ov:#c8c7bd;--error:#ba1a1a;--error-tint:rgba(186,26,26,.08);--success:#2e7d4f;--success-tint:rgba(46,125,79,.11);--ess:#fdf6e3;--article:#c1ebec;--web:#dfe8fa;--on-web:#24406e;--sheen:rgba(255,203,5,.28);
--st:#fff3c4;--si:#9c7400;--nt:#e3eee4;--ni:#3f7048;--ft:#f5e1e1;--fi:#9b4a52;--qt:#e2e8f4;--qi:#46598a;--shadow:0 8px 24px rgba(43,45,66,.06)}
.dark{--primary:#f0bf2a;--background:#171511;--surface:#211e19;--sc:#2d2a25;--sch:#37332c;--text:#f1ebe1;--muted:#9aa3b4;--subtle:#c6cdd9;--ov:#3d3932;--error:#ffb4ab;--success:#7fd3a1;--success-tint:rgba(127,211,161,.12);--ess:#2a2418;--article:#0b4f51;--web:#22344f;--on-web:#c9dafb;
--st:#3f331a;--si:#e2b55a;--nt:#28392b;--ni:#93c89a;--ft:#472e2f;--fi:#faa4a9;--qt:#2a3546;--qi:#a9baf4;--shadow:0 8px 24px rgba(0,0,0,.35)}
*{box-sizing:border-box}body{margin:0;background:#e9e5df;color:#2b2d42;font:400 14px/1.55 Inter,-apple-system,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.page{max-width:1760px;margin:0 auto;padding:40px 32px 60px}
.tag{display:inline-block;background:#ffcb05;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700}
h1.ptitle{font-size:30px;margin:10px 0 6px;letter-spacing:-.4px}.lede{color:#5c6880;max-width:900px;margin:0 0 20px}
.principle{background:#fff;border-radius:16px;padding:18px 24px;margin-bottom:34px;max-width:1100px}.principle h2{font-size:15px;margin:0 0 6px}.principle li{margin:4px 0}
.section{font-size:20px;margin:30px 0 14px}.row{display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start}
.cell .ftitle{font-size:12px;font-weight:700;letter-spacing:.06em;color:#5c6880;margin:0 0 8px;text-transform:uppercase}.cell .caption{font-size:12.5px;color:#5c6880;margin:10px 2px 0;line-height:1.5}
.ic{display:inline-block;flex:none;vertical-align:middle}.ic.flip{transform:rotate(180deg)}.ic.muted{color:var(--muted)}
/* The side panel */
.panel{position:relative;width:400px;background:var(--background);color:var(--text);border-radius:14px;overflow:hidden;box-shadow:0 2px 0 rgba(0,0,0,.04),0 12px 32px rgba(43,45,66,.12);display:flex;flex-direction:column}
.panel.inset{width:400px;height:100%;border-radius:0;box-shadow:none;border-left:1px solid #d9d4cc}
.cbar{height:38px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:var(--sc);border-bottom:1px solid var(--ov);font-size:12.5px;font-weight:600;color:var(--subtle)}
.cbar-name{display:flex;align-items:center;gap:7px}.logo{display:inline-block;flex:none;background:url(${LOGO}) center/contain no-repeat}
.pbody{flex:1;overflow:hidden}.pad{padding:4px 16px 16px}
.mh{padding:14px 16px 10px}.mh-row{display:flex;gap:12px;align-items:flex-start}
.thumb{width:52px;height:52px;border-radius:12px;background:var(--article);display:grid;place-items:center;color:var(--subtle);flex:none}
.mh-id{flex:1;min-width:0}.kicker{font-size:10.5px;font-weight:700;letter-spacing:.08em;color:var(--muted);margin-bottom:2px}
.mh-title{font:650 16px/1.3 "Plus Jakarta Sans",-apple-system,system-ui,sans-serif;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mh-btns{display:flex;gap:4px}.ibtn{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:var(--subtle);background:var(--sc)}
.mh-meta{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:9999px;background:var(--sc);color:var(--subtle);font-size:12.5px;font-weight:600}
.chip.ok{background:var(--success-tint);color:var(--success)}.chip.folder{color:var(--text)}.chip.folder.on{box-shadow:0 0 0 2px var(--primary)}
.spin{animation:spin 1.6s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.tabs{display:flex;margin:4px 16px 14px;padding:4px;background:var(--sc);border-radius:9999px}
.tab{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:36px;border-radius:9999px;font-weight:600;color:var(--subtle)}.tab.on{background:var(--primary);color:#1c1b1a}
.ess{background:var(--ess);border-left:4px solid var(--primary);border-radius:4px 12px 12px 4px;padding:12px 14px 10px}
.lab{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--subtle);margin-bottom:4px}.hook{margin:0 0 6px;font-weight:600}
.ess ul,.kp{margin:0;padding-left:18px}.ess li,.kp li{margin-bottom:4px}
.ess.pending .muted{color:var(--muted);margin:0 0 10px}.sk{display:block;height:10px;border-radius:6px;background:linear-gradient(90deg,var(--sc),var(--sch),var(--sc));margin:8px 0}.sk.short{width:60%}
.fold{display:flex;align-items:center;gap:10px;margin-top:12px;padding:0 14px;height:48px;border-radius:12px;background:var(--surface);box-shadow:var(--shadow);color:var(--text)}
.fold .ic:first-child{color:var(--subtle)}.fold-t{font-weight:600}.fold-m{margin-left:auto;color:var(--muted);font-size:12.5px}.fold.on{border-radius:12px 12px 0 0}.fold.off{opacity:.55}
.text{background:var(--surface);border-radius:0 0 12px 12px;padding:2px 14px 10px;box-shadow:var(--shadow);border-top:1px solid var(--sc)}
.text p{margin:10px 0;font-size:13.5px}.pn{color:var(--muted);font-size:11.5px;margin-right:6px}.text .more{color:var(--muted);font-size:12.5px}
.sec-head{display:flex;align-items:baseline;justify-content:space-between;margin:20px 0 8px}.sec-head h3,.h3{font:650 15px/1.3 "Plus Jakarta Sans",-apple-system,system-ui,sans-serif;margin:0}
.h3{margin:4px 0 10px}.link{display:inline-flex;align-items:center;gap:5px;color:var(--subtle);font-size:12.5px;font-weight:600}
.note{color:var(--muted);margin:0}.thread{display:flex;flex-direction:column;gap:10px}
.q{align-self:flex-end;max-width:85%;background:var(--sc);border-radius:16px 16px 4px 16px;padding:8px 12px}
.ans p{margin:0 0 8px}.cite-web{display:inline-flex;align-items:center;gap:4px;padding:0 7px;border-radius:9999px;background:var(--web);color:var(--on-web);font-size:12px;font-weight:600}
.typing{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:12.5px}.typing span{width:6px;height:6px;border-radius:50%;background:var(--primary);animation:blink 1.2s infinite}.typing span:nth-child(2){animation-delay:.2s}.typing span:nth-child(3){animation-delay:.4s;margin-right:4px}@keyframes blink{50%{opacity:.25}}
.composer{flex:none;display:flex;gap:8px;align-items:center;padding:10px 14px 14px;border-top:1px solid var(--ov);background:var(--background)}
.field{flex:1;height:42px;border-radius:9999px;background:var(--sc);display:flex;align-items:center;padding:0 16px;color:var(--muted)}
.send{width:42px;height:42px;border-radius:50%;background:var(--primary);color:#1c1b1a;display:grid;place-items:center}.composer.off{opacity:.5}
.web-search{flex:none;width:36px;height:36px;border-radius:9999px;display:grid;place-items:center;color:var(--subtle)}
/* Notebook */
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tile{display:flex;align-items:center;gap:9px;height:48px;padding:0 12px;border-radius:12px;background:var(--tint);color:var(--text);font-weight:600}.tile .ic{color:var(--ink)}
.f-summary{--tint:var(--st);--ink:var(--si)}.f-notes{--tint:var(--nt);--ink:var(--ni)}.f-flashcards{--tint:var(--ft);--ink:var(--fi)}.f-quiz{--tint:var(--qt);--ink:var(--qi)}
.alist{margin-top:16px;display:flex;flex-direction:column;gap:2px}.arow{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--sc)}
.aic{position:relative;width:36px;height:36px;border-radius:10px;background:var(--tint);color:var(--ink);display:grid;place-items:center;flex:none}.atx{flex:1;min-width:0;display:flex;flex-direction:column}
.at{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.am{font-size:12px;color:var(--muted)}.arow.fail .am{color:var(--error)}
.arow.gen{border-radius:12px;border-bottom:0;background:linear-gradient(100deg,var(--surface) 30%,var(--sheen) 50%,var(--surface) 70%);background-size:300% 100%;animation:sheen 1.8s linear infinite;box-shadow:var(--shadow);padding:10px}
@keyframes sheen{from{background-position:100% 0}to{background-position:-100% 0}}.spark{position:absolute;top:-4px;right:-4px;color:var(--primary)}
.aside{margin:14px 2px 0;font-size:12.5px;color:var(--muted)}
.crumb{display:flex;align-items:center;gap:4px;color:var(--subtle);font-weight:600;margin:2px 0 12px}
.akick{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--ink)}
.atitle{font:650 19px/1.3 "Plus Jakarta Sans",-apple-system,system-ui,sans-serif;margin:4px 0 2px}.ameta{color:var(--muted);font-size:12.5px;margin:0 0 12px}
.take{margin-top:12px;background:var(--ess);border-left:4px solid var(--primary);border-radius:4px 12px 12px 4px;padding:10px 12px;font-style:italic;color:var(--subtle)}
.prog-row{display:flex;justify-content:space-between;color:var(--muted);font-size:12.5px}.tally{display:flex;gap:10px}.tally span{display:inline-flex;align-items:center;gap:3px}.tally .ok{color:var(--success)}.tally .again{color:var(--fi)}
.track{height:4px;border-radius:4px;background:var(--sc);margin:6px 0 14px}.track i{display:block;height:100%;border-radius:4px;background:var(--primary)}
.deck{position:relative;margin:4px 6px 18px}.edge{position:absolute;left:10px;right:10px;height:100%;border-radius:16px;background:var(--surface);box-shadow:var(--shadow)}.e1{top:6px;opacity:.8}.e2{top:12px;left:20px;right:20px;opacity:.5}
.card{position:relative;min-height:250px;border-radius:16px;background:var(--surface);box-shadow:0 1px 0 rgba(0,0,0,.03),var(--shadow);padding:20px;display:flex;flex-direction:column;justify-content:center}
.kq{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--muted)}.cq{font:600 18px/1.35 "Plus Jakarta Sans",-apple-system,system-ui,sans-serif;margin-top:6px}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:9999px;background:var(--sc);font-weight:600;margin-top:10px}.btn.primary{background:var(--primary);color:#1c1b1a}
.qq{font:600 16px/1.4 "Plus Jakarta Sans",-apple-system,system-ui,sans-serif;margin:0 0 12px}.opts{display:flex;flex-direction:column;gap:8px}
.opt{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 14px;border-radius:12px;background:var(--surface);box-shadow:var(--shadow)}.opt b{width:14px}.opt.right{box-shadow:0 0 0 2px var(--primary)}.opt.right .ic{margin-left:auto}
.expl{margin-top:12px;background:var(--ess);border-left:4px solid var(--primary);border-radius:4px 12px 12px 4px;padding:10px 12px}
/* Menus */
.has-menu .pbody{position:relative}.menu{position:absolute;z-index:2;left:16px;top:122px;width:270px;background:var(--surface);border-radius:14px;box-shadow:0 12px 32px rgba(43,45,66,.18);padding:8px}
.menu.right{left:auto;right:16px;top:58px;width:230px}.msearch{display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border-radius:9999px;background:var(--sc);margin-bottom:6px}
.caret{display:inline-block;width:1.5px;height:16px;background:var(--text);margin-left:-6px}.mrow{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:10px}.mrow.on{background:var(--sc);font-weight:600}.mrow.create{color:var(--subtle);font-weight:600}.muted-row{color:var(--muted)}
/* Linked account and another account on the web */
.account{margin:10px 16px 0;padding:6px 12px;display:flex;align-items:baseline;gap:8px;border-radius:10px;background:var(--sc);font-size:12px}.account-label{flex:none;color:var(--muted);font-weight:600}.account-email{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.warn{display:flex;gap:10px;align-items:flex-start;margin:8px 12px 0;padding:12px 14px 12px 12px;border-radius:12px;background:rgba(255,203,5,.18);color:var(--text);font-size:13px}.warn>.ic{color:#9c7400;margin-top:1px}.dark .warn>.ic{color:var(--primary)}
.warn-body{flex:1;min-width:0}.warn-body p{margin:0 0 6px;overflow-wrap:anywhere}.warn-t{font-weight:650}.mail{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}.warn-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.wbtn{display:inline-flex;align-items:center;max-width:100%;height:32px;padding:0 12px;border-radius:9999px;background:rgba(255,203,5,.28);font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wbtn.primary{background:var(--primary);color:#1c1b1a}
/* Unlinked */
.link-pad{padding:36px 22px;text-align:center}.lt{font:650 18px/1.3 "Plus Jakarta Sans",-apple-system,system-ui,sans-serif;margin:16px 0 8px}.lp{color:var(--subtle);margin:0 0 6px}.lp.small{font-size:12.5px;margin-top:22px;color:var(--muted)}
.input{display:flex;align-items:center;height:42px;border-radius:9999px;background:var(--sc);padding:0 16px;color:var(--muted);margin-top:8px;text-align:left}
/* Browser */
.browser{width:1180px;height:830px;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 12px 40px rgba(43,45,66,.18);display:flex;flex-direction:column}
.bbar{height:44px;flex:none;display:flex;align-items:center;gap:14px;padding:0 14px;background:#ebe7e3;border-bottom:1px solid #d9d4cc}
.dots{display:flex;gap:7px}.dots i{width:12px;height:12px;border-radius:50%;background:#d4cec6}.url{flex:1;display:flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:9999px;background:#fff;color:#5c6880;font-size:13px}
.ext{width:30px;height:30px;border-radius:8px;display:grid;place-items:center}.ext.on{background:#fff3c4;box-shadow:0 0 0 2px #ffcb05}
.bmain{flex:1;display:flex;min-height:0}.site{flex:1;padding:48px 64px;overflow:hidden;font-family:Georgia,"Times New Roman",serif;color:#222}
.site-name{font:700 12px/1 -apple-system,system-ui,sans-serif;letter-spacing:.2em;color:#a33}.site h1{font-size:34px;line-height:1.2;margin:14px 0 8px}.by{color:#777;font:13px -apple-system,system-ui,sans-serif;margin:0 0 22px}.site p{font-size:17px;line-height:1.7}
.side{width:400px;flex:none}`;

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Extension · panneau latéral</title><style>${css}</style></head><body>
<svg width="0" height="0" style="position:absolute">${defs}</svg>
<div class="page">
<span class="tag">Extension — panneau latéral</span>
<h1 class="ptitle">Le panneau latéral de l'extension, sur le modèle de la page média</h1>
<p class="lede">Un clic sur l'icône de Deepn ouvre un panneau à droite de la page et l'enregistre. Le panneau reprend la page média de l'app : son en-tête, puis deux onglets, Lecture et Cahier. Cadres à 400 px ; la largeur, Chrome la laisse à l'utilisateur, qui tire le bord du panneau.</p>
<div class="principle"><h2>Principe</h2><ul>
<li><b>Un clic enregistre et ouvre.</b> L'icône ou ⌥S ouvre le panneau et enregistre la page dans le dernier dossier utilisé. Une page déjà dans la bibliothèque n'est pas enregistrée deux fois : l'en-tête dit « Déjà dans votre bibliothèque ». La popup disparaît.</li>
<li><b>En-tête</b> : le média (vignette, site, titre), son état, son dossier — modifiable sur place, avec recherche et création — puis « Ouvrir dans Deepn » et le menu « … » (raccourci, déconnexion).</li>
<li><b>Lecture</b> : l'essentiel, le texte complet replié (la page est déjà sous les yeux ; un clic le déroule), puis la discussion avec le média, dont le champ reste en bas du panneau.</li>
<li><b>Cahier</b> : les quatre formats, générés d'un clic avec les réglages par défaut ; la liste des fiches (génération en cours, échec à relancer) ; la fiche s'ouvre dans le panneau. Personnaliser, renommer et supprimer restent dans l'app.</li>
<li><b>Le panneau garde sa page.</b> Il ne voit pas l'onglet où l'on passe ; un nouveau clic sur l'icône enregistre la page courante et l'affiche.</li>
</ul></div>

<h2 class="section">Dans le navigateur</h2>
<div class="row">${cell("Après le clic sur l'icône", browser, "La page à gauche, le panneau à droite : la page est enregistrée (« Enregistré »), son essentiel s'affiche, la discussion attend une question.", 1180)}</div>

<h2 class="section">L'onglet Lecture</h2>
<div class="row">
${cell("Lecture", readerCollapsed, "L'essentiel en tête, le texte complet replié sous une seule ligne, puis la discussion ; une page web citée par une réponse s'ouvre d'un clic. Le champ reste en bas du panneau.")}
${cell("Texte complet déroulé", readerOpen, "Un clic sur la ligne déroule le texte, paragraphes numérotés comme dans l'app ; un autre clic le replie. La discussion suit, plus bas.")}
${cell("Traitement en cours", readerPending, "Juste après l'enregistrement : l'aperçu s'écrit, le texte complet se prépare, la discussion s'ouvre quand le texte est prêt.")}
</div>

<h2 class="section">L'onglet Cahier</h2>
<div class="row">
${cell("Cahier", notebook, "La grille des quatre formats de l'app : un clic génère avec les réglages par défaut. Dessous, une seule liste : la génération en cours, puis les fiches, de la plus récente à la plus ancienne ; un échec se relance d'un clic.")}
${cell("Résumé ouvert", summary, "La fiche s'ouvre à la place de la liste ; « Cahier » y ramène. Résumé et notes de cours se lisent dans le panneau.")}
${cell("Cartes mémo", flash, "La révision de l'app (une carte à la fois, « Voir la réponse », puis « À revoir » ou « Je savais », et un bilan).")}
${cell("Quiz", quiz, "Le quiz de l'app : une question à la fois, la bonne réponse et son explication après le choix.")}
</div>

<h2 class="section">En-tête et autres états</h2>
<div class="row">
${cell("Changer de dossier", folderOpen, "Le dossier se change sur place : on cherche, ou on crée le dossier tapé. Le choix est retenu pour les enregistrements suivants.")}
${cell("Menu « … »", more, "Le raccourci (modifiable dans les réglages du navigateur) et la déconnexion. « Ouvrir dans Deepn » est le bouton à côté.")}
${cell("Extension non reliée", unlinked, "Le panneau remplace la popup pour relier l'extension : en un clic depuis Mon compte, ou par code.")}
${cell("Compte différent sur le web", mismatch, "L'extension lit elle-même, par le cookie de session web, quel compte est connecté sur Deepn : à l'ouverture du panneau, à son retour au premier plan et après chaque enregistrement. S'il diffère du compte relié, un bandeau le dit sous l'encart du compte relié. « Passer à ce compte » ouvre Mon compte › Extension navigateur, qui relie l'extension en un clic. « Garder l'actuel » masque le bandeau jusqu'au prochain changement de compte sur le web. Chrome, Edge et Firefox.")}
${cell("Thème sombre", dark, "Les teintes sombres de l'app.")}
</div>
</div></body></html>`;

const french = (text) => text.replace(/ ([?:;!»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
const [head, body] = html.split("<body>");
writeFileSync(join(HERE, "..", "code.html"), `${head}<body>${french(body)}`);
console.log("code.html written");
