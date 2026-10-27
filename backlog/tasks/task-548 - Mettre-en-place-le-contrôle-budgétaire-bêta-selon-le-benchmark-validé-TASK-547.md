---
id: TASK-548
title: >-
  Mettre en place le contrôle budgétaire bêta selon le benchmark validé
  (TASK-547)
status: To Do
assignee: []
created_date: '2026-10-26 22:21'
updated_date: '2026-10-26 22:22'
labels:
  - backend
  - feature
dependencies:
  - TASK-547
documentation:
  - docs/research/pricing-challenge/README.md
  - docs/research/task-547-beta-budget-control/README.md
  - docs/V1_LAUNCH_PLAN.md
priority: high
type: feature
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L’accès bêta hérite aujourd’hui d’un ancien palier en minutes. Le budget autonome retenu et sa protection financière demandent un socle commun avant de reprendre tous les traitements fournisseurs. Les remboursements de capacité accordés au testeur ne doivent pas effacer les dépenses déjà engagées.

## Décisions acquises

Formule bêta autonome, indépendante des abonnements commerciaux, avec toutes les fonctionnalités actuellement disponibles. Budget de 5 EUR par compte et par mois, sans report, pour les coûts fournisseurs d’usage hors infrastructure fixe. Les 5 EUR sont considérés comme suffisamment permissifs : ne pas rouvrir ce calibrage. Valoriser l’usage réellement mesuré au tarif normal hors crédits promotionnels ; prendre en compte les tarifs de cache réellement appliqués. L’utilisateur voit un pourcentage, sans euros, crédits ni proposition d’achat. Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles lorsque la capacité est épuisée ; un nouveau traitement payant reste soumis au contrôle commun.

Source de vérité : docs/research/pricing-challenge/README.md, Owner Validation et R.1–R.2, décisions du 2026-10-26 et accord de l’owner sur la préparation de la formule bêta autonome.
## Décision technique à appliquer

Lire la décision finale de l’owner dans docs/research/task-547-beta-budget-control/README.md, et non la seule recommandation initiale. Cette tâche est l’implémentation directement associée à TASK-547 ; ne pas démarrer avant sa validation. Livrer le socle commun de budget et de périodes, de réservation et de règlement retenu, ainsi que ses états et règles de reprise. Le branchement exhaustif des traitements est porté par TASK-549 ; l’exposition publique et l’UI sont portées par TASK-550–TASK-551. Inclure la configuration et le cycle de vie des données et permissions requis, sans travail de release depuis le worktree. Actualiser Owner Validation/R.1–R.2 de la référence et la phase bêta du plan de lancement : la bêta n’hérite plus d’une allocation commerciale maximale.

## Limites de livraison

Aucune offre commerciale, recharge payante ou facturation à crédits à créer. Aucun changement de fournisseur ou de modèle sans décision validée ; ne pas rouvrir le contrôle du débit de tokens déjà arbitré par task-459. Aucun test automatisé demandé, aucun appel local à FastAPI en guise de preuve, aucune migration de fixtures ni compatibilité avec les anciens débits remplacés. Les vérifications après déploiement et sur appareils relèvent de la checklist propriétaire de task-440, pas d’un critère d’acceptation de cette tâche. Aucun secret, identité de compte ou payload fournisseur brut dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le chemin d’attribution bêta est indépendant du catalogue commercial et sa configuration décrit le budget de 5 EUR par compte, les périodes mensuelles et l’absence de report selon la décision validée.
- [ ] #2 Le socle de contrôle implémente les réservations, règlements et états de reprise retenus par la décision propriétaire ; les règles de concurrence, de duplication et de passage de période sont documentées et câblées.
- [ ] #3 Les dépenses financières engagées ou constatées sont distinguées des remboursements de capacité utilisateur ; les règles de l’étude empêchant une remise à zéro fictive de la dépense sont présentes dans le socle.
- [ ] #4 Les schémas, permissions et règles de cycle de vie nécessaires sont livrés ; la référence pricing et le plan de lancement décrivent la formule autonome et distinguent le socle livré de ses branchements et vérifications de release restants.
- [ ] #5 Les vérifications statiques pertinentes passent sur les fichiers modifiés : Ruff/mypy, et terraform validate lorsque l’infrastructure est modifiée ; aucune suite automatisée ou mise en production n’est une condition de livraison.
<!-- AC:END -->
