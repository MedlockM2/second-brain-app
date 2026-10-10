// Assembles each direction into one self-contained code.html (no <link>, no external
// <script>, no <img>: zero network request). Run from the repository root:
//   node docs/research/task-424-website-and-browser-extension/mockup-build/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../../../mobile-design-mockups/web_app");
export const DIRECTIONS = [
  { id: "a", slug: "direction_a_arbre_lateral", title: "Direction A — « L'arbre latéral »" },
  { id: "b", slug: "direction_b_colonnes", title: "Direction B — « Les colonnes »" },
  { id: "c", slug: "direction_c_barre_de_saut", title: "Direction C — « La barre de saut »" },
  { id: "d", slug: "direction_d_flux_a_facettes", title: "Direction D — « Le flux à facettes »" },
  { id: "e", slug: "direction_e_onglets_de_travail", title: "Direction E — « Les onglets de travail »" },
];
const read = (f) => readFileSync(join(here, f), "utf8");

// One active set of directions only: remove every direction_* directory of earlier passes.
const slugs = new Set(DIRECTIONS.map((d) => d.slug));
for (const d of readdirSync(out)) if (d.startsWith("direction_") && !slugs.has(d)) rmSync(join(out, d), { recursive: true, force: true });

const only = process.argv.slice(2);
for (const d of DIRECTIONS.filter((x) => !only.length || only.includes(x.id))) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deepn — ${d.title}</title>
<!--
  task-424, troisième passe — maquette de l'APP WEB CONNECTÉE de Deepn. Autonome : aucune
  balise <link>, <img> ni <script src>, donc aucune requête réseau.
  Généré par docs/research/task-424-website-and-browser-extension/mockup-build/build.mjs
  (noyau commun + coquille propre à la direction) : modifier les sources, pas ce fichier.

  - Tokens : mobile/src/constants/theme.ts, clair et sombre, repris verbatim.
  - Polices : Plus Jakarta Sans et Inter déclarées ; sans réseau, repli système.
  - Icônes : contours exacts d'Ionicons.ttf (@expo/vector-icons), extraits par extract_icons.py.
  - Couvertures : bloc teinté portant le glyphe du type, substitut déclaré des vignettes.
  - Corpus : 295 dossiers sur trois niveaux, noms longs et homonymes (data.js) ; variantes
    à 7 et à 1 018 dossiers par #corpus=small / #corpus=xl.
  - Chaque état est adressable par le hash ; le bouton « Parcours de la maquette » liste
    les parcours de l'inventaire. #shot=1 le masque pour les captures.
-->
<style>
${read("core.css")}
${read(`dir_${d.id}.css`)}
</style>
</head>
<body>
<div id="app"></div>
<script>
${read("icons.js")}
${read("data.js")}
${read("core.js")}
${read(`dir_${d.id}.js`)}
boot();
</script>
</body>
</html>
`;
  mkdirSync(join(out, d.slug), { recursive: true });
  writeFileSync(join(out, d.slug, "code.html"), html);
  console.log(d.slug, (html.length / 1024).toFixed(0) + " KB");
}
