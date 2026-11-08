---
id: TASK-620
title: >-
  Unifier la limite de taille des audios à 250 MB et transcrire les audios S3
  sans les charger en mémoire
status: Done
assignee: []
created_date: '2026-11-08 18:25'
updated_date: '2026-11-08 18:45'
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
- [x] #1 Une seule constante backend fixe la taille maximale de l'audio (250 MB), appliquée à l'upload `audio` comme à `shared_audio` ; les documents restent à 50 MB
- [x] #2 `MAX_SHARED_AUDIO_SIZE_BYTES`, `MAX_AUDIO_SIZE_MB` et `validate_audio_url` n'existent plus dans le code, `.env.example`, Terraform ni la doc (`grep` vide)
- [x] #3 Les constantes de `packages/core` valent exactement les valeurs backend (audio 250 MB, documents 50 MB), et les enregistreurs audio web et mobile lisent la limite audio
- [x] #4 Pour un audio stocké sur S3, le worker Deepgram transmet une URL GET présignée (mode pull) et n'appelle plus `download_file_to_memory` sur ce fichier
- [x] #5 Chaque autre lecture d'un audio entier en mémoire (notes vocales de conversation, sondage de durée sur octets) est traitée ou justifiée par écrit dans les notes de la tâche
- [x] #6 Les plafonds de durée par formule (`max_minutes_per_item`, `item_limits.audio_minutes`) sont inchangés
- [x] #7 `docs/CANONICAL_MEDIA_API_CONTRACT.md` décrit les nouveaux plafonds
- [x] #8 `ruff`, `mypy` et le typecheck TypeScript de `packages/core`, `web` et `mobile` passent ; `terraform validate` passe si Terraform est modifié
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Limites (AC1, AC3)** : `media.py` définit `MAX_DOCUMENT_UPLOAD_SIZE_BYTES` (50 MB) et `MAX_AUDIO_UPLOAD_SIZE_BYTES` (250 MB). `_max_upload_bytes_for` applique la limite audio à `audio` comme à `shared_audio`. Ce sont des constantes, plus des variables d'environnement, parce que le client les reprend à l'identique : une surcharge ne ferait que déplacer le refus. `packages/core/src/types/upload.ts` porte les deux mêmes valeurs et `maxUploadSizeBytes(kind)` ; `validateLocalUpload` choisit selon le type de fichier, et `sharedContent.ts` utilise la limite audio. Les deux `AudioNoteRecorder` (web et mobile) lisent `MAX_AUDIO_UPLOAD_SIZE_BYTES`. Les messages de taille sont déjà paramétrés (`{max}`) dans les 11 langues : aucun texte à changer.

**Code mort (AC2)** : `core/validators.py` supprimé en entier (`validate_audio_url`, `MAX_AUDIO_SIZE_MB` ; aucun import). Dans `.env.example`, `MAX_AUDIO_SIZE_MB`, `MAX_UPLOAD_SIZE_BYTES` et `MAX_SHARED_AUDIO_SIZE_BYTES` sont retirés, ainsi que trois autres variables lues nulle part (`MAX_AUDIO_DURATION`, `MAX_FILE_SIZE` qui annonçait « 100 MB uploads », `DOWNLOAD_TIMEOUT_SECONDS` que seul `validators.py` lisait). Aucune entrée Terraform. Le `grep` des trois noms est vide hors `backlog/`. `scripts/check_env_example_complete.py` : OK.

**Mode pull (AC4)** : `call_deepgram_api_on_s3_audio` présigne un GET d'une heure sur `AUDIO_BUCKET` et appelle `call_deepgram_api`. Deepgram récupère le fichier pendant la requête, que borne `DEEPGRAM_TIMEOUT_SECONDS` (300 s). L'URL présignée n'est jamais journalisée : `log_audio_url` (`s3://bucket/key`) la remplace dans la ligne de log et dans le texte fournisseur que portent les erreurs. L'audio S3 principal ne passe plus par `download_file_to_memory` ; `_resolve_audio_content_type`, devenu inutile, est supprimé. Vérifié sur dev : le bucket audio n'a pas de bucket policy et est en SSE-S3, et une URL présignée du code sur un vrai `.m4a` renvoie `206 audio/mp4` depuis l'extérieur d'AWS.

**Autres lectures en mémoire (AC5)** :
- Notes vocales d'une conversation partagée (`_transcribe_voice_note`) : **traitées**, passées au même mode pull. Rien ne les borne sous les 250 MB, et ce chemin unique garde tout audio du bucket hors de la mémoire de la Lambda.
- Sondage de durée sur octets (`resolve_audio_duration_seconds(audio_bytes=…)`, `probe_duration_seconds_from_bytes`) : **supprimé**, c'était du code mort (aucun appelant de `gate_audio_transcription` ne passait `audio_bytes`). Un audio importé est déjà sondé par requêtes Range sur un GET présigné (`_probe_staged_audio_duration`).
- **Justifié, inchangé** : le repli push de `_download_audio_for_push_fallback` charge en mémoire un audio d'une **URL tierce** (CDN qui bloque Deepgram, réseaux sociaux), plafonné à 250 MB (`_PUSH_MODE_MAX_BYTES`). Il ne concerne jamais un fichier de notre bucket, donc aucun upload : il sort du périmètre de cette tâche. Risque existant à noter : la taille n'est vérifiée qu'après le téléchargement complet.
- Le plan de conversation lu en mémoire (`TRANSCRIPT_BUCKET`) est du JSON, pas de l'audio.

**AC6** : `beta_budget`, `pricing_config_service` et les plafonds `max_minutes_per_item` ne sont pas touchés (le diff ne les cite que dans des commentaires).

**AC7** : `CANONICAL_MEDIA_API_CONTRACT.md` décrit les deux plafonds, le 413, la durée comme règle produit et le mode pull. `whatsapp-share-payload-shapes.md` est aligné.

**AC8** : `ruff` et `mypy` propres sur les 4 fichiers Python ; `tsc` de `packages/core`, `web` et `mobile` à 0 ; eslint propre sur les fichiers TS touchés. Terraform n'est pas modifié. Sans rapport avec les AC : le PUT présigné garde ses 900 s, car S3 vérifie l'expiration au début de la requête, et un envoi de 250 MB commencé à temps aboutit.

**Owner (après déploiement)** : importer un mp3 d'une heure et partager un m4a d'une heure sur dev, puis vérifier la transcription de bout en bout ; ensuite passer la suggestion Canny en `complete`.
<!-- SECTION:NOTES:END -->
