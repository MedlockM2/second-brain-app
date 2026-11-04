---
id: TASK-587
title: Rendre toutes les sources d’un dossier accessibles dans la web app
status: Done
assignee:
  - '@codex'
created_date: '2026-11-04 19:11'
updated_date: '2026-11-04 22:43'
labels:
  - web
  - v1-launch
  - agent
dependencies: []
references:
  - web/src/pages/FolderPage.tsx
  - web/src/pages/LibraryPage.tsx
  - packages/core/src/types/media.ts
  - mobile-design-mockups/web_app_owner_direction/README.md
priority: high
type: bug
ordinal: 190000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code/configuration/documentation et contrôles statiques dans son worktree. Aucun merge, push, déploiement, publication ou validation propriétaire demandé par les critères.

Audit du 2026-11-04, lecture du code sans reproduction navigateur : FolderPage.tsx ne lit que limit=100, ignore has_more/next_cursor et utilise sources.length comme compteur. Un dossier plus grand laisse donc ses autres sources inaccessibles et annonce un total tronqué. La Bibliothèque et la recherche ont déjà une pagination. Respecter la disposition dossier décidée par l’owner ; ne pas limiter implicitement la portée du chat ou de l’IA aux cartes chargées. Le mobile comporte aussi une lecture de 100 sources : signaler un écart partagé découvert sans affirmer qu'il est exempt du défaut.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La page dossier exploite la pagination du contrat API et propose l’accès aux sources suivantes ; aucun plafond silencieux à la première page de 100 ne subsiste.
- [x] #2 Le total affiché et le libellé de portée ne confondent plus nombre de lignes chargées et total du dossier ; charger une page ne duplique pas les cartes.
- [x] #3 Les erreurs de chargement complémentaire permettent de reprendre en conservant les cartes déjà disponibles ; navigation et mutations ne réintroduisent pas une page périmée.
- [x] #4 Typecheck, lint et build web sont propres ; si du code partagé est modifié, les contrôles mobile et core requis sont consignés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Introduire un hook web de liste paginée respectant has_more/next_cursor, le total serveur, les IDs uniques et l’invalidation des requêtes dépassées.
2. Brancher le dossier sur ce hook : bouton de suite/reprise, erreurs visibles sans effacer les cartes, compteur de portée fondé sur total ; conserver la portée IA/chat sur folderId.
3. Invalider les lectures lors des mutations et de la navigation ; conserver les pages chargées pendant les relectures.
4. Exécuter typecheck, lint et build web et consigner le plafond analogue existant dans le mobile sans étendre cette tâche au mobile.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Contrôles statiques réussis : typecheck, lint et build web en mode ci ; diff --check propre. Revue du chemin paginé : total serveur, curseur conservé à l’échec, fusion unique par media_item_id, verrou des lectures concurrentes, invalidation à la mutation et au démontage. Le dossier est déjà remonté avec key=folderId. IA/chat restent adressés par folderId, sans liste des seules cartes chargées. Aucun test ajouté ni recette navigateur revendiquée.

Écart mobile existant confirmé : mobile/app/media/folders/[id].tsx utilise resourceKeys.mediaPage({ folderId, limit: 100 }). Cette tâche web ne corrige pas ce plafond mobile. Aucun fichier partagé modifié.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rend toutes les pages de sources accessibles depuis le dossier et affiche le total de l’API dans le compteur et la portée de discussion. Un hook web gère curseurs, dédoublonnage, reprise sans effacer les cartes et invalidation des réponses périmées. Typecheck, lint et build web passent ; avertissement existant de taille du bundle inchangé.
<!-- SECTION:FINAL_SUMMARY:END -->
