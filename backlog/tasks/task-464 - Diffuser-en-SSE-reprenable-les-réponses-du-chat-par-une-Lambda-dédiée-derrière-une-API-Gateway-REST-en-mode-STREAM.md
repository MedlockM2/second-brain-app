---
id: TASK-464
title: >-
  Diffuser en SSE reprenable les réponses du chat par une Lambda dédiée derrière
  une API Gateway REST en mode STREAM
status: Done
assignee: []
created_date: '2026-10-10 17:59'
updated_date: '2026-10-10 22:28'
labels:
  - backend
  - infrastructure
  - chat
  - feature
dependencies:
  - TASK-457
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - >-
    docs/research/task-430-chatbot-architecture/complement-response-2026-10-07.md
  - infrastructure/terraform/modules/platform/lambda_api.tf
  - infrastructure/terraform/modules/platform/lambda_digest_scheduler.tf
  - infrastructure/terraform/modules/platform/pipeline_alerts.tf
  - infrastructure/docker/lambda-api.Dockerfile
  - .github/workflows/deploy-lambda.yml
  - media_summarizer/api/dependencies/auth.py
  - >-
    https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode.html
  - >-
    https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode-lambda.html
  - 'https://github.com/awslabs/aws-lambda-web-adapter'
modified_files:
  - media_summarizer/api/chat_stream_app.py
  - infrastructure/terraform/modules/platform/chat_stream.tf
  - infrastructure/docker/lambda-chat-stream.Dockerfile
  - .github/workflows/deploy-lambda.yml
  - infrastructure/terraform/shared/ecr.tf
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - infrastructure/observability/runbooks/pipeline-alerts.md
priority: medium
type: feature
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat est décidée par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10 — **source de vérité**, qui prime sur la Recommendation (pas de streaming en V1) et sur le complément (Function URL publique). Point 5 du Decision :

> Une Lambda de diffusion distincte relit les fragments persistés et les transmet au mobile. Elle utilise FastAPI / uvicorn avec le Lambda Web Adapter, derrière une **API Gateway REST régionale dédiée au flux, en mode STREAM**. Conserver la façade HTTP actuelle pour les opérations de création, lecture, arrêt et suppression sous `/api/chat`. Les deux portes vérifient le même JWT applicatif et l'appartenance de la conversation au compte. […] **ne pas créer de Function URL publique pour ce chemin**. Définir les permissions IAM, alarmes, budgets de connexions et livraison de l'image de diffusion pour ce service.

Le Decision cite ses sources AWS (mode STREAM des REST APIs jusqu'à 15 minutes, intégration Lambda, journaux de streaming) : les lire. Le README §5.1 et la doc citée détaillent le format exigé en mode STREAM (métadonnées JSON puis délimiteur de 8 octets nuls dans les 16 premiers Ko, URI `…/response-streaming-invocations`) — le Lambda Web Adapter en `response_stream` le produit ; le vérifier dans sa documentation.

## Ce que le service fait

Une application FastAPI **minimale**, distincte de `media_summarizer/api/main.py` (pas de `CRITICAL_ROUTES` ni du démarrage complet), servie par uvicorn derrière le Lambda Web Adapter (`AWS_LWA_INVOKE_MODE=response_stream`) :

- une route de flux d'une conversation qui prend **l'identité de génération** et un **curseur de séquence** (Decision point 6) ;
- elle vérifie le JWT de l'app avec la même fonction que la façade (`media_summarizer/api/dependencies/auth.py`) et l'appartenance de la conversation au compte ;
- **204** quand aucune génération n'est active (patron cité dans le Decision) ; refus typé quand l'identité de génération fournie est périmée ;
- sinon, elle rejoue les fragments persistés **après le curseur**, puis suit les nouveaux par relecture de la plage de fragments (le complément C1.8 chiffre une interrogation toutes les 250 ms), chaque événement SSE portant son numéro de séquence pour que le mobile déduplique ;
- elle émet un événement terminal portant l'état final (terminé, interrompu, échec, échec partiel) **après** l'avoir lu persisté, puis ferme ; elle ne génère rien et n'appelle aucun LLM ;
- elle borne sa propre durée (sous le plafond de streaming de la REST API et le timeout Lambda) et ferme proprement, le mobile reprenant avec son curseur.

## Infrastructure

- `aws_api_gateway_rest_api` **régionale**, ressource et méthode du flux, intégration Lambda en `response_transfer_mode = "STREAM"` (vérifier le nom exact de l'attribut dans la version du fournisseur Terraform du dépôt), déploiement, étage avec **journaux d'accès** et limites de trafic, rôle de journalisation si l'étage en a besoin, `aws_lambda_permission` pour API Gateway. **Aucune Function URL.** Fichier neuf, par exemple `infrastructure/terraform/modules/platform/chat_stream.tf`.
- La Lambda de diffusion **hors de `local.workers`** (elle n'a pas de file : le complément C1.6 explique pourquoi l'y faire entrer casserait le mapping SQS), déclarée à part comme `lambda_digest_scheduler.tf` et `lambda_media_lifecycle.tf` le font, avec son log group, sa concurrence réservée (le « budget de connexions » du Decision : chaque flux ouvert tient une exécution), et des **alarmes** : erreurs et étranglements de la Lambda, 5xx et latence de l'étage. Permissions IAM limitées à la lecture de la table chat.
- **Image et livraison** : un `Dockerfile` neuf dans `infrastructure/docker/` (uvicorn + Lambda Web Adapter, épinglé à une version ; reprendre la discipline de résolution figée `uv export --frozen` des Dockerfiles existants — le complément C1.11 point 4 le souligne), et dans `.github/workflows/deploy-lambda.yml` un travail de construction et un déploiement par digest, sur le modèle de ceux de l'API et des workers, **y compris dans `promote-prod`**. Ne pas nommer la fonction `media-summarizer-worker-…` : la boucle des workers lui pousserait l'image des workers.
- L'URL d'invocation de l'étage est une sortie Terraform, que la tâche mobile lira comme variable publique.

## Règles

Rien n'est déployé : pas de compatibilité. Pas de tests automatisés ni d'appel in-process. Aucun secret dans les fichiers suivis. Documentation : le contrat du flux (route, paramètres, format des événements, 204, refus, événement terminal) dans `docs/CANONICAL_MEDIA_API_CONTRACT.md`, et l'exploitation (alarmes, journaux d'accès, concurrence réservée) dans le runbook d'exploitation existant.

## Notes à l'owner

- Après merge, push et `terraform apply`, vérifier sur `-dev` qu'un flux s'ouvre par l'URL de l'étage avec un JWT valide, rend 204 sans génération active, et rejoue depuis un curseur. Vérifier aussi les journaux d'accès de l'étage.
- Domaine personnalisé : non requis ici. La préparation du domaine API de production est task-445 ; si un nom de domaine est voulu pour le flux, l'ajouter dans cette tâche-là ou en créer une.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une API Gateway REST régionale dédiée au flux, avec une intégration Lambda en mode STREAM, un étage avec journaux d'accès et limites de trafic, est déclarée en Terraform, et aucune Function URL n'est créée ; terraform validate passe
- [x] #2 La Lambda de diffusion est déclarée hors de local.workers, avec son log group, sa concurrence réservée, des alarmes d'erreurs et d'étranglements de la Lambda et de 5xx et latence de l'étage, et des permissions limitées à la lecture de la table chat
- [x] #3 Un Dockerfile neuf construit l'image uvicorn plus Lambda Web Adapter avec résolution de dépendances figée, et deploy-lambda.yml la construit et la déploie par digest en dev et dans promote-prod sans qu'elle entre dans la boucle des workers
- [x] #4 L'application de diffusion est distincte de api/main.py, vérifie le JWT avec la même fonction que la façade et l'appartenance de la conversation, rend 204 sans génération active et refuse une identité de génération périmée
- [x] #5 La route rejoue les fragments après le curseur puis suit les nouveaux, chaque événement portant son numéro de séquence, et émet un événement terminal portant l'état final persisté avant de fermer ; elle n'appelle aucun LLM
- [x] #6 L'URL d'invocation de l'étage est une sortie Terraform, et le contrat du flux est décrit dans docs/CANONICAL_MEDIA_API_CONTRACT.md ; ruff check et mypy passent
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Diffusion SSE reprenable du chat.

- `media_summarizer/api/chat_stream_app.py` : app FastAPI minimale, distincte de `api/main.py`, avec `/health` pour la readiness du LWA et une route `GET /chat/conversations/{id}/stream?turn_id&attempt_id&after_seq`. Elle vérifie le JWT par `get_current_user` (la fonction de la façade) et l'appartenance via la clé du compte (404). Elle répond 204 sans génération active et `409 generation_stale` (avec l'identité vivante) quand l'identité fournie est périmée. Sinon elle émet `generation`, rejoue les fragments après le curseur puis suit les nouveaux toutes les 250 ms (`event: fragment`, `id` = séquence), avec un keepalive toutes les 15 s. Elle émet `end` avec l'état relu persisté (statut, cause, code, texte final) après avoir vidé les derniers fragments, `replaced` si une nouvelle tentative remplace celle-ci, `reconnect` à 840 s. Aucun appel LLM. Vérifié localement sous uvicorn : `/health` 200, flux sans jeton 401.
- `chat_stream.tf` : Lambda `media-summarizer-chat-stream-<env>` hors de `local.workers`, avec log group, concurrence réservée de 20 (budget de connexions ; les deux comptes ont 1 000), timeout 900 s et IAM en lecture seule (table chat en GetItem/Query, ligne utilisateur pour le JWT, secret runtime). API Gateway REST **régionale** dont l'intégration Lambda passe en `responseTransferMode: STREAM` par son corps OpenAPI (URI `2021-11-15/…/response-streaming-invocations`, 900 000 ms) : le provider AWS épinglé (5.100.0) n'a pas l'attribut, le choix est expliqué en tête de fichier. S'y ajoutent l'étage `v1` avec journaux d'accès (rôle CloudWatch de compte `aws_api_gateway_account`) et limites de trafic, `aws_lambda_permission` et des alarmes erreurs, étranglements, 5xx et latence d'ouverture p90. Aucune Function URL. Sortie `chat_stream_url`. `terraform validate` passe en dev et en prod.
- `infrastructure/docker/lambda-chat-stream.Dockerfile` : base Lambda Python 3.11 arm64, Lambda Web Adapter épinglé à 1.1.0 (sorti le 18 septembre), `uv export --frozen`, entrée uvicorn. `deploy-lambda.yml` ajoute le filtre `chat_stream`, le job `deploy-chat-stream` (déploiement par digest, nom hors du motif `media-summarizer-worker-*`) et la promotion `chat-stream-<tag>` dans `promote-prod`. `shared/ecr.tf` ajoute une règle de rétention `chat-stream-`.
- Docs : contrat du flux (`CANONICAL_MEDIA_API_CONTRACT.md`, section « Chat stream ») et runbook (section « Chat stream »).

Non vérifié ici : la construction de l'image (Docker absent de la machine) et le comportement réel derrière API Gateway.

Notes à l'owner :
- Ordre de mise en service : pousser sur main d'abord pour que `chat-stream-latest` existe dans le registre, puis lancer `terraform apply` (la Lambda est créée sur ce tag). Le premier job de déploiement échouera tant que la fonction n'existe pas.
- Sur dev : ouvrir un flux par `chat_stream_url` avec un JWT valide, vérifier le 204 sans génération et le rejeu depuis un curseur, puis consulter les journaux d'accès de l'étage.
<!-- SECTION:FINAL_SUMMARY:END -->
