---
id: TASK-453
title: Confirmer les droits et quotas des abonnements après la sortie de bêta
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-442
  - TASK-449
  - TASK-448
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/REVENUECAT_ENTITLEMENTS.md
priority: high
ordinal: 60000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — effectuer achats/restauration sur appareils connectés et contrôler les droits reçus ; agent — diagnostiquer les écarts dans une tâche de correction.

## Contexte et périmètre

Les achats sandbox des deux stores sont déjà prouvés : ne pas refaire leur provisioning. Reste la preuve de propagation vers les allocations/quotas, puis sa confirmation sur prod avec le catalogue final. Pendant beta_access, le palier maximal masque les effets d’un abonnement : effectuer cette validation après suppression du mécanisme bêta. Couvrir achat, restauration et changement de formule, ainsi que les refus selon les droits retenus, sans créer de tests ni toucher un système de facturation à crédits.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le compte rendu iOS/Android consigne build, environnement, formule attendue et droits/allocations observés, sans identité utilisateur ni payload brut.
- [ ] #2 Les observations couvrent achat, restauration et changement de formule ; les refus de quota sont évalués au regard du barème validé.
- [ ] #3 Les écarts ont une tâche de correction et la conclusion go/no-go monétisation est explicite.
<!-- AC:END -->
