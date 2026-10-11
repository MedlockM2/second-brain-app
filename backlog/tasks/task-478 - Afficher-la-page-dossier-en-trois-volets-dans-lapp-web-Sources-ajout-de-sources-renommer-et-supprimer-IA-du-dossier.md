---
id: TASK-478
title: >-
  Afficher la page dossier en trois volets dans l'app web : Sources, ajout de
  sources, renommer et supprimer, IA du dossier
status: To Do
assignee: []
created_date: '2026-10-11 15:56'
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
dispatchable: true
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
- [ ] #1 La page dossier rend trois volets Sources, Discussion (emplacement à la portée Ce dossier · N sources laissé à task-480) et IA
- [ ] #2 Le volet Sources rend le chemin, le menu … limité à Renommer et Supprimer, le bouton + Ajouter des sources qui range directement dans ce dossier, et la liste des sources
- [ ] #3 Le volet IA génère sur tout le dossier, liste l'historique avec le nombre de sources et ouvre un artefact
- [ ] #4 Les écrans sont câblés sur les endpoints existants, sans nouvelle route, et aucun écran ne crée un dossier dans un dossier ni ne déplace un dossier
- [ ] #5 Les libellés sont présents dans les 11 langues
- [ ] #6 Le build passe, typecheck et lint sont propres, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->
