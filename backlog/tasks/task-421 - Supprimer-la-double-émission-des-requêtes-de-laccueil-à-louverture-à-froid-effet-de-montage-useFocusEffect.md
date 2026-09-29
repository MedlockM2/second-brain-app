---
id: TASK-421
title: >-
  Supprimer la double émission des requêtes de l'accueil à l'ouverture à froid
  (effet de montage + useFocusEffect)
status: To Do
assignee: []
created_date: '2026-09-29 13:57'
labels:
  - mobile
  - performance
  - bug
dependencies: []
references:
  - mobile/app/(tabs)/inbox.tsx
  - mobile/src/hooks/useMediaList.ts
  - mobile/src/hooks/useHomeSections.ts
  - mobile/MOBILE_CI_CD.md
priority: high
type: bug
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Le symptôme

Une **ouverture à froid de l'accueil déclenche deux fois chacune de ses trois requêtes** : `GET /api/media`, la liste « Reprendre » et le compteur des non classés. Le coût serveur de l'écran d'accueil est donc doublé — y compris la lecture intégrale de la partition `user_media` que task-417 vient précisément de réduire.

## Ce que dit le code (lu avant d'écrire cette tâche, à ne pas re-découvrir)

Deux chemins indépendants tirent les mêmes fetchers au même moment, sans aucun garde d'inflight :

- **Effet de montage.** `useMediaList` (`mobile/src/hooks/useMediaList.ts:133-155`) et `useHomeSections` (`mobile/src/hooks/useHomeSections.ts:147-164`) appellent chacun leur fetcher dans un `setTimeout(…, 0)` au montage, dès que `isAuthenticated`.
- **Effet de focus.** `useFocusEffect` de `mobile/app/(tabs)/inbox.tsx:160-166` appelle `refetch()` + `refreshSections()`. Ce callback s'exécute **aussi au premier focus, c'est-à-dire au montage** — il n'est pas réservé aux retours sur l'onglet.

Résultat : trois requêtes × deux chemins. Aucun des trois fetchers (`fetchMedia:67`, `refreshContinueLearning:69`, `refreshUnsortedCount:106`) ne teste si un appel est déjà en vol ; ils ne partagent qu'un `settledRef` **dont le seul rôle est de décider si le round mérite un span Sentry**, pas de dédupliquer.

Le fait est déjà admis dans le code et dans la doc : le commentaire de `useMediaList.ts:55-62` parle de « the two fetches an open fires (the mount effect and the screen's focus effect) », et `mobile/MOBILE_CI_CD.md:1949-1950` le note noir sur blanc (« a cold open issues every one of the three requests twice. The spans make that visible; removing the duplication is not part of task-417 »). C'est donc un préexistant volontairement laissé hors de task-417, pas une régression de ce run.

## Ce qu'il faut faire

1. **Une seule émission par requête à l'ouverture à froid**, en gardant le comportement de re-lecture au retour sur l'onglet (sync multi-appareils) qui est la raison d'être de l'effet de focus. Deux formes possibles, au choix de l'implémenteur, à justifier dans les notes : soit le fetch initial n'appartient qu'à un seul des deux chemins (l'effet de focus suffit à couvrir le montage, ce qui rendrait les effets de montage des deux hooks redondants), soit chaque fetcher se protège par un garde d'inflight qui fait de la seconde entrée un no-op tant que la première n'a pas répondu. Ne pas régler ça avec un délai ou un debounce temporel.
2. **Ne pas casser les autres déclencheurs**, qui doivent tous rester fonctionnels : le pull-to-refresh (`handleRefresh:168`, qui doit continuer à toujours refaire un vrai appel — c'est le geste par lequel l'utilisateur redemande explicitement), `useProcessingRefresh` (task-405), `subscribeToMediaSaves` (`mediaSaveNotice`) et `retry` après erreur.
3. **Vérifier que les spans de task-417 restent justes.** Les `settledRef` servent à n'instrumenter que le premier paint : une fois la duplication supprimée, il doit toujours y avoir exactement un span par section à l'ouverture, et zéro sur les re-lectures ultérieures.
4. **Mettre à jour les deux endroits qui affirment aujourd'hui le contraire** : le commentaire d'en-tête de `useMediaList.ts:55-62` et la note de `mobile/MOBILE_CI_CD.md:1949-1950`.

## Hors périmètre

`refreshEntitlements()` est appelé par le même `useFocusEffect` et pourrait suivre la même logique, mais il ne fait pas partie des trois requêtes des sections de l'accueil. Si l'implémenteur constate qu'il est lui aussi doublé, le **noter** dans les notes d'implémentation sans élargir la tâche.

## Notes pour l'owner (non vérifiables par l'agent)

Après merge et déploiement : ouvrir l'app à froid et lire le waterfall Sentry de la transaction de navigation de l'accueil — il doit montrer un seul span `recently_added`, un seul `continue_learning`, un seul `unsorted_count`, et plus aucune paire de requêtes HTTP identiques. Puis quitter l'onglet et y revenir, pour vérifier que la re-lecture de focus se produit toujours.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Une lecture du code montre qu'à l'ouverture à froid de l'accueil, chacun des trois fetchers (`fetchMedia`, `refreshContinueLearning`, `refreshUnsortedCount`) ne peut plus être exécuté qu'une fois : soit un seul des deux chemins (effet de montage / `useFocusEffect`) le déclenche, soit un garde d'inflight rend la seconde entrée no-op. La solution retenue est expliquée dans les notes d'implémentation.
- [ ] #2 Aucun `setTimeout`, debounce ni délai n'est utilisé comme moyen de déduplication.
- [ ] #3 Le pull-to-refresh (`handleRefresh`) déclenche toujours un appel réseau réel, même immédiatement après un appel précédent : le garde éventuel ne s'y applique pas, et c'est vérifiable dans le code.
- [ ] #4 Les autres déclencheurs restent câblés et fonctionnels dans le code : `useProcessingRefresh`, `subscribeToMediaSaves` sur les deux hooks, et `retry` après erreur.
- [ ] #5 La re-lecture au retour sur l'onglet (sync multi-appareils) existe toujours : revenir sur l'accueil après l'avoir quitté refait les trois appels.
- [ ] #6 Les `settledRef` de `useMediaList` et `useHomeSections` restent cohérents avec la nouvelle émission : exactement un span par section au premier paint, aucun sur les re-lectures suivantes.
- [ ] #7 Le commentaire d'en-tête de `mobile/src/hooks/useMediaList.ts` ne décrit plus « the two fetches an open fires » comme un fait, mais décrit le comportement réel.
- [ ] #8 La note de `mobile/MOBILE_CI_CD.md` qui dit « a cold open issues every one of the three requests twice » est mise à jour pour refléter la correction.
- [ ] #9 `npx tsc --noEmit` et `npx eslint` passent sans erreur dans `mobile/`.
<!-- AC:END -->
