---
id: TASK-473
title: >-
  Ouvrir une session web par cookie de rafraîchissement sur api.<domaine>, avec
  une lignée navigateur plafonnée, et restreindre le CORS de l'API HTTP à l'app
  web
status: Done
assignee: []
created_date: '2026-10-11 15:55'
updated_date: '2026-10-11 16:52'
labels:
  - backend
  - auth
  - web
  - feature
dependencies: []
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
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-03** du §3 du complément.

L'app web garde son access token en mémoire seulement ; le refresh doit vivre dans un cookie `HttpOnly` posé par `api.<domaine>`. Le cookie est `SameSite=Strict` et lu depuis `app.<domaine>`, donc sur le même site enregistrable. Avec l'URL `execute-api` actuelle, ce serait un cookie tiers, bloqué par les navigateurs (complément §5). Le code de cette tâche ne dépend pas du domaine : celui-ci est un paramètre (variable Terraform pour l'origine de l'app web, configuration du cookie). Seul le **fonctionnement de bout en bout** attend que `api.<domaine>` existe (task-443 puis task-445). Décision de l'owner du 2026-10-11 : ne pas bloquer cette tâche ni le site web sur l'achat du domaine. Tant que le domaine n'existe pas, l'app web en local se connecte, mais sa session ne survit pas à un rechargement de la page.

## Périmètre

- Un **mode web** des routes `login`, `register`, `google/native` et `apple/native` : il pose le refresh en cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth` et ne renvoie que l'access token dans le corps. `/refresh` et `/logout` lisent ce cookie en mode web. La façon de choisir le mode (en-tête, champ) est laissée à l'implémentation et documentée.
- Une **lignée de type navigateur**, à côté de la lignée mobile existante (`lineage_id`, rotation, fenêtre de rejeu) : elle a un **plafond absolu** et une **expiration par inactivité**, et la rotation ne prolonge jamais la durée initiale (RFC 10017 §6.3.2.3, analysée au §1.2 de `README.owner-rejected-2026-10-10.md`). La lignée mobile ne change pas. Les durées exactes se choisissent à l'implémentation et sont écrites.
- Le CORS de l'API HTTP (`cors_configuration` de `infrastructure/terraform/modules/platform/lambda_api.tf`) passe de `allow_origins = ["*"]` à l'origine `https://app.<domaine>` avec `allow_credentials = true` : un cookie n'est pas envoyé vers une origine `*`. L'origine est une variable Terraform. Sur dev, tant que `app.<domaine>` n'existe pas, cette variable vaut l'origine du serveur local de l'app web. Le 2026-10-11, le pré-vol sur dev répondait encore `access-control-allow-origin: *` (complément §6). Rien n'est déployé : pas de maintien de `*` « pour la transition ». L'app mobile n'est pas soumise au CORS.
- La connexion Google et Apple sur le web n'a rien à changer côté audiences : le serveur accepte déjà `GOOGLE_CLIENT_ID` et `APPLE_CLIENT_ID` (complément §4).

## Règles

Rien n'est déployé : aucune compatibilité, aucun double chemin. Pas de tests automatisés ni d'appel in-process de l'app FastAPI comme vérification. Pas de route sous `/api/v1/`. Aucun secret dans les fichiers suivis.

## Note à l'owner

Cette vérification attend le domaine (task-443, puis task-445 pour `api.<domaine>`). Après `apply` et déploiement : depuis `https://app.<domaine>` (ou une page servie sur cette origine), se connecter, vérifier le cookie `HttpOnly` sur `api.<domaine>`, rafraîchir, se déconnecter ; vérifier que le pré-vol de l'API HTTP renvoie l'origine de l'app et non `*`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 En mode web, login, register, google/native et apple/native posent le refresh en cookie HttpOnly; Secure; SameSite=Strict; Path=/api/auth et ne renvoient que l'access token dans le corps ; /refresh et /logout lisent ce cookie
- [x] #2 La lignée de type navigateur a un plafond absolu et une expiration par inactivité, la rotation ne prolonge pas la durée initiale, et la lignée mobile est inchangée
- [x] #3 La politique de durée par type de lignée est écrite et documentée dans docs/AUTHENTICATION_SETUP.md, avec le choix du mode web
- [x] #4 La cors_configuration de l'API HTTP nomme l'origine de l'app web par une variable Terraform, avec allow_credentials = true et sans *
- [x] #5 ruff check, mypy et terraform validate passent
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Commit 13ec83a.

- **Mode web** : en-tête de requête `X-Session-Transport: cookie` (login, register, google/native, apple/native, refresh, logout). Le refresh part en cookie `__Secure-refresh_token` (`HttpOnly; Secure; SameSite=Strict; Path=/api/auth`, host-only, `Max-Age` = expiration de la lignée) ; le corps ne contient que `access_token`, `token_type`, `expires_in`, `user` (`WebSessionResponse`). /refresh et /logout lisent le cookie ; /logout l'efface. Un en-tête plutôt qu'un champ : pas de corps en mode web, et un en-tête personnalisé force le pré-vol CORS (garde CSRF en plus de SameSite=Strict).
- **Lignées** : `AuthToken.lineage_kind` (`mobile` | `browser`) et `lineage_started_at`, recopiés à chaque rotation. `get_refresh_token_expires_at(kind, lineage_started_at)` : mobile inchangé (glissant 1 an, sans plafond) ; browser = min(now + 7 j, login + 30 j). Chaque transport n'accepte que son type de lignée (401 sinon). Une ligne sans type est lue `mobile`, débutée à sa création.
- **Factorisation** : `open_session()` dans `media_summarizer/api/dependencies/session.py` remplace les cinq copies du bloc d'émission ; `NativeAuthResponse` fusionné dans `TokenVerificationResponse`.
- **CORS** : `cors_configuration` de l'API HTTP = `var.web_app_origin` (variable sans défaut, validée : vide ou origine nue, jamais `*`), `allow_credentials = true`, en-têtes nommés, PATCH ajouté, `X-Quota-Error-Code` exposé. dev : `http://localhost:5173` ; staging et prod : vide jusqu'à `app.<domaine>`. Le `CORSMiddleware` FastAPI (ignoré derrière le CORS d'API Gateway) et `CORS_ORIGINS` sont supprimés.
- **Doc** : `docs/AUTHENTICATION_SETUP.md` (table de politique par type de lignée, mode web, CORS).
- ruff, mypy, `terraform validate` (dev, staging, prod) passent.

Note owner : vérification de bout en bout après task-443/445, comme décrit dans la description. Le prochain `terraform apply` sur dev remplace `*` par `http://localhost:5173` : sans effet sur l'app mobile.
<!-- SECTION:FINAL_SUMMARY:END -->
