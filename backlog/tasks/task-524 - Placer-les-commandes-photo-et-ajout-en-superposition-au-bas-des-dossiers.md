---
id: TASK-524
title: Placer les commandes photo et ajout en superposition au bas des dossiers
status: Done
assignee:
  - '@codex'
created_date: '2026-10-15 21:36'
updated_date: '2026-10-15 21:46'
labels:
  - mobile
  - testflight
dependencies: []
documentation:
  - docs/testflight-feedback-log.md
modified_files:
  - 'mobile/app/media/folders/[id].tsx'
  - mobile/app/(tabs)/inbox.tsx
  - mobile/src/components/SourceActions.tsx
  - docs/testflight-feedback-log.md
  - docs/TESTFLIGHT_2026_10_15_SEARCH_AND_SOURCE_ACTIONS.md
priority: medium
type: enhancement
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Retour TestFlight ACJh1x2gl9sFgbvwCcYmlHU du 15 octobre 2026, build 14. Les captures demandent de déplacer photo et + du haut de la page dossier vers le bas centré, en superposition des sources comme la référence NotebookLM. Conserver la destination du dossier et le chat accessibles. Aucun nouveau fournisseur ni composant externe. Validation native après distribution par owner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les commandes partagées photo et ajout sont montées en overlay au bas des Sources du dossier, avec espace de défilement réservé et safe area.
- [x] #2 L’onglet IA ne porte pas ces commandes de sources ; la destination dossier et le dock chat restent câblés.
- [x] #3 Typecheck/lint mobile et exports iOS/Android passent ; diagnostic et validation native restante sont documentés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Encapsuler la liste Sources dans une zone flex avec commandes partagées en overlay bottom centré.
2. Paramétrer l’offset flottant pour les pages sans barre native et réserver la hauteur réelle des commandes dans la liste, au-dessus du dock et de la safe area.
3. Conserver la destination d’import et les dialogues, limiter l’overlay à Sources, puis vérifier types/lint et exports natifs et documenter la validation appareil restante.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Les deux captures du retour ACJh1x2gl9sFgbvwCcYmlHU ont été inspectées : commandes en haut du dossier versus référence NotebookLM en overlay bas centré. SourceActions est déplacé dans la zone Sources flexible, au-dessus du dock ChatDock et dans la safe area de la page ; une réserve de hauteur laisse défiler la dernière carte au-dessus des boutons. L’ancien mode inline sans lecteur est retiré du composant partagé.

Revue du câblage dossier vide/rempli, onglet IA et destination conservée avant picker/auth. Types/lint mobile et exports Hermes iOS/Android passent ; seul warning purchaseService préexistant. Aucun test automatisé ajouté/lancé. La position native, grandes polices, gestes et import effectif devront être confirmés par owner après OTA, sans les déclarer vérifiés sur appareil.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Photo et ajout sont centrés en superposition au bas des Sources du dossier, avec réserve de défilement, chat et safe area conservés. Le composant commun garde la destination et les dialogues d’import ; l’Accueil conserve son décalage de barre native. Types/lint et exports natifs passent. Diagnostic documenté ; validation visuelle sur appareil après OTA restante.
<!-- SECTION:FINAL_SUMMARY:END -->
