---
id: TASK-445
title: Préparer le domaine API et la configuration mobile de production de Deepn
status: To Do
assignee:
  - agent
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - agent
dependencies:
  - TASK-443
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/PRODUCTION_RELEASE_RUNBOOK.md
  - mobile/MOBILE_CI_CD.md
priority: high
ordinal: 52000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Agent — livrer les changements de configuration et de runbook ; owner — fournir domaine/zone acquis puis appliquer DNS, certificats et secrets hors dépôt.

## Contexte et périmètre

Phase 9/10 : le profil EAS production pointe encore sur un domaine placeholder. Après acquisition, préparer la configuration Terraform du domaine API et aligner les profils clients appropriés ainsi que les procédures OAuth web. Préserver la séparation dev/prod : les builds internes de bêta restent sur dev tant qu’aucune décision ne les bascule. Ne pas remplacer indistinctement toutes les URLs dev par prod. Les opérations DNS, la mise à jour des secrets et le déploiement sont des prérequis de release de l’owner, pas des ACs du travail en branche.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution par un agent dans son worktree : livrer les fichiers et vérifications locales, sans merge, push, déploiement ni publication. Toute validation déployée relève de la checklist owner, pas des critères du travail en branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La configuration Terraform prod référence le domaine et la zone réellement retenus, sans fournisseur nouvellement imposé ni secret suivi.
- [ ] #2 Le profil EAS production et les références de release visent la bonne API ; la destination dev des profils de test est explicite.
- [ ] #3 Le runbook décrit les opérations owner DNS/certificat, OAuth web, Secrets Manager et rebuild ainsi que l’ordre de mise en service.
- [ ] #4 Les vérifications locales pertinentes de configuration sont consignées ; aucune URL placeholder n’est annoncée comme endpoint de production valide.
<!-- AC:END -->
