---
id: TASK-478
title: >-
  Afficher la page dossier en trois volets dans l'app web : Sources, ajout de
  sources, renommer et supprimer, IA du dossier
status: Done
assignee: []
created_date: '2026-10-11 15:56'
updated_date: '2026-10-11 17:23'
labels:
  - web
  - feature
dependencies:
  - TASK-477
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - mobile-design-mockups/web_app_owner_direction/README.md
  - mobile-design-mockups/web_app_owner_direction/screens/12-dossier.png
  - mobile-design-mockups/web_app_owner_direction/screens/13-dossier-quiz.png
  - mobile-design-mockups/web_app_owner_direction/screens/14-dossier-ajouter.png
  - 'mobile/app/media/folders/[id].tsx'
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-08** du §3 du complément.

L'interface est la direction de l'owner : `mobile-design-mockups/web_app_owner_direction/README.md` **fait foi**. Cette tâche reprend sa ligne « Dossier en trois volets » du tableau « Ce que la maquette applique », et les captures `12-dossier.png`, `13-dossier-quiz.png` et `14-dossier-ajouter.png` (répertoire `screens/`). Elle part du gabarit en trois volets de la page média (task-477).

**Les dossiers n'ont qu'un niveau** (décision de l'owner, 2026-10-11) : ni section Dossiers, ni création de sous-dossier dans la page dossier, et **le menu `…` d'un dossier se limite à Renommer et Supprimer**. « Déplacer le dossier » n'existe pas.

## Périmètre

- **Sources**, à gauche : chemin, menu `…` (Renommer, Supprimer, et rien d'autre), bouton « + Ajouter des sources » (le + de l'Accueil mobile, qui **range directement dans ce dossier** : coller un lien ou importer un fichier, capture 14), puis la liste des sources.
- **Discussion**, au milieu : un emplacement à la portée « Ce dossier · N sources », que task-480 remplit.
- **IA**, à droite : génération sur tout le dossier, historique avec le nombre de sources, artefact ouvert (dont le quiz de la capture 13).
- Renommer et Supprimer ont leurs dialogues (présents dans la maquette `code.html`).

## Règles

- Câblé sur les endpoints existants : **pas de nouvelle route** d'API.
- Aucun écran ne crée un dossier dans un dossier, et « Déplacer le dossier » n'existe pas.
- Ne modifier aucun fichier de `mobile/` (lecture par l'alias seulement).
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Vérification visuelle contre les captures 12 à 14 sur un navigateur de bureau, contre l'API `-dev` : ajouter une source dans un dossier, générer un artefact de dossier, renommer puis supprimer un dossier.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La page dossier rend trois volets Sources, Discussion (emplacement à la portée Ce dossier · N sources laissé à task-480) et IA
- [x] #2 Le volet Sources rend le chemin, le menu … limité à Renommer et Supprimer, le bouton + Ajouter des sources qui range directement dans ce dossier, et la liste des sources
- [x] #3 Le volet IA génère sur tout le dossier, liste l'historique avec le nombre de sources et ouvre un artefact
- [x] #4 Les écrans sont câblés sur les endpoints existants, sans nouvelle route, et aucun écran ne crée un dossier dans un dossier ni ne déplace un dossier
- [x] #5 Les libellés sont présents dans les 11 langues
- [x] #6 Le build passe, typecheck et lint sont propres, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Commit c5285cd.

- **Page dossier** `web/src/pages/FolderPage.tsx` (route `/folders/:folderId`), sur le gabarit `Panes` de task-477.
- **Sources** : chemin « Bibliothèque », menu `…` limité à Renommer (`PUT /api/folders/:id`) et Supprimer (`DELETE`, les sources passent dans Non classés, dialogue avec la phrase `folderActions.deleteBody`) ; aucun `…` sur Non classés. Titre, « N sources », bouton « + Ajouter des sources », liste des sources (`GET /api/media?folder_id=…`, relue pendant un traitement) avec le menu `…` de chaque média. Pas de section Dossiers, aucune création de sous-dossier.
- **Ajout** `web/src/components/AddSourceDialog.tsx` + `web/src/media/ingest.ts` : lien collé (`POST /api/media/ingest-url` avec `folder_id`) ou un fichier choisi/déposé (`upload-url` → PUT présigné depuis le navigateur → `upload` / `upload-audio` avec `folder_id`), refus de format/taille avant envoi, refus de quota formulés. Réutilisable par task-479 (sans dossier → Non classés).
- **Terraform** : CORS `PUT` des buckets `documents` et `audio` pour `var.web_app_origin` (aucune règle si vide) — sans lui, un navigateur ne peut pas envoyer le fichier. `terraform validate` OK sur dev, staging, prod.
- **Discussion** : emplacement à la portée « Ce dossier · N sources » pour task-480.
- **IA** : génération sur tout le dossier ; `useAiPane` compare désormais les sources actuelles du dossier à l'instantané de la dernière entrée de chaque type (`GET /api/artifacts/:id`) pour ne proposer une nouvelle génération que si elles diffèrent, avec un bandeau ; historique avec le nombre de sources ; artefact ouvert (quiz compris).
- `packages/core` : copie neutre de l'extraction d'URL mobile. 15 libellés web en 11 langues. Build, typecheck, lint propres ; rendu vérifié en Chrome headless (page, ajout, quiz, menu).

Note owner : l'import de fichier depuis le web attend l'`apply` de `web_app_origin` (CORS S3) ; un lien fonctionne dès le CORS de l'API.
<!-- SECTION:FINAL_SUMMARY:END -->
