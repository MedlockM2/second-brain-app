---
id: TASK-474
title: Ajouter le CORS de la façade de streaming du chat pour l'origine de l'app web
status: To Do
assignee: []
created_date: '2026-10-11 15:55'
labels:
  - backend
  - infrastructure
  - chat
  - feature
dependencies:
  - TASK-443
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - infrastructure/terraform/modules/platform/chat_stream.tf
  - media_summarizer/api/chat_stream_app.py
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 81000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-04** du §3 du complément.

Le `Decision`, point 6 (point déduit n° 2, accepté) : **la façade du flux garde son URL `execute-api`**, sans domaine personnalisé. Le flux s'authentifie par l'en-tête `Authorization`, pas par un cookie ; seul le CORS est ajouté.

Contrôle du complément §6, fait sur dev le 2026-10-11 (API REST `media-summarizer-chat-stream-dev`, stage `v1`) : `OPTIONS /v1/chat/conversations/{id}/stream` répond **403 `MissingAuthenticationTokenException`** (la ressource n'a pas de méthode `OPTIONS`), et le `GET` sans jeton répond 401 de la Lambda **sans** `Access-Control-Allow-Origin`. Un navigateur sur `app.<domaine>` ne passerait pas le pré-vol qu'impose l'en-tête `Authorization`.

Cette tâche dépend de task-443 seulement pour connaître l'origine ; l'origine reste une variable Terraform vide par défaut.

## Périmètre

- Une méthode `OPTIONS` sur la ressource `/chat/conversations/{conversation_id}/stream` de l'API REST (`chat_stream.tf`), en intégration mock, qui répond `Access-Control-Allow-Origin` (l'origine de l'app web, **jamais `*`**), `Access-Control-Allow-Headers: authorization` et `Access-Control-Allow-Methods: GET, OPTIONS`.
- Le même `Access-Control-Allow-Origin` sur les réponses de la Lambda de diffusion (`media_summarizer/api/chat_stream_app.py` : 200, 204, 401, 404, 409), pour l'origine configurée et pour elle seule.
- Le même en-tête sur les *gateway responses* 4xx et 5xx d'API Gateway : sinon le navigateur masque l'erreur au code.
- L'origine est une variable Terraform, vide par défaut, transmise à la Lambda.

## Règles

Rien n'est déployé : aucune compatibilité. Pas de tests automatisés. Aucun secret dans les fichiers suivis.

## Note à l'owner

Après `apply` et déploiement : relancer le pré-vol du complément §6 avec l'origine réelle (`OPTIONS` avec `Origin`, `Access-Control-Request-Method: GET`, `Access-Control-Request-Headers: authorization`) et vérifier `200` et les trois en-têtes, puis un `GET` sans jeton qui doit répondre 401 **avec** `Access-Control-Allow-Origin`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La ressource /chat/conversations/{conversation_id}/stream de l'API REST a une méthode OPTIONS en intégration mock qui répond Access-Control-Allow-Origin (origine de l'app web, jamais *), Access-Control-Allow-Headers: authorization et Access-Control-Allow-Methods: GET, OPTIONS
- [ ] #2 Les gateway responses 4xx et 5xx de cette API portent le même Access-Control-Allow-Origin, et l'origine est une variable Terraform vide par défaut
- [ ] #3 chat_stream_app.py émet Access-Control-Allow-Origin sur ses réponses 200, 204, 401, 404 et 409 pour l'origine configurée et pour elle seule
- [ ] #4 docs/CANONICAL_MEDIA_API_CONTRACT.md décrit le CORS de la façade de flux
- [ ] #5 terraform validate, ruff check et mypy passent
<!-- AC:END -->
