---
id: TASK-448
title: Valider les parcours et la charge sur prod avant de l’ouvrir aux utilisateurs
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-446
  - TASK-440
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/PRODUCTION_RELEASE_RUNBOOK.md
priority: high
ordinal: 55000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — exécuter les parcours depuis des appareils physiques et autoriser l’essai de charge et son coût.

## Contexte et périmètre

Phase 9 : un health 200 n’établit pas le fonctionnement du produit. Vérifier une URL réelle de chaque source V1, lecture et artefacts, suppression de compte, droits/quotas dans le régime actif, et webhook sandbox contre prod. Exécuter ensuite l’essai prévu de 50–100 URLs en parallèle après réservation de concurrence, observer latences cold/warm, files SQS, DLQ, erreurs et coût. Ne pas inventer de seuil de succès ni écrire de harness : utiliser les outils existants et faire décider les seuils/coûts à l’owner. La validation finale des abonnements après bêta est distincte.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La matrice des sources et parcours prod identifie date, build/révision, résultats et limites ; le health check n’est pas présenté comme preuve E2E.
- [ ] #2 Le compte rendu de charge consigne volume autorisé, latences, files/DLQ, erreurs, coût et conclusion au regard des seuils acceptés par l’owner.
- [ ] #3 La vérification du webhook sandbox et des droits dans le régime actif est documentée sans payload utilisateur.
- [ ] #4 Les anomalies bloquantes et la décision go/no-go sont consignées, sans déclarer un gate fermé en présence d’un échec non résolu.
<!-- AC:END -->
