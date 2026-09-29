---
id: TASK-416
title: >-
  Combler la dérive .env.example (6 variables non déclarées, guard CI rouge sur
  main)
status: Done
assignee: []
created_date: '2026-09-29 09:55'
updated_date: '2026-09-29 10:01'
labels:
  - backend
  - cleanup
  - tooling
dependencies: []
references:
  - scripts/check_env_example_complete.py
  - .env.example
  - 'https://github.com/MedlockM2/second-brain-app/actions/runs/36549120490'
priority: medium
type: chore
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le guard `scripts/check_env_example_complete.py` échoue sur `main` depuis le run 36549120490 (job "Backend (lint + typecheck)", étape "Guard — every env var used by the app is in .env.example"), sans rapport avec les changements Sentry poussés dans ce commit. Six variables sont lues par le code mais absentes de `.env.example` :

- `ARTICLE_FETCH_TIMEOUT_SECONDS` — `media_summarizer/infrastructure/resolvers/trafilatura_article_resolver.py:52`
- `ARTIFACT_INTERNAL_STALL_SECONDS` — `media_summarizer/core/services/artifact_service.py:155`
- `INSTAGRAM_IMAGE_FETCH_TIMEOUT_SECONDS` — `media_summarizer/workers/instagram_ingestion_worker.py:131`
- `INSTAGRAM_IMAGE_MAX_BYTES` — `media_summarizer/workers/instagram_ingestion_worker.py:136`
- `INSTAGRAM_IMAGE_PARSE_BUDGET_SECONDS` — `media_summarizer/workers/instagram_ingestion_worker.py:128`
- `INSTAGRAM_IMAGE_PARSE_MAX_IMAGES` — `media_summarizer/workers/instagram_ingestion_worker.py:125`
- `MEDIA_IDEMPOTENCE_RECONCILE_APPLY` — `media_summarizer/scripts/reconcile_media_idempotence.py:45`

Les six sont lues via `os.environ.get("X", "<default>")` avec une valeur par défaut fonctionnelle — ce sont des overrides optionnels, pas des secrets ni du config requis au démarrage. `.env.example` documente déjà ce type de variable en ligne commentée (voir par exemple `# COVER_FETCH_TIMEOUT_SECONDS=10` ligne 483, `# ARTIFACT_AWAITING_TIMEOUT_SECONDS=3600` ligne 493) : suivre exactement cette convention plutôt que de les ajouter en actif.

**Ne pas se contenter d'un ajout mécanique** : pour chacune des six, vérifier d'abord par `git blame`/`git log -S` quel commit/tâche l'a introduite et pourquoi le guard ne l'a pas bloqué à ce moment-là (PR mergée avant que ce guard existe ? guard contourné ? variable ajoutée dans une passe qui a oublié cette étape ?) — si l'investigation révèle qu'une variable a été laissée par erreur et n'est plus utile (code mort, expérimentation abandonnée), la bonne réponse est de supprimer la lecture de la variable dans le code plutôt que de la documenter. Ce n'est qu'après cette vérification, variable par variable, que les entrées légitimes sont ajoutées à `.env.example`.

Documentation utile : le docstring de `scripts/check_env_example_complete.py` explique la convention (ligne commentée = override optionnel documenté) et pourquoi ce guard existe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pour chacune des 6 variables, une conclusion tracée (dans la description finale de la tâche) : conservée + documentée dans .env.example, ou lecture supprimée du code parce que morte/inutile — avec la justification tirée de git blame/git log -S
- [x] #2 python scripts/check_env_example_complete.py termine en exit 0 sur le worktree de la tâche
- [x] #3 Chaque variable conservée apparaît dans .env.example sous la forme d'une ligne commentée dans la section pertinente, au format déjà utilisé par les entrées voisines (ex. # COVER_FETCH_TIMEOUT_SECONDS=10)
- [x] #4 ruff et mypy restent propres sur media_summarizer/ après tout retrait de code mort éventuel
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Conclusions par variable (7, pas 6 : le titre sous-compte). Toutes CONSERVÉES : code actif, lu via os.environ.get avec défaut fonctionnel. Toutes introduites le 2026-09-10, après le branchement du guard en CI (2026-08-13) : elles sont passées parce que main n'était pas protégée à ce moment-là.
- ARTICLE_FETCH_TIMEOUT_SECONDS : ad2795d8 (task-392), timeout de fetch d'article sous la limite gateway de 30 s. Ajoutée dans la section 8 SOURCES/Article.
- ARTIFACT_INTERNAL_STALL_SECONDS : 44ca2a5 (task-390), délai avant qu'un artefact 'generating' passe en stalled. Ajoutée dans la section 15 WORKER TUNING.
- INSTAGRAM_IMAGE_PARSE_MAX_IMAGES / _PARSE_BUDGET_SECONDS / _FETCH_TIMEOUT_SECONDS / _MAX_BYTES : bff7920d (task-384), bornes du parsing d'images Instagram. Ajoutées dans la section 8 SOURCES/Instagram.
- MEDIA_IDEMPOTENCE_RECONCILE_APPLY : e644c6e (task-390), flag d'écriture du script de réconciliation (dry-run par défaut). Ajoutée dans la section 5 DATABASE.
Guard check_env_example_complete.py : exit 0 (247 variables). ruff et mypy propres. Commit 4abfb60, merge 421dc75.
<!-- SECTION:NOTES:END -->
