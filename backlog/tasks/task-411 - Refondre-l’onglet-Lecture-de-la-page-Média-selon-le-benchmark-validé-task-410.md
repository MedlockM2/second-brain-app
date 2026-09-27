---
id: TASK-411
title: >-
  Refondre l’onglet Lecture de la page Média selon le benchmark validé
  (task-410)
status: To Do
assignee: []
created_date: '2026-09-26 12:19'
labels:
  - mobile
  - ui
  - ux
dependencies:
  - TASK-410
priority: medium
type: feature
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

La page Média doit recevoir une nouvelle composition pour son onglet « Lecture ». Le benchmark task-410 fournit cinq propositions et l’owner choisira la direction à livrer ; la présence d’une vignette / couverture média visible fait partie de la demande.

## Décision qui fait autorité

Avant toute implémentation, lire `docs/research/task-410-media-reading-tab-refonte/README.md`, puis appliquer la décision finale de l’owner dans `Owner Validation` → `Decision`. Si cette décision renvoie à un `complement-response-*.md`, suivre aussi ce document. La recommandation initiale du benchmark ne doit pas être substituée à la décision de l’owner.

La maquette retenue se trouve sous `mobile-design-mockups/media_reading_tab_refonte/`. S’appuyer sur le chemin, les compromis et les états décrits par le benchmark, sans rouvrir le choix d’architecture ou de direction UI.

## Contraintes

- Le rendu utilise l’unique image média déjà exposée par le contrat détail. Si elle est absente, appliquer uniquement le repli choisi par le benchmark ; ne créer ni champ parallèle ni endpoint média.
- Respecter Amber Clarity et les tokens de `mobile/src/constants/theme.ts`. Toute chaîne visible passe par les 11 catalogues i18n.
- iOS et Android gardent la même base React Native ; un écart de plateforme doit être nécessaire et justifié.
- Il n’existe pas de base installée à maintenir : retirer la composition Lecture devenue inutilisée dans le même changement, sans chemin de compatibilité ni double affichage.
- Aucun test automatisé n’est à ajouter sans demande explicite.

## Hors périmètre

- L’onglet IA, la génération des artefacts, l’extraction et la persistance des images de couverture, et les changements de contrat backend.

## Note pour l’owner, hors critères

La validation visuelle sur appareil intervient après merge et publication de la mise à jour ; elle ne peut pas être satisfaite depuis le worktree de l’agent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les notes d’implémentation identifient la direction retenue par l’owner dans le README du benchmark task-410, la décision qui la mandate et le chemin de sa maquette.
- [x] #2 L’onglet « Lecture » est reconstruit conformément à cette direction, y compris sa hiérarchie, son entrée dans le texte complet, le rôle de l’aperçu, ses contrôles et les métadonnées visibles.
- [x] #3 La vignette ou couverture du média est visiblement rendue à l’emplacement décidé, à partir de l’unique image déjà exposée par le contrat détail ; l’absence d’image suit le repli documenté par le benchmark.
- [x] #4 La composition précédente et les composants devenus inutilisés sont supprimés dans le même changement ; aucune branche de compatibilité, aucun double affichage et aucune référence morte ne subsistent dans `mobile/`.
- [x] #5 Les états définis par la direction choisie sont présents et atteignables dans le code, notamment chargement, média sans image, texte non encore disponible, texte disponible et erreur de lecture.
- [x] #6 Toutes les couleurs, espacements, rayons et tailles typographiques proviennent des tokens existants ; aucun style littéral non justifié n’est introduit.
- [x] #7 Chaque nouvelle chaîne visible est présente dans les 11 catalogues i18n, sans clé orpheline ni clé manquante.
- [x] #8 Les contraintes d’accessibilité prévues par la direction retenue sont codées : libellés des actions, ordre de lecture et cibles tactiles utiles.
- [x] #9 Dans `mobile/`, `npm run lint` et `npx tsc --noEmit` passent sans erreur.
- [x] #10 Les notes précisent si le changement est distribuable en OTA ou exige un build, et nomment les fichiers qui changeraient le fingerprint Expo le cas échéant.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Direction retenue et décision qui la mandate (AC #1)

- Source : `docs/research/task-410-media-reading-tab-refonte/README.md`, front-matter `owner_decision: ok`, section *Owner Validation* → *Decision* : « Direction C bandeau retractable mais à la place de la section aperçu prévue par la direction C on utilise la partie 'l'essentiel' de la direction A ». La décision ne renvoie à aucun `complement-response-*.md` (il n'en existe pas dans le dossier). Le champ *Validated at* n'est pas rempli, mais cela ne change rien : c'est `owner_decision: ok` et le champ *Decision* qui font foi.
- Ce qui a été livré : la **direction C « Bandeau rétractable »**, et non la recommandation initiale du benchmark (A). Son bloc aperçu (la carte `SourcePreview` inchangée) est remplacé par le bloc **« L'essentiel »** de la direction A (le *Callout Aside* d'Amber Clarity).
- Maquettes suivies :
  - `mobile-design-mockups/media_reading_tab_refonte/direction_c_bandeau_retractable/` (`code.html` et `screen.png`) pour la composition, le bandeau, le repli sans image, la barre rétractée et les états ;
  - `mobile-design-mockups/media_reading_tab_refonte/direction_a_une/` pour le bloc `.callout` « L'essentiel » uniquement.

### Composition livrée (AC #2)

De haut en bas (`mobile/src/components/CompletedDetailView.tsx`) :

1. **Bandeau de couverture** (`MediaDetailHero.tsx`, nouveau), bord à bord sous la barre d'état. Il est en 4:3 sur un écran au moins deux fois plus haut que large, c'est-à-dire tous les téléphones actuels (414 pt : 310 pt d'image, comme la maquette). Il passe en 16:9 sur les écrans de classe 16:9 (iPhone SE, largeur de 320 pt), comme le cadre `c-320`. L'image est en `contentFit="cover"`, centrée. Le créateur (surtitre) et le titre (display 32/700) sont posés en bas de l'image sur une bande `GlassSurface`. Retour et `…` flottent en haut de l'image, dans deux boutons de verre de 44 pt placés à l'emplacement exact de la flèche de `MediaDetailHeader`.
2. **Titre sous le bandeau** dans trois cas : bandeau 16:9, image absente, ou titre qui dépasse 2 lignes (grands caractères). Le nombre de lignes est mesuré par `onTextLayout`. Le titre reste invisible jusqu'à cette mesure : un titre de 3 lignes apparaît directement sous le bandeau, sans saut.
3. **Une seule ligne de métadonnées** sous le bandeau : lien vers l'original (domaine et glyphe `open-outline`, seulement si l'URL est ouvrable), puis date · durée · langue · nombre de paragraphes. La ligne de métadonnées de `TranscriptReader` et le doublon de durée disparaissent.
4. **Segment Lecture / IA**, qui n'est plus collant (`stickyHeaderIndices` supprimé).
5. **« L'essentiel »** (`SourcePreview.tsx`) : barre ambre de 4 pt sur le bord de début (elle passe à droite en arabe), fond `primaryTint`, coins de fin arrondis `md`, libellé en petites capitales, puis hook et puces. Le titre « Aperçu » et la carte grise sont supprimés.
6. **Texte complet** dans le même défilement, sous son titre « Texte complet ».
7. **Barre rétractée** (`MediaReaderBar.tsx`, nouveau) : calque fixe `GlassSurface` avec `Shadows.soft`. Elle contient retour, vignette de 32 pt (même image, même clé de cache), titre sur une ligne, segment replié en deux icônes de 48 pt (`ScreenTabs` avec la nouvelle option `iconOnly`) et progression de lecture de 4 pt. La barre et son segment apparaissent en fondu via deux `interpolate` sur un `Animated.event` en pilote natif (opacité et `scaleX` uniquement). Le segment de la barre n'apparaît qu'une fois le segment de la page passé dessous, pour qu'un seul segment soit touchable à la fois. Un onglet choisi depuis la barre ouvre le haut de son contenu, juste sous la barre.
8. **Barre d'état** claire sur l'image et sombre dès que la barre rétractée (ou un bandeau tonal) est dessous, via `expo-status-bar`. L'entrée n'est montée que lorsque l'écran a le focus (`useIsFocused`) : sans cela, un écran poussé par-dessus hériterait d'icônes claires.
9. **Actions** : le bouton dossier quitte le haut de la page, comme le prévoit C. « Déplacer » devient une ligne du menu `…` (déplacement, renommage, suppression), et le toast « Déplacé vers … » est conservé. Ce toast est désormais un calque positionné sous la barre, et non plus un élément du flux.

### Couverture et repli (AC #3)

- L'unique source est `media_item.media_image` du contrat détail, chargée avec `expo-image`, `cacheKey` `<media_item_id>:<updated_at>` (la clé des listes : une page ouverte depuis une liste trouve l'image sur disque), `recyclingKey`, `cachePolicy="memory-disk"`. Aucun champ ni endpoint ajouté.
- Pendant le chargement, le bandeau garde sa taille pleine et reste un cadre tonal nu `surfaceContainerLow`, sans spinner (§2.3.4).
- En l'absence d'image (`null`, chaîne vide) ou en cas d'échec (`onError`, mémorisé par `media_item_id` comme `failedCoverId` dans `MediaListCard`), on applique le repli choisi par C : bandeau réduit à 96 pt (2 × `Spacing.xxl`) sous la barre d'état, glyphe du type à 32 pt en `textMuted` sur `surfaceContainerLow`, titre sous le bandeau sur le fond. La vignette de la barre rétractée porte le même glyphe. Le glyphe est décoratif ; comme le demande §2.3.6, le surtitre écrit alors le type en toutes lettres (« AUDIO », « PODCAST · créateur »).

### Suppressions (AC #4)

Supprimés dans le même changement, sans branche de compatibilité :

- dans `CompletedDetailView` : `SourceChip` (et son libellé d'accessibilité codé en dur « Open on »), `DetailContainer` (`SafeAreaView`), l'en-tête `MediaDetailHeader` de la page résolue, `handleFolderPress`, `displayDomain` et `stickyHeaderIndices` ;
- dans `SourcePreview` : le titre « Aperçu » et la carte grise ;
- dans `TranscriptReader` : la ligne langue / durée / paragraphes ;
- dans `MediaDetailHeader` : les emplacements dossier et `…`, désormais sans appelant (il ne sert plus qu'aux états de cycle de vie de la route) ;
- dans `useMediaActions` : l'option `canMove`, désormais sans appelant (seule la page média passait `false`) ;
- les clés i18n `preview.heading` et `media.moveToFolderA11y`, devenues orphelines, retirées des 11 catalogues.

`getMediaTypeLabel` a été déplacé de `MediaListCard` vers `lib/mediaTypeDisplay.ts` (un seul mapping). Aucune référence morte dans `mobile/` : vérifié par grep de `SourceChip`, `stickyHeaderIndices`, `preview.heading`, `moveToFolderA11y`, `canMove`, `DetailContainer` et `onFolderPress`. Seuls des commentaires historiques les nomment, pour expliquer ce qui a été remplacé.

### États présents et atteignables (AC #5)

| État | Où |
|---|---|
| Chargement de l'item | spinner de la route (`app/media/[id].tsx`), inchangé |
| Chargement de la couverture | bandeau tonal nu, pleine taille |
| Média sans image, ou image en échec | bandeau de 96 pt avec le glyphe, titre sous le bandeau |
| Aperçu prêt, en préparation (poll borné existant) ou indisponible | les trois états de `SourcePreview`, dans le callout |
| Texte pas encore disponible | `TranscriptReader` : pas de transcript (vide + indice), `pending`, `extracting`, `transcribing`, `idle`/chargement, `not_available` |
| Texte disponible | `ready`, `translation_pending`, `translation_failed` |
| Erreur de lecture | message d'erreur et bouton Réessayer (`fetchRawContent`) |

### Tokens (AC #6)

- Aucun littéral de couleur n'est ajouté (vérifié par grep de `#…` et `rgba(` sur le diff). Couleurs, espacements, rayons et tailles de texte viennent de `theme.ts`.
- Écarts nommés et justifiés en commentaire :
  - `letterSpacing: 0.5`, la convention des petites capitales de toute l'app ;
  - `lineHeight: 38` du titre display, valeur préexistante reprise de l'ancien hero ;
  - `MEDIA_HEADER_BUTTON_SIZE = 44`, désormais exporté par `MediaDetailHeader` au lieu d'un littéral dupliqué ;
  - tailles d'icônes (14 / 18 / 24 / 32), comme dans le reste du code.
- Voile de barre d'état : le benchmark nommait un écart réel pour C (dégradé `textMain` 50 % → 0, qui exige `expo-linear-gradient`, module natif donc build, ou `experimental_backgroundImage`, déconseillé en production). Il est réalisé par **12 bandes `View` de `Colors.textMain`** dont l'opacité descend de 50 % à 0, en `flex: 1` pour que Yoga les aligne sur la grille de pixels. Résultat : aucune dépendance, aucune couleur hors token, mise à jour OTA. Le verre reste celui de `GlassSurface` (Liquid Glass, flou iOS, ou teinte opaque à 92 % sur Android et avec « Réduire la transparence »).

### i18n (AC #7)

Trois clés sont ajoutées, présentes dans les 11 catalogues (en, fr, es, de, it, pt, nl, ja, zh, ar, hi) et chacune lue par le code :

- `preview.essentials` (« L'essentiel », « Key points »…) ;
- `media.openSourceA11y` (« Ouvrir sur {host} », qui remplace le « Open on » codé en dur relevé en §1.6.5 du benchmark) ;
- `media.readingProgressA11y`.

Deux clés orphelines sont retirées des 11 catalogues. `tsc` vérifie la complétude par le type `Catalog`. La langue du texte est nommée par `LOCALE_ENDONYMS` pour les 11 langues de l'app (« Français » comme dans la maquette), et par son code en capitales sinon, comme avant. Aucune chaîne nouvelle n'est donc nécessaire.

### Accessibilité (AC #8)

- **Ordre de lecture** : retour, `…`, surtitre, titre (`header`), lien vers l'original (`link`, libellé traduit), métadonnées, onglets (`tablist`/`tab`, état sélectionné), « L'essentiel » (`header`), contenu de l'aperçu, « Texte complet » (`header`), paragraphes.
- **Barre rétractée** : placée avant le `ScrollView` dans l'arbre pour être lue en premier quand elle est affichée. Masquée, elle sort de l'arbre d'accessibilité (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`) et ne prend aucun toucher. Son segment d'icônes garde les libellés « Lecture » / « IA » en `accessibilityLabel`. La progression est une `progressbar` libellée, avec une valeur annoncée par paliers de 10 %.
- **Éléments décoratifs** (couverture, vignette, glyphe de repli, voile, point séparateur) : hors de l'arbre.
- **Cibles tactiles** :
  - boutons de verre et retour de la barre : 44 pt + `hitSlop` de 4 pt, soit 52 pt ;
  - onglets repliés : 48 × 48 pt ;
  - lien source : `hitSlop` de 16 pt vertical, soit plus de 48 pt ;
  - Réessayer : 48 pt, inchangé.
- **Grands caractères** : au-delà de 2 lignes, le titre passe sous le bandeau.

### Vérifications (AC #9)

Dans `mobile/` :

- `npx tsc --noEmit` : 0 erreur ;
- `npm run lint` : 0 erreur, 1 avertissement préexistant hors périmètre (`src/services/purchaseService.ts:136`, `no-explicit-any`), identique à la mesure de référence prise avant modification.

Le listener de défilement a dû être écrit sans ref (la règle `react-hooks/refs` refuse le motif « latest ref » passé à `Animated.event`). L'événement natif est reconstruit quand un seuil bouge. `createAnimatedPropsHook` de RN 0.83 le détache et le rattache à chaque rendu de toute façon, et `AnimatedEvent.__getHandler` appelle bien le `listener` JS en pilote natif (vérifié dans les sources installées).

### Livraison : OTA, aucun build (AC #10)

- **Distribuable en OTA** (`eas update`). `runtimeVersion.policy` vaut `fingerprint` (`app.config.ts`). Le diff ne touche que du TypeScript sous `mobile/src/` et `mobile/app/`, et n'ajoute aucune dépendance : `expo-image`, `expo-status-bar`, `expo-glass-effect`, `expo-blur` et `react-native-safe-area-context` sont déjà dans `package.json`.
- Vérifié avec `@expo/fingerprint` (lecture seule) : aucune des 183 sources fichier du fingerprint ne se trouve sous `src/` ou `app/`. Les sources sont `.gitignore`, `eas.json`, `assets/`, `google-services.json`, `modules/`, `patches/` et les modules natifs autolinkés, plus la config Expo résolue, les scripts de `package.json` et les configs d'autolinking. **Aucun fichier de ce changement ne modifie le fingerprint.**
- Ce qui l'aurait modifié, et qui a été évité : ajouter `expo-linear-gradient` (entrées de `package.json` et `package-lock.json` et autolinking natif).

### Réserves à signaler

- **Digest (ordre avec task-409)** : le benchmark conseillait de faire passer task-409 avant task-411. Ce n'était pas possible : task-408 est encore `owner_decision: pending` et task-409 en `To Do`. `CompletedDetailView` reste donc monté par le carrousel du Digest avec `showChrome={false}`. Dans ce mode, la page reçoit la couverture et la barre rétractée, sans bouton retour, sans `…`, sans voile et sans pilotage de la barre d'état, l'hôte possédant l'encart haut. Le commentaire `TAB_BAR_CLEARANCE` de `digest.tsx`, qui citait l'ancien segment collant, est mis à jour. Si task-409 retient la direction A de task-408, le Digest cessera de monter la page et cette réserve disparaîtra.
- **Compromis acceptés avec C, rappelés par le benchmark** :
  - pochettes carrées et reels rognés en 4:3 ;
  - lisibilité du titre sur le chemin flou d'iOS dépendante de l'image (risque F83) ;
  - texte complet plus bas qu'avant au repos.
- **Aucun test automatisé ajouté** : aucun n'était demandé.

### Note pour l'owner (hors critères)

Validation visuelle sur appareil après merge et `eas update`, iOS et Android :

- article, pochette carrée et reel, avec couvertures claires et sombres (titre sur le verre, icônes de barre d'état sur le voile) ;
- note audio sans image ;
- fondu de la barre et du segment replié à 414 pt et sur iPhone SE ;
- Dynamic Type grand (titre sous le bandeau) ;
- VoiceOver et TalkBack (ordre et barre masquée) ;
- page du Digest.
<!-- SECTION:NOTES:END -->
