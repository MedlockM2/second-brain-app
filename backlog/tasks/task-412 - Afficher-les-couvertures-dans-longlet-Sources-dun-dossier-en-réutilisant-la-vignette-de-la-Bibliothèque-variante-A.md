---
id: TASK-412
title: >-
  Afficher les couvertures dans l'onglet Sources d'un dossier en réutilisant la
  vignette de la Bibliothèque (variante A)
status: To Do
assignee: []
created_date: '2026-09-27 21:01'
labels:
  - mobile
  - ux
dependencies: []
documentation:
  - mobile-design-mockups/folder_sources_tab_refonte/README.md
  - >-
    mobile-design-mockups/folder_sources_tab_refonte/variante_a_vignette_bibliotheque/code.html
  - >-
    mobile-design-mockups/folder_sources_tab_refonte/variante_a_vignette_bibliotheque/screen.png
priority: medium
type: enhancement
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

L'onglet **Sources** d'un dossier (`mobile/app/media/folders/[id].tsx`) n'affiche jamais la couverture des sources, alors que `media_image` est présent dans chaque `MediaListItem` et que la Bibliothèque l'affiche déjà. Chaque ligne se résume à une glyphe de type dans une case de 36 pt et à un titre tronqué sur une ligne. Dans un dossier de reels (le cas le plus fréquent chez l'owner), toutes les lignes portent la même icône ▶ : la liste ne permet pas de distinguer les sources. L'owner n'aime pas cet écran, en particulier « les petits icônes sans image ».

Quatre variantes ont été maquettées pour **n'importe quel dossier**, et l'owner a retenu le 2026-09-27 la **variante A, « Vignette Bibliothèque »**. Son principe : une source se présente dans un dossier exactement comme dans la Bibliothèque, sous la forme de `MediaListCard` **réutilisé tel quel**. Aucune seconde vignette, aucune copie locale du composant. Les sous-dossiers prennent la même forme de carte : leur vignette est un collage des couvertures des sources qu'ils contiennent, suivi du nom et du nombre d'éléments.

## À lire avant de commencer

- Maquette retenue : `mobile-design-mockups/folder_sources_tab_refonte/variante_a_vignette_bibliotheque/` (`code.html` + `screen.png`). Elle montre un dossier mixte, le petit écran 320 x 568 et deux cas limites : un dossier de reels, et un dossier dont aucune source n'a d'image.
- Comparatif et contexte des 4 variantes : `mobile-design-mockups/folder_sources_tab_refonte/README.md`. Les variantes B, C et D **ne sont pas** à implémenter.
- Écart assumé de la maquette : sur 320 pt, elle réduit la vignette à 96 x 54. Ce n'était qu'une illustration de l'étroitesse de la colonne de texte, pas une consigne. La décision est de réutiliser la carte sans la dériver.

## Contraintes du projet

- Design system *Amber Clarity*, tokens dans `mobile/src/constants/theme.ts` : pas de nouvelle palette, pas de nouvelle échelle typographique.
- Rendu à tenir à 414 x 896 pt et à 320 pt (Display Zoom).
- iOS et Android partagent la base de code : pas de garde `Platform.OS` sauf nécessité nommée et justifiée.
- Toute chaîne visible passe par les 11 catalogues i18n.
- **Rien n'est publié en store** (`CLAUDE.md`, « Nothing is deployed yet ») : l'ancienne ligne de source est **supprimée dans le même run**. Pas de repli, pas de double affichage.
- Idéalement, le changement reste purement JS/TS pour partir en OTA.
- Aucun nouvel endpoint. La réponse de `getFolderMedia` inclut déjà les médias des sous-dossiers (descendants compris), donc tout ce que le collage et les compteurs demandent est déjà chargé par l'écran.

## Hors périmètre

- L'onglet IA du dossier, et l'artefact podcast de dossier (task-387 / task-388).
- La liste des dossiers (`app/media/folders/index.tsx`) et sa propre `FolderRow`.
- Toute modification visuelle de `MediaListCard` pour la Bibliothèque ou la recherche.

## Note pour l'owner, hors AC

La validation visuelle se fait sur appareil, au prochain build ou à la prochaine OTA, à 414 x 896 et à 320 pt. Cas à vérifier : un dossier mixte avec sous-dossiers, un dossier de reels (« App ») et un dossier sans aucune image. L'appui long doit lever la nouvelle carte. Un agent en worktree ne peut pas faire cette validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Chaque source de l'onglet Sources d'un dossier est rendue par MediaListCard (couverture 16:9, badge de type, âge, titre sur 2 lignes, créateur ou domaine), sans copie ni variante locale du composant ; une source sans couverture ou dont la couverture échoue affiche le repli déjà prévu par MediaListCard.
- [ ] #2 L'ancienne ligne de source (SourceRow) et ses styles sont supprimés dans le même run ; aucune référence morte ne subsiste dans mobile/ (vérifiable par recherche).
- [ ] #3 L'appui long sur une source ouvre toujours le menu d'actions (déplacer, renommer, supprimer), et la copie levée au-dessus du flou est la nouvelle carte, pas l'ancienne ligne.
- [ ] #4 Chaque sous-dossier est une carte de même gabarit : vignette en collage d'au plus 3 couvertures prises parmi les sources du sous-dossier et de ses descendants, nom, nombre d'éléments (et de sous-dossiers s'il y en a), chevron ; un sous-dossier sans aucune couverture affiche la glyphe de dossier sur une teinte du design system, jamais une case vide.
- [ ] #5 Le collage et les compteurs des sous-dossiers sont calculés depuis les données déjà chargées par l'écran : aucune requête réseau supplémentaire n'est introduite.
- [ ] #6 Quand le dossier contient des sous-dossiers, la liste porte deux légendes, « Dossiers » puis « Sources · N » ; sans sous-dossier, aucune légende n'est affichée.
- [ ] #7 Une source encore en traitement ou en échec dans un dossier porte le même marqueur que dans la Bibliothèque, et le balayage de traitement y prend fin de la même manière bornée : il ne tourne pas indéfiniment sur cet écran.
- [ ] #8 Les valeurs de style proviennent des tokens de mobile/src/constants/theme.ts ; aucune couleur ni taille typographique codée en dur n'est introduite.
- [ ] #9 Toute chaîne visible nouvelle est présente dans les 11 catalogues i18n, sans clé orpheline ni clé manquante ; toute clé devenue inutile est retirée.
- [ ] #10 Les commentaires qui justifiaient l'ancien choix sont réécrits : l'en-tête de app/media/folders/[id].tsx (qui dit que MediaListCard n'y est volontairement pas utilisé) et celui de MediaListCard (qui se dit l'unique vignette de la Bibliothèque) nomment désormais l'onglet Sources d'un dossier parmi ses hôtes.
- [ ] #11 npm run lint et npx tsc --noEmit passent sans erreur dans mobile/.
- [ ] #12 Les notes d'implémentation indiquent si le changement part en OTA ou exige un build, en nommant les fichiers qui déplacent le fingerprint Expo le cas échéant.
<!-- AC:END -->
