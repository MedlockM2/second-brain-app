---
id: TASK-403
title: >-
  Faire déclarer par la recette de clé d'upload que son contenu est scopé au
  compte
status: To Do
assignee: []
created_date: '2026-09-16 16:56'
updated_date: '2026-09-17 12:00'
labels:
  - backend
  - artifacts
  - media_identity
dependencies: []
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Origine : défaut d'intégration constaté au merge du dispatch du 2026-09-16, entre task-393 (mergée) et task-394 (mergée dans le même run).

## Constat

`is_account_scoped_media_key` (`core/services/media_identity.py`, ajoutée par task-394) reconnaît un fichier envoyé sur deux motifs : le préfixe `doc:`/`audio:`, et le compte apparaissant littéralement dans la clé. task-393 a re-clé tous les uploads via `generate_uploaded_file_media_key`, qui hashe le propriétaire *dans* un `mkey_v1_<digest>` opaque. Les deux motifs échouent donc simultanément : la fonction répond False pour tout upload.

Vérifié au merge, code réel : deux comptes envoyant des octets identiques obtiennent bien deux clés distinctes et deux `shared_artifact_id` sans rapport.

## Ce qui n'est pas cassé

L'isolation. L'exclusion des uploads de la mutualisation était doublée et seule cette moitié est tombée : le compte reste dans le matériel hashé, donc un artefact d'upload n'a aucune identité inter-comptes sous laquelle être trouvé. L'AC #3 de task-394 tient toujours. Aucune fuite entre comptes.

## Ce qui est cassé

`mutualizes_generation` renvoie désormais True pour chaque fichier envoyé, donc chaque upload crée une ligne partagée qui ne servira jamais qu'au seul compte qui l'a demandée : une indirection inutile (une écriture DynamoDB et une lecture de résolution par artefact d'upload), et un prédicat dont le nom ment sur ce qu'il mesure.

## Direction

La recette d'upload doit **déclarer** que son contenu est scopé au compte — préfixe de clé distinct, ou drapeau explicite porté à côté de la clé — au lieu que le prédicat le devine depuis un digest, ce qui est impossible par construction. Ne pas rétablir un `user_id` lisible dans la clé : le hachage est ce que task-393 a cherché.

Rien n'est déployé, donc pas de couche de compatibilité : si la forme de clé change, les lignes dev existantes ne sont pas migrées.

## Points d'attention

- `ACCOUNT_SCOPED_MEDIA_KEY_PREFIXES` est mort et doit disparaître avec le correctif, pas rester en repli.
- Vérifier tout lecteur qui suppose `mkey_v1_` si le préfixe change.
- Seul appelant actuel : `mutualizes_generation` (`core/services/artifact_service.py`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 is_account_scoped_media_key renvoie True pour un fichier envoyé et False pour un contenu issu d'un locator public, sur la base d'une déclaration de la recette d'upload et non d'une inspection de digest
- [x] #2 Le compte n'est pas rendu lisible dans la clé d'un upload : il reste dans le matériel hashé
- [x] #3 mutualizes_generation ne crée plus de ligne partagée pour un fichier envoyé
- [x] #4 ACCOUNT_SCOPED_MEDIA_KEY_PREFIXES et toute autre trace de l'ancienne reconnaissance par préfixe sont supprimés, sans repli conservé
- [x] #5 Deux comptes envoyant des octets identiques restent deux contenus et deux artefacts sans rapport
- [x] #6 ruff et mypy passent sans erreur sur les modules touchés
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Deux familles de clés de contenu, distinguées par le préfixe

`core/services/media_identity.py` nomme désormais les deux recettes et leur préfixe :

- `mkey_v1_<sha256>` (`SHARED_MEDIA_KEY_PREFIX`, `generate_media_key`) — identité
  dérivée d'un **locator public**. Tous les comptes tombent dessus, ce qui est ce qui
  rend un traitement et une génération d'artefact communs.
- `acct_mkey_v1_<sha256>` (`ACCOUNT_SCOPED_MEDIA_KEY_PREFIX`,
  `generate_account_scoped_media_key`) — identité dérivée d'un matériel qui **contient
  le compte**, donc d'un fichier envoyé. Aucun autre compte ne peut la calculer.

Le préfixe est la *déclaration* de la recette, pas une inspection : le compte reste
haché dans le digest et n'est pas relisible (AC #2 — le digest ne contient aucune
sous-chaîne du `user_id`, contrairement aux anciennes formes `doc:{user_id}:…`). C'est
la seule information exploitable par un lecteur, puisque seule la clé voyage avec une
demande d'artefact (le locator, lui, n'est pas transmis).

Deux recettes déclarent : `generate_uploaded_file_media_key` (documents et audios
envoyés) et le locator de partage porteur d'un `owner_user_id`
(`media_ingestion/use_cases.py`, note vocale partagée depuis WhatsApp). La seconde
était touchée par le même défaut et n'était pas citée dans la description : son
`media_key` passait aussi par `generate_media_key`, donc une note vocale partagée
construisait elle aussi une ligne partagée inutile. Le partage de **texte** garde la
recette publique (pas un fichier envoyé, sa mutualisation se décide ailleurs).

## Ce qui a été supprimé, sans repli

- `ACCOUNT_SCOPED_MEDIA_KEY_PREFIXES` (`("doc:", "audio:")`) ;
- l'heuristique `owner in key`, et avec elle le paramètre `owner_user_id` de
  `is_account_scoped_media_key`, qui n'a plus rien à en faire ;
- le paramètre `user_id` de `mutualizes_generation` (`core/services/artifact_service.py`),
  devenu inutile — la fonction ne dépend plus que du scope et de l'identité de contenu.
  Unique appelant mis à jour dans `plan_artifact_generation`.

`is_account_scoped_media_key` se résume à un test de préfixe : pas de second motif à
maintenir, donc pas de moitié qui puisse retomber en silence comme au merge précédent.

## Effet sur le chemin de génération (AC #3)

`plan_artifact_generation` ne construit une génération partagée que si
`mutualizes_generation` est vrai. Un fichier envoyé rend maintenant `True` à
`is_account_scoped_media_key`, donc le prédicat rend `False` et la ligne du compte *est*
la génération : pas de `shared_artifact_id`, pas d'écriture de ligne `shared_…`, pas de
lecture de résolution. `artifact_wait_service._resume_one` branche sur
`record.shared_artifact_id` et suit donc automatiquement (il reste `None` pour un
upload).

## Aucun lecteur ne suppose `mkey_v1_`

Vérifié par grep sur tout le dépôt : aucun code Python, TypeScript ou Terraform ne teste
ni ne découpe le préfixe d'un `media_key` (seuls des commentaires le citaient, mis à
jour dans `core/models/user_media.py`). `content_scope_id_from_scope_key` découpe sur
`#`, que le nouveau préfixe ne contient pas. Côté mobile, `media_key` est un `string`
opaque. `media_idempotence` étant global et keyé par `media_key`, une clé scopée au
compte n'y collisionne jamais avec celle d'un autre compte.

## Vérification exécutée

Contrôle jetable en mémoire sur le module pur `media_identity` (aucun fichier ajouté),
deux comptes sondes envoyant la **même** empreinte de contenu :

```
upload A            : acct_mkey_v1_64054eef…8570
upload B same bytes : acct_mkey_v1_7cfb7190…6ef8
web locator         : mkey_v1_6bc35c67…78e6
shared voice note   : acct_mkey_v1_73934bce…85e7
A != B                          : True
owner readable in key           : False
declared account-scoped (A/B)   : True True
declared account-scoped (note)  : True
declared account-scoped (web)   : False
```

Deux comptes envoyant des octets identiques restent donc deux identités de contenu
(AC #5) : `build_artifact_id` et `build_shared_artifact_id` hachant l'identité de
contenu, leurs artefacts restent sans rapport, et aucun des deux ne porte de ligne
partagée.

## Limites

- `ruff check media_summarizer/` : *All checks passed!* — `mypy media_summarizer/` :
  *Success: no issues found in 189 source files* (AC #6).
- Aucun test automatisé ajouté (règle du projet).
- Aucun changement Terraform : les clés de table et les GSI ne bougent pas.
- Pas de vérification directe contre DynamoDB `-dev` : aucun identifiant AWS n'est
  disponible dans ce worktree (`aws` renvoie `NoCredentials`). Aucun AC ne la demandait.
- Les lignes `-dev` existantes ne sont pas migrées : un upload déjà sauvegardé garde une
  clé `mkey_v1_…` et sera re-clé au prochain envoi (rien n'est déployé, choix explicite
  de la description).
- Note au propriétaire, hors AC : après merge et push sur `main`, envoyer un document
  depuis deux comptes de test et vérifier dans `media_artifacts-dev` qu'aucune ligne
  `shared_…` n'apparaît pour ces artefacts, et dans `user_media-dev` que les deux
  `media_key` commencent par `acct_mkey_v1_` et diffèrent.
<!-- SECTION:NOTES:END -->
