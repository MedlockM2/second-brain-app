---
id: task-393
title: >-
  Fonder l'identité d'un fichier envoyé sur son contenu réel plutôt que sur son
  nom et sa taille
status: To Do
assignee: []
created_date: '2026-09-10 12:36'
labels:
  - backend
  - ingestion
  - media_identity
dependencies:
  - task-392
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Les fichiers envoyés par l'utilisateur ne sont **pas** mutualisés entre comptes, et c'est voulu : leur identité de contenu porte le compte (`api/endpoints/media.py`, `media_key = f"doc:{user.id}:{file_name}:{staged.size_bytes}"` et `f"audio:{user.id}:..."`). Un document privé ne traverse donc jamais les comptes. Cette isolation est confirmée par le propriétaire et doit être conservée.

Le défaut est **à l'intérieur d'un compte** : `nom de fichier + taille en octets` n'identifie pas un contenu. Deux documents différents qui portent le même nom et font la même taille sont confondus — l'utilisateur retrouve le mauvais document. Symétriquement, le même document renvoyé sous un autre nom est traité comme neuf et repayé.

## La brique existe déjà, à un seul endroit

Le chemin de partage audio utilise une empreinte réelle (`api/endpoints/media.py`, autour de la ligne 1820) : *"A single-part PUT under SSE-S3 gives an ETag that is the MD5 of the body, so the API keeps a real content identity — the same share sent twice still lands on the same `media_key` — without ever holding the bytes to hash them."* Les deux autres chemins d'upload sont restés sur `nom:taille`.

Il s'agit donc de **généraliser un mécanisme déjà en place**, pas d'en concevoir un.

## Contrainte à respecter

L'API ne voit jamais les octets : l'envoi se fait par URL présignée directement vers S3. L'empreinte vient donc de S3 ou du client, jamais d'un hash calculé côté serveur. L'implémenteur doit vérifier ce que devient l'ETag pour un envoi multi-part ou sous chiffrement KMS, où il cesse d'être le MD5 du corps, et traiter ce cas plutôt que de supposer le cas simple.

## Périmètre

Tous les chemins d'envoi de fichier : documents et audio. L'identité de contenu d'un fichier reste scopée au compte et devient fondée sur le contenu réel. Aucune migration des envois existants : rien n'est déployé en production.

## Notes au propriétaire (hors critères d'acceptation)

Vérification manuelle après déploiement : envoyer deux fois le même fichier sous deux noms différents (un seul média attendu), puis deux fichiers différents portant le même nom et la même taille (deux médias attendus).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les chemins d'envoi de documents et d'audio dérivent l'identité de contenu d'une empreinte du contenu réel du fichier, et non de son nom ni de sa taille.
- [x] #2 L'identité de contenu d'un fichier envoyé reste scopée au compte : deux comptes envoyant le même fichier ne partagent ni contenu ni artefacts.
- [x] #3 Deux fichiers de contenus différents portant le même nom et la même taille produisent deux identités distinctes ; le même fichier envoyé sous deux noms différents en produit une seule.
- [x] #4 Le cas où l'empreinte fournie par S3 n'est pas celle du corps du fichier est traité explicitement plutôt que supposé absent, et la façon dont il est traité est documentée dans les notes d'implémentation.
- [x] #5 ruff et mypy passent sans erreur sur les modules touchés.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Ce qui a changé

**1. La recette d'identité vit dans `core/services/media_identity.py`**, à côté de celle des
articles posée par task-392 : `UPLOAD_CONTENT_IDENTITY_VERSION`, `UploadedFileKind`
(`document` / `audio`) et `generate_uploaded_file_media_key(kind, owner_user_id,
content_fingerprint)`. Le locator haché est `upload:v1:<kind>:<owner>#content=<empreinte>`. Le
compte est **dans** la matière hachée : c'est ce qui garde un fichier privé hors des autres comptes
(AC #2), à l'opposé exact d'une URL publique dont l'identité est l'URL seule, précisément pour que
tout le monde partage un traitement. Le `kind` y est aussi : les mêmes octets soumis comme document
sont parsés, comme audio ils sont transcrits — deux pipelines, donc deux médias.

**2. L'empreinte est dérivée une seule fois, dans `_resolve_staged_upload`** (`api/endpoints/media.py`),
donc les trois chemins d'envoi (`/upload`, `/upload-audio`, `/ingest-shared-content`
`share_type=audio`) la partagent. `StagedUpload.etag` devient `StagedUpload.content_fingerprint`,
étiquetée par algorithme (`md5-<hex>`, `crc64nvme-<hex>`…) : deux empreintes des mêmes octets prises
avec deux algorithmes ne peuvent jamais se comparer égales par accident.

**3. Les anciennes clés `nom:taille` sont supprimées**, pas doublées : `doc:{user}:{nom}:{taille}` et
`audio:{user}:{nom}:{taille}` n'existent plus. Aucune migration (rien n'est déployé), aucun fallback
— retomber sur nom+taille quand l'empreinte manque réintroduirait exactement le défaut corrigé.

**4. L'audio partagé était mutualisé entre comptes** : son locator `share://{plateforme}/audio/{hash}`
ne portait pas de compte, et l'idempotence du pipeline est globale par `media_key`. Deux comptes
partageant la même note vocale privée réutilisaient donc le même job et la même transcription.
`_share_locator` (`core/media_ingestion/use_cases.py`) prend désormais un `owner_user_id` pour un
**fichier** partagé. Le texte partagé garde un locator non scopé : ce n'est pas un envoi de fichier,
il est hors périmètre de cette tâche (et l'axe mutualisation est celui de task-394).

**5. `utils/s3.py` : `head_object` est appelé avec `ChecksumMode="ENABLED"`**, sinon S3 omet les
champs `Checksum*` — ceux dont dépend le repli de l'AC #4.

**6. Terraform** : SSE-S3 (`AES256`) est désormais **déclaré** sur les buckets `documents` et `audio`
(`modules/platform/s3.tf`) au lieu d'être hérité du défaut du compte. L'invariant « l'ETag est le MD5
du corps » devient une propriété écrite dans l'infra, et passer un de ces buckets sur une clé KMS
devient visiblement une décision sur l'identité de contenu, pas un détail de stockage.

### AC #4 — le cas où l'empreinte S3 n'est pas celle du corps

L'API ne voit jamais les octets, donc l'empreinte vient de S3. Deux sources, dans cet ordre
(`_upload_content_fingerprint`) :

1. **L'ETag**, uniquement quand il est réellement le MD5 du corps : 32 hex, sans suffixe `-<n>`, et
   objet stocké en clair ou sous SSE-S3 (`ServerSideEncryption` absent ou `AES256`, pas de
   `SSECustomerAlgorithm`). C'est le cas de tous nos envois — une URL présignée n'autorise que
   `PutObject`, donc mono-part, et les buckets épinglent SSE-S3.
2. **Un checksum additionnel couvrant l'objet entier** (`ChecksumSHA256`, `ChecksumSHA1`,
   `ChecksumCRC64NVME`, `ChecksumCRC32C`, `ChecksumCRC32`), décodé du base64 vers l'hex pour rester
   utilisable dans une clé S3. Pris sur le clair, donc valable sous n'importe quel chiffrement.

Les cas où le digest de S3 **n'est pas** fonction du corps sont refusés, jamais devinés : un digest
calculé partie par partie (suffixe `-<n>`, ou `ChecksumType: COMPOSITE`) dépend du découpage du
transfert ; un ETag sous SSE-KMS / DSSE-KMS / SSE-C est un digest du chiffré. Le résultat est alors
l'énum stable `UploadFingerprintFailure` (`upload_fingerprint_multipart`,
`upload_fingerprint_encrypted`, `upload_fingerprint_missing`), l'objet staged est supprimé, un
`media.upload.fingerprint_unavailable` est loggé en ERROR avec le mode de chiffrement, et le client
reçoit `422` + header `X-Upload-Error-Code`. Refuser bruyamment est le bon échec : la seule
alternative serait une clé qui n'identifie pas le contenu, c'est-à-dire le bug d'origine.

**Vérifié contre le vrai S3 `-dev`** (bucket `media-summarizer-documents-125313707865-dev`, objets de
sonde supprimés après coup), avec un PUT présigné brut via `curl`, sans en-tête de checksum :

| envoi | ETag rapporté | `ChecksumCRC64NVME` / `ChecksumType` | `ServerSideEncryption` |
| --- | --- | --- | --- |
| PUT mono-part, clé `.../one/report.pdf` | `f212a8c59b1965455cb91e017a405b25` (= MD5 local du fichier) | `ZGEHrG1waXA=` / `FULL_OBJECT` | `AES256` |
| PUT mono-part, mêmes octets, clé `.../two/autre-nom.pdf` | **même** `f212a8c59b…` | même `ZGEHrG1waXA=` | `AES256` |
| upload multi-part, mêmes octets | `d14de5848fe62c2595762bbbd4bd3a14-1` (≠ MD5) | même `ZGEHrG1waXA=` / `FULL_OBJECT` | `AES256` |

Trois faits utiles : l'ETag est bien le MD5 du corps et il est identique pour deux noms différents
(cœur de l'AC #3) ; le multi-part produit bien un ETag composite que le suffixe `-<n>` attrape ; et
S3 stocke de lui-même un CRC64NVME **full-object** même quand le client ne demande rien, donc le
repli du point 2 est réel et pas théorique — un envoi multi-part ou chiffré KMS dégrade vers le
checksum au lieu de casser.

### Ce qui n'est pas vérifiable depuis le worktree

Les deux vérifications utilisateur de la description (même fichier sous deux noms → un seul média ;
deux fichiers différents de même nom et même taille → deux médias) passent par l'API déployée : le
déploiement se déclenche au push sur `main`, après la fin de ce run. L'AC #3 est cochée sur ce qui
est atteignable ici — la `media_key` est une fonction pure de (kind, compte, empreinte), et
l'empreinte est mesurée identique/différente contre le vrai S3 dev dans le tableau ci-dessus. La
vérification bout-en-bout reste la note au propriétaire.

Aucun test automatisé n'a été ajouté (règle du dépôt).

### Contrôles passés

- `ruff check media_summarizer/` : clean.
- `mypy media_summarizer/` : `Success: no issues found in 189 source files`.
- `terraform validate` (envs/dev) : `Success! The configuration is valid.` ; `terraform fmt -check
  -recursive modules/platform` : clean.
<!-- SECTION:NOTES:END -->
