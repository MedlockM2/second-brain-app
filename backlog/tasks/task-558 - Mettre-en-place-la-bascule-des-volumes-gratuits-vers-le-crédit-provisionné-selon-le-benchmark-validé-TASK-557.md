---
id: TASK-558
title: >-
  Mettre en place la bascule des volumes gratuits vers le crédit provisionné
  selon le benchmark validé (TASK-557)
status: To Do
assignee: []
created_date: '2026-10-28 11:00'
labels:
  - backend
  - pricing
  - feature
dependencies:
  - TASK-557
references:
  - media_summarizer/core/services/pricing_config_service.py
  - media_summarizer/core/services/provider_pool_guard.py
priority: medium
type: feature
ordinal: 164000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Décision à appliquer

Lire la décision finale de l'owner dans docs/research/task-557-provider-free-tier-then-paid/README.md (Owner Validation, champ Decision et compléments qu'il cite), et non la seule recommandation initiale. Ne pas démarrer avant sa validation.

Appliquer dans le code les changements retenus pour que chaque fournisseur consomme son volume gratuit puis bascule sur le moyen de paiement retenu sans interruption de service : sort de `provider_pools` et de `provider_pool_guard.py`, comportement du repli LlamaParse → Unstructured sur 402, comptes Apify. Les actions de compte (console, moyens de paiement, plafonds) restent à l'owner : les décrire dans une checklist versionnée, ne pas les exécuter.

## Limites

Rien n'est déployé : aucune compatibilité ni double chemin avec les plafonds supprimés. Aucun test automatisé demandé, aucun appel local à FastAPI en guise de preuve. La vérification après déploiement relève de l'owner. Aucun secret ni identifiant de compte dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les changements de code retenus par la décision TASK-557 sont câblés ; les plafonds et chemins devenus inutiles sont supprimés, sans chemin de secours.
- [ ] #2 Une checklist versionnée décrit les actions de compte à faire par l'owner pour chaque fournisseur.
- [ ] #3 Ruff et mypy passent sur les fichiers backend modifiés ; terraform validate passe si l'infrastructure est modifiée.
<!-- AC:END -->
