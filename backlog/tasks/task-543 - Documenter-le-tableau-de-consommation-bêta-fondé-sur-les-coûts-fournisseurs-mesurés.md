---
id: TASK-543
title: >-
  Documenter le tableau de consommation bêta fondé sur les coûts fournisseurs
  mesurés
status: Done
assignee:
  - Codex
created_date: '2026-10-26 20:31'
updated_date: '2026-10-26 20:40'
labels:
  - documentation
dependencies: []
documentation:
  - docs/research/pricing-challenge/README.md
modified_files:
  - docs/research/pricing-challenge/README.md
type: docs
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le palier maximal accordé pendant la bêta conserve des équivalences en minutes qui ne reflètent pas les coûts des différents usages. Le plan approuvé par l’owner le 2026-10-26 fixe une enveloppe de 5 EUR par testeur et par mois, un comptage de chaque nouvelle génération selon l’usage mesuré, un affichage en pourcentage et une valorisation hors crédits promotionnels. Cette étape actualise uniquement la référence pricing existante et ses exemples. Les changements du compteur, des réservations, des API, des applications et des offres commerciales restent hors de cette livraison. Aucun test automatisé demandé.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Owner Validation consigne les décisions du 2026-10-26 : budget de 5 EUR par mois sans report, pourcentage visible, usage mesuré et crédits promotionnels sans effet sur le quota.
- [x] #2 Le tableau R.2 couvre les imports, traitements automatiques, générations sur média et dossier, chat et lecture, avec tarifs et change datés et sources primaires.
- [x] #3 La référence contient les trois exemples du plan et explique secondes, pages facturées, cache, réutilisation et précision des calculs.
- [x] #4 Le document distingue le modèle cible du runtime existant, maintient owner_decision: more et identifie les propositions commerciales historiques qui restent à recalculer.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Actualiser Owner Validation avec les décisions approuvées du 2026-10-26 et maintenir owner_decision: more.
2. Remplacer R.1/R.2 par le comptage de l’usage mesuré, les tarifs et le change datés, les exemples arithmétiques et les limites de mesure.
3. Délimiter les propositions historiques de forfaits et de prix et corriger leurs renvois qui contredisent la nouvelle référence.
4. Relire le diff, recalculer les exemples avec Decimal et vérifier les liens internes, les sources et l’absence de données sensibles ajoutées. Aucun code runtime, configuration distante ou test automatisé ne fait partie de cette étape.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner Validation et R.1/R.2 actualisés ; neuf actions couvertes, tarifs fournisseurs et change BCE datés du 2026-10-26, prix distincts du cache et du modèle de traduction. Les anciens forfaits, allocations et marges commerciales sont signalés comme historiques ; les questions de consommation 1 et 14 sont closes sans valider les offres. owner_decision reste more.
Validation documentaire : relecture des sections modifiées ; calculs refaits avec Decimal à 40 chiffres (0,001787630 EUR, 0,011172685 EUR, sous-total 2,819985699 EUR), cas secondes/pages/lecture et écriture du cache vérifiés. git diff --check propre. Aucun renvoi trouvé vers les anciens titres R.1/R.2 dans docs et backlog. Aucun email, clé, jeton ou identifiant de support ajouté au diff. Aucun test automatisé ajouté ou exécuté ; aucun changement du runtime ni de configuration distante.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le tableau cible de consommation bêta repose désormais sur un budget de 5 EUR par testeur et par mois et sur l’usage fournisseur mesuré, valorisé hors promotions. Les nouvelles générations sur média et dossier et les réponses du chat sont comptées ; l’utilisateur voit un pourcentage.

La référence pricing contient les tarifs et le change datés, neuf actions, les formules et exemples de coût, ainsi que les limites de mesure. Les propositions commerciales anciennes sont délimitées et owner_decision reste more. L’application au compteur, aux réservations et aux interfaces reste une étape ultérieure.

Validation : relecture documentaire, calculs Decimal des trois exemples et des cas secondes/pages/cache, git diff --check propre et contrôle des ajouts sensibles. Aucun test automatisé ajouté ou exécuté ; aucun changement runtime ou distant.
<!-- SECTION:FINAL_SUMMARY:END -->
