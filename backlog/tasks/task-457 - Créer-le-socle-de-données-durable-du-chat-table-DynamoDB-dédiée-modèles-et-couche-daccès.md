---
id: TASK-457
title: >-
  Créer le socle de données durable du chat : table DynamoDB dédiée, modèles et
  couche d'accès
status: In Progress
assignee: []
created_date: '2026-10-10 17:56'
updated_date: '2026-10-10 20:55'
labels:
  - backend
  - chat
  - feature
dependencies: []
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - >-
    docs/research/task-430-chatbot-architecture/complement-response-2026-10-07.md
  - infrastructure/terraform/modules/platform/dynamodb_core_tables.tf
  - infrastructure/terraform/modules/platform/runtime_env.tf
  - infrastructure/terraform/modules/platform/iam_lambda.tf
  - media_summarizer/core/services/account_deletion_service.py
  - media_summarizer/core/models/media_artifact.py
  - media_summarizer/utils/media_artifacts.py
priority: medium
type: feature
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Le chatbot conversationnel est décidé par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10. **Ce `Decision` est la source de vérité** : il prime sur la Recommendation initiale (architecture B, un item par conversation avec les tours dedans) et sur les variantes de `complement-response-2026-10-07.md`. Le reste du README et du complément est une base de preuves (code lu, mesures `-dev`, coûts), pas une spécification. Lire le `Decision` en entier avant de commencer.

Cette tâche est la première tranche du découpage de task-431 : toutes les autres tâches du chat (API, worker, diffusion SSE, relais d'outbox) écrivent ou lisent les items définis ici. C'est la restructuration qui passe avant les tâches qui peuplent la forme.

## Ce que le Decision impose (point 3 « État durable »)

- **Une table DynamoDB dédiée au chat**, distincte de `media_artifacts` (le README §2.1 explique pourquoi une conversation ne peut pas vivre dans une table adressée par le contenu et mutualisée entre comptes).
- **Des items distincts** pour : les métadonnées de conversation, les messages, les tentatives de génération, les fragments temporaires du flux, et l'intention d'envoi de l'outbox (point 4 du Decision : « le tour accepté et son intention d'envoi sont enregistrés atomiquement en DynamoDB »). Ne pas loger les tours dans l'item de conversation : le complément C1.8 montre qu'un `UpdateItem` sur un gros item facture sa taille entière.
- **Pas de TTL sur conversations et messages ; TTL sur les fragments.** DynamoDB ignore les items sans attribut TTL numérique, donc un seul attribut TTL sur la table, posé uniquement sur les fragments.
- **Partitionnement qui permet la lecture par compte et l'effacement de toutes les données d'un compte.** La clé de partition est le compte ; les clés de tri préfixées permettent de lire une conversation, ses messages dans l'ordre, ses tentatives et ses fragments dans l'ordre de séquence. Lister les conversations d'un compte pour une portée donnée (un média, un dossier) doit être possible — c'est ce que l'historique retrouvable du Decision point 1 lira.
- **Identités** : chaque génération porte une identité de tour et une identité de tentative ; chaque fragment porte en plus un numéro de séquence. Les écritures conditionnelles empêchent une ancienne tentative de modifier ou de terminer une génération plus récente, et la réponse finale et son état terminal sont persistés avant toute notification de fin. Fournir dans la couche d'accès les opérations conditionnelles qui portent ces garanties (pose d'un tour sous condition, claim/bail d'une tentative, écriture de fragment, scellement terminal sous condition d'identité de tentative, demande d'annulation), pour que l'API et le worker ne réécrivent pas chacun leurs conditions.
- **États** : au minimum accepté / en génération / terminé / échoué / interrompu (arrêt volontaire, échec partiel ou plafond de sortie atteint, Decision point 6 : « une réponse interrompue reste identifiable comme telle »). L'état interrompu porte sa cause, lisible par l'API et l'app. Le message assistant référence la tentative qui l'a produit ; une nouvelle tentative a sa propre identité et ne concatène jamais sa réponse au partiel d'une autre.
- **Instantané de sources versionné** (Decision point 7) : l'item de conversation porte la portée (`media` ou `folder`, le vocabulaire `ArtifactScope` existant), l'identifiant de portée, et l'instantané des sources figé à l'ouverture (ordre stable, référence citable par source, de quoi reconstruire le corpus : les clés S3 de transcript comme le fait `ArtifactSource`, `media_summarizer/core/models/media_artifact.py`). Le README §11.1 recommande l'instantané figé à l'ouverture.

## Périmètre

- Terraform : la table dans `infrastructure/terraform/modules/platform/dynamodb_core_tables.tf` (ou un fichier `dynamodb_chat_tables.tf` sur le modèle des autres), `PAY_PER_REQUEST`, PITR, `deletion_protection_enabled`, `prevent_destroy`, bloc `ttl` sur l'attribut des fragments ; le nom de table dans `local.lambda_environment` (`runtime_env.tf`) ; la table dans les permissions DynamoDB des rôles API et workers (`iam_lambda.tf`).
- Python : les modèles (`media_summarizer/core/models/`), la couche d'accès (`media_summarizer/utils/`, sur le modèle de `utils/media_artifacts.py`), la lecture de la variable d'environnement.
- Effacement de compte : la table entre dans `media_summarizer/core/services/account_deletion_service.py` de façon que **tous** les items du compte (conversations, messages, tentatives, fragments, intentions) soient purgés.
- Documentation : décrire le schéma des items (clés, attributs, états, transitions, conditions) dans un document de référence lisible par les tâches suivantes — par exemple une section chat dans `docs/CANONICAL_MEDIA_API_CONTRACT.md` ou un `docs/CHAT_DATA_MODEL.md` référencé depuis lui.

Hors périmètre : routes HTTP, worker, file SQS, diffusion SSE, mécanisme d'expédition de l'outbox (tranché par un benchmark séparé — l'item d'intention défini ici doit seulement porter ce que n'importe quel relais lira : identité du tour et de la tentative, état d'expédition, horodatages). Si le relais retenu exige un flux DynamoDB ou un index, la tâche du relais l'ajoutera.

## Règles du dépôt

Rien n'est déployé : aucune couche de compatibilité, aucune migration, aucun double écrit. Pas de tests automatisés. Aucun secret ni identité de compte dans les fichiers suivis.

## Note à l'owner

Après merge et push sur `main`, `terraform apply` crée la table en `-dev` ; vérifier par `aws dynamodb describe-table` et `describe-time-to-live` (profil `second-brain-app`) que la table, le PITR et le TTL sont en place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La table DynamoDB dédiée au chat est déclarée dans le module Terraform platform avec PAY_PER_REQUEST, PITR, protection contre la suppression, prevent_destroy et un TTL sur l'attribut porté par les seuls fragments ; son nom est dans l'environnement des Lambdas et dans les permissions des rôles API et workers ; terraform validate passe
- [x] #2 Les modèles distinguent métadonnées de conversation, messages, tentatives, fragments et intentions d'envoi, avec identité de tour, identité de tentative et numéro de séquence des fragments, et un état interrompu distinct de terminé et d'échoué
- [x] #3 L'item de conversation porte la portée média ou dossier, son identifiant et un instantané de sources versionné, ordonné et citable, figé à l'ouverture
- [x] #4 La couche d'accès expose des opérations conditionnelles qui empêchent une tentative périmée d'écrire ou de sceller une génération plus récente, et qui persistent l'état terminal avant toute notification de fin
- [x] #5 La clé de partition est le compte et permet de lister ses conversations par portée ; l'effacement de compte purge tous les items de la table pour ce compte via account_deletion_service.py
- [x] #6 Le schéma des items, leurs états et transitions et les conditions d'écriture sont documentés dans un fichier de docs/ que les tâches suivantes du chat peuvent citer
- [x] #7 ruff check et mypy passent sur les fichiers Python modifiés ou créés
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémenté le 2026-10-10 sur l'arbre de travail principal, sans commit (même pratique que task-436 : l'arbre contient d'autres travaux en cours non commités, dont task-439).

- **Table (AC #1)** : `chat-<env>` dans `infrastructure/terraform/modules/platform/dynamodb_chat_tables.tf`. PK `user_id`, SK `sk`, `PAY_PER_REQUEST`, PITR, protection contre la suppression, `prevent_destroy`, TTL sur `fragment_expires_at` (porté par les seuls fragments). LSI `scope-activity-index` (clé `scope_activity_key` = `<scope>#<scope_id>#<dernière activité>`, posée sur les seuls items de conversation), déclarée dès la création parce qu'une LSI ne s'ajoute pas après coup. `CHAT_TABLE` est dans `local.table_names` (`runtime_env.tf`). Les rôles API et workers couvrent déjà la table par le motif de suffixe ; `dynamodb:ConditionCheckItem` leur est ajouté (`iam_lambda.tf`) parce que l'écriture d'un fragment est une transaction avec une vérification sur sa tentative. `terraform validate` passe dans `envs/dev`.
- **Modèles (AC #2, #3)** : `media_summarizer/core/models/chat.py`. Six types d'item : conversation, message utilisateur, message assistant (qui porte aussi l'état du tour), tentative, fragment (numéro de séquence par tentative), intention d'envoi. États du tour : `accepted`, `generating`, `completed`, `failed`, `interrupted` avec une cause (`cancelled`, `output_limit`, `provider_error`). La conversation porte la portée (`ArtifactScope`), l'identifiant de portée et un `ChatSourceSnapshot` figé à l'ouverture : ordre conservé, référence citable `[S1]`…`[Sn]` identique à `corpus.source_label`, version = empreinte sha256 des couples (média, clé de transcript).
- **Couche d'accès (AC #4)** : `media_summarizer/utils/chat_db.py`. Opérations conditionnelles : `accept_turn` (transaction de 5 items : conversation, question, réponse vide, tentative, intention ; refus typé `TurnNotAcceptedError`, jeton d'idempotence passé en `ClientRequestToken`), `claim_attempt`, `renew_attempt_lease`, `append_fragment` (vérification de la tentative + écriture du fragment dans une même transaction), `request_cancellation`, `replace_attempt` (marque l'ancienne tentative `superseded` dans la transaction qui installe la nouvelle), `seal_turn` (texte final et état terminal validés avant tout retour), `mark_intent_dispatched`, `delete_conversation`, plus les lectures.
- **Compte (AC #5)** : `("CHAT_TABLE", "sk")` ajouté à `_USER_PARTITION_TABLES` de `account_deletion_service.py`. L'historique par portée se lit par la LSI.
- **Documentation (AC #6)** : `docs/CHAT_DATA_MODEL.md` (clés, attributs, états, transitions, conditions de chaque écriture). `docs/DATA_RETENTION.md` §2 et `.env.example` mis à jour.
- **AC #7** : `ruff check` et `mypy` passent sur les fichiers Python créés ou modifiés. `scripts/check_purge_at_writers.py` passe.

Vérifié hors AWS : sérialisation aller-retour des six types d'item via `TypeSerializer`, ordre des clés de messages, garde-fou de `seal_turn`. La table n'existe pas encore en `-dev` : elle sera créée par `terraform apply` après push (voir la note à l'owner).
<!-- SECTION:NOTES:END -->
