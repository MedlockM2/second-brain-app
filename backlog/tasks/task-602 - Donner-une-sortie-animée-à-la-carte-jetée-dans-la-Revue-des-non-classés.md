---
id: TASK-602
title: Donner une sortie animée à la carte jetée dans la Revue des non classés
status: Done
assignee: []
created_date: '2026-11-06 09:01'
updated_date: '2026-11-06 14:32'
labels:
  - mobile
  - ux
dependencies: []
references:
  - mobile/app/review/index.tsx
  - web/src/pages/UnsortedPage.tsx
  - mobile/src/hooks/useReduceMotion.ts
  - mobile/src/components/chat/ChatWaitingIndicator.tsx
  - mobile/src/constants/theme.ts
priority: medium
type: feature
ordinal: 209000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

Décision de l'owner (2026-11-06, retour TestFlight `AF8dBgGNApj5SseUik3fZRk`, build 25) : le retour « Animation sur le "supprimer", onglet qui vole » était ambigu entre deux lectures, et l'owner a tranché pour la **lecture 1 — demande de feature** : la carte jetée doit avoir une sortie animée. La lecture 2 (la fermeture de l'écran à 1/1 via `router.back()` perçue comme un défaut) est écartée : ne pas toucher à la fermeture de l'écran ni à sa présentation.

Aujourd'hui `handleDiscard` (`mobile/app/review/index.tsx`) retire la carte de la file sans aucune animation et la carte suivante remplace l'ancienne instantanément. Donner à ce retrait une sortie animée, en `Animated` de React Native : `react-native-reanimated` n'est pas une dépendance du projet et n'est pas nécessaire ici — ne pas l'ajouter.

Contraintes de comportement :
- Le retrait optimiste de la file reste immédiat : un tap sur Jeter ne doit jamais être bloqué ni mis en file d'attente par l'animation en cours. Des taps rapides successifs restent tous pris en compte.
- `restoreAt` ramène la carte sans animation inverse : l'annulation est un retour d'état, pas une animation jouée à l'envers.
- Réduire les animations désactive la sortie (la carte disparaît sans animation), via le hook existant `mobile/src/hooks/useReduceMotion.ts`.
- Nettoyage de l'animation au démontage du composant, comme `mobile/src/components/chat/ChatWaitingIndicator.tsx` (TASK-574).

Direction et durée : il n'existe pas de tokens de motion dans `mobile/src/constants/theme.ts` — ne pas en inventer un jeu pour cette tâche. S'aligner sur les durées déjà employées par les animations existantes du projet et les écrire en constantes locales au composant.

Parité web : `web/src/pages/UnsortedPage.tsx` porte le même bouton Jeter et reçoit la même sortie animée, en CSS/transition, avec le même respect de `prefers-reduced-motion`.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret ni identité de testeur dans les fichiers suivis.

NOTE PROPRIÉTAIRE : la vérification visuelle de l'animation (fluidité, direction, rendu sur appareil, et le cas 1/1 où la carte jetée est la dernière) reste à faire par l'owner après distribution OTA. Elle n'est pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La carte jetée dans la Revue des non classés sort par une animation `Animated` de React Native ; le chemin est câblé depuis `handleDiscard` et aucune dépendance d'animation n'est ajoutée au projet.
- [x] #2 Le retrait de la file reste immédiat et non bloquant : aucun tap sur Jeter n'est ignoré ni différé pendant l'animation, et `restoreAt` remet la carte en place sans animation inverse.
- [x] #3 Réduire les animations supprime la sortie animée sur mobile via `useReduceMotion`, et `prefers-reduced-motion` fait de même sur `web/src/pages/UnsortedPage.tsx` ; l'animation est nettoyée au démontage.
- [x] #4 Le bouton Jeter de `web/src/pages/UnsortedPage.tsx` a la même sortie animée que le mobile.
- [x] #5 Typecheck et lint mobile, core et web passent, et le build web réussit ; aucun test automatisé n'est ajouté.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Mobile (`mobile/app/review/index.tsx`)

`handleDiscard` still removes the card from the queue on the tap. It then sets a `leaving` copy of the card, which `DiscardedCardExit` draws over the next card, absolutely filling the stage:
- `Animated.timing` on the native driver with `isInteraction: false`, 300 ms (the existing Toast and bug-report duration, kept as a local constant), ease-in;
- the card slides one window width to the left, tilts −8° and fades out.

The copy ignores touches (`pointerEvents="none"`) and is hidden from screen readers. Each new tap replaces the copy (keyed by a nonce), so nothing is queued or delayed.

`restoreAt` stops drawing a copy of the restored card, with no reverse animation. Under `useReduceMotion` no copy is drawn. The animation is stopped on unmount (`exit.stop()` in the effect cleanup, as in `ChatWaitingIndicator`).

No dependency was added. The screen's close at 1/1 is untouched.

## Web (`web/src/pages/UnsortedPage.tsx`, `styles.css`)

The card's head and blurb are extracted into `TriageSummary`. On discard, a `.triage-exit` copy (`aria-hidden`, `inert`) is drawn over the next card. A 300 ms CSS animation (mirrored in RTL) slides it to the start side, tilts it and fades it, and `onAnimationEnd` removes it.

A failed DELETE removes the copy and restores the card without animation. `prefers-reduced-motion` skips the copy: it is checked at tap time, and CSS also sets `display: none` as a safety net.

## Checks

- `tsc` is clean in mobile and web; core is unchanged.
- eslint: no new issue.
- `vite build` passes.
- No tests were added.

The visual check is the owner's after OTA (see description).
<!-- SECTION:NOTES:END -->
