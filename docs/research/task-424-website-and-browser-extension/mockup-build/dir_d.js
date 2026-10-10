// Direction D — « Le flux à facettes ». Content first: the library is one list of every
// source, and a folder is a lens on it — a facet picked by typing, like a mail client's
// label or a store's category filter. A folder's page is that list filtered (its
// Sources tab), with the reading pane beside it (list–detail, as in mail clients).
// The structure of folders is edited in its own dialog, away from the reading path.

const DIR = {
  id: "d",
  name: "Le flux à facettes",
  shell() {
    return `<div class="D">${rail()}${S.s === "folder" || S.s === "media" || S.s === "library" ? feed() : `<main class="D-page scroll">${page()}</main>`}</div>${manage()}`;
  },
  destinationPicker() {
    const q = S.pq || "";
    const hits = q ? searchFolders(C(), q, 8) : recentFolders(5);
    const isFolder = (S.target || "").startsWith("folder:");
    return `<div class="scrim" style="background:transparent" ${goAttr({ modal: null })}><div class="menu D-pick" onclick="event.stopPropagation()" role="dialog" aria-label="Ranger dans un dossier">
      <div class="small subtle" style="padding:6px 8px">${isFolder ? "Déplacer le dossier vers" : "Ranger cette source dans"}</div>
      <label class="field" style="margin:0 4px 6px">${icon("folder-outline", "s16")}<input value="${esc(q)}" placeholder="Tapez un nom de dossier" aria-label="Dossier de destination"></label>
      <div class="caps" style="padding:4px 10px">${q ? "Dossiers" : "Récents"}</div>${hits.map((f, i) => `<button class="${i === 0 ? "D-on" : ""}" ${goAttr({ modal: null, toast: `Rangé dans « ${f.name} »` })}>${icon("folder-outline", "s18")}<span class="grow" style="min-width:0"><span class="ell" style="display:block">${hl(f.name, q)}</span><span class="small muted ell" style="display:block">${esc(parentHint(f))}</span></span></button>`).join("")}
      <div class="divider" style="margin:6px 0"></div><button ${goAttr({ mg: "1", modal: null })}>${icon("git-branch-outline", "s18")} Choisir dans l'arborescence…</button><button>${icon("add", "s18")} Créer « ${esc(q || "…")} »</button></div></div>`;
  },
  extraWalks: (L) => L("Facette dossier : saisie prédictive", { s: "folder", f: corpus("ref").memory.id, fq: "notes" }) + L("Gérer les dossiers (arborescence)", { s: "folder", f: corpus("ref").memory.id, mg: "1" }) + L("Tous les médias, sans facette", { s: "library" }),
};

function rail() {
  const it = (ic, l, p, on, badge = "", cls = "") => `<button class="D-ri ${cls} ${on ? "on" : ""}" ${goAttr(p)} title="${l}" aria-label="${l}">${icon(ic)}<span>${l}</span>${badge}</button>`;
  const lib = ["folder", "media", "library", "artifact"].includes(S.s);
  return `<nav class="D-rail" aria-label="Navigation"><div class="icon-btn" style="background:var(--primary);color:var(--on-primary);margin:4px auto 12px">${icon("layers-outline", "s18")}</div>
    <button class="D-add" ${goAttr({ modal: "add" })} aria-label="Ajouter">${icon("add", "s24")}</button>
    ${it("home-outline", "Accueil", { s: "home" }, S.s === "home")}${it("albums-outline", "Bibliothèque", { s: "library", f: null }, lib)}${it("newspaper-outline", "Digest", { s: "digest" }, S.s === "digest")}${it("file-tray-outline", "Non classés", { s: "unsorted", pos: "1" }, S.s === "unsorted", `<i class="D-badge">12</i>`, "D-mhide")}${it("search-outline", "Recherche", { s: "search", sq: "pause" }, S.s === "search", "", "D-mhide")}
    <span class="grow"></span>${it(S.theme === "dark" ? "sunny-outline" : "moon-outline", "Thème", { theme: S.theme === "dark" ? "light" : "dark" }, false, "", "D-theme")}${it("person-outline", "Compte", { s: "account" }, S.s === "account" || S.s === "settings")}</nav>`;
}
function facets(f) {
  const fq = S.fq || "";
  const hits = fq ? searchFolders(C(), fq, 7) : [];
  const types = [["podcast", 64], ["article", 118], ["video", 51], ["short", 37], ["document", 22], ["imagePost", 9], ["audio", 14], ["text", 6]];
  return `<aside class="D-facets scroll" aria-label="Filtres"><div class="caps" style="margin:4px 0 8px">Dossier</div>
    <div style="position:relative"><label class="field" style="border-radius:var(--r-md)">${icon("folder-outline", "s16")}<input value="${esc(fq)}" placeholder="Dans le dossier…" aria-label="Filtrer par dossier"></label>
      ${fq ? `<div class="menu" style="left:0;right:0;top:44px"><div class="small muted" style="padding:2px 10px 4px">${searchFolders(C(), fq, 999).length} dossiers</div>${hits.map((x, i) => `<button class="${i === 0 ? "D-on" : ""}" ${goAttr({ s: "folder", f: x.id, fq: null, tab: "sources" })}>${icon("folder-outline", "s18")}<span class="grow" style="min-width:0"><span class="ell" style="display:block">${hl(x.name, fq)}</span><span class="small muted ell" style="display:block">${esc(parentHint(x))}</span></span><span class="count">${x.count}</span></button>`).join("")}</div>` : ""}</div>
    ${f ? `<div class="D-sel"><div class="grow" style="min-width:0"><div class="small muted ell">${esc(parentHint(f))}</div><div class="label" style="overflow-wrap:anywhere">${esc(f.name)}</div></div><button class="icon-btn" style="width:28px;height:28px" aria-label="Retirer le filtre dossier" ${goAttr({ s: "library", f: null, chat: "off" })}>${icon("close", "s16")}</button></div>
      <label class="row small" style="margin:8px 2px"><input type="checkbox" ${f.children.length ? "checked" : ""}> Inclure les ${f.children.length} sous-dossiers</label>
      ${f.parent ? `<button class="frow" ${goAttr({ f: f.parent })}>${icon("return-up-back-outline", "s16")}<span class="ell">Remonter à ${esc(C().byId.get(f.parent).name)}</span></button>` : ""}
      ${f.children.map((c) => `<button class="frow" style="padding-left:12px" ${goAttr({ f: c.id })}>${icon("folder-outline", "s16")}<span class="ell grow">${esc(c.name)}</span><span class="count">${c.count}</span></button>`).join("")}` : ""}
    <div class="caps" style="margin:16px 0 4px">Filtrés récemment</div>${recentFolders(4).map((x) => `<button class="frow" ${goAttr({ s: "folder", f: x.id, tab: "sources" })} title="${esc(pathText(x))}">${icon("time-outline", "s16")}<span class="ell grow">${esc(x.name)}</span><span class="path ell" style="max-width:40%">${esc(parentHint(x).split(" · ")[0])}</span></button>`).join("")}
    <button class="btn tonal" style="width:100%;margin-top:8px" ${goAttr({ mg: "1" })}>${icon("git-branch-outline", "s16")} Gérer les dossiers</button>
    <div class="caps" style="margin:20px 0 4px">Type</div>${types.map(([t, n], i) => `<label class="frow" style="min-height:30px"><input type="checkbox" ${i < 2 ? "checked" : ""}><span class="grow">${TYPE_META[t].label[0] + TYPE_META[t].label.slice(1).toLowerCase()}</span><span class="count">${n}</span></label>`).join("")}
    <div class="caps" style="margin:16px 0 4px">État</div><label class="frow" style="min-height:30px"><input type="checkbox"><span class="grow">En cours de traitement</span><span class="count">1</span></label><label class="frow" style="min-height:30px"><input type="checkbox"><span class="grow">Échec de l'import</span><span class="count">1</span></label></aside>`;
}
function feed() {
  const f = S.s === "folder" ? (S.f === "f0" ? C().unsorted : curFolder()) : S.s === "media" ? (curMedia().folder ? C().memory : C().unsorted) : null;
  const t = S.s === "folder" ? S.tab || "sources" : "sources";
  const list = f ? sourcesOf(C(), f) : MEDIA;
  const sel = S.s === "media" ? curMedia() : null;
  const scope = chatScope();
  const folderChat = scope === "folder" && S.chat === "open";
  const head = f ? `<div class="row" style="align-items:flex-start;gap:8px"><div class="grow" style="min-width:0"><div class="small muted ell">${esc(parentHint(f))}</div><h1 class="headline" style="font-size:24px;overflow-wrap:anywhere">${esc(f.name)}</h1></div>${f.isDefault ? "" : `<button class="icon-btn" data-act="menu:folder:${f.id}" aria-label="Actions pour ce dossier">${icon("ellipsis-horizontal")}</button>`}</div>
      <div class="row" style="margin:10px 0 6px"><div class="seg"><button class="${t === "sources" ? "on" : ""}" ${goAttr({ s: "folder", f: f.id, tab: "sources" })}>${icon("layers-outline", "s16")} Sources · ${list.length}</button><button class="${t === "ai" ? "on" : ""}" ${goAttr({ s: "folder", f: f.id, tab: "ai", chat: "off" })}>${icon("sparkles-outline", "s16")} IA</button></div></div>`
    : `<h1 class="headline" style="font-size:24px">Tous les médias</h1><div class="small muted" style="margin-bottom:6px">421 sources · ${C().folders.length} dossiers · aucun filtre</div>`;
  const rows = t === "ai" ? `<div style="padding:8px 4px">${aiPanel("folder").replace('class="tiles"', 'class="tiles" style="grid-template-columns:repeat(2,minmax(0,1fr))"')}</div>`
    : `<div class="row small muted" style="padding:4px 8px"><span class="grow">Trié par date d'ajout ▾</span><span>${list.length} sources</span></div>${list.map((m) => mediaRow(m, { sel: sel && m.id === sel.id, size: 44, folderChip: f ? "" : m.folder ? `<span class="chip" style="height:22px">${icon("folder-outline", "s14")}Mémoire de travail</span>` : `<span class="chip" style="height:22px">Non classés</span>` })).join("")}`;
  const right = sel ? reader(sel) : folderChat ? `<section class="D-pane D-conv">${chatHeader("folder")}<div class="scroll grow" style="margin-top:8px">${thread("folder")}</div></section>`
    : `<section class="D-pane D-empty"><div style="text-align:center;max-width:320px">${icon("book-outline", "s24")}<p class="subtle">Choisissez une source pour la lire ici${f && t === "sources" ? ", ou posez une question sur les sources de ce dossier" : ""}.</p><p class="small muted"><span class="kbd">J</span> <span class="kbd">K</span> pour passer d'une source à l'autre</p></div></section>`;
  // Below 900 px the facet column folds into this bar; the facets open as a sheet.
  const mbar = `<div class="D-mfilter"><button class="chip on">${icon("folder-outline", "s14")}${f ? esc(f.name) : "Tous les dossiers"} ${f ? icon("close", "s14") : ""}</button><button class="chip">${icon("options-outline", "s14")} Filtres · 2</button><button class="chip" ${goAttr({ s: "search", sq: "pause" })} aria-label="Rechercher">${icon("search-outline", "s14")}</button></div>`;
  return `${facets(f)}<section class="D-list"><div class="D-listhead">${mbar}${head}</div><div class="scroll grow" style="padding:0 8px ${scope === "folder" ? "96px" : "16px"}">${rows}</div>${scope === "folder" ? `<div class="D-composer">${composer("folder", { compact: true })}</div>` : ""}</section>${right}`;
}
function reader(m) {
  const t = S.tab || "reader";
  const scope = chatScope();
  const open = scope === "media" && S.chat === "open";
  return `<section class="D-pane D-reader"><div class="scroll grow" style="padding:20px 32px 110px"><div class="row" style="margin-bottom:12px"><button class="chip" ${goAttr({ modal: "move", target: m.id })} title="Ranger dans un dossier">${icon("folder-outline", "s14")} ${m.folder ? "Mémoire de travail" : "Non classés"} ${icon("chevron-down", "s14")}</button><span class="grow"></span><button class="icon-btn" aria-label="Ouvrir en plein écran" title="Lecture plein écran">${icon("open-outline", "s18")}</button></div>
    ${mediaHero(m, { height: 160 })}<div style="margin:12px 0">${metaLine(m)}</div>${mediaTabs(m)}<div style="margin-top:16px">${mediaStateBody(m) || (t === "ai" ? aiPanel("media").replace('class="tiles"', 'class="tiles" style="grid-template-columns:repeat(3,minmax(0,1fr))"') : previewBlock() + readerText({ cited: open ? [5, 8] : [] }))}</div></div>
    ${open ? `<div class="D-sheet"><div class="B-grip" style="width:48px;height:4px;border-radius:2px;background:var(--outline-variant);margin:0 auto 8px"></div>${chatHeader("media")}<div class="scroll grow" style="margin-top:8px">${thread("media")}</div></div>` : ""}
    ${scope === "media" ? `<div class="D-composer">${composer("media")}</div>` : ""}</section>`;
}
function page() {
  const w = (x, mw = 880) => `<div style="max-width:${mw}px;margin:0 auto;padding:28px 32px 80px">${x}</div>`;
  switch (S.s) {
    case "home": return w(`<h1 class="display" style="margin-bottom:20px">Accueil</h1>${homeBody()}`, 1100);
    case "artifact": return w(`<button class="btn ghost" onclick="history.back()">${icon("chevron-back", "s16")} Retour</button>${artifactView(S.art)}`);
    case "digest": return w(`<h1 class="display" style="margin-bottom:16px">Digest</h1>${digestBody()}`, 1000);
    case "search": return w(`<label class="field" style="min-height:48px;margin-bottom:16px">${icon("search-outline")}<input value="${esc(S.sq || "")}" aria-label="Rechercher"></label>${searchBody()}`);
    case "unsorted": return w(unsortedBody());
    case "account": return w(accountBody(), 640);
    case "settings": return w(settingsBody(), 640);
    case "paywall": return w(paywallBody());
  }
  return "";
}
// The structure editor: the only place the whole tree is drawn, for create / rename / move / delete.
function manage() {
  if (S.mg !== "1") return "";
  const rows = (list, d) => list.map((f) => `<div class="frow" style="padding-left:${8 + d * 18}px" draggable="true" title="Glisser pour déplacer">${f.children.length ? `<button class="tw" data-act="toggle:${f.id}">${icon(UI.expanded.has(f.id) ? "chevron-down" : "chevron-forward", "s14")}</button>` : `<span class="tw"></span>`}${icon("folder-outline", "s16")}<span class="ell grow">${esc(f.name)}</span><span class="count">${f.count}</span><button class="tw" data-act="menu:folder:${f.id}" aria-label="Actions">${icon("ellipsis-horizontal", "s14")}</button></div>${UI.expanded.has(f.id) ? rows(f.children, d + 1) : ""}`).join("");
  return `<div class="scrim" ${goAttr({ mg: null })}><div class="modal" style="width:min(720px,calc(100vw - 32px))" onclick="event.stopPropagation()" role="dialog" aria-label="Gérer les dossiers">
    <header><h2 class="headline grow">Gérer les dossiers</h2><button class="btn tonal" ${goAttr({ modal: "newfolder" })}>${icon("add", "s16")} Nouveau</button><button class="icon-btn" aria-label="Fermer" ${goAttr({ mg: null })}>${icon("close")}</button></header>
    <div class="body"><label class="field" style="margin-bottom:8px">${icon("filter-outline", "s16")}<input placeholder="Filtrer l'arborescence" aria-label="Filtrer"></label><div class="small muted" style="margin:0 4px 8px">${C().folders.length} dossiers · glisser-déposer pour déplacer, ou « … » › Déplacer · profondeur maximale 5 niveaux</div><div role="tree">${rows(C().roots, 0)}</div></div></div></div>`;
}
