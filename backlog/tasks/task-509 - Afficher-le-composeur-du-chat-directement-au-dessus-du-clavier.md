---
id: TASK-509
title: Afficher le composeur du chat directement au-dessus du clavier
status: Done
assignee:
  - codex
created_date: '2026-10-15 08:40'
updated_date: '2026-10-15 08:56'
labels:
  - mobile
  - testflight
dependencies: []
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feu vert owner le 15 octobre 2026 pour le feedback AJ52jltUDbYSv3vl48r-E7Y (build 14) : supprimer la translation du composeur après ouverture du chat média/dossier. Le dialogue Nouveau dossier est hors périmètre, traité séparément dans a8032a0a. Préserver les parcours historique, citation et génération. Validation native après distribution à effectuer par owner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le chat utilise une géométrie clavier sans animation de layout et sans double ajustement Android.
- [x] #2 Le code conserve l’absence d’autofocus depuis l’historique et au retour d’une citation.
- [x] #3 Typecheck/lint mobile passent ; limites de validation native documentées, sans tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Remplacer KeyboardAvoidingView du chat uniquement par une mesure du viewport et de la frame finale native, sans LayoutAnimation. Masquer le composeur pendant le premier positionnement demandé au focus, gérer clavier matériel via reprise bornée ; préserver historique/citations et suivi du scroll. Lire les métriques existantes, ne pas toucher RenameDialog. Vérifier typecheck/lint et exports natifs ; documenter validation appareil.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
KeyboardAvoidingView supprimé du chat seulement. useChatKeyboardLayout mesure viewport/frame native et attend le layout final avant de montrer le composeur ; aucun LayoutAnimation, pas de soustraction double sur Android. Historique et retour citation gardent les décisions de focus de ChatDock. Clavier matériel sans événement : reprise bornée à une seconde. Le clavier système reste animé par l’OS. Typecheck/lint mobile propres, hors warning any préexistant purchaseService ; exports Hermes iOS/Android réussis. Aucun test ajouté/exécuté. Validation appareil et limites détaillées dans docs/TESTFLIGHT_FIXES_2026_10_15.md. RenameDialog inchangé.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le composeur ne suit plus une animation de layout après l’ouverture du chat : sa première présentation attend sa position finale mesurée au-dessus du clavier. Parcours historique/citation conservés. Types/lint et exports natifs passent ; validation native après distribution restante.
<!-- SECTION:FINAL_SUMMARY:END -->
