---
id: TASK-603
title: >-
  Ouvrir la page média depuis une vignette dont le fichier est encore en cours
  d'envoi
status: Done
assignee: []
created_date: '2026-11-06 14:19'
updated_date: '2026-11-06 14:29'
labels:
  - mobile
  - ux
dependencies: []
references:
  - mobile/src/components/HomeTile.tsx
  - mobile/src/lib/pendingSaves.ts
  - mobile/app/(tabs)/inbox.tsx
  - mobile/src/contexts/ShareIntentContext.tsx
  - mobile/src/services/presignedUpload.ts
  - 'mobile/app/media/[id].tsx'
  - web/src/media/ingest.ts
priority: high
type: bug
ordinal: 210000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

## Constat (2026-11-06)

Des testeurs touchent la vignette de leur premier import, qui s'affiche dans « Ajouts récents » avec l'animation de chargement, et rien ne se passe. Le comportement attendu, et déjà en place une fois le média créé côté serveur, est que le toucher ouvre la page média avec ses spinners et ses textes d'attente.

- **Une testeuse (Android, 2026-11-06 11:15 UTC)** : premier document, une photo de 16,7 Mo. Entre l'adresse d'envoi délivrée (11:15:51.8) et la déclaration du fichier (11:16:13.2), environ 22 s passent. Sa page n'a jamais été ouverte.
- **Reproduction par l'owner (iOS, 2026-11-06 14:11 UTC, compte de test de l'owner)** : une photo de la photothèque de 350 Ko, avec 28 s d'envoi pendant lesquelles la vignette ne répondait pas.

## Cause

Un import se déroule en deux étapes.

1. **Envoi du fichier vers S3.** Le média n'existe pas encore côté serveur. L'app dessine une vignette d'attente sans identifiant (`pendingSaves`, task-568), désactivée (`disabled` sur la `Pressable` de `HomeTile`). Elle a la même apparence qu'une vignette en traitement.
2. **Traitement.** Le serveur a répondu à la déclaration du fichier et le média existe. La vignette s'ouvre normalement.

Pour un lien, l'étape 1 dure environ une seconde, ce qui explique que le défaut passe inaperçu. Pour un fichier, elle dure de 5 à 30 s.

## Décision de l'owner (2026-11-06) : correction côté app

Toucher une vignette ouvre toujours la page média, y compris pendant l'étape 1. La page affiche alors un état « envoi du fichier », puis prend le média réel dès que le serveur répond.

L'option serveur a été écartée : créer le média dès la demande d'adresse d'envoi. Ne pas la mettre en œuvre, ni modifier les points d'entrée `/api/media/upload-url`, `/upload` et `/upload-audio`, pour trois raisons :
- l'identité du média (`media_key`) et la reconnaissance d'un fichier déjà importé reposent sur l'empreinte du contenu, lisible seulement une fois le fichier dans S3 ;
- le contrôle du budget se fait à la déclaration du fichier ;
- il faudrait purger les médias dont l'envoi n'aboutit jamais.

Cas à couvrir :
- le serveur renvoie l'identifiant d'un média **déjà existant** (fichier déjà importé) : la page ouverte doit prendre ce média-là ;
- l'envoi **échoue** pendant que la page est ouverte ;
- les **liens et contenus partagés**, qui passent par la même vignette d'attente pendant leur courte étape 1.

## Parité web

Le web envoie aussi ses fichiers par adresse signée (`web/src/media/ingest.ts`). Établir ce que le web affiche pendant l'envoi, puis lui donner le même comportement : un import en cours d'envoi s'ouvre au clic dans un état « envoi », puis prend le média réel.

## Note à l'owner (hors critères)

Vérification manuelle sur appareil à faire après déploiement :
- importer une photo et toucher sa vignette pendant l'envoi ;
- répéter avec un fichier déjà importé ;
- répéter avec un envoi coupé, en mode avion pendant l'envoi.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mobile : toucher la vignette d'un import dont l'ingestion n'a pas encore répondu ouvre la page média au lieu d'être sans effet ; la `Pressable` de la vignette d'attente n'est plus désactivée.
- [x] #2 Mobile : pendant l'envoi, la page média affiche un état « envoi du fichier » distinct des états de traitement existants, avec des libellés présents dans toutes les langues de l'app.
- [x] #3 Mobile : quand l'ingestion répond, la page ouverte affiche le média correspondant sans action de l'utilisateur ni retour arrière, y compris quand l'identifiant renvoyé est celui d'un média déjà existant.
- [x] #4 Mobile : quand l'envoi échoue, la page ouverte affiche l'échec et permet d'en sortir ; l'erreur n'est pas annoncée deux fois (alerte existante et page).
- [x] #5 Mobile : pendant l'envoi, la page ne propose aucune action qui exige un média existant (suppression, dossier, chat, partage) et n'émet aucune requête vers `/api/media/<id>` avec l'identifiant provisoire.
- [x] #6 Aucun point d'entrée serveur n'est modifié (`media_summarizer/` inchangé).
- [x] #7 Web : le comportement de l'app web pendant l'envoi d'un fichier est établi et décrit dans les notes de la tâche, et un import en cours d'envoi s'y ouvre au clic dans un état « envoi » qui prend le média réel à la réponse.
- [x] #8 Le commit porte la ligne `Web: done` exigée par `scripts/check_web_parity.py`.
- [x] #9 `tsc` et le lint passent sans erreur dans `mobile/` et `web/`.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Web behaviour before this task (AC #7)

`AddSourceDialog` stayed open and modal for the whole PUT to S3: the submit button read "Uploading…", Cancel and Close were disabled, and no tile or row existed for the import until `/api/media/upload` answered. There was nothing to click.

## Mobile

- `mobile/src/lib/pendingSaves.ts`: keys are now `pending-N` (`isPendingSaveKey`). Each submission records an outcome (`sending` → `created(mediaItemId)` | `failed(message)`), which outlives the vignette entry. `failPendingSave` replaces `dropPendingSave` on failure and tells whether a media page is open on the key (`watchPendingSave`).
- `HomeTile`: the provisional vignette is no longer `disabled`. It pushes `/media/pending-N`.
- `app/media/[id].tsx`: a pending key renders `PendingSaveDetailView`. That view shows a spinner with "Uploading your file…" (documents and audio) or "Sending to your library…" (links and shared text) and a hint, and offers only the back arrow. It sends no API request. When the import is created, `router.setParams({ id })` swaps in the real id (including an existing media for a deduplicated file) without pushing a screen. On failure, it shows the message and a Back button.
- `ShareIntentContext.reportSaveFailed`: the alert is skipped when a page is open on the import, so the error is said once.
- New core keys `media.sending.{file,other,hint,lost}` in all 11 catalogues.

## Web

- `web/src/media/pendingImports.ts`: the same outcome store for file imports.
- `AddSourceDialog`: while a file uploads, Cancel becomes "Open its page" (`add.openWhileUploading`, 11 web catalogues). The button opens `/media/pending-N` and closes the dialog, and the upload carries on.
- `MediaPage`: a pending key shows the "uploading" state card. When the import is created, the page replaces itself with `/media/<id>`. On failure, it shows the message and Back. The page sends no API call with the key.

## Unchanged

No server code (`media_summarizer/` untouched).

## Checks

- `tsc` is clean in mobile, web and core.
- eslint is clean in web and core. Mobile has one pre-existing warning in `purchaseService.ts`.
- `vite build` passes.

Device check is the owner's (see description).
<!-- SECTION:NOTES:END -->
