---
id: TASK-426
title: >-
  Benchmark du coût d'un modèle de transcription open source hébergé sur AWS à
  la place de Deepgram
status: To Do
assignee: []
created_date: '2026-10-04 19:16'
labels:
  - benchmark
  - pricing
  - transcription
dependencies: []
references:
  - docs/research/pricing-challenge/README.md
  - docs/research/task-231-transcript-formatting/README.md
  - docs/research/task-105-lambda-migration/README.md
  - media_summarizer/workers/transcription/deepgram_worker.py
  - docs/V1_LAUNCH_PLAN.md
priority: low
type: spike
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## La question de l'owner

« Combien ça nous ferait économiser de renoncer à Deepgram pour un modèle open source hébergé sur AWS ? »

**Ce benchmark sert à savoir, pas à décider une migration.** Aucune tâche d'implémentation ne lui est liée, et c'est voulu : l'owner veut un chiffre et un seuil. Si la conclusion justifie un jour une migration, une tâche d'implémentation sera créée à ce moment-là, à partir de ce README.

## Ce qu'on sait déjà (ne pas re-mesurer, citer)

Source : `docs/research/pricing-challenge/README.md` § 3.1 (facture Deepgram du 2026-04-03 au 2026-09-06) et § R.2 / R.3.

- **Tarif réellement facturé** : $0.26/h, soit 0,00373 €/min, sur une seule ligne `Nova-3 (Pre-recorded)`. La diarisation est **incluse** en pre-recorded (aucune ligne facturée pour 251,58 min transcrites avec `diarize=true`), et `detect_language=true` est facturé au tarif monolingue.
- **Volume réel** : environ 5,5 h transcrites en trois mois.
- **Crédit d'inscription Deepgram non entamé** : $197,06, soit environ 764 h d'audio.
- **Poids dans le coût** : la transcription représente environ 93 % du coût d'une heure de podcast (0,2222 € sur 0,2386 € avec les cinq artefacts demandés).
- **Scénarios de volume en discussion** : palier Standard ≈ 6 h d'audio par mois ; palier haut envisagé à ≈ 40 h par mois (14,99 €). Commission store : 15 % (Small Business Program accordé, `docs/V1_LAUNCH_PLAN.md` § 2).

## Ce que le dépôt impose

- **Backend Lambda uniquement** (task-105) : pas de GPU dans Lambda, et `openai-whisper` a été retiré parce qu'il tirait PyTorch (2 Go et plus). Un modèle auto-hébergé suppose donc un autre runtime (EC2, ECS GPU, AWS Batch, SageMaker asynchrone…), avec ce que ça ajoute en Terraform et en exploitation.
- **Région** : `eu-west-3` (Paris). Vérifier la disponibilité et le prix des instances GPU **dans cette région**, et le coût d'un transfert si elles n'y sont pas.
- **Le viewer de transcript dépend de la sortie Deepgram** : `docs/research/task-231-transcript-formatting/README.md` et `media_summarizer/workers/transcription/deepgram_worker.py`. Paragraphes, horodatage par mot et locuteurs viennent aujourd'hui de Deepgram.
- **11 langues V1**, avec détection automatique de la langue.

## Ce qu'il faut comparer

1. **Les modèles** : au minimum Whisper large-v3 (et sa variante turbo) via faster-whisper ou WhisperX, et tout modèle open source plus récent que la recherche juge pertinent. Qualité sur les 11 langues, diarisation (pyannote ou équivalent), horodatage par mot.
2. **Les modes d'hébergement sur AWS** : GPU allumé en permanence, et GPU démarré à la demande avec extinction (Spot compris), avec le temps de démarrage à froid.
3. **Deux repères hors auto-hébergement**, pour situer le chiffre : AWS Transcribe, et au moins une API hébergée d'un modèle open source.

Pour chaque option : coût vérifié par heure d'audio (prix relevés et datés, pas de mémoire), coût fixe mensuel, délai de bout en bout pour un podcast d'une heure, travail d'adaptation (format du transcript, diarisation), et charge d'exploitation pour un développeur seul.

## Le livrable attendu

Un chiffre d'économie mensuelle pour chaque scénario de volume : le volume actuel, 100 abonnés Standard à 40 % d'usage, et 100 abonnés au palier haut à 40 % d'usage. Il doit tenir compte du crédit Deepgram restant. Il faut aussi un **seuil de déclenchement** : à partir de combien d'heures d'audio par mois l'auto-hébergement devient rentable, coûts d'exploitation inclus.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Un fichier docs/research/task-426-self-hosted-transcription-cost/README.md existe avec owner_decision: pending dans son front-matter et les sections Owner Validation, Recommendation et Sources.
- [ ] #2 Chaque prix cité (instances GPU dans eu-west-3, Spot, AWS Transcribe, API hébergée) porte sa source et sa date de consultation ; aucun prix n'est donné de mémoire.
- [ ] #3 Le README donne, pour chaque option comparée, le coût par heure d'audio, le coût fixe mensuel, le délai pour un podcast d'une heure et la prise en charge de la diarisation, de l'horodatage par mot et des 11 langues V1.
- [ ] #4 Le README chiffre l'économie mensuelle par rapport à Deepgram pour trois volumes (volume actuel, 100 abonnés Standard à 40 % d'usage, 100 abonnés au palier haut à 40 % d'usage) en tenant compte du crédit Deepgram restant.
- [ ] #5 Le README énonce un seuil de déclenchement en heures d'audio par mois, coûts d'exploitation inclus, au-delà duquel l'auto-hébergement devient rentable.
- [ ] #6 Le README indique ce que la migration casserait ou obligerait à refaire dans le viewer de transcript (task-231) et dans deepgram_worker.py, en citant les fichiers et les lignes.
<!-- AC:END -->
