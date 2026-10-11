---
id: TASK-470
title: >-
  Expédier le tour de chat directement depuis l'API, sceller en échec les tours
  perdus, et supprimer l'outbox et le remplacement de tentative
status: To Do
assignee: []
created_date: '2026-10-11 14:32'
labels:
  - backend
  - chat
  - feature
dependencies: []
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - docs/research/task-458-chat-outbox-relay/README.md
  - docs/CHAT_DATA_MODEL.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/INGESTION_WORKERS_PROVIDERS.md
  - media_summarizer/utils/chat_db.py
  - media_summarizer/core/models/chat.py
  - media_summarizer/core/services/chat_service.py
  - media_summarizer/api/endpoints/chat.py
  - media_summarizer/api/chat_stream_app.py
  - media_summarizer/workers/chat_worker.py
  - infrastructure/terraform/modules/platform/sqs.tf
  - infrastructure/terraform/modules/platform/iam_lambda.tf
  - infrastructure/observability/runbooks/pipeline-alerts.md
  - mobile/src/types/chat.ts
  - mobile/src/services/chatService.ts
  - mobile/src/contexts/ChatSessionContext.tsx
priority: medium
type: feature
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat est fixée par le `Decision` de `docs/research/task-430-chatbot-architecture/README.md` (Owner Validation). **Lire l'amendement de l'owner du 2026-10-11 sous le point 4.** Il prime sur ce point et sur la phrase du point 2 sur la redélivrance SQS.

Pour simplifier, le chat suit la pratique de la plupart des implémentations publiques. Un tour dont le lancement ou la génération est perdu n'est **pas relancé automatiquement** : il est scellé en échec, et l'utilisateur le relance avec le bouton existant de l'app (`ChatThread.tsx`, `canRetry`). Il n'y a ni outbox, ni relais, ni balayeur planifié, ni remplacement de tentative.

Le benchmark task-458 est abandonné pour cette raison, et task-465 (le relais) est archivée. Cette tâche les remplace.

Les tâches 457, 462, 463, 464 et 467 ont livré le code dans l'hypothèse d'une outbox : un item d'intention d'envoi, `replace_attempt`, l'état `superseded` et l'événement SSE `replaced`. **Rien n'est déployé.** Cette tâche supprime ces éléments dans le même passage, sans couche de compatibilité, et câble le chemin simple.

## 1. Envoi direct depuis l'API

Dans `chat_service.send_turn`, après la transaction `accept_turn` et le débit, l'API envoie le message de la file de chat. Le message garde la forme attendue par le worker : `{user_id, conversation_id, turn_id, turn_index, attempt_id}`, sur la file `CHAT_QUEUE`, avec le client SQS du dépôt (`media_summarizer/utils/sqs.py`).

- **Si l'envoi échoue**, l'API :
  - scelle le tour en `failed` avec un code typé (par exemple `dispatch_failed`) ;
  - rembourse par `refund_unanswered_turn` ;
  - libère le marqueur `INFLIGHT` comme le fait tout scellement ;
  - journalise l'échec ;
  - **répond normalement avec le tour**.

  L'app relit alors la conversation, voit l'échec et propose de relancer avec un nouveau `client_request_id`. Une réponse d'erreur ferait au contraire rejouer à l'app le même identifiant, donc le même tour en échec.
- **Le rejeu d'une même requête** (`_replayed_turn`) n'envoie rien.
- **IAM** : donner `sqs:SendMessage` sur la file de chat au rôle de l'API (`iam_lambda.tf`), et corriger le commentaire qui attribue l'envoi à l'outbox.

## 2. Tours perdus : détectés à la lecture, scellés en échec

Une seule règle, dans un module partagé par l'API, le worker et la Lambda de diffusion. La tentative active d'un tour est **perdue** quand :
- elle est `queued` depuis plus d'un seuil d'attente en file. Ce seuil doit dépasser l'attente normale avec la concurrence maximale du worker (`maximum_concurrency = 10`, timeout 600 s). Proposition : 300 s ;
- ou elle est `generating` et `lease_expires_at` est dépassé d'une marge de grâce. Proposition : 15 s, pour ne jamais sceller un worker vivant dont le renouvellement a un peu de retard.

Les seuils sont des constantes nommées, et leur raison est écrite en commentaire.

**Scellement d'un tour perdu.** Il se fait par une écriture conditionnelle de `chat_db`, conditionnée à l'identité de la tentative et à son état perdu (toujours `queued`, ou bail toujours expiré). Un worker qui renouvelle son bail au même moment gagne la course.
- **Sans texte visible** : `failed` avec le code `generation_lost`, puis remboursement par `refund_unanswered_turn`.
- **Avec des fragments** : `interrupted` avec la cause `provider_error`, et le texte partiel reconstruit depuis les fragments. Ce partiel est gardé pour que l'app affiche « interrompu » et le bouton de relance sans changement. Documenter que cette cause couvre toute rupture technique après du texte, worker perdu compris.

Le marqueur `INFLIGHT` est libéré comme pour tout scellement.

**Qui applique la règle :**
- **la lecture d'une conversation** (`get_conversation_view`), que l'app appelle au retour au premier plan, à la fin ou à la coupure d'un flux, et toutes les 2 s en repli ;
- **l'envoi d'un tour** : avant `accept_turn`, sceller la tentative active de la conversation si elle est perdue. Faire de même pour le tour désigné par le marqueur `INFLIGHT` du compte, sinon un tour perdu bloque la conversation (`no active attempt`) ou le compte pendant 15 min ;
- **le worker** :
  - un message dont la tentative `queued` est déjà perdue n'est pas généré : le worker la scelle et acquitte, au lieu de générer une réponse en retard ;
  - un claim refusé sur une tentative `generating` au bail expiré (redélivrance après un crash) scelle le tour perdu et acquitte ;
  - une redélivrance ne relance jamais la génération ;
- **la Lambda de diffusion**, qui est en lecture seule : une génération perdue est traitée comme terminée. Le flux ouvert se ferme sans événement `end`, puisque l'état terminal n'est pas encore persisté. Une nouvelle ouverture répond 204. L'app relit alors la conversation, et c'est cette lecture qui scelle.

## 3. Suppressions (rien n'est déployé : aucune compatibilité)

- L'item d'intention d'envoi : `ChatDispatchIntent`, `dispatch_intent_sk`, son écriture dans `accept_turn` (la transaction perd un item), `get_dispatch_intent` et `mark_intent_dispatched`.
- Le remplacement de tentative : `replace_attempt`, `ReplacementAttempt`, l'état `ChatAttemptStatus.SUPERSEDED`, `attempt_count` (modèle, réponse API, type mobile) et `attempt_number` s'il ne vaut plus jamais que 1.
- L'événement SSE `replaced` : dans `chat_stream_app.py`, dans le contrat, et côté mobile dans `types/chat.ts`, `chatService.ts` et `ChatSessionContext.tsx`.
- Toute mention de l'outbox, du relais, de task-458/465 ou d'une récupération qui remplace la tentative, dans les docstrings et commentaires : `chat_worker.py`, `chat_db.py`, `sqs.tf` (le commentaire de politique de la file : la visibilité de 660 s et le `maxReceiveCount` restent, mais leur justification change), `iam_lambda.tf` et le runbook (section « Chat DLQ »).

L'item de tentative et l'identité de génération `(turn_id, attempt_id)` **restent** : le bail, les écritures de fragments, l'arrêt et le contrat du flux en dépendent.

## 4. Documentation

- `docs/CHAT_DATA_MODEL.md` : items, transaction d'acceptation, états et transitions, opérations, et la règle de tour perdu avec ses seuils.
- `docs/CANONICAL_MEDIA_API_CONTRACT.md` : l'envoi (un tour peut revenir déjà `failed` / `dispatch_failed`), les codes `dispatch_failed` et `generation_lost`, la disparition de `attempt_count` et de l'événement `replaced`, le 204 pour une génération perdue.
- `docs/INGESTION_WORKERS_PROVIDERS.md` : politique de reprise du worker de chat, c'est-à-dire aucune reprise automatique ; un tour perdu est scellé en échec et relancé par l'utilisateur.

## Règles

Rien n'est déployé : pas de compatibilité, pas de double chemin. Pas de tests automatisés ni d'appel in-process. Aucun secret ni identité de compte dans les fichiers suivis.

## Note à l'owner

Après merge, push et `terraform apply` sur dev :
1. Envoyer un tour depuis l'app de dev et vérifier qu'il part dans `chat-queue-dev` puis que la réponse se diffuse.
2. Passer la concurrence du worker à 0 (ou désactiver son mapping), envoyer un tour, attendre le seuil de file, puis rouvrir la conversation. Le tour doit apparaître en échec avec le bouton de relance, et le quota doit être remboursé.
3. Rétablir le worker et relancer : la relance crée un nouveau tour qui aboutit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Après la transaction d'acceptation et le débit, send_turn envoie vers CHAT_QUEUE le message {user_id, conversation_id, turn_id, turn_index, attempt_id} ; un envoi en échec scelle le tour en failed avec un code typé, le rembourse, et la route répond avec le tour ; un rejeu de la même requête n'envoie rien ; le rôle IAM de l'API a sqs:SendMessage sur la file de chat
- [ ] #2 Une règle unique et partagée définit un tour perdu (queued au-delà d'un seuil d'attente, ou generating au bail dépassé d'une marge de grâce), avec des constantes nommées dont la raison est commentée
- [ ] #3 Un tour perdu est scellé par une écriture conditionnelle sur l'identité de la tentative et son état perdu : en failed / generation_lost puis remboursé s'il n'a aucun texte visible, en interrupted / provider_error avec le texte des fragments sinon ; le marqueur INFLIGHT est libéré
- [ ] #4 La lecture d'une conversation, l'envoi d'un tour (pour la tentative active de la conversation et pour le tour du marqueur INFLIGHT) et le worker (tentative queued perdue, ou claim refusé sur un bail expiré) appliquent la règle ; une redélivrance SQS ne relance jamais une génération
- [ ] #5 La Lambda de diffusion ferme sans événement end le flux d'une génération perdue et répond 204 à une nouvelle ouverture
- [ ] #6 ChatDispatchIntent, dispatch_intent_sk, get_dispatch_intent, mark_intent_dispatched, replace_attempt, ReplacementAttempt, l'état superseded, attempt_count et l'événement SSE replaced (serveur et mobile) n'existent plus ; une recherche de ces noms, et des mentions outbox / task-465 hors de docs/research et backlog, ne trouve rien
- [ ] #7 docs/CHAT_DATA_MODEL.md, docs/CANONICAL_MEDIA_API_CONTRACT.md, docs/INGESTION_WORKERS_PROVIDERS.md, le runbook et les commentaires de sqs.tf et iam_lambda.tf décrivent le chemin sans outbox et la règle de tour perdu
- [ ] #8 ruff check et mypy passent sur les fichiers Python modifiés ; terraform validate passe sur dev ; npx tsc --noEmit et le lint mobile passent
<!-- AC:END -->
