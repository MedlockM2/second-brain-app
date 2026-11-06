---
id: TASK-613
title: >-
  Faire passer tous les appels LLM par la Responses API d'OpenAI et supprimer le
  chemin Chat Completions
status: To Do
assignee: []
created_date: '2026-11-06 18:30'
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
- [ ] #1 `grep -rn "chat/completions" media_summarizer scripts infrastructure` ne renvoie rien
- [ ] #2 `llm_client.complete`, `llm_client.stream` et `transcript_translation` envoient leurs requêtes à `/v1/responses` avec `store: false`, les paramètres de `llm_config` et, pour les artefacts qui en ont un, leur schéma JSON dans `text.format`
- [ ] #3 Le chat scelle toujours un tour coupé par le plafond de sortie en `output_limit` : le chemin de la réponse `incomplete` / `max_output_tokens` jusqu'à `chat_worker` existe et est branché
- [ ] #4 `read_usage` lit le bloc d'usage de la Responses API ; une réponse en flux arrêtée par l'utilisateur ou coupée retombe toujours sur `estimate_usage`
- [ ] #5 Les docstrings de `llm_client.py` et `llm_config.py` décrivent la Responses API, avec la date de lecture de sa doc ; plus aucune mention de Chat Completions comme chemin actuel
- [ ] #6 `ruff` et `mypy` sont propres sur les fichiers modifiés
<!-- AC:END -->
