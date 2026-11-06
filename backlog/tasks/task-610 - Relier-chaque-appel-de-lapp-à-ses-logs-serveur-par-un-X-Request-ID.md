---
id: TASK-610
title: Relier chaque appel de l'app à ses logs serveur par un X-Request-ID
status: Done
assignee: []
created_date: '2026-11-06 16:49'
updated_date: '2026-11-06 17:17'
labels:
  - mobile
  - observability
dependencies: []
references:
  - packages/core/src/api/apiClient.ts
  - mobile/src/services/apiClient.ts
  - web/src/api.ts
  - media_summarizer/api/main.py
  - mobile/src/lib/crashReporting.ts
  - web/src/lib/crashReporting.ts
  - docs/compliance/apple-app-privacy.md
  - docs/compliance/google-play-data-safety.md
  - docs/compliance/privacy-policy.md
  - mobile/MOBILE_CI_CD.md
priority: high
type: feature
ordinal: 217000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code, documentation et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

## Constat (2026-11-06)

Le backend est prêt pour la corrélation. `request_id_middleware` (`media_summarizer/api/main.py`) reprend un `X-Request-ID` reçu, le pose sur toutes les lignes de log de la requête via `bind_log_context`, et le renvoie dans la réponse. Sinon, il génère un UUID.

L'app, elle, n'envoie pas d'en-tête et ne garde pas celui de la réponse. Passer d'un événement Sentry aux logs CloudWatch demande donc de recouper l'heure et la route à la main.

## Attendu

- Le client API partagé (`packages/core/src/api/apiClient.ts`) génère un identifiant unique par requête et l'envoie en `X-Request-ID`. Cela couvre mobile et web.
- L'identifiant suit chaque appel dans Sentry : dans le breadcrumb HTTP, et en tag `request_id` sur l'événement quand une erreur suit l'appel. Ce tag sert à la tâche qui remontera les échecs vus par l'utilisateur.
- La documentation donne la requête CloudWatch Logs Insights qui retrouve les logs d'un `request_id`, avec le groupe de logs de l'API dev.

## Décision de l'owner (2026-11-06) : conformité

L'owner accepte que les données de diagnostic deviennent « liées à l'identité ». Le `request_id` joint un événement Sentry aux logs serveur, qui sont liés au compte. Les déclarations doivent donc passer à « liées : oui » :
- Diagnostics / Crash Data et Performance Data dans `docs/compliance/apple-app-privacy.md`, qui affirme aujourd'hui l'inverse (ligne « The linked answer… ») ;
- l'équivalent dans `docs/compliance/google-play-data-safety.md` ;
- `privacy-policy.md` si elle décrit les rapports Sentry comme non rattachables.

`Sentry.setUser` reste interdit : aucun identifiant de compte n'est envoyé à Sentry. La jonction se fait côté serveur.

## Note à l'owner (hors critères)

- Reporter le changement de déclaration dans App Store Connect (App Privacy) et dans la Play Console (Data safety). C'est une action humaine, dans des consoles auxquelles l'agent n'a pas accès.
- Après déploiement, provoquer une erreur et retrouver ses logs serveur à partir du tag `request_id`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Chaque requête du client API partagé (mobile et web) porte un en-tête `X-Request-ID` unique, généré côté app, et que le middleware existant reprend tel quel.
- [x] #2 L'identifiant apparaît dans les breadcrumbs HTTP Sentry et en tag `request_id` sur un événement envoyé après l'échec de cet appel, sur mobile et sur web ; aucun identifiant de compte n'est envoyé à Sentry (`Sentry.setUser` toujours absent).
- [x] #3 La CORS de l'API dev autorise l'en-tête `X-Request-ID` pour le web, vérifié dans la configuration Terraform ou FastAPI ; l'agent le modifie s'il manque.
- [x] #4 `docs/compliance/apple-app-privacy.md` et `google-play-data-safety.md` déclarent Crash Data et Performance Data comme liées à l'identité, avec la raison (jonction par `request_id` avec les logs serveur) ; `privacy-policy.md` est cohérente.
- [x] #5 `mobile/MOBILE_CI_CD.md`, section Sentry, décrit le tag `request_id` et donne la requête CloudWatch Logs Insights pour retrouver les logs serveur correspondants.
- [x] #6 Le commit porte la ligne `Web: done`.
- [x] #7 `tsc` et le lint passent dans `mobile/`, `web/` et `packages/core` ; `ruff` passe si du Python est touché.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Ce qui a été fait

- **Client partagé** (`packages/core/src/api/apiClient.ts`) : `apiRequest` génère un UUID par requête HTTP via `platform.newRequestId()` et l'envoie en `X-Request-ID` (`REQUEST_ID_HEADER`). Le rejeu après un 401 reçoit son propre id. L'erreur levée porte `requestId` : `HttpError` sur une réponse non-ok, et l'erreur de transport (hors ligne, timeout) quand `fetch` rejette. `requestIdOf(error)` le relit ; task-611 s'en servira.
- **Plateformes** : mobile `newRequestId: () => Crypto.randomUUID()` (`expo-crypto`, déjà en dépendance) ; web `crypto.randomUUID()`.
- **Sentry** : `beforeBreadcrumb` ajoute `data.request_id` aux breadcrumbs HTTP. Sur mobile, il le lit dans l'en-tête enregistré par l'instrumentation XHR du SDK (le `fetch` RN passe par XHR) ou, à défaut, dans l'en-tête renvoyé par l'API. Sur web, il le lit dans `hint.response`, sinon dans les en-têtes de la requête. `beforeSend` (fonction `prepareEvent`) pose le tag `request_id` quand l'exception vient d'un appel échoué. `Sentry.setUser` reste absent : vérifié par grep, les seuls `setUser` sont l'état React de session du web.
- **CORS (AC #3)** : déjà en place. `infrastructure/terraform/modules/platform/lambda_api.tf:150` autorise `x-request-id` et l'expose (`expose_headers`). Aucune modification nécessaire. Le middleware FastAPI reprend l'en-tête sans le valider.
- **Conformité** : `apple-app-privacy.md` passe Crash Data et Performance Data à « Yes », avec la raison. `google-play-data-safety.md` : le formulaire Play n'a pas de question « lié à l'identité », j'ai donc ajouté un paragraphe qui explique la jonction. `privacy-policy.md` §2.4 mentionne l'identifiant de requête et la jonction avec les logs (Last updated 2026-11-06).
- **Doc** : `mobile/MOBILE_CI_CD.md`, section Sentry : ligne `request_id` dans le tableau, nouvelle sous-section « Request id: from an event to the server logs » avec la requête Logs Insights sur `/aws/lambda/media-summarizer-api-dev`, et paragraphes « no user identity » et « Anonymous per-installation context » mis à jour.

## Vérifications

- `tsc` + lint propres dans `packages/core`, `mobile/` et `web/`. Pas de Python touché.
- Groupe de logs confirmé sur dev (`aws logs describe-log-groups`). La requête documentée a été lancée sur dev avec un `request_id` réel des 3 derniers jours : statut Complete, la ligne correspondante est retrouvée.

## Hors périmètre

- Le flux SSE du chat (`CHAT_STREAM_URL`, API Gateway dédiée dont la CORS n'autorise que `authorization`) passe par `sendAuthenticated` avec sa propre requête, pas par `apiRequest`. Il ne porte pas d'`X-Request-ID`, et c'est documenté. L'ajouter demanderait d'élargir la CORS de `chat_stream.tf`.

## Reste à l'owner (hors critères)

- Reporter le changement dans App Store Connect (App Privacy : Crash Data et Performance Data → Linked to you). Côté Play Console, rien à changer dans Data safety, faute de question équivalente.
- Republier la politique (`scripts/publish_legal_site.sh`).
- Après déploiement, provoquer une erreur et retrouver ses logs serveur à partir du tag `request_id`.
<!-- SECTION:NOTES:END -->
