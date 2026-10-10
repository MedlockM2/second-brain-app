---
id: TASK-455
title: Conduire le soft launch et décider du déploiement géographique élargi
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-454
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/RELEASE_LOG.md
priority: high
ordinal: 62000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — choisir le pays et la cohorte, ouvrir l’accès, suivre la semaine d’observation et décider de l’élargissement.

## Contexte et périmètre

Phase 10 prévoit un pays, environ 100 utilisateurs et une semaine d’observation avant élargissement. Ce jalon suit la bêta et les approvals stores. Définir avec l’owner les critères concrets de stabilité/coût/usage, le canal de support et la procédure de suspension. Le Discord reste porté par task-118 et n’est pas une dépendance obligatoire ; un canal opérationnel approuvé suffit. Ne pas créer de nouveau système de monitoring ou d’analytics dans ce ticket.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le pays, la taille cible, les dates, les responsabilités de support et les critères d’arrêt/élargissement approuvés sont consignés.
- [ ] #2 Le bilan de la semaine rassemble stabilité, erreurs, files/DLQ, coûts, usage et retours de façon agrégée sans données personnelles.
- [ ] #3 La décision d’élargissement, de prolongation ou de suspension et les actions associées sont tracées dans le release log.
<!-- AC:END -->
