---
id: TASK-518
title: Conserver les sections Accueil et mesurer leur chemin serveur
status: Done
assignee: []
created_date: '2026-10-15 19:28'
updated_date: '2026-10-15 19:55'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 125000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correctifs autorisés par owner après les deux passes TestFlight du 15 octobre 2026. Feedback-Id: AN8RU9q8p5EeH1VogUZX4Yw, AJCmuckabgvzHUOBNEhtWs8. Aucun test automatisé. Validation native après distribution à documenter séparément.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les trois sections utilisent les snapshots de session ; les mesures AWS dev et les limites du diagnostic sont documentées.
- [x] #2 Typecheck/lint des applications et du code partagé concernés, contrôles Python si touché, sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Mesurer les lectures réelles AWS dev. 2. Optimiser le coût démontré. 3. Cacher les sections par compte et gérer les mutations.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Snapshots de compte pour les trois sections et invalidations après mutations, engagements et générations. Connexion DynamoDB partagée par lecture. Dix paires alternées AWS dev : Revue médiane 185,8 → 107,4 ms ; Reprendre 258,8 → 248,5 ms, gain faible et variable. Le cache ne résout pas un lancement sans données ; pas de promesse de gain de rendu à froid. Pagination de couvertures conservée après comparaison sans réduction de requêtes.

Contrôles : typecheck mobile/core/web, lint mobile/core et Ruff/mypy réussis ; avertissement any préexistant dans purchaseService seulement. Exports Hermes iOS/Android réussis. Aucun test automatisé ajouté ou lancé. Lectures AWS dev uniquement, aucune écriture. Les scénarios natifs clavier/safe area, imports et envoi après extraction doivent être vérifiés sur appareil après déploiement/distribution ; voir docs/TESTFLIGHT_2026_10_15_FIXES.md. Les AC sont des états du code livré et des contrôles locaux, pas une certification native.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Snapshots de compte pour les trois sections et invalidations après mutations, engagements et générations. Connexion DynamoDB partagée par lecture. Dix paires alternées AWS dev : Revue médiane 185,8 → 107,4 ms ; Reprendre 258,8 → 248,5 ms, gain faible et variable. Le cache ne résout pas un lancement sans données ; pas de promesse de gain de rendu à froid. Pagination de couvertures conservée après comparaison sans réduction de requêtes. Vérifications et limites : docs/TESTFLIGHT_2026_10_15_FIXES.md.
<!-- SECTION:FINAL_SUMMARY:END -->
