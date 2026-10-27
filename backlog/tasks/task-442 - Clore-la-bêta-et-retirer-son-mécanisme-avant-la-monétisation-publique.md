---
id: TASK-442
title: >-
  Clore l’accès bêta avant la monétisation publique en conservant le contrôle
  budgétaire commun
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
updated_date: '2026-10-26 22:24'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-441
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/research/pricing-challenge/README.md
  - docs/research/task-547-beta-budget-control/README.md
priority: high
ordinal: 49000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — décider de la sortie de bêta et du barème commercial final ; agent — retirer uniquement les règles et configurations propres à l’accès bêta après ce go, depuis son worktree ; owner — appliquer et vérifier la release.

## Pourquoi et périmètre

La formule bêta autonome de trois mois doit prendre fin sur décision explicite, sans emporter le contrôle commun des dépenses sur lequel elle repose. Cette tâche est différée jusqu’au go de sortie et à la disponibilité des décisions commerciales ; dépendre de task-441 ne vaut pas autorisation d’arrêter immédiatement la bêta. Garder dispatchable: false jusqu’à ces prérequis.

## Décisions acquises

Formule bêta autonome, indépendante des abonnements commerciaux, avec toutes les fonctionnalités actuellement disponibles. Budget de 5 EUR par compte et par mois, sans report, pour les coûts fournisseurs d’usage hors infrastructure fixe. Les 5 EUR sont considérés comme suffisamment permissifs : ne pas rouvrir ce calibrage. Valoriser l’usage réellement mesuré au tarif normal hors crédits promotionnels ; prendre en compte les tarifs de cache réellement appliqués. L’utilisateur voit un pourcentage, sans euros, crédits ni proposition d’achat. Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles lorsque la capacité est épuisée ; un nouveau traitement payant reste soumis au contrôle commun.

Source de vérité : docs/research/pricing-challenge/README.md, Owner Validation et R.1–R.2, décisions du 2026-10-26 et accord de l’owner sur la préparation de la formule bêta autonome.
## Clôture à documenter

Retirer les règles d’accès et defaults spécifiques à la bêta ainsi que ses entrées persistées dans les environnements concernés ; une entrée retirée des defaults peut survivre dans une table distante. Rétablir le parcours d’abonnement et d’essai finalement validé, sans inventer de prix, de budget commercial ou de compatibilité.

Conserver le contrôle budgétaire commun, son historique financier, les réservations encore à régler et le suivi d’usage nécessaires. Le retrait de l’accès bêta n’autorise ni la suppression de ce socle ni une remise à zéro qui effacerait une dépense déjà engagée. Les futures allocations commerciales doivent provenir de la décision finale de la référence pricing, pas du budget bêta de 5 EUR. La validation de sortie et la configuration distante relèvent du compte rendu propriétaire ; l’agent ne revendique aucun déploiement depuis son worktree.

## Exécution propriétaire et limites

Exécution owner-only, dispatchable: false : les dates, opérations de configuration distante, appareils et release appartiennent à l’owner. Les critères portent sur le compte rendu et les décisions documentées ; ils ne deviennent pas des gates de déploiement pour les agents d’implémentation. Aucun nouveau test automatisé, aucune migration de fixtures, aucune compatibilité avec l’ancien comptage remplacé et aucune facturation commerciale à crédits. Ne pas toucher au sync Spotify, à la livraison email, à la logique de génération des quiz ou à Whisper. Aucun secret, identité de compte, identifiant de support ou payload brut dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le go de fin de bêta et la référence au barème commercial validé sont consignés ; sans eux, la tâche reste différée et verrouillée par dispatchable: false.
- [ ] #2 Les règles de code et defaults propres à l’accès bêta sont retirées et les chemins d’abonnement/essai validés sont rétablis ; le contrôle budgétaire commun, son historique et le traitement des engagements en cours sont conservés.
- [ ] #3 Le compte rendu owner consigne le retrait des configurations propres à la bêta des environnements concernés et les limites de vérification, sans dump de pricing, identité de compte ou secrets.
- [ ] #4 Les vérifications statiques pertinentes sont consignées ; le runbook et la documentation reflètent la clôture de l’accès bêta et la conservation du contrôle financier commun.
<!-- AC:END -->
