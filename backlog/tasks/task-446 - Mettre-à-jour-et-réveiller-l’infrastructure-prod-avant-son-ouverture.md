---
id: TASK-446
title: Mettre à jour et réveiller l’infrastructure prod avant son ouverture
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-445
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - infrastructure/terraform/README.md
  - docs/PRODUCTION_RELEASE_RUNBOOK.md
priority: high
ordinal: 53000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — relire le plan Terraform, autoriser et appliquer les mutations dans le compte prod, puis déployer la révision de release.

## Contexte et périmètre

Phase 9 : prod existe mais les interrupteurs alarmes/dashboard/polling sont désactivés dans la configuration. Réconcilier le plan réel du jour, sans réutiliser les chiffres de septembre. Traiter l’ancienne table artifact_idempotence-prod si elle existe encore, uniquement après constat de son inutilité et de son contenu. Matérialiser la réservation de concurrence API, vérifier les permissions nécessaires à la suppression de compte, puis activer les workers et l’observabilité. Les credentials runtime sont déjà provisionnés : vérifier leur adéquation, ne pas les reprovisionner aveuglément.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le plan relu, ses mutations et leur justification sont résumés sans payload sensible ; les ressources obsolètes et leurs protections sont traitées explicitement.
- [ ] #2 Le compte rendu d’apply et de déploiement identifie la révision et l’état des trois interrupteurs, du polling et de la réservation API.
- [ ] #3 Le compte rendu décrit les contrôles du secret runtime et de la séparation des secrets de signature dev/prod par empreintes, sans valeurs ni empreintes publiées.
- [ ] #4 Le runbook consigne la procédure de retour à la veille et les coûts observés ou estimés du réveil.
<!-- AC:END -->
