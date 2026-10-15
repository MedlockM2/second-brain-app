---
id: TASK-474
title: Ajouter le CORS de la façade de streaming du chat pour l'origine de l'app web
status: Done
assignee: []
created_date: '2026-10-11 15:55'
updated_date: '2026-10-15 22:25'
labels:
  - backend
  - infrastructure
  - chat
  - feature
dependencies: []
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
- [x] #1 La ressource /chat/conversations/{conversation_id}/stream de l'API REST a une méthode OPTIONS en intégration mock qui répond Access-Control-Allow-Origin (origine de l'app web, jamais *), Access-Control-Allow-Headers: authorization et Access-Control-Allow-Methods: GET, OPTIONS
- [x] #2 Les gateway responses 4xx et 5xx de cette API portent le même Access-Control-Allow-Origin, et l'origine est une variable Terraform vide par défaut
- [x] #3 chat_stream_app.py émet Access-Control-Allow-Origin sur ses réponses 200, 204, 401, 404 et 409 pour l'origine configurée et pour elle seule
- [x] #4 docs/CANONICAL_MEDIA_API_CONTRACT.md décrit le CORS de la façade de flux
- [x] #5 terraform validate, ruff check et mypy passent
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dépendance à task-443 retirée le 2026-10-16 (décision de l'owner) : l'origine est celle de chaque environnement, `web_app_origin` déjà défini par environnement pour l'API HTTP (`http://localhost:5173` en dev, vide en staging et prod tant que `app.<domaine>` n'existe pas). Pas de nouvelle variable : la façade de flux réutilise la même.

- `chat_stream.tf` : méthode `OPTIONS` en intégration mock dans le corps OpenAPI (Allow-Origin = l'origine, Allow-Headers `authorization`, Allow-Methods `GET,OPTIONS`, Max-Age 3600, Vary Origin) et `x-amazon-apigateway-gateway-responses` DEFAULT_4XX / DEFAULT_5XX avec le même Allow-Origin ; les deux n'existent que si l'origine est non vide. `WEB_APP_ORIGIN` est passé à la Lambda de diffusion.
- `chat_stream_app.py` : middleware ASGI pur (le flux n'est pas mis en tampon) qui ajoute Allow-Origin et `Vary: Origin` à toute réponse d'une requête portant exactement cette origine (200, 204, 401, 404, 409), rien pour une autre origine.
- `variables.tf` : nouvelle validation, une origine `http://` ou `localhost`/`127.0.0.1` n'est acceptée qu'en dev ; staging et prod prennent `https://app.<domaine>` ou rien. Expression vérifiée sur cinq cas.
- `docs/CANONICAL_MEDIA_API_CONTRACT.md` : section CORS de la façade.
- `.env.example` : `WEB_APP_ORIGIN`, et `CHAT_LEASE_SECONDS` / `CHAT_STREAM_MAX_SECONDS` qui manquaient au garde-fou.

Contrôles : `terraform validate` dev, staging, prod ; ruff et mypy sur `chat_stream_app.py` ; `check_env_example_complete.py` OK. Un appel en processus sur `/health` a confirmé l'en-tête pour l'origine configurée et son absence pour une autre.

Note owner : après le push, `terraform-dev.yml` applique dev et `deploy-lambda.yml` redéploie la Lambda ; relancer le pré-vol de la note.
<!-- SECTION:NOTES:END -->
