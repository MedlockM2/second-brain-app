---
id: TASK-620
title: >-
  Unifier la limite de taille des audios à 250 MB et transcrire les audios S3
  sans les charger en mémoire
status: To Do
assignee: []
created_date: '2026-11-08 18:25'
labels:
  - ingestion
  - backend
dependencies: []
references:
  - >-
    https://second-brain-labs.canny.io/feature-requests/p/accepter-les-audios-dune-heure-100-mb
  - media_summarizer/api/endpoints/media.py
  - media_summarizer/core/validators.py
  - media_summarizer/workers/transcription/deepgram_worker.py
  - media_summarizer/core/services/audio_quota_gate.py
  - media_summarizer/core/services/beta_budget.py
  - media_summarizer/core/services/pricing_config_service.py
  - packages/core/src/types/upload.ts
  - packages/core/src/types/sharedContent.ts
  - web/src/components/AudioNoteRecorder.tsx
  - mobile/src/components/AudioNoteRecorder.tsx
  - infrastructure/terraform/modules/platform/lambda_workers.tf
  - .env.example
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: enhancement
ordinal: 226000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Suggestion Canny du 2026-11-07, « Accepter les audios d'une heure - 100 MB » (https://second-brain-labs.canny.io/feature-requests/p/accepter-les-audios-dune-heure-100-mb, 1 vote, sans description) : un testeur ne peut pas importer un audio d'une heure.

L'audio a aujourd'hui trois limites de taille différentes, sans justification écrite :
- **audio importé** (`UploadTarget.AUDIO`) : 50 MB, `MAX_UPLOAD_SIZE_BYTES` (`media_summarizer/api/endpoints/media.py:143`, `packages/core/src/types/upload.ts:119`). Cette limite vient du parsing de documents (task-91), et l'audio en a hérité ;
- **audio partagé vers l'app** (`UploadTarget.SHARED_AUDIO`) : 25 MB, `MAX_SHARED_AUDIO_SIZE_BYTES` (`media.py:146`, `packages/core/src/types/sharedContent.ts:64`). C'est vraisemblablement la limite de l'API Whisper, un reste antérieur à Deepgram ;
- **audio par URL** : 500 MB, `MAX_AUDIO_SIZE_MB` (`media_summarizer/core/validators.py:14`). C'est du code mort : `validate_audio_url` n'est appelée nulle part.

Ce qui borne réellement le coût, c'est la durée : `item_limits.audio_minutes` / `max_minutes_per_item` par formule (60 / 180 / 240 min), appliqué dans `beta_budget.transcription_line` à partir de la durée sondée. La taille ne dépend que de l'encodage : une heure fait ~29 MB en m4a 64 kbps, ~58 MB en mp3 128 kbps. Un audio que la formule de l'utilisateur autorise est donc refusé pour une question de format.

Décision de l'owner (2026-11-08) :
- une seule limite de taille pour tout l'audio (importé, partagé, enregistré), à **250 MB**, soit environ 240 min (le plus haut plafond de durée) à 128 kbps ;
- les documents restent à 50 MB ;
- le code mort est supprimé ;
- **les plafonds de durée par formule ne changent pas** : la taille n'est qu'un garde-fou technique, et la règle produit reste la durée.

## Contrainte mémoire : passer la transcription S3 en mode pull

`deepgram_worker.py:761` charge l'audio S3 entier en mémoire (`s3.download_file_to_memory`), puis le pousse à Deepgram (mode push). La Lambda `deepgram_transcription` a 512 MB (`lambda_workers.tf:64`). Un fichier de 250 MB, avec ses copies, ne passera pas. Le mode pull existe déjà pour les audios par URL : pour un audio S3, le worker donne à Deepgram une URL GET présignée au lieu des octets. Le même problème touche les notes vocales d'une conversation partagée (`deepgram_worker.py:1005`) et le sondage de durée sur octets (`audio_quota_gate.py:91`) : tout chemin qui lit un audio entier en mémoire doit être recensé, puis traité ou justifié (par exemple une note vocale, petite par nature).

## Périmètre

- Backend : une constante unique pour l'audio (par ex. `MAX_AUDIO_UPLOAD_SIZE_BYTES` = 250 MB), appliquée par `_max_upload_bytes_for` à `AUDIO` et à `SHARED_AUDIO`. `MAX_UPLOAD_SIZE_BYTES` ne garde que les documents (son nom peut devenir explicite). `MAX_SHARED_AUDIO_SIZE_BYTES`, `MAX_AUDIO_SIZE_MB` et `validate_audio_url` sont supprimés, ainsi que leurs entrées dans `.env.example` et dans `runtime_env.tf` s'il y en a.
- `packages/core` : les mêmes valeurs côté client (`upload.ts`, `sharedContent.ts`), pour que l'app refuse avant le réseau exactement ce que le serveur refuse. Les enregistreurs audio web et mobile (`AudioNoteRecorder.tsx`) suivent la limite audio, pas celle des documents.
- Worker : transcription S3 en mode pull via URL présignée, avec une durée de validité suffisante pour que Deepgram récupère le fichier.
- Doc : `docs/CANONICAL_MEDIA_API_CONTRACT.md` (§ plafonds d'upload) à jour.
- Messages d'erreur de taille : ils affichent la nouvelle limite dans les 11 langues, sans texte à reformuler si le montant est paramétré.

## Notes pour l'owner (hors AC)

- Après déploiement : importer un mp3 d'une heure (~58 MB) et partager un m4a d'une heure depuis WhatsApp ou Fichiers, sur dev, et vérifier la transcription de bout en bout.
- Une fois livré, passer la suggestion Canny en `complete`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Une seule constante backend fixe la taille maximale de l'audio (250 MB), appliquée à l'upload `audio` comme à `shared_audio` ; les documents restent à 50 MB
- [ ] #2 `MAX_SHARED_AUDIO_SIZE_BYTES`, `MAX_AUDIO_SIZE_MB` et `validate_audio_url` n'existent plus dans le code, `.env.example`, Terraform ni la doc (`grep` vide)
- [ ] #3 Les constantes de `packages/core` valent exactement les valeurs backend (audio 250 MB, documents 50 MB), et les enregistreurs audio web et mobile lisent la limite audio
- [ ] #4 Pour un audio stocké sur S3, le worker Deepgram transmet une URL GET présignée (mode pull) et n'appelle plus `download_file_to_memory` sur ce fichier
- [ ] #5 Chaque autre lecture d'un audio entier en mémoire (notes vocales de conversation, sondage de durée sur octets) est traitée ou justifiée par écrit dans les notes de la tâche
- [ ] #6 Les plafonds de durée par formule (`max_minutes_per_item`, `item_limits.audio_minutes`) sont inchangés
- [ ] #7 `docs/CANONICAL_MEDIA_API_CONTRACT.md` décrit les nouveaux plafonds
- [ ] #8 `ruff`, `mypy` et le typecheck TypeScript de `packages/core`, `web` et `mobile` passent ; `terraform validate` passe si Terraform est modifié
<!-- AC:END -->
