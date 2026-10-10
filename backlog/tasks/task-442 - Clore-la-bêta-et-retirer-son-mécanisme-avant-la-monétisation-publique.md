---
id: TASK-442
title: Clore la bêta et retirer son mécanisme avant la monétisation publique
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-441
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/research/pricing-challenge/README.md
priority: high
ordinal: 49000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — décider de la sortie de bêta et du barème final ; agent — supprimer le code et les configurations de bêta après ce go, dans son worktree ; owner — appliquer et vérifier la release.

## Contexte et périmètre

Travail explicitement différé à la fin des trois mois. Garder dispatchable: false jusqu’au go de sortie et à la disponibilité des décisions de pricing ; une dépendance au démarrage ne vaut pas autorisation d’arrêter immédiatement la bêta. Retirer le bloc beta_access des defaults et ses lecteurs, ainsi que les entrées persistées dev/prod (retirer un default ne supprime pas une ligne DynamoDB). Rétablir les entrées normales de souscription, sans shim. Utiliser le barème finalement validé dans docs/research/pricing-challenge/README.md, sans en inventer un. Aucun travail sur un système de facturation à crédits dans cette tâche : le cas échéant, renvoyer à son travail dédié.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le go de fin de bêta et la référence au barème validé sont consignés ; sans eux, la tâche reste bloquée et non dispatchable.
- [ ] #2 Le code et les defaults ne contiennent plus le mécanisme beta_access ; les chemins normaux d’abonnement et d’essai sont rétablis.
- [ ] #3 Le compte rendu owner consigne le retrait des entrées beta_access de dev et prod, sans dump de pricing ni secrets.
- [ ] #4 Les vérifications statiques pertinentes sont consignées ; le runbook et la documentation de bêta reflètent sa clôture.
<!-- AC:END -->
