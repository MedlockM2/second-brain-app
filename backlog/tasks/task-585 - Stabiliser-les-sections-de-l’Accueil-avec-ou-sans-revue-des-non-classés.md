---
id: TASK-585
title: Stabiliser les sections de l’Accueil avec ou sans revue des non classés
status: Done
assignee:
  - codex
created_date: '2026-11-03 20:38'
updated_date: '2026-11-03 20:42'
labels:
  - mobile
  - web
  - ui
dependencies: []
references:
  - TASK-580
modified_files:
  - mobile/app/(tabs)/inbox.tsx
  - mobile/src/constants/homeRhythm.ts
  - web/src/pages/HomePage.tsx
priority: medium
type: bug
ordinal: 188000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le propriétaire constate que les rangées changent de hauteur selon la présence de la revue des non classés et de l’apprentissage. Il demande un titre Accueil dans l’espace supérieur quand la revue est absente, et des positions identiques des rangées dans ces configurations. Cette demande remplace le centrage sans revue conservé par TASK-580. La disposition desktop garde son accès Non classés dans la navigation. Le propriétaire demande explicitement commit, merge sur main puis push.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sans revue des non classés, l’Accueil mobile affiche le titre traduit dans la zone supérieure.
- [x] #2 La revue, son chargement et le titre partagent une même réserve verticale ; les rangées restent ancrées en haut indépendamment de la présence de l’apprentissage.
- [x] #3 Le web affiche également son titre Accueil traduit et conserve ses rangées alignées en haut.
- [x] #4 Les vérifications TypeScript et lint mobile et web passent sans nouvelle erreur ; aucun test automatisé n’est ajouté.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Supprimer le centrage conditionnel de la colonne mobile. Regrouper le bouton de revue, son placeholder et le titre traduit tabs.home dans une même zone supérieure, avec une hauteur minimale commune dérivée du deck et de la taille système des caractères. Conserver les réserves des boutons et le rythme des rangées.
2. Réutiliser les onze traductions existantes, actualiser les commentaires de homeRhythm et rendre visible le h1 Accueil de la page web, déjà ancrée en haut.
3. Vérifier TypeScript et lint mobile/core/web, compiler le web et exporter les bundles mobiles si possible. Aucun test automatisé ajouté. Relire le diff et rechercher les valeurs sensibles. Consigner les limites de la vérification visuelle.
4. Finaliser TASK-585, committer avec Web: done, fusionner sur main et pousser normalement vers origin selon la demande explicite du propriétaire.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnostic : scrollContentCentered centre la colonne quand le compteur est nul ; retirer la rangée d’apprentissage change la hauteur totale et déplace donc Ajouts récents. UnsortedReviewButton retourne aussi null à zéro et supprime la réserve supérieure. Le titre tabs.home existe déjà dans les onze catalogues partagés. Le web n’a pas de carte de revue et est déjà aligné en haut.

Implémentation : un seul conteneur home-header porte le deck, son placeholder ou tabs.home (onze traductions existantes). La réserve minimale vaut 96 points à taille système normale et augmente pour deux lignes agrandies ; elle dépend seulement de fontScale, jamais du compteur ou de la rangée d’apprentissage. Le libellé du deck a une hauteur de ligne explicite, et le titre conserve le rôle accessible d’en-tête. La colonne reste flex-start ; HOME_BLOCK_GAP, TILE_HEIGHT et la réserve des actions flottantes sont conservés. Le web utilise désormais son h1 visible avec la classe display.

Validation locale : les commandes typecheck et lint des workspaces mobile, packages/core et web terminent toutes à 0. Le seul warning ESLint, purchaseService.ts:136, existe déjà dans HEAD et n’est pas modifié. npm run build --workspace web et les exports Expo Hermes iOS/Android vers /tmp terminent à 0. Le build web conserve son avertissement de taille de bundle ; Expo signale la configuration locale sans variables de build. git diff --check passe. Aucun test automatisé ajouté ou lancé. Les branches de rendu et les dimensions communes ont été relues ; aucune validation visuelle sur appareil ni distribution n’a été effectuée dans cette session.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
L’Accueil mobile affiche maintenant son titre traduit lorsque la revue des non classés est absente. Le titre, le deck et son chargement occupent une même zone supérieure, dimensionnée pour les caractères agrandis. Ajouts récents et Reprendre l’apprentissage restent ancrés en haut avec ou sans revue et avec ou sans apprentissage, au lieu de recentrer toute la colonne. Le titre Accueil devient également visible sur le web.

Validation : TypeScript et lint mobile/core/web, compilation web, exports Hermes iOS/Android et git diff --check réussis. Avertissements préexistants uniquement ; aucun test automatisé ajouté. Rendu sur appareil restant à vérifier après distribution.
<!-- SECTION:FINAL_SUMMARY:END -->
