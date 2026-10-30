---
id: TASK-573
title: >-
  Workers SQS : retenter les échecs temporaires, passer immédiatement en failed
  les échecs définitifs, et ne plus perdre de message en silence
status: Done
assignee: []
created_date: '2026-10-30 13:32'
updated_date: '2026-10-30 14:05'
labels:
  - ingestion
dependencies: []
references:
  - media_summarizer/workers/lambda_handlers.py
  - media_summarizer/workers/base_worker.py
  - infrastructure/terraform/modules/platform/lambda_workers.tf
  - media_summarizer/workers/podcastindex_resolution_worker.py
  - media_summarizer/workers/transcription/deepgram_worker.py
  - media_summarizer/core/media_ingestion/errors.py
  - media_summarizer/core/models/failure_codes.py
  - docs/INGESTION_WORKERS_PROVIDERS.md
  - docs/research/task-196-worker-timeouts-audit/README.md
  - media_summarizer/core/media_ingestion/adapters/orchestrators.py
  - media_summarizer/workers/events/media_completed_worker.py
  - media_summarizer/utils/database_async.py
priority: high
type: bug
ordinal: 179000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Constat (owner, 2026-10-30)

L'owner partage un épisode Spotify (`https://open.spotify.com/episode/0t70Km0oBQYYPXJvi5osl0`, job dev `b3329a51-559f-4c00-a15e-7d9cb544f612`). L'app reste en chargement sans fin. Logs du worker `podcastindex_resolution-dev` : un seul passage à 13:12:37 UTC, terminé par `RuntimeError: Podcast URL could not be resolved. code=episode_not_found`. Ensuite, plus rien : le job reste en `extracting`, le message n'est plus dans la file ni en DLQ, et aucun 2ᵉ essai n'a lieu (visibilité de 300 s). Le job a été passé à la main en `failed` (`MEDIA_UNAVAILABLE`, `error_metadata.resolved_by = manual_after_lost_sqs_message`).

## Cause : deux défauts qui s'additionnent

1. **Le message est supprimé au lieu d'être retenté.** `lambda_handlers.py` (`_build_handler`) rattrape l'exception, ajoute le message à `batchItemFailures` et répond normalement. Mais `aws_lambda_event_source_mapping.worker` (`infrastructure/terraform/modules/platform/lambda_workers.tf`) n'active pas `function_response_types = ["ReportBatchItemFailures"]` (AWS le confirme : `FunctionResponseTypes: []`). Lambda ignore donc la liste, considère le lot réussi et supprime le message. La `RedrivePolicy maxReceiveCount=3` ne sert que pour les timeouts et les crashs. Toute exception levée par le code d'un worker est perdue au premier essai, et ce sur tous les workers branchés sur `_build_handler`.
2. **Personne ne passe le job en `failed`.** Le filet qui marque le job en échec au dernier essai est dans `process_message_with_retry` (`base_worker.py`). Il ne sert que dans les boucles de polling `__main__` des workers. Sous Lambda, `_build_handler` appelle directement `process_message`, donc ce filet ne tourne jamais. Le worker podcast lève `RuntimeError` sur `episode_not_found` sans marquer le job.

`docs/INGESTION_WORKERS_PROVIDERS.md` (≈ l. 1208, « The `TRANSIENT` failure goes back to SQS (`process_message_with_retry`) ») et l'audit `docs/research/task-196-worker-timeouts-audit/README.md` décrivent un fonctionnement qui n'est pas celui de la production Lambda.

## Correctif attendu

Classer chaque erreur au moment où elle est levée, et laisser le handler commun décider de la suite :

- **Définitive** (épisode introuvable, URL invalide, plateforme non supportée, quota refusé, contenu indisponible…) : job `failed` immédiatement avec un `MediaFailureCode` précis, message non renvoyé à SQS, aucun nouvel essai.
- **Temporaire** (5xx, timeout ou limite de débit d'un fournisseur, throttling AWS) : message renvoyé à SQS via `batchItemFailures`. Au dernier essai (`ApproximateReceiveCount` ≥ `maxReceiveCount` de la file), job `failed` avec le code qu'elle porte, puis le message part en DLQ pour analyse.
- **Inconnue** (toute autre exception) : traitée comme temporaire, avec `UNEXPECTED_ERROR` au dernier essai.

Deux classes d'exception communes portent cette distinction et le `MediaFailureCode`. Les paires existantes (`NonRetryableDeepgramError` / `RetryableDeepgramError`, `NonRetryableProviderResolutionError` / `RetryableProviderResolutionError`) en dérivent ou sont remplacées par elles. Aucune nouvelle copie parallèle. Un job déjà dans un état terminal n'est jamais réécrit par le handler (même règle qu'aujourd'hui dans `process_message_with_retry`).

Le projet n'a jamais été mis en production : l'ancien chemin est supprimé dans la même tâche (`process_message_with_retry`, `get_sqs_receive_params`, `process_messages_batch` et les boucles de polling `__main__` des workers), après avoir vérifié que rien d'autre ne les appelle. Pas de double chemin.

**Point à vérifier worker par worker : les fournisseurs payants.** Activer le retry fait réellement retenter des échecs qui étaient jusqu'ici abandonnés. Pour un worker qui appelle un fournisseur payant (Deepgram, Apify, LLM des artefacts, traduction), une erreur survenue *après* un appel payant réussi doit être définitive, sauf si la reprise est idempotente (pas de seconde facturation, pas de double réservation de budget). Le worker d'artefacts gère déjà certains échecs LLM via `batchItemFailures` (voir `artifact_generator/worker.py` et `llm_alerts.tf`) : vérifier que l'activation du flag ne change pas ces alarmes et ne crée pas de nouvelles générations facturées.

Côté podcast, chaque `PodcastResolverErrorCode` est rangé explicitement comme définitif ou temporaire, avec son `MediaFailureCode` : `episode_not_found` → définitif, `MEDIA_UNAVAILABLE`.

## Note à l'owner (hors AC)

Après déploiement sur dev : partager à nouveau l'épisode Spotify ci-dessus. L'app doit afficher l'erreur en quelques secondes, sans chargement sans fin. Pour le chemin temporaire : couper l'accès à un fournisseur (clé invalide sur dev) et vérifier dans les logs 3 passages espacés d'environ 5 min, puis le job en `failed` et le message en DLQ.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `aws_lambda_event_source_mapping.worker` dans `lambda_workers.tf` déclare `function_response_types = ["ReportBatchItemFailures"]` et `terraform validate` passe
- [x] #2 Deux classes d'exception communes (définitive / temporaire) portent un `MediaFailureCode` ; les paires Retryable/NonRetryable existantes (Deepgram, provider resolution) en dérivent ou sont remplacées, sans laisser de doublon
- [x] #3 Dans `_build_handler`, une exception définitive passe le job en `failed` avec son code et n'ajoute pas le message à `batchItemFailures`
- [x] #4 Dans `_build_handler`, une exception temporaire ou inconnue ajoute le message à `batchItemFailures` ; au dernier essai (`ApproximateReceiveCount` ≥ `maxReceiveCount` de la file), le job passe d'abord en `failed` avec le code porté par l'exception, ou `UNEXPECTED_ERROR` pour une exception inconnue
- [x] #5 Le handler ne réécrit jamais un job déjà dans un état terminal
- [x] #6 Le worker podcast associe explicitement chaque `PodcastResolverErrorCode` à un caractère définitif ou temporaire et à un `MediaFailureCode` ; `episode_not_found` lève une exception définitive avec `MEDIA_UNAVAILABLE`
- [x] #7 Pour chaque worker qui appelle un fournisseur payant, les erreurs levées après un appel payant réussi sont définitives, sauf si la reprise est idempotente ; le choix est noté dans un commentaire à l'endroit où l'erreur est levée
- [x] #8 `process_message_with_retry`, `get_sqs_receive_params`, les `process_messages_batch` et les boucles de polling `__main__` des workers sont supprimés, et `git grep` ne trouve plus de référence dans `media_summarizer/` ni dans `pyproject.toml`
- [x] #9 `docs/INGESTION_WORKERS_PROVIDERS.md` décrit le fonctionnement réel (handler Lambda, ReportBatchItemFailures, définitif / temporaire) au lieu de `process_message_with_retry`
- [x] #10 `ruff` et `mypy` passent sans erreur
- [x] #11 Chaque passage en `failed` décidé par le handler suit le chemin des échecs déjà gérés (cf. échec d'extraction dans `orchestrators.py`) : `mark_failed`, puis `update_processing_job` (met à jour `user_media`, lu par l'app), puis un événement `episode_completion_status` `failure` (`media_key`, `canonical_job_id`, `reason: CODE:raison`) qui ferme la réservation `media_idempotence`, le budget d'import et les attentes d'artefacts
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-30 : en corrigeant le job b3329a51 à la main, un premier passage en `failed` écrit directement dans `processing_jobs` est resté invisible pour l'app. Il manquait la mise à jour de `user_media` (faite dans `update_processing_job`) et l'événement d'échec (sans lui, `media_idempotence` restait `reserved` et un nouveau partage aurait été pris pour un doublon en cours). L'ancien filet `process_message_with_retry` n'envoyait pas non plus cet événement : ne pas le recopier tel quel.

2026-10-30, implémentation :
- Terraform : function_response_types = ["ReportBatchItemFailures"] sur aws_lambda_event_source_mapping.worker ; maxReceiveCount des 15 files lu dans local.worker_max_receive_count (3), injecté aux workers comme SQS_MAX_RECEIVE_COUNT. terraform validate passe sur dev et prod.
- Classes communes dans core/models/ingestion_failures.py : IngestionFailure (déplacée depuis workers/) + PermanentIngestionFailure / TransientIngestionFailure. NonRetryableDeepgramError / RetryableDeepgramError et NonRetryableProviderResolutionError en dérivent ; RetryableProviderResolutionError n'était levée nulle part : supprimée. workers/ingestion_failures.py ne garde que la table Apify.
- workers/sqs_delivery.py : settle_failure (décision définitive / temporaire / inconnue, dernier essai) et fail_job (mark_failed, update_processing_job, événement failure CODE:raison ; job terminal jamais réécrit). _build_handler l'appelle ; fails_job=True pour les 8 workers d'ingestion seulement.
- Podcast : table _RESOLVER_FAILURES, un caractère et un MediaFailureCode par PodcastResolverErrorCode ; episode_not_found -> définitif MEDIA_UNAVAILABLE.
- Fournisseurs payants, définitif après un appel payant réussi, commenté à chaque raise : Deepgram (transcript_store_failed, deepgram_invalid_json, deepgram_request_lost), X (x_post_store_failed), OCR Instagram (instagram_image_transcript_store_failed), documents (parsed_document_store_failed), traduction (erreur inattendue acquittée). Apify et artefacts : reprise idempotente (run retrouvé sur le job / claim du callback ; claim d'artefact refusé hors GENERATING), commentée. Les alarmes llm_alerts lisent llm.generation_failed, émis une fois par échec : inchangées.
- Supprimés : base_worker.py (process_message_with_retry, get_sqs_receive_params), les process_messages_batch, toutes les boucles poll_queue/main/__main__ des workers SQS, les *_WORKER_MAX_RETRIES (lus désormais via is_last_delivery), sqs.receive_messages / delete_message / get_sync_sqs_client, _schedule_next_poll et RSS_POLL_INTERVAL_SECONDS (RSS), TEST_MODE/RETRY_DELAY. Le __main__ de digest/scheduler reste : c'est un lancement ponctuel, pas une boucle SQS.
- Correctifs au passage : le worker Deepgram publiait l'événement d'échec sans passer le job en failed, et le worker documents passait le job en failed sans publier l'événement : les deux passent maintenant par fail_job.
- Docs : INGESTION_WORKERS_PROVIDERS.md (nouvelle section « How a failed message is retried », sections d'échec de chaque worker), runbook pipeline-alerts (DLQ). ruff, mypy et check_env_example_complete passent.
- Note owner : après push sur main, rejouer le partage Spotify de la description et le test clé invalide (3 passages, puis job failed et message en DLQ). Les DLQ vont maintenant se remplir pour de vrai sur les échecs temporaires épuisés : leurs alarmes deviennent un vrai signal.
<!-- SECTION:NOTES:END -->
