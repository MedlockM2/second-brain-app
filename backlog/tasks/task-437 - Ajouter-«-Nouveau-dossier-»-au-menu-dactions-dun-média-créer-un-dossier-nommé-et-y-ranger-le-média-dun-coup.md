---
id: TASK-437
title: >-
  Ajouter « Nouveau dossier » au menu d'actions d'un média : créer un dossier
  nommé et y ranger le média d'un coup
status: Done
assignee: []
created_date: '2026-10-08 14:20'
updated_date: '2026-10-10 21:02'
labels:
  - mobile
  - feature
dependencies:
  - TASK-436
modified_files:
  - mobile/src/hooks/useMediaActions.ts
  - mobile/src/components/Toast.tsx
  - mobile/src/components/CompletedDetailView.tsx
  - mobile/src/components/ScreenHeader.tsx
  - mobile/app/(tabs)/search.tsx
  - 'mobile/app/media/folders/[id].tsx'
  - mobile/src/i18n/en.ts
  - mobile/src/i18n/fr.ts
  - mobile/src/i18n/es.ts
  - mobile/src/i18n/de.ts
  - mobile/src/i18n/it.ts
  - mobile/src/i18n/pt.ts
  - mobile/src/i18n/nl.ts
  - mobile/src/i18n/ja.ts
  - mobile/src/i18n/zh.ts
  - mobile/src/i18n/ar.ts
  - mobile/src/i18n/hi.ts
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
- [x] #1 Le menu d'actions d'un média comporte une entrée « Nouveau dossier », distincte de « Ranger dans un dossier », qui reste présente et inchangée
- [x] #2 L'entrée est atteignable depuis le menu trois points de la page d'un média, et son comportement est identique partout où `useMediaActions` monte le menu
- [x] #3 Choisir cette entrée demande un nom, crée le dossier avec ce nom et y range le média, sans passer par la liste des dossiers existants
- [x] #4 Un média déjà rangé dans un autre dossier se retrouve dans le dossier neuf et seulement là, conformément à la règle d'un seul dossier par média
- [x] #5 Si la création du dossier réussit mais le rangement du média échoue, l'utilisateur voit un message qui dit explicitement que le dossier a été créé et que le média n'y est pas
- [x] #6 Un nom vide ou composé uniquement d'espaces ne crée aucun dossier
- [x] #7 Le succès donne un retour visible à l'utilisateur, dans la même forme que le toast de rangement existant
- [x] #8 La page du média et la Bibliothèque affichent le nouveau dossier du média sans rechargement manuel
- [x] #9 Toutes les clés i18n ajoutées existent dans les 14 catalogues de `mobile/src/i18n/`, traduites dans chaque langue
- [x] #10 L'entrée de menu porte un `testID` suivant la convention `media-actions-*` déjà en place dans `useMediaActions`
- [x] #11 `npm run lint` et `npx tsc --noEmit` passent dans `mobile/`
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10, fait sur l'arbre de travail principal.

- `useMediaActions` : nouvelle entrée `new-folder` (testID `media-actions-new-folder`), placée juste après « Ranger dans un dossier », qui ne change pas. Elle ouvre le `RenameDialog` de task-436 (`newFolderProps`, mêmes clés `search.newFolder.*` / `folderPicker.*`, plafond de 255 caractères), crée le dossier racine puis fait `setMediaFolder` (un PATCH de `folder_id`, donc le média quitte son ancien dossier).
- Nom vide ou fait d'espaces : le dialogue refuse déjà l'envoi, et le hook vérifie aussi `trim()` avant l'appel.
- Échec de création : l'erreur s'affiche dans le dialogue, qui reste ouvert. Création réussie mais rangement échoué : le dialogue se ferme (un nouvel essai créerait un doublon) et un toast d'erreur affiche `mediaActions.newFolder.moveFailed` (« le dossier X a été créé, mais cette source n'a pas pu y être rangée »).
- Succès : toast `media.movedToNamed`, la même confirmation que celle de la page média. Le toast de `CompletedDetailView` a été extrait dans `src/components/Toast.tsx` (`useToast` + `<Toast />`) pour que les trois écrans qui montent le menu l'affichent.
- Mise à jour sans rechargement : la Bibliothèque ajoute le dossier à la grille (et la déplie), met à jour `folder_id` de la ligne et relit les dossiers pour les compteurs. La page média met à jour `currentFolderId` et le ref déjà annoncé, pour éviter un second toast au retour. La page dossier retire la carte, puisque le nouveau dossier est à la racine.
- i18n : 2 clés traduites dans les 11 catalogues de `mobile/src/i18n/`. L'AC parle de 14 catalogues, mais `catalogs.ts` n'en déclare que 11 (`pseudo.ts` est une transformation, pas un catalogue).
- `npx tsc --noEmit` passe ; `npm run lint` ne donne aucune erreur (le seul avertissement, dans `purchaseService.ts`, existait déjà).

Note owner : la vérification visuelle sur simulateur iOS et sur Android (menu à 4 lignes sans débordement, parcours depuis un média déjà rangé et depuis un média non classé, position du toast sous la barre de recherche et sous l'en-tête du dossier) reste à faire.
<!-- SECTION:NOTES:END -->
