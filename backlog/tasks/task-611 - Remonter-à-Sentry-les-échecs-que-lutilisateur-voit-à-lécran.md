---
id: TASK-611
title: Remonter à Sentry les échecs que l'utilisateur voit à l'écran
status: Done
assignee: []
created_date: '2026-11-06 16:49'
updated_date: '2026-11-06 17:30'
labels:
  - mobile
  - observability
dependencies:
  - TASK-609
  - TASK-610
references:
  - mobile/src/lib/crashReporting.ts
  - mobile/src/lib/startupErrorGuard.ts
  - packages/core/src/api/apiClient.ts
  - mobile/src/contexts/ShareIntentContext.tsx
  - mobile/src/services/presignedUpload.ts
  - web/src/lib/crashReporting.ts
  - web/src/media/ingest.ts
  - mobile/MOBILE_CI_CD.md
priority: high
type: feature
ordinal: 218000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

## Constat (2026-11-06)

L'app n'envoie à Sentry que ce qui atteint le gestionnaire global d'erreurs (`startupErrorGuard` → `captureCaughtError`) : crash, erreur de rendu, promesse non gérée. Un échec traité et affiché à l'utilisateur ne laisse qu'un breadcrumb, que Sentry ne transmet que si un événement suit. Exemples : import refusé, chargement impossible, envoi vers S3 coupé, traitement en échec, chat qui ne répond pas. Pendant la bêta, ce sont la plupart des signalements, et Sentry n'en aura aucun.

Ce qu'AWS couvre déjà : les échecs côté serveur (5xx, erreurs Lambda, DLQ, échecs LLM, Deepgram, LlamaParse) ont leurs alarmes CloudWatch et leurs logs. Le manque porte donc sur **ce que seul l'appareil voit** : réseau absent, timeout, PUT S3 refusé ou coupé, fichier illisible, réponse inattendue. Il porte aussi sur la vue côté app d'un échec serveur, qui donne l'écran et le `request_id` (TASK-610).

## Attendu

Une fonction de capture des échecs gérés dans `crashReporting.ts`, mobile et web, appelée aux points centraux plutôt qu'écran par écran :
- **le client API partagé**, pour toute erreur réseau et toute réponse 5xx. Les 4xx attendues (401 de session expirée, 402/429 de quota, 404 d'un média supprimé) ne sont pas des événements : elles restent des breadcrumbs ;
- **`DirectUploadError`**, avec l'étape d'échec déjà calculée ;
- **`reportSaveFailed`** (`ShareIntentContext`) et son équivalent web ;
- les autres chemins qui affichent un échec à l'utilisateur, que l'agent recense et liste dans ses notes.

Chaque événement est au niveau `warning`, ou `error` pour un 5xx et un échec d'import. Il porte des tags filtrables : la route ou l'opération, le statut HTTP, l'étape d'échec, le type de média, le `request_id`. Il a un regroupement (fingerprint) stable par route et par cause, pour qu'une même panne fasse une issue et non cent.

Ne jamais envoyer : URL signée, query string, nom de fichier, texte saisi par l'utilisateur, contenu d'un média.

## Note à l'owner (hors critères)

Après déploiement, couper le réseau pendant un import et vérifier qu'une issue apparaît dans Sentry, avec son `request_id` et son étape d'échec.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une fonction de capture d'échec géré existe dans `mobile/src/lib/crashReporting.ts` et `web/src/lib/crashReporting.ts`, no-op sans DSN et qui ne lève jamais.
- [x] #2 Le client API partagé l'appelle pour toute erreur réseau et toute réponse 5xx ; les 4xx attendues (401, 402, 404, 429) ne créent pas d'événement.
- [x] #3 `DirectUploadError`, `reportSaveFailed` et leurs équivalents web créent un événement portant l'étape d'échec et le type de média ; les autres chemins qui affichent un échec sont recensés dans les notes, et câblés ou justifiés.
- [x] #4 Chaque événement porte les tags route ou opération, statut HTTP s'il existe, étape d'échec, et `request_id` (TASK-610), avec un fingerprint stable par route et par cause.
- [x] #5 Aucun événement ne contient d'URL signée, de query string, de nom de fichier, de texte saisi ni de contenu de média.
- [x] #6 `mobile/MOBILE_CI_CD.md`, section Sentry, décrit ces événements, leurs tags et la manière de les filtrer.
- [x] #7 Le commit porte la ligne `Web: done`.
- [x] #8 `tsc` et le lint passent dans `mobile/`, `web/` et `packages/core`.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Ce qui a été fait

- **Règles communes** dans `packages/core/src/errors/handledFailure.ts`. `HandledFailure` est fait d'enums et de chiffres, plus une route normalisée. `routeOf(method, path)` retire hôte, query et fragment, et replie les ids en `:id` et les segments encodés en `:value`. `failureCauseOf(error)` renvoie `network`, `http_<status>` ou `unexpected`, et `null` pour une annulation (task-609) ou un 4xx attendu (401, 402, 404, 429). `describeHandledFailure` produit message, niveau, tags et fingerprint.
- **Capture** : `captureHandledFailure` dans `mobile/src/lib/crashReporting.ts` et `web/src/lib/crashReporting.ts`. C'est un no-op sans DSN, qui ne lève jamais. Il envoie un `captureMessage` construit uniquement depuis ces champs : l'erreur d'origine n'est jamais envoyée, donc ni son message ni le texte du serveur. S'y ajoute `fetchReportingFailures`, qui rend le même service pour les appels qui ne passent pas par le client partagé.
- **Client API partagé** : nouveau `platform.onFailure`, branché sur `captureHandledFailure` (mobile et web). Il est appelé quand un appel ne reçoit pas de réponse (cause `network`, niveau warning) et sur un 5xx (`http_<status>`, niveau error). Les autres 4xx restent des breadcrumbs.
- **Upload** : `recordFailure` (`presignedUpload.ts`) envoie un événement `upload` pour chaque `DirectUploadError`. Il porte l'étape (`read_file` / `put_network` / `put_rejected`, avec le `<Code>` S3 dans la cause), le statut et la cible comme type de média. Le web fait de même dans `addFile` (PUT refusé ou coupé).
- **Import** : `reportSaveFailed` (`ShareIntentContext`) reçoit le type de média et envoie un événement `import` (niveau error, étape `submit`, statut, `request_id`). Exclus : quota, session expirée, `SharedContentValidationError` (refus local avant envoi) et `DirectUploadError` (déjà remonté par l'upload). Côté web, `reportImportFailure` dans `addLink`, `addNote` et `addFile` (étapes `sign` et `submit`). Le breadcrumb `save.failed` ne porte plus le message affiché, seulement la cause.
- **Doc** : `mobile/MOBILE_CI_CD.md`, sous-section « Handled failures » : opérations, tags, niveaux, fingerprint et filtres Sentry.

## Recensement des autres chemins qui affichent un échec

Câblés :
- Toutes les lectures d'écran (cache de ressources) et toutes les mutations (renommer, déplacer, supprimer, dossiers, chat `turns`, rapport de bug, etc.) passent par `apiRequest`. Elles sont couvertes au point central.
- Ouverture du flux de chat (`followStream`, mobile `chatService.ts` et web `chatClient.ts`), opération `chat.stream`. Il ne passe pas par `apiRequest`.
- Appels de connexion sans session : mobile `AuthService.postUnauthenticated` et config OAuth ; web `reportedAuthFetch` (login, oauth/token, refresh, logout, actions de compte, config OAuth). Opération `auth`.
- Prix du paywall (`fetchPublicPricing`, appel public direct), opération `pricing`.

Justifiés, non câblés :
- Refresh de session mobile (`sessionManager.postRefresh`) : il réessaie déjà seul (408, 429, 5xx, réseau). Son issue finale est une session expirée, qui est un cas attendu. Un 5xx de `/api/auth/refresh` est couvert par les alarmes CloudWatch de l'API.
- Échec de traitement (`processing_job.status = failed`) et budgets de polling épuisés (« stalled ») : l'échec est côté serveur et déjà couvert par les alarmes Lambda, DLQ et fournisseurs. L'app ne fait que lire un statut.
- Achats RevenueCat et connexion native Apple/Google : erreurs de SDK tiers, dont l'annulation par l'utilisateur est le cas courant. RevenueCat a son propre tableau de bord. Les appels à notre API qui suivent sont couverts (`auth`).
- Refus de validation locale (texte trop long, format non supporté, `prepareLocalUploadFile`) : c'est l'app qui refuse avant tout envoi. Ce n'est pas une panne.
- Upload d'un message vocal dans une conversation partagée : il passe par `stageUpload`, donc il est couvert.

## Choix notables

- Un import échoué sur un 5xx ou sans réseau produit deux événements : `api.request` pour l'appel et `import` pour ce que l'utilisateur a vu. Ils partagent le `request_id`, et c'est documenté. Une seule panne reste une issue par route et par cause, grâce au fingerprint `["handled-failure", operation, route, cause]`.

## Vérifications

- `tsc` + lint propres dans `packages/core`, `mobile/` (typecheck + eslint des fichiers touchés) et `web/` (typecheck + lint complet).
- `routeOf` et `failureCauseOf` contrôlés par un script jetable hors dépôt (pas de test ajouté). UUID, numérique, id mixte, `%20` et query string sont bien repliés ou retirés ; 503 → `http_503`, 429 → null, AbortError → null, TypeError → `network`.

## Reste à l'owner (hors critères)

Après déploiement, couper le réseau pendant un import et vérifier qu'une issue `upload` ou `import` apparaît dans Sentry, avec son étape et son `request_id`. La règle d'alerte « New issue after a release » va maintenant se déclencher aussi sur ces issues : il faudra peut-être la restreindre (par exemple `level:error`) si le bruit monte.
<!-- SECTION:NOTES:END -->
