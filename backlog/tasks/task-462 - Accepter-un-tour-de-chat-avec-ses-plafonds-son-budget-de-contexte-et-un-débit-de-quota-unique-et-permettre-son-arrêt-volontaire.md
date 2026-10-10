---
id: TASK-462
title: >-
  Accepter un tour de chat avec ses plafonds, son budget de contexte et un débit
  de quota unique, et permettre son arrêt volontaire
status: To Do
assignee: []
created_date: '2026-10-10 17:58'
labels:
  - backend
  - api
  - chat
  - feature
dependencies:
  - TASK-457
  - TASK-460
  - TASK-461
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - >-
    docs/research/task-430-chatbot-architecture/complement-response-2026-10-07.md
  - media_summarizer/core/services/quota_enforcer.py
  - media_summarizer/core/services/pricing_config_service.py
  - media_summarizer/utils/quota_usage_db.py
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/workers/artifact_generator/generators/corpus.py
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat est décidée par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10 — **source de vérité**, qui prime sur la Recommendation et sur le complément. Cette tâche porte les routes d'envoi d'un tour et d'arrêt, sur la façade HTTP sous `/api/chat` (Decision point 5), dans le routeur créé par la tâche des conversations.

## Envoyer un tour

Dans l'ordre, avant toute écriture :

1. **Plafonds explicites** (Decision point 8 : « Les plafonds de saisie, sortie et historique sont des paramètres explicites, non une limite du modèle de stockage »). Valeurs de départ = les candidates du README §9.4 : question à **1 000 caractères**, **20 tours** par conversation (refus `conversation_full`), **un tour en vol par compte** toutes conversations confondues (refus `turn_in_flight`). Le plafond de **sortie** n'est pas un plafond propre au chat : décision de l'owner du 2026-10-10, le chat garde `LLM_MAX_COMPLETION_TOKENS` de `llm_config.py` (32 000 depuis le 2026-10-10, partagé avec les artefacts, au-dessus du minimum de 25 000 qu'OpenAI demande pour les modèles de raisonnement), qui est déjà un paramètre explicite. Les 2 000 tokens du §9.4 étaient calculés pour `gpt-5.4-nano` ; sur Luna les tokens de raisonnement comptent dans ce plafond, et un plafond bas couperait le raisonnement avant la réponse. La longueur d'une réponse se règle dans les instructions du chat (par exemple : réponse en quelques paragraphes sauf demande contraire de l'utilisateur), dans le module de prompt partagé ci-dessous. Constantes de code nommées au même endroit que les autres plafonds, pas des nombres épars.
2. **Budget de contexte vérifié avant chaque tour, refus explicite au dépassement** (Decision point 7 : « Vérifier le budget de contexte avant chaque tour et refuser explicitement un dépassement » ; pas de troncature silencieuse, pas de résumé de l'historique, pas de récupération de passages). Le budget compte les tokens d'**entrée** du tour : le corpus de l'instantané, les instructions, l'historique complet (les réponses passées y entrent par leur texte visible) et la question. La sortie du tour en cours n'entre pas dans la marche de prix, qui porte sur l'entrée ; ne pas y imputer le plafond de sortie, ce qui amputerait le corpus. Le complément C3.2 établit que sur Luna le plafond économique est la marche de prix à **272 000 tokens d'entrée**, que la requête **entière** est repricée au-delà, et que l'estimateur `byte_length / 3.4` a ±10 % d'erreur : le budget doit garder le tour sous cette marche avec cette marge, et la règle retenue est documentée dans le code. Nouveau refus typé (par exemple `context_budget_exceeded`) avec ses chiffres.
3. **Quota** (Decision point 8 : « Réutiliser l'unité de quota en minutes et le barème par tour proposé au §9.1, avec un débit unique par tour logique, y compris lors d'une reprise réseau ou d'une tentative technique »). Un tour coûte `minutes_for_folder_sources(source_count)` (`quota_enforcer.py`), soit `max(1, ceil(S/5))` minutes, **sans l'exemption « une génération sur un média unique est gratuite »** (README §9.1 en donne la raison). Vérification par `check_submission_allowed` avant écriture ; refus `out_of_minutes` / `item_too_long` existants, y compris `beta_access` qui supprime la route vers le paywall. Débit par `_debit` sous un token d'idempotence propre au **tour logique** (pas à la tentative), pour qu'une redélivrance ou une nouvelle tentative ne redébite jamais. `burst_guards.generations_per_day` passe de 50 à 120 (`pricing_config_service.py`), pour la raison donnée au §9.4 ; il ne refuse rien.
4. **Écriture atomique** du tour accepté, de son message utilisateur, de sa première tentative et de son **intention d'envoi** (Decision point 4), par une transaction DynamoDB et les opérations conditionnelles du socle de données (task-457). L'expédition de l'intention vers la file est le travail d'un relais tranché par un benchmark séparé : cette route n'envoie rien vers SQS. **Traitement explicite des échecs** (Decision point 4) : un refus avant écriture ne débite rien ; un échec de la transaction ne laisse ni tour, ni débit ; documenter dans le code et le contrat ce qui se passe quand l'écriture réussit mais que le débit échoue (`_debit` est best-effort par conception, README §14.1) et ce qu'il advient du débit d'un tour dont le lancement échoue définitivement (remboursé, voir le point 5).

5. **Remboursement d'un tour sans réponse** (décision de l'owner du 2026-10-10 : « On rembourse »). Un tour scellé en **échec sans aucun texte visible** est remboursé de ses minutes ; un tour qui a produit du texte (terminé, interrompu, échec partiel) ne l'est pas. Ajouter dans `quota_enforcer.py` une opération de remboursement à côté de `_debit` : elle recrédite les minutes et le coût du débit **sur la période où il a été fait** (enregistrer la clé de période et les minutes débitées sur le tour), une seule fois sous un token d'idempotence propre au remboursement du tour, et seulement si le débit a bien été appliqué. Best-effort comme `_debit` (un échec d'écriture est journalisé, il ne fait pas échouer le scellement). Les compteurs de rafale du jour ne sont pas recrédités. C'est le premier remboursement du dépôt : mettre à jour le commentaire « Minutes are never refunded » de `quota_enforcer.py` pour dire qu'il vaut pour les imports et que le chat fait exception. Le scellement en échec et l'appel du remboursement sont faits par le worker (task-463) et par la récupération de l'outbox (task-465) ; cette tâche fournit l'opération et la règle.

Le prompt du tour est construit par le worker ; mais la règle de calcul du budget doit être **la même** que celle du worker. La placer dans un module partagé (par exemple `media_summarizer/core/services/chat_prompt.py`) qui expose aussi la construction des messages : corpus en préfixe stable via la couche corpus extraite par task-460, puis instructions du chat (avec les fragments partagés de `corpus.py` tels quels, dont `source_ref_instruction(required=True)` pour que chaque citation nomme sa source — README §11.2), puis l'historique avec ses rôles, puis la question. Rien devant le corpus. `prompt_cache_key` calculé sur le même matériau que `_prompt_cache_key` des artefacts (README §11.3), pour partager le cache sans partager de données.

## Arrêter un tour

Route d'arrêt **explicite et distincte** (Decision point 6) : elle enregistre une **demande d'annulation** sur la génération en cours, sous condition d'identité de génération (une demande pour une génération périmée est refusée), et rend la main. C'est le worker qui l'observe, coupe sa consommation du flux fournisseur et scelle le partiel en état interrompu. Fermer le flux côté mobile n'est pas un arrêt.

## Où

`media_summarizer/api/endpoints/chat.py`, `media_summarizer/core/services/chat_service.py`, le module de prompt partagé, `quota_enforcer.py` si besoin d'un point d'entrée, `pricing_config_service.py`. Contrat dans `docs/CANONICAL_MEDIA_API_CONTRACT.md` (routes, refus, idempotence). Codes de refus nouveaux listés dans le contrat pour que la tâche mobile les traduise.

## Règles

Rien n'est déployé : pas de compatibilité. Pas de tests automatisés ni d'appel in-process. Pas de route sous `/api/v1/`.

## Note à l'owner

Après merge et déploiement : envoyer un tour par l'API dev, vérifier dans la table chat l'item de tour, de tentative et d'intention, et dans `user_usage_monthly-dev` un seul débit ; renvoyer la même requête et vérifier qu'aucun second débit n'apparaît. Le lancement réel n'aura lieu qu'avec le relais et le worker.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La route d'envoi refuse avec un code typé une question au-delà du plafond de caractères, un tour au-delà du plafond de tours, un second tour en vol sur le compte et un dépassement du budget de contexte, ces plafonds étant des constantes nommées
- [ ] #2 Le budget de contexte compte les tokens d'entrée du tour (corpus, instructions, historique complet, question) sans y imputer le plafond de sortie, garde le tour sous la marche de prix de 272 000 tokens avec la marge d'erreur de l'estimateur, et sa règle est documentée dans le code ; aucune troncature, aucun résumé d'historique, aucune récupération de passages n'est introduite
- [ ] #3 Le quota d'un tour vaut minutes_for_folder_sources(source_count) sans exemption média unique, est vérifié avant écriture avec les refus existants, et est débité sous un token d'idempotence du tour logique ; burst_guards.generations_per_day vaut 120
- [ ] #4 Le tour accepté, son message, sa première tentative et son intention d'envoi sont écrits dans une seule transaction DynamoDB, et la route n'envoie rien vers SQS
- [ ] #5 Un module partagé construit les messages du tour, corpus en préfixe stable puis instructions avec les fragments partagés de corpus.py puis historique avec rôles puis question, et calcule le budget avec la même règle que celle qu'utilisera le worker
- [ ] #6 La route d'arrêt enregistre une demande d'annulation conditionnée par l'identité de la génération en cours et refuse une génération périmée
- [ ] #7 docs/CANONICAL_MEDIA_API_CONTRACT.md décrit l'envoi, l'arrêt, l'idempotence, les refus nouveaux et le comportement du débit en cas d'échec, remboursement compris ; ruff check et mypy passent
- [ ] #8 quota_enforcer.py expose une opération de remboursement d'un tour de chat qui recrédite une seule fois, sous un token d'idempotence propre, les minutes et le coût d'un débit appliqué sur la période où il a été fait ; le tour enregistre la clé de période et les minutes débitées ; le commentaire « Minutes are never refunded » est mis à jour
<!-- AC:END -->
