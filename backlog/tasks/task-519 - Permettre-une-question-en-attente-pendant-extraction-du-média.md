---
id: TASK-519
title: Permettre une question en attente pendant extraction du média
status: Done
assignee: []
created_date: '2026-10-15 19:28'
updated_date: '2026-10-15 19:55'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correctifs autorisés par owner après les deux passes TestFlight du 15 octobre 2026. Feedback-Id: AJdnB2aMdvSsARV3vSN8KUA. Aucun test automatisé. Validation native après distribution à documenter séparément.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La page et son chat restent montés pendant extraction ; le contrôleur conserve une question locale annulable et ne soumet que lorsque la source est prête.
- [x] #2 Typecheck/lint des applications et du code partagé concernés, contrôles Python si touché, sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Page stable pendant extraction. 2. Attente dans le contrôleur partagé et soumission unique après disponibilité. 3. Annulation, échecs et isolation du compte.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lecteur stable dès le premier snapshot, sur route et dans Digest. Question locale annulable avec identifiant stable, attente de disponibilité canonique, soumission unique et reprise au premier plan. Échec/disparition, nouveau fil, annulation et changement de compte invalident les opérations anciennes. Attente limitée à la session ; onze traductions ajoutées.

Contrôles : typecheck mobile/core/web, lint mobile/core et Ruff/mypy réussis ; avertissement any préexistant dans purchaseService seulement. Exports Hermes iOS/Android réussis. Aucun test automatisé ajouté ou lancé. Lectures AWS dev uniquement, aucune écriture. Les scénarios natifs clavier/safe area, imports et envoi après extraction doivent être vérifiés sur appareil après déploiement/distribution ; voir docs/TESTFLIGHT_2026_10_15_FIXES.md. Les AC sont des états du code livré et des contrôles locaux, pas une certification native.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Lecteur stable dès le premier snapshot, sur route et dans Digest. Question locale annulable avec identifiant stable, attente de disponibilité canonique, soumission unique et reprise au premier plan. Échec/disparition, nouveau fil, annulation et changement de compte invalident les opérations anciennes. Attente limitée à la session ; onze traductions ajoutées. Vérifications et limites : docs/TESTFLIGHT_2026_10_15_FIXES.md.
<!-- SECTION:FINAL_SUMMARY:END -->
