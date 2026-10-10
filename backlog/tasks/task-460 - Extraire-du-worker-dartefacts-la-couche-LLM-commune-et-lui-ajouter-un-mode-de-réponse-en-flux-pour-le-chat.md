---
id: TASK-460
title: >-
  Extraire du worker d'artefacts la couche LLM commune et lui ajouter un mode de
  réponse en flux pour le chat
status: To Do
assignee: []
created_date: '2026-10-10 17:57'
labels:
  - backend
  - llm
  - chat
  - feature
dependencies:
  - TASK-439
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - >-
    docs/research/task-430-chatbot-architecture/complement-response-2026-10-07.md
  - media_summarizer/core/services/llm_config.py
  - media_summarizer/core/services/llm_pricing.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/workers/artifact_generator/generators/corpus.py
  - media_summarizer/utils/llm_failure.py
  - docs/INGESTION_WORKERS_PROVIDERS.md
priority: medium
type: feature
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat est décidée par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10 — **source de vérité**, qui prime sur la Recommendation (architecture B, « un troisième mode du worker d'artefacts ») et sur le complément. Son point 2 tranche à l'opposé de B : un worker de chat **dédié**, et « Extraire les fonctions communes nécessaires — accès LLM, résolution du corpus, taxonomie d'erreurs, mesure de l'usage et du coût — **plutôt qu'ajouter un mode chat au worker d'artefacts** ».

Cette tâche est cette extraction, et elle passe **avant** le worker de chat qui consommera la couche extraite (restructuration d'abord). Elle s'appuie sur task-439 (Done), qui a posé `media_summarizer/core/services/llm_config.py` — `LLM_MODEL` (`gpt-6-luna`), `LLM_REASONING_EFFORT`, `chat_completion_parameters()` — et la tarification Luna dans `llm_pricing.py`. `docs/INGESTION_WORKERS_PROVIDERS.md`, paragraphe « For the chat tasks (task-431) », dit l'intégration attendue : chaque appel LLM du chat construit sa requête depuis `llm_config.chat_completion_parameters()` et enregistre son usage par `llm_pricing.estimate_llm_cost_eur`.

## Ce qu'il faut extraire de `media_summarizer/workers/artifact_generator/worker.py`

Aujourd'hui `_call_llm`, `_read_llm_usage`, `_download_transcripts`, l'enregistrement du coût et la classification des échecs (`media_summarizer/utils/llm_failure.py`) vivent dans le worker d'artefacts ou y sont câblés. Les déplacer dans un module partagé (par exemple `media_summarizer/core/services/llm_client.py` et un module de corpus partagé) que le worker d'artefacts importe, **sans changer le comportement des artefacts** : même requête, mêmes sorties structurées, même `prompt_cache_key`, même taxonomie d'erreurs, même enregistrement du coût. Supprimer les copies d'origine au lieu de les laisser à côté (rien n'est déployé : pas de double chemin).

La résolution du corpus (téléchargement des transcripts depuis les clés S3 d'une liste de sources, construction du préfixe corpus-d'abord de `generators/corpus.py`, y compris ses fragments d'instruction partagés `transcript_markers_instruction`, `dated_facts_instruction`, `subject_matter_instruction`, `source_ref_instruction`) doit être appelable par un autre worker. **La mise en page corpus-d'abord est protégée** (task-269 §2.6, task-316, commentaire en tête de `corpus.py`) : elle rend le corpus préfixe stable donc cachable ; le chat placera instructions, historique et question après.

## Ce qu'il faut ajouter

1. **Un appel à plusieurs messages** : le chat envoie un historique avec les rôles (`system`/`developer`, `user`, `assistant`), là où `_call_llm` n'envoie qu'un message `user` (README §2.4).
2. **Un mode flux**, pris uniquement quand l'appelant le demande — le mode bufferisé reste celui des artefacts. Le complément C1.10 en décrit la mécanique : `stream: true`, `stream_options: {"include_usage": true}`, lecture ligne à ligne du SSE du fournisseur, un rappel par delta de texte, l'`usage` lu sur le chunk qui précède `data: [DONE]`. Il doit permettre à l'appelant d'**interrompre la consommation du flux** (Decision point 6 : un arrêt volontaire « interrompt sa consommation du flux fournisseur ») et distinguer une erreur survenue **avant** le premier texte d'une erreur survenue après (Decision point 2 : seules les erreurs transitoires avant émission de texte peuvent être retentées).
3. **Le repli d'usage** du complément C1.11 point 2 : quand un flux interrompu ne livre pas l'`usage`, estimer les tokens d'entrée par `estimate_tokens` et ceux de sortie par la longueur produite, et marquer l'usage comme estimé, pour que le coût observé ne s'écrive pas en zéros.
4. **La raison de fin rendue à l'appelant** : la couche renvoie le `finish_reason` du fournisseur (dernier chunk en flux, `choices[0]` en bufferisé), pour que le chat reconnaisse une réponse coupée par le plafond de sortie (`length`). Le comportement des artefacts n'en change pas.

Le modèle, l'effort de raisonnement, le plafond de sortie et la tarification restent ceux de task-439 : tout passe par `llm_config.chat_completion_parameters()`, sans sélection de modèle ni plafond de sortie propres au chat. Décision de l'owner du 2026-10-10 : le chat garde `LLM_MAX_COMPLETION_TOKENS` (32 000 depuis le 2026-10-10, partagé avec les artefacts). Sur Luna ce plafond compte aussi les tokens de raisonnement, donc un plafond bas couperait le raisonnement avant la réponse ; le plafond est un garde-fou de coût (au pire environ 0,016 $ par tour au tarif de sortie de 0,50 $/1M), et la longueur d'une réponse se règle dans le prompt. Le commentaire de `llm_config.py` refuse déjà un réglage par type.

## Règles

Rien n'est déployé : pas de couche de compatibilité, supprimer l'ancien emplacement. Pas de tests automatisés. Mettre à jour `docs/INGESTION_WORKERS_PROVIDERS.md` (où vit la couche LLM, comment le chat l'appelle en flux).

## Note à l'owner

Après merge et déploiement, générer un artefact de chaque type et une retraduction sur l'API dev et vérifier que modèle, usage et coût enregistrés sont inchangés par rapport à avant l'extraction. Ce n'est pas un critère de l'agent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L'appel LLM, la lecture d'usage, l'enregistrement du coût, la classification des échecs et la résolution du corpus vivent dans des modules partagés importés par le worker d'artefacts, et leurs anciennes définitions dans worker.py sont supprimées
- [ ] #2 Le worker d'artefacts envoie la même requête qu'avant l'extraction pour chaque type et pour la retraduction : paramètres de llm_config.chat_completion_parameters(), sorties structurées, prompt_cache_key et mise en page corpus-d'abord inchangés
- [ ] #3 La couche partagée accepte un tableau de messages avec leurs rôles, prend modèle, raisonnement et plafond de sortie de llm_config.chat_completion_parameters() sans paramètre de plafond propre à l'appelant, et renvoie le finish_reason du fournisseur en flux comme en bufferisé
- [ ] #4 Un mode flux optionnel lit le SSE du fournisseur, transmet chaque delta à un rappel, permet à l'appelant d'interrompre la consommation, distingue une erreur avant le premier texte d'une erreur après, et lit l'usage du dernier chunk ; le mode bufferisé reste le défaut
- [ ] #5 Quand un flux ne livre pas son usage, l'usage enregistré est estimé et marqué comme tel au lieu d'être zéro
- [ ] #6 docs/INGESTION_WORKERS_PROVIDERS.md décrit l'emplacement de la couche LLM commune et son mode flux pour le chat
- [ ] #7 ruff check et mypy passent sur les fichiers Python modifiés ou créés
<!-- AC:END -->
