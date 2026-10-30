---
id: TASK-576
title: Arrondir les pourcentages de capacité affichés à l’unité
status: Done
assignee:
  - '@codex'
created_date: '2026-10-30 14:41'
updated_date: '2026-10-30 14:52'
labels:
  - mobile
  - web
dependencies: []
modified_files:
  - packages/core/src/budget/presentation.ts
  - mobile/src/components/SubscriptionStatusCard.tsx
  - web/src/pages/AccountPage.tsx
  - docs/TESTFLIGHT_2026_10_30_NEW_FEEDBACK.md
  - docs/testflight-feedback-log.md
priority: medium
type: bug
ordinal: 182000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback TestFlight AJVy9sNlM_JW7nqvazUuBiI (build 18, 29 octobre) : le Compte affiche 7,955 % consommés et 92,045 % restants. Le propriétaire demande 8 % et 92 %. Appliquer le même arrondi de présentation sur mobile et web sans changer les montants ou règles budgétaires.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les pourcentages de consommation et de capacité disponible affichés sur mobile et web sont arrondis à l’unité, selon la locale.
- [x] #2 Les calculs, seuils et valeurs de jauge utilisent encore la précision serveur ; les prévisions faibles ne sont pas présentées comme gratuites.
- [x] #3 Types et lint mobile/core/web passent et le changement est documenté dans le registre TestFlight.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ajouter un formateur partagé de pourcentage de capacité arrondi à zéro décimale. 2. L’employer pour consommation, disponible, réservé et avertissements mobile/web ; conserver la précision des estimations et de la logique budget/jauge. 3. Vérifier types/lint et rendu manuel navigateur puis documenter.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Formateur partagé capacityPercentage à zéro décimale utilisé par le Compte et capacityLines sur mobile/web. Rendu manuel Safari : 7,955 devient 8 %, 92,045 devient 92 % en français et anglais. Petite prévision 0,0001 affiche encore <0,001 %, sans faux gratuit. Montants, admission, comparaisons de seuil et ratios de jauge non modifiés. Types/lint trois workspaces, build web et exports iOS/Android réussis. Warning any purchaseService préexistant ; aucun test automatisé. Registre et docs/TESTFLIGHT_2026_10_30_NEW_FEEDBACK.md renseignés. Rendu appareil après distribution restant.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Les pourcentages de capacité du Compte et des avertissements sont arrondis à l’unité sur les deux clients via core ; estimations et calculs conservent leur précision. Contrôles locaux et revue Safari FR/EN réussis ; OTA/web à distribuer.
<!-- SECTION:FINAL_SUMMARY:END -->
