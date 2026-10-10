---
id: TASK-454
title: Soumettre les releases iOS et Android et suivre les reviews stores
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
updated_date: '2026-10-10 15:15'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-449
  - TASK-450
  - TASK-451
  - TASK-452
  - TASK-453
  - TASK-447
  - TASK-166
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/PRODUCTION_RELEASE_RUNBOOK.md
  - docs/RELEASE_LOG.md
priority: high
ordinal: 61000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — donner le go de soumission, sélectionner les bons binaires, envoyer les dossiers et traiter les retours des stores.

## Contexte et périmètre

La release publique reste Pre-release dans RELEASE_LOG.md. task-45 a livré un runbook mais son statut Done ne constitue pas une preuve de publication. Soumettre les binaires production validés après la bêta ; ne pas promouvoir ceux qui ciblent dev. Vérifier les gates et consigner toute dérogation explicite de l’owner. Prévoir la maîtrise de la date de disponibilité avant le soft launch ; ne pas annoncer un délai de review garanti.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La checklist pré-soumission identifie les décisions go/no-go et les preuves des gates mobile, prod, légal, OAuth, billing et Play.
- [ ] #2 RELEASE_LOG.md consigne les versions/builds et dates de soumission de chaque plateforme, sans credentials reviewers.
- [ ] #3 Les retours et états de review, corrections demandées et décisions de disponibilité sont documentés jusqu’à approbation ou report explicite.
<!-- AC:END -->
