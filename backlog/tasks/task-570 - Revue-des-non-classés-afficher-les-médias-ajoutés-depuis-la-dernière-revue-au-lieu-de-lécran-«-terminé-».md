---
id: TASK-570
title: >-
  Revue des non classés : afficher les médias ajoutés depuis la dernière revue
  au lieu de l'écran « terminé »
status: Done
assignee: []
created_date: '2026-10-29 15:37'
updated_date: '2026-10-29 17:15'
labels:
  - mobile
dependencies: []
references:
  - mobile/app/review/index.tsx
  - mobile/src/services/resourceCache.ts
  - packages/core/src/cache/resourceCache.ts
priority: high
type: bug
ordinal: 176000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Constat (owner, 2026-10-29)

L'owner a terminé une revue des non classés (tous les médias triés). Il a ensuite ajouté deux médias sans les ranger dans un dossier. L'entrée « Revue des non classés » de l'accueil affichait bien « 2 ». Pourtant, en l'ouvrant, il est tombé sur l'écran « terminé ». Il a dû toucher Terminer puis rouvrir la revue pour voir apparaître les deux cartes (Jeter / Approfondir / Ranger).

## Cause

- À l'ouverture, `mobile/app/review/index.tsx` (`initialQueue`, l. ~129-143) construit la file à partir de `cache.snapshot(resourceKeys.mediaPage({ folderId: défaut, limit: 100, sort: "asc" }))` sans regarder `stale`. Dès qu'une page est en cache, même vide, `hasQueue` passe à `true`.
- `load()` (l. ~176-205) revalide bien auprès du serveur, mais n'applique le résultat que si `!hasQueue.current`. Ce choix est voulu : ne pas réorganiser la file sous le doigt de l'utilisateur. La réponse du serveur ne sert donc qu'à la visite suivante.
- Pendant la première revue, chaque carte rangée ou jetée a été retirée de cette page en cache (`mediaPatched` / `removeMedia` dans `mobile/src/services/resourceCache.ts`). La page en cache finit donc à `[]`. Un nouvel import appelle `mediaSaved()`, qui marque seulement la page comme périmée et garde le `[]`.
- Résultat : la 2ᵉ ouverture affiche `[]` (écran « terminé »), la revalidation récupère les 2 médias et les ignore, et c'est seulement à la 3ᵉ ouverture qu'ils apparaissent. Le compteur de l'accueil était juste parce qu'il lit une autre clé (`unsorted-count`), qui est revalidée normalement.

Ignorer toute page marquée `stale` n'est pas une bonne solution : `cache.update()` marque aussi la page `stale` après chaque rangement (`packages/core/src/cache/resourceCache.ts`, `publish(..., stale: true)`), donc presque chaque ouverture afficherait un chargement.

## Correctif attendu

La règle « ne pas réorganiser la file » ne protège quelque chose qu'une fois que l'utilisateur a commencé à agir. Tant qu'il n'a fait aucun geste depuis l'ouverture (ni carte suivante ou précédente, ni Jeter, ni Ranger), la réponse du serveur doit remplacer la file issue du cache, en revenant sur la première carte. Après le premier geste, le comportement actuel (file figée) est conservé. Le commentaire en tête de `load` et celui de l'effet de montage doivent être mis à jour pour décrire la nouvelle règle.

## Note à l'owner (hors AC)

Vérification manuelle sur TestFlight ou en simulateur : terminer une revue, ajouter deux médias sans dossier, rouvrir la revue. Les deux cartes doivent apparaître directement, sans passer par l'écran « terminé » (au plus un bref affichage avant la réponse du serveur).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dans `mobile/app/review/index.tsx`, quand la revalidation de `load()` répond avant tout geste de l'utilisateur sur la file (navigation, Jeter, Ranger), la file affichée est remplacée par la réponse du serveur (filtrée sur le dossier par défaut) et la carte active revient à l'index 0, y compris quand la file issue du cache était vide
- [x] #2 Après le premier geste de l'utilisateur, une réponse de revalidation ne modifie plus la file affichée (comportement actuel conservé)
- [x] #3 Le marqueur « l'utilisateur a agi » est posé dans chaque chemin qui modifie la file ou la carte active (navigation tactile, actions d'accessibilité increment/decrement, Jeter, Ranger), et pas seulement dans le rendu
- [x] #4 Les commentaires de `load` et de l'effet de montage décrivent la nouvelle règle (file remplacée tant que rien n'a été touché, figée ensuite)
- [x] #5 `npm run lint` et `npx tsc --noEmit` passent sans erreur dans `mobile/`
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Un marqueur hasActed (ref) est posé dans step (tap et actions d'accessibilité), Jeter, Ranger (handleSaved) et Approfondir. Tant qu'il est faux, la réponse de load() remplace la file issue du cache et revient à l'index 0, même si le cache était vide ; ensuite la file reste figée. Commentaires d'en-tête, de load et de l'effet de montage mis à jour. npm run lint (0 erreur) et tsc --noEmit passent. Approfondir compte aussi comme geste, pour ne pas changer la carte sous le doigt au retour.
<!-- SECTION:FINAL_SUMMARY:END -->
