---
id: TASK-483
title: Rechercher en plein texte depuis la barre de l'app web
status: Done
assignee: []
created_date: '2026-10-11 15:57'
updated_date: '2026-10-11 17:33'
labels:
  - web
  - feature
dependencies:
  - TASK-475
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - mobile-design-mockups/web_app_owner_direction/README.md
  - mobile-design-mockups/web_app_owner_direction/screens/03-recherche.png
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-13** du §3 du complément.

L'interface est la direction de l'owner : `mobile-design-mockups/web_app_owner_direction/README.md` **fait foi** (la barre horizontale porte la « recherche plein texte » ; la Bibliothèque n'a pas de champ de recherche, pour ne pas doublonner celui de la barre), avec la capture `screens/03-recherche.png`. Le champ est posé dans la barre par le socle (task-475).

## Périmètre

- Le champ de recherche de la barre interroge l'endpoint de recherche existant que l'app mobile utilise, et rend les résultats comme la capture 03.
- Un résultat ouvre la page média (route de task-477) ou le dossier (route de task-478).

## Règles

- Câblé sur les endpoints existants : **pas de nouvelle route** d'API.
- Les dossiers n'ont qu'un niveau : aucun écran ne crée un dossier dans un dossier, et « Déplacer le dossier » n'existe pas.
- Ne modifier aucun fichier de `mobile/` (lecture par l'alias seulement).
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Vérification contre la capture 03 sur un compte `-dev` avec plusieurs médias indexés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le champ de recherche de la barre interroge l'endpoint de recherche existant et rend les résultats comme la capture 03-recherche.png
- [x] #2 Un résultat ouvre la page média ou le dossier correspondant
- [x] #3 Les écrans sont câblés sur les endpoints existants, sans nouvelle route, et aucun écran ne crée un dossier dans un dossier ni ne déplace un dossier
- [x] #4 Les libellés sont présents dans les 11 langues
- [x] #5 Le build passe, typecheck et lint sont propres, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Commit 90b17228.

- **/search?q=** (`web/src/pages/SearchPage.tsx`), ouvert par le champ de la barre : `GET /api/search/transcripts` (l'endpoint de recherche de la Bibliothèque mobile). Rendu comme la capture 03 : retour Bibliothèque, titre « requête » (guillemets localisés), « N résultats dans le texte de vos sources », section Dossiers (noms qui correspondent, sans accents ni casse, dossiers racine), puis « Dans le texte » : chaque résultat comme sa ligne de bibliothèque avec l'extrait `<mark>` recentré sur la correspondance ; pages de 20 avec « Afficher plus », « Fin des résultats », états sans résultat et échec.
- Un résultat ouvre la page média, un dossier sa page dossier ; un résultat dont le média a été supprimé depuis l'indexation n'ouvre rien et n'a pas de menu `…`. Les autres ont le menu `…` du média.
- `packages/core` : types de la recherche et copie neutre de l'analyseur d'extraits mobile. `EmptyPage`, devenu sans usage, est supprimé.
- 3 libellés web en 11 langues ; build, typecheck, lint propres ; rendu vérifié en Chrome headless.
<!-- SECTION:FINAL_SUMMARY:END -->
