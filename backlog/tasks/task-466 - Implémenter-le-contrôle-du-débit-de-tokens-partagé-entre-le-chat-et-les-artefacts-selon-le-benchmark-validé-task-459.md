---
id: TASK-466
title: >-
  Implémenter le contrôle du débit de tokens partagé entre le chat et les
  artefacts selon le benchmark validé (task-459)
status: To Do
assignee: []
created_date: '2026-10-10 18:00'
updated_date: '2026-10-10 18:01'
labels:
  - backend
  - llm
  - chat
  - feature
dependencies:
  - TASK-459
  - TASK-460
  - TASK-463
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - media_summarizer/utils/llm_failure.py
  - media_summarizer/core/services/llm_config.py
priority: medium
type: feature
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat est décidée par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10. Son point 8 impose de contrôler la consommation de tokens par fenêtre de temps à l'échelle de **tous** les appels au fournisseur LLM, chat et artefacts confondus, parce que des files séparées et un plafond de concurrence ne suffisent pas à respecter les limites de débit en tokens. Le mécanisme est tranché par le benchmark task-459.

**Lire `docs/research/task-459-*/README.md`, section Owner Validation, champ `Decision`** : c'est la décision finale de l'owner, qui peut différer de la recommandation du benchmark. Si le `Decision` renvoie à des fichiers `complement-response-*.md` du même répertoire, les suivre aussi. Le périmètre de cette tâche est ce `Decision`.

## Ce qui existe quand cette tâche démarre

- La couche LLM commune (task-460), seul chemin d'appel au fournisseur pour les artefacts, les aperçus, la retraduction et le chat : c'est l'endroit naturel où brancher un contrôle qui doit voir tous les appels.
- Le worker de chat dédié (task-463) et le worker d'artefacts, chacun sur sa file.
- La taxonomie des refus du fournisseur, `media_summarizer/utils/llm_failure.py` (429 avec ou sans `Retry-After`).
- Le modèle unique `gpt-6-luna` (task-439, `llm_config.py`).

## Règles

Rien n'est déployé : pas de compatibilité, pas de second chemin d'appel qui contournerait le contrôle. Pas de tests automatisés. Documenter le mécanisme, sa source de limite et son comportement au dépassement dans `docs/INGESTION_WORKERS_PROVIDERS.md`.

## Note à l'owner

Après merge et déploiement, lancer en `-dev` une génération de dossier et un tour de chat en même temps et vérifier dans les journaux que le contrôle s'est appliqué comme décrit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le mécanisme retenu par le Decision de docs/research/task-459-llm-token-rate-control/README.md s'applique à tous les appels LLM passant par la couche commune, chat et artefacts compris, sans chemin d'appel qui le contourne
- [ ] #2 Le comportement au dépassement de chaque type d'appel et la priorité entre chat et générations de fond sont ceux du Decision
- [ ] #3 Les ressources que le mécanisme exige, s'il en exige, sont déclarées en Terraform, et terraform validate passe
- [ ] #4 docs/INGESTION_WORKERS_PROVIDERS.md décrit le mécanisme, la source de la limite et le comportement au dépassement ; ruff check et mypy passent sur les fichiers Python modifiés
<!-- AC:END -->
