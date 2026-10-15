---
id: TASK-514
title: Corriger la régression de focus du composeur chat après task-509
status: Done
assignee:
  - codex
created_date: '2026-10-15 11:10'
updated_date: '2026-10-15 11:12'
labels:
  - mobile
  - testflight
dependencies: []
priority: high
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback AHZodLVTM6BrzgEmyDmak10 du 15 octobre : le clavier tente de paraître puis se ferme à chaque tap dans le composeur. Régression suspectée après 70e1af65. Owner autorise un correctif ciblé, commit et push pour essai natif. Le défaut natif exact reste à confirmer ; ne pas modifier le dialogue de dossier.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le composeur reste monté, visible et interactif pendant les changements de géométrie du clavier ; aucun masquage conditionné à la convergence du layout.
- [x] #2 Le positionnement conserve les frames natives sans animation de layout ; historique et retour citation ne déclenchent pas de focus automatique.
- [x] #3 Typecheck et lint mobile passent ; limites de validation native et absence de tests automatisés documentées.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Retirer la dépendance de visibilité/accessibilité du champ à la mesure du clavier et les délais de secours devenus inutiles. Conserver le calcul de hauteur sans animation. Demander soit le focus de saisie soit le focus accessible du titre à la présentation, jamais les deux. Vérifier types/lint et export Expo iOS/Android, puis commit et push autorisés par owner.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Correctif ciblé : retrait du masquage opacity/pointerEvents/accessibilité lié à ready, de la convergence du layout et du timer de secours. Le TextInput reste la même instance visible et interactive. onShow choisit un seul focus (champ pour nouvelle saisie, titre pour historique/retour citation). Calcul de frame native sans LayoutAnimation conservé. Cause exacte de fermeture non reproduite sur appareil : correction candidate de la régression introduite par task-509, à confirmer par owner après OTA. Le premier rendu peut montrer le champ au repos avant la frame native ; aucun faux clavier ni hauteur supposée. Typecheck mobile et lint passent, warning any purchaseService préexistant. Aucun test automatisé ni instrumentation ajoutés. Export all inadapté au mobile (react-native-web absent) ; exports natifs séparés en cours.

Exports Hermes iOS et Android séparés terminés avec succès. Revue du diff : plus aucun état ready, timer, opacity ou contrôle de pointerEvents/accessibilité conditionné au layout du composeur ; TextInput non conditionnel hors historique. Branches de focus historique/citation conservées. Ces preuves portent sur le code livré, pas sur la résolution native du symptôme. Validation owner après OTA restante.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Composeur toujours visible et interactif ; suppression du masquage et de la convergence de layout introduits par task-509. Focus unique à la présentation, géométrie native sans animation conservée. Types/lint mobile et exports iOS/Android passent. Correction candidate à confirmer sur iPhone après OTA, aucun test automatisé.
<!-- SECTION:FINAL_SUMMARY:END -->
