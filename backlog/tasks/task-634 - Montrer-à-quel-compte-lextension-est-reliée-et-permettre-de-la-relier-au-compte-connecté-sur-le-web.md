---
id: TASK-634
title: >-
  Montrer à quel compte l'extension est reliée et permettre de la relier au
  compte connecté sur le web
status: Done
assignee: []
created_date: '2026-11-19 11:20'
updated_date: '2026-11-19 13:47'
labels:
  - extension
  - feature
dependencies: []
references:
  - extension/lib/session.ts
  - extension/entrypoints/background.ts
  - extension/entrypoints/sidepanel/main.ts
  - web/src/pages/AccountPage.tsx
  - media_summarizer/api/endpoints/auth.py
  - 'https://clerk.com/docs/guides/sessions/sync-host'
  - >-
    https://claudeissues.com/issue/82455-claude-in-chrome-extension-stays-bound-to-first-signed-in-account-after-logout-r
priority: medium
type: bug
ordinal: 233000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Constat (owner, 2026-11-19)

L'extension a été reliée au compte A. Sur l'app web, l'owner s'est déconnecté de A puis connecté au compte B. L'extension enregistre toujours dans A, et rien ne le signale.

## Ce qui reste tel quel

L'extension garde sa propre session, indépendante de la session web (`extension/README.md`, « Session et permissions » ; task-485, task-487). C'est voulu : un clipper doit continuer à fonctionner quand l'onglet web est fermé ou que sa session a expiré. 1Password et Claude in Chrome fonctionnent de la même manière. **Se déconnecter du web ne doit pas déconnecter l'extension.** Cette tâche n'introduit donc aucune synchronisation automatique des sessions.

## Défauts à corriger

1. **Compte invisible.** Le panneau n'affiche nulle part l'e-mail du compte relié. On peut enregistrer dans le mauvais compte sans s'en apercevoir. `GET /api/auth/me` (`media_summarizer/api/endpoints/auth.py:351`) renvoie déjà `email` et accepte le jeton de l'extension : a priori, aucun changement backend.
2. **Décalage invisible côté web.** Mon compte › Extension navigateur (`web/src/pages/AccountPage.tsx`, `ExtensionPane`) ne sait pas si l'extension installée est reliée à un autre compte.
3. **Ancien accès jamais révoqué.** Quand on relie l'extension à un nouveau compte, `savePairing` (`extension/lib/session.ts:58`) écrase le grant précédent sans le révoquer. L'ancienne lignée reste valide côté serveur et figure toujours dans la liste du compte A.

## Hors périmètre

- Firefox n'a pas `externally_connectable` : seul le point 1 s'y applique. Le point 2 concerne Chrome et Edge.
- Pas de maquette : l'owner l'a écartée pour cette tâche.

## Note owner (hors AC)

Après le déploiement, rejouer le scénario A → déconnexion web → B : vérifier l'e-mail dans le panneau, la proposition dans Mon compte, puis la disparition de l'extension dans la liste du compte A.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L'e-mail du compte relié, lu sur `/api/auth/me`, est affiché en permanence dans le panneau de l'extension, visible sans aucun clic ni survol, dans un encart de largeur fixe (pas dans le menu « … » qui contient « Se déconnecter »). Une adresse trop longue est tronquée par des points de suspension (`text-overflow: ellipsis`) sans élargir l'encart ni passer à la ligne ; l'adresse complète est disponible en `title`
- [x] #2 Le background accepte un message externe `whoami`, réservé à `WEB_APP_ORIGIN` comme `pair`, qui renvoie seulement l'identifiant du compte relié (ou l'absence de liaison), jamais un jeton ni un e-mail
- [x] #3 Sur Chromium, `ExtensionPane` interroge l'extension installée : si elle est reliée à un autre compte que l'utilisateur connecté, la page le dit et propose « Relier à ce compte » via le flux d'appairage en un clic existant
- [x] #4 Avant de stocker un nouveau grant, le ré-appairage révoque au mieux l'ancien grant via `/api/auth/logout` ; un échec réseau n'empêche pas l'appairage
- [x] #5 `extension/README.md` décrit ce comportement : sessions web et extension indépendantes, compte affiché en permanence, ré-appairage qui révoque l'ancien accès
- [x] #6 `npm run build` et le typecheck de `extension/` et de `web/` passent sans erreur
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Précision de l'owner (2026-11-19) : l'e-mail doit se voir directement sur le panneau, jamais derrière un clic. « Se déconnecter » est dans le menu « … » (`extension/entrypoints/sidepanel/main.ts:158`), donc l'e-mail ne doit pas y être placé. Encart de taille fixe ; une adresse trop longue se termine par des points de suspension.

2026-11-19 — Fait dans la session principale (`/process-backlog`).

- **Encart du compte** (`entrypoints/sidepanel/index.html`, `style.css`, `main.ts`). « Compte relié » suivi de l'e-mail, en haut du panneau, hors du menu « … », visible dans tous les états tant que l'extension est reliée. Largeur fixe (`calc(100% - 32px)`), e-mail en `text-overflow: ellipsis` sur une seule ligne, adresse complète en `title`. L'e-mail vient de `/api/auth/me` (`lib/session.ts`, `linkedAccount`) et il est gardé dans `storage.local` ; il est oublié à la déconnexion, à l'expiration et au ré-appairage. Le libellé `linkedAccount` est ajouté aux 11 catalogues par `scripts/messages.py`.
- **`whoami`** (`entrypoints/background.ts`). Message externe accepté seulement depuis `WEB_APP_ORIGIN`, qui répond `{ ok: true, accountId }`. `accountId` est l'identifiant du compte ou `null` : jamais de jeton ni d'e-mail. Firefox n'a pas ce canal (`return` existant).
- **Mon compte › Extension navigateur** (`web/src/pages/AccountPage.tsx`). Sur Chromium, la page interroge chaque identifiant d'extension configuré. Si l'extension est reliée à un autre compte que l'utilisateur connecté, un bandeau le dit et propose « Relier à ce compte » (`ext.otherAccount`, `ext.linkHere`, 11 catalogues), qui lance l'appairage en un clic existant. La question est reposée après chaque appairage.
- **Révocation** (`savePairing`). Avant de stocker un nouveau grant, l'ancien est révoqué au mieux : `/refresh` avec l'ancien grant, puis `/logout` avec le jeton d'accès obtenu, le tout borné à 5 s par `AbortSignal.timeout`. Toute erreur est ignorée et l'appairage continue.
- `extension/README.md`, section « Session et permissions » : sessions indépendantes, encart permanent, `whoami`, révocation au ré-appairage.

Vérifié : `npm run typecheck`, `npm run build` et `npm run build:firefox` dans `extension/` ; `tsc --noEmit` et `npm run build` dans `web/`. Aucun changement backend : `/api/auth/me` accepte déjà le jeton de l'extension.

À vérifier par l'owner après déploiement (note de la description) : scénario compte A → déconnexion web → compte B. Contrôler l'e-mail dans le panneau, le bandeau dans Mon compte, puis la disparition de l'ancienne extension dans la liste du compte A.
<!-- SECTION:NOTES:END -->
