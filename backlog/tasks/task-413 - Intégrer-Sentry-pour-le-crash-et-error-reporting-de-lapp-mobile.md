---
id: TASK-413
title: Intégrer Sentry pour le crash et error reporting de l'app mobile
status: To Do
assignee: []
created_date: '2026-09-27 21:28'
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
- [ ] #1 `@sentry/react-native` ajouté aux dépendances mobile et initialisé au démarrage de l'app (module scope, comme `installStartupErrorGuard`), DSN lu depuis une variable EAS/`app.config.ts` (`extra`), jamais en dur dans le code.
- [ ] #2 Plugin Expo Sentry déclaré dans `app.config.ts` avec l'upload de source maps/symboles configuré pour les profils EAS existants.
- [ ] #3 L'intégration compose avec `mobile/src/lib/startupErrorGuard.ts` : les erreurs fatales et rejets non gérés continuent de déclencher `StartupErrorGate` ET sont remontés à Sentry, sans double installation des hooks ni régression du fallback.
- [ ] #4 Une erreur de rendu React (error boundary) est également remontée à Sentry avec le contexte disponible (origin, stack).
- [ ] #5 Chaque événement est taggé avec l'environnement (dev/prod) et la version/le build de l'app, pour distinguer les crashs par build.
- [ ] #6 Typecheck et lint mobile propres sur les fichiers touchés.
- [ ] #7 Aucun test automatisé ajouté (règle du projet).
<!-- AC:END -->
