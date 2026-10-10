---
id: TASK-440
title: Valider sur AWS dev les parcours V1 et le digest avant la bêta
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies: []
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - tests/e2e/README.md
priority: high
ordinal: 47000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — déclencher la suite E2E existante contre AWS dev, vérifier le digest et qualifier les anomalies ; agent uniquement pour les corrections dans des tâches dédiées.

## Contexte et périmètre

Phase 4 : aucune preuve de run complet depuis juin dans le plan. Rejouer la suite existante sur le backend réellement déployé, sans écrire de tests ni importer FastAPI en guise de validation. Compléter par le digest journalier hors couverture actuelle. Ne pas toucher à la livraison email. Si un scénario est périmé, documenter cet écart et faire arbitrer sa correction plutôt que déclarer le produit validé.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le compte rendu consigne la date, la révision déployée, les parcours couverts et le résultat de la suite E2E existante contre AWS dev, sans données personnelles.
- [ ] #2 Le déclenchement et le résultat observé du digest journalier sont documentés séparément, avec les limites de couverture.
- [ ] #3 Chaque anomalie bloquante est reliée à une tâche de correction et à son état ; la décision de validation ou de report de Phase 4 est explicite.
<!-- AC:END -->
