---
id: TASK-612
title: Joindre au rapport de bug intégré l'identifiant du dernier événement Sentry
status: Done
assignee: []
created_date: '2026-11-06 16:50'
updated_date: '2026-11-06 17:41'
labels:
  - mobile
  - observability
dependencies:
  - TASK-610
  - TASK-611
references:
  - mobile/app/bug-report.tsx
  - web/src/pages/AccountPage.tsx
  - media_summarizer/api/endpoints/bug_reports.py
  - mobile/src/lib/crashReporting.ts
  - web/src/lib/crashReporting.ts
  - scripts/sentry_issue.py
  - mobile/MOBILE_CI_CD.md
priority: medium
type: feature
ordinal: 219000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

## Constat (2026-11-06)

Le rapport de bug intégré (`mobile/app/bug-report.tsx`, `BugReportPane` sur le web, `POST /api/bug-reports`) est déjà la meilleure entrée de la bêta. Il est stocké sur AWS (DynamoDB, pièce jointe dans S3), lié au compte et, depuis task-381, au média concerné. L'alarme `bug_report_created` envoie un email à l'owner à chaque rapport.

Il ne contient pourtant rien qui mène à Sentry. Pour retrouver le crash ou l'échec qui a précédé, il faut recouper l'heure, la build et l'appareil à la main.

## Attendu

- L'app joint au rapport l'identifiant du dernier événement Sentry de la session, s'il existe (`Sentry.lastEventId()`), ainsi que la build et l'update OTA en cours. Le web fait de même avec son SDK.
- Le serveur accepte ce champ optionnel, valide son format (32 caractères hexadécimaux) et le stocke avec le rapport. Il ne l'accepte jamais comme texte libre.
- La documentation explique comment passer d'un rapport à son issue Sentry : URL de l'événement, ou `scripts/sentry_issue.py`.

## Conformité

L'owner a accepté le 2026-11-06 que les diagnostics soient « liés à l'identité ». TASK-610 met à jour les déclarations. Cette tâche vérifie qu'elles couvrent aussi ce lien (rapport → événement Sentry) et les complète si besoin. `Sentry.setUser` reste interdit.

## Note à l'owner (hors critères)

Après déploiement, provoquer un échec, envoyer un rapport de bug, et ouvrir l'événement Sentry à partir de l'identifiant stocké.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le rapport de bug mobile et le rapport de bug web envoient l'identifiant du dernier événement Sentry quand il existe, et ne l'envoient pas sinon.
- [x] #2 `CreateBugReportRequest` accepte ce champ optionnel, refuse en 422 toute valeur qui n'est pas 32 caractères hexadécimaux, et le stocke dans l'enregistrement DynamoDB du rapport.
- [x] #3 Le rapport porte aussi la build et l'update OTA en cours, sans identifiant de compte côté Sentry.
- [x] #4 Les déclarations de `docs/compliance/` couvrent le lien entre rapport et événement Sentry, complétées si TASK-610 ne l'a pas fait.
- [x] #5 `mobile/MOBILE_CI_CD.md`, section Sentry, explique comment passer d'un rapport à son événement Sentry.
- [x] #6 Le commit porte la ligne `Web: done`.
- [x] #7 `tsc` et le lint passent dans `mobile/`, `web/` et `packages/core` ; `ruff` et `mypy` passent sur le Python touché.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Ce qui a été fait

- **Règle commune** : `packages/core/src/api/bugReportDiagnostics.ts`. Il construit `{sentry_event_id, source_app_build, ota_update_id}` et n'y met que les valeurs au bon format (32 hex, jeton de build, UUID). Une valeur malformée est omise, pour ne jamais faire refuser le rapport.
- **Mobile** : `currentBugReportDiagnostics()` dans `crashReporting.ts`. Il lit `Sentry.lastEventId()` (seulement avec un DSN), `Application.nativeBuildVersion` (c'est le `dist` de Sentry) et `Updates.updateId`, et ne lève jamais. `BugReportService.createBugReport` l'ajoute à chaque envoi, ce qui couvre le formulaire `app/bug-report.tsx` comme `SourceSupportRequestCard`.
  - Ajout de `expo-application` (~55.0.19) en dépendance directe de `mobile/`. Justification : le build est en `appVersionSource: remote` avec auto-incrément, donc la config Expo ne connaît pas le numéro réel. Le module était déjà installé et autolinké par `expo-auth-session` et `expo-notifications`, en même version : aucun code natif nouveau. Le lockfile ne change que d'une ligne.
- **Web** : `currentBugReportDiagnostics()` (`Sentry.lastEventId()`), ajouté au corps envoyé par `BugReportPane` (AccountPage). Le bundle web n'a ni numéro de build ni update OTA : seul l'id d'événement part, et c'est documenté.
- **API** : `CreateBugReportRequest` reçoit `sentry_event_id` (`^[0-9a-fA-F]{32}$`, stocké en minuscules), `source_app_build` et `ota_update_id`, chacun avec un `pattern` pydantic : toute autre valeur donne un 422. Le tout est stocké dans l'item DynamoDB (`BugReport.to_dynamodb_item` / `from_dynamodb_item`) et ajouté au log `bug_report.created`.
- **`scripts/sentry_issue.py`** :
  - `--event-id` résout l'événement vers son issue (`/organizations/{org}/eventids/{id}/`) et affiche cet événement précis.
  - Les nouveaux tags sont affichés (`request_id`, `failure.*`, `media.type`, `http.status_code`), avec la requête Logs Insights du `request_id`.
  - Correction au passage : `--issue-id` et `latest event` utilisaient des routes d'issue limitées au projet, qui répondent 404. Ils passent aux routes de l'organisation.
- **Conformité** : `apple-app-privacy.md` et `google-play-data-safety.md` mentionnent le lien entre rapport et événement Sentry. Dans `privacy-policy.md` §2, les rapports de bug citent build, update et identifiant du dernier rapport d'erreur.
- **Doc** : `mobile/MOBILE_CI_CD.md`, sous-section « From a bug report to its Sentry event » : les champs, la recherche dans l'UI Sentry et la commande `sentry_issue.py --event-id`.

## Vérifications

- `ruff` + `mypy` propres sur `bug_reports.py`, `bug_report_service.py` et `scripts/sentry_issue.py`. `tsc` + lint propres dans `packages/core`, `mobile/` et `web/`.
- Validation pydantic vérifiée par un appel jetable du modèle (hors dépôt, aucun test ajouté) : id valide accepté ; texte libre, 31 caractères et non-hex refusés.
- `sentry_issue.py --event-id` lancé sur le vrai Sentry avec un événement réel de l'issue SECOND-BRAIN-APP-2 : issue, tags et breadcrumbs affichés. `--issue-id` refonctionne. Les valeurs réelles de `dist` (`25`) et `ota.update_id` (UUID) correspondent aux formats validés côté serveur.

## Reste à l'owner (hors critères)

- Après déploiement, provoquer un échec, envoyer un rapport de bug, puis ouvrir l'événement avec `sentry_issue.py --event-id`.
- Le build mobile qui embarquera ceci devra être un nouveau binaire EAS, puisque `expo-application` devient une dépendance directe. Son code natif était déjà présent.
- Republier la politique (`scripts/publish_legal_site.sh`).
<!-- SECTION:NOTES:END -->
