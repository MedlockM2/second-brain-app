// Direction B — « Les colonnes ». The path *is* the layout: one column per level, left
// to right, the selected folder's page as the last column (Miller columns, the column
// view of the macOS Finder). A "Go to folder" field jumps anywhere and rebuilds the
// columns on the way. A media opens beside the list of its siblings, which is how one
// reads a folder through without losing one's place in it.

const DIR = {
  id: "b",
  name: "Les colonnes",
  shell() {
    return `<div class="B">${appbar()}<div class="B-body">${body()}</div>${mobileTabs()}</div>`;
  },
  destinationPicker() {
    const isFolder = (S.target || "").startsWith("folder:");
    const sel = C().byId.get(S.dest) || C().leafMemory || C().memory;
    const path = folderPath(C(), sel);
    const cols = [C().roots, ...path.filter((p) => p.children.length).map((p) => p.children)].slice(0, 3);
    const q = S.pq || "";
    const body = `<label class="field">${icon("search-outline", "s18")}<input value="${esc(q)}" placeholder="Aller à un dossier…" aria-label="Aller à un dossier"></label>
      <div class="B-mini">${cols.map((list, i) => `<div class="B-minicol scroll">${list.map((f) => `<button class="frow ${path[i] === f ? "on" : ""}" ${goAttr({ dest: f.id })} title="${esc(f.name)}"><span class="ell grow">${esc(f.name)}</span>${f.children.length ? icon("chevron-forward", "s14") : ""}</button>`).join("")}</div>`).join("")}</div>
      <button class="frow" style="color:var(--text-subtle)">${icon("add", "s18")} Nouveau dossier dans « ${esc(sel.name)} »</button>`;
    return modalShell(isFolder ? "Déplacer le dossier vers…" : "Ranger dans un dossier", body,
      `<div class="grow small subtle ell" style="align-self:center">Destination : <b>${esc(pathText(sel))}</b></div><button class="btn ghost" ${goAttr({ modal: null })}>Annuler</button><button class="btn primary" ${goAttr({ modal: null, toast: `Rangé dans « ${sel.name} »` })}>Ranger ici</button>`, { wide: true });
  },
  extraWalks: (L) => L("« Aller à un dossier » ouvert", { s: "folder", f: corpus("ref").memory.id, tab: "sources", q: "neuro notes" }) + L("Lire un dossier source après source", { s: "media", m: "m2", tab: "reader" }),
  onKey(e) {
    if (S.s !== "folder" || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const f = curFolder();
    if (e.key === "ArrowLeft" && f.parent) go({ f: f.parent });
    if (e.key === "ArrowRight" && f.children.length) go({ f: f.children[0].id });
    const sibs = f.parent ? C().byId.get(f.parent).children : C().roots;
    const i = sibs.indexOf(f);
    if (e.key === "ArrowDown" && sibs[i + 1]) go({ f: sibs[i + 1].id });
    if (e.key === "ArrowUp" && sibs[i - 1]) go({ f: sibs[i - 1].id });
  },
  after() {
    document.querySelectorAll(".B-col .frow.on").forEach((el) => el.scrollIntoView({ block: "nearest" }));
    const cols = $(".B-cols"); if (cols) cols.scrollLeft = cols.scrollWidth;
  },
};

function appbar() {
  const tab = (label, patch, on) => `<button class="B-tab ${on ? "on" : ""}" ${goAttr(patch)}>${label}</button>`;
  const lib = S.s === "folder" || S.s === "library" || S.s === "media" || S.s === "artifact";
  return `<header class="B-bar"><div class="row" style="gap:10px"><div class="icon-btn" style="background:var(--primary);color:var(--on-primary);width:32px;height:32px">${icon("layers-outline", "s18")}</div><b class="headline">Deepn</b></div>
    <nav class="row B-tabs" aria-label="Navigation principale">${tab("Accueil", { s: "home" }, S.s === "home")}${tab("Bibliothèque", { s: "folder", f: S.f || C().memory.id, tab: "sources" }, lib)}${tab("Digest", { s: "digest" }, S.s === "digest")}${tab("Non classés · 12", { s: "unsorted", pos: "1" }, S.s === "unsorted")}</nav>
    <span class="grow"></span><label class="field B-search" style="width:300px">${icon("search-outline", "s18")}<input placeholder="Rechercher dans le texte de vos sources" aria-label="Rechercher" ${goAttr({ s: "search", sq: "pause" })}></label>
    <button class="btn primary" ${goAttr({ modal: "add" })}>${icon("add", "s18")} Ajouter</button>
    <button class="icon-btn" data-act="theme" aria-label="Changer de thème">${icon(S.theme === "dark" ? "sunny-outline" : "moon-outline", "s18")}</button>
    <button class="icon-btn" style="background:var(--surface-container)" aria-label="Compte" ${goAttr({ s: "account" })}>${icon("person-outline", "s18")}</button></header>`;
}
function mobileTabs() {
  const t = (ic, l, p, on) => `<button class="${on ? "on" : ""}" ${goAttr(p)}>${icon(ic)}<span>${l}</span></button>`;
  return `<nav class="B-mtabs">${t("home-outline", "Accueil", { s: "home" }, S.s === "home")}${t("folder-outline", "Bibliothèque", { s: "folder", f: S.f || C().memory.id }, S.s === "folder" || S.s === "media")}${t("newspaper-outline", "Digest", { s: "digest" }, S.s === "digest")}${t("person-outline", "Compte", { s: "account" }, S.s === "account")}</nav>`;
}
function page(inner, max = 880) { return `<div class="scroll" style="height:100%;padding:24px 40px 80px"><div style="max-width:${max}px;margin:0 auto">${inner}</div></div>`; }
function body() {
  switch (S.s) {
    case "home": return page(`<h1 class="display" style="margin-bottom:20px">Accueil</h1>${homeBody()}`, 1100);
    case "library": case "folder": return columns();
    case "media": return mediaSplit();
    case "artifact": return page(`<button class="btn ghost" onclick="history.back()">${icon("chevron-back", "s16")} Retour</button>${artifactView(S.art)}`);
    case "digest": return page(`<h1 class="display" style="margin-bottom:16px">Digest</h1>${digestBody()}`, 1000);
    case "search": return page(`<h1 class="display" style="margin-bottom:12px">« ${esc(S.sq || "pause")} »</h1>${searchBody()}`);
    case "unsorted": return page(unsortedBody());
    case "account": return page(accountBody(), 640);
    case "settings": return page(settingsBody(), 640);
    case "paywall": return page(paywallBody());
  }
  return "";
}
function jumpField() {
  const q = S.q || "";
  const hits = q ? searchFolders(C(), q, 8) : [];
  return `<div class="B-jump"><label class="field" style="min-height:36px">${icon("return-down-forward-outline", "s16")}<input value="${esc(q)}" placeholder="Aller à un dossier…" aria-label="Aller à un dossier" oninput="go({q:this.value||null},{replace:true});setTimeout(()=>{const i=document.querySelector('.B-jump input');i.focus();i.setSelectionRange(i.value.length,i.value.length)})"><span class="kbd">⌘K</span></label>
    ${q ? `<div class="menu" style="left:0;right:0;top:42px;max-height:420px;overflow:auto"><div class="small muted" style="padding:4px 10px">${searchFolders(C(), q, 999).length} dossiers · Entrée pour ouvrir</div>${hits.map((f, i) => `<button class="${i === 0 ? "B-hit" : ""}" ${goAttr({ s: "folder", f: f.id, q: null, tab: "sources" })}>${icon("folder-outline", "s18")}<span class="grow" style="min-width:0"><span class="ell" style="display:block">${hl(f.name, q)}</span><span class="small muted ell" style="display:block">${esc(parentHint(f))}</span></span>${f.lastOpened > 120 ? `<span class="small muted">ouvert il y a ${Math.round(f.lastOpened / 30)} mois</span>` : ""}</button>`).join("")}</div>` : ""}</div>`;
}
function columns() {
  const f = S.f === "f0" ? C().unsorted : curFolder();
  const path = f.isDefault ? [f] : folderPath(C(), f);
  const lists = [[C().unsorted, ...C().roots], ...path.slice(0, -1).map((p) => p.children)];
  return `<div class="B-lib"><div class="B-tool">${jumpField()}<div class="grow" style="min-width:0">${f.isDefault ? "" : crumbs(f)}</div><span class="small muted">${C().folders.length} dossiers · ← → entre colonnes</span></div>
    <div class="B-cols">${lists.map((list, i) => column(list, path[i], i)).join("")}<section class="B-detail">${detail(f)}</section></div></div>`;
}
function column(list, selected, level) {
  const filter = list.length > 20;
  return `<div class="B-col" role="listbox" aria-label="Niveau ${level + 1}"><div class="row B-colhead"><span class="caps grow">${level === 0 ? "Bibliothèque" : esc(C().byId.get(list[0]?.parent)?.name || "")}</span><span class="count">${list.length}</span><button class="icon-btn" style="width:28px;height:28px" aria-label="Nouveau dossier à ce niveau" ${goAttr({ modal: "newfolder" })}>${icon("add", "s16")}</button></div>
    ${filter ? `<label class="field" style="min-height:32px;margin:0 8px 6px">${icon("filter-outline", "s14")}<input placeholder="Filtrer ce niveau" aria-label="Filtrer ce niveau"></label>` : ""}
    <div class="scroll grow">${list.map((x) => `<button role="option" aria-selected="${x === selected}" class="frow ${x === selected ? (x === curFolder() || (x.isDefault && S.f === "f0") ? "on" : "anc") : ""}" title="${esc(x.name)}" ${goAttr({ s: "folder", f: x.id, tab: "sources", chat: "off" })}>${icon(x.isDefault ? "file-tray-outline" : "folder-outline", "s16")}<span class="grow clamp2" style="min-width:0">${esc(x.name)}</span><span class="count">${x.count}</span>${x.children.length ? icon("chevron-forward", "s14") : `<span style="width:14px"></span>`}</button>`).join("")}</div></div>`;
}
function detail(f) {
  const t = S.tab || "sources";
  const scope = chatScope();
  const chatOpen = scope && S.chat === "open";
  const src = sourcesOf(C(), f);
  const head = `<div class="row" style="align-items:flex-start"><div class="grow" style="min-width:0"><h1 class="headline" style="font-size:24px;overflow-wrap:anywhere">${esc(f.name)}</h1><div class="small muted">${f.count} sources${f.children.length ? ` · ${f.children.length} sous-dossiers` : ""}</div></div>${f.isDefault ? "" : `<button class="icon-btn" data-act="menu:folder:${f.id}" aria-label="Actions pour ce dossier">${icon("ellipsis-horizontal")}</button>`}</div>
    <div class="seg" style="margin:12px 0"><button class="${t === "sources" ? "on" : ""}" ${goAttr({ tab: "sources" })}>${icon("layers-outline", "s16")} Sources</button><button class="${t === "ai" ? "on" : ""}" ${goAttr({ tab: "ai", chat: "off" })}>${icon("sparkles-outline", "s16")} IA</button></div>`;
  const list = t === "ai" ? aiPanel("folder").replace('class="tiles"', 'class="tiles" style="grid-template-columns:repeat(3,minmax(0,1fr))"')
    : `${f.children.length ? `<div class="caps" style="margin:4px 0">Dossiers</div>${f.children.map((c) => `<button class="frow" ${goAttr({ s: "folder", f: c.id })}>${icon("folder-outline", "s18")}<span class="ell grow">${esc(c.name)}</span><span class="count">${c.count}</span>${icon("chevron-forward", "s14")}</button>`).join("")}<div class="caps" style="margin:12px 0 4px">Sources · ${src.length}</div>` : ""}${src.map((m) => mediaRow(m, { size: 48 })).join("") || `<p class="muted">Ce dossier est vide.</p>`}`;
  return `<div class="B-detail-top scroll ${chatOpen ? "split" : ""}">${head}${list}</div>
    ${chatOpen ? `<div class="B-chat"><div class="B-grip" title="Faire glisser pour redimensionner"></div>${chatHeader(scope)}<div class="scroll grow" style="margin-top:8px">${thread(scope)}</div></div>` : ""}
    ${scope ? `<div class="B-composer">${composer(scope)}</div>` : ""}`;
}
// A media opens beside its siblings: the column of the folder it is in stays on the left.
function mediaSplit() {
  const m = curMedia();
  const f = m.folder ? C().memory : C().unsorted;
  const sibs = sourcesOf(C(), f);
  const t = S.tab || "reader";
  const scope = chatScope();
  const chatOpen = scope && S.chat === "open";
  return `<div class="B-media"><aside class="B-sibs"><button class="btn ghost" style="margin:8px" ${goAttr({ s: "folder", f: f.id, tab: "sources", m: null, chat: "off" })}>${icon("chevron-back", "s16")} Colonnes</button>
      <div style="padding:0 12px 8px">${crumbs(f)}</div><div class="caps" style="padding:0 16px 4px">${sibs.length} sources · ↑ ↓ pour passer</div><div class="scroll grow">${sibs.map((x) => mediaRow(x, { sel: x.id === m.id, size: 40 })).join("")}</div></aside>
    <section class="B-read"><div class="B-detail-top scroll ${chatOpen ? "split" : ""}"><div style="max-width:720px;margin:0 auto">${mediaHero(m, { height: 170 })}<div style="margin:12px 0">${metaLine(m)}</div>${mediaTabs(m)}<div style="margin-top:16px">${mediaStateBody(m) || (t === "ai" ? aiPanel("media") : previewBlock() + readerText({ cited: chatOpen ? [5, 8] : [] }))}</div></div></div>
      ${chatOpen ? `<div class="B-chat"><div class="B-grip"></div>${chatHeader(scope)}<div class="scroll grow" style="margin-top:8px">${thread(scope)}</div></div>` : ""}
      ${scope ? `<div class="B-composer">${composer(scope)}</div>` : ""}</section></div>`;
}
