// Direction C — « La barre de saut ». No permanent tree: recall beats browsing once a
// library passes a few hundred folders. Three tools replace the hierarchy on screen:
// a jump bar (each crumb drops down its siblings, the Xcode jump bar / Windows Explorer
// address bar), a ⌘K palette over folders, media and actions, and an A–Z index where a
// name shared by twenty folders is one entry listing its twenty parents.
// The page itself is full width: reading gets the whole screen.

const DIR = {
  id: "c",
  name: "La barre de saut",
  shell() {
    const scope = chatScope();
    return `<div class="Cc">${bar()}<main class="C-main scroll" id="content">${content()}</main>
      ${scope ? `<div class="C-dock">${S.chat === "open" ? `<div class="C-card">${chatHeader(scope)}<div class="scroll" style="max-height:min(52vh,460px);margin-top:8px">${thread(scope)}</div></div>` : ""}${composer(scope)}</div>` : ""}
      ${jumpMenu()}</div>`;
  },
  palette() { return palette("go"); },
  destinationPicker() { return palette("move"); },
  after() {
    // The sibling menu hangs under its own crumb.
    const m = $(".C-jm"), b = document.querySelectorAll(".C-drop")[+S.jb];
    if (m && b) m.style.left = Math.max(8, b.getBoundingClientRect().right - 320) + "px";
  },
  extraWalks: (L) => L("Palette ⌘K : dossiers, médias, actions", { s: "folder", f: corpus("ref").memory.id, tab: "sources", modal: "palette", pq: "notes" }) + L("Barre de saut : voisins d'un segment", { s: "folder", f: corpus("ref").memory.id, tab: "sources", jb: "1" }) + L("Index A–Z, homonymes groupés", { s: "library", ix: "Notes de lecture" }),
};

function bar() {
  const f = S.s === "folder" ? (S.f === "f0" ? C().unsorted : curFolder()) : S.s === "media" ? (curMedia().folder ? C().memory : C().unsorted) : null;
  const segs = f ? (f.isDefault ? [f] : folderPath(C(), f)) : [];
  const nav = (l, p, on) => `<button class="C-nav ${on ? "on" : ""}" ${goAttr(p)}>${l}</button>`;
  return `<header class="C-bar"><div class="row" style="gap:10px;flex:none"><div class="icon-btn" style="background:var(--primary);color:var(--on-primary);width:32px;height:32px">${icon("layers-outline", "s18")}</div><b class="headline C-brand">Deepn</b></div>
    <nav class="row C-navs">${nav("Accueil", { s: "home" }, S.s === "home")}${nav("Digest", { s: "digest" }, S.s === "digest")}${nav("Non classés · 12", { s: "unsorted", pos: "1" }, S.s === "unsorted")}</nav>
    <div class="C-jump grow" aria-label="Barre de saut"><button class="C-seg ${S.s === "library" ? "on" : ""}" ${goAttr({ s: "library", jb: null })}>${icon("albums-outline", "s16")} Index</button>
      ${segs.map((x, i) => `${icon("chevron-forward", "s14")}<button class="C-seg ${i === segs.length - 1 && S.s === "folder" ? "on" : ""}" title="${esc(x.name)}" ${goAttr({ s: "folder", f: x.id, tab: "sources", jb: null })}>${esc(x.name)}</button><button class="C-drop" aria-label="Dossiers voisins de ${esc(x.name)}" ${goAttr({ jb: S.jb === String(i) ? null : String(i) })}>${icon("chevron-down", "s14")}</button>`).join("")}
      ${S.s === "media" ? `${icon("chevron-forward", "s14")}<span class="C-seg ell" style="max-width:280px">${esc(curMedia().title)}</span>` : ""}</div>
    <button class="C-k" ${goAttr({ modal: "palette", pq: null })}>${icon("search-outline", "s18")}<span class="C-klabel">Aller à…</span><span class="kbd">⌘K</span></button>
    <button class="btn primary C-add" ${goAttr({ modal: "add" })}>${icon("add", "s18")}<span>Ajouter</span></button>
    <button class="icon-btn" data-act="theme" aria-label="Changer de thème">${icon(S.theme === "dark" ? "sunny-outline" : "moon-outline", "s18")}</button>
    <button class="icon-btn" style="background:var(--surface-container)" aria-label="Compte" ${goAttr({ s: "account" })}>${icon("person-outline", "s18")}</button></header>`;
}
// Siblings of one crumb, filterable when there are many: moving sideways never needs the root.
function jumpMenu() {
  if (S.jb == null || S.s !== "folder") return "";
  const f = curFolder();
  const segs = folderPath(C(), f);
  const seg = segs[+S.jb];
  if (!seg) return "";
  const sibs = seg.parent ? C().byId.get(seg.parent).children : C().roots;
  const el = `<div class="menu C-jm" style="left:${200 + +S.jb * 170}px;top:56px" role="menu"><div class="small muted" style="padding:4px 10px">${sibs.length} dossiers au même niveau</div>
    ${sibs.length > 12 ? `<label class="field" style="min-height:32px;margin:4px 4px 6px">${icon("filter-outline", "s14")}<input placeholder="Filtrer" aria-label="Filtrer les voisins"></label>` : ""}
    <div class="scroll" style="max-height:360px">${sibs.map((x) => `<button class="${x === seg ? "C-cur" : ""}" ${goAttr({ s: "folder", f: x.id, jb: null, tab: "sources" })}>${icon("folder-outline", "s18")}<span class="grow ell">${esc(x.name)}</span>${x.children.length ? `<span class="count">${x.children.length} ›</span>` : ""}</button>`).join("")}</div></div>`;
  return el;
}
function palette(mode) {
  const q = S.pq || "";
  const folders = q ? searchFolders(C(), q, 7) : recentFolders(5);
  const media = q ? MEDIA.filter((m) => fold(m.title).includes(fold(q))).slice(0, 3) : [];
  const isMove = mode === "move";
  const row = (f, i) => `<button class="C-prow ${i === 0 ? "on" : ""}" ${goAttr(isMove ? { modal: null, toast: `Rangé dans « ${f.name} »` } : { s: "folder", f: f.id, modal: null, tab: "sources" })}>${icon("folder-outline", "s18")}<span class="grow" style="min-width:0"><span class="ell" style="display:block">${hl(f.name, q)}</span><span class="small muted ell" style="display:block">${esc(parentHint(f))}</span></span>${homonymCount(C(), f) > 1 ? `<span class="chip">homonyme</span>` : ""}${!q ? `<span class="small muted">récent</span>` : f.lastOpened > 120 ? `<span class="small muted">peu ouvert</span>` : ""}${i === 0 ? `<span class="kbd">↵</span>` : ""}</button>`;
  return `<div class="scrim" ${goAttr({ modal: null })}><div class="modal C-pal" role="dialog" aria-label="${isMove ? "Ranger dans un dossier" : "Aller à"}" onclick="event.stopPropagation()">
    <label class="row" style="padding:14px 18px;gap:12px">${icon(isMove ? "folder-outline" : "search-outline", "s24")}<input class="grow" style="border:0;outline:0;background:none;font-size:18px" value="${esc(q)}" placeholder="${isMove ? "Ranger dans… (tapez un nom de dossier)" : "Aller à un dossier, un média, ou une action…"}" aria-label="Recherche"></label><div class="divider"></div>
    <div class="scroll" style="padding:8px">${isMove ? `<div class="caps" style="padding:6px 10px">Ranger « ${esc(curMedia().title.slice(0, 48))}… » dans</div>` : ""}
      <div class="caps" style="padding:6px 10px">${q ? `Dossiers · ${searchFolders(C(), q, 999).length}` : "Dossiers récents"}</div>${folders.map(row).join("")}
      ${media.length ? `<div class="caps" style="padding:10px 10px 6px">Médias</div>${media.map((m) => `<button class="C-prow" ${goAttr({ s: "media", m: m.id, modal: null, tab: "reader" })}>${cover(m, 32)}<span class="grow ell">${hl(m.title, q)}</span></button>`).join("")}` : ""}
      <div class="caps" style="padding:10px 10px 6px">Actions</div>
      ${isMove ? `<button class="C-prow">${icon("add", "s18")}<span class="grow">Créer « ${esc(q || "Nouveau dossier")} » dans…</span></button>` : `<button class="C-prow" ${goAttr({ modal: "add" })}>${icon("link-outline", "s18")}<span class="grow">Ajouter un lien ou un fichier</span><span class="kbd">A</span></button><button class="C-prow" ${goAttr({ modal: "newfolder" })}>${icon("add", "s18")}<span class="grow">Nouveau dossier</span><span class="kbd">N</span></button><button class="C-prow" ${goAttr({ s: "search", sq: q || "pause", modal: null })}>${icon("search-outline", "s18")}<span class="grow">Rechercher « ${esc(q || "…")} » dans le texte des sources</span></button><button class="C-prow" ${goAttr({ s: "digest", modal: null })}>${icon("newspaper-outline", "s18")}<span class="grow">Ouvrir le digest</span><span class="kbd">G D</span></button>`}
    </div><div class="small muted" style="padding:8px 18px;background:var(--surface-container-low)">↑ ↓ pour choisir · ↵ pour ouvrir · Tab pour voir le chemin complet · Échap pour fermer</div></div></div>`;
}
function content() {
  const wrap = (x, w = 880) => `<div style="max-width:${w}px;margin:0 auto;padding:24px 32px 160px">${x}</div>`;
  switch (S.s) {
    case "home": return wrap(`<h1 class="display" style="margin-bottom:20px">Accueil</h1>${homeBody()}`, 1100);
    case "library": return wrap(indexPage(), 1180);
    case "folder": return wrap(folderPage());
    case "media": return wrap(mediaPage(), 760);
    case "artifact": return wrap(artifactView(S.art));
    case "digest": return wrap(`<h1 class="display" style="margin-bottom:16px">Digest</h1>${digestBody()}`, 1000);
    case "search": return wrap(`<h1 class="display" style="margin-bottom:12px">Recherche · « ${esc(S.sq || "pause")} »</h1>${searchBody()}`);
    case "unsorted": return wrap(unsortedBody());
    case "account": return wrap(accountBody(), 640);
    case "settings": return wrap(settingsBody(), 640);
    case "paywall": return wrap(paywallBody());
  }
  return "";
}
// A–Z index: one entry per *name*. A name held by several folders lists its parents.
function indexPage() {
  const groups = new Map();
  for (const f of C().folders) { const k = f.name; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
  const q = S.iq || "";
  const names = [...groups.keys()].filter((n) => !q || fold(n).includes(fold(q))).sort((a, b) => a.localeCompare(b, "fr"));
  const letters = [...new Set(names.map((n) => fold(n)[0].toUpperCase()))];
  const entry = (n) => {
    const fs = groups.get(n);
    if (fs.length === 1) return `<button class="C-ix" ${goAttr({ s: "folder", f: fs[0].id, tab: "sources" })} title="${esc(pathText(fs[0]))}"><span class="ell">${esc(n)}</span><span class="small muted ell">${esc(parentHint(fs[0]))}</span></button>`;
    const open = S.ix === n;
    return `<div class="C-ix grp ${open ? "open" : ""}"><button class="row" style="width:100%" ${goAttr({ ix: open ? null : n })}><span class="ell grow" style="text-align:left">${esc(n)}</span><span class="chip">${fs.length} dossiers</span>${icon(open ? "chevron-down" : "chevron-forward", "s14")}</button>
      ${open ? `<div class="C-ixkids">${fs.sort((a, b) => parentHint(a).localeCompare(parentHint(b), "fr")).map((f) => `<button class="frow" style="min-height:30px" ${goAttr({ s: "folder", f: f.id, tab: "sources" })}><span class="ell grow">dans ${esc(parentHint(f))}</span><span class="count">${f.count}</span></button>`).join("")}</div>` : ""}</div>`;
  };
  return `<div class="row" style="align-items:flex-end;margin-bottom:16px"><div class="grow"><h1 class="display">Index des dossiers</h1><div class="subtle">${C().folders.length} dossiers, ${groups.size} noms distincts. Un nom porté par plusieurs dossiers est une seule entrée.</div></div>
      <label class="field" style="width:320px">${icon("filter-outline", "s18")}<input value="${esc(q)}" placeholder="Filtrer l'index" aria-label="Filtrer l'index"></label></div>
    <div class="caps" style="margin-bottom:8px">Récents</div><div class="row" style="flex-wrap:wrap;margin-bottom:12px">${recentFolders(6).map((f) => `<button class="chip" ${goAttr({ s: "folder", f: f.id, tab: "sources" })} title="${esc(pathText(f))}">${icon("time-outline", "s14")}${esc(f.name)} <span class="muted ell" style="max-width:180px">· ${esc(parentHint(f).split(" · ")[0])}</span></button>`).join("")}</div>
    <div class="caps" style="margin-bottom:8px">Épinglés</div><div class="row" style="flex-wrap:wrap;margin-bottom:20px"><button class="chip" ${goAttr({ s: "folder", f: C().memory.id, tab: "sources" })}>${icon("pin", "s14")} Mémoire de travail</button><button class="chip">${icon("pin", "s14")} Entretiens utilisateurs</button></div>
    <div class="C-index">${letters.map((L) => `<section><h2 class="C-letter" id="L${L}">${L}</h2>${names.filter((n) => fold(n)[0].toUpperCase() === L).map(entry).join("")}</section>`).join("")}</div>
    <nav class="C-rail" aria-label="Aller à la lettre">${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => `<a href="#" class="${letters.includes(L) ? "" : "off"}">${L}</a>`).join("")}</nav>`;
}
function folderPage() {
  const f = S.f === "f0" ? C().unsorted : curFolder();
  const t = S.tab || "sources";
  const src = sourcesOf(C(), f);
  return `<div class="row" style="align-items:flex-start"><div class="grow" style="min-width:0"><h1 class="display" style="overflow-wrap:anywhere">${esc(f.name)}</h1><div class="small muted">${f.isDefault ? "" : esc(parentHint(f)) + " · "}${f.count} sources${f.children.length ? ` · ${f.children.length} sous-dossiers` : ""}</div></div>${f.isDefault ? "" : `<button class="icon-btn" data-act="menu:folder:${f.id}" aria-label="Actions pour ce dossier">${icon("ellipsis-horizontal")}</button>`}</div>
    <div class="seg" style="margin:16px 0"><button class="${t === "sources" ? "on" : ""}" ${goAttr({ tab: "sources" })}>${icon("layers-outline", "s16")} Sources</button><button class="${t === "ai" ? "on" : ""}" ${goAttr({ tab: "ai", chat: "off" })}>${icon("sparkles-outline", "s16")} IA</button></div>
    ${t === "ai" ? aiPanel("folder") : `${f.children.length ? `<div class="row" style="flex-wrap:wrap;margin-bottom:16px">${f.children.map((c) => `<button class="chip" style="height:36px;padding:0 14px" ${goAttr({ s: "folder", f: c.id })}>${icon("folder-outline", "s16")}${esc(c.name)} <span class="muted">${c.count}</span></button>`).join("")}</div>` : ""}<div class="caps" style="margin-bottom:6px">Sources · ${src.length}</div>${src.map((m) => mediaRow(m)).join("") || `<p class="muted">Ce dossier est vide.</p>`}`}`;
}
function mediaPage() {
  const m = curMedia();
  const t = S.tab || "reader";
  return `${mediaHero(m, { height: 220 })}<div style="margin:12px 0 16px">${metaLine(m)}</div>${mediaTabs(m)}<div style="margin-top:16px">${mediaStateBody(m) || (t === "ai" ? aiPanel("media") : previewBlock() + readerText({ cited: S.chat === "open" ? [5, 8] : [] }))}</div>`;
}
