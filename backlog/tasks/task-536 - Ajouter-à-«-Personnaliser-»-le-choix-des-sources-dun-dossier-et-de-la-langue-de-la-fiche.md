---
id: TASK-536
title: >-
  Ajouter à « Personnaliser » le choix des sources et de la langue, pour toutes
  les fiches
status: To Do
assignee: []
created_date: '2026-10-26 16:47'
updated_date: '2026-10-26 17:01'
labels:
  - mobile
  - artifacts
  - ui
dependencies:
  - TASK-532
  - TASK-533
  - TASK-535
references:
  - mobile-design-mockups/ai_tab_notebooklm/README.md
  - mobile-design-mockups/ai_tab_notebooklm/screen.png
  - mobile/src/services/artifactService.ts
  - 'mobile/app/media/folders/[id].tsx'
  - packages/core/src/i18n/locales.ts
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 143000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'écran « Personnaliser » (TASK-535) reprend deux options de NotebookLM : les sources et la langue. Décision du propriétaire (2026-10-26) : les deux sélecteurs apparaissent **toujours**, quels que soient le format (Résumé, Notes de cours, Cartes mémo, Quiz) et la page, média ou dossier. Le backend les accepte via TASK-532 (`source_ids`) et TASK-533 (`language`). Maquette : `mobile-design-mockups/ai_tab_notebooklm/`, section « Personnaliser ».

## Périmètre

- **Sources (toujours affiché)**
  - Un bouton affiche une icône, le nombre de sources retenues et une flèche.
  - Il ouvre une feuille qui liste les sources (vignette, titre, type et durée), avec une case à cocher par source. Toutes sont cochées par défaut.
  - **Sur un dossier** : en tête de la feuille, « N sur M sélectionnées » et « Tout sélectionner ». Le bouton « Valider · N sources » est désactivé à zéro. Si toutes les sources restent cochées, `source_ids` n'est pas envoyé ; sinon, la liste est envoyée.
  - **Sur un média** : le bouton indique « 1 ». La feuille montre la seule source, cochée et non décochable, sans « Tout sélectionner ». `source_ids` n'est jamais envoyé, car TASK-532 le refuse sur un média.
- **Langue (toujours affichée)**
  - Un menu déroulant liste les langues de l'app (`packages/core/src/i18n/locales.ts`), chacune dans son propre nom.
  - La langue de lecture de l'utilisateur est sélectionnée, avec la mention « (par défaut) ».
  - Si elle reste choisie, `language` n'est pas envoyé ; sinon, l'étiquette est envoyée.
- Ordre dans l'écran, sous les options propres au format : Sources, Prompt, Langue.
- Les textes existent dans les onze langues.

Note pour le propriétaire : contrôle visuel sur simulateur, sur un média et sur un dossier de plus de 10 sources (défilement de la feuille), en clair et en sombre. Vérification manuelle, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L'écran Personnaliser des quatre formats (Résumé, Notes de cours, Cartes mémo, Quiz) affiche toujours un sélecteur de sources et un menu Langue, sur un média comme sur un dossier
- [ ] #2 Sur un dossier, la feuille des sources liste les sources à cases, toutes cochées par défaut, avec Tout sélectionner et un Valider désactivé à zéro source ; source_ids n'est envoyé que si au moins une source est décochée
- [ ] #3 Sur un média, le sélecteur indique 1 et sa feuille montre la seule source, cochée et non décochable ; source_ids n'est pas envoyé
- [ ] #4 Le menu Langue sélectionne la langue de lecture, marquée (par défaut) ; language n'est envoyé que si une autre langue est choisie
- [ ] #5 Les nouveaux textes existent dans les onze langues
- [ ] #6 npm run typecheck et npm run lint passent dans mobile/
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Mise à jour 2026-10-26 : le résumé détaillé est supprimé (TASK-537, TASK-538). « Les cinq formats » désigne désormais les quatre restants : Résumé, Notes de cours, Cartes mémo, Quiz.
<!-- SECTION:NOTES:END -->
