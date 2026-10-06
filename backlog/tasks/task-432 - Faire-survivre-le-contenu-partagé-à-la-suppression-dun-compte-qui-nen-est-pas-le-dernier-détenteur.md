---
id: TASK-432
title: >-
  Faire survivre le contenu partagé à la suppression d'un compte qui n'en est
  pas le dernier détenteur
status: To Do
assignee: []
created_date: '2026-10-06 15:38'
labels:
  - bug
  - api
  - compliance
dependencies: []
references:
  - media_summarizer/core/services/account_deletion_service.py
  - media_summarizer/core/services/media_purge_service.py
  - media_summarizer/core/services/durable_media_service.py
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/workers/cleanup/media_lifecycle.py
  - media_summarizer/utils/media_idempotence.py
  - media_summarizer/core/services/cover_capture.py
  - .testflight-feedback/report-2026-10-05.md
priority: high
type: bug
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Un transcript est dédupliqué globalement : quand deux comptes partagent le même média public, le second réutilise le transcript produit par le job du premier. `media_submission.py:135-136` le dit explicitement — le job qui a traité le contenu « peut appartenir à un autre utilisateur », et `durable_media_service.py:369` refuse d'attribuer ce job étranger au second compte. La localisation du transcript ne vit donc que sur la ligne de job du **premier** compte.

La suppression de compte ne tient pas compte de ce partage, à deux endroits :

- `account_deletion_service.py:305` (`_purge_media_objects`) supprime les objets S3 de **tous** les jobs du compte effacé — transcript, audio, quiz, plus les verrous de traduction — sans tester si un autre compte référence encore le `media_key` ;
- `account_deletion_service.py:140` (`_purge_processing_jobs`) supprime ensuite les lignes de job. Or `resolve_job_for_record` (`durable_media_service.py:466-474`) résout le transcript par `media_idempotence[media_key].job_id` → `get_processing_job_by_id`. La ligne disparue, la localisation n'est plus nommable.

**Scénario d'échec.** A partage un Reel. B partage le même Reel, dédup, sa bibliothèque réutilise le transcript de A. A supprime son compte. B perd la lecture du contenu brut (404 sur `/raw-content`), toute génération d'artefact nouvelle sur ce média, et la source pour ses digests — les trois appelants que le docstring de `resolve_job_for_record` nomme lui-même. Et comme `media_idempotence` est hors périmètre de la purge de compte, le registre affirme toujours « déjà traité, job A » : toute nouvelle soumission de ce Reel, par n'importe qui, est marquée `completed` vers un transcript qui n'existe plus.

Symétriquement, la purge de compte en fait **trop peu** sur les vignettes ré-hébergées : `cover_capture.delete_cover` n'est appelée que depuis la purge TTL (`workers/cleanup/media_lifecycle.py:188`), jamais depuis la suppression de compte, et le bucket `covers` n'a aucune règle d'expiration (`infrastructure/terraform/modules/platform/s3.tf:150`). Les objets orphelins restent indéfiniment. Même règle sous-jacente, même correctif : c'est pourquoi les deux sont dans cette tâche.

Le docstring de `media_purge_service.py:11` pose déjà l'obligation que les deux chemins de purge « suppriment les mêmes choses ». Le chemin TTL applique bien le test du dernier détenteur (`media_lifecycle.py:163`, `if content_job_id and not references`) ; le chemin suppression de compte ne l'applique pas aux objets de job. C'est cet écart qu'il faut fermer.

## Décision d'architecture retenue par l'owner (2026-10-06)

**Rendre la localisation du transcript adressable par le contenu**, portée par la ligne `media_idempotence` — déjà clé sur `media_key`, sans aucun `user_id`, et déjà hors périmètre de la purge de compte parce qu'elle « décrit du contenu, pas des personnes » (`account_deletion_service.py:38`).

C'est l'alignement sur ce que les artefacts font depuis task-394 : une génération partagée, clé sur le contenu seul sous un scope `@content#media#…` qu'aucun compte ne peut produire, possède l'objet S3 ; chaque compte demandeur n'a qu'un pointeur, y compris le premier. D'où `_delete_owned_object` (`media_purge_service.py:163`) qui rend 0 sur un pointeur, et une purge de compte qui supprime tous les pointeurs de A sans que la génération partagée bouge. Côté transcript la ligne adressée par contenu existe déjà — c'est le registre — il lui manque seulement le champ.

L'alternative écartée était de faire survivre la ligne de job de A en l'anonymisant : elle demande une exception au contrat « effacer toute trace du compte » pour une ligne qui porte son `user_id`, alors que la voie retenue n'en demande aucune et laisse `purge_account` continuer à supprimer toutes les lignes de job sans condition.

## Point de périmètre à trancher dans la tâche

`purge_job_objects` supprime trois clés : `transcription_s3_key`, `audio_s3_key`, `quiz_s3_key`. Le transcript est du contenu ; l'audio d'un média public l'est probablement aussi ; le quiz recoupe peut-être un artefact déjà partagé. Ce n'est pas établi. Trancher clé par clé et documenter la raison, sinon la correction laisse une deuxième panne du même type.

## Notes pour l'owner (hors critères d'acceptation)

- Le scénario demande deux comptes ayant partagé le même média : il n'est pas certain qu'il se soit déjà produit sur `-dev`. Le constat vient d'une lecture de code, pas d'une reproduction.
- Le déclencheur est l'audit de *Réglages > Supprimer le compte* (feedback TestFlight `ANMGWvqgxsUgwaA3Rz9fvic`, triage du 2026-10-05).
- Une vérification E2E manuelle après déploiement — créer deux comptes sur le même média, supprimer le premier, lire le contenu brut depuis le second — reste à ta main : elle ne peut pas être un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La localisation du transcript d'un contenu est lisible depuis la ligne `media_idempotence` de son `media_key`, sans lire aucune ligne de job ; vérifié par lecture d'une ligne réelle de la table sur `-dev` via l'AWS CLI, sortie citée dans les notes de la tâche
- [ ] #2 Aucun des appelants qui ont besoin de la localisation du transcript (lecture du contenu brut, génération d'artefact, digests) ne dépend plus de la survie d'une ligne de job appartenant à un autre compte
- [ ] #3 Aucun repli sur la ligne de job n'est conservé comme source de la localisation du transcript : le chemin de lecture est unique
- [ ] #4 Les lignes `media_idempotence` existantes de `-dev` portent la localisation du transcript après exécution du backfill, ou sont supprimées avec les objets qu'elles nommaient ; l'état retenu est vérifié sur la table `-dev` et consigné
- [ ] #5 La purge de compte ne supprime un objet S3 de niveau contenu que si aucune sauvegarde d'un autre compte ne référence encore le `media_key`, par le même test du dernier détenteur que `purge_shared_artifacts_for_content` (sémantique `ignore_user_id`, les lignes du compte effacé étant encore en table à cette étape)
- [ ] #6 Un job sans `media_key` — upload direct de document ou d'audio, non partageable — voit ses objets supprimés sans condition par la purge de compte
- [ ] #7 La purge de compte appelle `delete_cover` sur la vignette ré-hébergée quand, et seulement quand, le test du dernier détenteur établit que le contenu n'a plus aucun détenteur
- [ ] #8 Le niveau de chaque clé portée par un job (`transcription_s3_key`, `audio_s3_key`, `quiz_s3_key`) est tranché — contenu ou compte — et la raison de chacune est écrite dans le docstring du module de purge
- [ ] #9 Quand le dernier détenteur d'un contenu disparaît, les objets de niveau contenu, les verrous de traduction associés et la ligne `media_idempotence` partent ensemble, et ce par les deux chemins : purge de compte et purge TTL
- [ ] #10 `purge_account` supprime toujours la totalité des lignes de job du compte effacé, sans exception, et ne fait survivre aucune ligne portant son `user_id`
- [ ] #11 Les affirmations de l'écran *Réglages > Supprimer le compte* restent exactes au regard du nouveau comportement de purge ; si une ligne de copie devient fausse elle est corrigée dans les 11 catalogues i18n, et si aucune ne l'est le constat est écrit dans les notes de la tâche
- [ ] #12 `ruff check`, `ruff format --check` et `mypy` passent sans erreur sur les fichiers touchés
<!-- AC:END -->
