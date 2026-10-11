// Direction de l'owner (2026-10-11). Ce que l'owner a retenu et demandé :
// - la barre horizontale de la direction B, avec tous ses boutons ;
// - Accueil, Bibliothèque et Digest calqués sur les écrans mobiles (inbox.tsx, search.tsx,
//   digest/index.tsx + [period].tsx) ;
// - Non classés et Mon compte repris du mobile (unsorted-review.tsx, account.tsx) mais
//   réorganisés pour un écran de bureau ;
// - un média et un dossier en trois volets, à la façon de NotebookLM : à gauche la Lecture
//   (média) ou les Sources avec le bouton + (dossier), au milieu la discussion, à droite le
//   volet IA et ses artefacts.

const DIR = {
  id: "owner",
  name: "Direction de l'owner",
  shell() {
    window.__phone = PHONE();
    if (window.__phone) return phoneShell();
    return `<div class="O">${appbar()}<div class="O-body">${body()}</div></div>`;
  },
  destinationPicker() {
    const isFolder = (S.target || "").startsWith("folder:");
    return modalShell(isFolder ? "Déplacer le dossier vers…" : "Ranger dans un dossier", folderPickerBody({ onPick: (f) => ({ modal: null, toast: `Rangé dans « ${f.name} »` }) }),
      `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button>`, { wide: false });
  },
  onKey(e) {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || S.modal) return;
    if (S.s === "digestp") {
      const n = DIGEST[S.dp === "weekly" ? "weekly" : "daily"].items.length, p = +S.dpos || 1;
      if (e.key === "ArrowRight" && p < n) go({ dpos: String(p + 1), art: null });
      if (e.key === "ArrowLeft" && p > 1) go({ dpos: String(p - 1), art: null });
    }
    if (S.s === "unsorted") {
      const n = QUEUE().length, p = +S.pos || 1;
      if (e.key === "ArrowRight" && p < n) go({ pos: String(p + 1) });
      if (e.key === "ArrowLeft" && p > 1) go({ pos: String(p - 1) });
      if (e.key.toLowerCase() === "d") go({ pos: String(Math.min(n, p + 1)), toast: "Source jetée" });
      if (e.key.toLowerCase() === "o") go({ s: "media", m: QUEUE()[p - 1].id });
      if (/^[1-5]$/.test(e.key)) { const f = recentFolders(5)[+e.key - 1]; go({ pos: String(Math.min(n, p + 1)), toast: `Rangé dans « ${f.name} »` }); }
    }
  },
  after() {
    document.querySelectorAll(".O-pane .thread").forEach((th) => { const sc = th.closest(".O-pane-body"); if (sc) sc.scrollTop = sc.scrollHeight; });
    const q = $(".O-q.sel"); if (q) q.scrollIntoView({ block: "nearest" });
    const c = $(".dg-chip.on"); if (c) c.scrollIntoView({ block: "nearest", inline: "center" });
  },
};

// The triage queue: the default folder, oldest first, without what is still processing or
// failed (those have nothing to decide on yet). Six more sources than the shared corpus
// carries, so the queue is the twelve the bar announces.
MEDIA.push(
  { id: "u1", type: "video", title: "Comment fonctionne vraiment un moteur électrique", creator: "ScienceÉtonnante", duration: "18 min", age: "Il y a 3 sem.", folder: null, lang: "FR", color: "#2f4d5d" },
  { id: "u2", type: "article", title: "The quiet decline of the personal website", creator: "The Verge", duration: "12 min", age: "Il y a 3 sem.", folder: null, lang: "EN", color: "#5d4a3b" },
  { id: "u3", type: "podcast", title: "Pourquoi les villes européennes redeviennent cyclables", creator: "Les Cours du Collège de France", duration: "47 min", age: "Il y a 2 sem.", folder: null, lang: "FR", color: "#3b5d3f" },
  { id: "u4", type: "short", title: "Trois exercices pour arrêter de procrastiner", creator: "@productif.lab", duration: "52 s", age: "Il y a 2 sem.", folder: null, lang: "FR", color: "#6b3b55" },
  { id: "u5", type: "document", title: "Rapport annuel — usages numériques 2026.pdf", creator: "PDF · 64 pages", duration: "64 p.", age: "Il y a 10 j", folder: null, lang: "FR", color: "#55556b" },
  { id: "u6", type: "article", title: "Ce que l'on sait des effets de la lumière bleue sur le sommeil", creator: "Le Monde", duration: "8 min", age: "Il y a 9 j", folder: null, lang: "FR", color: "#3b4f6b" },
  { id: "u7", type: "video", title: "Ranger sa bibliothèque : la méthode des bibliothécaires", creator: "Monsieur Bidouille", duration: "26 min", age: "Il y a 8 j", folder: null, lang: "FR", color: "#6b5d3b" },
  { id: "u8", type: "podcast", title: "Faut-il encore apprendre par cœur ?", creator: "Le Code a changé", duration: "39 min", age: "Il y a 6 j", folder: null, lang: "FR", color: "#4f3b6b" },
);
const QUEUE = () => MEDIA.filter((m) => !m.folder && !m.status).reverse();

// ---------------------------------------------------------------- small pieces

const curF = () => (S.f === "f0" ? C().unsorted : curFolder());
function wcover(m, w = 200, { radius = 12, h } = {}) {
  const hh = h || Math.round((w * 9) / 16);
  return `<div class="wcover ${m.status === "processing" ? "processing" : ""}" style="width:${w}px;height:${hh}px;border-radius:${radius}px;background:${m.color}">${icon(TYPE_META[m.type].icon)}${m.status === "failed" ? `<span class="fbadge">${icon("alert-circle-outline", "s14")}</span>` : ""}</div>`;
}
function mosaic(f, w = 200) {
  const src = sourcesOf(C(), f).slice(0, 4);
  while (src.length < 4) src.push({ color: "var(--surface-container)" });
  return `<div class="mosaic" style="width:${w}px;height:${Math.round((w * 9) / 16)}px">${src.map((m) => `<i style="background:${m.color}"></i>`).join("")}</div>`;
}
// MediaListCard: the 16:9 cover, type and age, two-line title, creator.
function mcard(m, { w = 128, extra = "", patch } = {}) {
  const sub = m.status === "processing" ? "En cours de traitement" : esc(m.creator);
  return `<button class="mcard" ${goAttr(patch || { s: "media", m: m.id, art: null, conv: null, cs: "idle" })}>${wcover(m, w, { radius: 8 })}
    <div class="grow"><div class="meta">${typeBadge(m)}<span>${esc(m.age)}</span></div><div class="t clamp2">${esc(m.title)}</div><div class="small muted ell">${sub}</div>${extra}</div>
    <span class="icon-btn" data-act="menu:media:${m.id}" aria-label="Actions sur cette source">${icon("ellipsis-horizontal", "s18")}</span></button>`;
}
function folderTile(f, { hint = "" } = {}) {
  const def = f.isDefault;
  return `<button class="ftile" title="${esc(f.name)}" ${goAttr({ s: "folder", f: f.id, art: null, conv: null, cs: "idle" })}>
    <span class="ficon ${def ? "def" : ""}">${icon(def ? "file-tray-outline" : "folder", "s24")}</span>
    <span class="fname clamp2">${hl(f.name, S.sq || S.lq || "")}</span>${hint ? `<span class="fhint ell">${esc(hint)}</span>` : `<span class="fhint">${((n) => `${n} élément${n > 1 ? "s" : ""}`)(def ? QUEUE().length + 2 : totalSources(f))}</span>`}</button>`;
}

// ---------------------------------------------------------------- bar (direction B, kept whole)

function appbar() {
  const tab = (label, patch, on) => `<button class="O-tab ${on ? "on" : ""}" ${goAttr(patch)}>${label}</button>`;
  const lib = ["library", "folder", "search"].includes(S.s) || (S.s === "media" && S.from !== "digest");
  const reset = { art: null, conv: null, cs: "idle", lp: null, rp: null, modal: null };
  return `<header class="O-bar"><button class="row" style="gap:10px" ${goAttr({ s: "home", ...reset })}><span class="icon-btn" style="background:var(--primary);color:var(--on-primary);width:32px;height:32px">${icon("layers-outline", "s18")}</span><b class="headline">Deepn</b></button>
    <nav class="row O-tabs" aria-label="Navigation principale">${tab("Accueil", { s: "home", ...reset }, S.s === "home")}${tab("Bibliothèque", { s: "library", ...reset }, lib)}${tab("Digest", { s: "digest", ...reset }, S.s === "digest" || S.s === "digestp")}${tab(`Non classés · ${QUEUE().length}`, { s: "unsorted", pos: "1", ...reset }, S.s === "unsorted")}</nav>
    <span class="grow"></span><label class="field O-search" style="width:300px">${icon("search-outline", "s18")}<input placeholder="Rechercher dans le texte de vos sources" aria-label="Rechercher" value="${S.s === "search" ? esc(S.sq || "") : ""}" ${S.s === "search" ? "" : goAttr({ s: "search", sq: "pause", ...reset })}></label>
    <button class="btn primary" ${goAttr({ modal: "add", into: S.s === "folder" ? curF().id : null })}>${icon("add", "s18")} <span>Ajouter</span></button>
    <button class="icon-btn" data-act="theme" aria-label="Changer de thème">${icon(S.theme === "dark" ? "sunny-outline" : "moon-outline", "s18")}</button>
    <button class="icon-btn ${S.s === "account" ? "on" : ""}" style="background:var(--surface-container)" aria-label="Mon compte" title="Mon compte" ${goAttr({ s: "account", sec: null, ...reset })}>${icon("person-outline", "s18")}</button></header>`;
}
function page(inner, max = 1200) { return `<div class="scroll O-page"><div style="max-width:${max}px;margin:0 auto">${inner}</div></div>`; }
function body() {
  switch (S.s) {
    case "home": return page(homePage());
    case "library": return page(libraryPage());
    case "search": return page(searchPage());
    case "folder": return folderPanes();
    case "media": return mediaPanes(curMedia());
    case "digest": return `<div class="dg-wrap">${digestPage()}</div>`;
    case "digestp": return digestPeriod();
    case "unsorted": return unsortedPage();
    case "account": case "settings": case "paywall": return accountPage();
  }
  return "";
}

// ---------------------------------------------------------------- Accueil (inbox.tsx)

function homePage() {
  const recent = [...MEDIA.filter((m) => m.status), ...MEDIA.filter((m) => !m.status && !m.folder).reverse().slice(0, 6), ...MEDIA.filter((m) => m.folder).slice(0, 4)].slice(0, 12);
  const cont = [MEDIA[0], { fd: C().memory }, MEDIA[1], MEDIA[12], { fd: C().roots[4] }, MEDIA[5], MEDIA[2]];
  return `<div class="O-home">
    ${S.empty === "1" ? `<div class="O-empty">${icon("sparkles-outline", "s24")}<div class="headline">Vos médias partagés apparaîtront ici.</div><p class="subtle">Ajoutez un lien, déposez un fichier, ou enregistrez une page avec l'extension.</p><button class="btn primary" ${goAttr({ modal: "add" })}>${icon("add", "s18")} Ajouter</button></div>` : `
    ${tileRow("sparkles", "Ajouts récents", recent.map((m) => homeTile(m)))}
    ${tileRow("play-circle-outline", "Reprendre l'apprentissage", cont.map((x) => (x.fd ? folderHomeTile(x.fd) : homeTile(x))))}`}
  </div>`;
}
function tileRow(ic, title, tiles) {
  const id = "r" + title.length;
  return `<section class="O-row"><div class="row" style="margin-bottom:12px">${icon(ic, "s18")}<h2 class="headline grow">${title}</h2>
    <button class="icon-btn" aria-label="Précédents" onclick="document.getElementById('${id}').scrollBy({left:-648,behavior:'smooth'})">${icon("chevron-back", "s18")}</button><button class="icon-btn" aria-label="Suivants" onclick="document.getElementById('${id}').scrollBy({left:648,behavior:'smooth'})">${icon("chevron-forward", "s18")}</button></div>
    <div class="O-track" id="${id}">${tiles.join("")}</div></section>`;
}
function homeTile(m) {
  const sub = m.status === "processing" ? "En cours de traitement" : m.status === "failed" ? "Échec de l'import" : esc(m.creator);
  return `<button class="htile" ${goAttr({ s: "media", m: m.id, from: null })}>${wcover(m, 200)}<span class="t clamp2">${esc(m.title)}</span><span class="small muted ell">${sub}</span></button>`;
}
function folderHomeTile(f) {
  return `<button class="htile" ${goAttr({ s: "folder", f: f.id })}>${mosaic(f, 200)}<span class="t clamp2">${esc(f.name)}</span><span class="small muted ell">Dossier · ${totalSources(f)} sources</span></button>`;
}

// ---------------------------------------------------------------- Bibliothèque (search.tsx)

function libraryPage() {
  const open = S.fold !== "1";
  const all = [...MEDIA.filter((m) => m.status), ...MEDIA.filter((m) => !m.status)];
  const roots = [C().unsorted, ...C().roots];
  return `<div class="row" style="margin:0 0 12px"><button class="row O-fold" ${goAttr({ fold: open ? "1" : null })} aria-expanded="${open}"><h2 class="headline">Dossiers</h2>${icon(open ? "chevron-down" : "chevron-forward", "s18")}</button><span class="count">${C().folders.length} au total</span><span class="grow"></span>
      <button class="icon-btn O-plus" aria-label="Nouveau dossier" title="Nouveau dossier" ${goAttr({ modal: "newfolder", f: null })}>${icon("add", "s24")}</button></div>
    ${open ? `<div class="O-fgrid">${roots.map((f) => folderTile(f)).join("")}</div>` : ""}
    <div class="row" style="margin:32px 0 8px"><h2 class="headline grow">Tous les médias</h2><span class="count">${all.length} éléments</span></div>
    <div class="O-mgrid">${all.map((m) => mcard(m)).join("")}</div>
    <div class="small muted" style="text-align:center;padding:24px">Fin de la bibliothèque</div>`;
}
function searchPage() {
  const q = S.sq || "pause";
  const folders = searchFolders(C(), q, 12);
  return `<div class="row" style="margin-bottom:4px"><button class="btn ghost" ${goAttr({ s: "library", sq: null })}>${icon("chevron-back", "s16")} Bibliothèque</button></div>
    <h1 class="display">« ${esc(q)} »</h1><div class="small muted" style="margin:4px 0 20px">${SEARCH_HITS.length} résultats dans le texte de vos sources · ${folders.length} dossiers</div>
    ${folders.length ? `<h2 class="headline" style="margin-bottom:12px">Dossiers</h2><div class="O-fgrid" style="margin-bottom:28px">${folders.map((f) => folderTile(f)).join("")}</div>` : ""}
    <h2 class="headline" style="margin-bottom:8px">Dans le texte</h2><div class="O-mgrid one">${SEARCH_HITS.map((h) => { const m = mediaById(h.media); return mcard(m, { w: 160, extra: `<div class="small subtle snippet">${h.snippet}</div>` }); }).join("")}</div>
    <div class="small muted" style="text-align:center;padding:16px">Fin des résultats</div>`;
}

// ---------------------------------------------------------------- the three panes (NotebookLM)

// Every pane collapses to a rail, as NotebookLM's side panes do; the chat never does.
function panes(left, mid, right, { band = "", wideRight = false } = {}) {
  const lc = S.lp === "0", rc = S.rp === "0";
  const cols = `${lc ? "56px" : "minmax(0,1.1fr)"} minmax(0,1fr) ${rc ? "56px" : wideRight ? "minmax(0,1.1fr)" : "400px"}`;
  const cur = S.pane || "left";
  const sw = (k, ic, l) => `<button class="${cur === k ? "on" : ""}" ${goAttr({ pane: k })}>${icon(ic, "s16")} ${l}</button>`;
  return `<div class="O-work">${band}<div class="seg O-paneswitch">${sw("left", left.icon, left.title)}${sw("mid", "chatbubbles-outline", "Discussion")}${sw("right", "sparkles-outline", "IA")}</div>
    <div class="O-panes" style="grid-template-columns:${cols}">${pane("left", left, lc, cur)}${pane("mid", mid, false, cur)}${pane("right", right, rc, cur)}</div></div>`;
}
function pane(k, p, collapsed, cur) {
  const key = k === "left" ? "lp" : "rp";
  if (collapsed) return `<section class="O-pane rail ${cur === k ? "cur" : ""}"><button class="icon-btn" title="Afficher ${p.title}" aria-label="Afficher ${p.title}" ${goAttr({ [key]: null })}>${icon(k === "left" ? "chevron-forward" : "chevron-back", "s18")}</button><span class="rail-ico">${icon(p.icon, "s18")}</span><span class="rail-label">${p.title}</span></section>`;
  const collapse = k === "mid" ? "" : `<button class="icon-btn" title="Réduire le volet" aria-label="Réduire le volet ${p.title}" ${goAttr({ [key]: "0" })}>${icon(k === "left" ? "chevron-back" : "chevron-forward", "s18")}</button>`;
  return `<section class="O-pane ${cur === k ? "cur" : ""}" aria-label="${p.title}"><header class="O-pane-head">${k === "right" ? collapse : ""}<span class="O-pane-title grow">${p.head || p.title}</span>${p.actions || ""}${k === "left" ? collapse : ""}</header>
    <div class="O-pane-body scroll">${p.body}</div>${p.foot ? `<div class="O-pane-foot">${p.foot}</div>` : ""}</section>`;
}
function chatPane(scope, { disabled = "" } = {}) {
  const d = CHAT[scope];
  const head = S.cs === "history" ? "Historique" : S.conv === "new" ? "Nouvelle conversation" : esc(d.conversations[0].title);
  const actions = `<button class="icon-btn" title="Conversations précédentes" aria-label="Conversations précédentes" ${goAttr({ cs: S.cs === "history" ? "idle" : "history" })}>${icon("time-outline", "s18")}</button><button class="icon-btn" title="Nouvelle conversation" aria-label="Nouvelle conversation" ${goAttr({ conv: "new", cs: "idle" })}>${icon("create-outline", "s18")}</button>`;
  if (disabled) return { title: "Discussion", icon: "chatbubbles-outline", body: `<div class="O-paneempty">${icon("chatbubbles-outline", "s24")}<p>${disabled}</p></div>` };
  const empty = S.conv === "new" && S.cs !== "history";
  const body = empty
    ? `<div class="O-paneempty">${icon("chatbubble-ellipses-outline", "s24")}<div class="headline">${scope === "media" ? "Discutez de ce média" : "Discutez des sources de ce dossier"}</div><p>${scope === "media" ? "Les réponses s'appuient sur le texte de ce média et citent les paragraphes, que vous retrouvez surlignés dans la Lecture." : `Les réponses s'appuient sur les ${scopeLabel("folder").split("· ")[1]} de ce dossier et citent chaque source.`}</p><div class="row" style="flex-wrap:wrap;justify-content:center">${d.suggestions.map((x) => `<button class="chip" ${goAttr({ conv: null, cs: "sending" })}>${x}</button>`).join("")}</div></div>`
    : thread(scope);
  return { title: "Discussion", icon: "chatbubbles-outline", head: `<span class="ell" style="display:block">${head}</span><span class="small muted" style="font-weight:400">${scope === "media" ? "Sur ce média" : "Sur les sources de ce dossier"}</span>`, actions, body, foot: composer(scope) };
}
// The AI pane: NotebookLM's "Studio" — one large pill per type, then the append-only
// history; an artifact opens inside the pane, which widens to read it.
function aiPane(scope, { disabled = "" } = {}) {
  if (disabled) return { title: "IA", icon: "sparkles-outline", body: `<div class="O-paneempty">${icon("sparkles-outline", "s24")}<p>${disabled}</p></div>` };
  if (S.art) {
    const a = ARTIFACT_TYPES.find((x) => x.key === S.art) || ARTIFACT_TYPES[0];
    S.from = scope;
    return { title: "IA", icon: "sparkles-outline", head: `<span class="row" style="gap:4px"><button class="btn ghost" style="min-height:32px;padding:0 8px" ${goAttr({ art: null })}>${icon("chevron-back", "s16")} IA</button><span class="small muted">/ ${a.label}</span></span>`,
      actions: `<button class="icon-btn" title="Copier" aria-label="Copier">${icon("copy-outline", "s18")}</button><button class="icon-btn" title="Générer à nouveau" aria-label="Générer à nouveau">${icon("refresh", "s18")}</button>`,
      body: artifactView(S.art).replace('class="display"', 'class="headline" style="font-size:24px"') };
  }
  const states = scope === "folder" ? FOLDER_ARTIFACTS : MEDIA_ARTIFACTS;
  const hist = scope === "folder" ? FOLDER_HISTORY : MEDIA_HISTORY;
  const st = (s) => ({ generated: `${icon("checkmark-circle", "s14")} Généré`, generating: `${icon("sync", "s14")} Génération…`, queued: `${icon("time-outline", "s14")} En file`, failed: `<span style="color:var(--error)">${icon("alert-circle-outline", "s14")} Échec · Réessayer</span>`, idle: "" })[s];
  const body = `<div class="caps" style="margin:4px 0 10px">Générer${scope === "folder" ? " · sur tout le dossier" : ""}</div>
    <div class="O-pills">${ARTIFACT_TYPES.map((a) => `<button class="O-pill ${states[a.key]}" ${states[a.key] === "generated" ? goAttr({ art: a.key }) : ""}>${icon(a.icon, "s18")}<span class="grow"><span class="label" style="display:block">${a.label}</span>${st(states[a.key]) ? `<span class="small st">${st(states[a.key])}</span>` : ""}</span>${states[a.key] === "idle" ? icon("add", "s18") : ""}</button>`).join("")}</div>
    ${scope === "folder" ? `<div class="banner" style="margin-top:10px">${icon("layers-outline", "s16")} Les sources ont changé depuis le dernier résumé détaillé. Une nouvelle génération ajoute une entrée ; l'ancienne reste.</div>` : ""}
    <div class="caps" style="margin:22px 0 6px">Historique</div>
    ${hist.map((h) => { const a = ARTIFACT_TYPES.find((x) => x.key === h.type); return `<button class="hist" style="width:100%;text-align:left" ${goAttr({ art: h.type, from: S.from || null })}><span class="icon-btn" style="background:var(--surface-container);width:36px;height:36px">${icon(a.icon, "s18")}</span><span class="grow"><span class="label ell" style="display:block">${esc(h.title)}</span><span class="small muted">${h.sources ? `${h.sources} sources · ` : ""}${h.when}</span></span>${icon("chevron-forward", "s16")}</button>`; }).join("")}`;
  return { title: "IA", icon: "sparkles-outline", body };
}

// ---------------------------------------------------------------- media

function mediaPanes(m, { band = "" } = {}) {
  const f = m.folder ? C().memory : C().unsorted;
  const ready = !m.status;
  const cited = (S.cs === "idle" || S.cs === "streaming") && S.conv !== "new" ? [5, 8] : [];
  const left = { title: "Lecture", icon: "book-outline",
    head: `<nav class="crumbs" aria-label="Emplacement">${f.isDefault ? `<button ${goAttr({ s: "folder", f: "f0" })}>Non classés</button>` : folderPath(C(), f).map((x, i) => `${i ? icon("chevron-forward", "s14") : ""}<button title="${esc(x.name)}" ${goAttr({ s: "folder", f: x.id, art: null })}>${esc(x.name)}</button>`).join("")}</nav>`,
    actions: `<button class="icon-btn" data-act="menu:media:${m.id}" aria-label="Actions pour cette source" title="Ranger, renommer, supprimer">${icon("ellipsis-horizontal")}</button>`,
    body: `${mediaHero(m, { height: 190 })}<div style="margin:12px 0 16px">${metaLine(m)}</div>${mediaStateBody(m) || previewBlock() + readerText({ cited })}` };
  const why = m.status === "processing" ? "La discussion s'ouvre dès que le texte de ce média est prêt." : "Pas de discussion possible : le texte de ce média n'a pas pu être importé.";
  return panes(left, chatPane("media", { disabled: ready ? "" : why }), aiPane("media", { disabled: ready ? "" : why.replace("La discussion s'ouvre", "La génération s'ouvre").replace("Pas de discussion possible", "Rien à générer") }), { band, wideRight: !!S.art });
}

// ---------------------------------------------------------------- folder

function folderPanes() {
  const f = curF();
  const src = sourcesOf(C(), f);
  const left = { title: "Sources", icon: "layers-outline",
    head: f.isDefault ? "Sources" : `<nav class="crumbs" aria-label="Chemin du dossier"><button ${goAttr({ s: "library" })}>Bibliothèque</button>${folderPath(C(), f).slice(0, -1).map((x) => `${icon("chevron-forward", "s14")}<button title="${esc(x.name)}" ${goAttr({ s: "folder", f: x.id })}>${esc(x.name)}</button>`).join("")}</nav>`,
    actions: f.isDefault ? "" : `<button class="icon-btn" data-act="menu:folder:${f.id}" aria-label="Actions pour ce dossier" title="Renommer, déplacer, supprimer">${icon("ellipsis-horizontal")}</button>`,
    body: `<h1 class="headline" style="font-size:24px;overflow-wrap:anywhere">${esc(f.name)}</h1><div class="small muted" style="margin-bottom:14px">${src.length} sources</div>
      <div class="row" style="gap:8px;margin-bottom:18px"><button class="btn primary grow O-addsrc" ${goAttr({ modal: "add", into: f.id })}>${icon("add", "s18")} Ajouter des sources</button></div>
      ${src.map((m) => `<button class="O-src" ${goAttr({ s: "media", m: m.generic ? "m2" : m.id, art: null, conv: null })}>${wcover(m, 64, { radius: 6 })}<span class="grow"><span class="t clamp2">${esc(m.title)}</span><span class="meta">${typeBadge(m)}<span class="ell">${m.status === "processing" ? "En cours de traitement" : esc(m.creator)}</span></span></span><span class="icon-btn" style="width:32px;height:32px" data-act="menu:media:${m.id}" aria-label="Actions sur cette source">${icon("ellipsis-horizontal", "s16")}</span></button>`).join("") || `<div class="O-paneempty"><p>Ce dossier est vide. Ajoutez une première source avec le bouton ci-dessus, ou rangez-y une source depuis Non classés.</p></div>`}` };
  const empty = !src.length ? "Ajoutez des sources à ce dossier pour en discuter." : "";
  return panes(left, chatPane("folder", { disabled: empty }), aiPane("folder", { disabled: empty ? "Ajoutez des sources à ce dossier pour générer un résumé, des notes, des flashcards ou un quiz." : "" }), { wideRight: !!S.art });
}

// ---------------------------------------------------------------- Digest (digest/index.tsx, [period].tsx)

// The mobile root is a choice between two packs, then a pager. On a desktop both periods
// fit on one screen, so the choice shows what is inside: each period is a column with its
// pack (the three front covers), a "Lire" button, and its whole table of contents. Any row
// opens the reader at that position.
DIGEST.weekly.items.push("m5", "m8", "m9", "u1", "u3", "u6");
function digestPage() {
  const col = (per, label, hint) => {
    const items = DIGEST[per].items.map(mediaById);
    const pile = items.slice(0, 3).reverse().map((m, i, arr) => `<span class="dg-card c${arr.length - 1 - i}" style="background:${m.color}">${icon(TYPE_META[m.type].icon, "s18")}</span>`).join("");
    return `<section class="dg-col" aria-label="${label}"><header class="dg-head"><span class="dg-pile">${pile}</span><div class="grow"><h2 class="headline">${label}</h2><div class="small muted">${items.length} médias · ${hint}</div></div>
      <button class="btn primary" ${goAttr({ s: "digestp", dp: per, dpos: "1", art: null, conv: null })}>${icon("book-outline", "s18")} Lire</button></header>
      <ol class="dg-list scroll">${items.map((m, i) => `<li><button class="dg-row" ${goAttr({ s: "digestp", dp: per, dpos: String(i + 1), art: null, conv: null })}><span class="dg-n">${i + 1}</span>${wcover(m, 128, { radius: 8 })}<span class="grow"><span class="meta">${typeBadge(m)}<span class="ell">${esc(m.creator)}</span></span><span class="t clamp2">${esc(m.title)}</span><span class="small subtle clamp2">${PREVIEW.blurb}</span></span></button></li>`).join("")}</ol></section>`;
  };
  return `<div class="dg">${col("daily", "Quotidien", "les médias d'hier")}${col("weekly", "Hebdomadaire", "la semaine écoulée, lundi à dimanche")}</div>`;
}
// The reader of a period: the media page in its three panes, under a strip that replaces
// the mobile dots with the period's table of contents, readable and clickable.
function digestPeriod() {
  const per = S.dp === "weekly" ? "weekly" : "daily";
  const d = DIGEST[per];
  const pos = Math.min(+S.dpos || 1, d.items.length);
  const m = mediaById(d.items[pos - 1]);
  const band = `<div class="O-band"><button class="btn ghost" ${goAttr({ s: "digest", art: null })}>${icon("chevron-back", "s16")} Digest</button><b class="label" style="white-space:nowrap">${per === "weekly" ? "Hebdomadaire" : "Quotidien"}</b>
    <button class="icon-btn" aria-label="Précédent (←)" title="Précédent (←)" ${goAttr({ dpos: String(Math.max(1, pos - 1)), art: null })}>${icon("chevron-back")}</button>
    <div class="dg-strip">${d.items.map((id, i) => { const x = mediaById(id); return `<button class="dg-chip ${i + 1 === pos ? "on" : ""}" title="${esc(x.title)}" ${goAttr({ dpos: String(i + 1), art: null })}><span class="dg-n">${i + 1}</span>${wcover(x, 40, { radius: 4 })}<span class="ell">${esc(x.title)}</span></button>`; }).join("")}</div>
    <button class="icon-btn" aria-label="Suivant (→)" title="Suivant (→)" ${goAttr({ dpos: String(Math.min(d.items.length, pos + 1)), art: null })}>${icon("chevron-forward")}</button><span class="label" style="white-space:nowrap">${pos} / ${d.items.length}</span></div>`;
  return mediaPanes(m, { band });
}

// ---------------------------------------------------------------- Non classés (unsorted-review.tsx, for a desktop)

// The mobile pager becomes a queue you can see: the list on the left, the source to decide
// on in the middle, and the destinations always open on the right, so filing is one click
// (or one key) instead of a sheet to open.
function unsortedPage() {
  const q = QUEUE();
  if (S.done === "1" || !q.length) return page(`<div class="O-empty" style="margin-top:12vh">${icon("checkmark-circle", "s24")}<div class="headline">Plus rien à trier</div><p class="subtle">Tout ce qui attendait a été traité.</p><button class="btn primary" ${goAttr({ s: "home", done: null })}>Terminé</button></div>`, 640);
  const pos = Math.min(+S.pos || 1, q.length);
  const m = q[pos - 1];
  const next = { pos: String(Math.min(q.length, pos + 1)) };
  const list = `<header class="O-pane-head"><span class="O-pane-title grow">Revue des non classés</span><span class="count">${pos} / ${q.length}</span></header>
    <div class="O-pane-body scroll" style="padding:4px 8px">${q.map((x, i) => `<button class="O-q ${i + 1 === pos ? "sel" : ""}" ${goAttr({ pos: String(i + 1) })}>${wcover(x, 56, { radius: 6 })}<span class="grow"><span class="small clamp2" style="font-weight:600">${esc(x.title)}</span><span class="small muted ell" style="display:block">${esc(x.age)}</span></span></button>`).join("")}</div>`;
  const card = `<div class="O-triage"><div class="row" style="align-items:flex-start;gap:16px">${wcover(m, 220)}<div class="grow"><div class="meta row" style="gap:6px;margin-bottom:6px">${typeBadge(m)}<span class="small muted">${esc(m.age)} · ${esc(m.duration)}</span></div><h1 class="headline" style="font-size:24px">${esc(m.title)}</h1><div class="subtle" style="margin-top:4px">${esc(m.creator)}</div></div></div>
    <div class="O-blurb"><p style="margin:0 0 10px;font-weight:600">${PREVIEW.blurb}</p><ul>${PREVIEW.points.map((p) => `<li>${p}</li>`).join("")}</ul></div>
    <div class="O-actions"><button class="btn tonal" ${goAttr({ ...next, toast: "Source jetée" })}>${icon("trash-outline", "s18")} Jeter <span class="kbd">D</span></button><button class="btn tonal" ${goAttr({ s: "media", m: m.id })}>${icon("book-outline", "s18")} Approfondir <span class="kbd">O</span></button><span class="small muted grow" style="text-align:right">ou rangez-la à droite →</span></div>
    <div class="row" style="justify-content:center;margin-top:16px"><button class="icon-btn" aria-label="Précédente" ${goAttr({ pos: String(Math.max(1, pos - 1)) })}>${icon("chevron-back")}</button><span class="small muted">← → pour passer d'une source à l'autre</span><button class="icon-btn" aria-label="Suivante" ${goAttr(next)}>${icon("chevron-forward")}</button></div></div>`;
  const picker = `<header class="O-pane-head"><span class="O-pane-title grow">${icon("folder-outline", "s18")} Ranger dans…</span></header><div class="O-pane-body scroll">${folderPickerBody({ onPick: (f) => ({ ...next, toast: `Rangé dans « ${f.name} »` }), keys: true })}</div>`;
  return `<div class="O-unsorted"><section class="O-pane">${list}</section><section class="O-center scroll">${card}</section><section class="O-pane">${picker}</section></div>`;
}
// The destination picker (FolderPickerView): search, recent folders, the tree, inline creation.
function folderPickerBody({ onPick, keys = false }) {
  const q = S.pq || "";
  const hits = q ? searchFolders(C(), q, 12) : [];
  const row = (f, i, depth = 0) => `<button class="frow" style="padding-left:${8 + depth * 18}px" title="${esc(pathText(f))}" ${goAttr(onPick(f))}>${icon("folder-outline", "s16")}<span class="grow" style="min-width:0"><span class="ell" style="display:block">${hl(f.name, q)}</span>${depth === 0 && f.parent ? `<span class="path ell" style="display:block">${esc(parentHint(f))}</span>` : ""}</span>${keys && i != null ? `<span class="kbd">${i + 1}</span>` : ""}</button>`;
  const exp = curFolder();
  const open = new Set(folderPath(C(), exp).map((x) => x.id));
  const tree = (list, depth) => list.map((f) => row(f, null, depth) + (open.has(f.id) && f.children.length ? tree(f.children, depth + 1) : "")).join("");
  return `<label class="field" style="margin-bottom:10px">${icon("search-outline", "s16")}<input value="${esc(q)}" placeholder="Chercher un dossier" aria-label="Chercher un dossier" oninput="go({pq:this.value||null},{replace:true});setTimeout(()=>{const i=document.querySelector('[aria-label=\\'Chercher un dossier\\']');i.focus();i.setSelectionRange(i.value.length,i.value.length)})"></label>
    ${q ? `<div class="caps" style="margin:6px 0 4px">${searchFolders(C(), q, 999).length} dossiers</div>${hits.map((f) => row(f)).join("")}` : `<div class="caps" style="margin:6px 0 4px">Récents</div>${recentFolders(5).map((f, i) => row(f, i)).join("")}
    <div class="caps" style="margin:14px 0 4px">Tous les dossiers</div>${tree(C().roots, 0)}`}
    <button class="frow" style="color:var(--text-subtle);margin-top:6px" ${goAttr({ modal: "newfolder" })}>${icon("add", "s16")} Nouveau dossier</button>`;
}

// ---------------------------------------------------------------- Mon compte (account.tsx, for a desktop)

// The mobile menu card becomes a settings sidebar; each row opens in the right pane
// instead of pushing a screen. Same rows, same order, same two red ones at the bottom.
function accountPage() {
  const beta = S.beta !== "0";
  const sec = S.sec || (S.s === "settings" ? S.sub : S.s === "paywall" ? "plans" : "plan");
  const item = (k, ic, label, hint, { danger = false, patch } = {}) => `<button class="O-acc-item ${sec === k ? "on" : ""} ${danger ? "danger" : ""}" ${goAttr(patch || { s: "account", sec: k, modal: null })}><span class="O-acc-ico">${icon(ic, "s18")}</span><span class="grow"><span class="label" style="display:block">${label}</span>${hint ? `<span class="small muted ell" style="display:block">${hint}</span>` : ""}</span></button>`;
  const nav = `<aside class="O-acc-nav"><div class="O-acc-id"><span class="O-avatar">V</span><div class="grow"><div class="small muted">Connecté avec</div><div class="label ell">vous@exemple.fr</div></div></div>
    ${item("plan", "card-outline", "Votre formule", beta ? "Accès bêta · 412 min restantes" : "Formule M · 412 min restantes")}
    <div class="caps O-acc-cap">Réglages</div>
    ${item("reading", "language-outline", "Langue de lecture", "Français")}${item("ui", "globe-outline", "Langue de l'app", "Suivre le navigateur")}${item("theme", S.theme === "dark" ? "moon-outline" : "sunny-outline", "Thème", S.theme === "dark" ? "Sombre" : "Clair")}${item("extension", "extension-puzzle-outline", "Extension navigateur", "1 navigateur relié")}
    <div class="caps O-acc-cap">Aide</div>
    ${item("ideas", "bulb-outline", "Suggestions", "S'ouvre dans un nouvel onglet")}${item("bug", "bug-outline", "Signaler un bug", "")}
    <div class="O-acc-sep"></div>
    ${item("signout", "log-out-outline", "Se déconnecter", "", { danger: true, patch: { modal: "signout" } })}${item("delete", "trash-outline", "Supprimer le compte", "", { danger: true })}</aside>`;
  return `<div class="scroll O-page"><div class="O-acc">${nav}<section class="O-acc-main">${accountSection(sec, beta)}</section></div></div>`;
}
function accountSection(sec, beta) {
  if (sec === "plan") return `<h1 class="display" style="margin-bottom:16px">Votre formule</h1>
    <div class="card" style="padding:20px 24px"><div class="caps">Votre formule</div><div class="row" style="margin-top:6px"><div class="headline grow">${beta ? "Accès bêta" : "Formule active · M"}</div><span class="chip ${beta ? "" : "on"}">${beta ? "Bêta" : "Actif"}</span></div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:12px;margin-top:16px;align-items:end"><div><div class="caps">Minutes restantes</div><div class="display">412 <span class="small muted">/ 2 400</span></div><div class="progress" style="margin-top:8px"><i style="width:17%"></i></div></div><div style="text-align:right"><div class="caps">Renouvellement</div><div class="label">1 nov. 2026</div></div></div>
      <p class="small subtle" style="margin:12px 0 0">${beta ? "Pendant la bêta, chaque compte reçoit l'allocation de la plus grande formule. Les minutes couvrent l'audio et la vidéo envoyés ; les articles et pages web n'en coûtent aucune." : "Les minutes couvrent l'audio et la vidéo envoyés. Les articles et pages web n'en coûtent aucune."}</p></div>
    ${beta ? "" : `<button class="O-acc-row" ${goAttr({ s: "account", sec: "plans" })}><span class="O-acc-ico">${icon("card-outline", "s18")}</span><span class="grow"><span class="label" style="display:block">Changer de formule</span><span class="small muted">Comparez les formules et changez</span></span>${icon("chevron-forward", "s16")}</button>`}`;
  if (sec === "plans") return paywallBody();
  if (sec === "ideas") return `<h1 class="display">Suggestions</h1><p class="subtle">Le tableau des suggestions s'ouvre dans un nouvel onglet, déjà connecté à votre compte. Vous y proposez une idée et votez pour celles des autres.</p><button class="btn primary">${icon("open-outline", "s18")} Ouvrir le tableau des suggestions</button>`;
  if (sec === "bug") return `<h1 class="display" style="margin-bottom:12px">Signaler un bug</h1><div class="card" style="padding:20px"><label class="small subtle">Sujet</label><label class="field" style="border-radius:var(--r-md);margin:4px 0 12px"><input placeholder="Résumé du problème"></label><label class="small subtle">Description</label><textarea style="width:100%;min-height:160px;border:0;border-radius:var(--r-md);background:var(--surface-container);padding:12px;margin-top:4px" placeholder="Étapes, ce que vous attendiez, ce qui s'est passé…"></textarea>
    <div style="border:2px dashed var(--outline-variant);border-radius:var(--r-lg);padding:16px;text-align:center;margin-top:12px">${icon("cloud-upload-outline", "s24")}<div class="small">Déposez une capture ici, ou <u>parcourez</u> · image, vidéo, PDF ou ZIP, 25 Mo au plus</div></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary">Envoyer</button></div></div>`;
  S.sub = sec;
  return settingsBody();
}

// ---------------------------------------------------------------- add dialog (adds the destination)

function addDialog() {
  if (S.modal === "add2") return modalShell("Votre média est en cours d'enregistrement", S.into ? `<p style="margin-top:0">L'import a commencé et la source sera rangée dans « ${esc(curFolderById(S.into).name)} ». Vous pouvez fermer cette fenêtre.</p>` : `<p style="margin-top:0">L'import a commencé : vous pouvez fermer cette fenêtre. Voulez-vous aussi le ranger dans un dossier ?</p>`,
    S.into ? `<button class="btn primary" ${goAttr({ modal: null })}>Fermer</button>` : `<button class="btn ghost" ${goAttr({ modal: null })}>Non, le laisser dans Non classés</button><button class="btn primary" ${goAttr({ modal: "move", target: "m10" })}>Choisir un dossier</button>`);
  return modalShell(S.into ? `Ajouter à « ${esc(curFolderById(S.into).name)} »` : "Ajouter à votre bibliothèque", `
    <label class="field" style="border-radius:var(--r-md)">${icon("link-outline", "s18")}<input placeholder="Coller un lien — article, vidéo, épisode de podcast" value="https://www.youtube.com/watch?v=…" aria-label="Lien"></label>
    <p class="small muted" style="margin:6px 4px 16px">Le traitement commence dès l'ajout.${S.into ? " La source est rangée directement dans ce dossier." : " Vous choisissez le dossier ensuite."}</p>
    <div style="border:2px dashed var(--outline-variant);border-radius:var(--r-lg);padding:24px;text-align:center">${icon("cloud-upload-outline", "s24")}<div class="label" style="margin-top:6px">Déposer des fichiers ici, ou <u>parcourir</u></div><div class="small muted">PDF, documents Office, images, photos, fichiers audio · 1 fichier par import</div></div>
    <p class="small muted" style="margin:12px 4px 0">Astuce : déposez un fichier n'importe où dans Deepn, ou collez un lien avec ⌘V hors d'un champ de saisie.</p>`,
    `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary" ${goAttr({ modal: "add2" })}>Ajouter</button>`);
}
function curFolderById(id) { return id === "f0" ? C().unsorted : C().byId.get(id) || C().memory; }

// ---------------------------------------------------------------- walkthrough index (replaces core's)

function walkthroughs() {
  const c = C(), mem = c.memory;
  const L = (label, patch) => `<a href="${hashOf({ ...DEFAULTS, ...patch })}">${label}</a>`;
  return `<div id="walk"><button data-act="walk">Pages de la maquette</button>${UI.walk ? `<div class="panel" onclick="event.stopPropagation()">
    <h4>Barre principale</h4>${L("Accueil", { s: "home" })}${L("Accueil · bibliothèque vide", { s: "home", empty: "1" })}${L("Bibliothèque", { s: "library" })}${L("Bibliothèque · dossiers repliés", { s: "library", fold: "1" })}${L("Recherche plein texte", { s: "search", sq: "pause" })}${L("Digest · choix de la période", { s: "digest" })}${L("Digest quotidien (média 2 / 4)", { s: "digestp", dp: "daily", dpos: "2" })}${L("Digest hebdomadaire", { s: "digestp", dp: "weekly", dpos: "1" })}${L("Non classés · revue", { s: "unsorted", pos: "1" })}${L("Non classés · plus rien à trier", { s: "unsorted", done: "1" })}${L("Ajouter (lien, fichier)", { s: "home", modal: "add" })}${L("Ajouter → ranger ?", { s: "home", modal: "add2" })}
    <h4>Média (Lecture · Discussion · IA)</h4>${L("Média · réponse en cours, paragraphes cités", { s: "media", m: "m1", cs: "streaming" })}${L("Média · nouvelle conversation", { s: "media", m: "m1", conv: "new" })}${L("Média · historique des conversations", { s: "media", m: "m1", cs: "history" })}${L("Média · échec partiel", { s: "media", m: "m1", cs: "failed" })}${L("Média · reprise après rechargement", { s: "media", m: "m1", cs: "resuming" })}${L("Média · artefact Résumé ouvert", { s: "media", m: "m1", art: "summaryShort" })}${L("Média · flashcards", { s: "media", m: "m1", art: "flashcards" })}${L("Média · volets latéraux réduits", { s: "media", m: "m1", lp: "0", rp: "0" })}${L("Média en cours de traitement", { s: "media", m: "m10" })}${L("Média en échec", { s: "media", m: "m12" })}${L("Ranger la source", { s: "media", m: "m11", modal: "move", target: "m11" })}
    <h4>Dossier (Sources · Discussion · IA)</h4>${L("Dossier · sources", { s: "folder", f: mem.id })}${L("Dossier · ajouter des sources (+)", { s: "folder", f: mem.id, modal: "add", into: mem.id })}${L("Dossier · quiz ouvert", { s: "folder", f: mem.id, art: "quiz" })}${L("Dossier · plafond de contexte refusé", { s: "folder", f: c.roots[0].id, cs: "refused" })}${L("Dossier · minutes épuisées", { s: "folder", f: mem.id, cs: "quota" })}${L("Non classés en dossier", { s: "folder", f: "f0" })}${L("Renommer le dossier", { s: "folder", f: mem.id, modal: "rename" })}${L("Supprimer le dossier", { s: "folder", f: mem.id, modal: "delete" })}
    <h4>Mon compte</h4>${L("Votre formule (bêta)", { s: "account" })}${L("Votre formule (après la bêta)", { s: "account", beta: "0" })}${L("Changer de formule", { s: "account", sec: "plans", beta: "0" })}${L("Langue de lecture", { s: "account", sec: "reading" })}${L("Langue de l'app", { s: "account", sec: "ui" })}${L("Thème", { s: "account", sec: "theme" })}${L("Extension navigateur", { s: "account", sec: "extension" })}${L("Suggestions", { s: "account", sec: "ideas" })}${L("Signaler un bug", { s: "account", sec: "bug" })}${L("Se déconnecter", { s: "account", modal: "signout" })}${L("Supprimer le compte", { s: "account", sec: "delete" })}
    <h4>Hors session</h4>${L("Connexion", { s: "login" })}${L("Inscription", { s: "register" })}${L("Langue à l'inscription", { s: "onboarding" })}
    <h4>Thème</h4>${L("Média en sombre", { s: "media", m: "m1", theme: "dark", cs: "streaming" })}${L("Accueil en sombre", { s: "home", theme: "dark" })}
  </div>` : ""}</div>`;
}

// The folder menu without "Nouveau sous-dossier": a folder is never created inside another
// one (the mobile app only creates top-level folders). Replaces the shared core's menu.
function contextMenu() {
  if (!UI.menu) return "";
  const { kind, x, y } = UI.menu;
  const rows = kind === "media"
    ? [["folder-outline", "Ranger dans un dossier…", { modal: "move", target: UI.menu.id }], ["create-outline", "Renommer", { modal: "renamemedia", m: UI.menu.id }], ["trash-outline", "Supprimer", { modal: "deletemedia", m: UI.menu.id }, true]]
    : [["create-outline", "Renommer", { modal: "rename", f: UI.menu.id }], ["trash-outline", "Supprimer", { modal: "delete", f: UI.menu.id }, true]];
  return `<div class="menu" style="left:${x}px;top:${y}px" role="menu">${rows.map(([ic, l, p, d]) => `<button role="menuitem" class="${d ? "danger" : ""}" ${goAttr(p)}>${icon(ic, "s18")}${l}</button>`).join("")}</div>`;
}

// ---------------------------------------------------------------- a flat library

// A folder is never created inside another one, so this direction's library has a single
// level: the shared corpus's top-level folders plus its distinct second-level ones, the
// generic names that only made sense under a parent ("Notes de lecture", "2025"…) left out.
// Replaces data.js's corpus() for this direction only; the five directions keep theirs.
const FLAT_GENERIC = new Set(["Notes de lecture", "Entretiens", "Références", "2024", "2025", "Sommeil", "Méthodes de mesure", "Design", "Conférences", "Cours en ligne"]);
let FLAT;
function corpus() {
  if (FLAT) return FLAT;
  const rand = mulberry32(424);
  const names = [];
  for (const [r, cs] of ROOTS) for (const n of [r, ...cs]) if (!FLAT_GENERIC.has(n) && !names.includes(n)) names.push(n);
  const folders = names.map((name, i) => ({ id: "f" + (i + 1), name, parent: null, depth: 0, children: [], count: 1 + Math.floor(rand() * 14), lastOpened: Math.floor(rand() * 220) }));
  folders.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const unsorted = { id: "f0", name: "Non classés", parent: null, depth: 0, children: [], count: 14, lastOpened: 0, isDefault: true };
  const byId = new Map(folders.map((f) => [f.id, f]));
  byId.set(unsorted.id, unsorted);
  const memory = folders.find((f) => f.name === "Mémoire de travail");
  memory.count = 9;
  return (FLAT = { folders, byId, roots: folders, unsorted, memory, leafMemory: null });
}

// The shared dialogs, without the parent a new folder would go into and without the
// subfolders a deleted one would take along.
function sharedModal() {
  const m = S.modal;
  if (!m) return "";
  if (PHONE() && (m === "add")) return addSheetP();
  if (PHONE() && (m === "move" || m === "pick")) return folderSheetP();
  if (m === "add" || m === "add2") return addDialog();
  if (m === "move" || m === "pick") return DIR.destinationPicker();
  if (m === "palette" && DIR.palette) return DIR.palette();
  if (m === "rename") return modalShell("Renommer ce dossier", `<label class="field" style="border-radius:var(--r-md)"><input value="${esc(curFolder().name)}" aria-label="Nom du dossier"></label><p class="small muted">255 caractères au plus.</p>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary">Enregistrer</button>`);
  if (m === "newfolder") return modalShell("Nouveau dossier", `<label class="field" style="border-radius:var(--r-md)"><input placeholder="Nom du dossier" aria-label="Nom du dossier"></label><p class="small muted">Le dossier est créé dans votre bibliothèque. 255 caractères au plus.</p>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary">Créer</button>`);
  if (m === "delete") { const f = curFolder(); return modalShell("Supprimer ce dossier ?", `<p style="margin-top:0">« ${esc(f.name)} » sera supprimé. Toutes ses sources vont dans Non classés — aucune n'est supprimée.</p>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn danger">Supprimer</button>`); }
  if (m === "renamemedia") return modalShell("Renommer cette source", `<label class="field" style="border-radius:var(--r-md)"><input value="${esc(curMedia().title)}" aria-label="Nom de la source"></label>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary">Enregistrer</button>`);
  if (m === "deletemedia") return modalShell("Supprimer cette source ?", `<p style="margin-top:0">« ${esc(curMedia().title)} » sera retirée de votre bibliothèque. Cette action est irréversible.</p>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn danger">Supprimer</button>`);
  if (m === "signout") return modalShell("Se déconnecter ?", `<p style="margin-top:0">Vous serez déconnecté de ce navigateur. Les autres appareils restent connectés.</p>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary" ${goAttr({ s: "login", modal: null })}>Oui, me déconnecter</button>`);
  if (m === "bug") return modalShell("Signaler un bug", `<label class="small subtle">Sujet</label><label class="field" style="border-radius:var(--r-md);margin:4px 0 12px"><input placeholder="Résumé du problème"></label><label class="small subtle">Description</label><textarea style="width:100%;min-height:120px;border:0;border-radius:var(--r-md);background:var(--surface-container);padding:12px;margin-top:4px" placeholder="Étapes, ce que vous attendiez, ce qui s'est passé…"></textarea><div class="row" style="margin-top:12px"><button class="btn tonal">${icon("cloud-upload-outline", "s16")} Joindre un fichier</button><span class="small muted">Image, vidéo, PDF ou ZIP — 25 Mo au plus</span></div>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary">Envoyer</button>`);
  return "";
}
