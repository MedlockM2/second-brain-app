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
- [ ] #1 resolve_source ne résout plus de transcript traduit : la clé lue par le worker artifact_generator est celle du transcript original, pour le scope média comme pour le scope dossier
- [ ] #2 La langue de sortie d'un artefact est portée par parameters["language"] et corpus.language_instruction, pour les cinq types requêtables
- [ ] #3 Le chemin d'attente de traduction propre aux artefacts est supprimé (TranslationInProgressError côté artefacts, préparation translation, réveil depuis transcript_translation_worker) sans code mort résiduel ; le chemin /raw-content est inchangé
- [ ] #4 ruff et mypy passent sur les fichiers modifiés
- [ ] #5 Les hypothèses de task-395 invalidées par ce changement sont listées dans les notes d'implémentation
<!-- AC:END -->
