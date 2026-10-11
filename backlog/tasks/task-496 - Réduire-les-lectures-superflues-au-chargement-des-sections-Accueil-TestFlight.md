---
id: TASK-496
title: >-
  Réduire les lectures superflues au chargement des sections Accueil
  (TestFlight)
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 20:08'
updated_date: '2026-10-11 20:14'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le feedback AERqG0qb01vLxwHrsqnTEcI signale le retard des non-classés et de Reprendre par rapport aux ajouts récents sur le build 11. Les corrections mobiles task-417 et task-421 existent déjà. Mesurer les lectures AWS dev avant de cibler le coût restant. Après déploiement, comparer le premier affichage sur appareil.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les mesures des lectures AWS dev et les limites du diagnostic sont documentées sans identité de compte.
- [x] #2 Les lectures des sections Accueil ne chargent plus de contenus de bibliothèque inutiles aux compteurs et couvertures affichés, sans changer leur sémantique.
- [x] #3 Ruff et mypy sont propres sur le périmètre modifié.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Mesurer directement les lectures DynamoDB et la signature des couvertures sur les fixtures dev ; cibler les étapes dominantes et supprimer les chargements globaux inutiles ; vérifier les types et le lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Mesures directes AWS dev depuis le poste, sans appel FastAPI local : 23 dossiers et 48 médias. Avant : accueil Reprendre 414 puis 296 ms, hydratation globale 125 ms ; non-classés 173 puis 163 ms. Après : Reprendre 448 puis 243 ms, hydratation ciblée 117 puis 94 ms ; non-classés 173 puis 198 ms. Deux passes seulement, avec initialisation des clients et variabilité réseau : aucun gain garanti au premier affichage, aucun gain mesuré du compteur. La réduction de payload est acquise : un seul dossier transféré pour les non-classés ; COUNT sans contenu et projections de couvertures bornées pour les seuls dossiers affichés. Comparaison directe sur 11 dossiers dev : compteurs et ordre des URLs brutes de couvertures identiques à la sélection précédente ; 19 non-classés. Sentry ne renvoie aucune transaction dans la fenêtre de sept jours ; les traces utilisateur ne permettent donc pas ici de conclure sur la totalité du délai ressenti. Ruff backend complet et mypy (205 fichiers) passent.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Suppression de la lecture complète de bibliothèque pour les tuiles dossier et du transfert de tous les dossiers pour le compteur des non-classés. Sémantique vérifiée sur AWS dev ; contrôle statique propre. Gain ressenti à confirmer après déploiement.
<!-- SECTION:FINAL_SUMMARY:END -->
