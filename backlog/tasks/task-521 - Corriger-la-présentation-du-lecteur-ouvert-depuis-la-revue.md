---
id: TASK-521
title: Corriger la présentation du lecteur ouvert depuis la revue
status: Done
assignee: []
created_date: '2026-10-15 19:28'
updated_date: '2026-10-15 19:55'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correctifs autorisés par owner après les deux passes TestFlight du 15 octobre 2026. Feedback-Id: ANrNv9F2etQt2ANWG--9igY. Aucun test automatisé. Validation native après distribution à documenter séparément.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le parcours Approfondir possède un périmètre de navigation et safe area cohérent ; la revue reste montée au retour.
- [x] #2 Typecheck/lint des applications et du code partagé concernés, contrôles Python si touché, sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Examiner les présentations natives. 2. Garder revue et approfondissement dans une présentation commune et une safe area locale. 3. Préserver file et retour.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ancienne route revue supprimée au profit de /review avec pile interne et safe area locale ; le lecteur approfondi et ses citations restent dans cette présentation plein écran. La revue et sa file restent sous le lecteur. Cause native précise non reproduite ; validation visuelle après distribution nécessaire.

Contrôles : typecheck mobile/core/web, lint mobile/core et Ruff/mypy réussis ; avertissement any préexistant dans purchaseService seulement. Exports Hermes iOS/Android réussis. Aucun test automatisé ajouté ou lancé. Lectures AWS dev uniquement, aucune écriture. Les scénarios natifs clavier/safe area, imports et envoi après extraction doivent être vérifiés sur appareil après déploiement/distribution ; voir docs/TESTFLIGHT_2026_10_15_FIXES.md. Les AC sont des états du code livré et des contrôles locaux, pas une certification native.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ancienne route revue supprimée au profit de /review avec pile interne et safe area locale ; le lecteur approfondi et ses citations restent dans cette présentation plein écran. La revue et sa file restent sous le lecteur. Cause native précise non reproduite ; validation visuelle après distribution nécessaire. Vérifications et limites : docs/TESTFLIGHT_2026_10_15_FIXES.md.
<!-- SECTION:FINAL_SUMMARY:END -->
