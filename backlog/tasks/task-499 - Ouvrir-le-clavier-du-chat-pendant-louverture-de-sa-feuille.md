---
id: TASK-499
title: Ouvrir le clavier du chat pendant l'ouverture de sa feuille
status: Done
assignee:
  - Codex
created_date: '2026-10-12 09:41'
updated_date: '2026-10-12 09:48'
labels:
  - mobile
  - testflight
dependencies: []
modified_files:
  - mobile/src/components/chat/ChatSheet.tsx
  - mobile/src/components/chat/ChatComposer.tsx
type: bug
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Première partie du feedback AD9M_CsdhTTaHMyX0_NSuig, build 14 : la feuille de conversation apparaît d'abord sans clavier puis se relève lorsque celui-ci arrive. Reprendre et revoir feedback/clavier-chat-en-un-temps. Le comportement spécifique de présentation iOS ne doit pas dégrader Android ni la lecture de l'historique. Validation sur appareil après distribution : ouverture et réouverture de la feuille, consultation de l'historique.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le focus initial iOS est demandé pendant la présentation de la feuille plutôt qu'après son animation ; Android conserve une demande adaptée au focus de fenêtre.
- [x] #2 Le retour depuis l'historique ne demande pas automatiquement le clavier.
- [x] #3 Typecheck et lint mobile passent sans nouvelle erreur ; aucune dépendance native ni test automatisé n'est ajouté.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reprendre la branche de focus iOS préparée, revoir le montage/réouverture et le retour d'historique contre le code natif installé. Conserver les demandes de focus adaptées à Android. Lancer typecheck/lint mobile avec les autres changements partagés ; documenter la validation appareil restante.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Branche feedback/clavier-chat-en-un-temps reprise et relue. Le code natif RN iOS installé appelle onShow à la fin de la présentation et autoFocus dans didMoveToWindow : prise de focus avancée au montage iOS, Android conserve onShow. Le retour d'historique désarme autoFocus. Typecheck et lint mobile passent ; seul warning préexistant dans purchaseService.ts. Pas de test automatisé ni de dépendance native. Vérification physique de l'ouverture/réouverture et de l'historique après OTA restante.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le champ du chat demande le clavier pendant l'ouverture de sa feuille sur iOS, avec le parcours de focus Android conservé. Le retour de l'historique ne réarme pas autoFocus. Typecheck/lint mobile passent, hors warning préexistant purchaseService. TSX seulement, distribuable en OTA ; validation appareil restante.
<!-- SECTION:FINAL_SUMMARY:END -->
