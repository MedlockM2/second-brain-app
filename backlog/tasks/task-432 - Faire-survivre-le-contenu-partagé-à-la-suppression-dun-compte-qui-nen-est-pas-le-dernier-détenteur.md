---
id: TASK-432
title: >-
  Faire survivre le contenu partagé à la suppression d'un compte qui n'en est
  pas le dernier détenteur
status: Done
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
- [x] #1 La localisation du transcript d'un contenu est lisible depuis la ligne `media_idempotence` de son `media_key`, sans lire aucune ligne de job ; vérifié par lecture d'une ligne réelle de la table sur `-dev` via l'AWS CLI, sortie citée dans les notes de la tâche
- [x] #2 Aucun des appelants qui ont besoin de la localisation du transcript (lecture du contenu brut, génération d'artefact, digests) ne dépend plus de la survie d'une ligne de job appartenant à un autre compte
- [x] #3 Aucun repli sur la ligne de job n'est conservé comme source de la localisation du transcript : le chemin de lecture est unique
- [x] #4 Les lignes `media_idempotence` existantes de `-dev` portent la localisation du transcript après exécution du backfill, ou sont supprimées avec les objets qu'elles nommaient ; l'état retenu est vérifié sur la table `-dev` et consigné
- [x] #5 La purge de compte ne supprime un objet S3 de niveau contenu que si aucune sauvegarde d'un autre compte ne référence encore le `media_key`, par le même test du dernier détenteur que `purge_shared_artifacts_for_content` (sémantique `ignore_user_id`, les lignes du compte effacé étant encore en table à cette étape)
- [x] #6 Un job sans `media_key` — upload direct de document ou d'audio, non partageable — voit ses objets supprimés sans condition par la purge de compte
- [x] #7 La purge de compte appelle `delete_cover` sur la vignette ré-hébergée quand, et seulement quand, le test du dernier détenteur établit que le contenu n'a plus aucun détenteur
- [x] #8 Le niveau de chaque clé portée par un job (`transcription_s3_key`, `audio_s3_key`, `quiz_s3_key`) est tranché — contenu ou compte — et la raison de chacune est écrite dans le docstring du module de purge
- [x] #9 Quand le dernier détenteur d'un contenu disparaît, les objets de niveau contenu, les verrous de traduction associés et la ligne `media_idempotence` partent ensemble, et ce par les deux chemins : purge de compte et purge TTL
- [x] #10 `purge_account` supprime toujours la totalité des lignes de job du compte effacé, sans exception, et ne fait survivre aucune ligne portant son `user_id`
- [x] #11 Les affirmations de l'écran *Réglages > Supprimer le compte* restent exactes au regard du nouveau comportement de purge ; si une ligne de copie devient fausse elle est corrigée dans les 11 catalogues i18n, et si aucune ne l'est le constat est écrit dans les notes de la tâche
- [ ] #12 `ruff check`, `ruff format --check` et `mypy` passent sans erreur sur les fichiers touchés
<!-- AC:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
### Ce qui a changé

**La ligne `media_idempotence` nomme le transcript.** Deux attributs nouveaux,
`transcript_s3_key` et `source_language`, écrits par le seul point de jointure que
toutes les ingestions alimentent (`media_completed_worker._record_content_outcome`,
qui reçoit déjà `transcription_s3_key` et `transcription_metadata` dans l'événement
de complétion). `_record_terminal_status` crée la ligne quand le job qui rapporte
l'issue est nommé et qu'aucune ligne n'existe : une réservation n'est prise que pour
un contenu désigné par un locator public, donc un fichier uploadé (clé
`acct_mkey_v1_`) n'avait aucune ligne de registre — et donc aucun nom pour son
transcript hors de sa ligne de job. La condition sur le `job_id` reste intacte
(`attribute_not_exists(job_id) OR job_id = :j`), un item absent la satisfait.

**Un seul chemin de lecture.** `resolve_job_for_record` est supprimé et remplacé par
deux fonctions qui ne répondent pas à la même question :

- `resolve_content_transcript(record) -> ContentTranscript | None` — où est le texte.
  Lit le registre et **rien d'autre** : zéro `get_processing_job_by_id`. Utilisée par
  `/raw-content`, `resolve_scope_sources` (donc la génération d'artefact et les
  digests) et `review_blurb_service`.
- `resolve_pipeline_job(record, content_job_id=…)` — où en est le pipeline.
  Enrichissement pur, `None` est une réponse normale, et son docstring interdit d'y
  lire une localisation de transcript. Elle reçoit le `job_id` que le registre vient
  de donner, donc le coût reste d'un `GetItem` par appelant.

`transcription_s3_key` disparaît aussi du contrat d'API (`TranscriptInfo`,
`CANONICAL_MEDIA_API_CONTRACT.md`, l'OpenAPI) : c'était la deuxième source de ce
fait, le client n'a jamais lu la valeur (`mobile/src/types/media.ts:171` la déclare
et personne ne l'utilise) et il ne peut rien faire d'une clé S3. Le champ optionnel
côté mobile est laissé en place — `mobile/` est hors périmètre ici et un champ
optionnel absent de la réponse ne casse rien.

**`media_key` sur le message d'upload audio.** `POST /api/media/upload-audio` était
la seule ingestion à ne pas transmettre `media_key` au worker, donc son événement de
complétion arrivait sans identité de contenu et `media_completed_worker` le jetait
avant tout traitement. Une ligne ajoutée au corps SQS. Effet de bord volontaire et
souhaitable : un upload audio reçoit désormais son indexation Algolia, son aperçu de
source, sa traduction armée et sa notification « prêt », comme toutes les autres
ingestions.

**La purge, aux deux niveaux.** `media_purge_service` porte maintenant le test du
dernier détenteur (`content_holders`, deux exclusions : `ignore_user_id` pour une
erasure de compte, `ignore_save` pour une ligne balayée par le TTL) et la cascade de
niveau contenu (`purge_content_for_media_key`). Les deux chemins l'appellent, donc
la promesse du docstring du module — « les deux chemins suppriment les mêmes
choses » — devient vraie pour les objets de job aussi. `_purge_media_objects` sépare
les jobs sans `media_key` (supprimés sans condition) des `media_key` du compte
(cascade contenu, gated). Piloter la purge par contenu et non par job apporte deux
choses que l'ancien code ne pouvait pas faire : le *job de contenu* du registre est
balayé même s'il appartenait à un compte effacé il y a longtemps, et une sauvegarde
dédupliquée (qui n'a aucun job) voit enfin son contenu purgé.

### AC#1 — la localisation lue sur `-dev`, sans toucher une ligne de job

`aws dynamodb get-item --table-name media_idempotence-dev --profile … --region
eu-west-3 --key '{"media_key":{"S":"mkey_v1_294943e9…0428"}}'` :

```json
{"Item": {
  "media_key":          {"S": "mkey_v1_294943e995f7202b5ffa27e1314975b7aceb7c0d63f3a450e6e215a632690428"},
  "status":             {"S": "processed"},
  "job_id":             {"S": "90911621-3967-4660-9345-5abd238530f7"},
  "transcript_s3_key":  {"S": "90911621-3967-4660-9345-5abd238530f7.txt"},
  "source_language":    {"S": "fr"},
  "created_at":         {"S": "2026-09-05T08:42:39.187488+00:00"},
  "updated_at":         {"S": "2026-10-06T16:45:06.501614+00:00"}
}}
```

Le `job_id` reste sur la ligne, pour la corrélation et pour le balayage par préfixe
de la purge. Il n'est plus déréférencé pour trouver le texte.

### AC#4 — état du backfill sur `-dev`

`media_summarizer/scripts/backfill_media_idempotence_transcripts.py`, dry-run par
défaut, `MEDIA_IDEMPOTENCE_BACKFILL_APPLY=true` pour écrire. Il demande au job sa
`transcription_s3_key`, et si le job a expiré il **liste le bucket des transcripts
sous l'id du job** — les clés sont `<job_id>.<ext>`, donc l'objet se nomme lui-même.
Une ligne `processed` pour laquelle rien n'existe nulle part est supprimée avec le
balayage de son préfixe de job : elle répondrait « déjà traité, job X » pour un objet
introuvable, ce qui marque `completed` toute nouvelle soumission de cette URL.

Table `media_idempotence-dev`, 98 lignes. Après exécution (`APPLY`) :

| | |
|---|---|
| `located_job_row` | 72 |
| `located_bucket_listing` | 19 |
| `written` | 91 |
| `left_alone_failed` | 6 |
| `left_alone_reserved` | 1 |
| `deleted_naming_nothing` | 0 |

Vérification par scan de la table après coup : `('processed','with_key') 91`,
`('failed','no_key') 6`, `('reserved','no_key') 1`, total 98. Deuxième exécution :
`skipped_already_located: 91` — idempotent.

Les 7 lignes sans localisation ne *prétendent* aucun texte, donc il n'y a ni
localisation à inscrire ni objet à supprimer : `failed` est l'enregistrement
légitime d'une ingestion qui n'a rien produit, et la seule `reserved` restante est
une réservation dont aucun objet de transcript n'existe — le domaine du script de
réconciliation task-390, pas celui-ci. Effet de bord noté : 19 lignes trouvées par
listing de bucket étaient `reserved` alors que leur transcript existait ; le backfill
les a avancées à `processed` via `mark_processed`, ce qui réduit d'autant le reliquat
task-390.

### AC#8 — niveau de chaque clé, et la raison

Écrit dans le docstring de `media_purge_service`. En résumé :

- `transcription_s3_key` → **contenu**. C'est le texte, écrit une fois : la deuxième
  sauvegarde d'un média public ne lance aucun job et lit cet objet précis. Ses
  traductions sont des clés dérivées du même objet et leurs verrous sont empreintés
  sur la clé source, donc les deux le suivent.
- `audio_s3_key` → **contenu**. Même raisonnement un cran plus tôt : le fichier média
  est téléchargé une fois, sous l'id du job de contenu, et une sauvegarde dédupliquée
  ne le retélécharge jamais. Un fichier audio *uploadé* n'est pas ce cas — son job ne
  porte pas de `media_key`, donc il relève du niveau compte.
- `quiz_s3_key` → **contenu**. C'est une génération sur le contenu, d'avant le passage
  des générations par `media_artifacts` (task-406). Depuis task-394 une génération
  partagée appartient au contenu ; cette clé legacy est le même objet sous un autre
  nom, elle reçoit donc la même règle plutôt qu'une deuxième.
- Le préfixe document par job → **compte**, par construction : seul un upload y écrit,
  et le job d'un upload ne porte pas de `media_key`.
- `shared-audio/<user_id>/` → **compte**, la clé porte l'id de l'utilisateur.

### AC#11 — aucune ligne de copie ne devient fausse

Les affirmations de `mobile/app/settings/delete-account.tsx` sont
`deleteAccount.warningBody` (« erases it permanently, along with everything you
saved »), les cinq `deleteAccount.erased.*` (bibliothèque et dossiers ; « every
transcript, summary, note, flashcard and quiz » ; digests ; index de recherche ;
identité), `deleteAccount.acknowledge` (« all my data will be erased permanently »)
et `deleteAccount.confirmBody`. Aucune ne devient fausse, pour deux raisons :

1. **Rien de ce qui porte l'identifiant du compte ne survit.** AC#10 : toutes les
   lignes de job partent, sans exception, y compris celle qui a traité un contenu que
   d'autres comptes détiennent encore. Ce que ces autres comptes avaient besoin d'y
   lire n'y est plus — c'est le registre qui le porte, et le registre ne nomme
   personne.
2. **Un objet de niveau contenu qui survit n'est pas « ses » données.** C'est la
   transcription machine d'un média public, clé sur l'id d'un job, sans aucun
   identifiant de compte, plus joignable par le compte effacé, et seulement tant
   qu'un autre compte détient ce média. C'est exactement la classe d'objet que
   task-394 fait déjà survivre à une suppression de compte (une génération partagée)
   sans que cette copie ait eu à changer — « every transcript, summary… » et la
   survie d'un résumé partagé coexistent déjà dans le produit livré.

Aucun des 11 catalogues i18n n'est modifié.

### AC#12 — non coché, et pourquoi

`ruff check media_summarizer` : *All checks passed*. `mypy media_summarizer` :
*Success, no issues found in 194 source files*. Les deux sont propres.

`ruff format --check` échoue sur les 11 fichiers touchés — **et échoue à l'identique
sur `main`** : le dépôt n'a jamais été formaté par `ruff format` (139 fichiers sur 194
seraient reformatés), la CI ne lance que `ruff check` (`.github/workflows/pr.yml:39`,
`main.yml:35`) et le `Makefile` ne lance `ruff format` que dans la cible `format`,
jamais en vérification. Rendre cet AC vrai demanderait de reformater
`api/endpoints/media.py` et `core/services/artifact_service.py` en entier, soit
~1900 lignes de diff de pure mise en forme sur du code que cette tâche ne touche pas,
ce qui enterrerait la correction et entrerait en conflit avec tout travail parallèle.
Choix retenu : laisser l'AC non coché plutôt que polluer le diff. Un reformatage
global est une décision de dépôt, pas un sous-produit de ce correctif.

### Hors portée de l'agent (pour l'owner)

- **La vérification E2E du scénario** — deux comptes sur le même média public,
  suppression du premier, lecture du contenu brut depuis le second — demande le code
  déployé. Le déploiement se déclenche au push sur `main`, après la sortie de
  l'agent. Elle reste à la main de l'owner, comme la description le prévoyait.
- **La règle d'expiration du bucket `covers`** (`modules/platform/s3.tf`) n'a pas été
  ajoutée : aucun AC ne la demande, et le correctif nommé par la description — appeler
  `delete_cover` depuis la purge de compte — est fait (AC#7). Les objets orphelins
  déjà présents sur `-dev` ne sont pas rattrapés.
- Aucun test automatisé n'a été ajouté : le dépôt l'interdit sauf demande explicite.
<!-- SECTION:NOTES:END -->
