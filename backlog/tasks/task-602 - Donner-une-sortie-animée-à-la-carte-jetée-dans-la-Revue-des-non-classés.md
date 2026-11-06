---
id: TASK-602
title: Donner une sortie animée à la carte jetée dans la Revue des non classés
status: To Do
assignee: []
created_date: '2026-11-06 09:01'
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
- [ ] #1 La carte jetée dans la Revue des non classés sort par une animation `Animated` de React Native ; le chemin est câblé depuis `handleDiscard` et aucune dépendance d'animation n'est ajoutée au projet.
- [ ] #2 Le retrait de la file reste immédiat et non bloquant : aucun tap sur Jeter n'est ignoré ni différé pendant l'animation, et `restoreAt` remet la carte en place sans animation inverse.
- [ ] #3 Réduire les animations supprime la sortie animée sur mobile via `useReduceMotion`, et `prefers-reduced-motion` fait de même sur `web/src/pages/UnsortedPage.tsx` ; l'animation est nettoyée au démontage.
- [ ] #4 Le bouton Jeter de `web/src/pages/UnsortedPage.tsx` a la même sortie animée que le mobile.
- [ ] #5 Typecheck et lint mobile, core et web passent, et le build web réussit ; aucun test automatisé n'est ajouté.
<!-- AC:END -->
