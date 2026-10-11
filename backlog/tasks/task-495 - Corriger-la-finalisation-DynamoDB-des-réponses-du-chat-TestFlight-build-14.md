---
id: TASK-495
title: Corriger la finalisation DynamoDB des réponses du chat (TestFlight build 14)
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 20:08'
updated_date: '2026-10-11 20:13'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le feedback TestFlight AHZWR6WoRA4_iLN_zyPtBtc montre un refus générique de question sur le build 14. CloudWatch confirme une ValidationException dans chat.seal_turn : text est utilisé sans alias dans une UpdateExpression. La réponse ne peut pas être finalisée et la reprise des tours perdus bloque aussi les lectures et nouveaux envois. Après déploiement, vérifier un nouveau tour et la reprise de la conversation bloquée sur dev.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les attributs optionnels de la réponse sont aliasés dans la transaction de finalisation, sans modifier le schéma ni les conditions de concurrence.
- [x] #2 Ruff et mypy sont propres sur le périmètre modifié.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Aliaser les attributs optionnels de seal_turn, auditer les expressions voisines, puis exécuter les contrôles statiques.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Les attributs optionnels sont aliasés dans seal_turn. Vérification directe sur DynamoDB dev : transaction avec texte validée syntaxiquement, refusée par les conditions sur une tentative inexistante, aucune écriture. Audit des expressions voisines effectué. Ruff backend complet et mypy (205 fichiers) passent. Vérification fonctionnelle après déploiement encore nécessaire : nouveau tour et récupération de la conversation bloquée.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Finalisation et reprise des réponses du chat corrigées par alias DynamoDB. Syntaxe vérifiée contre AWS dev sans écriture ; contrôles statiques backend propres.
<!-- SECTION:FINAL_SUMMARY:END -->
