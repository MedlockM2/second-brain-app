---
id: TASK-436
title: >-
  Permettre de créer un dossier vide depuis la Bibliothèque, sans passer par un
  média
status: Done
assignee: []
created_date: '2026-10-08 14:19'
updated_date: '2026-10-10 16:49'
labels:
  - mobile
  - feature
dependencies: []
priority: medium
type: feature
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Aujourd'hui, un dossier ne peut naître que d'un média : le seul endroit qui appelle `OrganizationService.createFolder` est `mobile/src/components/FolderPickerView.tsx`, c'est-à-dire le sélecteur de dossier qu'on ouvre depuis l'action « Ranger dans un dossier » d'un média ou depuis le modal d'enregistrement (task-374, task-389). Il faut donc avoir un média en main pour obtenir un dossier.

L'écran Bibliothèque (`mobile/app/(tabs)/search.tsx` — le fichier s'appelle encore `search`, voir le commentaire de `app/(tabs)/_layout.tsx`) affiche les dossiers et les médias, et permet de renommer ou supprimer un dossier par appui long (`useFolderActions`), mais n'offre aucun point d'entrée pour en créer un. Un utilisateur qui veut préparer son classement à l'avance — un dossier par thème, vide, avant d'y envoyer quoi que ce soit — n'a pas de chemin pour le faire.

Contraintes connues :
- Le backend est déjà là : `POST /api/folders` via `OrganizationService.createFolder(name, parentId)` accepte un `parent_folder_id` nul, donc un dossier racine vide est une création valide côté API. Aucun travail backend n'est attendu dans cette tâche.
- Les messages visibles passent par les 14 catalogues de `mobile/src/i18n/` (`fr.ts`, `en.ts`, `de.ts`, `es.ts`, `it.ts`, `nl.ts`, `pt.ts`, `ar.ts`, `hi.ts`, `ja.ts`, `zh.ts`, plus `pseudo.ts` et l'outillage `catalogs.ts` / `locales.ts`). Une clé ajoutée dans un seul catalogue est un trou visible dans les autres langues.
- Les erreurs d'API se présentent avec `getFriendlyErrorMessage`, comme le fait déjà le chemin de création de `FolderPickerView`.

Hors périmètre, à ne pas élargir : la création d'un sous-dossier depuis l'écran d'un dossier (`app/media/folders/[id].tsx`). Cette tâche ne traite que la racine, depuis la Bibliothèque.

Note au propriétaire (hors critères d'acceptation) : la validation finale est visuelle et manuelle. Après merge, vérifier sur simulateur iOS et sur Android, en thème clair et sombre, que le point d'entrée se voit sans gêner la liste ni la pilule de recherche flottante, et qu'un dossier créé vide s'ouvre bien sur un écran de dossier vide plutôt que sur une erreur.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Depuis l'écran Bibliothèque, un point d'entrée visible permet de lancer la création d'un dossier sans sélectionner ni partager de média au préalable
- [x] #2 La création demande un nom à l'utilisateur et crée le dossier à la racine, sans aucun média dedans
- [x] #3 Un nom vide ou composé uniquement d'espaces ne déclenche aucun appel réseau et laisse l'utilisateur sur sa saisie
- [x] #4 Un échec de l'API (nom refusé, réseau, session) affiche un message issu de `getFriendlyErrorMessage` ; aucun échec n'est silencieux
- [x] #5 Le dossier créé apparaît dans la liste des dossiers de la Bibliothèque immédiatement après la création, sans que l'utilisateur ait à quitter l'écran ni à tirer pour rafraîchir
- [x] #6 Toutes les clés i18n ajoutées existent dans les 14 catalogues de `mobile/src/i18n/`, traduites dans chaque langue
- [x] #7 Le point d'entrée et le champ de saisie portent un `testID`, suivant la convention des `testID` déjà posés sur les actions de média et de dossier
- [x] #8 `npm run lint` et `npx tsc --noEmit` passent dans `mobile/`
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémenté le 2026-10-10 sur l'arbre de travail principal, sans commit.

- **Point d'entrée (AC #1, #7)** : un bouton `+` (`testID="library-new-folder"`) en bout de ligne de l'en-tête « Dossiers », dans le corps Bibliothèque seulement (pas dans les résultats de recherche). Il reste visible quand la grille est repliée, en chargement ou en erreur, parce que la création n'a besoin d'aucune donnée de la liste.
- **Saisie (AC #2, #3, #7)** : le dialogue de nommage est `RenameDialog`, réutilisé avec un nouveau prop optionnel `submitLabel` (par défaut `Save`, ici `Create`). Préfixe des `testID` : `library-folder-create` (`-dialog`, `-input`, `-save`, `-cancel`, `-error`). Un nom vide ou fait d'espaces désactive le bouton et l'envoi au clavier : aucun appel réseau. `OrganizationService.createFolder(name)` crée le dossier à la racine (`parent_folder_id: null`).
- **Erreurs (AC #4)** : l'échec s'affiche dans le dialogue via `getFriendlyErrorMessage` (repli : `folderPicker.createFailed`), et le nom saisi est conservé.
- **Rafraîchissement (AC #5)** : le dossier renvoyé par le `POST` est ajouté à l'état `folders`, et l'arbre reconstruit le place dans l'ordre alphabétique. Si la section était repliée, elle se déplie.
- **i18n (AC #6)** : `search.newFolder.a11y`, `search.newFolder.title` et `search.newFolder.create` sont ajoutées et traduites dans les 11 catalogues de langue. `pseudo.ts` dérive de `en`, et `catalogs.ts` / `locales.ts` n'ont pas besoin de changer.
- **AC #8** : `npx tsc --noEmit` passe. `npm run lint` donne 0 erreur et un seul avertissement, qui existait déjà dans `purchaseService.ts`.

Fichiers modifiés : `mobile/app/(tabs)/search.tsx`, `mobile/src/components/RenameDialog.tsx`, `mobile/src/i18n/{ar,de,en,es,fr,hi,it,ja,nl,pt,zh}.ts`.
<!-- SECTION:NOTES:END -->
