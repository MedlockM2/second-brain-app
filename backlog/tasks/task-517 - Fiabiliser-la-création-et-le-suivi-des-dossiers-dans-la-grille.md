---
id: TASK-517
title: Fiabiliser la création et le suivi des dossiers dans la grille
status: Done
assignee: []
created_date: '2026-10-15 19:28'
updated_date: '2026-10-15 19:55'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 124000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correctifs autorisés par owner après les deux passes TestFlight du 15 octobre 2026. Feedback-Id: AE46mAy1e2GZqaIvOqDqb5I, AHxVCrbUsu_XKB0XffGAEDQ, AJlIEYpTkIpjV8jWtr--AQs, AITa0AdgJzQtky_vkoe2iMg. Aucun test automatisé. Validation native après distribution à documenter séparément.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les chemins de création inline, de visibilité clavier et de révélation après validation sont câblés ; le doublon reste acquitté par OK sans second message inline.
- [x] #2 Typecheck/lint des applications et du code partagé concernés, contrôles Python si touché, sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Création immédiate et reprise idempotente. 2. Visibilité du champ après layout/clavier et révélation après tri. 3. Retirer le second message de doublon.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Création optimiste locale, identité UUID de reprise reconnue par le serveur, retrait du GET de dossiers du chemin critique. Champ/erreur mesurés dans la zone visible après layout et frame clavier ; révélation après validation/tri. Doublon à OK obligatoire sans second message inline. Le brouillon local ne pollue pas le cache des destinations.

Contrôles : typecheck mobile/core/web, lint mobile/core et Ruff/mypy réussis ; avertissement any préexistant dans purchaseService seulement. Exports Hermes iOS/Android réussis. Aucun test automatisé ajouté ou lancé. Lectures AWS dev uniquement, aucune écriture. Les scénarios natifs clavier/safe area, imports et envoi après extraction doivent être vérifiés sur appareil après déploiement/distribution ; voir docs/TESTFLIGHT_2026_10_15_FIXES.md. Les AC sont des états du code livré et des contrôles locaux, pas une certification native.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Création optimiste locale, identité UUID de reprise reconnue par le serveur, retrait du GET de dossiers du chemin critique. Champ/erreur mesurés dans la zone visible après layout et frame clavier ; révélation après validation/tri. Doublon à OK obligatoire sans second message inline. Le brouillon local ne pollue pas le cache des destinations. Vérifications et limites : docs/TESTFLIGHT_2026_10_15_FIXES.md.
<!-- SECTION:FINAL_SUMMARY:END -->
