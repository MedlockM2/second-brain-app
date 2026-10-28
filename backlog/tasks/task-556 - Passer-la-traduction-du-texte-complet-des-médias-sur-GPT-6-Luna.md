---
id: TASK-556
title: Passer la traduction du texte complet des médias sur GPT-6 Luna
status: To Do
assignee: []
created_date: '2026-10-27 16:21'
labels:
  - backend
  - llm
  - translation
dependencies: []
references:
  - media_summarizer/core/services/transcript_translation.py
  - media_summarizer/core/services/llm_config.py
  - media_summarizer/core/services/llm_pricing.py
  - docs/research/task-72-llm-artifact-benchmark/README.md
  - docs/research/task-547-beta-budget-control/README.md
priority: high
type: enhancement
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

La décision owner du 2026-10-10 (docs/research/task-72-llm-artifact-benchmark/README.md, Owner Validation) a unifié sur `gpt-6-luna` en mode Standard les artefacts, les aperçus `review_blurb` et la retraduction des artefacts. La traduction du texte complet d'un média (transcription ou document, pour la lecture) est restée hors de cette bascule : `core/services/transcript_translation.py` appelle toujours `gpt-5-nano-2025-08-07` (décision task-189), avec ses propres constantes de prix. Le 2026-10-27, l'owner a décidé d'étendre Luna à cette traduction aussi. C'est un choix de modèle déjà validé ailleurs : aucun benchmark n'est requis.

## Périmètre

- Faire utiliser à la traduction le modèle commun de `core/services/llm_config.py` (`LLM_MODEL`) au lieu de `TRANSLATION_LLM_MODEL`, dans les mêmes conditions (mode Standard). Supprimer `TRANSLATION_LLM_MODEL`, le défaut GPT-5-nano et les constantes de prix locales `_INPUT_USD_PER_1M` / `_OUTPUT_USD_PER_1M` : le coût passe par `core/services/llm_pricing.py`, comme le reste des appels Luna (tarifs court/long contexte et cache). Rien n'est déployé : pas de repli sur nano, pas de période de transition.
- Vérifier sur la page du modèle (https://developers.openai.com/api/docs/models/gpt-6-luna) que les paramètres envoyés par la traduction sont acceptés par Luna (`reasoning_effort` éventuel, absence de paramètres refusés) et que la fenêtre de contexte couvre la plus longue entrée acceptée ; le commentaire « 400k-token window » de `_call_translation_llm` doit dire la vérité pour Luna.
- Mettre à jour les docstrings et commentaires qui nomment GPT-5-nano / task-189 comme modèle de traduction (`transcript_translation.py`, `llm_config.py` section « What is not governed here »), et noter l'extension dans l'Owner Validation de task-72 comme fait daté, sans réécrire sa décision.
- Ne pas toucher au plafond de sortie ni à la réservation budgétaire de la traduction : ils relèvent de TASK-548/TASK-549 (décision docs/research/task-547-beta-budget-control/README.md), qui réserveront au prix du modèle configuré.

## Note owner

Le passage effectif en dev se constate après le déploiement sur `main` (traduction d'un média étranger, modèle `gpt-6-luna` dans les journaux du worker de traduction) : vérification owner, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La traduction du texte complet appelle le modèle commun `llm_config.LLM_MODEL` ; `TRANSLATION_LLM_MODEL`, le défaut `gpt-5-nano-2025-08-07` et les constantes de prix locales de `transcript_translation.py` n'existent plus dans le code ni dans l'infrastructure.
- [x] #2 Le coût d'une traduction est calculé par `llm_pricing` au tarif Luna applicable, sans double source de prix.
- [x] #3 Les paramètres envoyés par la traduction et l'hypothèse de fenêtre de contexte sont conformes à la documentation Luna, citée avec sa date de consultation dans le code ou la note de tâche.
- [x] #4 Docstrings, commentaires et Owner Validation de task-72 reflètent l'extension de Luna à la traduction du texte complet.
- [x] #5 Ruff et mypy passent sur les fichiers backend modifiés ; terraform validate passe si l'infrastructure est modifiée.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**AC #1, modèle.** `core/services/transcript_translation.py` construit sa requête depuis `llm_config` : `model` = `LLM_MODEL`, `reasoning_effort` = `LLM_REASONING_EFFORT` (même effort explicite que les autres appels Luna, pas de réglage propre à la traduction, conformément à la règle « one variable, not one per type » de `llm_config`). Supprimés : `TRANSLATION_MODEL` / `TRANSLATION_LLM_MODEL` et son défaut `gpt-5-nano-2025-08-07`, `_CHARS_PER_TOKEN`, `_INPUT_USD_PER_1M`, `_OUTPUT_USD_PER_1M`, `_estimate_cost_usd`, la ligne `TRANSLATION_LLM_MODEL` de `.env.example`. Aucun repli sur nano. Infrastructure : aucune occurrence dans `infrastructure/terraform/` ; vérifié le 2026-10-28 sur dev que la Lambda `media-summarizer-worker-transcript_translation-dev` ne porte pas de variable `TRANSLATION_LLM_MODEL` (`aws lambda get-function-configuration --query`), et que le secret `media-summarizer-runtime-dev` ne contient pas cette clé (noms de clés seulement, aucune valeur lue ni recopiée). Prod non lu depuis le worktree (compte dormant). Le barème bêta par défaut (`provider_tariffs.openai` dans `pricing_config_service.py`) perd sa ligne `gpt-5-nano`, que plus aucun appel n'utilise. Je n'ai pas changé `version`, et c'est voulu : aucun chemin n'appelle encore `beta_budget.reserve` (TASK-549 non livrée, vérifié par grep), donc aucune réservation n'a jamais été bornée avec la version `2026-10-28`. `pricing_config-dev` ne contient pas de ligne `provider_tariffs` (scan des `config_key` le 2026-10-28 : `beta_access`, `revenue_model`, `infra_cost_baseline`). Plafond de sortie et réservation de la traduction non touchés (TASK-549). Seuls deux commentaires de `beta_budget.py` qui citaient nano en exemple ont été réécrits.

**AC #2, coût.** `_call_translation_llm` renvoie un `ArtifactLlmUsage` produit par `llm_client.read_usage`, c'est-à-dire `llm_pricing.estimate_llm_cost_eur`, sous le modèle que le fournisseur dit avoir répondu (`result["model"]`, sinon `LLM_MODEL`). Le calcul couvre les tarifs court et long contexte et les tokens lus ou écrits en cache (`prompt_tokens_details`). Si le bloc `usage` manque, `llm_client.estimate_usage` prend le relais (marqué `usage_estimated`) à la place de l'ancienne approximation de 4 caractères par token. Le journal `translation.completed` porte désormais `model`, `prompt_tokens`, `cached_tokens`, `cache_write_tokens`, `completion_tokens`, `usage_estimated` et `estimated_cost_eur`, à la place de `estimated_cost_usd` et `total_tokens` (aucun lecteur dans le code ni l'infra, seule la doc les citait et elle est mise à jour). Il n'existe plus de prix local. Le coût n'est que journalisé, pas imputé à un compte : la traduction est partagée entre les comptes, et le règlement relève de TASK-549.

**AC #3, documentation Luna**, consultée le 2026-10-28 (l'accès web fonctionnait) :
- https://developers.openai.com/api/docs/models/gpt-6-luna : « reasoning.effort supports none, low, medium (default), high, xhigh, and max » ; « 1,050,000 context window » ; « 128,000 max output tokens » ; endpoint Chat Completions `v1/chat/completions` affiché comme pris en charge (non grisé, contrairement à Speech generation) ; aucun `temperature` documenté ; tarifs 0,10 / 0,01 / 0,125 / 0,50 USD par 1M et « Prompts with more than 272K input tokens are priced at 2x input and cache rates and 1.5x output for the full request », identiques aux lignes de `llm_pricing.py`.
- Référence Chat Completions (https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) : message système, « With o1 models and newer, use developer messages for this purpose instead ». Les instructions de traduction passent donc en rôle `developer`, au lieu de `system`. `max_completion_tokens` inclut « visible output tokens and reasoning tokens ».
- Guide reasoning (https://developers.openai.com/api/docs/guides/reasoning) : la sortie peut s'arrêter « before any visible output tokens are produced » quand le plafond est atteint. La recommandation est de prévoir « at least 25,000 tokens for reasoning and outputs ».
- Payload envoyé : `model`, `reasoning_effort`, `messages` (developer + user). Pas de `temperature`, de `top_p` ni de `max_completion_tokens` : le plafond de la règle 11 de task-547 est ajouté par TASK-549, et le `LLM_MAX_COMPLETION_TOKENS` commun (32 000) n'est volontairement pas repris parce qu'il couperait toute traduction plus longue.
- Fenêtre : la page n'affiche plus d'entrée maximale ; 922 000 = 1 050 000 − 128 000, valeur relevée comme « entrée max » dans `docs/research/task-430-chatbot-architecture/complement-response-2026-10-07.md`. Les plus longues entrées bornées tiennent dans la fenêtre : 240 min d'audio, soit environ 48 000 tokens à 200 tokens/min (estimation task-547) ou environ 66 000 à 16 500 tokens/h (mesure pricing-challenge) ; 100 pages, environ 70 000 tokens à 700/page ; un article, au plus 2 Mo de HTML (`ARTICLE_EXTRACT_MAX_HTML_BYTES`), soit au plus environ 588 000 tokens à 3,4 octets/token. La limite qui joue en premier est la sortie de 128 000 tokens, raisonnement compris. Le commentaire « 400k-token window » est remplacé par ces faits dans la docstring de `_call_translation_llm`.

**AC #4, textes.** Mis à jour : docstrings de `transcript_translation.py` (étape 3, `_call_translation_llm`, prompt), `llm_config.py` (extension datée ; la section « What is not governed here » ne cite plus que la synthèse vocale ; la traduction lit `LLM_MODEL` et `LLM_REASONING_EFFORT` mais pas `LLM_MAX_COMPLETION_TOKENS`), `llm_pricing.py`, `llm_client.py` (la traduction est le seul appel qui envoie sa propre requête), le commentaire `providers.llm` et le barème de `pricing_config_service.py`, la docstring de `youtube_ingestion_worker.py`, `.env.example` et `docs/INGESTION_WORKERS_PROVIDERS.md` (étape Translate, observabilité, deux tables de variables, section modèle, référence task-189). Owner Validation de task-72 : ajout d'un paragraphe daté « Extension du 2026-10-27 (task-556) » sous `Validated at`. Le front-matter et le champ `Decision` sont inchangés. `docs/V1_LAUNCH_PLAN.md` n'a pas été touché, sur instruction (il ne cite d'ailleurs ni nano ni `TRANSLATION_LLM_MODEL`).

**AC #5.** `uv run ruff check .` : All checks passed. `uv run mypy media_summarizer` : Success, aucune erreur sur 210 fichiers. `scripts/check_env_example_complete.py` : OK. Aucun fichier d'infrastructure modifié, donc pas de `terraform validate` à faire. Aucun test automatisé ajouté.

**Hors périmètre, à valider par l'owner (déduit de mon analyse, pas formulé par une source)** :
- Interaction avec la règle 11 (TASK-549). `max_completion_tokens` compte les tokens de raisonnement. Sur dev, pricing-challenge mesurait pour les traductions nano un plancher d'environ 3 400 tokens de sortie par appel (`sortie ≈ 3 402 + 1,58 × entrée`, 17 traductions), attribué au raisonnement par défaut. Avec un plafond de 1,5 × l'entrée, un texte court (1 000 tokens donne un plafond de 1 500) pourrait revenir coupé, voire vide. Le comportement de Luna en `medium` n'est pas mesuré. Par ailleurs, au-delà d'environ 85 300 tokens d'entrée, 1,5 × l'entrée dépasse le maximum de 128 000 du modèle. Pour la parade, un plancher du plafond ou un effort de raisonnement propre à la traduction (que `llm_config` refuse en principe), il faut une décision de l'owner. `minimal`, proposé par pricing-challenge, n'est pas une valeur acceptée par Luna.
- Préexistant, inchangé : `finish_reason` n'est pas lu, donc une traduction coupée par la limite de sortie est enregistrée comme complète. Un fichier texte ou un tableur n'est borné que par la taille d'upload (50 Mo) et peut dépasser la fenêtre ; le fournisseur refuse alors l'appel (400, échec permanent, texte d'origine affiché).

**Note owner (description)** : le passage effectif se constate après déploiement sur `main`, par l'événement `translation.completed` avec `model` = `gpt-6-luna` dans les journaux du worker de traduction. Ce n'est pas un AC.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
La traduction du texte complet appelle désormais le modèle commun de `llm_config` (`gpt-6-luna`, mode Standard, `reasoning_effort` commun), avec les instructions en rôle `developer` comme le demande la documentation. Son coût est calculé par `llm_pricing` via `llm_client.read_usage` : tarifs court et long contexte, cache, modèle réellement renvoyé. Supprimés : `TRANSLATION_LLM_MODEL`, le défaut GPT-5-nano, les constantes de prix locales, et la ligne nano du barème bêta par défaut, que plus rien n'appelle. Les docstrings, `.env.example`, `docs/INGESTION_WORKERS_PROVIDERS.md` et l'Owner Validation de task-72 (paragraphe daté) décrivent l'extension. La documentation Luna a été consultée le 2026-10-28 : fenêtre de 1 050 000 tokens, sortie maximale de 128 000, la sortie est la vraie limite.

AC #1 à #5 atteints : ruff et mypy propres, garde `.env.example` OK, infrastructure non modifiée (vérifié aussi sur la Lambda et le secret dev). Plafond de sortie et réservation non touchés (TASK-549). Aucun test automatisé ajouté. Deux points déduits restent à valider par l'owner : la compatibilité entre le plafond 1,5 × entrée de TASK-549 et les tokens de raisonnement, et la troncature non détectée (`finish_reason`).
<!-- SECTION:FINAL_SUMMARY:END -->
