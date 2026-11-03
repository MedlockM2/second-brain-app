---
id: DRAFT-2
title: >-
  Appliquer la dernière mise à jour OTA dès la première connexion, sans attente
  au démarrage
status: Draft
assignee: []
created_date: '2026-11-03 09:54'
labels:
  - mobile
  - onboarding
dependencies: []
references:
  - mobile/src/contexts/AuthContext.tsx
  - mobile/src/lib/introState.ts
  - mobile/app.config.ts
  - mobile/MOBILE_CI_CD.md
  - docs/store-listing/pre-beta-review.md
priority: medium
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Réalisée dans le même run que DRAFT-1

Cette tâche n'est **jamais dispatchée seule** et reste en Draft. L'agent qui réalise DRAFT-1 (remettre la page 2 de l'intro) réalise aussi celle-ci dans le même run et la même branche. Il passe ensuite les deux tâches à Done. Raison (owner, 2026-11-03) : un seul build natif et une seule review pour les deux changements. Pour lancer le travail, l'owner passe **DRAFT-1** en To Do. Celle-ci reste en Draft.

## Pourquoi

Un binaire démarre toujours sur le JavaScript qu'il embarque. expo-updates télécharge la dernière OTA pendant ce premier lancement et ne l'applique qu'au démarrage à froid suivant. Or l'intro s'affiche juste après la première connexion, donc au premier lancement. Une nouvelle installation voit ainsi les premiers écrans (connexion, intro, langue) dans la version du binaire et non dans la dernière version publiée. C'est arrivé le 2026-11-02 : les builds 21/28 montraient l'ancien carrousel au relecteur, et il a fallu refaire les builds 23/29 (`docs/store-listing/pre-beta-review.md`, section « The build »).

L'owner refuse la solution native `updates.fallbackToCacheTimeout`, qui ferait attendre l'écran de démarrage jusqu'à N secondes. Aucune attente au démarrage n'est acceptable.

## Comportement voulu

1. **Démarrage inchangé** : l'app s'ouvre immédiatement. Le téléchargement en arrière-plan d'expo-updates (`checkAutomatically` par défaut, `ON_LOAD`) continue de se faire. Quand l'app tourne sur son code embarqué (`Updates.isEmbeddedLaunch`), on suit l'état du téléchargement (`useUpdates()`, ou `checkForUpdateAsync` / `fetchUpdateAsync`) pour savoir si une mise à jour est prête.
2. **À la connexion réussie** (`login`, `loginWithSocial` dans `AuthContext`, et le chemin par lequel se termine l'inscription avec vérification de l'e-mail) : une fois la session enregistrée et `oweIntroIfUndecided()` appelé, mais avant de naviguer :
   - si l'app tourne sur son code embarqué **et** qu'une mise à jour est déjà téléchargée, appeler `Updates.reloadAsync()`. Au redémarrage, la session est restaurée et l'intro, déjà due dans son fichier, s'affiche dans la nouvelle version ;
   - si un téléchargement est en cours, l'attendre **au plus environ 1 s**, pendant que l'indicateur de chargement du bouton de connexion reste affiché ;
   - sinon, continuer sans rien faire. La mise à jour s'appliquera au lancement suivant, comme aujourd'hui.
3. **Une seule fois** : après le rechargement, `isEmbeddedLaunch` vaut false, donc pas de boucle possible. Les utilisateurs déjà installés ne sont jamais concernés. Rien ne se passe en développement (`!Updates.isEnabled` ou `__DEV__`).
4. **Transition** : expo-updates 55 accepte `reloadAsync({ reloadScreenOptions })` (voir `node_modules/expo-updates/build/Updates.d.ts`). L'utiliser avec le fond et l'indicateur du thème (`src/constants/theme`) pour que le rechargement ressemble à un chargement normal.
5. **Vérifier ce qui survit au rechargement** : le jeton de session, le fichier d'état de l'intro (`src/lib/introState.ts`, déjà écrit avant le rechargement), et la langue de lecture choisie ou à choisir. Au redémarrage, `settleIntroForRestoredSession` voit une session restaurée. Il n'écrit « seen » que si le fichier est absent (`introState.ts`, l. 64-66). L'intro reste donc due **à condition que `oweIntroIfUndecided()` ait écrit « owed » avant `reloadAsync`**. Sinon, elle serait prise pour une installation existante et jamais affichée. C'est le piège principal : l'ordre doit être garanti.

**Contrainte** : on ne touche à aucun réglage natif, ni au bloc `updates`/`runtimeVersion` de `app.config.ts`, ni aux dépendances natives. L'empreinte native ne doit pas bouger.

## Note pour l'owner (pas un critère)

- **Un build manuel, une seule fois.** Le changement est purement JS, donc au push la CI ne publie qu'une OTA. Pour que la logique soit dans le code embarqué des nouvelles installations, lancer `eas build --platform all --profile internal --auto-submit` après le merge. Ensuite : sur iOS, ajouter le build au groupe externe depuis le site et le soumettre ; sur Android, créer une nouvelle version Alpha et l'envoyer à l'examen. À partir de là, toute OTA future atteint les nouvelles installations dès leur première connexion.
- **Vérification sur appareil** : désinstaller, installer le nouveau binaire, publier une OTA visible (un texte changé), puis se connecter. L'app doit redémarrer brièvement après la connexion et afficher le changement dès l'intro. Vérifier aussi qu'un appareil déjà installé n'est pas affecté.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Un module dédié (par exemple `mobile/src/lib/firstLaunchUpdate.ts`) applique la mise à jour téléchargée par `Updates.reloadAsync` uniquement si `Updates.isEnabled`, `Updates.isEmbeddedLaunch` et une mise à jour est prête ; il attend au plus environ 1 s un téléchargement en cours, et ne fait rien sinon
- [ ] #2 Le module est appelé après chaque connexion réussie (`login`, `loginWithSocial`, fin de l'inscription vérifiée) dans `mobile/src/contexts/AuthContext.tsx`, après l'écriture de la session et `oweIntroIfUndecided()`, avant toute navigation
- [ ] #3 `reloadAsync` n'est jamais appelé avant que `oweIntroIfUndecided()` ait écrit « owed » : l'ordre se lit dans le code et un commentaire explique pourquoi (`settleIntroForRestoredSession` marquerait sinon l'intro comme vue au redémarrage)
- [ ] #4 Le rechargement utilise `reloadScreenOptions` avec les couleurs du thème clair et sombre
- [ ] #5 `mobile/app.config.ts` et les dépendances natives de `mobile/package.json` sont inchangés
- [ ] #6 `mobile/MOBILE_CI_CD.md` explique le comportement au premier lancement et la règle « un build manuel quand cette logique change »
- [ ] #7 `npm run typecheck` et `npm run lint` passent dans `mobile/`
<!-- AC:END -->
