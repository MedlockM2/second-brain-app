// Direction E — « Les onglets de travail ». A place is never lost because every place is
// a tab: each folder or media opened stays open, with its scroll, its tab (Sources / IA,
// Lecture / IA) and its conversation, like a browser or an IDE. The library's map is a
// table of contents — roots down the side, two levels laid out in the page — rather than
// a tree to unfold. The conversation opens as a split view inside its tab.

const DIR = {
  id: "e",
  name: "Les onglets de travail",
  shell() {
    return `<div class="E">${topbar()}${tabstrip()}<div class="E-body">${body()}</div></div>`;
  },
  destinationPicker() {
    const isFolder = (S.target || "").startsWith("folder:");
    const sel = C().byId.get(S.dest) || C().leafMemory || C().memory;
    const root = folderPath(C(), sel)[0];
    const body = `<label class="field">${icon("search-outline", "s18")}<input placeholder="Filtrer le sommaire" aria-label="Filtrer"></label>
      <div class="E-pick"><nav class="scroll">${C().roots.map((r) => `<button class="frow ${r === root ? "on" : ""}" ${goAttr({ dest: r.id })}><span class="ell grow">${esc(r.name)}</span><span class="count">${descendantCount(r)}</span></button>`).join("")}</nav>
      <div class="scroll" style="padding:4px 8px">${outlineSection(root, { picker: true, sel })}</div></div>`;
    return modalShell(isFolder ? "Déplacer le dossier vers…" : "Ranger dans un dossier", body,
      `<div class="grow small subtle ell" style="align-self:center">Destination : <b>${esc(pathText(sel))}</b></div><button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary" ${goAttr({ modal: null, toast: `Rangé dans « ${sel.name} »` })}>Ranger ici</button>`, { wide: true });
  },
  extraWalks: (L) => L("Sommaire filtré", { s: "library", oq: "notes" }) + L("Sélecteur d'onglets (mobile)", { s: "folder", f: corpus("ref").memory.id, ts: "1" }),
};

const TABS = () => [
  { key: "index", label: "Sommaire", ic: "list-outline", patch: { s: "library", f: null, m: null } },
  { key: "f:" + C().memory.id, label: "Mémoire de travail", ic: "folder-outline", patch: { s: "folder", f: C().memory.id, tab: "sources" } },
  { key: "m:m1", label: "Comment l'attention se fatigue — et comment la reposer", ic: "headset-outline", patch: { s: "media", m: "m1", tab: "reader" }, busy: true },
  { key: "f:" + (C().leafMemory || C().memory).id, label: "Notes de lecture", sub: "Mémoire de travail", ic: "folder-outline", patch: { s: "folder", f: (C().leafMemory || C().memory).id, tab: "sources" } },
  { key: "m:m6", label: "La charge mentale des open spaces, mesurée", ic: "headset-outline", patch: { s: "media", m: "m6", tab: "reader" } },
];
function activeKey() {
  if (S.s === "library") return "index";
  if (S.s === "folder") return "f:" + S.f;
  if (S.s === "media") return "m:" + (S.m || "m1");
  return S.s;
}
function topbar() {
  const it = (ic, l, p, on, extra = "") => `<button class="E-nav ${on ? "on" : ""}" ${goAttr(p)}>${icon(ic, "s18")}<span>${l}</span>${extra}</button>`;
  return `<header class="E-top"><div class="icon-btn" style="background:var(--primary);color:var(--on-primary);width:30px;height:30px">${icon("layers-outline", "s16")}</div><b class="label E-brand" style="font-family:var(--font-head);font-size:16px">Deepn</b>
    <nav class="row E-navs" style="gap:2px;margin-left:12px">${it("home-outline", "Accueil", { s: "home" }, S.s === "home")}${it("newspaper-outline", "Digest", { s: "digest" }, S.s === "digest")}${it("file-tray-outline", "Non classés", { s: "unsorted", pos: "1" }, S.s === "unsorted", `<span class="count">12</span>`)}</nav>
    <span class="grow"></span><label class="field E-search" style="width:320px;min-height:34px">${icon("search-outline", "s16")}<input placeholder="Rechercher dans le texte" aria-label="Rechercher" ${goAttr({ s: "search", sq: "pause" })}></label>
    <button class="btn primary" style="min-height:34px" ${goAttr({ modal: "add" })}>${icon("add", "s18")}<span class="E-addl">Ajouter</span></button>
    <button class="icon-btn" style="width:34px;height:34px" data-act="theme" aria-label="Changer de thème">${icon(S.theme === "dark" ? "sunny-outline" : "moon-outline", "s18")}</button>
    <button class="icon-btn" style="width:34px;height:34px;background:var(--surface-container)" aria-label="Compte" ${goAttr({ s: "account" })}>${icon("person-outline", "s18")}</button></header>`;
}
function tabstrip() {
  const k = activeKey();
  const tabs = TABS();
  const cur = tabs.find((t) => t.key === k);
  return `<div class="E-strip" role="tablist" aria-label="Onglets ouverts">${tabs.map((t) => `<div class="E-tab ${t.key === k ? "on" : ""}" role="tab" aria-selected="${t.key === k}" title="${esc(t.label)}${t.sub ? " — " + esc(t.sub) : ""}"><button class="row grow" style="min-width:0;gap:6px" ${goAttr({ ...t.patch, chat: "off", cs: "idle" })}>${icon(t.ic, "s16")}<span class="ell">${esc(t.label)}</span>${t.sub ? `<span class="small muted ell E-tabsub">${esc(t.sub)}</span>` : ""}${t.busy ? `<span class="E-dot" title="Une réponse s'écrit dans cet onglet"></span>` : ""}</button>${t.key === "index" ? "" : `<button class="E-x" aria-label="Fermer l'onglet">${icon("close", "s14")}</button>`}</div>`).join("")}
    <button class="icon-btn E-new" style="width:30px;height:30px" title="Nouvel onglet (⌘T) : ouvrir un dossier ou un média" aria-label="Nouvel onglet" ${goAttr({ modal: "pick" })}>${icon("add", "s18")}</button>
    <button class="E-switch" ${goAttr({ ts: S.ts === "1" ? null : "1" })} aria-label="${tabs.length} onglets ouverts">${icon(cur ? cur.ic : "list-outline", "s16")}<span class="ell">${esc(cur ? cur.label : "Deepn")}</span><span class="E-n">${tabs.length}</span></button></div>
    ${S.ts === "1" ? `<div class="E-switcher">${tabs.map((t) => `<button class="card ${t.key === k ? "on" : ""}" ${goAttr({ ...t.patch, ts: null })}>${icon(t.ic, "s18")}<span class="label clamp2">${esc(t.label)}</span>${t.sub ? `<span class="small muted">${esc(t.sub)}</span>` : ""}</button>`).join("")}<button class="card" ${goAttr({ modal: "pick", ts: null })}>${icon("add", "s18")}<span class="label">Nouvel onglet</span></button></div>` : ""}`;
}
function body() {
  const page = (x, w = 880) => `<div class="scroll" style="height:100%"><div style="max-width:${w}px;margin:0 auto;padding:24px 32px 80px">${x}</div></div>`;
  switch (S.s) {
    case "home": return page(`<h1 class="display" style="margin-bottom:20px">Accueil</h1>${homeBody()}`, 1100);
    case "library": return outline();
    case "folder": return splitView("folder");
    case "media": return splitView("media");
    case "artifact": return page(artifactView(S.art));
    case "digest": return page(`<h1 class="display" style="margin-bottom:16px">Digest</h1>${digestBody()}`, 1000);
    case "search": return page(`<h1 class="display" style="margin-bottom:12px">« ${esc(S.sq || "pause")} »</h1>${searchBody()}`);
    case "unsorted": return page(unsortedBody());
    case "account": return page(accountBody(), 640);
    case "settings": return page(settingsBody(), 640);
    case "paywall": return page(paywallBody());
  }
  return "";
}
// One root as a section: its children as rows, their children as wrapped chips.
function outlineSection(r, { picker = false, sel = null, q = "" } = {}) {
  const link = (f) => picker ? goAttr({ dest: f.id }) : goAttr({ s: "folder", f: f.id, tab: "sources" });
  const show = (f) => !q || fold(pathText(f)).includes(fold(q)) || f.children.some((c) => fold(c.name).includes(fold(q)));
  return `<section class="E-sec" id="r${r.id}"><button class="row E-root ${sel === r ? "sel" : ""}" ${link(r)}><h2 class="headline grow" style="overflow-wrap:anywhere;text-align:left">${q ? hl(r.name, q) : esc(r.name)}</h2><span class="count">${r.count} sources · ${descendantCount(r)} dossiers</span></button>
    ${r.children.filter(show).map((c) => `<div class="E-child"><button class="row E-cname ${sel === c ? "sel" : ""}" ${link(c)} title="${esc(pathText(c))}">${icon("folder-outline", "s16")}<span class="grow" style="min-width:0;text-align:left;overflow-wrap:anywhere">${q ? hl(c.name, q) : esc(c.name)}</span><span class="count">${c.count}</span></button>
      ${c.children.length ? `<div class="E-leaves">${c.children.map((g) => `<button class="chip ${sel === g ? "on" : ""} ${q && fold(g.name).includes(fold(q)) ? "E-hit" : ""}" ${link(g)} title="${esc(pathText(g))}">${q ? hl(g.name, q) : esc(g.name)} <span class="muted">${g.count}</span></button>`).join("")}</div>` : ""}</div>`).join("")}</section>`;
}
function outline() {
  const q = S.oq || "";
  const roots = q ? C().roots.filter((r) => fold(r.name).includes(fold(q)) || descendantsMatch(r, q)) : C().roots;
  const focus = C().byId.get(S.or) || C().roots.find((r) => r.name.startsWith("Neuro")) || C().roots[0];
  return `<div class="E-outline"><nav class="E-toc scroll" aria-label="Sommaire"><div class="caps" style="padding:4px 10px 8px">${C().roots.length} dossiers racines</div>${C().roots.map((r) => `<a href="#" class="${r === focus && !q ? "on" : ""} ${q && !roots.includes(r) ? "dim" : ""}" ${goAttr({ or: r.id })}><span class="ell grow">${esc(r.name)}</span><span class="count">${descendantCount(r)}</span></a>`).join("")}
      <div class="divider" style="margin:10px 0"></div><a href="#" ${goAttr({ s: "folder", f: "f0" })}>${icon("file-tray-outline", "s16")}<span class="grow">Non classés</span><span class="count">12</span></a></nav>
    <div class="scroll E-sections"><div class="row" style="margin-bottom:12px;gap:12px"><div class="grow"><h1 class="display">Sommaire</h1><div class="subtle">${C().folders.length} dossiers. Les racines à gauche, deux niveaux dans la page : on parcourt, rien n'est à déplier.</div></div>
      <label class="field" style="width:320px">${icon("filter-outline", "s18")}<input value="${esc(q)}" placeholder="Filtrer le sommaire" aria-label="Filtrer le sommaire"></label><button class="btn tonal" ${goAttr({ modal: "newfolder", f: null })}>${icon("add", "s16")} Dossier</button></div>
      ${q ? `<div class="small muted" style="margin-bottom:8px">${searchFolders(C(), q, 999).length} dossiers correspondent dans ${roots.length} racines · ⌘-clic pour ouvrir dans un nouvel onglet</div>` : ""}
      ${(q ? roots : [focus, ...C().roots.filter((r) => r !== focus)]).map((r) => outlineSection(r, { q, sel: C().byId.get(S.f) })).join("")}</div></div>`;
}
function descendantsMatch(f, q) { return f.children.some((c) => fold(c.name).includes(fold(q)) || descendantsMatch(c, q)); }
function splitView(kind) {
  const scope = chatScope();
  const open = scope && S.chat === "open";
  const main = kind === "folder" ? folderMain() : mediaMain();
  return `<div class="E-split ${open ? "open" : ""}"><section class="E-pane">${main}${scope ? `<div class="E-composer">${composer(scope)}</div>` : ""}</section>
    ${open ? `<div class="E-divider" title="Faire glisser pour redimensionner"></div><aside class="E-pane E-chat">${chatHeader(scope)}<div class="scroll grow" style="margin-top:10px">${thread(scope)}</div></aside>` : ""}</div>`;
}
function folderMain() {
  const f = S.f === "f0" ? C().unsorted : curFolder();
  const t = S.tab || "sources";
  const src = sourcesOf(C(), f);
  return `<div class="scroll" style="height:100%;padding:16px 32px 110px"><div style="max-width:860px;margin:0 auto">${f.isDefault ? "" : crumbs(f, { onlyParents: true, root: "Sommaire" })}
    <div class="row" style="align-items:flex-start;margin-top:4px"><h1 class="display grow" style="overflow-wrap:anywhere">${esc(f.name)}</h1>${f.isDefault ? "" : `<button class="icon-btn" data-act="menu:folder:${f.id}" aria-label="Actions pour ce dossier">${icon("ellipsis-horizontal")}</button>`}</div>
    <div class="seg" style="margin:12px 0 16px"><button class="${t === "sources" ? "on" : ""}" ${goAttr({ tab: "sources" })}>${icon("layers-outline", "s16")} Sources</button><button class="${t === "ai" ? "on" : ""}" ${goAttr({ tab: "ai", chat: "off" })}>${icon("sparkles-outline", "s16")} IA</button></div>
    ${t === "ai" ? aiPanel("folder") : `${f.children.length ? `<div class="E-leaves" style="margin:0 0 16px">${f.children.map((c) => `<button class="chip" style="height:34px" ${goAttr({ s: "folder", f: c.id })}>${icon("folder-outline", "s14")}${esc(c.name)} <span class="muted">${c.count}</span></button>`).join("")}</div>` : ""}<div class="caps" style="margin-bottom:6px">Sources · ${src.length}</div>${src.map((m) => mediaRow(m)).join("") || `<p class="muted">Ce dossier est vide.</p>`}`}</div></div>`;
}
function mediaMain() {
  const m = curMedia();
  const t = S.tab || "reader";
  return `<div class="scroll" style="height:100%;padding:16px 32px 110px"><div style="max-width:720px;margin:0 auto">${mediaHero(m, { height: 180 })}<div style="margin:12px 0 16px">${metaLine(m)}</div>${mediaTabs(m)}<div style="margin-top:16px">${mediaStateBody(m) || (t === "ai" ? aiPanel("media") : previewBlock() + readerText({ cited: S.chat === "open" ? [5, 8] : [] }))}</div></div></div>`;
}
