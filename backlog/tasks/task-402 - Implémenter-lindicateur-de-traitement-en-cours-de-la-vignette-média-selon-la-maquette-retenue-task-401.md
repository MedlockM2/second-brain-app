---
id: TASK-402
title: >-
  Implémenter l'indicateur de traitement en cours de la vignette média selon la
  maquette retenue (task-401)
status: To Do
assignee: []
created_date: '2026-09-16 13:12'
labels:
  - mobile
  - ui
dependencies:
  - TASK-401
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Ce qu'il faut lire d'abord

`mobile-design-mockups/home_tile_processing_state/README.md` : la variante retenue par l'owner y est notée dans sa section « Choix de l'owner », et c'est elle qui fait foi. Ne rien redessiner ici et ne pas préférer une autre variante à celle qui est cochée — si le README ne désigne aucune variante, la tâche s'arrête et le dit, elle ne tranche pas à la place de l'owner.

## Ce que la tâche ajoute (pas ce qu'elle remplace)

Contrairement à task-362, il n'y a pas de composant existant à retirer : `HomeTile.tsx` n'affiche aujourd'hui rien pour les statuts `"ingested"`, `"resolving"`, `"processing"` de `MediaListItem.status`. La tâche ajoute la traduction visuelle de ces trois statuts, choisie par la maquette, sans toucher au traitement déjà en place de `"failed"` (`MediaFailureBadge`, `isFailedLibraryStatus`) : les deux affichages restent mutuellement exclusifs.

## Ce qui doit suivre le README, pas être improvisé ici

Si la variante retenue suppose une brique qui n'existe pas encore dans le dépôt (une boucle d'animation avec l'API `Animated` du cœur React Native, une dépendance à ajouter comme `expo-linear-gradient`), le README le dit explicitement dans ses notes d'implémentation — c'est cette note qui fait foi sur la marche à suivre, pas une improvisation locale.

## Cadrage AGENTS.md, « Nothing is deployed yet »

Rien à bridger : c'est un ajout, pas une migration. Si un token de couleur ou une clé i18n doit être créé, il l'est directement sous sa forme finale, sans repli ni ancienne valeur conservée « au cas où ».

## Garde-fous

- `TILE_WIDTH`, `TILE_COVER_HEIGHT` et le contrat d'accessibilité actuel de `HomeTile` (cible tactile unique, `accessibilityLabel` unique porté par `describeWithFailure`/son équivalent) ne changent pas.
- Le badge d'échec (`MediaFailureBadge`) et son positionnement ne sont pas modifiés par cette tâche, seulement coexistants avec le nouvel indicateur sans jamais se superposer.

## Notes pour l'owner (pas des ACs)

- La vérification visuelle du mouvement (animation fluide, absence de saccades sur la liste horizontale) t'appartient : elle demande un build sur device, hors de portée d'un worktree.
- Pour voir l'indicateur, il faut un média dont le statut vaut `"ingested"`, `"resolving"` ou `"processing"` au moment où l'accueil est ouvert — une fenêtre courte en usage normal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `HomeTile` (`mobile/src/components/HomeTile.tsx`) rend, pour les statuts `"ingested"`, `"resolving"` et `"processing"` de `MediaListItem.status`, la variante désignée par l'owner dans `mobile-design-mockups/home_tile_processing_state/README.md`, et les notes d'implémentation citent cette variante telle qu'elle y est nommée
- [ ] #2 Si la variante retenue exige une dépendance absente du dépôt, elle est ajoutée exactement comme le décrit la note d'implémentation du README, et le choix est rappelé dans les notes de la tâche
- [ ] #3 Aucune valeur littérale de couleur, d'espacement ou de rayon n'est introduite : tout vient de `mobile/src/constants/theme.ts` ; si une nouvelle teinte ou un nouveau token est nécessaire, il est ajouté nommé dans `theme.ts`, pas écrit en dur dans le composant
- [ ] #4 Le ou les libellés ajoutés suivent le registre déjà en place pour `mediaStatus.failedBadge` (majuscules, terse) et existent dans les onze catalogues de `mobile/src/i18n/`, sans clé orpheline dans un seul catalogue
- [ ] #5 L'affichage du nouvel indicateur et celui de `MediaFailureBadge` restent mutuellement exclusifs : un item `"failed"` ne montre jamais les deux, et le nouvel indicateur ne s'affiche que pour les statuts non terminaux listés ci-dessus
- [ ] #6 `TILE_WIDTH`, `TILE_COVER_HEIGHT`, le `testID` existant et le contrat d'accessibilité actuel de la tuile (cible tactile, label unique) sont inchangés
- [ ] #7 `npx tsc --noEmit` et ESLint passent sur les fichiers mobile modifiés
- [ ] #8 Aucun fichier hors `mobile/` (et le backlog) n'est modifié par cette tâche
<!-- AC:END -->
