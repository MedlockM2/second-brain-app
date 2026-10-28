---
id: TASK-561
title: >-
  Supprimer l'API podcasts héritée (recherche, submit-episode, /podcasts/submit)
  et le mécanisme watchers, et faire passer le test E2E par /api/media/ingest
status: To Do
assignee: []
created_date: '2026-10-28 15:06'
updated_date: '2026-10-28 16:29'
labels:
  - cleanup
  - backend
dependencies:
  - TASK-549
priority: low
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Deepn n'a pas de recherche de podcasts : un podcast entre par un lien partagé ou collé (`POST /api/media/ingest`). Pourtant l'API garde une surface héritée d'août 2025, qu'aucun client n'appelle (vérifié le 2026-10-28 dans mobile, web, packages/core et extension) :
- `/api/podcast-search/*` (`api/endpoints/podcast_search.py` : search, episodes, submit-episode, trending) ;
- dans `api/endpoints/podcasts.py` : `GET /api/podcasts/search` et `POST /api/podcasts/submit`. Cette dernière route est appelée par le seul test E2E `tests/e2e/test_phase4_other_sources.py` ; elle crée un traitement sans entrée de bibliothèque, donc ne reflète plus le parcours réel.

Derrière ces routes : `core/services/episode_submission.py`, `core/services/media_submission.py` et le mécanisme « watchers », utilisé seulement par `media_submission` : `utils/media_watchers.py`, table `media_watchers-<env>` dans `dynamodb_core_tables.tf`, fan-out dans `workers/events/media_completed_worker.py`, effacement dans `account_deletion_service`. Ce sont autant de chemins fournisseurs à maintenir sous le contrôle budgétaire (TASK-549) pour rien.

## Périmètre

- Faire passer le test E2E podcast par `POST /api/media/ingest`, avec la même URL d'épisode Apple Podcasts, et lire le statut par `/api/media/{id}`.
- Supprimer les routes ci-dessus, leurs modèles et helpers, leur enregistrement dans `api/main.py`, `episode_submission`, `media_submission`, le mécanisme watchers (module, table Terraform, fan-out, effacement de compte) et les variables d'environnement devenues inutiles (`.env.example`, `runtime_env.tf`). L'adaptateur PodcastIndex reste s'il sert encore au worker de résolution.
- Mettre à jour la doc : contrat canonique, OpenAPI, INGESTION_WORKERS_PROVIDERS, BETA_BUDGET_CONTROL §7.1, DATA_RETENTION s'il cite la table.
- Rien n'est déployé : pas d'alias, pas de période de transition.

## Note owner

Après l'apply, la table `media_watchers-dev` doit être supprimée à la main si sa protection contre la suppression bloque Terraform. Le passage du test E2E se constate au prochain run E2E de l'owner contre dev. Ni l'un ni l'autre n'est un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les routes /api/podcast-search/*, GET /api/podcasts/search et POST /api/podcasts/submit sont supprimées avec le code qui ne sert qu'à elles (episode_submission, media_submission, modèles, helpers, enregistrement des routeurs)
- [ ] #2 Le mécanisme watchers est supprimé : utils/media_watchers.py, la table media_watchers dans Terraform, le fan-out du worker de complétion et l'effacement de compte ; terraform validate passe
- [ ] #3 tests/e2e/test_phase4_other_sources.py soumet l'épisode par POST /api/media/ingest et suit le statut par /api/media/{id}
- [ ] #4 Aucune mention de ces routes ni des watchers ne subsiste dans le code, les tests, la configuration et la doc (grep vide hors backlog et docs/research) ; ruff et mypy passent
<!-- AC:END -->
