---
id: TASK-613
title: >-
  Faire passer tous les appels LLM par la Responses API d'OpenAI et supprimer le
  chemin Chat Completions
status: Done
assignee: []
created_date: '2026-11-06 18:30'
updated_date: '2026-11-06 18:39'
labels:
  - backend
  - chat
  - artifacts
  - refactor
dependencies: []
references:
  - media_summarizer/core/services/llm_client.py
  - media_summarizer/core/services/llm_config.py
  - media_summarizer/core/services/transcript_translation.py
  - media_summarizer/core/services/budget_guard.py
  - media_summarizer/core/services/budget_capacity.py
  - media_summarizer/workers/chat_worker.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/utils/llm_failure.py
priority: medium
type: task
ordinal: 220000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

## Pourquoi (décision de l'owner, 2026-11-06)

Le chat doit pouvoir chercher sur le web (tâche suivante, qui dépend de celle-ci). Sur Chat Completions, `gpt-6-luna` n'accepte des outils qu'à `reasoning_effort: none` (`llm_config.py`). L'outil `web_search` hébergé par OpenAI n'existe que dans la Responses API. L'owner a décidé de **tout** basculer, artefacts compris, pour n'avoir qu'un seul chemin vers le fournisseur. Pas de benchmark : décision prise.

Rien n'est déployé : on supprime le chemin Chat Completions dans la même tâche. Pas de repli, pas de double chemin, pas de variable pour choisir l'API.

## Ce qui change

- **`llm_client.complete` et `llm_client.stream`** appellent `POST /v1/responses`. Mêmes signatures pour leurs appelants, même distinction entre un échec avant le premier texte et un échec après.
  - Les messages deviennent `input`. Le message système passe en `instructions` ou en item `developer`, au choix de l'implémenteur, à condition que le corpus reste un préfixe stable pour le cache.
  - `response_format` devient `text.format`.
  - Le flux lit les événements typés (`response.output_text.delta`, `response.completed`, `response.incomplete`, `response.failed`, `error`).
- **`llm_config.chat_completion_parameters()`** est renommée et produit `reasoning: {effort}` et `max_output_tokens`. La docstring du module est mise à jour : l'exigence « Structured Outputs et `reasoning_effort` sur Chat Completions » devient la même exigence sur la Responses API.
- **`store: false`** sur chaque appel. L'historique reste reconstruit depuis DynamoDB par `chat_prompt.build_messages`. Ne pas utiliser `previous_response_id`.
- **La fin de réponse.** `finish_reason == "length"` n'existe plus. `LlmResult` doit exposer l'équivalent (`status: "incomplete"` + `incomplete_details.reason: "max_output_tokens"`), pour que le chat scelle toujours `output_limit` et que les artefacts traitent la troncature comme avant.
- **L'usage.** `read_usage` lit `input_tokens`, `input_tokens_details.cached_tokens` et `output_tokens` (raisonnement inclus). `estimate_usage` reste le repli d'un flux coupé.
- **Les erreurs.** Vérifier que `classify_llm_failure` lit les corps d'erreur HTTP et les événements d'erreur du flux de la Responses API, et adapter si besoin.
- **`transcript_translation.py`** envoie sa propre requête : elle passe elle aussi sur `/v1/responses`, sans plafond de sortie, comme aujourd'hui.
- **Le budget** (`budget_guard.request_input_tokens`, `budget_capacity`) compte la requête telle qu'elle part désormais.
- `LLM_API_URL` pointe par défaut sur `https://api.openai.com/v1/responses`. Il n'existe plus aucune URL `chat/completions` dans le dépôt.

Lire la doc actuelle de la Responses API (référence et guide du streaming) et dater la lecture dans les docstrings, comme le fait `llm_config.py` pour la page du modèle.

Note pour l'owner : la vérification réelle passe par tes E2E manuels après le push, avec une question dans le chat, un artefact de chaque type, une traduction intégrale, et un quiz ou des flashcards pour Structured Outputs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `grep -rn "chat/completions" media_summarizer scripts infrastructure` ne renvoie rien
- [x] #2 `llm_client.complete`, `llm_client.stream` et `transcript_translation` envoient leurs requêtes à `/v1/responses` avec `store: false`, les paramètres de `llm_config` et, pour les artefacts qui en ont un, leur schéma JSON dans `text.format`
- [x] #3 Le chat scelle toujours un tour coupé par le plafond de sortie en `output_limit` : le chemin de la réponse `incomplete` / `max_output_tokens` jusqu'à `chat_worker` existe et est branché
- [x] #4 `read_usage` lit le bloc d'usage de la Responses API ; une réponse en flux arrêtée par l'utilisateur ou coupée retombe toujours sur `estimate_usage`
- [x] #5 Les docstrings de `llm_client.py` et `llm_config.py` décrivent la Responses API, avec la date de lecture de sa doc ; plus aucune mention de Chat Completions comme chemin actuel
- [x] #6 `ruff` et `mypy` sont propres sur les fichiers modifiés
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Doc lue le 2026-11-06 : référence `POST /responses` et événements de flux (developers.openai.com, versions .md), datée dans les docstrings de `llm_client.py` et `llm_config.py`.

Ce qui a été fait :
- `llm_config.chat_completion_parameters()` → `response_parameters(*, max_output_tokens=LLM_MAX_OUTPUT_TOKENS)` : `model`, `reasoning: {effort}`, `store: false`, `max_output_tokens` (omis si `None`, cas de la traduction). La variable `LLM_MAX_COMPLETION_TOKENS` est renommée `LLM_MAX_OUTPUT_TOKENS` partout (code, `.env.example`, docs). Elle n'est posée nulle part dans Terraform, donc rien à changer côté infra.
- `llm_client` : `LLM_API_URL` vaut par défaut `https://api.openai.com/v1/responses`. Nouvelles fonctions publiques `request_payload` (messages passés tels quels dans `input`, donc le corpus reste un préfixe stable ; `text.format` ; `prompt_cache_key` ; jamais `previous_response_id`) et `read_response` (texte lu dans les parties `output_text` des items `message`, usage, statut). `LlmResult` remplace `finish_reason` par `status` + `incomplete_reason`, avec la propriété `output_limit_reached`. Le flux lit les événements typés : `response.output_text.delta`, `response.completed` / `response.incomplete` (fin, usage, modèle), `response.failed` / `error` (classés). Plus de sentinelle `[DONE]`. Une réponse non streamée en `status: failed` est classée de la même manière.
- `read_usage` lit `input_tokens`, `input_tokens_details.cached_tokens` / `cache_write_tokens`, `output_tokens`. Un flux arrêté ou coupé n'a pas d'événement terminal, donc il retombe sur `estimate_usage`.
- `chat_worker` scelle `output_limit` sur `result.output_limit_reached` ; docstrings de `chat_worker` et `ChatInterruptionCause` mises à jour.
- Générateurs : `response_format_schema()` → `text_format()`, au format aplati de la Responses API (`{type: json_schema, name, strict, schema}`) pour le quiz et les flashcards. Le worker d'artefacts et `budget_capacity` passent `text_format=`. Comme avant, une troncature des artefacts échoue à la validation.
- Budget : `request_input_tokens(messages, text_format)` compte les mêmes octets que la requête envoyée (messages → items `input` sans transformation, plus le `text.format`).
- `transcript_translation` construit sa requête avec `request_payload(messages, max_output_tokens=None)` et lit la réponse avec `read_response`, sans plafond de sortie. Elle garde sa propre classification HTTP et classe aussi un `status: failed`.
- `llm_failure` : `invalid_prompt` est ajouté aux erreurs permanentes ; un `rate_limit_exceeded` reçu dans un flux (sans statut HTTP) est maintenant lu comme refus `rate_limit` transitoire. Les erreurs de flux non refusées lèvent `LlmResponseFailedError` avec leur `failure_kind`, ce qui évite qu'un échec permanent soit retenté par le chat.
- Docs mises à jour : `INGESTION_WORKERS_PROVIDERS.md` (nouveau paragraphe sur l'endpoint), `CHAT_DATA_MODEL.md`, `CANONICAL_MEDIA_API_CONTRACT.md`, `BETA_BUDGET_CONTROL.md`, `.env.example`.

Vérifications : `grep -rn "chat/completions" media_summarizer scripts infrastructure` ne renvoie rien ; ruff et mypy propres sur les 17 fichiers Python modifiés ; `scripts/check_env_example_complete.py` OK. Aucun test ajouté.

Hors de portée (note pour l'owner) : la vérification réelle passe par les E2E manuels après le push. À vérifier : une question dans le chat, un artefact de chaque type, une traduction intégrale, et un quiz ou des flashcards pour Structured Outputs.
<!-- SECTION:NOTES:END -->
