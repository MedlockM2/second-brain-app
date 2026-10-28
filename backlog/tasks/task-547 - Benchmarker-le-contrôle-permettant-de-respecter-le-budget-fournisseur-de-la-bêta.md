---
id: TASK-547
title: >-
  Benchmarker le contrôle permettant de respecter le budget fournisseur de la
  bêta
status: Done
assignee:
  - '@codex'
created_date: '2026-10-26 22:20'
updated_date: '2026-10-28 11:19'
labels:
  - benchmark
  - backend
dependencies: []
documentation:
  - docs/research/pricing-challenge/README.md
  - docs/research/task-459-llm-token-rate-control/README.md
priority: high
type: spike
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Le compteur actuel ne garantit pas l’enveloppe financière : certains coûts sont connus après l’appel et les échecs, reprises ou appels concurrents peuvent créer des dépenses sans quota correspondant. Il faut établir une garantie réalisable sur les traitements actuellement accessibles avant de choisir le contrôle technique. Cette recherche porte sur la maîtrise du plafond fixé, pas sur la générosité des 5 EUR ni sur les abonnements futurs.

## Décisions acquises

Formule bêta autonome, indépendante des abonnements commerciaux, avec toutes les fonctionnalités actuellement disponibles. Budget de 5 EUR par compte et par mois, sans report, pour les coûts fournisseurs d’usage hors infrastructure fixe. Les 5 EUR sont considérés comme suffisamment permissifs : ne pas rouvrir ce calibrage. Valoriser l’usage réellement mesuré au tarif normal hors crédits promotionnels ; prendre en compte les tarifs de cache réellement appliqués. L’utilisateur voit un pourcentage, sans euros, crédits ni proposition d’achat. Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles lorsque la capacité est épuisée ; un nouveau traitement payant reste soumis au contrôle commun.

Source de vérité : docs/research/pricing-challenge/README.md, Owner Validation et R.1–R.2, décisions du 2026-10-26 et accord de l’owner sur la préparation de la formule bêta autonome.
## Livrable de recherche

Mener une recherche exhaustive dans ce périmètre, basée sur la documentation primaire disponible sur Internet et les observations existantes clairement datées. Produire docs/research/task-547-beta-budget-control/README.md, avec sources primaires datées, comparaison des options pertinentes, recommandation, limites de garantie et section Owner Validation (owner_decision: pending). Examiner les coûts maximaux avant appel, réservations, régularisation, concurrence, interruptions, nouvelles tentatives, métriques manquantes, fournisseurs de repli, appels partagés entre comptes et passage de mois. Distinguer la dépense financière des remboursements de capacité au testeur. Traiter le change, les arrondis, minima, options facturées, éventuelle marge de sécurité à l’intérieur des 5 EUR et la conduite à tenir si le coût ne peut pas être borné. Réutiliser les décisions existantes ; ne pas lancer une nouvelle sélection de modèles ou de fournisseurs.

## Limites de livraison

Aucune offre commerciale, recharge payante ou facturation à crédits à créer. Aucun changement de fournisseur ou de modèle sans décision validée ; ne pas rouvrir le contrôle du débit de tokens déjà arbitré par task-459. Aucun test automatisé demandé, aucun appel local à FastAPI en guise de preuve, aucune migration de fixtures ni compatibilité avec les anciens débits remplacés. Les vérifications après déploiement et sur appareils relèvent de la checklist propriétaire de task-440, pas d’un critère d’acceptation de cette tâche. Aucun secret, identité de compte ou payload fournisseur brut dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le README de recherche explicite le budget fixe de 5 EUR/mois, le périmètre des dépenses, la distinction entre valorisation et facture, et les hypothèses nécessaires à une garantie de plafond, sans recalibrer la permissivité ou les offres.
- [x] #2 L’inventaire couvre les chemins fournisseurs actuellement accessibles, leurs unités et coûts maximaux déterminables avant appel, avec sources primaires datées et limites ou conditions de refus documentées lorsque le coût n’est pas bornable.
- [x] #3 Les options de contrôle pertinentes sont comparées ; la recommandation couvre réservations, régularisation, concurrence, reprise, doubles livraisons, métriques manquantes, changement de mois et appels partagés, avec leurs compromis.
- [x] #4 Le rapport distingue dépenses et remboursements de capacité ; il traite échecs facturés, nouvelles tentatives, repli, arrondis, change et marge de sécurité éventuelle à l’intérieur des 5 EUR.
- [x] #5 Le README comporte Recommendation et Owner Validation avec owner_decision: pending ; les incertitudes et conditions restant à vérifier sont explicites, sans exiger une approbation propriétaire ou un déploiement comme livrable de recherche.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventorier les appels fournisseurs accessibles et les décisions existantes. 2. Vérifier les garanties et tarifs dans les documentations primaires. 3. Comparer les protocoles de contrôle et documenter une recommandation bornée. 4. Vérifier le rapport, committer uniquement la recherche et laisser la décision propriétaire en attente.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Recherche initiale produite dans docs/research/task-547-beta-budget-control/README.md. Inventaire du checkout et des décisions R.1–R.2, sources primaires consultées le 26 octobre 2026, comparaison et protocole conditionnel relus le 27 octobre. Les bornes manquantes (acteurs, pagination, rétention, change) sont explicites ; aucun appel payant ni code modifié. Recommandation en attente de validation propriétaire ; owner_decision: pending, TASK-548 reste bloquée.

2026-10-28 : owner_decision: ok (validée le 2026-10-27) dans docs/research/task-547-beta-budget-control/README.md ; benchmark clos, TASK-548 débloquée.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Benchmark documentaire livré : registre atomique de réservations maximales, régularisation et gestion prudente des issues inconnues ; distinction plafond valorisé/facture. Cinq AC documentaires couverts, sources primaires et formules relues. Décision propriétaire en attente.
<!-- SECTION:FINAL_SUMMARY:END -->
