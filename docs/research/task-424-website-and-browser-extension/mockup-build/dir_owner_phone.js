// The web app on a phone (under 900 px): the mobile app's own screens, as close as a browser
// allows. The owner's choices for the desktop (no unsorted card or minutes warning on the
// home, three panes, the bar of direction B) do not apply here: a phone gets the app it
// already knows. Sources of each screen: mobile/app/(tabs)/*, app/media/*, src/components/*.
// What a browser cannot do is left out: the share sheet, Liquid Glass, haptics, push.

const PHONE = () => innerWidth < 900;
window.addEventListener("resize", () => { const p = PHONE(); if (p !== window.__phone) { window.__phone = p; render(); } });

function phoneShell() {
  switch (S.s) {
    case "home": return tabbed(homeP(), { fabs: true });
    case "library": case "search": return tabbed(libraryP());
    case "digest": return tabbed(digestP());
    case "digestp": return tabbed(digestPeriodP(), { bare: true });
    case "account": return S.sec && S.sec !== "plan" ? stack(S.sec === "plans" ? "Formules" : settingTitle(S.sec), settingsP(), { back: { sec: null } }) : tabbed(accountP());
    case "settings": return stack(settingTitle(S.sub), settingsP(), { back: { s: "account", sub: null } });
    case "paywall": return stack("Formules", paywallBody(), { back: { s: "account" } });
    case "folder": return S.art ? artifactP() : folderP();
    case "media": return S.art ? artifactP() : mediaP(curMedia());
    case "unsorted": return unsortedP();
  }
  return tabbed("");
}
const settingTitle = (k) => ({ reading: "Langue de lecture", ui: "Langue de l'app", theme: "Thème", extension: "Extension navigateur", delete: "Supprimer le compte", bug: "Signaler un bug", ideas: "Suggestions" })[k] || "";

// The tab bar of (tabs)/_layout.tsx: Accueil, Recherche, Digest, Compte, and their glyphs.
function tabBar() {
  const t = (ic, l, p, on) => `<button class="${on ? "on" : ""}" ${goAttr({ art: null, chat: null, sec: null, sub: null, sq: null, ...p })}>${icon(ic)}<span>${l}</span></button>`;
  return `<nav class="P-tabs" aria-label="Navigation principale">${t("file-tray-outline", "Accueil", { s: "home" }, S.s === "home")}${t("library-outline", "Recherche", { s: "library" }, S.s === "library" || S.s === "search")}${t("sparkles-outline", "Digest", { s: "digest" }, S.s.startsWith("digest"))}${t("person-outline", "Compte", { s: "account" }, S.s === "account")}</nav>`;
}
function tabbed(content, { fabs = false, bare = false } = {}) {
  return `<div class="P">${bare ? content : `<div class="P-scroll scroll">${content}</div>`}
    ${fabs ? `<div class="P-fabs"><button class="P-fab cam" aria-label="Prendre une photo">${icon("camera", "s24")}</button><button class="P-fab add" aria-label="Ajouter à votre boîte de réception" ${goAttr({ modal: "add" })}>${icon("add", "s24")}</button></div>` : ""}${tabBar()}${chatSheet()}</div>`;
}
// A root-stack screen: the ScreenHeader row (back, title centred on one line, trailing),
// no tab bar.
function stack(title, content, { back = { s: "account" }, trailing = "", foot = "" } = {}) {
  return `<div class="P"><header class="P-head"><button class="icon-btn" aria-label="Retour" ${goAttr(back)}>${icon("arrow-back")}</button><span class="P-title ell">${title}</span>${trailing || `<span style="width:40px"></span>`}</header>
    <div class="P-scroll scroll P-pad">${content}</div>${foot}${chatSheet()}</div>`;
}

// ---------------------------------------------------------------- Accueil (inbox.tsx)

function homeP() {
  const recent = [...MEDIA.filter((m) => m.status), ...MEDIA.filter((m) => !m.status && !m.folder).reverse().slice(0, 6), ...MEDIA.filter((m) => m.folder).slice(0, 4)].slice(0, 12);
  const cont = [MEDIA[0], { fd: C().memory }, MEDIA[1], MEDIA[12], { fd: C().roots[4] }, MEDIA[5]];
  const row = (ic, title, tiles) => `<section class="P-row"><div class="row P-rowhead">${icon(ic, "s18")}<h2 class="headline">${title}</h2></div><div class="P-track">${tiles.join("")}</div></section>`;
  return `<div class="P-home">${S.warn === "0" ? "" : `<div class="banner warn">${icon("time-outline", "s16")}<span class="grow">Vous avez utilisé 82 % des minutes de ce mois-ci. Elles se rechargent le 1er novembre.</span><button class="icon-btn" style="width:28px;height:28px" aria-label="Masquer l'alerte" ${goAttr({ warn: "0" })}>${icon("close", "s16")}</button></div>`}
    ${pdeck(QUEUE().length)}
    ${row("sparkles", "Ajouts récents", recent.map((m) => homeTile(m)))}
    ${row("play-circle-outline", "Reprendre l'apprentissage", cont.map((x) => (x.fd ? folderHomeTile(x.fd) : homeTile(x))))}</div>`;
}
// UnsortedReviewButton, variant F "Deck tactile".
function pdeck(count) {
  if (!count) return "";
  return `<button class="P-deck" ${goAttr({ s: "unsorted", pos: "1" })} aria-label="Passer en revue vos médias non classés, ${count} éléments"><span class="plate back"></span><span class="plate mid"></span>
    <span class="P-deck-face"><span class="P-deck-ico">${icon("albums-outline", "s24")}<b>${count}</b></span><span class="P-deck-label">Revue des non classés</span><span class="P-deck-go">${icon("chevron-forward", "s18")}</span></span></button>`;
}

// ---------------------------------------------------------------- Recherche (search.tsx)

function libraryP() {
  const q = S.s === "search" ? S.sq || "pause" : "";
  const pill = `<label class="field P-pill">${icon("search-outline", "s18")}<input placeholder="Rechercher dans votre bibliothèque…" aria-label="Rechercher dans votre bibliothèque" value="${esc(q)}" onkeydown="if(event.key==='Enter')go({s:'search',sq:this.value||'pause'})">${q ? `<button class="icon-btn" style="width:28px;height:28px" aria-label="Effacer" ${goAttr({ s: "library", sq: null })}>${icon("close", "s16")}</button>` : ""}</label>`;
  if (q) {
    const folders = searchFolders(C(), q, 9);
    return `${pill}<div class="P-pad"><div class="small muted" style="margin:4px 0 12px">${SEARCH_HITS.length} résultats</div>
      ${folders.length ? `<div class="row" style="margin-bottom:8px"><h2 class="headline grow">Dossiers</h2>${icon("chevron-down", "s18")}</div><div class="P-fgrid">${folders.map((f) => folderTile(f)).join("")}</div>` : ""}
      <h2 class="headline" style="margin:16px 0 4px">Médias</h2>${SEARCH_HITS.map((h) => pcard(mediaById(h.media), `<div class="small subtle" style="margin-top:2px">${h.snippet}</div>`)).join("")}<div class="small muted" style="text-align:center;padding:16px">Fin des résultats</div></div>`;
  }
  const open = S.fold !== "1";
  const all = [...MEDIA.filter((m) => m.status), ...MEDIA.filter((m) => !m.status)];
  return `${pill}<div class="P-pad"><div class="row" style="margin-bottom:8px"><button class="row grow" style="gap:6px" ${goAttr({ fold: open ? "1" : null })} aria-expanded="${open}"><h2 class="headline">Dossiers</h2>${icon(open ? "chevron-down" : "chevron-forward", "s18")}</button><button class="icon-btn" style="color:var(--primary)" aria-label="Nouveau dossier" ${goAttr({ modal: "newfolder" })}>${icon("add", "s24")}</button></div>
    ${open ? `<div class="P-fgrid">${[C().unsorted, ...C().roots].map((f) => folderTile(f)).join("")}</div>` : ""}
    <div class="row" style="margin:20px 0 4px"><h2 class="headline grow">Tous les médias</h2><span class="count">${all.length} éléments</span></div>${all.map((m) => pcard(m)).join("")}</div>`;
}
// MediaListCard: 16:9 cover, type and age, two-line title, creator.
function pcard(m, extra = "") {
  return `<button class="P-mcard" ${goAttr({ s: "media", m: m.id, art: null, chat: null, tab: "reader" })}>${wcover(m, 112, { radius: 8 })}<span class="grow"><span class="meta">${typeBadge(m)}<span>${esc(m.age)}</span></span><span class="t clamp2">${esc(m.title)}</span><span class="small muted ell" style="display:block">${m.status === "processing" ? "En cours de traitement" : esc(m.creator)}</span>${extra}</span></button>`;
}

// ---------------------------------------------------------------- media page (CompletedDetailView)

function mediaP(m, { inDigest = false } = {}) {
  const t = S.tab === "ai" ? "ai" : "reader";
  const ready = !m.status;
  const body = `<div class="P-hero" style="background:linear-gradient(135deg, ${m.color}, ${m.color}cc)">${inDigest ? "" : `<button class="P-glass l" aria-label="Retour" ${goAttr(m.folder ? { s: "folder", f: C().memory.id, art: null, chat: null, tab: "sources" } : { s: "library", art: null, chat: null })}>${icon("arrow-back", "s18")}</button>`}<button class="P-glass r" data-act="menu:media:${m.id}" aria-label="Ranger, renommer, supprimer">${icon("ellipsis-horizontal", "s18")}</button>
      <span class="P-hero-glyph">${icon(TYPE_META[m.type].icon)}</span><div class="P-strip"><div class="caps" style="color:var(--text-main)">${esc(m.creator)}</div><h1 class="clamp2">${esc(m.title)}</h1></div></div>
    <div class="P-pad"><div style="margin:12px 0">${metaLine(m)}</div>
    ${ready ? `<div class="seg P-seg"><button class="${t === "reader" ? "on" : ""}" ${goAttr({ tab: "reader" })}>${icon("book-outline", "s16")} Lecture</button><button class="${t === "ai" ? "on" : ""}" ${goAttr({ tab: "ai", chat: null })}>${icon("sparkles-outline", "s16")} IA</button></div>` : ""}
    <div style="margin-top:16px">${mediaStateBody(m) || (t === "ai" ? aiListP("media") : previewBlock().replace("L'essentiel", "L'essentiel") + readerText().replace("Texte intégral", "Texte complet"))}</div></div>`;
  const dock = ready && t === "reader" ? chatDock("media") : "";
  if (inDigest) return { body, dock };
  return `<div class="P"><div class="P-scroll scroll" style="padding-bottom:${dock ? 96 : 24}px">${body}</div>${dock}${chatSheet()}</div>`;
}
// ArtifactsPanel: "Générer", one full-width row per type, then "Généré".
function aiListP(scope) {
  const states = scope === "folder" ? FOLDER_ARTIFACTS : MEDIA_ARTIFACTS;
  const hist = scope === "folder" ? FOLDER_HISTORY : MEDIA_HISTORY;
  const label = { summaryShort: "Résumé", summaryDetailed: "Résumé détaillé", notes: "Notes de cours", flashcards: "Cartes mémo", quiz: "Quiz" };
  const st = (s) => ({ generated: `<span class="small subtle">${icon("checkmark-circle", "s14")} Généré</span>`, generating: `<span class="small subtle">${icon("sync", "s14")} Génération…</span>`, queued: `<span class="small subtle">${icon("time-outline", "s14")} En attente</span>`, failed: `<span class="small" style="color:var(--error)">${icon("alert-circle-outline", "s14")} Échec · Réessayer</span>`, idle: icon("chevron-forward", "s16") })[s];
  return `<h2 class="headline" style="margin-bottom:10px">Générer</h2>${ARTIFACT_TYPES.map((a) => `<button class="P-art" ${states[a.key] === "generated" ? goAttr({ art: a.key }) : ""}>${icon(a.icon, "s18")}<span class="grow label">${label[a.key]}</span>${st(states[a.key])}</button>`).join("")}
    <h2 class="headline" style="margin:22px 0 10px">Généré</h2>${hist.map((h) => { const a = ARTIFACT_TYPES.find((x) => x.key === h.type); return `<button class="P-art" ${goAttr({ art: h.type })}>${icon(a.icon, "s18")}<span class="grow"><span class="label ell" style="display:block">${esc(h.title)}</span><span class="small muted">${h.sources ? `${h.sources} sources · ` : ""}${h.when}</span></span>${icon("chevron-forward", "s16")}</button>`; }).join("")}`;
}
function artifactP() {
  const scope = S.s === "folder" ? "folder" : "media";
  S.from = scope;
  const a = ARTIFACT_TYPES.find((x) => x.key === S.art) || ARTIFACT_TYPES[0];
  return stack(a.label, artifactView(S.art).replace('class="display"', 'class="headline" style="font-size:24px"').replace(/grid-template-columns:repeat\(auto-fill,minmax\(260px,1fr\)\)/, "grid-template-columns:1fr"), { back: { art: null } });
}

// ---------------------------------------------------------------- chat (ChatDock + ChatSheet)

function chatDock(scope) {
  const busy = ["sending", "streaming", "resuming"].includes(S.cs);
  return `<div class="P-dock"><button class="P-dockfield" ${goAttr({ chat: "open" })}>${icon("chatbubble-ellipses-outline", "s18")}<span class="grow ell">${busy ? "Une réponse est en cours…" : scope === "media" ? "Poser une question sur cette source…" : "Poser une question sur ce dossier…"}</span>${busy ? `<span class="typing"><i></i><i></i><i></i></span>` : icon("arrow-up", "s18")}</button></div>`;
}
function chatSheet() {
  if (S.chat !== "open") return "";
  const scope = S.s === "folder" ? "folder" : "media";
  const d = CHAT[scope];
  const hist = S.cs === "history";
  const empty = S.conv === "new";
  const head = `<header class="P-sheethead">${hist ? `<button class="icon-btn" aria-label="Revenir à la conversation" ${goAttr({ cs: "idle" })}>${icon("arrow-back")}</button>` : ""}<div class="grow"><div class="label ell">${hist ? "Conversations passées" : empty ? "Nouvelle conversation" : esc(d.conversations[0].title)}</div><div class="small muted">${scope === "media" ? "Sur cette source" : "Sur ce dossier"}</div></div>
    ${hist ? "" : `<button class="icon-btn" aria-label="Conversations passées" ${goAttr({ cs: "history" })}>${icon("time-outline", "s18")}</button><button class="icon-btn" aria-label="Nouvelle conversation" ${goAttr({ conv: "new", cs: "idle" })}>${icon("create-outline", "s18")}</button>`}<button class="icon-btn" aria-label="Fermer" ${goAttr({ chat: null })}>${icon("close", "s18")}</button></header>`;
  const body = hist ? convList(scope) : empty ? `<p class="subtle" style="margin:8px 0 12px">${scope === "media" ? "Posez une question sur cette source. Les réponses citent les passages sur lesquels elles s'appuient." : "Posez une question sur ce dossier. Les réponses citent les sources sur lesquelles elles s'appuient."}</p><div class="row" style="flex-wrap:wrap">${d.suggestions.map((x) => `<button class="chip">${x}</button>`).join("")}</div>` : thread(scope);
  return `<div class="P-scrim" ${goAttr({ chat: null })}></div><section class="P-sheet" role="dialog" aria-label="Discussion"><span class="P-grab"></span>${head}<div class="P-sheetbody scroll">${body}</div>${hist ? "" : `<div class="P-sheetfoot">${composer(scope, { compact: true }).replace(scope === "media" ? "Question sur ce média…" : "Question sur les sources de ce dossier…", scope === "media" ? "Poser une question sur cette source…" : "Poser une question sur ce dossier…")}</div>`}</section>`;
}

// ---------------------------------------------------------------- folder ([id].tsx)

function folderP() {
  const f = curF();
  const t = S.tab === "ai" ? "ai" : "sources";
  const src = sourcesOf(C(), f);
  const subs = f.children || [];
  const list = `${subs.length ? `<div class="caps" style="margin:4px 0">Dossiers</div>${subs.map((c) => `<button class="P-mcard" ${goAttr({ f: c.id })}>${mosaic(c, 112)}<span class="grow"><span class="t clamp2">${esc(c.name)}</span><span class="small muted">${totalSources(c)} éléments</span></span>${icon("chevron-forward", "s16")}</button>`).join("")}<div class="caps" style="margin:12px 0 4px">Sources · ${src.length}</div>` : ""}${src.map((m) => pcard(m)).join("") || `<div class="O-empty">${icon("file-tray-outline", "s24")}<div class="label">Ce dossier est vide</div></div>`}`;
  const trailing = f.isDefault ? `<span style="width:40px"></span>` : `<button class="icon-btn" data-act="menu:folder:${f.id}" aria-label="Renommer, supprimer">${icon("ellipsis-horizontal")}</button>`;
  return `<div class="P"><header class="P-head"><button class="icon-btn" aria-label="Retour" ${goAttr({ s: "library", f: null, tab: null, chat: null })}>${icon("arrow-back")}</button><span class="P-title ell">${esc(f.name)}</span>${trailing}</header>
    <div class="P-scroll scroll P-pad" style="padding-bottom:${t === "sources" ? 96 : 24}px"><div class="small muted" style="text-align:center;margin:-4px 0 12px">${src.length} sources</div>
    <div class="seg P-seg"><button class="${t === "sources" ? "on" : ""}" ${goAttr({ tab: "sources" })}>${icon("layers-outline", "s16")} Sources</button><button class="${t === "ai" ? "on" : ""}" ${goAttr({ tab: "ai", chat: null })}>${icon("sparkles-outline", "s16")} IA</button></div>
    <div style="margin-top:16px">${t === "ai" ? aiListP("folder") : list}</div></div>${t === "sources" ? chatDock("folder") : ""}${chatSheet()}</div>`;
}

// ---------------------------------------------------------------- Digest (index.tsx, [period].tsx)

function digestP() {
  const pack = (per, label) => {
    const d = DIGEST[per];
    const ms = d.items.slice(0, 3).map(mediaById);
    return `<button class="pack P-pack" ${goAttr({ s: "digestp", dp: per, dpos: "1", tab: "reader" })} aria-label="${label}, ${d.items.length} médias">
      ${ms.slice().reverse().map((m, i) => `<span class="pcard c${2 - i}" style="background:${m.color}">${icon(TYPE_META[m.type].icon, "s24")}${i === ms.length - 1 ? `<span class="pcap"><b class="headline">${label}</b><span class="pill">${d.items.length} médias</span></span>` : ""}</span>`).join("")}</button>`;
  };
  return `<div class="P-pad"><h1 class="display" style="margin:12px 0 16px">Digest</h1>${pack("daily", "Quotidien")}${pack("weekly", "Hebdomadaire")}</div>`;
}
function digestPeriodP() {
  const per = S.dp === "weekly" ? "weekly" : "daily";
  const d = DIGEST[per];
  const pos = Math.min(+S.dpos || 1, d.items.length);
  const { body, dock } = mediaP(mediaById(d.items[pos - 1]), { inDigest: true });
  const dots = d.items.slice(0, 7).map((_, i) => `<span class="dot ${i + 1 === pos ? "on" : ""}"></span>`).join("");
  return `<header class="P-band"><button class="icon-btn" aria-label="Retour" ${goAttr({ s: "digest" })}>${icon("arrow-back")}</button><span class="grow"></span><span class="row" style="gap:6px">${dots}</span><span class="label">${pos} / ${d.items.length}</span><span class="grow"></span>
    <button class="icon-btn" aria-label="Média suivant" ${goAttr({ dpos: String(Math.min(d.items.length, pos + 1)) })}>${icon("chevron-forward")}</button></header>
    <div class="P-scroll scroll" style="padding-bottom:${dock ? 96 : 24}px">${body}</div>${dock ? dock.replace('class="P-dock"', 'class="P-dock intabs"') : ""}`;
}

// ---------------------------------------------------------------- Revue des non classés (unsorted-review.tsx)

function unsortedP() {
  const q = QUEUE();
  if (S.done === "1") return `<div class="P"><header class="P-head"><button class="icon-btn" aria-label="Fermer" ${goAttr({ s: "home", done: null })}>${icon("close")}</button><span class="P-title">Revue des non classés</span><span style="width:40px"></span></header>
    <div class="O-empty" style="margin-top:20vh">${icon("checkmark-circle-outline", "s24")}<div class="headline">Plus rien à trier</div><p class="subtle">Tout ce qui attendait a été traité.</p><button class="btn primary" ${goAttr({ s: "home", done: null })}>Terminé</button></div></div>`;
  const pos = Math.min(+S.pos || 1, q.length);
  const m = q[pos - 1];
  const next = { pos: String(Math.min(q.length, pos + 1)) };
  return `<div class="P"><header class="P-head"><button class="icon-btn" aria-label="Fermer" ${goAttr({ s: "home" })}>${icon("close")}</button><span class="P-title">Revue des non classés</span><span class="label" style="min-width:40px;text-align:right;padding-right:8px">${pos} / ${q.length}</span></header>
    <div class="P-scroll P-pad" style="overflow:hidden"><div class="row" style="align-items:flex-start;gap:12px;margin-top:8px">${wcover(m, 128, { radius: 8 })}<div class="grow"><div class="label clamp2" style="font-size:16px;font-weight:600">${esc(m.title)}</div><div class="small subtle" style="margin-top:2px">${esc(m.creator)}</div></div></div>
      <div class="P-tcard"><p style="margin:0 0 10px;font-weight:600">${PREVIEW.blurb}</p><ul>${PREVIEW.points.map((p) => `<li>${p}</li>`).join("")}</ul></div>
      <p class="small muted" style="text-align:center">Balayez vers la gauche ou la droite pour passer d'une source à l'autre</p></div>
    <div class="P-actions"><button ${goAttr({ ...next, toast: "Source jetée" })}>${icon("close", "s24")}<span>Jeter</span></button><button ${goAttr({ s: "media", m: m.id, tab: "reader" })}>${icon("book-outline", "s24")}<span>Approfondir</span></button><button class="on" ${goAttr({ modal: "move", target: m.id })}>${icon("folder-open", "s24")}<span>Ranger</span></button></div></div>`;
}

// ---------------------------------------------------------------- Compte (account.tsx)

function accountP() {
  const beta = S.beta !== "0";
  const item = (ic, label, sub, patch) => `<button class="P-menu-item" ${patch ? goAttr(patch) : ""}><span class="P-menu-ico">${icon(ic, "s18")}</span><span class="grow"><span class="label" style="display:block;font-size:16px">${label}</span>${sub ? `<span class="small muted">${sub}</span>` : ""}</span>${icon("chevron-forward", "s16")}</button>`;
  return `<div class="P-pad"><div class="small muted" style="margin-top:16px">Connecté avec</div><h1 class="headline" style="margin-bottom:16px">vous@exemple.fr</h1>
    <div class="card" style="padding:16px 20px;margin-bottom:16px"><div class="caps">Votre formule</div><div class="headline" style="margin-top:4px">${beta ? "Accès bêta" : "Formule active"}</div>
      <div class="row" style="margin-top:12px;align-items:flex-end"><div class="grow"><div class="caps">Minutes restantes</div><div class="display">412 <span class="small muted">/ 2 400</span></div></div><div style="text-align:right"><div class="caps">Renouvellement</div><div class="label">1 nov. 2026</div></div></div>
      <p class="small subtle" style="margin:8px 0 0">${beta ? "Pendant la bêta, chaque compte reçoit l'allocation de la plus grande formule." : "Les minutes couvrent l'audio et la vidéo envoyés."}</p></div>
    ${beta ? "" : `<div class="P-menu" style="margin-bottom:16px">${item("shield-checkmark", "Changer de formule", "Comparez les formules et changez", { sec: "plans" })}</div>`}
    <div class="P-menu">${item("language-outline", "Langue de lecture", "Français", { sec: "reading" })}${item("globe-outline", "Langue de l'app", "Suivre l'appareil", { sec: "ui" })}${item("contrast-outline", "Thème", S.theme === "dark" ? "Sombre" : "Clair", { sec: "theme" })}${item("bulb-outline", "Suggestions", "", null)}${item("bug-outline", "Signaler un bug", "", { sec: "bug" })}
      <div class="P-menu-sep"></div><button class="P-menu-item danger" ${goAttr({ modal: "signout" })}><span class="P-menu-ico">${icon("log-out-outline", "s18")}</span><span class="grow label" style="font-size:16px">Se déconnecter</span></button>
      <button class="P-menu-item danger" ${goAttr({ sec: "delete" })}><span class="P-menu-ico">${icon("trash-outline", "s18")}</span><span class="grow label" style="font-size:16px">Supprimer le compte</span>${icon("chevron-forward", "s16")}</button></div>
    <p class="small muted" style="text-align:center;margin:16px 0">Deepn · version web</p></div>`;
}
function settingsP() {
  const sec = S.sec || S.sub;
  if (sec === "plans") return paywallBody();
  if (sec === "bug" || sec === "ideas") return accountSection(sec, S.beta !== "0").replace(/<h1 class="display"[^>]*>[^<]*<\/h1>/, "");
  S.sub = sec;
  return settingsBody().replace(/<h1 class="display">[^<]*<\/h1>/, "");
}

// ---------------------------------------------------------------- sheets (AddSourceSheet, FolderSaveSheet)

function addSheetP() {
  const opt = (ic, l, d, patch) => `<button class="P-opt" ${goAttr(patch)}><span class="P-menu-ico">${icon(ic, "s18")}</span><span class="grow"><span class="label" style="display:block;font-size:16px">${l}</span><span class="small muted">${d}</span></span></button>`;
  return `<div class="P-scrim" ${goAttr({ modal: null })}></div><section class="P-sheet short" role="dialog" aria-label="Ajouter à votre boîte de réception"><span class="P-grab"></span><h2 class="headline" style="padding:4px 20px 8px">Ajouter à votre boîte de réception</h2><div style="padding:0 12px 24px">
    ${opt("link-outline", "Coller un lien", "Un article, une vidéo ou un épisode de podcast, où que ce soit sur le web.", { modal: "add2" })}${opt("document-attach-outline", "Importer un fichier", "Un PDF, un document Office, une image ou un fichier audio depuis votre téléphone.", { modal: "add2" })}${opt("images-outline", "Importer une photo", "Choisissez une photo déjà présente dans votre galerie.", { modal: "add2" })}</div></section>`;
}
function folderSheetP() {
  return `<div class="P-scrim" ${goAttr({ modal: null })}></div><section class="P-sheet" role="dialog" aria-label="Ranger dans un dossier"><span class="P-grab"></span><header class="P-sheethead"><div class="grow label">Ranger dans un dossier</div><button class="icon-btn" aria-label="Fermer" ${goAttr({ modal: null })}>${icon("close", "s18")}</button></header>
    <div class="P-sheetbody scroll">${folderPickerBody({ onPick: (f) => ({ modal: null, ...(S.s === "unsorted" ? { pos: String(Math.min(QUEUE().length, (+S.pos || 1) + 1)) } : {}), toast: `Rangé dans « ${f.name} »` }) })}</div></section>`;
}
