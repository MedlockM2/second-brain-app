---
id: TASK-493
title: >-
  Extraire dans packages/core le code commun au mobile et au futur site web,
  avec un garde-fou contre les imports de plateforme
status: To Do
assignee: []
created_date: '2026-10-11 16:22'
labels:
  - mobile
  - refactor
  - web
dependencies: []
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - mobile/package.json
  - mobile/metro.config.js
  - mobile/tsconfig.json
  - mobile/src/services/chatService.ts
  - mobile/src/services/apiClient.ts
  - mobile/src/constants/config.ts
  - mobile/src/i18n/catalogs.ts
  - .github/workflows/mobile-ota-or-build.yml
  - .github/workflows/mobile-build-distribute.yml
  - .github/workflows/pr.yml
  - AGENTS.md
priority: medium
type: chore
ordinal: 100000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'app web décidée par task-424 (tâches task-475 à task-487) doit réutiliser le code de l'app mobile qui ne dépend d'aucune plateforme : types de l'API, client d'API, lecture du flux du chat, traductions, constantes. Le complément de task-424 (§3.2, README §9.2) prévoyait que le site lise directement `mobile/src` par un alias de build. Ce plan ne tient pas. `mobile/src/services/chatService.ts` contient la fonction pure `parseSseBlock`, que le chat web (task-480) doit réutiliser, mais il importe en tête `expo/fetch` et `expo-crypto`. `apiClient.ts` dépend de `constants/config.ts`, qui importe Expo. Chaque écran web buterait sur un cas de ce genre.

La pratique standard d'un produit qui a une app web et une app mobile en TypeScript est un **paquet partagé neutre**, importé par les deux apps et qui n'importe jamais rien de propre à une plateforme. Cette tâche le pose **avant** le socle web (task-475), pour que les tâches web partent sur cette base au lieu de contourner chacune le problème. Décision de l'owner du 2026-10-11 : faire cette restructuration, à la taille utile au web, et pas une refonte globale du mobile.

## Périmètre

1. **La structure**
   - un paquet `packages/core` en TypeScript, déclaré comme *workspace* npm (le gestionnaire déjà utilisé par `mobile/`), avec un `package.json` racine ;
   - l'app mobile l'importe comme dépendance de workspace ;
   - la configuration Metro et TypeScript du mobile le résolvent ; Expo prend en charge les monorepos à workspaces ; vérifier ce que la documentation d'Expo demande pour cette version (`expo` ^55) et le dire.
2. **Ce qui y va, et seulement ça** : les modules dont le site aura besoin et qui peuvent être neutres :
   - les types de l'API (`mobile/src/types`) ;
   - le client d'API, la façon de faire une requête et de lire ou rafraîchir le jeton étant **fournie par chaque app** (injection), pas importée ;
   - la lecture du flux du chat (`parseSseBlock` et ce dont elle dépend) ;
   - les catalogues de traduction et les constantes sans dépendance de plateforme.

   Les services propres au mobile (achats, notifications, stockage sécurisé du jeton, partage, fichiers locaux, Sentry) restent dans `mobile/`. Un module mixte est coupé en deux : la partie neutre va dans `packages/core`, la partie plateforme reste dans `mobile/`.
3. **Le garde-fou** : une règle ESLint sur `packages/core` qui interdit tout import de `expo`, `expo-*`, `react-native`, `@react-native/*`, `@sentry/react-native`, ainsi que l'usage de `window` et `document`. Le lint de `packages/core` passe dans le même job CI que celui du mobile.
4. **L'outillage**
   - les workflows qui installent et construisent le mobile (`pr.yml`, `main.yml`, `mobile-*.yml`) installent depuis la racine du workspace ;
   - EAS Build et EAS Update trouvent le paquet ;
   - le fingerprint OTA (`scripts/mobile_ota_manifest_check.sh`, le cas échéant) tient compte de `packages/core`, puisqu'un changement de ce paquet change le bundle mobile.
5. **La règle écrite** : `AGENTS.md` dit ce qui va dans `packages/core`, l'interdit des imports de plateforme, et que tout agent qui travaille sur le web ou le mobile peut y écrire en respectant cette règle.

Rien n'est déployé : les imports du mobile sont réécrits vers `packages/core` en une fois, sans réexport de compatibilité ni ancien chemin conservé.

## Règles

Aucune modification de comportement de l'app. Pas de tests automatisés nouveaux. Aucun secret dans les fichiers suivis.

## Note à l'owner

Après merge :
- lancer un build EAS de développement et une mise à jour OTA sur un build existant, pour confirmer que le workspace est trouvé et que le fingerprint bouge quand `packages/core` change ;
- puis une passe Maestro.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 packages/core existe comme workspace npm avec un package.json racine, et l'app mobile l'importe comme dépendance de workspace
- [ ] #2 Les types de l'API, le client d'API avec requête et jeton injectés par l'app, parseSseBlock et les catalogues de traduction vivent dans packages/core, et les imports du mobile pointent vers lui sans ancien chemin conservé
- [ ] #3 Aucun fichier de packages/core n'importe expo, expo-*, react-native, @react-native/* ou @sentry/react-native, et une règle ESLint l'interdit
- [ ] #4 typecheck et lint passent pour mobile/ et pour packages/core, et npx expo export --platform ios produit un bundle depuis mobile/
- [ ] #5 Les workflows CI du mobile, la configuration EAS et le contrôle de fingerprint OTA tiennent compte du workspace
- [ ] #6 AGENTS.md décrit packages/core, ce qui y va et l'interdit des imports de plateforme
<!-- AC:END -->
