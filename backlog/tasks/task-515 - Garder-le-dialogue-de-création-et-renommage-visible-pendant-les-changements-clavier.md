---
id: TASK-515
title: >-
  Garder le dialogue de création et renommage visible pendant les changements
  clavier
status: Done
assignee:
  - codex
created_date: '2026-10-15 11:36'
updated_date: '2026-10-15 11:37'
labels:
  - mobile
  - testflight
dependencies: []
priority: high
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback AJAWpxRcoxfNBUSjZFJSsyQ : clavier visible mais carte Nouveau dossier absente. Incident intermittent non reproduit depuis. Owner demande de retirer le verrou de visibilité similaire à celui corrigé dans TASK-514, puis commit et push. Le même RenameDialog sert à créer et renommer dossiers et médias. Validation appareil après OTA par owner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le dialogue ne masque ni la carte ni ses actions en fonction du focus ou de la convergence des mesures de clavier.
- [x] #2 Le code conserve la géométrie native sans animation de layout, le défilement, les safe areas et les protections de saisie/enregistrement.
- [x] #3 Typecheck et lint mobile passent ; exports iOS/Android et limites de vérification native documentés, sans nouveaux tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Retirer les états de révélation, timer, contrôle du focus et mesure de convergence devenus inutiles. Garder la mesure du viewport et de la frame native, écouter directement les changements de frame et laisser la carte toujours visible et utilisable. Vérifier types/lint et exports natifs, documenter la correction candidate puis commit/push autorisés.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Retrait des états resolved/revealed/inputFocused/laidOutHeight, timer de secours, opacity et blocage des actions. La carte et son TextInput restent visibles, accessibles et interactifs ; soumission conditionnée seulement au nom valide et à isSaving. Mesure viewport/frame native conservée, keyboardWillChangeFrame traité dès le départ. Aucun KeyboardAvoidingView ni LayoutAnimation. Marge de 16 points, safe areas, défilement, erreurs, annulation, longueur maximale et verrou pendant enregistrement conservés. Typecheck/lint mobile passent (warning any purchaseService préexistant) ; exports Hermes iOS et Android réussis. Aucun test automatisé ni instrumentation ajouté. Incident intermittent non reproduit ; validation native owner après OTA restante. Comme pour TASK-514, premier rendu possible au repos avant réception de la frame native, sans animation de layout ajoutée.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dialogue toujours visible et utilisable, indépendamment de la convergence des mesures clavier. Géométrie native et protections de création/renommage conservées. Types/lint et exports natifs passent. Correction candidate à vérifier sur appareil après OTA.
<!-- SECTION:FINAL_SUMMARY:END -->
