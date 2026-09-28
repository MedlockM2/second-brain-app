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
- [x] #1 Chaque source de l'onglet Sources d'un dossier est rendue par MediaListCard (couverture 16:9, badge de type, âge, titre sur 2 lignes, créateur ou domaine), sans copie ni variante locale du composant ; une source sans couverture ou dont la couverture échoue affiche le repli déjà prévu par MediaListCard.
- [x] #2 L'ancienne ligne de source (SourceRow) et ses styles sont supprimés dans le même run ; aucune référence morte ne subsiste dans mobile/ (vérifiable par recherche).
- [x] #3 L'appui long sur une source ouvre toujours le menu d'actions (déplacer, renommer, supprimer), et la copie levée au-dessus du flou est la nouvelle carte, pas l'ancienne ligne.
- [x] #4 Chaque sous-dossier est une carte de même gabarit : vignette en collage d'au plus 3 couvertures prises parmi les sources du sous-dossier et de ses descendants, nom, nombre d'éléments (et de sous-dossiers s'il y en a), chevron ; un sous-dossier sans aucune couverture affiche la glyphe de dossier sur une teinte du design system, jamais une case vide.
- [x] #5 Le collage et les compteurs des sous-dossiers sont calculés depuis les données déjà chargées par l'écran : aucune requête réseau supplémentaire n'est introduite.
- [x] #6 Quand le dossier contient des sous-dossiers, la liste porte deux légendes, « Dossiers » puis « Sources · N » ; sans sous-dossier, aucune légende n'est affichée.
- [x] #7 Une source encore en traitement ou en échec dans un dossier porte le même marqueur que dans la Bibliothèque, et le balayage de traitement y prend fin de la même manière bornée : il ne tourne pas indéfiniment sur cet écran.
- [x] #8 Les valeurs de style proviennent des tokens de mobile/src/constants/theme.ts ; aucune couleur ni taille typographique codée en dur n'est introduite.
- [x] #9 Toute chaîne visible nouvelle est présente dans les 11 catalogues i18n, sans clé orpheline ni clé manquante ; toute clé devenue inutile est retirée.
- [x] #10 Les commentaires qui justifiaient l'ancien choix sont réécrits : l'en-tête de app/media/folders/[id].tsx (qui dit que MediaListCard n'y est volontairement pas utilisé) et celui de MediaListCard (qui se dit l'unique vignette de la Bibliothèque) nomment désormais l'onglet Sources d'un dossier parmi ses hôtes.
- [x] #11 npm run lint et npx tsc --noEmit passent sans erreur dans mobile/.
- [x] #12 Les notes d'implémentation indiquent si le changement part en OTA ou exige un build, en nommant les fichiers qui déplacent le fingerprint Expo le cas échéant.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Ce qui est livré

**Sources (AC #1).** Dans `mobile/app/media/folders/[id].tsx`, chaque source est rendue par `MediaListCard` tel quel, sans surcharge de style, avec les mêmes props que la Bibliothèque : `item`, `onPress`, `onLongPress` et `processingStalled`. Couverture 16:9, badge de type, âge, titre sur 2 lignes, créateur ou domaine, et repli glyphe sur `surfaceContainerLow` sans couverture ou en cas d'échec : tout vient du composant. Aucune copie, aucune variante. Les testID `folder-source-media-<id>`, `folder-source-folder-<id>` et `folder-sources-list` sont conservés.

**Sous-dossiers (AC #4).** Nouveau composant `mobile/src/components/SubfolderCard.tsx`. Il reprend la boîte de `MediaListCard` token pour token : fond `surface`, `BorderRadius.xl`, padding, marges, `minHeight`, `Shadows.soft` et l'effet d'appui. Le cadre de vignette est importé (`COVER_WIDTH` × `COVER_HEIGHT`, 112 × 63), il n'est pas redéclaré.
- **Le collage** : une couverture principale sur deux tiers du cadre, puis une colonne de deux. On prend au plus 3 couvertures, les plus récentes d'abord, parmi les sources du sous-dossier **et de ses descendants**. Une couverture en échec cède sa place à la suivante. Les images passent par `expo-image`, avec le même `cacheKey` que `MediaListCard` : ouvrir le sous-dossier réutilise donc le cache.
- **Sans aucune couverture**, ou si toutes échouent, le cadre affiche la glyphe `folder` en `Colors.primary` sur `Colors.primaryTint`, la teinte ambre à 5 % du design system. On ne voit jamais de case vide.
- **Le texte** : le nom, puis « N éléments » et « · M dossiers » s'il y a des sous-dossiers, avec un chevron.

**Légendes (AC #6).** Deux légendes seulement quand le dossier a des sous-dossiers : « Folders », puis « Sources · N ». N est le nombre de sources stockées directement dans le dossier. Sans sous-dossier, il n'y a aucune légende : l'ancienne légende unique « Sources » (`ListHeaderComponent`) disparaît. Le libellé est résolu au rendu, pas mémorisé, pour suivre un changement de langue. Les légendes portent `accessibilityRole="header"`.

**Appui long (AC #3).** `mediaActions.open` est passé à `MediaListCard.onLongPress`. La carte mesure elle-même son rectangle, et le menu propose toujours de déplacer, renommer et supprimer. `renderSourcePreview` lève désormais un `MediaListCard` inerte (`noopOpenMedia`), sans marges (`styles.sourceCardPreview`), avec le même `processingStalled` que la carte de la liste. Les sous-dossiers n'ont pas d'appui long, comme avant.

**Marqueurs et balayage borné (AC #7).** `MediaListCard` dessine lui-même les marqueurs d'échec et de traitement, les mêmes que dans la Bibliothèque. L'écran arme `useProcessingRefresh` comme `search.tsx` :
- `hasProcessing` est lu sur les sources directes affichées, seulement quand l'onglet Sources est actif et qu'il n'y a ni chargement ni erreur.
- `refetch` est une relecture silencieuse de `getFolderMedia`, sans spinner.
- `processingStalled` part vers les cartes et vers la copie levée.

Le budget est borné à 5 min, puis le marqueur se fige. Le focus, le retour au premier plan et le tirer-pour-rafraîchir le réarment. Le tirer-pour-rafraîchir est **ajouté** à la liste (`RefreshControl`, teinte `Colors.primary`) : c'est l'un des trois gestes qui réarment un budget épuisé, comme dans la Bibliothèque.

**Données (AC #5).** L'écran garde maintenant la réponse de `getFolderMedia` entière, descendants compris (`folderMedia`), et en dérive trois choses :
- les sources directes de la liste ;
- les ids du périmètre IA, qui étaient avant un second état ;
- le sous-arbre de chaque sous-dossier, via la nouvelle fonction `groupMediaBySubtree` de `mobile/src/lib/folderTree.ts`.

Le compteur d'éléments d'un sous-dossier est `Folder.media_count`, déjà renvoyé par `getUserFolders`. Aucune requête nouvelle n'est faite pour le collage ni pour les compteurs. Les seules lectures ajoutées sont celles qu'exige l'AC #7 : les relectures bornées pendant un traitement et le tirer-pour-rafraîchir, qui passent tous deux par `getFolderMedia`, le même appel qu'au chargement. Effet de bord voulu : une source supprimée depuis le menu sort aussi du périmètre IA.

### Suppressions (AC #2)

- `SourceRow` et `FolderRow` de `[id].tsx` sont supprimés, avec leurs styles `sourceRow`, `sourceRowPressed`, `sourceRowPreview`, `sourceIconContainer` et `sourceTitle`.
- Les imports devenus morts sont retirés : `AnchorRect`, `StyleProp`, `ViewStyle`, `getMediaTypeIcon`, `resolveMediaTitle`, `MediaType` et `Shadows`.
- La clé i18n `folder.sourceOpenA11y` est retirée des 11 catalogues.
- Une recherche de `SourceRow`, `sourceRowPreview` et `sourceOpenA11y` dans `mobile/app`, `mobile/src`, `mobile/.maestro` et `docs` ne remonte plus que `mobile/src/components/AddSourceSheet.tsx`. Ce `SourceRow` est un composant **distinct** et privé : ce sont les lignes de la feuille « ajouter une source ». Il est hors périmètre et vivant.
- Aucun flow Maestro de `mobile/.maestro` ne cible ces lignes, et leurs testID sont de toute façon conservés.

### Tokens (AC #8)

Toutes les couleurs viennent de `Colors`, toutes les tailles de police de `Typography`, et les espacements, rayons et ombres de `Spacing`, `BorderRadius`, `Shadows` et `TouchTarget`. Le jour du collage vaut `Spacing.xs / 2`, dérivé d'un token. La gouttière de la liste vaut `Spacing.lg - Spacing.md` : les cartes gardent leur marge `Spacing.md` de Bibliothèque et tombent sur la gouttière `Spacing.lg` de l'écran, alignées sur les onglets. Seules les tailles d'icône Ionicons (28 et 20) sont numériques, comme partout dans l'app.

### i18n (AC #9)

Quatre clés sont ajoutées aux 11 catalogues (en, fr, es, de, it, pt, nl, ja, zh, ar, hi) : `folder.section.folders`, `folder.section.sources`, `folder.subfolderA11y` et `folder.subfolderWithChildrenA11y`. Elles réutilisent le vocabulaire de chaque catalogue (`folder.tab.sources`, `folders.childCount`). Les compteurs de la carte réutilisent `common.itemCount` et `folders.childCount`, déjà pluralisés. `folder.sourceOpenA11y` est retirée partout. `pseudo.ts` est une transformation, pas un catalogue.

### Commentaires (AC #10)

- L'en-tête de `[id].tsx` décrit maintenant l'onglet Sources comme la Bibliothèque : `MediaListCard` réutilisé, `SubfolderCard`, légendes, marqueurs et rafraîchissement borné.
- L'en-tête de `MediaListCard` le présente comme l'unique vignette des listes verticales de médias. Il nomme la Bibliothèque, la recherche et l'onglet Sources d'un dossier, ainsi que `SubfolderCard`, qui partage sa boîte.
- La doc de `processingStalled` et celle de `COVER_WIDTH` nomment les nouveaux hôtes.

### Vérifications (AC #11)

- `npm run typecheck` (`tsc --noEmit`) : 0 erreur.
- `npm run lint` : 0 erreur, et 1 avertissement préexistant hors périmètre (`src/services/purchaseService.ts`, `no-explicit-any`).

### OTA ou build (AC #12)

**OTA.** Le changement est purement JS/TS : `app/media/folders/[id].tsx`, `src/components/SubfolderCard.tsx`, `src/components/MediaListCard.tsx` (commentaires seulement), `src/lib/folderTree.ts` et les 11 catalogues `src/i18n/*.ts`. `expo-image` est déjà une dépendance.

Aucun fichier qui déplace le fingerprint Expo n'est touché : ni `app.config.ts`, ni `eas.json`, ni `package.json`, ni `patches/`, ni `plugins/`, ni `modules/`, ni les assets, ni les dossiers natifs. Le fingerprint calculé dans le worktree après le changement (`@expo/fingerprint fingerprint:generate`) vaut `18785ce0a4d13b9ab48d03aff33c6319ddfd4360`, le même que celui relevé par task-409.

### Limites connues, préexistantes

- `getFolderMedia` garde sa limite par défaut de 100 médias, descendants compris. Au-delà, la liste des sources et les candidats au collage sont tronqués, comme l'étaient déjà la liste et le périmètre IA. Rien n'a changé ici.
- Le compteur d'une carte de sous-dossier compte les éléments stockés **directement** dans ce sous-dossier (`media_count`, calculé côté serveur, même chiffre que la liste des dossiers). C'est aussi le « Sources · N » affiché une fois le sous-dossier ouvert. Le collage, lui, puise aussi dans les descendants : c'est ce que dit la ligne « · M dossiers ».
- Écart assumé de la maquette : à 320 pt, la vignette reste à 112 × 63, sans passer à 96 × 54, comme le demande la description.

### Pour l'owner (hors AC)

Validation visuelle sur appareil, au prochain build ou à la prochaine OTA, à 414 × 896 et à 320 pt (Display Zoom) :
- un dossier mixte avec sous-dossiers : légendes, collage à 1, 2 et 3 couvertures ;
- un dossier de reels (« App ») ;
- un dossier sans aucune image : glyphe sur teinte ambre ;
- l'appui long, qui doit lever la nouvelle carte ;
- une source en traitement : balayage, puis arrêt ou marqueur figé après 5 min ;
- le tirer-pour-rafraîchir.

Aucun test automatisé n'a été ajouté, et aucun n'était demandé.
<!-- SECTION:NOTES:END -->
