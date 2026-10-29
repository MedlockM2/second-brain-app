---
id: TASK-557
title: >-
  Benchmarker l'usage des volumes gratuits puis la bascule automatique sur un
  crédit provisionné, pour chaque fournisseur
status: To Do
assignee: []
created_date: '2026-10-28 11:00'
updated_date: '2026-10-29 15:00'
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
- [x] #1 Le README couvre chaque fournisseur appelé par le code actuel (OpenAI, Deepgram, LlamaParse, Unstructured, Apify, API X) avec volume gratuit, comportement à l'épuisement, moyens de paiement au-delà et limites de dépense, sources primaires datées.
- [x] #2 Pour chaque fournisseur, le README dit si la bascule automatique du gratuit vers un crédit provisionné est possible et, si non, l'alternative la plus proche.
- [x] #3 La recommandation sépare les actions de compte à faire par l'owner et les changements de code (provider_pools, repli sur 402, comptes Apify), sans les exécuter.
- [x] #4 Le README comporte Recommendation et Owner Validation avec owner_decision: pending.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
README produit : docs/research/task-557-provider-free-tier-then-paid/README.md (owner_decision: pending). Sources primaires consultées le 2026-10-28 (OpenAI help/rate-limits, Deepgram pricing/errors, LlamaParse billing/pricing, Unstructured pricing/billing, Apify pricing/billing/subscriptions, X API pricing). Constat : bascule automatique possible par configuration chez OpenAI (recharge auto), Deepgram (auto-reload), Unstructured (carte), X (auto-recharge, pas de gratuit) ; impossible sur les plans Free de LlamaParse (402) et d'Apify (blocage), qui exigent un plan payant (Starter). Le code coupe aujourd'hui Apify à 90 % du gratuit (provider_pool_guard.spend_allowed) : recommandation de retirer provider_pools une fois les comptes basculés. Regrouper Apify sur un compte = configuration seule (un token par plateforme dans le secret). Non vérifiable sans console : soldes, moyens de paiement, allocation Unstructured unique ou mensuelle, code HTTP X à solde nul. Aucun compte, paiement ni code modifié ; aucun test.

Complément (mode complement, 2026-10-29) : docs/research/task-557-provider-free-tier-then-paid/complement-response-2026-10-29.md répond à complement-request-2026-10-29.md (recharge automatique sur coordonnées bancaires). Trois régimes : prépayé avec recharge automatique sur carte (OpenAI, Deepgram, X), facturé à l'usage sous limite de dépense (Unstructured, LlamaParse et Apify en Starter), blocage sans paiement possible (LlamaParse et Apify en Free). Aucun prélèvement bancaire documenté : carte partout. L'alerte « % du plafond » n'est indispensable que pour le régime C ; l'échec de recharge est couvert par la suspension de TASK-566. La recommandation attend la validation de l'owner.
<!-- SECTION:NOTES:END -->
