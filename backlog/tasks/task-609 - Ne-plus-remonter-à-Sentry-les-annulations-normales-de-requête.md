---
id: TASK-609
title: Ne plus remonter à Sentry les annulations normales de requête
status: Done
assignee: []
created_date: '2026-11-06 16:48'
updated_date: '2026-11-06 17:10'
labels:
  - mobile
  - observability
dependencies: []
references:
  - packages/core/src/cache/resourceCache.ts
  - mobile/src/services/resourceCache.ts
  - mobile/src/lib/crashReporting.ts
  - mobile/src/lib/startupErrorGuard.ts
  - web/src/lib/crashReporting.ts
priority: high
type: bug
ordinal: 216000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

## Constat (2026-11-06)

La seule issue Sentry du projet est « Error: Resource request superseded » (2 événements, build 25, apparue le 2026-11-06). Ce n'est pas un bug : le cache de ressources rejette avec `ResourceSupersededError` une requête devenue obsolète, par exemple après un changement de compte ou une lecture plus récente (`mobile/src/services/resourceCache.ts`). Certains appelants l'ignorent (`useChatHistory`, `useMediaDetailPolling` via `isResourceSuperseded`). Au moins un autre la laisse filer en promesse non gérée, que `startupErrorGuard` envoie à Sentry comme `unhandled-rejection`.

Ce bruit compte : la règle d'alerte « New issue after a release » envoie un email à chaque nouvelle issue. Avant la bêta, une alerte doit correspondre à un vrai problème. C'est aussi un préalable à la tâche qui remontera les échecs vus par l'utilisateur : sans ce filtre, ces annulations y seraient envoyées aussi.

## Attendu

- Corriger à la source les appelants qui laissent filer `ResourceSupersededError`.
- En plus, un filtre dans `beforeSend` (mobile et web) qui écarte toute annulation normale : `ResourceSupersededError`, `AbortError` d'un `fetch` annulé volontairement. Un filtre seul masquerait les promesses non gérées sans les corriger.
- Le web utilise le même cache (`packages/core`) et a désormais Sentry (task-604) : même règle.

## Note à l'owner (hors critères)

Après déploiement, marquer l'issue « Resource request superseded » comme résolue dans Sentry. Vérifier qu'elle ne réapparaît pas sur la build suivante.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Chaque appel qui peut rejeter avec `ResourceSupersededError` est soit attendu avec un `catch` qui l'ignore via `isResourceSuperseded`, soit couvert par un appelant qui le fait ; aucun site d'appel mobile ou web ne la laisse en promesse non gérée.
- [x] #2 `beforeSend` de `mobile/src/lib/crashReporting.ts` et de `web/src/lib/crashReporting.ts` écarte les annulations normales (`ResourceSupersededError`, `AbortError` d'une requête annulée) ; la règle est écrite une fois dans `packages/core` si elle ne dépend d'aucune plateforme.
- [x] #3 Les vraies erreurs restent remontées : le filtre ne s'appuie que sur le type ou le nom de l'erreur, jamais sur un message générique.
- [x] #4 Le commit porte la ligne `Web: done`.
- [x] #5 `tsc` et le lint passent dans `mobile/`, `web/` et `packages/core`.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Ce qui a été fait

- `packages/core/src/errors/cancellation.ts` : `isNormalCancellation(error)`, vrai pour `ResourceSupersededError` (par `instanceof`) et pour toute erreur nommée `AbortError`. Pas de test sur le message. `ResourceSupersededError` porte maintenant `name = "ResourceSupersededError"`.
- `beforeSend` mobile (`mobile/src/lib/crashReporting.ts`) et web (`web/src/lib/crashReporting.ts`) : renvoie `null` quand `hint.originalException` est une annulation normale. Cela couvre aussi ce que `startupErrorGuard` envoie par `captureCaughtError`, qui passe l'erreur d'origine.
- Fuite corrigée à la source : `useHomeSections.refreshRecent` attendait `EngagementService.listRecent` sans `catch`. `useProcessingRefresh` l'appelle en `void refetch()` à chaque tick tant qu'une entrée « Continue learning » est en attente, donc une lecture remplacée (changement de compte, invalidation) devenait une promesse non gérée. C'est la source probable de l'issue « Resource request superseded ». La fonction ne rejette plus : l'échec réel est déjà publié par le snapshot.
- Deux écrans affichaient à tort une erreur sur une lecture remplacée. Ils l'ignorent maintenant via `isResourceSuperseded` : `app/review/index.tsx` (load de la file) et `app/(tabs)/search.tsx` (`loadMoreMedia`).

## Recensement (AC #1)

Mobile, appelants de `readResource` (services digest, organization, chat, artifact, engagement, media) : tous les autres sites sont dans un `try/catch` ou un `.catch(() => {})`, un `Promise.allSettled`, ou un appelant qui les couvre (`useChatHistory` et `useMediaDetailPolling` via `isResourceSuperseded`). `invalidate`/`revalidateActive` du cache attrapent déjà. Web : `readCached` est appelé avec `.catch` (HomePage) ou `Promise.allSettled` (useDigest), et `useCachedResource.reload` attrape. Aucun autre site ne laisse filer l'erreur.

## Vérifications

`tsc` + lint propres dans `packages/core`, `mobile/` (typecheck + eslint des fichiers touchés) et `web/` (typecheck + eslint).

## Reste à l'owner (hors critères)

Après déploiement, résoudre l'issue « Resource request superseded » dans Sentry et vérifier qu'elle ne revient pas sur la build suivante. Son titre changera (nom `ResourceSupersededError`) si une instance passait encore : elle serait de toute façon écartée par `beforeSend`.
<!-- SECTION:NOTES:END -->
