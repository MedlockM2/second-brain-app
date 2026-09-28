---
id: TASK-414
title: >-
  Traduire le transcript à l'ingestion au lieu d'attendre la première lecture
  (retour sur task-203)
status: To Do
assignee: []
created_date: '2026-09-27 21:28'
labels:
  - ingestion
dependencies: []
references:
  - >-
    backlog/tasks/task-203 -
    Aligner-la-traduction-de-transcript-async-sur-le-pattern-détat-idempotence-des-artefacts-pour-supprimer-le-prewarm-bloquant-et-la-tempête-de-re-traductions-suite-task-200.md
  - >-
    backlog/tasks/task-395 -
    Traduire-les-artefacts-et-laperçu-sur-changement-de-langue-au-lieu-de-les-régénérer.md
priority: medium
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Feedback testeur `AKsI1Vm2Fgu7CqMkppRaWG8` (rapport de triage `report-2026-09-27.md`, section 2) : le pill « Traduction en cours… » s'affiche pour un média traité il y a longtemps (vu dans le Digest hebdomadaire). Diagnostic établi (`report-2026-09-23.md`, confirmé le 27) : ce n'est pas l'âge du média qui déclenche la traduction, c'est le fait qu'il n'a jamais été **lu** dans cette langue — `GET /api/media/{id}/raw-content` est le seul déclencheur, introduit par task-203 (`Done`) pour remplacer un prewarm synchrone bloquant qui timeoutait systématiquement (45 s, task-192/200) et provoquait une tempête de re-traductions.

**Décision owner : revenir sur ce choix.** La traduction doit démarrer au partage/à l'ingestion, pas à la première lecture, pour qu'elle soit déjà prête à l'ouverture du média (Digest ou ailleurs) — c'est ce que demandait explicitement le testeur.

## Contrainte héritée de task-203, à préserver absolument

L'enqueue à l'ingestion doit être **asynchrone et non bloquant**. Ne pas réintroduire le prewarm synchrone `await` de task-192 : les workers d'ingestion doivent continuer à compléter le job immédiatement après l'upload du transcript, sans l'attendre. Réutiliser la machine à états déjà construite par task-203 (`none → queued → in_progress → done | failed`, réservation atomique par `ConditionExpression` sur `(transcript_s3_key, target_language)`) : c'est elle qui garantit qu'un enqueue proactif à l'ingestion et un enqueue paresseux ultérieur (ex. `/raw-content` lu par un autre compte, ou après un changement de langue de lecture) ne se marchent pas dessus et ne redéclenchent pas la tempête de re-traductions que task-203 a éliminée.

Langue cible à déterminer par l'implémenteur : la langue de lecture du compte à l'origine du partage, sur le modèle déjà en place pour les artefacts (task-395).

## Hors scope

Les artefacts (résumés, quiz, aperçu…) traduits par task-395 restent traduits à l'ouverture, pas à l'ingestion — cette tâche ne couvre que le transcript complet (`transcript_translation_worker` / le chemin `/raw-content`). Étendre la même logique aux artefacts serait une tâche séparée si l'owner le demande.

Le bug mobile signalé dans le même feedback (le sondage de traduction plafonne à 60 s alors qu'une traduction prend 60-90 s, et affiche alors l'anglais non traduit comme définitif) n'est pas couvert ici — il chevauche les tâches en cours task-410/task-411 sur le même écran et fait l'objet d'un arbitrage séparé.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Après l'upload du transcript par un worker d'ingestion, une traduction vers la langue de lecture du compte à l'origine du partage est enqueuée automatiquement, sans que le job d'ingestion attende la fin de cette traduction pour se compléter.
- [x] #2 L'enqueue proactif passe par la réservation atomique existante de task-203 : si une traduction pour ce couple (transcript_s3_key, target_language) est déjà queued/in_progress/done, aucun second job n'est enqueué.
- [x] #3 Si la langue de lecture du compte au moment du partage correspond à la langue détectée du transcript, aucune traduction n'est enqueuée.
- [x] #4 GET /api/media/{id}/raw-content reste fonctionnel comme filet de secours (changement de langue de lecture après coup, lecture par un autre compte) : le déclenchement paresseux existant n'est pas supprimé, seulement complété par le déclenchement proactif.
- [x] #5 ruff et mypy passent sans erreur sur les modules touchés.
- [ ] #6 Une vérification directe contre DynamoDB/S3 -dev réels, documentée dans les notes d'implémentation, montre qu'un partage déclenche l'enqueue (statut queued/in_progress posé, message SQS visible) sans attendre une lecture.
- [x] #7 Aucun test automatisé ajouté (règle du projet).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Où se branche le déclencheur : le consumer de complétion, pas les workers

Le déclenchement proactif vit dans `workers/events/media_completed_worker.py`
(`_arm_transcript_translations` → `core/services/ingestion_translation_service.py::arm_transcript_translations`),
et **aucun worker d'ingestion n'est modifié**. Raison : c'est le point de jonction unique
où publient les dix chemins d'ingestion (youtube, tiktok, instagram, x, deepgram,
article, podcastindex, document_parsing, orchestrators), et ils y publient **après**
l'upload du transcript et `job.mark_completed()`. Le job d'ingestion ne peut donc rien
attendre (AC #1) : la contrainte héritée de task-203 tient par construction, pas par
discipline. Un seul point d'appel au lieu de dix, au même endroit que le `review_blurb`,
l'indexation et la notification.

Ce que fait le hook : une lecture de profil par compte, une détection de langue (tag
source d'abord, sinon **un** `GetObject` S3 + `langdetect` local, gratuit), puis par
langue cible une réservation conditionnelle et un `SendMessage`. Aucun appel LLM ;
mesuré à 0,74 s contre -dev (ci-dessous). Le hook avale toute exception : un événement
de complétion n'est jamais rejoué parce qu'une traduction n'a pas pu partir, et
`/raw-content` rattrape ce qui a été manqué.

## Langue cible et clé transcript

- **Comptes** : le soumetteur (`canonical_job.user_id`) **et chaque watcher** — un
  watcher est un partage replié sur la même ingestion en vol ; sans lui, son partage
  serait le seul à attendre la première lecture. Les langues sont dédoublonnées : trois
  lecteurs francophones = une réservation.
- **Langue** : `reading_language` du compte, lue comme le fait le `review_blurb` à
  l'ingestion (`review_blurb_service._reading_language`), normalisée par
  `normalize_language_tag`. Pas de langue → rien (comme `/raw-content`).
- **Clé** : `transcription_s3_key` du job canonique (repli sur celle de l'événement).
  C'est celle que `/raw-content` résout via le ledger (`resolve_job_for_record`) pour
  *tous* les comptes : une traduction armée sous une autre clé serait payée pour rien.

## Une seule porte d'enqueue (AC #2, #4)

La paire « réservation atomique + `SendMessage` (+ `failed` transitoire si l'envoi
échoue) » qui vivait dans `raw_content_service._enqueue_translation_job` est extraite
dans `transcript_translation.reserve_and_dispatch_translation()`, supprimée de
`raw_content_service` et appelée par les deux déclencheurs. Elle renvoie un enum stable
`TranslationDispatchOutcome` (`enqueued`, `already_reserved`, `reservation_failed`,
`dispatch_failed`) ; le hook d'ingestion y ajoute `IngestionTranslationSkip`
(`not_needed`, `language_unknown`). La machine à états et la `ConditionExpression` de
task-203 sont inchangées et partagées : événement redélivré, `/raw-content` qui sonde
pendant que le hook tourne, ou hook après un `/raw-content` — le second lit le lock et
n'enqueue rien.

`/raw-content` garde tout son chemin paresseux (lecture d'état, `done` sans objet S3 →
`allow_done_retry`, échec permanent → pas de réservation, cache S3 hérité) : seul
l'appel final change. Il reste le filet pour un changement de langue après coup et pour
un partage dédoublonné d'un contenu **déjà traité** (celui-ci ne relance pas
d'ingestion, donc pas d'événement de complétion — c'est le cas « lecture par un autre
compte »). Les événements de log
`raw_content.translation_enqueued/_already_reserved/_reserve_failed/_enqueue_failed`
deviennent `translation.enqueued/already_reserved/reserve_failed/enqueue_failed` avec un
champ `trigger` (`raw_content` | `ingestion`). Aucun metric filter Terraform ne les lisait.

**Aucun changement Terraform** : le Lambda `media_completed_events` partage le rôle et
le bloc d'environnement de tous les workers (`runtime_env.tf`), qui portent déjà
`TRANSCRIPT_TRANSLATION_QUEUE`, `TRANSLATION_IDEMPOTENCE_TABLE`, `TRANSCRIPT_BUCKET`, le
`sqs:SendMessage` sur `transcript_translation` et la lecture S3 des transcripts.

Doc mise à jour : `docs/INGESTION_WORKERS_PROVIDERS.md` (deux déclencheurs, schéma du
pipeline, producteurs du worker, tableau des opérations de la machine à états).

## AC #6 — vérification contre les vrais DynamoDB/S3/SQS -dev (partielle, non cochée)

Script jetable hors dépôt (`/tmp`), région `eu-west-3`, profil AWS du projet, noms de
ressources repris de la config du Lambda `media-summarizer-worker-media_completed_events-dev`.
Appel du **vrai** `arm_transcript_translations` du worktree contre
`translation_idempotence-dev`, le bucket transcripts -dev et
`transcript-translation-queue-dev`, sur un transcript de sonde anglais déposé sous
`probe/414/<run>/transcript.txt` (sans tag source → détection par téléchargement S3 +
langdetect). **Seule la lecture de profil est bouchonnée** (comptes fictifs `fr`,
`FR-fr`, `en`, sans langue, plus un doublon), pour ne toucher à aucun compte réel.
Aucun appel à `/raw-content`. Sortie observée :

```
queue                    : transcript-translation-queue-dev
table                    : translation_idempotence-dev
probe transcript         : probe/414/0a53a654/transcript.txt (English, no source tag)
lock fr before           : None
queue depth before       : visible=0 in_flight=0
--- completion hook, savers fr + FR-fr + en + none (+dup fr)
results                  : {'fr': 'enqueued', 'en': 'not_needed'}
arm call returned in     : 0.74s
lock fr right after      : ('queued', False)
lock en (same language)  : None
queue depth right after  : visible=0 in_flight=1
--- redelivered event / second arm
results                  : {'fr': 'already_reserved'}
lock fr timeline (s)     : {('in_progress', True): 1.7, ('done', False): 20.6}
translated object        : probe/414/0a53a654/transcript.translated.fr.txt -> Aujourd'hui, on parle de comment les petites habitudes s'accumulent avec le temps. La prem ...
worker log events (probe): ['worker.translation_started']
--- arm again once done  : {'fr': 'already_reserved'}
cleanup                  : lock fr=None, s3 objects left=0
```

Ce qui est établi : le hook pose `queued` et envoie un message SQS, pris en charge par
le worker de traduction **déployé** en moins de 2 s (`in_flight=1`, lock `in_progress`
avec `worker_owner_id`, log `worker.translation_started`) ; la traduction atterrit en S3
et le lock passe `done` en ~20 s, **sans aucune lecture** (#1). `fr`, `FR-fr` et le
doublon donnent une seule réservation ; un second armement (événement redélivré) et un
armement après `done` répondent `already_reserved` sans message (#2) ; le lecteur `en`
sur un transcript anglais n'écrit aucun lock (#3) ; le compte sans langue n'arme rien.
Table et bucket laissés propres. Coût : une traduction GPT-5-nano de ~300 caractères.

**Pourquoi l'AC reste non coché** : le maillon « un partage » → consumer déployé → hook
n'a pas pu être exercé. Le Lambda `media_completed_events-dev` tourne encore l'image de
`main` : le branchement n'y existera qu'après merge et déploiement (push sur `main`),
bien après cette exécution. Tout ce qui est en aval du hook est prouvé ci-dessus contre
-dev ; l'appel du hook depuis `process_event` est câblé et typé (mypy propre).

**Vérification à faire par l'owner après déploiement** : partager un média dans une
langue différente de sa langue de lecture et **ne pas l'ouvrir**. Une fois le job
terminé :

1. `aws logs filter-log-events --region eu-west-3 --log-group-name /aws/lambda/media-summarizer-worker-media_completed_events-dev --filter-pattern '"translation.ingestion_armed"'`
   → `results: {"<langue>": "enqueued"}` avec le `job_id` du partage.
2. Avec le `transcript_s3_key` de ce log, calculer le fingerprint
   `python3 -c 'import hashlib,sys;print(hashlib.sha256(f"{sys.argv[1]}::{sys.argv[2]}".encode()).hexdigest())' <transcript_s3_key> <langue>`
   puis `aws dynamodb get-item --region eu-west-3 --table-name translation_idempotence-dev --key '{"translation_fingerprint":{"S":"<fingerprint>"}}'`
   → `status` `queued` / `in_progress` / `done`.
3. `aws logs filter-log-events --region eu-west-3 --log-group-name /aws/lambda/media-summarizer-worker-transcript_translation-dev --filter-pattern '"worker.translation_started"'`
   → la prise en charge du message, antérieure à toute ouverture du média.
4. Ouvrir le média : le texte doit être traduit d'emblée, sans pill « Traduction en
   cours… » (ou brièvement si l'ouverture suit le partage de moins de ~90 s).

## Limites

- **Aucun test automatisé ajouté** (AC #7, règle du projet) ; le script de l'AC #6 est
  jetable et non versionné.
- `ruff check media_summarizer/` : *All checks passed!* ; `mypy media_summarizer/` :
  *Success: no issues found in 193 source files* (AC #5).
- Coût : on traduit désormais chaque partage étranger, lu ou non (c'est la demande). Le
  plafond reste une traduction par couple (transcript, langue).
- Hors scope conservé : artefacts traduits à l'ouverture (task-395), et rien sous
  `mobile/` (sondage 60 s, task-415).
<!-- SECTION:NOTES:END -->
