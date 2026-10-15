---
id: TASK-523
title: >-
  Rendre tous les résultats de recherche accessibles et rétablir le retour en
  haut
status: Done
assignee:
  - '@codex'
created_date: '2026-10-15 21:36'
updated_date: '2026-10-15 21:46'
labels:
  - mobile
  - backend
  - testflight
dependencies: []
documentation:
  - docs/testflight-feedback-log.md
modified_files:
  - media_summarizer/api/endpoints/search.py
  - media_summarizer/core/services/search_indexing.py
  - media_summarizer/utils/algolia_client.py
  - mobile/app/(tabs)/search.tsx
  - mobile/src/services/searchService.ts
  - docs/testflight-feedback-log.md
  - docs/TESTFLIGHT_2026_10_15_SEARCH_AND_SOURCE_ACTIONS.md
priority: high
type: bug
ordinal: 130000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Retour TestFlight AITLJTpcSDvmNLLq5PP4LJE du 15 octobre 2026, build 14 : la recherche AI annonce 21 résultats mais la liste affiche seulement la première page. La flèche de retour au sommet disponible dans la bibliothèque manque dans les résultats. Le backend limite aussi sa déduplication à un échantillon de chunks. Corriger le parcours complet avec les services existants, sans tests automatisés. Validation appareil après distribution à effectuer par owner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La recherche utilise la pagination et la déduplication par média du moteur au lieu de tronquer un échantillon de chunks.
- [x] #2 La liste mobile charge les pages suivantes avec reprise après erreur et ignore les réponses d’une ancienne recherche.
- [x] #3 Le retour au sommet est câblé dans la recherche comme dans la bibliothèque ; le compteur suit les suppressions.
- [x] #4 Typecheck/lint mobile et core, typecheck web et Ruff/mypy passent ; diagnostic et limites de validation sont documentés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remplacer l’échantillon de chunks par distinct media_item_id et pagination Algolia native, avec configuration appliquée avant la première recherche.
2. Ajouter au mobile pages successives, compteur, garde de requête/compte, reprise et fin réelle de liste.
3. Réutiliser une commande de retour au sommet avec respect du clavier et Réduire les animations.
4. Vérifier types/lint mobile/core/web, Ruff/mypy et exports natifs ; documenter diagnostic et validation appareil restante, commit/push demandés par owner.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnostic confirmé dans le code : mobile limité à la page 1/10, backend limité à quarante chunks avant déduplication ; retour au sommet monté seulement dans la bibliothèque. Trois captures consultées pour les deux retours de cette passe.

Vérification directe sur Algolia dev : attribut de regroupement absent, configuration déclarée du correctif appliquée. Requête AI sur les données actuelles : 22 médias distincts en pages 10/10/2, has_more vrai/vrai/faux. Aucun média ni transcript réécrit. Lecture DynamoDB sans écriture pour sélectionner la fixture ; aucune identité consignée.

Revue des chemins de pagination/reprise, révision de requête et compte, revalidation de la fenêtre après suppression et bouton commun. Types mobile/core/web, lint mobile/core, Ruff/mypy backend et exports Hermes iOS/Android passent. Seul warning préexistant purchaseService. Aucun test automatisé ajouté/lancé. Rendu et gestes natifs à confirmer par owner après OTA et déploiement API ; aucune affirmation de reproduction appareil.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
La recherche rend ses pages accessibles et ne calcule plus son total depuis un échantillon de chunks. Pagination/groupement natifs Algolia, has_more explicite, verrou et reprise mobile, réponses obsolètes ignorées, revalidation des pages après suppression et retour au sommet commun aux deux listes. Vérification réelle Algolia dev : 22 médias distincts, 10/10/2. Types/lint, Ruff/mypy et exports natifs passent ; validation iPhone après distribution restante. Diagnostic et contrat documentés dans docs/TESTFLIGHT_2026_10_15_SEARCH_AND_SOURCE_ACTIONS.md.
<!-- SECTION:FINAL_SUMMARY:END -->
