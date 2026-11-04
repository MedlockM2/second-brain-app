---
id: TASK-588
title: >-
  Actualiser les traitements de la Bibliothèque web sans perdre les pages
  chargées
status: Done
assignee:
  - '@codex'
created_date: '2026-11-04 19:11'
updated_date: '2026-11-04 22:44'
labels:
  - web
  - v1-launch
  - agent
dependencies: []
references:
  - web/src/pages/LibraryPage.tsx
  - web/src/lib/useProcessingRefresh.ts
  - mobile/src/services/mediaService.ts
priority: high
type: bug
ordinal: 191000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code/configuration/documentation et contrôles statiques dans son worktree. Aucun merge, push, déploiement, publication ou validation propriétaire demandé par les critères.

Audit du 2026-11-04, lecture du code : LibraryPage.tsx active le polling seulement si cursor === null. Tant qu’il reste une page suivante, les médias en traitement ne sont pas actualisés. Après chargement de la dernière page, le polling appelle loadMedia, qui remplace toute la liste par les 40 premiers éléments. Préserver les pages consultées tout en reflétant la progression des imports, sans polling infini ni multiplication des requêtes.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les médias affichés encore en traitement peuvent être actualisés même si d’autres pages restent à charger.
- [x] #2 Les relectures de traitement conservent les pages déjà chargées, leur ordre et une pagination cohérente ; atteindre la dernière page ne réduit pas la liste à la première.
- [x] #3 Les échecs de relecture conservent les contenus affichés et la politique de polling borné reste explicite ; les réponses d’une lecture dépassée ne remplacent pas l’état courant.
- [x] #4 Typecheck, lint et build web sont propres ; aucun test automatisé ajouté.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Réutiliser la pagination web ajoutée dans TASK-587 pour la Bibliothèque et ses rechargements après ajout.
2. Actualiser uniquement les médias affichés encore en traitement via leur lecture canonique, par groupes de quatre requêtes au plus, sans toucher à l’ordre, aux cartes chargées ou au curseur.
3. Conserver la borne existante de 36 tours de polling à cinq secondes, afficher les erreurs avec reprise et ignorer les réponses dépassées.
4. Vérifier typecheck, lint et build web sans ajouter de tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Typecheck, lint et build web passent. Revue statique : le déclenchement dépend des médias affichés en traitement, jamais du curseur ; la relecture canonique fusionne uniquement les champs des IDs concernés sur le snapshot courant et garde ordre, total et curseur. Quatre lectures simultanées au maximum, un seul tour en cours, 36 tours espacés de cinq secondes via le hook existant. Échecs partiels conservés et affichés avec reprise. Les changements d’époque invalident les réponses après reload, mutation ou démontage. Aucun test automatisé ni code partagé modifié.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Actualise les médias en traitement sur toutes les pages de la Bibliothèque sans remplacer la liste par sa première page. La pagination reprend le hook web commun au dossier ; le polling lit seulement les éléments concernés, conserve les réussites partielles et expose une reprise après erreur. Typecheck, lint et build web réussis.
<!-- SECTION:FINAL_SUMMARY:END -->
