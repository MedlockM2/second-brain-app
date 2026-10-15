---
id: TASK-520
title: Ajouter les imports contextuels aux dossiers
status: Done
assignee: []
created_date: '2026-10-15 19:28'
updated_date: '2026-10-15 19:55'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correctifs autorisés par owner après les deux passes TestFlight du 15 octobre 2026. Feedback-Id: AEPxBDGpBbyPWZwVbohQGGY. Aucun test automatisé. Validation native après distribution à documenter séparément.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le dossier monte les commandes photo et ajout ; le contexte de destination accompagne les imports et leur reprise.
- [x] #2 Typecheck/lint des applications et du code partagé concernés, contrôles Python si touché, sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extraire les actions existantes. 2. Transmettre la destination jusque dans la reprise après authentification. 3. Monter les commandes dans les dossiers.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
SourceActions extrait de l’Accueil et monté dans les dossiers vides/remplis. Destination capturée avant envoi automatique et conservée dans l’intake suspendue pour authentification. Confirmations modifiables, pickers et protections existants réutilisés.

Contrôles : typecheck mobile/core/web, lint mobile/core et Ruff/mypy réussis ; avertissement any préexistant dans purchaseService seulement. Exports Hermes iOS/Android réussis. Aucun test automatisé ajouté ou lancé. Lectures AWS dev uniquement, aucune écriture. Les scénarios natifs clavier/safe area, imports et envoi après extraction doivent être vérifiés sur appareil après déploiement/distribution ; voir docs/TESTFLIGHT_2026_10_15_FIXES.md. Les AC sont des états du code livré et des contrôles locaux, pas une certification native.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SourceActions extrait de l’Accueil et monté dans les dossiers vides/remplis. Destination capturée avant envoi automatique et conservée dans l’intake suspendue pour authentification. Confirmations modifiables, pickers et protections existants réutilisés. Vérifications et limites : docs/TESTFLIGHT_2026_10_15_FIXES.md.
<!-- SECTION:FINAL_SUMMARY:END -->
