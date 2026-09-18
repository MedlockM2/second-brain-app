---
id: TASK-406
title: >-
  Supprimer les résidus morts du consommateur d'événements de complétion de
  média
status: To Do
assignee: []
created_date: '2026-09-18 14:47'
labels:
  - cleanup
dependencies: []
references:
  - >-
    commit 67e8112 — fix(transcription): stop announcing a Deepgram
    transcription twice
modified_files:
  - media_summarizer/workers/events/media_completed_worker.py
  - media_summarizer/workers/transcription/deepgram_worker.py
  - media_summarizer/core/models/processing_job.py
  - media_summarizer/core/services/media_purge_service.py
priority: medium
type: chore
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le correctif du double push (commit 67e8112) a supprimé la publication legacy `episode_completed`, qui était le dernier producteur d'une série de champs que le consommateur lit encore : `episode_guid`, `media_title`/`episode_title` et `summary_s3_key`. Ces lectures ressemblent à un contrat vivant alors qu'aucune ne peut plus se déclencher. C'est exactement ce brouillard qui a laissé le double envoi d'événements invisible à travers plusieurs tâches (task-124 l'a introduit, task-147 a rendu son jumeau canonique acceptable, personne n'a vu qu'il y en avait deux) : un relecteur ne distingue pas le code inerte du code actif, donc il ne peut pas voir qu'un chemin tourne deux fois.

Une conséquence réelle à trancher au passage, et la raison pour laquelle la tâche n'est pas seulement cosmétique : plus rien n'écrit `job.summary_s3_key`, alors que la suppression de compte le lit pour purger les objets correspondants du bucket de résumés (`media_purge_service`). Cette purge est donc un no-op silencieux. Il faut décider si le champ est un résidu à supprimer, ou un besoin dont l'écriture a été perdue en route — la réponse change ce que la suppression de compte doit faire, et l'exhaustivité d'une suppression de compte compte avant le lancement.

Note pour l'owner : il n'y a rien à déployer ni à vérifier en runtime, le résultat est entièrement lisible en statique. Attention en revanche à `SUMMARY_BUCKET` : la variable reste lue par `artifact_service`, seule son usage dans le consommateur est mort.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le consommateur `media_completed_worker` ne lit plus aucun champ qu'aucun producteur d'événement de complétion n'envoie, et les branches qui dépendaient de ces champs ont disparu.
- [ ] #2 `_load_summary_content` et la constante `SUMMARY_BUCKET` du module consommateur sont supprimées, et un grep sur le dépôt ne renvoie plus aucune référence à ces deux symboles.
- [ ] #3 `EPISODE_COMPLETED_EVENTS_QUEUE` n'est assignée qu'une seule fois dans `deepgram_worker.py`.
- [ ] #4 Le sort de `ProcessingJob.set_summary_location` et du champ `summary_s3_key` est tranché, l'arbitrage est écrit dans les Implementation Notes de la tâche, et le chemin de purge de `media_purge_service` est rendu cohérent avec cette décision.
- [ ] #5 `SUMMARY_BUCKET` reste injectée par Terraform et lue par `artifact_service` : ni la variable d'environnement ni le bucket ne sont touchés.
- [ ] #6 `ruff check media_summarizer/` passe, et `mypy` ne signale aucune nouvelle erreur sur les fichiers modifiés.
<!-- AC:END -->
