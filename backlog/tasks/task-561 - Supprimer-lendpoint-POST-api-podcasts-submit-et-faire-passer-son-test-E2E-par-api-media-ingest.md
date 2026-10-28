---
id: TASK-561
title: >-
  Supprimer l'API podcasts héritée (recherche, submit-episode, /podcasts/submit)
  et le mécanisme watchers, et faire passer le test E2E par
  /api/media/ingest-url
status: Done
assignee:
  - '@codex'
created_date: '2026-10-28 15:06'
updated_date: '2026-10-28 22:46'
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

Deepn n'a pas de recherche de podcasts : un podcast entre par un lien partagé ou collé (`POST /api/media/ingest-url`). Pourtant l'API garde une surface héritée d'août 2025, qu'aucun client n'appelle (vérifié le 2026-10-28 dans mobile, web, packages/core et extension) :
- `/api/podcast-search/*` (`api/endpoints/podcast_search.py` : search, episodes, submit-episode, trending) ;
- dans `api/endpoints/podcasts.py` : `GET /api/podcasts/search` et `POST /api/podcasts/submit`. Cette dernière route est appelée par le seul test E2E `tests/e2e/test_phase4_other_sources.py` ; elle crée un traitement sans entrée de bibliothèque, donc ne reflète plus le parcours réel.

Derrière ces routes : `core/services/episode_submission.py`, `core/services/media_submission.py` et le mécanisme « watchers », utilisé seulement par `media_submission` : `utils/media_watchers.py`, table `media_watchers-<env>` dans `dynamodb_core_tables.tf`, fan-out dans `workers/events/media_completed_worker.py`, effacement dans `account_deletion_service`. Ce sont autant de chemins fournisseurs à maintenir sous le contrôle budgétaire (TASK-549) pour rien.

## Périmètre

- Faire passer le test E2E podcast par `POST /api/media/ingest-url`, avec la même URL d'épisode Apple Podcasts, et lire le statut par `/api/media/{id}`.
- Supprimer les routes ci-dessus, leurs modèles et helpers, leur enregistrement dans `api/main.py`, `episode_submission`, `media_submission`, le mécanisme watchers (module, table Terraform, fan-out, effacement de compte) et les variables d'environnement devenues inutiles (`.env.example`, `runtime_env.tf`). L'adaptateur PodcastIndex reste s'il sert encore au worker de résolution.
- Mettre à jour la doc : contrat canonique, OpenAPI, INGESTION_WORKERS_PROVIDERS, BETA_BUDGET_CONTROL §7.1, DATA_RETENTION s'il cite la table.
- Rien n'est déployé : pas d'alias, pas de période de transition.

## Note owner

Après l'apply, la table `media_watchers-dev` doit être supprimée à la main si sa protection contre la suppression bloque Terraform. Le passage du test E2E se constate au prochain run E2E de l'owner contre dev. Ni l'un ni l'autre n'est un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les routes /api/podcast-search/*, GET /api/podcasts/search et POST /api/podcasts/submit sont supprimées avec le code qui ne sert qu'à elles (episode_submission, media_submission, modèles, helpers, enregistrement des routeurs)
- [x] #2 Le mécanisme watchers est supprimé : utils/media_watchers.py, la table media_watchers dans Terraform, le fan-out du worker de complétion et l'effacement de compte ; terraform validate passe
- [x] #3 tests/e2e/test_phase4_other_sources.py soumet l'épisode par POST /api/media/ingest-url et suit le statut par /api/media/{id}
- [x] #4 Aucune mention de ces routes ni des watchers ne subsiste dans le code, les tests, la configuration et la doc (grep vide hors backlog et docs/research) ; ruff et mypy passent
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Identifier les lecteurs des routes et services hérités et du mécanisme watchers, puis supprimer uniquement ces chemins morts.
2. Adapter le scénario E2E existant au parcours canonique ingest-url et media detail ; retirer table, configuration, fan-out et effacement watchers, et aligner la documentation hors archives de recherche/backlog.
3. Vérifier le grep exhaustif demandé, Ruff/mypy et Terraform validate, puis commit, fusion main et passage à Done ; aucun run E2E déployé lancé.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Les deux routeurs hérités et leurs modèles sont supprimés, ainsi que les services de soumission et la table/module de suivi sans lecteurs restants. Le client PodcastIndex conserve les fonctions utilisées par la résolution des liens ; neuf helpers sans lecteurs et un accès de compatibilité module sont retirés. Le consommateur de complétion garde la clôture du contenu/budget, les index et aperçus par sauvegarde, les traductions du compte soumetteur, sa notification et la reprise des artefacts ; le fan-out historique et son effacement de compte sont supprimés.

Le scénario E2E existant conserve exactement la fixture Apple Podcasts, utilise le helper commun POST /api/media/ingest-url puis GET /api/media/{media_item_id}, avec le délai podcast de 60 s. Aucun nouveau test ni run E2E n’a été ajouté/exécuté.

Configuration runtime, environnement exemple, table/output Terraform et override mypy obsolètes retirés. Documentation opérationnelle, architecture, contrat canonique et inventaire des routeurs dans AGENTS alignés. OpenAPI ne décrivait déjà aucune des routes supprimées : scan vide, sans alias ajouté. Les archives de recherche et le backlog restent historiques.

Validation : scan exhaustif git grep vide sur les noms des mécanismes et routes supprimés hors backlog/docs/research ; Ruff backend et fichier E2E modifié passe ; mypy media_summarizer passe (211 fichiers) ; Terraform validate dev passe ; diff sans erreur d’espacement. Aucun code mobile/web modifié.

PRÉREQUISITE OWNER après push : appliquer Terraform et déployer ; si la protection de suppression empêche le retrait de la table dev, la désactiver et retirer la table selon la note de la description. Le prochain E2E contre dev valide le parcours réel ; ces actions ne sont pas des AC du worktree.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Routes, modèles, services de soumission et suivi hérités retirés sans alias. PodcastIndex conservé pour les résolveurs actifs ; complétion/budget/index/aperçus/traductions/notification canoniques préservés. Scénario podcast E2E existant adapté à ingest-url et au media_item_id, sans run déployé. Documentation et configuration alignées ; scan vide, Ruff, mypy (211 fichiers), Terraform validate et diff propres. Fusionné dans main.
<!-- SECTION:FINAL_SUMMARY:END -->
