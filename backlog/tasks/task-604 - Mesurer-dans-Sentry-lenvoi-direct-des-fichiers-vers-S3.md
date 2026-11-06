---
id: TASK-604
title: Mesurer dans Sentry l'envoi direct des fichiers vers S3
status: Done
assignee: []
created_date: '2026-11-06 14:19'
updated_date: '2026-11-06 14:37'
labels:
  - mobile
  - observability
dependencies: []
references:
  - mobile/src/services/presignedUpload.ts
  - mobile/src/services/localFileTransfer.ts
  - mobile/src/lib/crashReporting.ts
  - web/src/media/ingest.ts
priority: medium
type: task
ordinal: 211000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

## Constat (2026-11-06)

L'envoi d'un fichier vers S3 par adresse signée ne laisse aucune trace.

- **Côté mobile** : il passe par le module natif `uploadAsync` d'expo-file-system. Ni le traçage `fetch` ni le traçage XHR de Sentry ne le voient.
- **Côté serveur** : le serveur n'est pas dans la boucle.
- **Côté S3** : l'objet de transit a déjà disparu quand on enquête.

On ne voit l'envoi qu'en creux, dans les journaux de l'API : l'écart entre la délivrance de l'adresse d'envoi (`media.upload_url.issued`) et la déclaration du fichier (`media.upload.created`).

Cet écart n'est pas expliqué par la taille. Le 2026-11-06, les durées observées sont :

| Testeur | Fichier | Taille | Durée |
|---|---|---|---|
| Testeuse Android | 2e document | 527 Ko | environ 4 s |
| Testeuse Android | 1er document | 16,7 Mo | environ 22 s |
| Owner (iOS, 14:11 UTC) | photo | 350 Ko | **28 s** |

Pendant cet envoi, la vignette de l'import attend (voir la tâche sur l'ouverture de la page média pendant l'envoi). Pour savoir où passe le temps, il faut mesurer l'envoi lui-même : connexion lente, redirection, app en arrière-plan, lecture du fichier.

## Attendu

Chaque envoi direct vers S3 laisse une trace Sentry exploitable, réussi ou non, sur mobile et sur web.

Ne jamais envoyer à Sentry :
- l'adresse signée, qui vaut identifiant d'accès ;
- le nom du fichier : `sendDefaultPii` est à `false`.

## Note à l'owner (hors critères)

Après déploiement, refaire un import de photo et lire la trace dans Sentry : dataset `spans`, filtre sur l'opération choisie par la tâche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mobile : chaque envoi direct vers S3 (documents, audio, audio partagé) produit une trace Sentry portant sa durée, le nombre d'octets, le type de contenu, la cible d'envoi et le code de réponse HTTP.
- [x] #2 Mobile : un envoi qui échoue (réseau ou refus S3) produit la même trace, marquée en échec avec l'étape d'échec déjà calculée par `DirectUploadError`.
- [x] #3 La trace couvre séparément la lecture du fichier local et le PUT vers S3, pour distinguer un temps de lecture d'un temps de réseau.
- [x] #4 Mobile : la trace indique si l'app est passée en arrière-plan pendant l'envoi.
- [x] #5 Aucune trace ne contient l'adresse signée, sa query string ni le nom du fichier.
- [x] #6 Web : l'envoi direct vers S3 de l'app web produit la trace équivalente, avec les mêmes champs.
- [x] #7 Le nom de l'opération Sentry et la manière de retrouver ces traces sont documentés dans `docs/` à côté de la documentation Sentry existante.
- [x] #8 Le commit porte la ligne `Web: done` exigée par `scripts/check_web_parity.py`.
- [x] #9 `tsc` et le lint passent sans erreur dans `mobile/` et `web/`.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Mobile

`startUploadTrace` (`mobile/src/lib/crashReporting.ts`) opens one transaction per transfer, op `upload.s3`, with `forceTransaction`. `stageUpload` in `presignedUpload.ts` calls it, so it covers documents, audio and shared audio.

The transaction has three child steps:
- `upload.read_file`: `stageLocalFile`;
- `upload.sign`: `POST /api/media/upload-url`;
- `upload.put`: the native `uploadAsync`.

Root attributes:
- `upload.target`, `upload.content_type`, `upload.bytes`;
- `http.response.status_code`;
- `upload.backgrounded`, from an `AppState` listener open for the length of the transfer;
- on failure, `upload.failure_stage`: the `DirectUploadError` stage, or `sign` for an API refusal;
- `upload.s3_code`.

A failure ends the span with status `error`. `putToS3` now returns S3's status.

## Web

The web app had no Sentry at all. I added `@sentry/browser` 10.37.0, pinned exactly: it is the version already in the workspace through `@sentry/react-native`.
- `web/src/lib/crashReporting.ts`: `initCrashReporting` runs only when `VITE_SENTRY_DSN` is set. It uses `sendDefaultPii: false` and no automatic tracing, and HTTP breadcrumbs lose their query string.
- `addFile` in `web/src/media/ingest.ts` sends the same `upload.s3` root span with the same attributes. `upload.backgrounded` means the tab was hidden.
- The web trace has no `read_file` child, because the browser reads the `File` during the PUT, and no S3 code, because the web never read S3's body. Both differences are documented.
- New variable `VITE_SENTRY_DSN`, added to `web/.env.example`, `config.ts` and `vite-env.d.ts`.

## No secrets in a trace

Attributes are enums and figures only: no URL, no query string, no file name, no upload key.

## Documentation (AC #7)

The existing Sentry documentation is not under `docs/`: it is the "Crash Reporting (Sentry)" section of `mobile/MOBILE_CI_CD.md`. The new subsection "Custom spans: the direct upload of a file to S3 (task-604)" was put there, next to it, as the AC intends. It gives the span table, the attributes, and how to find the traces: Explore → Traces, `span.op:upload.s3`.

## Checks

- `tsc` is clean in mobile and web.
- eslint: no new issue.
- `vite build` passes.

## Owner follow-up (not ACs)

- Set `VITE_SENTRY_DSN` in the web build environment when the web app goes live (task-591): either the mobile project's DSN, or a dedicated web project.
- After deployment, import a photo and read the `upload.s3` trace.
<!-- SECTION:NOTES:END -->
