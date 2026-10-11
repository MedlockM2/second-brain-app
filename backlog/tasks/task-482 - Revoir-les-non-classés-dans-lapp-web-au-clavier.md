---
id: TASK-482
title: 'Revoir les non classés dans l''app web, au clavier'
status: Done
assignee: []
created_date: '2026-10-11 15:57'
updated_date: '2026-10-11 17:31'
labels:
  - web
  - feature
dependencies:
  - TASK-476
  - TASK-479
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - mobile-design-mockups/web_app_owner_direction/README.md
  - mobile-design-mockups/web_app_owner_direction/screens/06-non-classes.png
  - >-
    mobile-design-mockups/web_app_owner_direction/screens/07-non-classes-termine.png
  - mobile/app/media/unsorted-review.tsx
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Source de vérité : `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, tel que précisé par `complement-response-2026-10-11.md` (même répertoire), qui prime sur la Recommendation et sur les §8 à §12 du README. Cette tâche est l'élément **W-12** du §3 du complément.

L'interface est la direction de l'owner : `mobile-design-mockups/web_app_owner_direction/README.md` **fait foi**. Cette tâche reprend sa ligne « Non classés, adapté au bureau » du tableau « Ce que la maquette applique », et les captures `screens/06-non-classes.png` et `screens/07-non-classes-termine.png`. L'entrée est l'onglet « Non classés · N » de la barre (task-475) ; le choix de destination réutilise le composant Ranger de task-479.

## Périmètre

- La revue garde les actions du mobile (**Jeter**, **Approfondir**, **Ranger**) mais n'est plus un carrousel : la **file** visible à gauche, la **source à décider** au centre (couverture, accroche, puces), les **destinations toujours ouvertes** à droite.
- On range en un clic, ou **au clavier** : **1 à 5** pour les dossiers récents, **D** pour jeter, **O** pour approfondir, **← →** pour naviguer.
- Un écran « Plus rien à trier » termine la revue.
- Le compteur N de la barre suit la file.

## Règles

- Câblé sur les endpoints existants : **pas de nouvelle route** d'API.
- Les dossiers n'ont qu'un niveau : aucun écran ne crée un dossier dans un dossier, et « Déplacer le dossier » n'existe pas.
- Ne modifier aucun fichier de `mobile/` (lecture par l'alias seulement).
- Rien n'est déployé : aucune compatibilité. Pas de tests automatisés.

## Note à l'owner

Vérification contre les captures 06 et 07 sur un compte `-dev` qui a des non classés : trier toute la file au clavier.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La revue rend la file à gauche, la source à décider au centre et les destinations ouvertes à droite, avec Jeter, Approfondir et Ranger
- [x] #2 Les raccourcis 1 à 5, D, O, ← et → de la maquette agissent sur la source courante, et l'écran Plus rien à trier termine la revue
- [x] #3 Les écrans sont câblés sur les endpoints existants, sans nouvelle route, et aucun écran ne crée un dossier dans un dossier ni ne déplace un dossier
- [x] #4 Les libellés sont présents dans les 11 langues
- [x] #5 Le build passe, typecheck et lint sont propres, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Commit 637112e2.

- **/unsorted** (`web/src/pages/UnsortedPage.tsx`) : la file à gauche (position « 3 / 12 », ligne courante marquée), la source à décider au centre (couverture, type, âge, titre, créateur, accroche et puces du review_blurb, ou « Pas encore de résumé court »), les destinations toujours ouvertes à droite (`FolderPickerList` de task-479, en ligne, dossiers récents numérotés 1 à 5, Non classés exclu).
- Actions : Jeter (D, `DELETE /api/media/:id`, retrait immédiat et remise en place si l'appel échoue), Approfondir (O, ouvre la page média), Ranger (clic ou 1-5, `PATCH /api/media/:id {folder_id}`) ; ← → pour naviguer (inversées en RTL, ignorées pendant une saisie ou sous un dialogue). « Plus rien à trier » termine la revue avec un retour à l'Accueil.
- Même file que le mobile : dossier par défaut désigné par son id, ordre chronologique croissant, une page de 100, figée à l'ouverture. Chaque décision relit le compteur « Non classés · N » de la barre.
- `FolderPickerList` gagne `numbered` et `recentFolders()` exporté pour les raccourcis.
- 4 libellés web en 11 langues ; build, typecheck, lint propres ; vérifié en Chrome headless (D puis 1 au clavier, appels DELETE et PATCH observés).
<!-- SECTION:FINAL_SUMMARY:END -->
