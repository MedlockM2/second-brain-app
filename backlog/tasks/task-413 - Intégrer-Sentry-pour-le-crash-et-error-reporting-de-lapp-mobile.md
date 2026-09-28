---
id: TASK-413
title: Intégrer Sentry pour le crash et error reporting de l'app mobile
status: Done
assignee: []
created_date: '2026-09-27 21:28'
updated_date: '2026-09-28 08:05'
labels:
  - mobile
dependencies: []
references:
  - mobile/src/lib/startupErrorGuard.ts
priority: medium
type: feature
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Le feedback TestFlight `AK1DS3kTae8nm6GpVzLveTg` (« L'appli a freeze ») n'a donné aucun rapport de crash exploitable — juste une heure. Le triage n'a pu proposer qu'un correctif spéculatif sur le meilleur candidat trouvé par lecture de code (`feedback/attente-reprise-partage-non-bornee`), sans jamais établir la cause réelle du gel. **Décision owner : ne pas merger ce correctif deviné, investir plutôt dans Sentry** pour obtenir de vrais diagnostics sur les prochains freezes/crashes remontés par les beta testeurs, au lieu de deviner depuis un commentaire et une heure.

`mobile/src/lib/startupErrorGuard.ts` documente déjà, dans son commentaire de tête, que `@sentry/react-native` s'accroche exactement aux deux mêmes hooks que ce module (`ErrorUtils.setGlobalHandler`, le rejection tracker Hermes), dans le même ordre, pour la même raison. L'intégration doit **composer** avec ce module existant — qui pilote l'écran de repli `StartupErrorGate` — pas le dupliquer ni le neutraliser.

## Scope

Mobile React Native/Expo uniquement (SDK, initialisation, config native via `app.config.ts`, upload des source maps sur les builds EAS). L'instrumentation backend/workers Python est hors scope — tâche séparée si l'owner la souhaite plus tard.

Rien n'est déployé (cf. `AGENTS.md`, « Nothing is deployed yet ») : pas de feature flag, pas de rollout progressif, pas de double chemin — l'intégration se câble directement.

## Hors scope

- Instrumentation des workers/Lambdas backend.
- Le correctif spéculatif sur le freeze lui-même (branche non mergée, décision owner).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `@sentry/react-native` ajouté aux dépendances mobile et initialisé au démarrage de l'app (module scope, comme `installStartupErrorGuard`), DSN lu depuis une variable EAS/`app.config.ts` (`extra`), jamais en dur dans le code.
- [x] #2 Plugin Expo Sentry déclaré dans `app.config.ts` avec l'upload de source maps/symboles configuré pour les profils EAS existants.
- [x] #3 L'intégration compose avec `mobile/src/lib/startupErrorGuard.ts` : les erreurs fatales et rejets non gérés continuent de déclencher `StartupErrorGate` ET sont remontés à Sentry, sans double installation des hooks ni régression du fallback.
- [x] #4 Une erreur de rendu React (error boundary) est également remontée à Sentry avec le contexte disponible (origin, stack).
- [x] #5 Chaque événement est taggé avec l'environnement (dev/prod) et la version/le build de l'app, pour distinguer les crashs par build.
- [x] #6 Typecheck et lint mobile propres sur les fichiers touchés.
- [x] #7 Aucun test automatisé ajouté (règle du projet).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Ce qui a été fait

**SDK et initialisation (AC #1)**
- `@sentry/react-native` `~7.11.0` ajouté à `mobile/package.json` / `package-lock.json`. Justification de la dépendance : c'est le SDK officiel de crash reporting pour Expo, et `~7.11.0` est la version épinglée par Expo SDK 55 (`bundledNativeModules`). L'owner peut le confirmer avec `cd mobile && npx expo install --check`.
- Nouveau module `mobile/src/lib/crashReporting.ts` : `initCrashReporting()` est appelé au module scope de `mobile/app/_layout.tsx`, juste **avant** `installStartupErrorGuard()`, pour que le premier rapport du guard ait déjà un client Sentry.
- Le DSN suit ce chemin : `process.env.EXPO_PUBLIC_SENTRY_DSN` → `extra.sentryDsn` (`app.config.ts`) → `Config.SENTRY_DSN` (`src/constants/config.ts`). Il n'est jamais écrit dans le dépôt.
- Sans DSN, rien n'est initialisé et toutes les fonctions sont des no-op. C'est le cas d'un `expo start` local sans la variable, et des builds E2E.

**Plugin et source maps (AC #2)**
- `"@sentry/react-native/expo"` est déclaré dans les `plugins` d'`app.config.ts`, volontairement sans props. org, project et token sont lus par sentry-cli depuis l'environnement EAS au moment du build. Le token ne doit jamais passer par la config : elle est résolue sur chaque machine et embarquée dans l'app. Le plugin ne lit aucune variable d'environnement au moment de la résolution de la config (vérifié dans `plugin/build/`).
- `mobile/metro.config.js` passe à `getSentryExpoConfig`, qui estampille un debug ID dans chaque bundle et sa map. C'est indispensable pour les mises à jour OTA : elles tournent sous la release du binaire qui les reçoit.
- Upload selon le profil :
  - `development` et `development-simulator` (par `extends`) : `SENTRY_DISABLE_AUTO_UPLOAD=true` dans `eas.json`.
  - `preview`, `internal` et `production` : upload des maps, et des dSYM sur iOS.
  - Builds E2E de `mobile-e2e-maestro.yml` : `SENTRY_DISABLE_AUTO_UPLOAD=true` sur les deux steps de build. C'est indispensable sur iOS, dont le build est en configuration Release.
  - **Un upload qui échoue fait échouer le build.**
- OTA : nouveau step « Upload the update's source maps to Sentry » dans `mobile-ota-or-build.yml`. Il lance `npx sentry-expo-upload-sourcemaps dist` après `eas update`, qui exporte avec `--source-maps=true` par défaut en eas-cli 22. Il échoue bruyamment si le token, l'org ou le project manque, ou si aucune map n'est trouvée. Son résultat figure dans le résumé du job.

**Composition avec `startupErrorGuard.ts` (AC #3)**
- Le guard reste **le seul propriétaire** d'`ErrorUtils.setGlobalHandler` et du rejection tracker Hermes. La `reactNativeErrorHandlersIntegration` de Sentry est remplacée par une instance `{ onerror: false, onunhandledrejection: false }`, ce qui évite toute double installation. Laisser les deux s'installer cassait le fallback dans les deux ordres possibles :
  - Si Sentry enveloppe le guard, son handler fatal verrouille `handlingFatal` pour toujours : un second fatal après « Try again » n'atteint plus le gate.
  - Si le guard enveloppe Sentry, le guard ne forwarde pas un fatal en release : Sentry ne le verrait jamais.
  - Hermes ne garde qu'un seul rejection tracker.
- `logStartupFailure` (fatal, render, rejet) envoie à Sentry puis à `console.error`. Les erreurs non fatales, qui passaient sans log, sont maintenant envoyées à Sentry avant d'être forwardées.
- Le chemin fatal est inchangé : log, puis `reportStartupFailure` (qui déclenche `StartupErrorGate`), puis forward seulement en `__DEV__`. Le fallback ne régresse donc pas.
- **Nuance sur les rejets** : par design (commentaire de tête du guard, inchangé), un rejet non géré n'a **jamais** déclenché `StartupErrorGate`, et ne le déclenche toujours pas. Il est loggé et désormais remonté à Sentry. Ce sont les fatals qui déclenchent le gate et Sentry. Changer ça ferait d'un refresh de token raté sur un appareil verrouillé un écran d'erreur plein écran : c'est hors scope et contraire au design documenté.
- Forme des événements, calquée sur les handlers de Sentry :

  | Origine | level | mechanism | handled |
  |---|---|---|---|
  | fatal | `fatal` | `onerror` | false |
  | render | `fatal` | `auto.function.react.error_boundary` | false |
  | rejet | `error` | `onunhandledrejection` | true |
  | non fatal | `error` | `generic` | true |

**Erreur de rendu (AC #4)**
- L'`ErrorBoundary` exporté par `app/_layout.tsx` appelait déjà `logStartupFailure(error, "render")` dans un effet. Il remonte donc à Sentry avec sa stack et le tag `startup_guard.origin=render`, level `fatal` et `handled: false` : le fallback remplace toute l'app, ce n'est pas une récupération.

**Tags (AC #5)**
- `environment` vaut le channel EAS Update du binaire (`preview`, `internal`, `production`), `development` sous `__DEV__`, et `local` pour un build release fait hors EAS. Ce n'est pas le défaut de Sentry, `production` pour tout build release, qui mélangerait TestFlight (API -dev) et store. Correspondance dev/prod : `preview` et `internal` utilisent l'API -dev, `production` l'API prod. Le tag `api.host` donne l'hôte explicitement.
- release et dist sont fournis par le SDK depuis le natif : `com.secondbrainlabs.core@<version>+<build>` et `<build>`. S'y ajoutent les tags `ota.update_id` et `ota.embedded_launch` (deux OTA sur un même build partagent release et dist), le contexte `ota_updates` d'`expoContextIntegration`, et `startup_guard.origin` sur chaque événement.

**Confidentialité**
- `sendDefaultPii: false`, jamais de `Sentry.setUser`.
- Les breadcrumbs HTTP perdent leur query string et leur fragment : recherche `?q=`, signatures d'URL présignées.
- Pas de screenshot ni de view hierarchy (défauts).

**AC #6** : `npm run typecheck` passe. `npm run lint` ne remonte que le warning existant de `src/services/purchaseService.ts`. Le script de lint (`eslint . --ext .ts,.tsx`) ne couvre pas `metro.config.js`. Linté à la main, ce fichier signale `no-var-requires` et `no-undef __dirname`, déjà présents dans la version d'origine et propres à un fichier CommonJS Node : hors scope.

**AC #7** : aucun test ajouté.

**Docs mises à jour**
- `mobile/MOBILE_CI_CD.md` :
  - nouvelle section « Crash Reporting (Sentry) » ;
  - lignes `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` et `SENTRY_URL` dans les tables secrets/variables ;
  - invariant EXPO_PUBLIC mis à jour.
- Conformité, **à relire par l'owner** :
  - `docs/compliance/privacy-policy.md` : Sentry ajouté aux tiers du §6 ;
  - `docs/compliance/apple-app-privacy.md` : SDK tiers, et condition « Crash Data — Not linked to identity » ;
  - `docs/compliance/google-play-data-safety.md` : processeurs.
  - Les déclarations « Crash data » / « Crash logs » existaient déjà.
- `mobile/.env.example` : ajout d'une entrée **commentée** `# EXPO_PUBLIC_SENTRY_DSN=`. Commentée exprès, parce que `scripts/mobile_release_check.sh` exige toutes les clés `EXPO_PUBLIC_*` non commentées.

**Observation hors scope** : `privacy-policy.md` §5.3 dit que l'infra AWS est aux États-Unis, alors que l'API tourne en `eu-west-3` (Paris). C'est antérieur à cette tâche et non modifié ici, mais c'est à prendre en compte pour le choix de la région de données Sentry (US ou EU).

### Build natif requis

**Oui, sur les deux plateformes.** Un nouveau module natif, les phases de build du plugin et une nouvelle clé `extra.sentryDsn` modifient le fingerprint. Le prochain push sur `main` déclenchera donc des builds `internal` iOS et Android plutôt qu'un OTA. Aucun binaire déjà installé ne remontera à Sentry.

### Ce que l'owner doit faire hors du dépôt, AVANT de pousser `main`

1. Créer l'organisation et un projet **React Native** dans Sentry :
   - choisir la région de données délibérément (US ou EU, voir l'observation ci-dessus) ;
   - activer « Prevent Storing of IP Addresses » et le data scrubbing par défaut.
2. Créer un **org auth token** avec le scope d'upload de source maps.
3. Créer les variables EAS avec `cd mobile && eas env:create`, sur les environnements **`production`** et **`preview`** :
   - `EXPO_PUBLIC_SENTRY_DSN`, en visibilité **Plain text ou Sensitive, jamais Secret**. Sinon le fingerprint calculé en CI diverge et le build échoue dans CONFIGURE_EXPO_UPDATES. Valeur : Sentry, Project Settings > Client Keys (DSN).
   - `SENTRY_ORG` et `SENTRY_PROJECT`, en Plain text. Les slugs sont visibles dans l'URL du projet Sentry.
   - `SENTRY_AUTH_TOKEN`, en **Secret**.
4. Côté GitHub :
   - `gh secret set SENTRY_AUTH_TOKEN` ;
   - `gh variable set SENTRY_ORG` ;
   - `gh variable set SENTRY_PROJECT` ;
   - `gh variable set SENTRY_URL`, optionnel, seulement si l'org n'est pas sur `https://sentry.io/`.
5. Pousser `main`, suivre `mobile-ota-or-build` et vérifier dans les logs EAS que l'upload des maps et des dSYM est passé.
6. Sur appareil, provoquer une erreur de test et vérifier dans Sentry :
   - un événement symbolisé ;
   - l'environnement `internal` ;
   - la release `com.secondbrainlabs.core@<version>+<build>` ;
   - les tags `api.host` et `startup_guard.origin`.
7. Relire les modifications des documents de conformité, et les réponses App Store Connect et Play Data safety.

Un DSN ajouté ou changé plus tard modifie `extra`, donc le fingerprint : cela coûte une nouvelle paire de builds.
<!-- SECTION:NOTES:END -->
