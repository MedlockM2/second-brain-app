---
id: TASK-511
title: Ajouter un retour en haut à Tous les médias
status: Done
assignee:
  - codex
created_date: '2026-10-15 08:41'
updated_date: '2026-10-15 08:56'
labels:
  - mobile
  - testflight
dependencies: []
ordinal: 118000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback AESheO4N1rUCogJdX1g6rjM accepté le 15 octobre 2026 : après défilement dans Tous les médias, une flèche fixe superposée doit permettre de revenir en haut sans parcourir la liste à la main. Garder pagination et contenu déjà chargés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La liste Tous les médias possède une commande flottante de retour au sommet visible après défilement et placée hors de la barre d’onglets.
- [x] #2 La commande conserve les pages chargées, dispose de traductions et respecte Réduire les animations.
- [x] #3 Typecheck/lint mobile/core passent sans ajout de tests ; vérification native restante documentée.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Ajouter un ref FlatList, état de seuil de scroll et bouton superposé dans LibraryState. Utiliser le bottom tab inset existant et une cible 48, réduire les animations via AccessibilityInfo. Traduire le label dans onze catalogues. Conserver la même liste/pagination ; lint/typecheck mobile/core, exports.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Commande de 48 points après une hauteur de viewport de défilement, au-dessus de TAB_BAR_CLEARANCE ; ref sur la même FlatList, scrollToOffset sans modifier les pages ni les données. Masquage clavier, abonnement Réduire les animations, onze traductions. Typecheck/lint mobile et core, typecheck web, exports iOS/Android passent ; warning purchaseService préexistant uniquement. Aucun test ajouté. Position native à confirmer après distribution.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tous les médias offre une flèche de retour au sommet sans rechargement ni perte de pagination. Commande traduite, accessible et adaptée à Réduire les animations. Contrôles statiques/exports réussis ; vérification sur appareil restante.
<!-- SECTION:FINAL_SUMMARY:END -->
