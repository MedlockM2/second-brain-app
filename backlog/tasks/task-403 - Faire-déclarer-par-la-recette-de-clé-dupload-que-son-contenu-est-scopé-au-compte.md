---
id: TASK-403
title: >-
  Faire déclarer par la recette de clé d'upload que son contenu est scopé au
  compte
status: To Do
assignee: []
created_date: '2026-09-16 16:56'
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
- [ ] #1 is_account_scoped_media_key renvoie True pour un fichier envoyé et False pour un contenu issu d'un locator public, sur la base d'une déclaration de la recette d'upload et non d'une inspection de digest,Le compte n'est pas rendu lisible dans la clé d'un upload : il reste dans le matériel hashé,mutualizes_generation ne crée plus de ligne partagée pour un fichier envoyé,ACCOUNT_SCOPED_MEDIA_KEY_PREFIXES et toute autre trace de l'ancienne reconnaissance par préfixe sont supprimés, sans repli conservé,Deux comptes envoyant des octets identiques restent deux contenus et deux artefacts sans rapport,ruff et mypy passent sans erreur sur les modules touchés
<!-- AC:END -->
