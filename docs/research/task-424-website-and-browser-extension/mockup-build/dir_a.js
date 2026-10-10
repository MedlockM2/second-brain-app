// Direction A — « L'arbre latéral ». The hierarchy is always on screen: a filterable
// tree in a left rail, the content in the middle, the conversation in a right pane.
// Reference: the sidebar of file managers and note apps (Finder, VS Code, Notion,
// Obsidian); keyboard model: WAI-ARIA treeview.

const DIR = {
  id: "a",
  name: "L'arbre latéral",
  shell() {
    const scope = chatScope();
    const chatOpen = scope && S.chat === "open";
    return `<div class="A ${chatOpen ? "with-chat" : ""} ${S.drawer === "1" ? "drawer" : ""}">
      ${sidebar()}
      <div class="A-scrim" ${goAttr({ drawer: null })}></div>
      <main class="A-main">${topbar()}<div class="A-content scroll" id="content">${content()}</div>${scope ? `<div class="A-composer">${composer(scope)}</div>` : ""}</main>
      ${chatOpen ? `<aside class="A-chat" aria-label="Discussion">${chatHeader(scope)}<div class="scroll grow" style="margin-top:12px">${thread(scope)}</div><div class="small muted" style="margin-top:8px">${icon("return-down-forward-outline", "s14")} Les citations surlignent le passage ou ouvrent la source.</div></aside>` : ""}
    </div>`;
  },
  destinationPicker() {
    const q = S.pq || "";
    const target = S.target || "";
    const isFolder = target.startsWith("folder:");
    const hits = q ? searchFolders(C(), q, 40) : null;
    const sel = C().byId.get(S.dest) || C().leafMemory || C().memory;
    const body = `<label class="field">${icon("search-outline", "s18")}<input value="${esc(q)}" placeholder="Filtrer les dossiers" aria-label="Filtrer les dossiers"></label>
      ${q ? `<div class="small muted" style="margin:8px 4px">${hits.length} dossiers correspondent · le chemin départage les homonymes</div>${hits.slice(0, 9).map((f) => `<button class="frow ${f === sel ? "on" : ""}" ${goAttr({ dest: f.id })}>${icon("folder-outline", "s18")}<span class="grow" style="min-width:0"><span class="ell" style="display:block">${hl(f.name, q)}</span><span class="path ell" style="display:block">${esc(parentHint(f))}</span></span></button>`).join("")}`
      : `<div class="caps" style="margin:12px 4px 4px">Récents</div>${recentFolders(3).map((f) => `<button class="frow" ${goAttr({ dest: f.id })}>${icon("time-outline", "s18")}<span class="ell grow">${esc(f.name)}</span><span class="path ell" style="max-width:45%">${esc(parentHint(f))}</span></button>`).join("")}
        <div class="caps" style="margin:12px 4px 4px">Tous les dossiers</div>${isFolder ? "" : `<button class="frow">${icon("file-tray-outline", "s18")}Non classés</button>`}${treeRows({ picker: true, sel })}`}
      <button class="frow" style="margin-top:4px;color:var(--text-subtle)">${icon("add", "s18")} Nouveau dossier dans « ${esc(sel.name)} »</button>`;
    return modalShell(isFolder ? "Déplacer le dossier vers…" : "Ranger dans un dossier", body,
      `<div class="grow small subtle ell" style="align-self:center">Destination : <b>${esc(pathText(sel))}</b></div><button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary" ${goAttr({ modal: null, toast: `Rangé dans « ${sel.name} »` })}>Ranger ici</button>`);
  },
  extraWalks: (L) => L("Panneau latéral replié sur mobile (tiroir)", { s: "folder", f: corpus("ref").memory.id, tab: "sources", drawer: "1" }) + L("Épingler / menu d'un dossier", { s: "library" }),
  onKey(e) {
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $("#treefilter")?.focus(); }
  },
  after() {
    // Reveal the active folder in the full tree (the last match: pins and recents come first).
    const on = [...document.querySelectorAll(".A-tree .frow.on")].pop();
    if (on) on.scrollIntoView({ block: "center" });
  },
};
UI.pins.add(corpus("ref").memory.id);

function sidebar() {
  const q = S.q || "";
  const nav = (ic, label, patch, active, badge = "") => `<button class="frow ${active ? "on" : ""}" ${goAttr({ ...patch, drawer: null })}>${icon(ic, "s18")}<span class="grow">${label}</span>${badge}</button>`;
  const pins = [...UI.pins].map((id) => C().byId.get(id)).filter(Boolean);
  const hits = q ? searchFolders(C(), q, 400) : null;
  return `<nav class="A-side" aria-label="Navigation">
    <div class="row" style="padding:4px 4px 12px"><div class="icon-btn" style="background:var(--primary);color:var(--on-primary);width:32px;height:32px">${icon("layers-outline", "s18")}</div><b class="headline grow">Deepn</b>
      <button class="btn primary" style="min-height:34px;padding:0 12px" ${goAttr({ modal: "add" })} title="Ajouter un lien ou un fichier">${icon("add", "s18")} Ajouter</button></div>
    ${nav("home-outline", "Accueil", { s: "home" }, S.s === "home")}
    ${nav("search-outline", "Recherche", { s: "search", sq: "pause" }, S.s === "search", `<span class="kbd">⌘K</span>`)}
    ${nav("newspaper-outline", "Digest", { s: "digest" }, S.s === "digest")}
    ${nav("file-tray-outline", "Non classés", { s: "folder", f: "f0", tab: "sources" }, S.f === "f0", `<span class="count">12</span>`)}
    <div class="row" style="margin:16px 4px 6px"><span class="caps grow">Dossiers</span><span class="count">${C().folders.length}</span><button class="icon-btn" style="width:28px;height:28px" title="Nouveau dossier" aria-label="Nouveau dossier" ${goAttr({ modal: "newfolder", f: null })}>${icon("add", "s16")}</button></div>
    <label class="field" style="min-height:36px;margin-bottom:8px">${icon("filter-outline", "s16")}<input id="treefilter" value="${esc(q)}" placeholder="Filtrer les dossiers" aria-label="Filtrer les dossiers" oninput="go({q:this.value||null},{replace:true});setTimeout(()=>{const i=document.getElementById('treefilter');i.focus();i.setSelectionRange(i.value.length,i.value.length)})">${q ? `<button ${goAttr({ q: null })} aria-label="Effacer le filtre">${icon("close", "s16")}</button>` : `<span class="kbd">/</span>`}</label>
    <div class="A-tree scroll grow" role="tree" aria-label="Dossiers">
      ${q ? `<div class="small muted" style="padding:2px 8px 6px">${hits.length} dossiers correspondent · branches ouvertes sur les résultats</div>${filteredTree(hits, q)}`
        : `${pins.length ? `<div class="caps" style="padding:4px 8px">Épinglés</div>${pins.map((f) => treeRow(f, 0, { flat: true })).join("")}` : ""}
           <div class="caps" style="padding:10px 8px 4px">Récents</div>${recentFolders(3).map((f) => treeRow(f, 0, { flat: true })).join("")}
           <div class="caps" style="padding:10px 8px 4px">Tous</div>${treeRows({ sel: C().byId.get(S.f) })}`}
    </div>
    <div class="divider" style="margin:8px 0"></div>
    ${nav("person-outline", "Compte", { s: "account" }, S.s === "account" || S.s === "settings")}
  </nav>`;
}
function treeRow(f, depth, { flat = false, picker = false, sel = null, q = "" } = {}) {
  const active = sel ? f === sel : f.id === S.f && (S.s === "folder");
  const open = UI.expanded.has(f.id);
  const kids = f.children.length;
  const goto = picker ? { dest: f.id } : { s: "folder", f: f.id, tab: "sources", chat: "off", drawer: null };
  return `<div class="frow tr ${active ? "on" : ""}" role="treeitem" aria-level="${depth + 1}" ${kids && !flat ? `aria-expanded="${open}"` : ""} style="padding-left:${4 + depth * 16}px" title="${esc(pathText(f))}">
    ${kids && !flat ? `<button class="tw" data-act="toggle:${f.id}" aria-label="${open ? "Replier" : "Déplier"}">${icon(open ? "chevron-down" : "chevron-forward", "s14")}</button>` : `<span class="tw"></span>`}
    <button class="row grow" style="min-width:0;height:34px" ${goAttr(goto)}>${icon(f.isDefault ? "file-tray-outline" : open && kids ? "folder-open-outline" : "folder-outline", "s16")}<span class="ell">${q ? hl(f.name, q) : esc(f.name)}</span>${flat && f.parent ? `<span class="path ell">${esc(C().byId.get(f.parent).name)}</span>` : ""}</button>
    ${picker ? "" : `<span class="count" title="${f.count} sources">${f.count}</span><button class="tw more" data-act="menu:folder:${f.id}" aria-label="Actions du dossier">${icon("ellipsis-horizontal", "s14")}</button>`}
  </div>`;
}
function treeRows(opts = {}, list = C().roots, depth = 0) {
  return list.map((f) => treeRow(f, depth, opts) + (UI.expanded.has(f.id) ? treeRows(opts, f.children, depth + 1) : "")).join("");
}
// Matches plus their ancestors, expanded: the path is what tells two « Notes de lecture » apart.
function filteredTree(hits, q) {
  const keep = new Set();
  for (const f of hits) folderPath(C(), f).forEach((p) => keep.add(p.id));
  const walk = (list, depth) => list.filter((f) => keep.has(f.id)).map((f) => treeRow(f, depth, { q }) + walk(f.children, depth + 1)).join("");
  // Under a filter every kept branch reads open.
  keep.forEach((id) => UI.expanded.add(id));
  return walk(C().roots, 0);
}
function topbar() {
  let left = "";
  if (S.s === "folder" && S.f !== "f0") left = crumbs(curFolder(), { onlyParents: true });
  else if (S.s === "media") { const f = curMedia().folder ? C().memory : C().unsorted; left = crumbs(f); }
  else if (S.s === "artifact") left = `<button class="btn ghost" onclick="history.back()">${icon("chevron-back", "s16")} Retour</button>`;
  return `<header class="A-top"><button class="icon-btn A-burger" aria-label="Ouvrir la navigation" ${goAttr({ drawer: "1" })}>${icon("menu-outline")}</button><div class="grow" style="min-width:0">${left}</div>
    <button class="icon-btn" title="Thème" aria-label="Changer de thème" data-act="theme">${icon(S.theme === "dark" ? "sunny-outline" : "moon-outline", "s18")}</button></header>`;
}
function content() {
  switch (S.s) {
    case "home": return `<h1 class="display" style="margin-bottom:20px">Accueil</h1>${homeBody()}`;
    case "library": return libraryOverview();
    case "folder": return folderPage();
    case "media": return mediaPage();
    case "artifact": return artifactView(S.art);
    case "digest": return `<h1 class="display" style="margin-bottom:16px">Digest</h1>${digestBody()}`;
    case "search": return `<label class="field" style="max-width:640px;margin-bottom:16px;min-height:48px">${icon("search-outline")}<input value="${esc(S.sq || "")}" placeholder="Rechercher dans votre bibliothèque" aria-label="Rechercher"></label>${searchBody()}`;
    case "unsorted": return unsortedBody();
    case "account": return accountBody();
    case "settings": return `<div style="max-width:640px">${settingsBody()}</div>`;
    case "paywall": return paywallBody();
  }
  return "";
}
function libraryOverview() {
  return `<h1 class="display">Bibliothèque</h1><p class="subtle" style="margin:4px 0 16px">${C().folders.length} dossiers · tous les médias, du plus récent au plus ancien. Choisissez un dossier dans l'arbre, ou filtrez-le avec <span class="kbd">/</span>.</p>
    <div class="row" style="margin-bottom:8px"><span class="caps grow">Tous les médias</span><span class="small muted">Trié par date d'ajout</span></div>
    <div style="max-width:880px">${MEDIA.map((m) => mediaRow(m)).join("")}</div>`;
}
function folderHead(f) {
  const isDefault = f.isDefault;
  const t = S.tab || "sources";
  return `<div class="row" style="align-items:flex-start;margin:4px 0 12px"><div class="grow" style="min-width:0"><h1 class="display" style="overflow-wrap:anywhere">${esc(f.name)}</h1>
      <div class="small muted">${f.count} sources${f.children.length ? ` · ${f.children.length} sous-dossiers` : ""}${homonymCount(C(), f) > 1 ? ` · ${homonymCount(C(), f) - 1} autres dossiers portent ce nom` : ""}</div></div>
      ${isDefault ? "" : `<button class="icon-btn" data-act="pin:${f.id}" title="${UI.pins.has(f.id) ? "Désépingler" : "Épingler"}" aria-label="Épingler">${icon(UI.pins.has(f.id) ? "pin" : "pin-outline", "s18")}</button><button class="icon-btn" data-act="menu:folder:${f.id}" aria-label="Actions pour ce dossier">${icon("ellipsis-horizontal")}</button>`}</div>
    <div class="seg" role="tablist" style="margin-bottom:16px"><button class="${t === "sources" ? "on" : ""}" ${goAttr({ tab: "sources" })}>${icon("layers-outline", "s16")} Sources</button><button class="${t === "ai" ? "on" : ""}" ${goAttr({ tab: "ai", chat: "off" })}>${icon("sparkles-outline", "s16")} IA</button></div>`;
}
function folderPage() {
  const f = S.f === "f0" ? C().unsorted : curFolder();
  if ((S.tab || "sources") === "ai") return folderHead(f) + `<div style="max-width:880px">${aiPanel("folder")}</div>`;
  const src = sourcesOf(C(), f);
  return folderHead(f) + `<div style="max-width:880px">
    ${f.children.length ? `<div class="caps" style="margin-bottom:6px">Dossiers</div><div class="A-sub">${f.children.map((c) => `<button class="card" style="padding:12px;text-align:left;display:flex;gap:10px;align-items:center" ${goAttr({ s: "folder", f: c.id, tab: "sources" })} title="${esc(c.name)}">${icon("folder-outline", "s24")}<span class="grow" style="min-width:0"><span class="label clamp2">${esc(c.name)}</span><span class="small muted">${c.count} sources${c.children.length ? ` · ${c.children.length} dossiers` : ""}</span></span></button>`).join("")}</div><div class="caps" style="margin:16px 0 6px">Sources · ${src.length}</div>` : ""}
    ${src.length ? src.map((m) => mediaRow(m)).join("") : `<div class="muted" style="padding:24px 0">Ce dossier est vide. Les médias que vous y rangez apparaîtront ici.</div>`}</div>`;
}
function mediaPage() {
  const m = curMedia();
  const t = S.tab || "reader";
  const state = mediaStateBody(m);
  return `<div style="max-width:760px;margin:0 auto">${mediaHero(m)}<div style="margin:12px 0 16px">${metaLine(m)}</div>${mediaTabs(m)}
    <div style="margin-top:16px">${state || (t === "ai" ? aiPanel("media") : previewBlock() + readerText({ cited: S.chat === "open" ? [2, 3] : [] }))}</div></div>`;
}
