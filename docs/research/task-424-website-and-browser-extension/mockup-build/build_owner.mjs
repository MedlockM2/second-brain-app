// Assembles the owner's direction (2026-10-11) into one self-contained code.html, from the
// same shared core as the five directions. Run from the repository root:
//   node docs/research/task-424-website-and-browser-extension/mockup-build/build_owner.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../../../mobile-design-mockups/web_app_owner_direction");
const read = (f) => readFileSync(join(here, f), "utf8");
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deepn — Direction de l'owner</title>
<!--
  task-424 — maquette de l'APP WEB CONNECTÉE de Deepn, direction de l'owner (2026-10-11) :
  barre horizontale de la direction B ; Accueil, Bibliothèque, Digest calqués sur le mobile ;
  Non classés et Mon compte adaptés au bureau ; média et dossier en trois volets (NotebookLM).
  Autonome : aucune balise <link>, <img> ni <script src>, donc aucune requête réseau.
  Généré par docs/research/task-424-website-and-browser-extension/mockup-build/build_owner.mjs
  (noyau commun core.* + dir_owner.*) : modifier les sources, pas ce fichier.
  Chaque page est adressable par le hash ; le bouton « Pages de la maquette » les liste.
-->
<style>
${read("core.css")}
${read("dir_owner.css")}
${read("dir_owner_phone.css")}
</style>
</head>
<body>
<div id="app"></div>
<script>
${read("icons.js")}
${read("data.js")}
${read("core.js")}
${read("dir_owner.js")}
${read("dir_owner_phone.js")}
boot();
</script>
</body>
</html>
`;
mkdirSync(join(out, "screens"), { recursive: true });
writeFileSync(join(out, "code.html"), html);
console.log("web_app_owner_direction", (html.length / 1024).toFixed(0) + " KB");
