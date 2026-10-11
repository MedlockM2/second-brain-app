---
id: TASK-479
title: >-
  Ajouter une source depuis l'app web (lien, fichier, dépôt, collage) et la
  ranger dans un dossier
status: Done
assignee: []
created_date: '2026-10-11 15:56'
updated_date: '2026-10-11 17:27'
labels:
  - web
  - feature
dependencies:
  - TASK-476
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - mobile-design-mockups/web_app_owner_direction/README.md
  - mobile-design-mockups/web_app_owner_direction/screens/18-ranger.png
  - mobile-design-mockups/web_app_owner_direction/code.html
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-09** du §3 du complément.

L'interface est la direction de l'owner : `mobile-design-mockups/web_app_owner_direction/README.md` **fait foi**, avec la maquette `code.html` et la capture `screens/18-ranger.png`. Sur le web, le + flottant du mobile est le bouton « Ajouter » de la barre (« Deux choix faits sans consigne explicite », même README) ; l'appareil photo n'a pas d'usage sur un ordinateur, l'import d'une photo passe par le dépôt de fichier.

## Périmètre

- Le bouton **Ajouter** de la barre ouvre l'ajout d'une source par **lien collé**, **fichier choisi**, **fichier déposé** (glisser-déposer, photo comprise) et **texte collé** (une note), câblés sur les endpoints d'ingestion existants que l'app mobile utilise.
- **Ranger une source** (capture 18) : choisir son dossier de destination parmi les dossiers de premier niveau, ou en créer un au premier niveau. Le même composant sert à la revue des non classés (task-482).

## Règles

- Câblé sur les endpoints existants : **pas de nouvelle route** d'API.
- Les dossiers n'ont qu'un niveau : aucun écran ne crée un dossier dans un dossier, et « Déplacer le dossier » n'existe pas.
- Ne modifier aucun fichier de `mobile/` (lecture par l'alias seulement).
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Vérification contre l'API `-dev` : ajouter un lien, un fichier choisi, un fichier déposé et un texte collé, puis ranger une source.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le bouton Ajouter de la barre ajoute une source par lien collé, fichier choisi, fichier déposé et texte collé, sur les endpoints d'ingestion existants
- [x] #2 Ranger une source choisit un dossier de premier niveau ou en crée un au premier niveau, comme la capture 18-ranger.png, dans un composant réutilisable par la revue des non classés
- [x] #3 Les écrans sont câblés sur les endpoints existants, sans nouvelle route, et aucun écran ne crée un dossier dans un dossier ni ne déplace un dossier
- [x] #4 Les libellés sont présents dans les 11 langues
- [x] #5 Le build passe, typecheck et lint sont propres, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Commit 45394f1.

- **Ajouter** (barre) ouvre `AddSourceDialog` sans dossier : lien collé (`POST /api/media/ingest-url`), texte collé enregistré comme note (`POST /api/media/ingest-shared-content`, `share_type: "text"`, `source_platform: "notes"`, validé par `validateSharedNoteText`), fichier choisi ou déposé (`upload-url` → PUT présigné → `upload` / `upload-audio`). Un fichier déposé n'importe où dans l'app, ou un lien/texte collé hors d'un champ, ouvre le dialogue déjà rempli.
- Après l'ajout : l'étape « Votre média est en cours d'enregistrement… le ranger ? » de la maquette, puis le sélecteur ; l'import n'attend jamais ce choix (`web/src/components/AddFlow.tsx`).
- **Ranger** (`web/src/components/FolderPicker.tsx`, capture 18) : recherche, dossiers récemment utilisés sur ce navigateur, tous les dossiers racine, et « Créer « … » » au premier niveau quand la recherche n'en trouve pas. Rangement par `PATCH /api/media/:id {folder_id}`. Composant réutilisé par le menu `…` du média (« Déplacer ») et prêt pour la revue des non classés (task-482 : variante `FolderPickerList` intégrable dans un volet, option `showUnsorted`).
- Accueil, Bibliothèque, page dossier et compteur « Non classés · N » se relisent après un ajout ou un rangement ; l'état vide de l'Accueil ouvre le même parcours. La route provisoire `/add` est supprimée.
- 12 libellés web en 11 langues (et le libellé du champ « Coller un lien ou un texte »). Build, typecheck, lint propres ; parcours vérifié en Chrome headless contre une API simulée.
<!-- SECTION:FINAL_SUMMARY:END -->
