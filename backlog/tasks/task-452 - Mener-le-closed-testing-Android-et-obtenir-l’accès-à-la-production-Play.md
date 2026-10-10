---
id: TASK-452
title: Mener le closed testing Android et obtenir l’accès à la production Play
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-260
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - mobile/MOBILE_CI_CD.md
priority: high
ordinal: 59000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — recruter et accompagner les testeurs, suivre la continuité de participation et demander l’accès à la production.

## Contexte et périmètre

task-260 couvre l’éligibilité du compte et le constat de l’exigence ; cette tâche couvre l’exécution et le suivi du closed testing. Le plan indique 12 testeurs pendant 14 jours, à confirmer dans la console avant démarrage. Commencer avec un binaire OTA-capable, sans attendre la sortie de la bêta de trois mois : ces calendriers peuvent se chevaucher. La piste interne n’est pas une preuve de closed testing. Ne pas collecter les emails des testeurs dans le dépôt.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le besoin exact affiché par Play, la piste, la version OTA-capable choisie et les dates de démarrage/fin sont consignés.
- [ ] #2 Le suivi documente de façon agrégée la participation continue et les retours utiles, sans identifier les testeurs.
- [ ] #3 Le statut de la demande d’accès production et les actions restantes ou le refus éventuel sont consignés avec leurs dates.
<!-- AC:END -->
