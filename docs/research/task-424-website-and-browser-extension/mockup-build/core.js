// Shared core of the five directions: hash router, shared renderers, shared dialogs.
// Every direction supplies DIR (shell, library, destination picker, chat container);
// everything that is the *same feature* in all five is rendered here, so the five
// differ by structure and walkthroughs, not by five re-drawings of one artifact viewer.

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const icon = (name, cls = "") => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// ---------------------------------------------------------------- state & router

const DEFAULTS = { s: "home", corpus: "ref", tab: "", chat: "off", cs: "idle", theme: "light", beta: "1", dp: "daily", dpos: "1" };
let S = { ...DEFAULTS };
const UI = { expanded: new Set(), pins: new Set(), menu: null };

function parseHash() {
  const out = { ...DEFAULTS };
  for (const part of location.hash.replace(/^#/, "").split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    out[k] = decodeURIComponent(v);
  }
  return out;
}
function hashOf(st) {
  return "#" + Object.entries(st).filter(([k, v]) => v !== "" && v != null && DEFAULTS[k] !== v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}
function go(patch, { replace = false } = {}) {
  const next = { ...S, ...patch };
  for (const k of Object.keys(next)) if (next[k] === null) delete next[k];
  const h = hashOf(next);
  if (replace) history.replaceState(null, "", h); else location.hash = h;
  if (replace) render();
}
// "go" links carry a patch as JSON in data-go.
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-go],[data-act]");
  if (!el) { if (UI.menu) { UI.menu = null; render(); } return; }
  e.preventDefault();
  if (el.dataset.go) go(JSON.parse(el.dataset.go));
  if (el.dataset.act) { const [fn, ...args] = el.dataset.act.split(":"); (DIR.acts?.[fn] || ACTS[fn])?.(...args, el, e); }
});
const goAttr = (patch) => `data-go='${esc(JSON.stringify(patch))}'`;
window.addEventListener("hashchange", () => { S = parseHash(); render(); });

const ACTS = {
  toggle(id) { UI.expanded.has(id) ? UI.expanded.delete(id) : UI.expanded.add(id); render(); },
  pin(id) { UI.pins.has(id) ? UI.pins.delete(id) : UI.pins.add(id); render(); },
  menu(kind, id, el) { const r = el.getBoundingClientRect(); UI.menu = { kind, id, x: Math.min(r.left, innerWidth - 240), y: r.bottom + 4 }; render(); },
  theme() { go({ theme: S.theme === "dark" ? "light" : "dark" }); },
};

// ---------------------------------------------------------------- helpers

const C = () => corpus(S.corpus);
const curFolder = () => C().byId.get(S.f) || C().memory || C().roots[0];
const curMedia = () => mediaById(S.m || "m1");
function cover(m, size = 56) {
  const t = TYPE_META[m.type];
  return `<div class="cover ${m.status === "processing" ? "processing" : ""}" style="width:${size}px;height:${size}px;background:${m.color}">${icon(t.icon)}</div>`;
}
function typeBadge(m) {
  if (m.status === "failed") return `<span class="badge err">ÉCHEC</span>`;
  return `<span class="badge ${m.type === "short" ? "short" : ""}">${TYPE_META[m.type].label}</span>`;
}
function mediaRow(m, { sel = false, size = 56, folderChip = "" } = {}) {
  const sub = m.status === "processing" ? "En cours de traitement" : esc(m.creator);
  return `<button class="mrow ${sel ? "sel" : ""}" ${goAttr({ s: "media", m: m.id, tab: "reader", chat: "off", cs: "idle", modal: null })}>
    ${cover(m, size)}
    <div class="grow"><div class="t clamp2">${esc(m.title)}</div>
      <div class="meta">${typeBadge(m)}<span class="ell">${sub}</span><span>·</span><span style="white-space:nowrap">${esc(m.age)}</span>${folderChip}</div></div>
    <span class="icon-btn" data-act="menu:media:${m.id}" title="Actions sur cette source" aria-label="Actions sur cette source">${icon("ellipsis-horizontal", "s18")}</span>
  </button>`;
}
// Nearest parent first: in a narrow row the end of a long path is what gets cut, and the
// end is exactly what tells two « Notes de lecture » apart.
function parentHint(f) { const p = folderPath(C(), f); p.pop(); return p.reverse().map((x) => x.name).join(" · ") || "Racine de la bibliothèque"; }
function pathText(f) { return folderPath(C(), f).map((p) => p.name).join(" › "); }
function parentPathText(f) { const p = folderPath(C(), f); p.pop(); return p.map((x) => x.name).join(" › "); }
// Marks the query terms in a name, accent-insensitively.
function hl(name, q) {
  if (!q) return esc(name);
  const terms = fold(q).split(/\s+/).filter(Boolean);
  const f = fold(name);
  const marks = new Array(name.length).fill(false);
  for (const t of terms) { let i = f.indexOf(t); while (i >= 0) { for (let k = i; k < i + t.length; k++) marks[k] = true; i = f.indexOf(t, i + 1); } }
  let out = "", open = false;
  for (let i = 0; i < name.length; i++) {
    if (marks[i] && !open) { out += "<mark>"; open = true; }
    if (!marks[i] && open) { out += "</mark>"; open = false; }
    out += esc(name[i]);
  }
  return out + (open ? "</mark>" : "");
}
function crumbs(f, { onlyParents = false, root = "Bibliothèque" } = {}) {
  const p = folderPath(C(), f);
  if (onlyParents) p.pop();
  return `<nav class="crumbs" aria-label="Chemin du dossier"><button ${goAttr({ s: "library", f: null })}>${root}</button>${p.map((x) => `${icon("chevron-forward", "s14")}<button title="${esc(x.name)}" ${goAttr({ s: "folder", f: x.id, tab: "sources", chat: "off" })}>${esc(x.name)}</button>`).join("")}</nav>`;
}
const recentFolders = (n = 6) => [...C().folders].sort((a, b) => a.lastOpened - b.lastOpened).slice(0, n);

// ---------------------------------------------------------------- media page pieces

function mediaHero(m, { height = 200 } = {}) {
  return `<div class="hero" style="height:${height}px;background:linear-gradient(135deg, ${m.color}, ${m.color}cc)">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.25)">${icon(TYPE_META[m.type].icon, "s24")}</div>
    <div class="veil"><div class="small subtle">${esc(m.creator)}</div><h1 class="headline clamp2">${esc(m.title)}</h1></div></div>`;
}
function metaLine(m) {
  return `<div class="metaline"><a href="#" title="Ouvrir sur la source">${icon("open-outline", "s16")} ${m.type === "podcast" ? "podcasts.apple.com" : m.type === "article" ? "theconversation.com" : "youtube.com"}</a><span>12 sept. 2026</span><span>${esc(m.duration)}</span><span>Anglais → Français</span><span>10 paragraphes</span></div>`;
}
function mediaTabs(m, extra = "") {
  const t = S.tab || "reader";
  return `<div class="row" style="gap:12px"><div class="seg" role="tablist" aria-label="Sections du média">
    <button role="tab" class="${t === "reader" ? "on" : ""}" ${goAttr({ tab: "reader" })}>${icon("book-outline", "s16")} Lecture</button>
    <button role="tab" class="${t === "ai" ? "on" : ""}" ${goAttr({ tab: "ai", chat: "off" })}>${icon("sparkles-outline", "s16")} IA</button></div>${extra}
    <span class="grow"></span><button class="icon-btn" data-act="menu:media:${m.id}" aria-label="Actions pour cette source" title="Ranger, renommer, supprimer">${icon("ellipsis-horizontal")}</button></div>`;
}
function previewBlock() {
  return `<section class="callout" aria-label="L'essentiel"><div class="caps" style="margin-bottom:4px">L'essentiel</div><p style="margin:0 0 8px">${PREVIEW.blurb}</p>
    <ul style="margin:0;padding-left:18px">${PREVIEW.points.map((p) => `<li>${p}</li>`).join("")}</ul></section>`;
}
function readerText({ cited = [] } = {}) {
  return `<div class="row" style="margin:24px 0 8px"><h2 class="headline grow">Texte intégral</h2>
      <button class="chip" title="Afficher le texte original (anglais)">${icon("language-outline", "s16")} Voir l'original (EN)</button></div>
    <div class="reader">${PARAGRAPHS.map((p, i) => `<p id="p${i + 1}" class="${cited.includes(i + 1) ? "cited" : ""}"><span class="pn">§${i + 1}</span>${p}</p>`).join("")}</div>`;
}
function mediaStateBody(m) {
  if (m.status === "processing")
    return `<div class="card" style="padding:24px;display:flex;gap:16px;align-items:center">${icon("sync", "s24")}<div><div class="label">Transcription de la vidéo…</div><div class="small muted">Cela prend généralement moins d'une minute. La page se met à jour seule.</div></div></div>`;
  if (m.status === "failed")
    return `<div class="card" style="padding:24px"><div class="row" style="color:var(--error)">${icon("alert-circle-outline")}<b>Le traitement a échoué</b></div>
      <p class="subtle" style="margin:8px 0 16px">Le contenu en direct ne peut pas être importé. Réessayez quand l'enregistrement sera publié.</p>
      <div class="callout"><b>Cette source n'est pas encore prise en charge.</b><div class="small subtle">Si vous voulez qu'elle le soit un jour :</div>
      <button class="btn tonal" style="margin-top:8px">Demander cette source</button></div></div>`;
  return "";
}

// ---------------------------------------------------------------- AI tab (media and folder)

function aiPanel(scope) {
  const states = scope === "folder" ? FOLDER_ARTIFACTS : MEDIA_ARTIFACTS;
  const hist = scope === "folder" ? FOLDER_HISTORY : MEDIA_HISTORY;
  const st = (s) => ({ generated: `${icon("checkmark-circle", "s16")} Généré`, generating: `${icon("sync", "s16")} Génération…`, queued: `${icon("time-outline", "s16")} En file`, failed: `<span style="color:var(--error)">${icon("alert-circle-outline", "s16")} Échec · Réessayer</span>`, idle: `<span class="btn primary" style="min-height:30px;padding:0 12px">Générer</span>` })[s];
  return `<section aria-label="Générer"><div class="caps" style="margin:4px 0 8px">Générer ${scope === "folder" ? "sur tout le dossier, sous-dossiers compris" : ""}</div>
    <div class="tiles">${ARTIFACT_TYPES.map((a) => `<div class="tile">${icon(a.icon, "s24")}<div class="label">${a.label}</div><div class="st">${st(states[a.key])}</div></div>`).join("")}</div>
    ${scope === "folder" ? `<div class="banner" style="margin-top:8px">${icon("layers-outline", "s16")} Les sources ont changé depuis le dernier résumé détaillé : une nouvelle génération ajoute une entrée à l'historique, l'ancienne est conservée.</div>` : ""}</section>
    <section style="margin-top:24px" aria-label="Historique"><div class="caps" style="margin-bottom:6px">Historique</div>
    ${hist.map((h) => { const a = ARTIFACT_TYPES.find((x) => x.key === h.type); return `<button class="hist" style="width:100%;text-align:left" ${goAttr({ s: "artifact", art: h.type, from: scope })}><div class="icon-btn" style="background:var(--surface-container)">${icon(a.icon, "s18")}</div><div class="grow"><div class="label ell">${esc(h.title)}</div><div class="small muted">${a.label} · ${h.when}${h.sources ? ` · ${h.sources} sources` : ""}</div></div>${icon("chevron-forward", "s16")}</button>`; }).join("")}</section>`;
}
function artifactView(type = "summaryShort") {
  const a = ARTIFACT_TYPES.find((x) => x.key === type) || ARTIFACT_TYPES[0];
  let body = "";
  if (type === "flashcards")
    body = `<div class="small muted" style="margin-bottom:12px">12 cartes · Espace pour retourner, ← → pour passer</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">${FLASHCARDS.map(([q, r], i) => `<div class="card" style="padding:16px"><div class="caps">Question</div><p style="margin:6px 0 12px;font-weight:600">${q}</p>${i === 0 ? `<div class="caps">Réponse</div><p style="margin:6px 0 0">${r}</p>` : `<button class="chip">Retourner la carte</button>`}</div>`).join("")}</div>`;
  else if (type === "quiz")
    body = `<div class="progress" style="margin-bottom:12px"><i style="width:30%"></i></div><div class="small muted">Question 3 sur 10</div><p class="headline" style="margin:8px 0 16px">${QUIZ.question}</p>${QUIZ.options.map(([l, t]) => `<div class="card" style="padding:12px 16px;margin-bottom:8px;display:flex;gap:12px;${l === QUIZ.correct ? "box-shadow:inset 0 0 0 2px var(--primary)" : ""}"><b>${l}</b>${t}${l === QUIZ.correct ? `<span class="grow"></span>${icon("checkmark-circle")}` : ""}</div>`).join("")}<div class="callout" style="margin-top:12px"><div class="caps">Explication</div>${QUIZ.explanation}</div>`;
  else
    body = `<div class="callout"><div class="caps">Points clés</div><ul style="margin:6px 0 0;padding-left:18px">${PREVIEW.points.map((p) => `<li>${p}</li>`).join("")}</ul></div><h3 class="headline" style="margin:20px 0 6px">À retenir</h3><p style="margin:0">La bonne pause n'est pas celle qui distrait : c'est celle qui ne demande rien à l'attention dirigée.</p>`;
  return `<article style="max-width:760px"><div class="caps">${a.label} · généré hier à 21:02 · ${S.from === "folder" ? "9 sources" : "1 source"}</div><h1 class="display" style="margin:6px 0 20px">La bonne pause ne demande rien</h1>${body}</article>`;
}

// ---------------------------------------------------------------- chat

function chatScope() {
  if (S.s === "media" && (S.tab || "reader") === "reader") return "media";
  if (S.s === "folder" && (S.tab || "sources") === "sources") return "folder";
  return null; // no composer anywhere else — task-434 Decision
}
function scopeLabel(scope) {
  return scope === "media" ? "Ce média" : `Ce dossier · ${curFolder() === C().memory ? 9 : totalSources(curFolder())} sources`;
}
function composer(scope, { compact = false } = {}) {
  const busy = S.cs === "sending" || S.cs === "streaming" || S.cs === "resuming";
  const ph = compact ? (scope === "media" ? "Question sur ce média…" : "Question sur les sources de ce dossier…") : scope === "media" ? "Poser une question sur ce média…" : "Poser une question sur les sources de ce dossier…";
  return `<form class="composer" onsubmit="return false" aria-label="Discussion">
    ${compact ? "" : `<span class="scope" title="Portée de la discussion">${scopeLabel(scope)}</span>`}
    <textarea rows="1" placeholder="${ph}" aria-label="${ph}" ${goAttr(S.chat === "open" ? {} : { chat: "open" })}>${S.cs === "draft" ? "Lesquelles se contredisent sur la capacité ?" : ""}</textarea>
    <button class="icon-btn" title="Conversations précédentes" aria-label="Conversations précédentes" ${goAttr({ chat: "open", cs: "history" })}>${icon("time-outline", "s18")}</button>
    ${busy ? `<button class="send stop" title="Arrêter la réponse (Échap)" aria-label="Arrêter la réponse" ${goAttr({ cs: "stopped" })}>${icon("stop", "s16")}</button>` : `<button class="send" title="Envoyer (Entrée)" aria-label="Envoyer" ${goAttr({ chat: "open", cs: "streaming" })}>${icon("arrow-up", "s18")}</button>`}
  </form>`;
}
function convList(scope) {
  const d = CHAT[scope];
  return `<div class="convlist"><div class="row" style="margin-bottom:6px"><div class="caps grow">Conversations · ${scope === "media" ? "ce média" : "ce dossier"}</div><button class="btn tonal" style="min-height:32px" ${goAttr({ cs: "idle", conv: "new" })}>${icon("add", "s16")} Nouvelle</button></div>
    ${d.conversations.map((c) => `<button class="${c.active ? "on" : ""}" ${goAttr({ cs: "idle", conv: c.id })}><span class="label">${esc(c.title)}</span><span class="small muted">${c.when} · ${c.turns} échanges${c.interrupted ? " · dernière réponse interrompue" : ""}</span></button>`).join("")}
    <p class="small muted" style="margin:10px 4px 0">L'historique est conservé sur votre compte et retrouvé sur tous vos appareils. Il n'existe pas de discussion sur toute la bibliothèque.</p></div>`;
}
// The thread, in the state the hash asks for. All states of task-430 Decision §6:
// sending, streaming, voluntary stop (partial kept), partial failure (new attempt,
// never concatenated), resume after reload/navigation, explicit refusal.
function thread(scope) {
  const d = CHAT[scope];
  if (S.cs === "history") return convList(scope);
  if (S.conv === "new") return `<div class="small muted" style="padding:8px 0">Nouvelle conversation sur ${scope === "media" ? "ce média" : "les sources de ce dossier"}.</div><div class="row" style="flex-wrap:wrap">${d.suggestions.map((x) => `<button class="chip">${x}</button>`).join("")}</div>`;
  let tail = "";
  const user = (t) => `<div class="msg user">${t}</div>`;
  const asst = (t, extra = "") => `<div class="msg assistant">${t}${extra}</div>`;
  // Three earlier messages: question, answer (on a folder, one the user had stopped,
  // kept as such in the history), then the question being answered now.
  const html = d.messages.slice(0, 3).map((m) => m.role === "user" ? user(m.text) : asst(m.text, m.stopped ? `<div class="msg-state">${icon("stop", "s14")} ${m.partial}</div>` : "")).join("");
  switch (S.cs) {
    case "sending": tail = `<div class="msg-state"><span class="typing"><i></i><i></i><i></i></span> Envoi de la question…</div>`; break;
    case "streaming": tail = asst(d.streaming + `<span class="caret"></span>`, `<div class="msg-state">${icon("pulse", "s14")} Réponse en cours · vous pouvez quitter la page, elle continue · <button class="btn ghost" ${goAttr({ cs: "stopped" })}>Arrêter</button></div>`); break;
    case "stopped": tail = asst(d.streaming.replace(/<cite>[^<]*<\/cite>\s*$/, ""), `<div class="msg-state">${icon("stop", "s14")} Réponse arrêtée par vous. Le texte reçu est conservé. <button class="btn ghost" ${goAttr({ cs: "streaming" })}>Relancer</button></div>`); break;
    case "failed": tail = asst(d.streaming.slice(0, 120) + "…", `<div class="msg-state err">${icon("alert-circle-outline", "s14")} La réponse s'est interrompue : le service n'a pas pu terminer. Le texte reçu est conservé. <button class="btn tonal" ${goAttr({ cs: "streaming" })}>Réessayer</button></div><div class="small muted">Une nouvelle tentative écrit une nouvelle réponse ; elle ne complète pas celle-ci. Aucun second débit de minutes.</div>`); break;
    case "resuming": tail = `<div class="banner">${icon("sync", "s16")} Reprise de la réponse là où elle en était… (la page a été rechargée)</div>` + asst(d.streaming.slice(0, 160) + `<span class="caret"></span>`); break;
    case "refused": tail = `<div class="banner err">${icon("alert-circle-outline", "s16")} Ce dossier contient trop de texte pour une conversation (plafond de contexte atteint). Ouvrez un sous-dossier plus petit pour en discuter.</div>`; break;
    case "quota": tail = `<div class="banner warn">${icon("time-outline", "s16")} Vous n'avez plus de minutes jusqu'au 1er novembre. Les conversations existantes restent lisibles.</div>`; break;
    default: tail = asst(d.streaming.replace(/<cite>[^<]*<\/cite>\s*$/, "") + " — même s'il est intéressant, il sollicite le même système.");
  }
  return `<div class="thread">${html}${tail}</div>`;
}
function chatHeader(scope, { close = true } = {}) {
  const d = CHAT[scope];
  return `<div class="row" style="gap:6px"><div class="grow"><div class="label ell">${S.cs === "history" ? "Historique" : esc(S.conv === "new" ? "Nouvelle conversation" : d.conversations[0].title)}</div><div class="small muted ell">${scope === "media" ? "Discussion sur ce média" : "Discussion sur les sources de ce dossier"}</div></div>
    <button class="icon-btn" title="Conversations" aria-label="Conversations" ${goAttr({ cs: S.cs === "history" ? "idle" : "history" })}>${icon("chatbubbles-outline", "s18")}</button>
    ${close ? `<button class="icon-btn" title="Réduire (la réponse continue)" aria-label="Réduire la discussion" ${goAttr({ chat: "off" })}>${icon("close", "s18")}</button>` : ""}</div>`;
}

// ---------------------------------------------------------------- other surfaces

function homeBody() {
  const recent = MEDIA.filter((m) => !m.folder).concat(MEDIA.slice(0, 3));
  return `<div style="display:flex;flex-direction:column;gap:24px">
    <div class="banner warn">${icon("time-outline", "s16")} Vous avez utilisé 82 % des minutes de ce mois. Elles se renouvellent le 1er novembre. <span class="grow"></span><button class="icon-btn" aria-label="Masquer l'alerte">${icon("close", "s16")}</button></div>
    <button class="card" style="padding:16px 20px;display:flex;gap:16px;align-items:center;text-align:left" ${goAttr({ s: "unsorted", pos: "1" })}><div class="icon-btn" style="background:var(--primary);color:var(--on-primary)">${icon("file-tray-outline")}</div><div class="grow"><div class="label">Tri des non classés</div><div class="small muted">12 sources attendent un dossier</div></div>${icon("chevron-forward")}</button>
    <section><h2 class="headline" style="margin-bottom:12px">Ajouts récents</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px">${recent.slice(0, 6).map((m) => `<button style="text-align:left" ${goAttr({ s: "media", m: m.id, tab: "reader" })}>${cover(m, 150).replace('width:150px', 'width:100%;aspect-ratio:1')}<div class="small clamp2" style="font-weight:600;margin-top:6px">${esc(m.title)}</div><div class="small muted">${m.status === "processing" ? "En cours de traitement" : m.status === "failed" ? "Échec de l'import" : esc(m.creator)}</div></button>`).join("")}</div></section>
    <section><h2 class="headline" style="margin-bottom:12px">Reprendre</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">${MEDIA.slice(0, 4).map((m, i) => `<div class="card" style="padding:4px">${mediaRow(m, { size: 48 })}<div class="progress" style="margin:0 12px 8px"><i style="width:${[38, 72, 15, 55][i]}%"></i></div></div>`).join("")}</div></section></div>`;
}
function digestBody() {
  const per = S.dp === "weekly" ? "weekly" : "daily";
  const d = DIGEST[per];
  const pos = Math.min(+S.dpos || 1, d.items.length);
  const m = mediaById(d.items[pos - 1]);
  return `<div class="row" style="margin-bottom:16px"><div class="seg"><button class="${per === "daily" ? "on" : ""}" ${goAttr({ dp: "daily", dpos: "1" })}>Quotidien · ${DIGEST.daily.count}</button><button class="${per === "weekly" ? "on" : ""}" ${goAttr({ dp: "weekly", dpos: "1" })}>Hebdomadaire · ${DIGEST.weekly.count}</button></div><span class="grow"></span>
    <div class="row">${d.items.map((_, i) => `<span style="width:8px;height:8px;border-radius:50%;background:${i + 1 === pos ? "var(--primary)" : "var(--outline-variant)"}"></span>`).join("")}<span class="small subtle" style="margin-left:6px">${pos} / ${d.items.length}</span>
    <button class="icon-btn" aria-label="Précédent (←)" ${goAttr({ dpos: String(Math.max(1, pos - 1)) })}>${icon("chevron-back")}</button><button class="icon-btn" aria-label="Suivant (→)" ${goAttr({ dpos: String(Math.min(d.items.length, pos + 1)) })}>${icon("chevron-forward")}</button></div></div>
    <div style="max-width:760px">${mediaHero(m, { height: 180 })}<div style="margin:12px 0">${metaLine(m)}</div><div class="seg" style="margin-bottom:16px"><button class="on">${icon("book-outline", "s16")} Lecture</button><button>${icon("sparkles-outline", "s16")} IA</button></div>${previewBlock()}<p class="small muted" style="margin-top:12px">${icon("return-down-forward-outline", "s14")} La page complète de ce média — et sa discussion — s'ouvre avec « Ouvrir ». Le digest ne porte pas de composeur : ce n'est ni l'onglet Lecture d'un média ni l'onglet Sources d'un dossier.</p><button class="btn tonal" ${goAttr({ s: "media", m: m.id, tab: "reader" })}>Ouvrir le média</button></div>`;
}
function searchBody(q = S.sq || "pause") {
  const folders = searchFolders(C(), q, 6);
  return `<div class="small muted" style="margin-bottom:12px">${SEARCH_HITS.length} résultats dans le texte de vos sources · ${folders.length} dossiers</div>
    ${folders.length ? `<div class="caps" style="margin-bottom:6px">Dossiers</div><div style="margin-bottom:16px">${folders.map((f) => `<button class="frow" ${goAttr({ s: "folder", f: f.id, tab: "sources" })}>${icon("folder-outline", "s18")}<span>${hl(f.name, q)}</span><span class="path ell grow">${esc(parentHint(f))}</span></button>`).join("")}</div>` : ""}
    <div class="caps" style="margin-bottom:6px">Dans le texte</div>${SEARCH_HITS.map((h) => { const m = mediaById(h.media); return `<button class="mrow" style="align-items:flex-start" ${goAttr({ s: "media", m: m.id, tab: "reader" })}>${cover(m, 48)}<div class="grow"><div class="t">${esc(m.title)}</div><div class="small subtle" style="margin-top:2px">${h.snippet}</div><div class="meta" style="margin-top:4px">${typeBadge(m)} ${esc(m.creator)}</div></div></button>`; }).join("")}
    <div class="small muted" style="text-align:center;padding:16px">Fin des résultats</div>`;
}
function unsortedBody() {
  const items = MEDIA.filter((m) => !m.folder && !m.status);
  const pos = Math.min(+S.pos || 1, items.length);
  const m = items[pos - 1];
  return `<div style="max-width:640px;margin:0 auto"><div class="row" style="margin-bottom:12px"><div class="label grow">Tri des non classés</div><span class="small subtle">${pos} / ${items.length}</span></div>
    <div class="card" style="overflow:hidden">${mediaHero(m, { height: 220 }).replace('border-radius:var(--r-xl)', '')}<div style="padding:16px 20px"><div class="metaline" style="margin-bottom:8px">${typeBadge(m)} ${esc(m.creator)} · ${esc(m.age)}</div><p style="margin:0">${PREVIEW.blurb}</p></div></div>
    <div class="row" style="justify-content:center;gap:12px;margin-top:16px"><button class="btn tonal">${icon("trash-outline", "s16")} Écarter <span class="kbd">D</span></button><button class="btn tonal" ${goAttr({ s: "media", m: m.id, tab: "reader" })}>${icon("book-outline", "s16")} Approfondir <span class="kbd">O</span></button><button class="btn primary" ${goAttr({ modal: "move", target: m.id })}>${icon("folder-outline", "s16")} Ranger <span class="kbd">R</span></button></div>
    <p class="small muted" style="text-align:center">← → pour passer d'une source à l'autre</p></div>`;
}
function accountBody() {
  const beta = S.beta !== "0";
  const item = (ic, label, hint, patch, danger) => `<button class="frow" style="min-height:52px;${danger ? "color:var(--error)" : ""}" ${patch ? goAttr(patch) : ""}>${icon(ic, "s18")}<span class="grow"><span class="label" style="display:block">${label}</span>${hint ? `<span class="small muted">${hint}</span>` : ""}</span>${icon("chevron-forward", "s16")}</button>`;
  return `<div style="max-width:640px"><div class="small muted">Connecté avec</div><div class="headline" style="margin-bottom:16px">vous@exemple.fr</div>
    <div class="card" style="padding:16px 20px;margin-bottom:24px"><div class="caps">Votre forfait</div><div class="row" style="margin-top:6px"><div class="headline grow">${beta ? "Accès bêta" : "Forfait M"}</div><span class="chip">${beta ? "Bêta" : "Actif"}</span></div>
      <div class="row" style="margin-top:12px;align-items:flex-end"><div class="grow"><div class="caps">Minutes restantes</div><div class="display">412 <span class="small muted">/ 2 400</span></div></div><div style="text-align:right"><div class="caps">Renouvellement</div><div class="label">1 nov. 2026</div></div></div>
      <p class="small subtle" style="margin:8px 0 0">${beta ? "Pendant la bêta, chaque compte reçoit l'allocation du plus grand forfait. Aucune entrée vers l'abonnement n'est affichée (task-429)." : "Les minutes couvrent l'audio et la vidéo envoyés. Les articles et pages web n'en coûtent aucune."}</p>
      ${beta ? "" : `<button class="btn primary" style="margin-top:12px" ${goAttr({ s: "paywall" })}>Changer de forfait</button>`}</div>
    <div class="caps" style="margin-bottom:4px">Réglages</div>
    ${item("language-outline", "Langue de lecture", "Français · une modification par mois", { s: "settings", sub: "reading" })}
    ${item("globe-outline", "Langue de l'app", "Suivre le navigateur", { s: "settings", sub: "ui" })}
    ${item(S.theme === "dark" ? "moon-outline" : "sunny-outline", "Thème", S.theme === "dark" ? "Sombre" : "Clair", { s: "settings", sub: "theme" })}
    ${item("extension-puzzle-outline", "Extension navigateur", "Relier ce navigateur à l'extension", { s: "settings", sub: "extension" })}
    <div class="caps" style="margin:16px 0 4px">Aide</div>
    ${item("bulb-outline", "Demandes de fonctionnalités", "Tableau de suggestions", null)}
    ${item("bug-outline", "Signaler un bug", "Avec une pièce jointe si besoin", { modal: "bug" })}
    <div class="caps" style="margin:16px 0 4px">Compte</div>
    ${item("log-out-outline", "Se déconnecter", "Sur ce navigateur uniquement", { modal: "signout" })}
    ${item("trash-outline", "Supprimer mon compte", "Définitif, avec tout ce que vous avez enregistré", { s: "settings", sub: "delete" }, true)}
    <p class="small muted" style="margin-top:16px">Confidentialité · Conditions d'utilisation · Deepn par Second Brain Labs</p></div>`;
}
function settingsBody() {
  const sub = S.sub || "reading";
  if (sub === "theme") return `<h1 class="display">Thème</h1><p class="subtle">L'apparence de Deepn. Le choix reste sur ce navigateur.</p>${["Suivre l'appareil", "Clair", "Sombre"].map((t, i) => `<button class="frow" style="min-height:48px" ${i ? goAttr({ theme: i === 2 ? "dark" : "light" }) : ""}>${icon(i === 2 ? "moon-outline" : "sunny-outline", "s18")}<span class="grow">${t}</span>${(i === 2) === (S.theme === "dark") && i ? icon("checkmark") : ""}</button>`).join("")}`;
  if (sub === "ui") return `<h1 class="display">Langue de l'app</h1><p class="subtle">La langue de l'interface. La langue de vos résumés et textes est la langue de lecture, réglée à part.</p><button class="frow on" style="min-height:48px">Suivre le navigateur ${icon("checkmark")}</button>${READING_LANGUAGES.map((l) => `<button class="frow" style="min-height:44px">${l}</button>`).join("")}`;
  if (sub === "extension") return `<h1 class="display">Extension navigateur</h1><p class="subtle">Enregistrez la page que vous lisez en un clic. L'extension se relie à votre compte depuis cette page.</p><div class="card" style="padding:20px;display:flex;gap:20px;align-items:center"><div class="display" style="letter-spacing:6px">482 913</div><div class="small subtle">Saisissez ce code dans l'extension. Il expire dans 10 minutes.</div></div><div class="caps" style="margin:20px 0 6px">Navigateurs reliés</div><div class="frow">${icon("globe-outline", "s18")}<span class="grow">Chrome sur MacBook · relié le 3 oct.</span><button class="btn ghost">Délier</button></div>`;
  if (sub === "delete") return `<h1 class="display">Supprimer le compte</h1><div class="banner err" style="margin:12px 0">${icon("alert-circle-outline", "s16")} Cette action est irréversible.</div><p>La suppression efface définitivement votre compte et tout ce que vous avez enregistré : bibliothèque et dossiers, textes, résumés, notes, flashcards, quiz, conversations, digests, index de recherche, adresse e-mail.</p><div class="callout"><b>Votre abonnement</b><div class="small">Supprimer le compte n'annule pas un abonnement pris sur l'App Store, Google Play ou le web : annulez-le d'abord.</div></div><label class="row" style="margin:16px 0"><input type="checkbox"> Je comprends que mon compte et toutes mes données seront effacés.</label><button class="btn danger">Supprimer mon compte</button>`;
  return `<h1 class="display">Langue de lecture</h1><p class="subtle">La langue dans laquelle vos textes et résumés sont écrits. Vous pouvez la changer une fois par mois.</p><div class="banner" style="margin-bottom:12px">${icon("calendar-outline", "s16")} Prochain changement possible le 3 novembre 2026.</div>${READING_LANGUAGES.map((l, i) => `<button class="frow ${i === 0 ? "on" : ""}" style="min-height:44px">${l}${i === 0 ? `<span class="grow"></span>${icon("checkmark")}` : ""}</button>`).join("")}`;
}
function paywallBody() {
  return `<div style="max-width:760px"><h1 class="display">Choisir un forfait</h1><p class="subtle">Chaque forfait fait tout. Ils ne diffèrent que par la quantité envoyée.</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0">${[["S", "600 min", "4,99 €"], ["M", "2 400 min", "9,99 €"], ["L", "6 000 min", "19,99 €"]].map(([n, a, p], i) => `<div class="card" style="padding:16px;${i === 1 ? "box-shadow:inset 0 0 0 2px var(--primary)" : ""}">${i === 1 ? `<span class="chip on">Recommandé pour vous</span>` : ""}<div class="headline" style="margin-top:8px">${n}</div><div class="small subtle">${a} par mois</div><div class="display" style="margin-top:8px">${p}<span class="small muted">/mois</span></div></div>`).join("")}</div>
    <button class="btn primary">Commencer avec M — 9,99 €/mois</button><p class="small muted">Paiement par Stripe, rattaché à votre compte via RevenueCat. Un abonnement pris sur l'App Store ou Google Play se gère dans ce store. Résiliable à tout moment. Conditions · Confidentialité</p></div>`;
}
function loginBody(register = false) {
  return `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px"><div class="card" style="width:min(400px,100%);padding:32px"><div class="row" style="margin-bottom:24px"><div class="icon-btn" style="background:var(--primary);color:var(--on-primary)">${icon("layers-outline")}</div><b class="headline">Deepn</b></div>
    <h1 class="display">${register ? "Créer un compte" : "Bon retour"}</h1><p class="subtle" style="margin-top:4px">${register ? "Commencez votre bibliothèque de connaissances." : "Connectez-vous pour retrouver votre bibliothèque."}</p>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px"><button class="btn tonal">Continuer avec Google</button><button class="btn tonal">Se connecter avec Apple</button><div class="small muted" style="text-align:center">ou</div>
    <label class="field"><input placeholder="vous@exemple.fr" aria-label="E-mail"></label><label class="field"><input type="password" placeholder="${register ? "Au moins 8 caractères" : "Votre mot de passe"}" aria-label="Mot de passe"></label>
    <button class="btn primary" ${goAttr({ s: register ? "onboarding" : "home" })}>${register ? "Créer le compte" : "Se connecter"}</button></div>
    <p class="small subtle" style="text-align:center;margin-top:16px">${register ? `Déjà un compte ? <a href="#" ${goAttr({ s: "login" })}>Se connecter</a>` : `Pas de compte ? <a href="#" ${goAttr({ s: "register" })}>Créer un compte</a>`}</p></div></div>`;
}
function onboardingBody() {
  return `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px"><div class="card" style="width:min(480px,100%);padding:32px"><h1 class="display">Choisissez votre langue de lecture</h1><p class="subtle">Les contenus seront traduits dans cette langue si besoin.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:16px 0">${READING_LANGUAGES.map((l, i) => `<button class="frow ${i === 0 ? "on" : ""}">${l}</button>`).join("")}</div><button class="btn primary" style="width:100%" ${goAttr({ s: "home" })}>Continuer</button></div></div>`;
}

// ---------------------------------------------------------------- shared dialogs

function modalShell(title, body, footer = "", { wide = false } = {}) {
  return `<div class="scrim" ${goAttr({ modal: null })}><div class="modal" style="${wide ? "width:min(760px,calc(100vw - 32px))" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}" onclick="event.stopPropagation()">
    <header><h2 class="headline grow">${title}</h2><button class="icon-btn" aria-label="Fermer" ${goAttr({ modal: null })}>${icon("close")}</button></header><div class="body">${body}</div>${footer ? `<footer>${footer}</footer>` : ""}</div></div>`;
}
function addDialog() {
  if (S.modal === "add2") return modalShell("Votre média est en cours d'enregistrement", `<p style="margin-top:0">L'import a commencé : vous pouvez fermer cette fenêtre. Voulez-vous aussi le ranger dans un dossier ?</p>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Non, le laisser dans Non classés</button><button class="btn primary" ${goAttr({ modal: "move", target: "m10" })}>Choisir un dossier</button>`);
  return modalShell("Ajouter à votre bibliothèque", `
    <label class="field" style="border-radius:var(--r-md)">${icon("link-outline", "s18")}<input placeholder="Coller un lien — article, vidéo, épisode de podcast" value="https://www.youtube.com/watch?v=…" aria-label="Lien"></label>
    <p class="small muted" style="margin:6px 4px 16px">Le traitement commence dès l'ajout. Vous choisissez le dossier ensuite.</p>
    <div style="border:2px dashed var(--outline-variant);border-radius:var(--r-lg);padding:24px;text-align:center">${icon("cloud-upload-outline", "s24")}<div class="label" style="margin-top:6px">Déposer des fichiers ici, ou <u>parcourir</u></div><div class="small muted">PDF, documents Office, images, fichiers audio · 1 fichier par import</div></div>
    <p class="small muted" style="margin:12px 4px 0">Astuce : déposez un fichier n'importe où dans Deepn, ou collez un lien avec ⌘V hors d'un champ de saisie.</p>`,
    `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary" ${goAttr({ modal: "add2" })}>Ajouter</button>`);
}
function sharedModal() {
  const m = S.modal;
  if (!m) return "";
  if (m === "add" || m === "add2") return addDialog();
  if (m === "move" || m === "pick") return DIR.destinationPicker();
  if (m === "palette" && DIR.palette) return DIR.palette();
  if (m === "rename") return modalShell("Renommer ce dossier", `<label class="field" style="border-radius:var(--r-md)"><input value="${esc(curFolder().name)}" aria-label="Nom du dossier"></label><p class="small muted">255 caractères au plus.</p>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary">Enregistrer</button>`);
  if (m === "newfolder") return modalShell("Nouveau dossier", `<div class="small muted" style="margin-bottom:6px">Dans : ${esc(S.f ? pathText(curFolder()) : "Bibliothèque (racine)")}</div><label class="field" style="border-radius:var(--r-md)"><input placeholder="Nom du dossier" aria-label="Nom du dossier"></label>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary">Créer</button>`);
  if (m === "delete") { const f = curFolder(); const n = descendantCount(f); return modalShell("Supprimer ce dossier ?", `<p style="margin-top:0">« ${esc(f.name)} » sera supprimé. Toutes ses sources vont dans Non classés — aucune n'est supprimée.${n ? ` Ses ${n} sous-dossiers sont supprimés aussi, et leurs sources vont dans Non classés.` : ""}</p>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn danger">Supprimer</button>`); }
  if (m === "renamemedia") return modalShell("Renommer cette source", `<label class="field" style="border-radius:var(--r-md)"><input value="${esc(curMedia().title)}" aria-label="Nom de la source"></label>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary">Enregistrer</button>`);
  if (m === "deletemedia") return modalShell("Supprimer cette source ?", `<p style="margin-top:0">« ${esc(curMedia().title)} » sera retirée de votre bibliothèque. Cette action est irréversible.</p>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn danger">Supprimer</button>`);
  if (m === "signout") return modalShell("Se déconnecter ?", `<p style="margin-top:0">Vous serez déconnecté de ce navigateur. Les autres appareils restent connectés.</p>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary" ${goAttr({ s: "login", modal: null })}>Oui, me déconnecter</button>`);
  if (m === "bug") return modalShell("Signaler un bug", `<label class="small subtle">Sujet</label><label class="field" style="border-radius:var(--r-md);margin:4px 0 12px"><input placeholder="Résumé du problème"></label><label class="small subtle">Description</label><textarea style="width:100%;min-height:120px;border:0;border-radius:var(--r-md);background:var(--surface-container);padding:12px;margin-top:4px" placeholder="Étapes, ce que vous attendiez, ce qui s'est passé…"></textarea><div class="row" style="margin-top:12px"><button class="btn tonal">${icon("cloud-upload-outline", "s16")} Joindre un fichier</button><span class="small muted">Image, vidéo, PDF ou ZIP — 25 Mo au plus</span></div>`, `<button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary">Envoyer</button>`);
  return "";
}
function contextMenu() {
  if (!UI.menu) return "";
  const { kind, x, y } = UI.menu;
  const rows = kind === "media"
    ? [["folder-outline", "Ranger dans un dossier…", { modal: "move", target: UI.menu.id }], ["create-outline", "Renommer", { modal: "renamemedia", m: UI.menu.id }], ["trash-outline", "Supprimer", { modal: "deletemedia", m: UI.menu.id }, true]]
    : [["create-outline", "Renommer", { modal: "rename", f: UI.menu.id }], ["swap-horizontal-outline", "Déplacer le dossier…", { modal: "move", target: "folder:" + UI.menu.id }], ["add", "Nouveau sous-dossier", { modal: "newfolder", f: UI.menu.id }], [UI.pins.has(UI.menu.id) ? "pin" : "pin-outline", UI.pins.has(UI.menu.id) ? "Désépingler" : "Épingler", null], ["trash-outline", "Supprimer", { modal: "delete", f: UI.menu.id }, true]];
  return `<div class="menu" style="left:${x}px;top:${y}px" role="menu">${rows.map(([ic, l, p, d]) => `<button role="menuitem" class="${d ? "danger" : ""}" ${p ? goAttr(p) : `data-act="pin:${UI.menu.id}"`}>${icon(ic, "s18")}${l}</button>`).join("")}</div>`;
}
function toast() {
  return S.toast ? `<div class="toast">${esc(S.toast)}<button style="color:var(--primary);font-weight:600" ${goAttr({ toast: null })}>Annuler</button></div>` : "";
}

// ---------------------------------------------------------------- walkthrough index

function walkthroughs() {
  const c = C();
  const mem = c.memory, leaf = c.leafMemory || mem;
  const L = (label, patch) => `<a href="${hashOf({ ...DEFAULTS, ...patch })}">${label}</a>`;
  return `<div id="walk"><button data-act="walk">Parcours de la maquette</button>${UI.walk ? `<div class="panel" onclick="event.stopPropagation()">
    <h4>Corpus</h4>${L("Petite bibliothèque (7 dossiers)", { s: "library", corpus: "small" })}${L("Référence : 295 dossiers, 3 niveaux, homonymes", { s: "library" })}${L("1 018 dossiers", { s: "library", corpus: "xl" })}
    <h4>Dossiers</h4>${L("Retrouver « Notes de lecture » peu utilisé (homonyme)", { s: "library", q: "notes lecture" })}${L("Dossier actif et son chemin", { s: "folder", f: leaf.id, tab: "sources" })}${L("Choisir une destination (déplacer)", { s: "media", m: "m11", modal: "move", target: "m11" })}${L("Créer un dossier", { s: "folder", f: mem.id, tab: "sources", modal: "newfolder" })}${L("Renommer un dossier", { s: "folder", f: mem.id, tab: "sources", modal: "rename" })}${L("Supprimer un dossier", { s: "folder", f: mem.id, tab: "sources", modal: "delete" })}${DIR.extraWalks ? DIR.extraWalks(L) : ""}
    <h4>Chat (portées média et dossier)</h4>${L("Média · composeur au repos (Lecture)", { s: "media", m: "m1", tab: "reader" })}${L("Média · envoi", { s: "media", m: "m1", tab: "reader", chat: "open", cs: "sending" })}${L("Média · réponse en streaming", { s: "media", m: "m1", tab: "reader", chat: "open", cs: "streaming" })}${L("Média · arrêt volontaire", { s: "media", m: "m1", tab: "reader", chat: "open", cs: "stopped" })}${L("Média · échec partiel", { s: "media", m: "m1", tab: "reader", chat: "open", cs: "failed" })}${L("Média · reprise après rechargement", { s: "media", m: "m1", tab: "reader", chat: "open", cs: "resuming" })}${L("Média · historique des conversations", { s: "media", m: "m1", tab: "reader", chat: "open", cs: "history" })}${L("Dossier · conversation (Sources)", { s: "folder", f: mem.id, tab: "sources", chat: "open", cs: "streaming" })}${L("Dossier · plafond de contexte refusé", { s: "folder", f: c.roots[0].id, tab: "sources", chat: "open", cs: "refused" })}${L("Dossier · minutes épuisées", { s: "folder", f: mem.id, tab: "sources", chat: "open", cs: "quota" })}${L("Onglet IA : pas de composeur", { s: "media", m: "m1", tab: "ai" })}
    <h4>Média</h4>${L("Lecture : L'essentiel, texte, traduction", { s: "media", m: "m1", tab: "reader" })}${L("IA : générer, historique", { s: "media", m: "m1", tab: "ai" })}${L("Artefact : résumé", { s: "artifact", art: "summaryShort" })}${L("Artefact : flashcards", { s: "artifact", art: "flashcards" })}${L("Artefact : quiz", { s: "artifact", art: "quiz" })}${L("En cours de traitement", { s: "media", m: "m10", tab: "reader" })}${L("Échec + demander la source", { s: "media", m: "m12", tab: "reader" })}${L("Renommer la source", { s: "media", m: "m1", modal: "renamemedia" })}${L("Supprimer la source", { s: "media", m: "m1", modal: "deletemedia" })}
    <h4>Dossier</h4>${L("Sources (sous-dossiers puis médias)", { s: "folder", f: mem.id, tab: "sources" })}${L("IA du dossier", { s: "folder", f: mem.id, tab: "ai" })}${L("Non classés", { s: "folder", f: "f0", tab: "sources" })}
    <h4>Autres</h4>${L("Accueil", { s: "home" })}${L("Ajouter (lien, fichier)", { s: "home", modal: "add" })}${L("Ajouter → ranger ?", { s: "home", modal: "add2" })}${L("Tri des non classés", { s: "unsorted", pos: "1" })}${L("Digest quotidien", { s: "digest" })}${L("Digest hebdomadaire", { s: "digest", dp: "weekly", dpos: "2" })}${L("Recherche plein texte", { s: "search", sq: "pause" })}${L("Compte (bêta)", { s: "account" })}${L("Compte (après la bêta)", { s: "account", beta: "0" })}${L("Abonnement web (après la bêta)", { s: "paywall", beta: "0" })}${L("Langue de lecture", { s: "settings", sub: "reading" })}${L("Langue de l'app", { s: "settings", sub: "ui" })}${L("Thème", { s: "settings", sub: "theme" })}${L("Extension : relier ce navigateur", { s: "settings", sub: "extension" })}${L("Signaler un bug", { s: "account", modal: "bug" })}${L("Se déconnecter", { s: "account", modal: "signout" })}${L("Supprimer le compte", { s: "settings", sub: "delete" })}${L("Connexion", { s: "login" })}${L("Inscription", { s: "register" })}${L("Langue à l'inscription", { s: "onboarding" })}${L("Thème sombre", { s: "media", m: "m1", tab: "reader", theme: "dark" })}
  </div>` : ""}</div>`;
}
ACTS.walk = () => { UI.walk = !UI.walk; render(); };

// ---------------------------------------------------------------- render

function render() {
  document.documentElement.dataset.theme = S.theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("shot", S.shot === "1");
  let html;
  if (S.s === "login") html = loginBody(false);
  else if (S.s === "register") html = loginBody(true);
  else if (S.s === "onboarding") html = onboardingBody();
  else html = DIR.shell();
  $("#app").innerHTML = html + sharedModal() + contextMenu() + toast() + walkthroughs();
  DIR.after?.();
  // A conversation opens on its latest message, where the state of the answer is.
  document.querySelectorAll(".thread").forEach((th) => { const sc = th.closest(".scroll"); if (sc) sc.scrollTop = sc.scrollHeight; });
}
function boot() {
  document.body.insertAdjacentHTML("afterbegin", ICON_SPRITE);
  S = parseHash();
  // Expand the branch of the active folder, the way every direction reveals it.
  const f = C().byId.get(S.f);
  if (f) folderPath(C(), f).forEach((p) => UI.expanded.add(p.id));
  render();
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); go({ modal: DIR.palette ? "palette" : "pick" }); }
    if (e.key === "Escape" && S.modal) go({ modal: null });
    DIR.onKey?.(e);
  });
}
