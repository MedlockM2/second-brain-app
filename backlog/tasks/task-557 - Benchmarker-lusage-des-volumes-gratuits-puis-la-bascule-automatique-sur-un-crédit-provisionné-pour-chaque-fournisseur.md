---
id: TASK-557
title: >-
  Benchmarker l'usage des volumes gratuits puis la bascule automatique sur un
  crédit provisionné, pour chaque fournisseur
status: To Do
assignee: []
created_date: '2026-10-28 11:00'
updated_date: '2026-10-28 11:00'
labels:
  - benchmark
  - backend
  - pricing
dependencies: []
references:
  - media_summarizer/core/services/pricing_config_service.py
  - media_summarizer/core/services/provider_pool_guard.py
  - docs/research/pricing-challenge/README.md
  - docs/research/task-547-beta-budget-control/README.md
priority: high
type: spike
ordinal: 163000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'owner veut, pour chaque fournisseur payant retenu, consommer systématiquement le volume gratuit offert jusqu'à son épuisement, puis basculer automatiquement, sans interruption de service, sur un crédit qu'il aura provisionné à l'avance (ou tout autre moyen de paiement prévu par le fournisseur). Aujourd'hui, `provider_pools` dans `media_summarizer/core/services/pricing_config_service.py` fait l'inverse pour LlamaParse et Apify : il coupe les nouveaux appels à 90 % du volume gratuit mensuel partagé, et le repli LlamaParse → Unstructured se déclenche sur l'erreur 402 d'épuisement. Ce benchmark doit établir, fournisseur par fournisseur, si le comportement voulu est possible et ce qu'il faut faire pour l'obtenir.

## Périmètre

Fournisseurs appelés par le code actuel : OpenAI (Luna, et GPT-5-nano tant que TASK-556 n'est pas livrée), Deepgram, LlamaParse (LlamaCloud), Unstructured, Apify (YouTube, TikTok, Instagram), API X. Pour chacun, à partir de la documentation primaire publique, avec date de consultation (l'agent n'a pas accès aux consoles ; ce qui ne se vérifie que dans une console est signalé comme vérification owner) :

- volume gratuit offert : nature (crédit à l'inscription, volume mensuel renouvelé, forfait), montant, renouvellement ;
- ce qui se passe à l'épuisement : erreur, coupure, passage automatique au payant, dépassement facturé ;
- moyens de payer au-delà : crédit prépayé, recharge automatique, carte en paiement à l'usage, abonnement, plan supérieur ; peut-on cumuler gratuit puis payant sur le même compte, sans action manuelle ;
- limites de dépense ou alertes disponibles côté fournisseur ;
- état actuel connu : Apify sur trois comptes Free distincts (YouTube, TikTok, Instagram, cf. docs/research/pricing-challenge/README.md correction 7) ; LlamaParse Free (10 000 crédits) ; API X en prépayé, solde mesuré à 4,95 USD le 2026-10-28.

Recommandation attendue : par fournisseur, la configuration de compte à faire par l'owner (console, paiement, plafonds) et les changements de code éventuels (`provider_pools`, repli LlamaParse → Unstructured sur 402, comptes Apify multiples). Le budget de 5 EUR par testeur (TASK-547) n'est pas concerné : il valorise l'usage au tarif normal, gratuit ou non.

## Limites

Recherche uniquement : aucune modification de compte, de paiement ni de code. Aucun secret, identifiant de compte ou solde détaillé au-delà de ce qui est nécessaire dans les fichiers suivis. Produire docs/research/task-557-provider-free-tier-then-paid/README.md avec Owner Validation et owner_decision: pending.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le README couvre chaque fournisseur appelé par le code actuel (OpenAI, Deepgram, LlamaParse, Unstructured, Apify, API X) avec volume gratuit, comportement à l'épuisement, moyens de paiement au-delà et limites de dépense, sources primaires datées.
- [ ] #2 Pour chaque fournisseur, le README dit si la bascule automatique du gratuit vers un crédit provisionné est possible et, si non, l'alternative la plus proche.
- [ ] #3 La recommandation sépare les actions de compte à faire par l'owner et les changements de code (provider_pools, repli sur 402, comptes Apify), sans les exécuter.
- [ ] #4 Le README comporte Recommendation et Owner Validation avec owner_decision: pending.
<!-- AC:END -->
