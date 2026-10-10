---
id: TASK-437
title: >-
  Ajouter « Nouveau dossier » au menu d'actions d'un média : créer un dossier
  nommé et y ranger le média d'un coup
status: To Do
assignee: []
created_date: '2026-10-08 14:20'
labels:
  - mobile
  - feature
dependencies:
  - TASK-436
priority: medium
type: feature
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le menu trois points d'un média propose trois actions, définies dans `mobile/src/hooks/useMediaActions.ts` : « Ranger dans un dossier », « Renommer », « Supprimer ». Pour envoyer un média dans un dossier qui n'existe pas encore, l'utilisateur doit ouvrir « Ranger », trouver le bouton de création à l'intérieur du sélecteur (`FolderPickerView`), saisir un nom, puis sélectionner le dossier qui vient d'apparaître. Le cas le plus fréquent quand on lit un média — « celui-là mérite son propre dossier » — est donc le plus long.

Le propriétaire demande une entrée « Nouveau dossier » directement dans ce menu : elle demande un nom, crée le dossier et y range le média, en une seule interaction, sans passer par la liste des dossiers existants. Elle vient en plus de « Ranger dans un dossier », qui reste le chemin vers un dossier déjà créé.

Contraintes connues :
- Les actions sont construites dans `useMediaActions`, un hook partagé : la page d'un média (`src/components/CompletedDetailView.tsx`) et l'appui long sur une vignette de la Bibliothèque (`app/(tabs)/search.tsx`) montent le même `AnchoredContextMenu`. Une action ajoutée au hook apparaît donc aux deux endroits — c'est cohérent et voulu, mais c'est à vérifier plutôt qu'à découvrir.
- Un média appartient à un seul dossier : le rangement est un `PATCH` de `folder_id` (`OrganizationService`), donc ranger dans le dossier neuf sort le média de son dossier précédent. Ce n'est pas une copie.
- La création se fait en deux appels réseau (créer le dossier, puis y ranger le média), donc le second peut échouer alors que le premier a réussi. Le dossier existe alors, vide, et l'utilisateur doit l'apprendre.
- Les messages visibles passent par les 14 catalogues de `mobile/src/i18n/`. Le retour de rangement existant est le toast `media.movedToFolder`.

Ce que task-436 fournit, et dont cette tâche dépend : le chemin de création d'un dossier en dehors du sélecteur de dossier (saisie du nom, validation d'un nom vide, présentation des erreurs d'API) et ses clés i18n. Réutiliser ce chemin au lieu d'en écrire un second.

Note au propriétaire (hors critères d'acceptation) : la validation finale est manuelle. Après merge, vérifier sur simulateur iOS et sur Android que l'entrée tient dans le menu sans le faire déborder, et faire le parcours complet depuis la page d'un média déjà rangé ailleurs puis depuis un média non classé.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le menu d'actions d'un média comporte une entrée « Nouveau dossier », distincte de « Ranger dans un dossier », qui reste présente et inchangée
- [ ] #2 L'entrée est atteignable depuis le menu trois points de la page d'un média, et son comportement est identique partout où `useMediaActions` monte le menu
- [ ] #3 Choisir cette entrée demande un nom, crée le dossier avec ce nom et y range le média, sans passer par la liste des dossiers existants
- [ ] #4 Un média déjà rangé dans un autre dossier se retrouve dans le dossier neuf et seulement là, conformément à la règle d'un seul dossier par média
- [ ] #5 Si la création du dossier réussit mais le rangement du média échoue, l'utilisateur voit un message qui dit explicitement que le dossier a été créé et que le média n'y est pas
- [ ] #6 Un nom vide ou composé uniquement d'espaces ne crée aucun dossier
- [ ] #7 Le succès donne un retour visible à l'utilisateur, dans la même forme que le toast de rangement existant
- [ ] #8 La page du média et la Bibliothèque affichent le nouveau dossier du média sans rechargement manuel
- [ ] #9 Toutes les clés i18n ajoutées existent dans les 14 catalogues de `mobile/src/i18n/`, traduites dans chaque langue
- [ ] #10 L'entrée de menu porte un `testID` suivant la convention `media-actions-*` déjà en place dans `useMediaActions`
- [ ] #11 `npm run lint` et `npx tsc --noEmit` passent dans `mobile/`
<!-- AC:END -->
