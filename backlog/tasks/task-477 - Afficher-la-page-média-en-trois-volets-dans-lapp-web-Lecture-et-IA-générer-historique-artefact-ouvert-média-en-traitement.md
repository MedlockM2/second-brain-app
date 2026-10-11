---
id: TASK-477
title: >-
  Afficher la page média en trois volets dans l'app web : Lecture et IA
  (générer, historique, artefact ouvert, média en traitement)
status: Done
assignee: []
created_date: '2026-10-11 15:56'
updated_date: '2026-10-11 17:17'
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
- [x] #1 La page média rend trois volets Lecture, Discussion et IA, les volets latéraux se réduisent en rail, et le volet Discussion est un emplacement laissé à task-480
- [x] #2 Le volet Lecture rend l'emplacement, le menu …, la couverture, les métadonnées, L'essentiel et le texte intégral
- [x] #3 Le volet IA génère les 5 types d'artefact, liste l'historique et ouvre un artefact en s'élargissant, et l'état média en traitement est rendu
- [x] #4 Les écrans sont câblés sur les endpoints existants, sans nouvelle route, et aucun écran ne crée un dossier dans un dossier ni ne déplace un dossier
- [x] #5 Les libellés sont présents dans les 11 langues
- [x] #6 Le build passe, typecheck et lint sont propres, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Commit ee4e956.

- **Gabarit** `web/src/components/panes/Panes.tsx` : Lecture / Discussion / IA ; volets latéraux réductibles en rail (préférence gardée dans le navigateur), Discussion jamais réduite, volet IA élargi quand un artefact est ouvert, emplacement `band` au-dessus pour le Digest (task-481). La page dossier (task-478) le réutilise avec ses propres volets.
- **Page média** `web/src/components/media/MediaView.tsx` (route `/media/:mediaId`, lit son média par id seulement, réutilisable par le Digest).
- **Lecture** : emplacement (dossier ou Non classés, lien vers `/folders/:id`), menu `…` (Déplacer vers un dossier racine, Nouveau dossier + rangement, Renommer, Supprimer — `PATCH`/`DELETE /api/media/:id` ; aucun déplacement de dossier), bandeau de couverture, ligne de faits (source, date, durée, langue(s), paragraphes), « L'essentiel » (review_blurb), texte intégral numéroté § avec bascule original/traduction (`raw-content?variant=original`) et relecture tant que la traduction est en cours. États traitement / délai dépassé / échec, sondage `GET /api/media/:id` toutes les 3 s (5 min max).
- **Discussion** : emplacement vide pour task-480 ; message « s'ouvre dès que le texte est prêt » ou « pas de discussion possible » selon l'état.
- **IA** (`web/src/components/ai/useAiPane.tsx`, `ArtifactBody.tsx`) : 5 pastilles Générer (`POST /api/artifacts`), états Généré / En file / Génération… / Échec, refus formulés depuis leur code, Historique (`GET /api/artifacts`, relu toutes les 3 s pendant une génération), artefact ouvert dans le volet élargi (`GET /api/artifacts/:id/content`) avec une mise en page par type (résumé, résumé détaillé, notes, cartes mémo retournables, quiz question par question), entrée en attente ou en échec avec « Générer à nouveau ». Le hook prend la portée en paramètre pour la page dossier.
- **packages/core** : copies neutres des helpers mobiles (erreurs lisibles, refus quota/artefact, historique et lecture du contenu d'artefact, découpage du texte, aperçu, durées) et types `RawContentResponse`, `PatchMediaResponse`. `mobile/` non modifié.
- 10 libellés web ajoutés en 11 langues ; build, typecheck et lint de `web/` et `packages/core` propres ; rendu vérifié en Chrome headless contre une API simulée (page prête, cartes mémo, volets réduits, traitement, menu).

À suivre côté mobile (hors périmètre) : pointer les helpers mobiles dupliqués vers `packages/core`.
<!-- SECTION:FINAL_SUMMARY:END -->
