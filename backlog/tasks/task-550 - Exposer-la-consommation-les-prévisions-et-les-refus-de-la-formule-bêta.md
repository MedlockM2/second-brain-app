---
id: TASK-550
title: 'Exposer la consommation, les prévisions et les refus de la formule bêta'
status: To Do
assignee: []
created_date: '2026-10-26 22:21'
updated_date: '2026-10-26 22:30'
labels:
  - backend
  - mobile
  - web
  - feature
dependencies:
  - TASK-549
documentation:
  - docs/research/pricing-challenge/README.md
  - docs/research/task-547-beta-budget-control/README.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: high
type: feature
ordinal: 156000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Le mobile et le web lisent encore une allocation en minutes. Pour expliquer une capacité fondée sur les coûts, ils ont besoin d’un même état de consommation et de prévisions honnêtes, avec des refus distincts selon leur cause. Une estimation incertaine ne doit pas apparaître comme une action gratuite ou une promesse de coût exact.

## Décisions acquises

Formule bêta autonome, indépendante des abonnements commerciaux, avec toutes les fonctionnalités actuellement disponibles. Budget de 5 EUR par compte et par mois, sans report, pour les coûts fournisseurs d’usage hors infrastructure fixe. Les 5 EUR sont considérés comme suffisamment permissifs : ne pas rouvrir ce calibrage. Valoriser l’usage réellement mesuré au tarif normal hors crédits promotionnels ; prendre en compte les tarifs de cache réellement appliqués. L’utilisateur voit un pourcentage, sans euros, crédits ni proposition d’achat. Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles lorsque la capacité est épuisée ; un nouveau traitement payant reste soumis au contrôle commun.

Source de vérité : docs/research/pricing-challenge/README.md, Owner Validation et R.1–R.2, décisions du 2026-10-26 et accord de l’owner sur la préparation de la formule bêta autonome.
## Périmètre confirmé

Exposer le contrôle intégré par TASK-549 selon la décision de docs/research/task-547-beta-budget-control/README.md. Couvrir pourcentages consommé et disponible, opérations et réservations en cours, recharge mensuelle, prévision et refus typés. Distinguer épuisement du budget, opération trop importante et indisponibilité temporaire ; documenter ce qui est estimé, réservé et finalement consommé. Fournir le contrat API et les types partagés, avec les adaptations mécaniques des clients et consommateurs nécessaires à la suppression des anciens champs et à leur compilation. Ne pas différer ces adaptations à TASK-551 ni conserver des alias en attendant ; TASK-551 porte la présentation complète, les prévisions visibles et les messages. Toute modification de mobile/app ou mobile/src inclut sa parité web dans le même commit et la ligne Web: done. Réutiliser les chemins canoniques : aucune nouvelle route média ou artefact sous /api/v1/. L’endpoint existant d’entitlements reste modifiable comme prévu par AGENTS.md. Le code partagé de packages/core doit rester indépendant des plateformes.

## Limites de livraison

Aucune offre commerciale, recharge payante ou facturation à crédits à créer. Aucun changement de fournisseur ou de modèle sans décision validée ; ne pas rouvrir le contrôle du débit de tokens déjà arbitré par task-459. Aucun test automatisé demandé, aucun appel local à FastAPI en guise de preuve, aucune migration de fixtures ni compatibilité avec les anciens débits remplacés. Les vérifications après déploiement et sur appareils relèvent de la checklist propriétaire de task-440, pas d’un critère d’acceptation de cette tâche. Aucun secret, identité de compte ou payload fournisseur brut dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le contrat authentifié expose l’état bêta et la consommation en pourcentage, la disponibilité tenant compte des opérations en cours et la date de recharge, à partir du contrôle budgétaire commun plutôt que d’une reconversion des anciennes minutes.
- [ ] #2 Une prévision exploitable avant traitement important est disponible ; le contrat distingue estimation, réservation et consommation finale et représente explicitement une prévision indisponible, sans la présenter comme zéro.
- [ ] #3 Les refus typés distinguent budget épuisé, opération trop importante et indisponibilité temporaire ; leurs paramètres permettent des messages traduits cohérents sur mobile et web.
- [ ] #4 Le contrat canonique, OpenAPI, les types/client partagés et leurs consommateurs utilisent la même interface ; les adaptations nécessaires à leur compilation sont livrées sans attendre la tâche UI, les anciens champs en minutes sont retirés sans alias et aucun nouvel endpoint média/artéfact n’est ajouté sous /api/v1/.
- [ ] #5 Ruff/mypy et les vérifications TypeScript/lint appropriées de packages/core, mobile et web passent pour les changements concernés ; packages/core ne contient aucune dépendance ou lecture globale interdite par AGENTS.md.
<!-- AC:END -->
