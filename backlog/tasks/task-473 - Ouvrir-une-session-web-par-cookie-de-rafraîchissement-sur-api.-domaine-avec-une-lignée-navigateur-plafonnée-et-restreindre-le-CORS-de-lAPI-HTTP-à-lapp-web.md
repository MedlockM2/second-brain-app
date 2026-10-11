---
id: TASK-473
title: >-
  Ouvrir une session web par cookie de rafraîchissement sur api.<domaine>, avec
  une lignée navigateur plafonnée, et restreindre le CORS de l'API HTTP à l'app
  web
status: To Do
assignee: []
created_date: '2026-10-11 15:55'
labels:
  - backend
  - auth
  - web
  - feature
dependencies:
  - TASK-445
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - >-
    docs/research/task-424-website-and-browser-extension/README.owner-rejected-2026-10-10.md
  - media_summarizer/api/endpoints/auth.py
  - media_summarizer/api/endpoints/auth_social.py
  - media_summarizer/api/dependencies/auth.py
  - infrastructure/terraform/modules/platform/lambda_api.tf
  - docs/AUTHENTICATION_SETUP.md
priority: medium
type: feature
ordinal: 80000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-03** du §3 du complément.

L'app web garde son access token en mémoire seulement ; le refresh doit vivre dans un cookie `HttpOnly` posé par `api.<domaine>`. Le cookie est `SameSite=Strict` et lu depuis `app.<domaine>`, donc sur le même site enregistrable. Avec l'URL `execute-api` actuelle, ce serait un cookie tiers, bloqué par les navigateurs : **task-445 (domaine `api.`) précède donc cette tâche** (complément §5).

## Périmètre

- Un **mode web** des routes `login`, `register`, `google/native` et `apple/native` : il pose le refresh en cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth` et ne renvoie que l'access token dans le corps. `/refresh` et `/logout` lisent ce cookie en mode web. La façon de choisir le mode (en-tête, champ) est laissée à l'implémentation et documentée.
- Une **lignée de type navigateur**, à côté de la lignée mobile existante (`lineage_id`, rotation, fenêtre de rejeu) : elle a un **plafond absolu** et une **expiration par inactivité**, et la rotation ne prolonge jamais la durée initiale (RFC 10017 §6.3.2.3, analysée au §1.2 de `README.owner-rejected-2026-10-10.md`). La lignée mobile ne change pas. Les durées exactes se choisissent à l'implémentation et sont écrites.
- Le CORS de l'API HTTP (`cors_configuration` de `infrastructure/terraform/modules/platform/lambda_api.tf`) passe de `allow_origins = ["*"]` à l'origine `https://app.<domaine>` avec `allow_credentials = true` : un cookie n'est pas envoyé vers une origine `*`. L'origine est une variable Terraform. Le 2026-10-11, le pré-vol sur dev répondait encore `access-control-allow-origin: *` (complément §6). Rien n'est déployé : pas de maintien de `*` « pour la transition ». L'app mobile n'est pas soumise au CORS.
- La connexion Google et Apple sur le web n'a rien à changer côté audiences : le serveur accepte déjà `GOOGLE_CLIENT_ID` et `APPLE_CLIENT_ID` (complément §4).

## Règles

Rien n'est déployé : aucune compatibilité, aucun double chemin. Pas de tests automatisés ni d'appel in-process de l'app FastAPI comme vérification. Pas de route sous `/api/v1/`. Aucun secret dans les fichiers suivis.

## Note à l'owner

Après `apply` et déploiement : depuis `https://app.<domaine>` (ou une page servie sur cette origine), se connecter, vérifier le cookie `HttpOnly` sur `api.<domaine>`, rafraîchir, se déconnecter ; vérifier que le pré-vol de l'API HTTP renvoie l'origine de l'app et non `*`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 En mode web, login, register, google/native et apple/native posent le refresh en cookie HttpOnly; Secure; SameSite=Strict; Path=/api/auth et ne renvoient que l'access token dans le corps ; /refresh et /logout lisent ce cookie
- [ ] #2 La lignée de type navigateur a un plafond absolu et une expiration par inactivité, la rotation ne prolonge pas la durée initiale, et la lignée mobile est inchangée
- [ ] #3 La politique de durée par type de lignée est écrite et documentée dans docs/AUTHENTICATION_SETUP.md, avec le choix du mode web
- [ ] #4 La cors_configuration de l'API HTTP nomme l'origine de l'app web par une variable Terraform, avec allow_credentials = true et sans *
- [ ] #5 ruff check, mypy et terraform validate passent
<!-- AC:END -->
