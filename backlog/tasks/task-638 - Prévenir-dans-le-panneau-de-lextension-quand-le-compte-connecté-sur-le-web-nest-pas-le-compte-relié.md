---
id: TASK-638
title: >-
  Prévenir dans le panneau de l'extension quand le compte connecté sur le web
  n'est pas le compte relié
status: To Do
assignee: []
created_date: '2026-11-20 17:16'
labels:
  - extension
  - backend
  - feature
dependencies: []
references:
  - extension/lib/session.ts
  - extension/entrypoints/sidepanel/main.ts
  - extension/entrypoints/sidepanel/index.html
  - extension/entrypoints/sidepanel/style.css
  - extension/scripts/messages.py
  - extension/README.md
  - media_summarizer/api/dependencies/session.py
  - media_summarizer/api/endpoints/auth.py
  - media_summarizer/core/services/cognito_auth.py
  - >-
    backlog/tasks/task-634 -
    Montrer-à-quel-compte-lextension-est-reliée-et-permettre-de-la-relier-au-compte-connecté-sur-le-web.md
priority: medium
type: feature
ordinal: 237000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Constat (owner, 2026-11-20)

TASK-634 affiche en permanence le compte relié dans le panneau, et Mon compte › Extension navigateur signale un compte différent. Mais ce signal n'apparaît que si l'on ouvre cette page web. Le panneau, lui, n'avertit jamais : on peut être connecté à B sur le web et enregistrer dans A sans le voir. Claude in Chrome affiche dans ce cas un bandeau « … utilise un autre compte ».

## Décision (owner, 2026-11-20)

L'extension lit elle-même quel compte est connecté sur le web, **par le cookie de session web**, et non par un message envoyé par l'app web. Raisons : ça marche aussi sur Firefox, et ça reste juste même si l'app web n'a pas été rouverte depuis le changement de compte.

Les sessions restent indépendantes (TASK-634) : aucune synchronisation automatique. Se déconnecter du web ne déclenche aucun bandeau.

## Ce qu'il faut savoir avant de commencer

- La session web est le cookie HttpOnly `__Secure-refresh_token`, `SameSite=Strict`, `Path=/api/auth`, posé par l'API (`media_summarizer/api/dependencies/session.py`). L'extension a déjà la permission sur l'hôte de l'API (`extension/wxt.config.ts`, `host_permissions`) : **aucune permission à ajouter**.
- Ce cookie contient un refresh token Cognito opaque. Pour en tirer le compte, il faudrait appeler Cognito (`get_tokens_from_refresh_token`), qui fait tourner le jeton. **On ne s'en sert pas pour cette route.**
- Il faut donc un second cookie, posé à côté du premier, qui identifie le compte sans pouvoir être forgé par le client. Sinon on pourrait lire l'e-mail de n'importe quel compte en changeant l'identifiant. Il ne doit pas non plus servir d'accès à l'API. Piste préférée, sans nouveau secret : l'ID token Cognito (`tokens["IdToken"]` dans `answer_session`), dont la route vérifie la signature avec les clés déjà utilisées dans `core/services/cognito_auth.py`. Son expiration est ignorée, car on veut seulement savoir qui c'est, pas autoriser une action. L'implémenteur peut choisir une autre solution qui respecte ces deux contraintes, en écrivant pourquoi dans les notes.

## Le comportement attendu

**Backend**
- À chaque réponse de session web (`session_response` en mode cookie : connexion, OAuth, rafraîchissement), poser ce cookie d'identité : HttpOnly, Secure, `SameSite=Strict`, chemin `/api/auth`, même durée de vie que le cookie de rafraîchissement.
- L'effacer partout où `clear_refresh_cookie` efface le cookie de rafraîchissement.
- Nouvelle route `GET /api/auth/web-account`, sous `/api/auth` pour que le cookie l'accompagne. Elle ne lit que ce cookie et ne fait tourner aucun jeton. Elle répond `{ "account": { "id", "email" } }` avec notre identifiant de compte (celui que renvoie `/api/auth/me`) et l'e-mail courant lu en base, ou `{ "account": null }` sans cookie ou si le cookie n'est pas valide. Réponse `Cache-Control: no-store`.

**Extension (Chrome, Edge et Firefox)**
- Appel `fetch(…/api/auth/web-account, { credentials: "include" })` à l'ouverture du panneau, quand il redevient visible ou reprend le focus, et après chaque enregistrement.
- Comparaison avec `linkedAccount().id`. Le bandeau s'affiche seulement si les deux comptes existent et diffèrent.
- Tout échec (réseau, 404 avant le déploiement backend, cookie absent) : aucun bandeau, aucune erreur visible.
- **Le bandeau** (pas de maquette : l'owner l'a écartée le 2026-11-20) :
  - il est placé sous l'encart « Compte relié », en teinte ambrée d'avertissement, distincte du bandeau d'erreur rouge existant ;
  - titre : « Un autre compte est connecté sur le web » ;
  - texte : « Sur Deepn, vous utilisez » puis l'e-mail du compte web sur sa propre ligne, tronqué par des points de suspension s'il est trop long, puis « Vos enregistrements vont dans le compte relié ci‑dessus. » ;
  - **Passer à ce compte** ouvre `ACCOUNT_EXTENSION_URL`, où le bandeau existant de TASK-634 relie l'extension en un clic ;
  - **Garder l'actuel** retient dans `storage.local` l'identifiant du compte web ignoré. Le bandeau revient seulement quand le compte web change.
- Libellés dans les 11 catalogues, via `scripts/messages.py`.

## Hors périmètre

- `whoami` et le bandeau de Mon compte (TASK-634) restent tels quels.
- Pas de synchronisation automatique des sessions.

## Note owner (hors AC)

Ordre de livraison : l'extension part en revue des stores à chaque push. Si elle arrive avant l'API, la route renvoie 404 et l'extension n'affiche simplement rien.

Après le déploiement de l'API, vérifier dans Chrome, Edge et Firefox que le cookie `SameSite=Strict` accompagne bien la requête de l'extension. C'est le point incertain de cette approche, surtout le cloisonnement des cookies de Firefox (Total Cookie Protection). Scénario : relier l'extension au compte A, se connecter à B sur le web, fermer l'onglet web, ouvrir le panneau. Le bandeau doit apparaître. « Garder l'actuel » doit le masquer ; il revient si l'on se connecte à un troisième compte. Une déconnexion du web ne doit afficher aucun bandeau.

Mettre à jour la déclaration des données du Chrome Web Store si besoin : l'extension lit désormais quel compte est connecté sur le web.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Toute réponse de session web (mode cookie) pose un cookie d'identité HttpOnly, Secure, SameSite=Strict, Path=/api/auth, que le client ne peut pas forger et qui ne permet pas d'appeler l'API ; il est effacé partout où le cookie de rafraîchissement l'est
- [ ] #2 `GET /api/auth/web-account` lit seulement ce cookie, n'appelle pas Cognito et ne fait tourner aucun jeton, et répond `{account: {id, email}}` ou `{account: null}` avec `Cache-Control: no-store`
- [ ] #3 Le panneau interroge cette route avec `credentials: "include"` à l'ouverture, au retour de visibilité ou de focus, et après chaque enregistrement, sur Chrome, Edge et Firefox ; tout échec n'affiche rien
- [ ] #4 Le bandeau décrit dans la description s'affiche sous l'encart du compte relié quand le compte web existe et diffère du compte relié, avec « Passer à ce compte » (ouvre `ACCOUNT_EXTENSION_URL`) et « Garder l'actuel » (retient le compte web ignoré dans `storage.local` ; le bandeau revient quand le compte web change)
- [ ] #5 Les nouveaux libellés sont dans les 11 catalogues `_locales`, régénérés par `scripts/messages.py`
- [ ] #6 `extension/README.md` (« Session et permissions ») décrit le cookie d'identité, la route et le bandeau, et la limite au cas où le navigateur n'envoie pas le cookie
- [ ] #7 `ruff` et `mypy` passent sur le backend modifié ; `npm run typecheck`, `npm run lint`, `npm run build` et `npm run build:firefox` passent dans `extension/`
<!-- AC:END -->
