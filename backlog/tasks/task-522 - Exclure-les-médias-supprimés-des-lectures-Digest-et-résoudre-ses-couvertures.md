---
id: TASK-522
title: Exclure les médias supprimés des lectures Digest et résoudre ses couvertures
status: Done
assignee: []
created_date: '2026-10-15 19:29'
updated_date: '2026-10-15 19:55'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 129000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correctifs autorisés par owner après les deux passes TestFlight du 15 octobre 2026. Feedback-Id: AImIvUhSvGUm3b2-zbmE8_0. Aucun test automatisé. Validation native après distribution à documenter séparément.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les lectures Digest filtrent les références supprimées et conservent l’ordre ; les couvertures ne dépendent pas de l’inclusion dans les cent derniers médias.
- [x] #2 Typecheck/lint des applications et du code partagé concernés, contrôles Python si touché, sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Filtrer la visibilité des références sans modifier la capture ni la livraison. 2. Résoudre les couvertures hors page via le cache. 3. Vérifications AWS dev en lecture seule.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Projection des deux lectures Digest filtrée via BatchGet cohérent de user_media, sans réécriture de capture ni modification de livraison. Références supprimées confirmées sur AWS dev, filtre réel 2→1 et 11→9 lors du contrôle final. Au plus six détails de couvertures partagés, sans dépendance à la première page bibliothèque.

Contrôles : typecheck mobile/core/web, lint mobile/core et Ruff/mypy réussis ; avertissement any préexistant dans purchaseService seulement. Exports Hermes iOS/Android réussis. Aucun test automatisé ajouté ou lancé. Lectures AWS dev uniquement, aucune écriture. Les scénarios natifs clavier/safe area, imports et envoi après extraction doivent être vérifiés sur appareil après déploiement/distribution ; voir docs/TESTFLIGHT_2026_10_15_FIXES.md. Les AC sont des états du code livré et des contrôles locaux, pas une certification native.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Projection des deux lectures Digest filtrée via BatchGet cohérent de user_media, sans réécriture de capture ni modification de livraison. Références supprimées confirmées sur AWS dev, filtre réel 2→1 et 11→9 lors du contrôle final. Au plus six détails de couvertures partagés, sans dépendance à la première page bibliothèque. Vérifications et limites : docs/TESTFLIGHT_2026_10_15_FIXES.md.
<!-- SECTION:FINAL_SUMMARY:END -->
