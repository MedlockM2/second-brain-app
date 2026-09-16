---
id: task-394
title: Réutiliser entre comptes les artefacts déjà générés pour un même contenu média
status: To Do
assignee: []
created_date: '2026-09-10 12:36'
labels:
  - backend
  - artifacts
  - cost
dependencies:
  - task-391
  - task-392
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

La déduplication inter-comptes s'arrête au contenu. Le transcript, le titre, le créateur et la cover sont bien repris d'un traitement fait pour un autre utilisateur (`durable_media_service.finalize_deduplicated_save`, dont le `content_job` *"may belong to another user"*). Les **artefacts générés par-dessus ne le sont pas** : deux comptes qui demandent le même type sur le même contenu dans la même langue paient chacun leur génération pour un texte identique.

Une seule chose l'empêche, et elle est doublée :

- `build_artifact_id` (`artifact_service.py`) hashe `user_id | scope | scope_id | type | parameters | sources` ;
- `build_scope_key` (`core/models/media_artifact.py`) place `user_id` en tête de la clé du GSI, avec une justification assumée : *"isolation between users becomes structural, so a listing query cannot reach another account's scope"*.

Tout le reste du matériel de hachage est **déjà en identité de contenu** : `effective_scope_id = content_scope_id or scope_id` vaut le `media_key`, et `ResolvedScope.expected_source_ids` renvoie des `content_id`, pas des ids de bibliothèque. Deux comptes calculeraient donc le même `artifact_id` si `user_id` n'était pas dans le matériel.

## Décisions du propriétaire

- **La mutualisation porte sur les artefacts de scope média**, tous types confondus, `review_blurb` inclus. `ArtifactScope` n'a que deux valeurs et un artefact média est mono-source (*"a media artifact is a folder artifact with a single source"*). Les artefacts de scope dossier ne sont pas concernés.
- **L'isolation entre comptes n'est pas un objectif pour un contenu issu du web.** Un artefact dérivé d'une page publique peut être servi à un autre compte.
- **L'utilisateur est débité dans tous les cas.** Aujourd'hui le quota n'est prélevé que si `not plan.reuses_existing` (`api/endpoints/artifacts.py`) ; le gain de la mutualisation revient à l'exploitant sous forme de coût fournisseur évité, pas à l'utilisateur sous forme de quota gratuit. Le débit ne doit donc plus dépendre du fait que la génération a réellement eu lieu.

## Ce qui reste exclu de la mutualisation

Les fichiers envoyés par l'utilisateur, dont l'identité de contenu est scopée au compte (`doc:{user.id}:...`, `audio:{user.id}:...`) : un document privé ne traverse jamais les comptes, et par conséquent ses artefacts non plus. Cette exclusion découle de l'identité de contenu et ne doit pas être contournée.

## Point d'attention pour l'implémenteur

Retirer `user_id` du hash ne suffit pas : il est aussi dans la clé du GSI, qui est ce qui empêche la requête de listage d'un compte d'atteindre le scope d'un autre. Il faut donc une indirection — un pointeur par compte vers l'artefact partagé — sinon soit le listage d'un compte expose le scope d'un autre, soit l'artefact mutualisé reste introuvable. Le listage d'un utilisateur ne doit continuer de montrer que ce qu'il a lui-même demandé.

## Notes au propriétaire (hors critères d'acceptation)

Vérification manuelle après déploiement : depuis deux comptes de test, sauvegarder la même vidéo et demander le même résumé dans la même langue ; constater un seul appel modèle côté coûts fournisseur, deux débits de quota, et un résumé identique servi aux deux bibliothèques.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Deux comptes demandant le même type d'artefact sur le même contenu média, dans la même langue de lecture, sont servis par une seule génération : la seconde demande ne déclenche aucun appel au fournisseur.
- [x] #2 La mutualisation couvre tous les types d'artefacts de scope média, review_blurb inclus, et ne s'applique pas au scope dossier.
- [x] #3 Un artefact dérivé d'un fichier envoyé par un utilisateur n'est jamais servi à un autre compte.
- [x] #4 Le quota de l'utilisateur est débité que la génération ait eu lieu ou qu'un artefact existant réponde à sa demande.
- [x] #5 Le listage des artefacts d'un compte ne retourne que ceux qu'il a lui-même demandés, sans exposer l'activité d'un autre compte.
- [x] #6 ruff et mypy passent sans erreur sur les modules touchés.
- [x] #7 Une vérification directe contre le DynamoDB -dev réel, documentée dans les notes d'implémentation, montre une entrée d'artefact unique servant deux comptes.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Deux lignes au lieu d'une : génération partagée + pointeur par compte

Le point d'attention de la description est traité par une indirection, pas par un
changement de clé du GSI (la table et son index sont inchangés, donc aucun Terraform à
reprendre) :

- **la génération partagée** — `build_shared_artifact_id` : le même matériel que
  `build_artifact_id` *moins* `user_id`, préfixé `shared_`. Elle est indexée sous
  `@content#media#<content id>` (`build_content_scope_key`, propriétaire sentinelle
  `CONTENT_SCOPE_OWNER = "@content"`). C'est la ligne que le worker génère et qui possède
  l'objet S3. Il en existe exactement une par (contenu, type, paramètres, sources).
- **le pointeur** — un par compte demandeur, `build_artifact_id` inchangé, portant le
  nouveau champ `shared_artifact_id`. C'est la seule ligne que l'API adresse.

`@content` ne peut pas être un `user_id` : ce sont des subjects Cognito (UUID). Le
listage d'un compte est donc structurellement incapable d'atteindre une ligne partagée,
alors que celle-ci reste énumérable dans le même GSI pour la purge — c'est le compromis
qui évite un second index.

## Le fournisseur n'est appelé qu'une fois

`plan_artifact_generation` fait deux lookups sans borne de temps : l'entrée du compte
lui-même, puis la génération partagée. `commit_artifact_generation` n'envoie le message
SQS que si l'écriture conditionnelle de la ligne partagée a réussi
(`arm_shared_generation`) : c'est **cette** écriture qui est le verrou exactement-une-fois
inter-comptes, pas celle du pointeur. Perdre la course renvoie la ligne existante et
journalise `artifact.shared_generation_collapsed`.

Résolution à la lecture, avec recopie de l'état terminal sur le pointeur
(`resolve_through_shared_generation` → `media_artifacts.mirror_shared_artifact`, écriture
conditionnée à un pointeur toujours en vol). Pas de fan-out à la fin de la génération, ce
qui aurait exigé un index sur `shared_artifact_id` : au plus deux GetItem par entrée en
vol et par sondage, zéro sur une entrée terminale, et le mécanisme se répare de lui-même
si un mirroir a été manqué.

Générations différées (task-360) : l'attente reste sur le pointeur (son échéance, son
instantané `preparation`), une ligne partagée n'a jamais d'`awaiting_expires_at`, et elle
n'est armée que lorsque toutes les sources sont lisibles. `artifact_wait_service._resume_one`
réclame l'attente **avant** d'armer le partage : l'ordre inverse laisserait une ligne
partagée `queued` que personne n'enquêterait si la réclamation d'attente était perdue.

## Quota : débit dès que le compte gagne une entrée

`api/endpoints/artifacts.py` ne saute `check_generation_allowed`/`record_generation` que
si `plan.already_owned`, c'est-à-dire uniquement pour une entrée que le compte détenait
déjà. `reused` ne veut donc plus dire « gratuit », et le code HTTP dit si une *génération*
a démarré, jamais si le quota a bougé (documenté dans le contrat canonique, les types
mobiles et le docstring de la réponse). `record_generation` est idempotent sur
l'`artifact_id` du pointeur, donc `COLLAPSED` et `RETRIED` ne double-débitent pas. Le
scope dossier est inchangé (sa réutilisation est toujours `already_owned`).

## Exclusion des fichiers envoyés : enforcée deux fois

`mutualizes_generation` refuse le scope dossier et tout contenu dont l'identité est
propre au compte (`media_identity.is_account_scoped_media_key`, placé à côté des recettes
de clé plutôt que dans le service artefact). Mais la garantie réelle est **l'identité de
contenu elle-même** : la clé d'un fichier envoyé contient le compte, donc le même fichier
envoyé par deux personnes donne deux `content_id`, donc deux `shared_artifact_id` sans
rapport — il n'y a rien à trouver pour un autre compte, quoi qu'en croie un appelant.
C'est ce que voulait dire « cette exclusion découle de l'identité de contenu ». Le
prédicat n'évite qu'une indirection inutile ; son docstring dit explicitement de le
revisiter si la recette d'upload cesse de faire apparaître le compte dans la clé.

## review_blurb

Couvert comme les autres (`review_blurb_service` passe par le même plan/commit).
`_internal_status` suit le pointeur puis la génération partagée, et
`_mirror_review_blurb_onto_content_rows` diffuse désormais le blurb sur **toutes** les
lignes de bibliothèque portant ce `media_key` (`list_by_media_key`), pas seulement celle
du compte déclencheur : sinon le compte servi par la génération d'un autre garderait une
tuile de triage vide.

## Purge

Le pointeur ne possède pas l'objet S3 : `media_purge_service._delete_owned_object` ne
supprime l'objet que si la ligne n'a pas de `shared_artifact_id`. La règle de niveau
contenu vit dans un seul endroit, `purge_shared_artifacts_for_content`, qui se garde
elle-même (elle ne supprime que si plus aucun détenteur ne reste, `ignore_user_id` servant
à l'ordonnancement de l'effacement de compte). Appelée par `account_deletion_service` et
par `workers/cleanup/media_lifecycle` ; `run_reconciliation` connaît maintenant les deux
clés de scope d'un média.

Bug préexistant corrigé au passage : `_storage_refs` lisait `record.storage` sur des
résultats du GSI, que `_projected_record` ne peuple jamais (l'index ne projette pas
`storage`) — les objets S3 des artefacts n'étaient donc jamais supprimés à la purge.

## AC #7 — vérification contre `media_artifacts-dev` réel

Script jetable (hors dépôt, `/tmp`), sur la table `media_artifacts-dev` en `eu-west-3`,
passant par le vrai code de repository : écriture d'une ligne partagée `ready` + deux
pointeurs `queued` de deux comptes sondes, lectures, puis suppression. Sortie observée :

```
content id            : mkey_v1_432fb6ac…369e
shared generation id  : shared_dddffd0d7f72d4d6b340ca0c72ae4bf5
pointer of …account-a : art_ad6657f5c788bb3c342c6a84a3a33bf5
pointer of …account-b : art_634ca39e8b8f83dd27f88e6ed132474d
mutualizes_generation(web media / upload media / folder) : True / False / False
listing of …account-a : [('art_ad6657f5…', 'queued')]
listing of …account-b : [('art_634ca39e…', 'queued')]
listing of @content scope key : [('shared_dddffd0d…', 'ready')]
GET pointer of …account-b -> status=ready title='Probe summary' storage_key=probe/394/shared_dddffd0d….json
pointer B row in DynamoDB after the read: status=ready storage_key=probe/394/shared_dddffd0d….json shared_artifact_id=shared_dddffd0d…
GET pointer of …account-a -> status=ready storage_key=probe/394/shared_dddffd0d….json
GET the shared generation id through the API read path: None
second mirror onto the now-terminal pointer B (must refuse): False
cleanup: deleted 3 rows, still present: []
```

Ce qui est établi : une seule entrée d'artefact (`shared_dddffd0d…`, propriétaire de
l'objet) sert les deux comptes — les deux GET résolvent vers la même clé S3 (#1, #7) ; la
requête de listage de chaque compte ne renvoie que son propre pointeur, ni celui de
l'autre ni la ligne partagée (#5) ; l'id partagé n'est pas adressable par le chemin de
lecture de l'API ; la recopie terminale atterrit bien dans DynamoDB et une seconde
recopie sur un pointeur déjà terminal est refusée par la condition ; la mutualisation est
active pour un média web et inactive pour un fichier envoyé comme pour un dossier (#2,
#3). Table laissée propre.

## Limites et notes

- `ruff check media_summarizer/` : *All checks passed!* — `mypy media_summarizer/` :
  *Success: no issues found in 189 source files* (#6).
- Aucun test automatisé ajouté (règle du projet). Le script AC #7 est jetable et n'est pas
  versionné.
- Aucun changement Terraform : clés de table, GSI `scope-index` et projection inchangés.
- La vérification manuelle demandée par le propriétaire (deux comptes de test, un seul
  appel modèle, deux débits) reste hors de portée d'un worktree : le déploiement se
  déclenche au push sur `main`.
- **À revoir au rebase sur task-393** (mergée après la base de cette branche, `2da366c`) :
  elle re-clé les fichiers envoyés en `mkey_v1_<sha256("upload:v1:<kind>:<owner>#content=…")>`,
  où le compte n'est plus visible. `is_account_scoped_media_key` cessera alors de
  reconnaître un upload, qui prendra le chemin partagé. **Aucune fuite inter-comptes** —
  le compte est toujours dans le matériel haché, donc les `content_id` de deux comptes
  restent distincts et l'AC #3 tient — mais la ligne partagée créée ne servira jamais
  qu'un compte : indirection inutile. Le correctif est de faire déclarer le fait par la
  recette d'upload (préfixe distinct ou drapeau), pas de deviner à partir du digest.
<!-- SECTION:NOTES:END -->
