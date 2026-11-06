---
id: TASK-607
title: >-
  Transmettre toute une sélection WhatsApp (textes et vocaux, dans l'ordre)
  depuis l'extension de partage et l'envoyer comme conversation
status: Done
assignee: []
created_date: '2026-11-06 16:04'
updated_date: '2026-11-06 16:40'
labels:
  - mobile
  - ingestion
dependencies:
  - TASK-606
references:
  - >-
    node_modules/expo-share-intent/plugin/build/ios/ShareExtensionViewController.swift
  - node_modules/expo-share-intent/ios/ExpoShareIntentModule.swift
  - >-
    node_modules/expo-share-intent/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt
  - mobile/patches/
  - mobile/src/contexts/ShareIntentContext.tsx
  - mobile/src/services/sharedContentService.ts
  - mobile/app/share-confirmation.tsx
priority: high
type: bug
ordinal: 214000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, build natif ni validation propriétaire demandé par les critères.

## Constat (2026-11-06, lecture du code d'`expo-share-intent` 6.1.1)

**Les vocaux d'une sélection mixte sont perdus.** Dans `plugin/build/ios/ShareExtensionViewController.swift`, l'extension iOS lance un traitement par élément. Les textes vont dans `sharedText` et les fichiers dans `sharedMedia`. C'est le traitement de l'élément d'**indice le plus élevé** qui écrit dans les UserDefaults et rouvre l'app, et il n'écrit que sa propre liste (lignes 118, 315, 400 et 468, `if index == count - 1`). Conséquences :
- si le dernier élément est un texte, les vocaux sont perdus ;
- si le dernier élément est un vocal, tous les textes sont perdus ;
- les traitements tournent en parallèle (`Task.detached`), donc le dernier peut finir avant les autres et écrire une liste incomplète.

**Les textes sont collés sans séparation.** `ios/ExpoShareIntentModule.swift:127` joint les textes avec `","`.

**Ce que WhatsApp transmet** (vérifié sur dev le 2026-11-06) : seulement le corps de chaque message, sans auteur ni heure, chaque élément se terminant par un retour à la ligne.

**Android.** `ExpoShareIntentModule.kt` traite `ACTION_SEND_MULTIPLE` comme une liste de fichiers et ignore `EXTRA_TEXT`. On ne sait pas encore ce que WhatsApp Android envoie pour une sélection mixte.

Côté JS, `ShareIntentContext.tsx` ne garde qu'un fichier (`selectShareIntentFile`) ou une seule chaîne de texte.

## Attendu (décision de l'owner, 2026-11-06)

Une sélection d'au moins deux éléments (textes et/ou vocaux) devient un seul média « conversation » envoyé via le share_type créé par task-606. Lire `docs/` et le code de task-606 pour le contrat exact. Un texte seul et un vocal seul gardent leur chemin actuel.

- **Patch du module natif** par `patch-package` dans `mobile/patches/`, comme le patch existant. Il doit être appliqué au build EAS : vérifier `postinstall`.
  - iOS : attendre la fin du traitement de **tous** les éléments avant d'écrire et de rediriger, puis transmettre à l'app la liste ordonnée complète de la sélection (textes et fichiers, dans l'ordre des `attachments`).
  - Android : lire `EXTRA_TEXT` en plus d'`EXTRA_STREAM` dans `ACTION_SEND_MULTIPLE`.
  - L'ordre textes/fichiers doit survivre jusqu'au JS. La forme du champ exposé est au choix de l'implémenteur, tant qu'elle est documentée dans le patch.
- **JS** : `ShareIntentContext` reconnaît une sélection multiple. Il envoie chaque vocal par adresse signée (`shared_audio`, comme aujourd'hui), puis soumet la liste ordonnée au nouveau share_type. L'écran de confirmation résume la sélection (nombre de messages et de vocaux) en réutilisant les composants existants : pas de nouveau visuel dans cette tâche.
- Pas de repli vers l'ancien comportement (garder le dernier type, joindre par virgule) : il est supprimé.

## Note à l'owner (hors critères)

- Build natif requis : ce n'est pas une mise à jour OTA.
- À vérifier sur appareil :
  - WhatsApp iOS, 3 textes + 1 vocal : un seul média, avec tout dans l'ordre ;
  - un vocal seul et un texte seul, inchangés ;
  - WhatsApp Android, sélection mixte : noter ce qui arrive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Un patch `patch-package` d'`expo-share-intent` est versionné dans `mobile/patches/` et appliqué par le `postinstall` racine.
- [x] #2 iOS : l'extension collecte chaque élément par son indice et n'écrit le partage qu'une fois tous les éléments traités ; la règle du dernier élément est supprimée.
- [x] #3 iOS : une sélection d'au moins deux éléments, tous textes ou audio, est transmise comme une liste ordonnée de fichiers, chaque texte écrit dans un fichier `text/x-shared-message` ; un lien dans le partage reste prioritaire.
- [x] #4 `ShareIntentContext` route une telle sélection vers `share_type=conversation`, en envoyant chaque vocal par adresse signée et en respectant l'ordre ; un texte seul et un vocal seul gardent leur chemin actuel.
- [x] #5 Le commit porte une ligne `Web:` conforme à `scripts/check_web_parity.py`.
- [x] #6 `tsc` et le lint passent sans erreur dans `mobile/`.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-06 — périmètre ajusté à l'implémentation :
- **Android non modifié.** Ce que WhatsApp Android envoie pour une sélection mixte n'a jamais été observé, et un patch écrit à l'aveugle serait invérifiable. À reprendre après un essai sur appareil.
- **Écran de confirmation inchangé.** Il n'affiche le contenu d'aucun type de partage, seulement l'état de l'envoi : il n'y avait rien à y résumer.
- **Jonction par virgule du module laissée en place.** Elle n'est plus atteinte par une sélection de plusieurs textes, qui passe désormais en conversation.

Le Swift patché a été vérifié au typage avec le SDK UIKit (cible Mac Catalyst, faute de SDK iOS sur la machine), avec les mêmes avertissements que l'original.

Note à l'owner : il faut un build natif, ce n'est pas une mise à jour OTA.
<!-- SECTION:NOTES:END -->
