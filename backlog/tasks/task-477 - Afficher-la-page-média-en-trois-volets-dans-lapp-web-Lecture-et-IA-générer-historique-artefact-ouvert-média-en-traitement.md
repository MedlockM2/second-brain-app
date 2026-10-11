---
id: TASK-477
title: >-
  Afficher la page média en trois volets dans l'app web : Lecture et IA
  (générer, historique, artefact ouvert, média en traitement)
status: To Do
assignee: []
created_date: '2026-10-11 15:56'
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
  - mobile-design-mockups/web_app_owner_direction/screens/08-media.png
  - mobile-design-mockups/web_app_owner_direction/screens/09-media-artefact.png
  - >-
    mobile-design-mockups/web_app_owner_direction/screens/10-media-volets-reduits.png
  - >-
    mobile-design-mockups/web_app_owner_direction/screens/11-media-en-traitement.png
  - mobile/src/components/CompletedDetailView.tsx
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 84000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-07** du §3 du complément.

L'interface est la direction de l'owner : `mobile-design-mockups/web_app_owner_direction/README.md` **fait foi**. Cette tâche reprend sa ligne « Média en trois volets, façon NotebookLM » du tableau « Ce que la maquette applique », et les captures `08-media.png`, `09-media-artefact.png`, `10-media-volets-reduits.png` et `11-media-en-traitement.png` (répertoire `screens/`). Le socle (task-475) fournit le projet `web/`, la barre, la session, l'i18n et le thème.

## Périmètre

- La **mise en page en trois volets** : Lecture à gauche, Discussion au milieu, IA à droite. Les volets latéraux se réduisent en rail ; la discussion reste toujours visible. **Le volet Discussion est un emplacement** que task-480 (chat web) remplit ; cette tâche ne l'implémente pas.
- **Lecture** : emplacement, menu `…`, couverture, métadonnées, « L'essentiel », texte intégral.
- **IA** : grandes pastilles « Générer » (les 5 types d'artefact) et Historique ; un artefact s'ouvre dans le volet IA, qui s'élargit.
- **Média en traitement** : l'état de la capture 11.
- Ce gabarit de page média est réutilisé par le Digest (task-481) et sert de modèle à la page dossier (task-478) : le concevoir pour cela.

Le menu `…` du média reprend les actions existantes de l'app mobile qui ont un endpoint ; aucun « Déplacer le dossier ».

## Règles

- Câblé sur les endpoints existants : **pas de nouvelle route** d'API.
- Les dossiers n'ont qu'un niveau : aucun écran ne crée un dossier dans un dossier, et « Déplacer le dossier » n'existe pas.
- Ne modifier aucun fichier de `mobile/` (lecture par l'alias seulement).
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Vérification visuelle contre les captures 08 à 11 sur un navigateur de bureau, contre l'API `-dev`, avec génération d'un artefact de chaque type.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La page média rend trois volets Lecture, Discussion et IA, les volets latéraux se réduisent en rail, et le volet Discussion est un emplacement laissé à task-480
- [ ] #2 Le volet Lecture rend l'emplacement, le menu …, la couverture, les métadonnées, L'essentiel et le texte intégral
- [ ] #3 Le volet IA génère les 5 types d'artefact, liste l'historique et ouvre un artefact en s'élargissant, et l'état média en traitement est rendu
- [ ] #4 Les écrans sont câblés sur les endpoints existants, sans nouvelle route, et aucun écran ne crée un dossier dans un dossier ni ne déplace un dossier
- [ ] #5 Les libellés sont présents dans les 11 langues
- [ ] #6 Le build passe, typecheck et lint sont propres, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->
