// Builds lecture_article_lisible/code.html: the "Full text" of a web article made readable again
// (TestFlight feedback ANPCT7VWg0qWWuHgKePMPXA, build 27, 2026-11-11), drawn on the article the
// tester named — the Le Monde column stored on -dev under job c6f932f0.
// Usage (from the repository root): node mobile-design-mockups/lecture_article_lisible/_build/build.mjs
// Render (Node 20 needs --experimental-websocket): DIRS=lecture_article_lisible node --experimental-websocket mobile-design-mockups/auth_directions/_build/shoot.mjs [frames-dir]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ic, phone, page, textTable } from "../../auth_directions/_build/kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..");

// The free part of the article, verbatim from the stored transcript (lines 1-7).
const LEAD = "Si la politique à l’égard d’Israël n’est plus un sujet de division au sein du Parti démocrate, des dissensions sont en revanche à attendre sur la relation avec la Chine, analyse Gilles Paris, éditorialiste au « Monde », dans sa chronique.";
const META = ["Publié aujourd’hui à 06h00, modifié à 10h14Temps de Lecture 3 min.", "Article réservé aux abonnés"];
const BODY = [
  "Les élections de mi-mandat, aux Etats-Unis, ont tourné le 3 novembre à la déroute pour Donald Trump, en bonne partie pour une raison résumée par une formule de l’ancien conseiller à la sécurité nationale du démocrate Joe Biden, Jake Sullivan. On peut bien ânonner « l’Amérique d’abord » jusqu’à l’ennui, « la politique étrangère est de la politique intérieure et la politique intérieure est de la politique étrangère ». Le président a convenu que sa guerre calamiteuse contre l’Iran pouvait expliquer sa répudiation. Il fallait y penser avant.",
  "Ces élections ont aussi été l’occasion d’un exercice de droit d’inventaire à propos du bilan diplomatique de Joe Biden. Il était temps. La direction du Parti démocrate avait en effet refusé de mettre ce bilan en débat après la défaite de Kamala Harris, en novembre 2024. Une vision du monde s’estompe. Une nouvelle reste à inventer.",
  "En arrivant au pouvoir, le dernier démocrate à avoir occupé le bureau Ovale de la Maison Blanche avait annoncé le « retour » des Etats-Unis. Il entendait refermer ce qui était présenté comme une parenthèse aberrante faite de désordres, dont Donald Trump aurait été le seul et unique facteur. Il fallait entendre le retour à une diplomatie respectueuse des alliances et des mécanismes multilatéraux constitutifs d’un ordre international fondé sur des règles, selon la formule. Un ordre pourtant attaqué de toutes parts, à commencer par ce qui était alors qualifié de puissances révisionnistes, chinoise et russe.",
  "Le verbe était fleuri, mais bardé d’épines. Le mandat de l’ancien président de l’influente commission des affaires étrangères du Sénat, choisi comme vice-président par Barack Obama pour sa connaissance des dossiers internationaux, a ainsi ancré les Etats-Unis dans le protectionnisme à la suite de Donald Trump, aux dépens des Européens. Joe Biden a fait également sien le passage en force au sein de son propre camp avec l’accord militaire Aukus, négocié en 2021 avec le Royaume-Uni et l’Australie, en piétinant les intérêts français.",
];
// What follows the free part today, verbatim (lines 8-13 of 119).
const TAIL = [
  "Il vous reste 65.98% de cet article à lire. La suite est réservée aux abonnés.",
  "La suite est réservée à nos abonnés.",
  "Votre abonnement est suspendu.",
  "Mettez à jour vos informations de paiement pour rester abonné.",
  "Accéder gratuitement en acceptant l’utilisation de vos données.",
  "L’accès gratuit au site (hors contenus exclusifs abonnés) est subordonné à votre consentement sur l’utilisation de vos données à des fins de personnalisation et de ciblage publicitaire…",
];

const CSS = `
.rd-head { position: absolute; top: 54px; left: 0; right: 0; height: 64px; display: flex; align-items: center; gap: 12px; padding: 0 16px 0 20px; z-index: 6; background: var(--background); }
.rd-head .bk { color: var(--text-main); display: flex; transform: rotate(180deg); }
.rd-head .th { width: 32px; height: 32px; border-radius: 8px; flex: none; background: linear-gradient(135deg,#5a4a42,#2a2320 60%,#6b5a3a); }
.rd-head .tt { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rd-head .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--surface-container); flex: none; }
.rd-head .tabs span { width: 44px; height: 44px; border-radius: 22px; display: flex; align-items: center; justify-content: center; color: var(--text-subtle); }
.rd-head .tabs span.on { background: var(--primary); color: var(--on-primary); }
.rd-prog { position: absolute; top: 118px; left: 0; right: 0; height: 3px; background: var(--surface-container); z-index: 6; }
.rd-prog i { display: block; height: 3px; background: var(--primary); }
.rd { position: absolute; top: 121px; left: 0; right: 0; bottom: 96px; padding: 18px 24px 0; overflow: hidden; }
.rd h3 { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
.rd p { margin: 0; font-size: 16px; line-height: 25.6px; color: var(--text-main); }
.rd.now p { margin: 0; }
.rd.new p + p { margin-top: 16px; }
.rd .lead { font-size: 18px; line-height: 28px; font-weight: 500; }
.rd.new > * + * { margin-top: 16px; }
.rd h4 { font-size: 20px; font-weight: 600; line-height: 26px; margin: 8px 0 0; }
.rd ul { margin: 0; padding-left: 22px; font-size: 16px; line-height: 25.6px; }
.rd.now ul { margin-top: 16px; }
.rd .cut { margin-top: 24px; border-radius: 12px; background: var(--surface-container-low); padding: 16px; display: flex; gap: 12px; align-items: flex-start; }
.rd .cut .ic { color: var(--text-subtle); margin-top: 2px; }
.rd .cut b { display: block; font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.rd .cut span { display: block; font-size: 14px; line-height: 20px; color: var(--text-subtle); }
.rd .cut a { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 14px; font-weight: 600; color: var(--text-main); }
.rd-ask { position: absolute; left: 16px; right: 16px; bottom: 30px; height: 56px; border-radius: 28px; background: var(--surface-container); display: flex; align-items: center; gap: 12px; padding: 0 20px; color: var(--text-muted); font-size: 16px; z-index: 6; }
.rd-fade { position: absolute; left: 0; right: 0; bottom: 0; height: 120px; background: linear-gradient(transparent, var(--background) 22px); z-index: 5; }
.facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 8px 0 4px; }
.fact { background: var(--surface-container-low); border-radius: 12px; padding: 14px 16px; }
.fact b { display: block; font-size: 26px; font-weight: 750; letter-spacing: -.4px; }
.fact span { font-size: 13.5px; color: var(--text-subtle); line-height: 1.45; }
`;

const header = (progress, title = "« Aux Etats-Unis, les démocrates ont deux ans pour redessiner une politique étrangère à partir d’un champ de ruines »") => `
<div class="rd-head"><span class="bk">${ic("arrow-forward", 24)}</span><span class="th"></span>
<span class="tt">${title}</span>
<span class="tabs"><span class="on">${ic("book-outline", 20)}</span><span>${ic("sparkles-outline", 20)}</span></span></div>
<div class="rd-prog"><i style="width:${progress}%"></i></div>`;
const ask = `<div class="rd-fade"></div><div class="rd-ask">${ic("chatbubbles-outline", 22)}Poser une question sur cette source…</div>`;

// Today: one block, single line breaks, everything at body size — then the paywall and the
// consent notice read as the article.
const now = `${header(1)}<div class="rd now"><h3>Texte complet</h3>
<p>${[LEAD, ...META, ...BODY].join("<br>")}</p></div>${ask}`;

const nowEnd = `${header(9)}<div class="rd now" style="padding-top:0">
<p>${[BODY[3], ...TAIL].join("<br>")}</p></div>${ask}`;

// Proposed: paragraphs apart, the standfirst as a lead when the page declares it as its description.
const top = `${header(4)}<div class="rd new"><h3 style="margin:0">Texte complet</h3>
<p class="lead">${LEAD}</p>
${[...META, ...BODY.slice(0, 2)].map((p) => `<p>${p}</p>`).join("")}</div>${ask}`;

// Two other articles, through the same pipelines and the client's own Markdown parser
// (fragments generated by the benchmark script; see README).
const OTHER = JSON.parse(readFileSync(join(HERE, "autres_articles.json"), "utf8"));
const TITLES = {
  franceinfo: "La Fondation pour la Nature et l'Homme alerte sur les conséquences environnementales de l'augmentation de la production de poulets",
  joel: "The Joel Test: 12 Steps to Better Code",
};
const otherPhone = (name, which) => `${header(2, TITLES[name])}<div class="rd ${which === "old" ? "now" : "new"}"><h3${which === "new" ? ' style="margin:0"' : ""}>Texte complet</h3>${OTHER[name][which]}</div>${ask}`;

// Proposed, end of what could be read: the text stops, and says so.
const end = `${header(100)}<div class="rd new" style="padding-top:18px">
<p>${BODY[3]}</p>
<div class="cut">${ic("lock-closed-outline", 20)}<div><b>Texte incomplet</b><span>Le site réserve la suite de cet article à ses abonnés. Deepn n’a pu lire que ce début ; le résumé et le chat portent sur cette partie.</span><a>${ic("open-outline", 16)}Lire la suite sur le site</a></div></div></div>${ask}`;

const body = `
<div class="kicker">Retour TestFlight ANPCT7VWg0qWWuHgKePMPXA · build 27 · iPhone 11, iOS 26.6</div>
<h1>Un article lisible dans « Texte complet »</h1>
<p class="lede">« Certains articles ont un rendu peu lisible : tout le texte fait la même taille et n’est pas espacé. » Testé sur l’article du <i>Monde</i> cité par le retour, avec son texte réellement stocké sur <code>-dev</code>.</p>

<section class="panel">
<h2 style="margin-top:0">Ce qui est stocké aujourd’hui</h2>
<div class="facts">
<div class="fact"><b>7 %</b><span>du texte stocké est l’article : 2 500 caractères sur 34 170, soit le chapô et quatre paragraphes.</span></div>
<div class="fact"><b>93 %</b><span>sont la fin de lecture « réservée aux abonnés » puis la fenêtre de consentement aux cookies, lue par le navigateur de rendu comme du texte d’article.</span></div>
<div class="fact"><b>1 bloc</b><span>à l’écran : l’extraction sépare les paragraphes par un simple retour à la ligne. Les puces de la liste des cookies font prendre le tout pour du Markdown, et le découpage en paragraphes est sauté.</span></div>
</div>
<p class="caption" style="padding:0;margin-top:10px">Le résumé, la traduction, le chat et la recherche lisent ce même texte : ils portent eux aussi sur les cookies.</p>
</section>

<h2>Aujourd’hui</h2>
<div class="cells">
${phone(now, { dark: true, title: "Haut de l’article", caption: "Reproduit d’après la capture : chapô, date, mention abonnés et paragraphes forment un seul bloc à la même taille." })}
${phone(nowEnd, { dark: true, title: "Après le dernier paragraphe", caption: "Le texte continue avec l’offre d’abonnement, puis 110 lignes de consentement aux cookies." })}
</div>

<h2>Proposé</h2>
<div class="cells">
${phone(top, { dark: true, title: "Haut de l’article", caption: "Paragraphes séparés de 16 pt (tokens existants). Chapô en 18 pt medium, seulement si la page déclare ce paragraphe, mot pour mot, comme sa description : non vérifié pour <i>Le Monde</i>, la page répond 402 à une requête simple. La date et la mention abonnés restent du texte ordinaire : aucune règle générique ne les reconnaît." })}
${phone(end, { dark: true, title: "Fin du texte lu", caption: "Le texte s’arrête sur le dernier paragraphe lu. Quand la page se déclare payante, une mention le dit et renvoie au site. Ni offre d’abonnement, ni cookies." })}
</div>

<h2>Vérification sur deux autres articles</h2>
<p class="lede" style="font-size:15.5px!important;max-width:92ch">Deux articles d’autres sites et de structure différente : une brève de <b>franceinfo</b> avec chapô et intertitre, et un billet de blog anglais avec une liste (<b>Joel on Software</b>, « The Joel Test »). Pour chacun, l’ancienne chaîne (<code>extract_clean_text</code> du dépôt, inchangé) et la nouvelle (un seul prototype, appliqué tel quel), dessinées par le parseur Markdown du client (<code>parseChatMarkdown</code>).</p>
<section class="panel">
<table class="t"><thead><tr><th>Article</th><th>Paragraphes à l’écran, avant → après</th><th>Texte stocké, avant → après</th><th>Ce qui a été retiré</th><th>Chapô</th></tr></thead><tbody>
<tr><td><i>Le Monde</i> (retour)</td><td>1 bloc → 7 paragraphes</td><td>34 170 → ~2 500 car. (calculé à la main)</td><td>abonnement et cookies</td><td>à confirmer</td></tr>
<tr><td>franceinfo</td><td class="old">1 bloc de 87 lignes → <b>8 paragraphes et 1 intertitre</b></td><td>5 835 → 2 593 car.</td><td>39 listes de liens (vidéos associées), 10 éléments de consentement. Il reste « Vous pouvez désormais privilégier… » et « Shorts ».</td><td>oui : la description est identique</td></tr>
<tr><td>Joel on Software</td><td class="old">1 bloc puis listes collées → <b>49 paragraphes et 13 listes</b></td><td>20 127 → 20 188 car.</td><td>rien dans l’article (1 liste de navigation, hors texte)</td><td>non : la description n’est qu’un extrait tronqué</td></tr>
</tbody></table>
<p class="caption" style="padding:0;margin-top:10px">Sur les deux articles, l’ancienne chaîne produit 0 séparation de paragraphe : le mur de texte n’est pas propre au <i>Monde</i>. Le prototype a fait apparaître deux défauts, corrigés pour tous les articles à la fois : des astérisques visibles (la sortie Markdown de trafilatura écrit <code>*really shouldn’t *use</code>), d’où une conversion depuis sa sortie XML, et le titre répété en tête.</p>
</section>
<div class="cells">
${phone(otherPhone("franceinfo", "old"), { dark: true, title: "franceinfo · aujourd’hui", caption: "Chapô, titre, intertitre et paragraphes en un seul bloc." })}
${phone(otherPhone("franceinfo", "new"), { dark: true, title: "franceinfo · proposé", caption: "Chapô reconnu par la description déclarée, intertitre en 20 pt, paragraphes séparés." })}
</div>
<div class="cells" style="margin-top:28px">
${phone(otherPhone("joel", "old"), { dark: true, title: "Joel · aujourd’hui", caption: "La liste est reconnue, mais les paragraphes autour restent collés." })}
${phone(otherPhone("joel", "new"), { dark: true, title: "Joel · proposé", caption: "Paragraphes séparés, liste intacte, pas de chapô : aucun n’est déclaré." })}
</div>

<section class="panel">
<h2 style="margin-top:0">Ce qui change</h2>
${textTable([
  ["Rendu navigateur (backend)", "La fenêtre de consentement est dans la page lue par trafilatura.", "Les fenêtres modales et les bandeaux de consentement sont retirés de la page rendue avant l’extraction, d’après leur forme (<code>role=\"dialog\"</code>, <code>aria-modal</code>, conteneurs CMP standard) et jamais d’après le site."],
  ["Extraction (backend)", "<code>output_format=\"txt\"</code> : paragraphes collés, intertitres, citations et listes perdus.", "Sortie XML de trafilatura convertie en Markdown sans italiques : une ligne vide entre les paragraphes, et les intertitres, citations et listes conservés. Le lecteur sait déjà les afficher (<code>MarkdownBody</code>)."],
  ["Blocs de liens (backend)", "« Vidéos associées », « À lire aussi » : stockés comme du texte.", "Retrait des listes dont au moins 80 % des éléments sont presque entièrement des liens."],
  ["Article payant (backend)", "« Il vous reste 65.98 %… » et l’offre d’abonnement sont stockés comme du texte.", "Le bloc payant est retiré, et l’article est marqué incomplet quand la page le déclare (balisage schema.org <code>isAccessibleForFree</code>, à confirmer sur la page rendue du <i>Monde</i>)."],
  ["Lecteur (mobile et web)", "Tout le texte est au corps 16 pt.", "Chapô seulement si le premier paragraphe est identique à la description déclarée par la page. Sinon, rien de plus que les paragraphes et les intertitres."],
])}
<p class="caption" style="padding:0;margin-top:10px">Coût : backend (API, workers, image de rendu web), puis OTA et web pour le lecteur. Aucun nouveau build. Un article déjà importé garde son texte : il faudra le repartager après le déploiement.</p>
</section>`;

writeFileSync(join(OUT, "code.html"), page({ title: "Article lisible — Texte complet", body }).replace("</style>", `${CSS}</style>`));
console.log("wrote", join(OUT, "code.html"));
