---
id: TASK-398
title: >-
  Générer les artefacts depuis le transcript original dans la langue de lecture,
  sans attendre sa traduction
status: To Do
assignee: []
created_date: '2026-09-16 12:27'
labels:
  - backend
  - artifacts
  - i18n
  - latency
dependencies: []
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Origine : feedback beta TestFlight (build 9, 2026-09-13), décision de l'owner le 2026-09-16 — pas de benchmark, le comportement cible est fixé.

## Problème
Une demande d'artefact sur un média fraîchement ajouté déclenche la traduction intégrale du transcript et attend qu'elle finisse avant de générer (60-90 s mesurés en task-203). `resolve_source` (`core/services/artifact_service.py`) prend la clé renvoyée par `resolve_or_enqueue_translated_transcript`, lève `TranslationInProgressError`, la source passe `_pending(PREPARATION_TRANSLATION)` et `commit_artifact_generation` n'enfile rien ; c'est `transcript_translation_worker` → `resume_artifacts_awaiting_media` qui réveille l'artefact. Le travail est de plus doublé : le corpus est traduit *et* le prompt impose la langue cible via `corpus.language_instruction`.

## Comportement cible
Le worker `artifact_generator` lit le transcript **original** de chaque source ; la langue de sortie est portée uniquement par `parameters["language"]` (langue de lecture de l'utilisateur) et `corpus.language_instruction`. C'est exactement le modèle déjà en place pour l'aperçu de source (`core/services/review_blurb_service.py`, `reading_language=None`), à étendre aux cinq types d'artefacts requêtables (`api/endpoints/artifacts.py`) et au scope dossier.

## Ce qui disparaît (pas de couche de compatibilité — rien n'est déployé)
Tout ce qui n'existe que pour faire attendre un artefact sur la traduction : l'appel au résolveur de transcript traduit dans `resolve_source`, la préparation `translation` et son état pending, le réveil des artefacts en attente depuis `transcript_translation_worker`, le champ de `media_artifact` qui documente la clé traduite lue. La traduction du **texte complet** côté lecteur (`/raw-content`, non bloquante) n'est **pas** concernée et reste.

## Point d'attention
`task-395` (traduire les artefacts sur changement de langue au lieu de les régénérer) a été conçue sur le pipeline « traduire d'abord ». L'implémenteur relit son périmètre et signale en notes toute hypothèse de task-395 que ce changement invalide ; il ne modifie pas task-395.

## Note owner (hors AC)
Vérification après merge et déploiement : sur un média étranger fraîchement ajouté, un artefact demandé immédiatement démarre sans passer par « En attente » et sort dans la langue de lecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 resolve_source ne résout plus de transcript traduit : la clé lue par le worker artifact_generator est celle du transcript original, pour le scope média comme pour le scope dossier
- [x] #2 La langue de sortie d'un artefact est portée par parameters["language"] et corpus.language_instruction, pour les cinq types requêtables
- [x] #3 Le chemin d'attente de traduction propre aux artefacts est supprimé (TranslationInProgressError côté artefacts, préparation translation, réveil depuis transcript_translation_worker) sans code mort résiduel ; le chemin /raw-content est inchangé
- [x] #4 ruff et mypy passent sur les fichiers modifiés
- [x] #5 Les hypothèses de task-395 invalidées par ce changement sont listées dans les notes d'implémentation
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Ce que fait le changement

`resolve_source` (`core/services/artifact_service.py`) télécharge le transcript
original et s'arrête là : plus d'appel au résolveur de transcript traduit, plus de
second téléchargement S3, plus de `translation_metadata`. La langue de la source
continue d'être détectée, mais **localement** (`detect_language` +
`job_source_language_hint`, gratuit, pas d'appel LLM) — elle sert à l'en-tête du
corpus et à `persist_detected_language`, jamais à choisir la clé lue.

La langue de sortie passe par un seul canal : `ScopeResolution.target_language` est
renommé `output_language` (nom du rôle réel), `plan_artifact_generation` le copie
dans `parameters["language"]`, le worker le relit et chaque générateur l'injecte
via `corpus.language_instruction(language)`. Les six générateurs le faisaient déjà
(les cinq types requêtables + `review_blurb`) : rien à changer côté prompts, la
correction porte sur la provenance de `parameters["language"]`, qui vaut désormais
la langue de lecture du demandeur pour toutes les demandes utilisateur, scope
dossier compris (un seul chemin de résolution pour les deux scopes).

`review_blurb_service` passe maintenant la vraie langue de lecture à
`resolve_scope_sources` : le contournement `reading_language=None` + `parameters`
construits à la main n'a plus de raison d'être, puisque le comportement qu'il
imitait est devenu le comportement par défaut.

### Supprimé (aucune couche de compatibilité)

- `transcript_translation.resolve_or_enqueue_translated_transcript` (≈205 lignes)
  et `TranslationPermanentlyFailedError` : `resolve_source` était leur seul
  appelant. Les imports devenus inutiles (`reserve_translation`,
  `is_terminally_failed`, `mark_translation_failed`) partent avec.
- `PREPARATION_TRANSLATION`, `EXCLUDED_REASON_TRANSLATION_FAILED`,
  `ArtifactTranslationFailedError`, les deux `except` de `resolve_scope_sources`,
  la branche `translation_failed` de `enforce_scope_ceilings`.
- Le 409 `translation_failed` de `POST /api/artifacts` (`api/endpoints/artifacts.py`) :
  cet endpoint n'a plus aucun 409.
- Dans `transcript_translation_worker` : `_media_key_for_job`,
  `_resume_waiting_artifacts`, `_fail_waiting_artifacts` et leurs quatre points
  d'appel. Le worker ne réveille et ne fait plus échouer aucun artefact.
- Le bloc `translation` du message SQS et de l'enveloppe d'artefact
  (`build_generation_message`, `workers/artifact_generator/worker.py`). Aucun
  composant mobile ne le lisait.
- Mobile : la branche `case "translation_failed"` de `lib/artifactRefusal.ts`
  (le backend ne peut plus émettre ce code) et les 7 clés i18n devenues orphelines
  dans les 11 catalogues (`artifacts.refusal.translationFailed`,
  `artifacts.refusal.sourcesTranslationFailed.one/.other`, `artifact.translatedFrom`,
  `artifact.translationFailed`, `artifact.translationFailedA11y`,
  `artifact.anotherLanguage`). `transcript.translationFailed` **reste** : c'est le
  badge du lecteur, chemin `/raw-content`.

### Chemin lecteur intact

`/raw-content` garde son propre résolveur (`raw_content_service._resolve_translation`),
sa réservation atomique, sa file SQS et `ensure_translated_transcript`. Le worker de
traduction n'a perdu que ses crochets artefacts. Le seul point de contact restant
entre les deux mondes est `detect_language` / `persist_detected_language`, qui ne
traduisent rien.

### Preuves à ma portée

- `ruff check media_summarizer/` : *All checks passed*.
- `mypy media_summarizer/` : *Success: no issues found in 188 source files* (AC#4).
- `ruff check tests/e2e/test_transcript_translation.py` : OK. `mypy` sur `tests/`
  n'est pas exécutable dans ce dépôt (`Source file found twice under different
  module names: "e2e" and "tests.e2e"`), et `make lint` ne cible que
  `media_summarizer/`.
- Grep de contrôle : plus aucune occurrence de `translation_failed`,
  `PREPARATION_TRANSLATION`, `translation_metadata` ou
  `resolve_or_enqueue_translated_transcript` hors du sous-système lecteur
  (`raw_content_service`, `transcript_translation`, `translation_idempotence`).

Ce qui **n'est pas** à ma portée : la vérification de bout en bout (média étranger
frais → artefact demandé immédiatement → démarre sans « En attente » → sort en
langue de lecture). Elle exige le backend déployé, et le déploiement part au push
sur `main`, après ma sortie. C'est la note owner de la description.

### Test e2e réaligné (aucun test ajouté)

`tests/e2e/test_transcript_translation.py` affirmait le bloc `translation` de
l'enveloppe (supprimé ici) et postait sur `POST /api/media/{id}/artifacts`
(endpoint non canonique). Il était par ailleurs déjà faux depuis task-203 : il
attend que le premier `/raw-content` soit un cache chaud, alors que le prewarm
d'ingestion a été supprimé et que la traduction est désormais paresseuse. Le test
est réaligné sur le contrat courant : l'artefact est demandé via
`POST /api/artifacts` avec un timeout serré (25 s — une régression vers
« traduire d'abord » le ferait sauter), on vérifie que le snapshot nomme le
transcript **original** (`language == "en"`, pas de `.translated.` dans la clé) et
que le résumé, lui, est en français ; le lecteur est vérifié séparément, en
polling, comme le documente le contrat. Aucun test n'a été ajouté (règle du
projet) : c'est une correction de test existant rendu faux par ce changement.

### Hypothèses de task-395 invalidées (AC#5 — task-395 non modifiée)

1. **Son « point d'attention » est caduc.** Il demande de vérifier que
   `trigger_review_blurb_generation` passe `reading_language=None` « pour éviter
   d'être envoyé dans le pipeline de traduction ». Ce code n'existe plus : le hook
   passe la langue de lecture réelle et aucun chemin de génération ne peut plus
   partir en traduction. Il n'y a plus rien à préserver de ce côté.
2. **Le pipeline pris pour modèle a changé de portée.** task-395 s'appuie sur
   `transcript_translation` et sa clé déterministe `(transcript_s3_key,
   target_language)`. Le sous-système survit, mais son entrée côté résolution
   (`resolve_or_enqueue_translated_transcript`) est supprimée : un implémenteur de
   task-395 doit repartir de `ensure_translated_transcript` et de la réservation de
   `raw_content_service`, pas d'un résolveur d'artefact.
3. **Comment savoir dans quelle langue est un artefact existant.** Plus de bloc
   `translation` dans l'enveloppe : la seule source de vérité est
   `parameters["language"]` de l'entrée. En contrepartie c'est devenu déterministe
   — avant, un artefact dont la traduction du transcript avait échoué pouvait sortir
   dans une langue tierce tout en portant `translation_failed=true`. La détection
   « cet artefact n'est pas dans ma langue de lecture » est donc plus simple, mais
   elle ne se lit plus au même endroit.
4. **Plus de machinerie d'attente réutilisable côté artefacts.** `PREPARATION_TRANSLATION`,
   l'état pending correspondant et le 409 `translation_failed` sont supprimés. Si la
   traduction d'artefact à l'ouverture doit être asynchrone, task-395 devra porter
   son propre état (ou réutiliser `translation_idempotence`) ; elle ne peut plus se
   greffer sur le mécanisme d'attente de task-360, qui ne connaît plus que la
   transcription.
5. **Ce qui reste valide.** Le constat de coût de task-395 est intact : un changement
   de langue produit toujours un nouvel `artifact_id` (la langue est dans le hash) et
   une génération relit toujours l'intégralité du transcript. task-398 ne rend pas le
   changement de langue moins cher ; il supprime seulement l'attente à la première
   demande.

### Doc mise à jour

`docs/CANONICAL_MEDIA_API_CONTRACT.md` (un seul point de jonction, plus de 409 sur
`POST /api/artifacts`, `sources_preparation_failed` limité à l'ingestion) et
`docs/INGESTION_WORKERS_PROVIDERS.md` (la section « detect+translate » ne sert plus
que le lecteur ; schéma de pipeline, ligne « Downstream », gestion d'échec et refs
corrigés).
<!-- SECTION:NOTES:END -->
