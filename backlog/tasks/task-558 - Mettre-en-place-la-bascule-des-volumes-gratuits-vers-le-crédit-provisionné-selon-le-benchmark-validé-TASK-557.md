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

La checklist doit inclure, pour OpenAI : **l'owner dépose lui-même des crédits sur la plateforme OpenAI pour passer du palier Build au palier Launch** (seuil de 100 $ de crédits achetés au cumul, par l'organisation ; les factures de Billing history peuvent inclure la TVA, le montant à ajouter se lit sur le bouton « Upgrade tier » de la page Limits). Après le dépôt, il relit la page Limits (Luna : 10 000 RPM / 10 M TPM attendus) et relève à la main les plafonds configurés par TASK-564, qui ne montent pas automatiquement (docs/research/task-563-provider-capacity-fairness-operator-safety/README.md, §4.1 et §8). Ne pas exécuter ce dépôt ni toucher au moyen de paiement.

## À traiter dans ce périmètre

Décision de l'owner du 2026-10-29 : aucun seuil d'arrêt à un pourcentage du crédit gratuit. Supprimer `stop_pct` et la consultation de `spend_allowed` d'Apify avec `provider_pools` ; ne pas l'ajouter à LlamaParse, qui ne la consulte pas aujourd'hui. Un fournisseur dont le crédit est épuisé répond par une erreur que chaque chemin traite (voir TASK-566), pas par une coupure préventive. Garder le décompte des unités consommées tant que l'alarme à 60 % sert encore, sinon le supprimer aussi.

## Limites

Rien n'est déployé : aucune compatibilité ni double chemin avec les plafonds supprimés. Aucun test automatisé demandé, aucun appel local à FastAPI en guise de preuve. La vérification après déploiement relève de l'owner. Aucun secret ni identifiant de compte dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les changements de code retenus par la décision TASK-557 sont câblés ; les plafonds et chemins devenus inutiles sont supprimés, sans chemin de secours.
- [ ] #2 Une checklist versionnée décrit les actions de compte à faire par l'owner pour chaque fournisseur., dont le dépôt de crédits OpenAI vers le palier Launch et la relecture des limites qui s'ensuit.
- [ ] #3 Ruff et mypy passent sur les fichiers backend modifiés ; terraform validate passe si l'infrastructure est modifiée.
<!-- AC:END -->
