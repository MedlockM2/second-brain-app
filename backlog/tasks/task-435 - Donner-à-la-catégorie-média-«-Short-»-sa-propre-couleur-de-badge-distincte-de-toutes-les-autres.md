---
id: TASK-435
title: >-
  Donner à la catégorie média « Short » sa propre couleur de badge, distincte de
  toutes les autres
status: To Do
assignee: []
created_date: '2026-10-07 10:23'
labels:
  - mobile
  - enhancement
dependencies: []
priority: low
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dans la vignette média, le badge de type `short_video` est aujourd'hui indiscernable de `youtube_video` : les deux prennent le même remplissage (`errorContainer`) et le même glyphe (`play-circle-outline`), dans `getMediaTypeBadgeTones` et `getMediaTypeIcon`. Seul le mot du badge (« SHORT » vs « VIDÉO ») les sépare, ce qui est trop faible pour un repérage à l'œil dans une liste.

Le propriétaire demande une couleur propre au Short, différente non seulement de Vidéo mais aussi de toutes les autres catégories affichées : podcast (`primary` ambré), article et image_post (`surfaceContainerHigh` tonal), audio, texte, document, lien (tonal par défaut). La teinte retenue doit donc être une quatrième famille lisible, pas une nuance du rouge vidéo — et elle ne doit pas faire tache : elle reste dans la direction de design Amber Clarity que suit la palette de `mobile/src/constants/theme.ts`.

Contraintes connues à respecter :
- La palette est définie dans `mobile/src/constants/theme.ts`, en deux modes (clair et sombre) ; une couleur de badge ne peut être choisie indépendamment de son encre, comme l'explique le commentaire de `getMediaTypeBadgeTones` (l'ambre exige `onPrimary`, le rouge et le tonal gardent `textMain`).
- Précédent à suivre pour la méthode : task-297, qui a donné au dossier « Non classés » sa propre teinte en restant dans Amber Clarity au lieu d'introduire une couleur étrangère.

Note au propriétaire (hors critères d'acceptation) : la validation finale est visuelle. Après merge, vérifier sur simulateur iOS et sur Android, en mode clair et sombre, qu'un Short et une vidéo YouTube côte à côte dans la Bibliothèque se distinguent au premier regard, que le Short ne se confond pas avec le badge podcast, et que l'écran garde son équilibre chromatique.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le badge de type d'un média `short_video` utilise un remplissage qui n'est utilisé par aucun autre type de média, en mode clair comme en mode sombre
- [ ] #2 La teinte choisie est exprimée par des tokens de `mobile/src/constants/theme.ts` (ajoutés si besoin dans les deux palettes), et non par une valeur hexadécimale écrite en dur dans un composant
- [ ] #3 La teinte choisie appartient à la direction de design Amber Clarity déjà en place : sa justification cite les tokens voisins de la palette dont elle dérive
- [ ] #4 Le contraste entre l'encre du badge Short et son remplissage est mesuré et documenté dans le code, pour les deux modes, et vaut au moins 4.5:1
- [ ] #5 Le choix de teinte, et la raison pour laquelle elle ne concurrence ni le rouge vidéo ni l'ambre podcast, est expliqué en commentaire à l'endroit où les tons du badge sont décidés
- [ ] #6 Les autres types de média gardent exactement les tons qu'ils avaient avant la tâche
- [ ] #7 `npm run lint` et `npx tsc --noEmit` passent dans `mobile/`
<!-- AC:END -->
