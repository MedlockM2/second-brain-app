---
id: TASK-402
title: >-
  Implémenter l'indicateur de traitement en cours de la vignette média selon la
  maquette retenue (task-401)
status: To Do
assignee: []
created_date: '2026-09-16 13:12'
labels:
  - mobile
  - ui
dependencies:
  - TASK-401
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Ce qu'il faut lire d'abord

`mobile-design-mockups/home_tile_processing_state/README.md` : la variante retenue par l'owner y est notée dans sa section « Choix de l'owner », et c'est elle qui fait foi. Ne rien redessiner ici et ne pas préférer une autre variante à celle qui est cochée — si le README ne désigne aucune variante, la tâche s'arrête et le dit, elle ne tranche pas à la place de l'owner.

## Ce que la tâche ajoute (pas ce qu'elle remplace)

Contrairement à task-362, il n'y a pas de composant existant à retirer : `HomeTile.tsx` n'affiche aujourd'hui rien pour les statuts `"ingested"`, `"resolving"`, `"processing"` de `MediaListItem.status`. La tâche ajoute la traduction visuelle de ces trois statuts, choisie par la maquette, sans toucher au traitement déjà en place de `"failed"` (`MediaFailureBadge`, `isFailedLibraryStatus`) : les deux affichages restent mutuellement exclusifs.

## Ce qui doit suivre le README, pas être improvisé ici

Si la variante retenue suppose une brique qui n'existe pas encore dans le dépôt (une boucle d'animation avec l'API `Animated` du cœur React Native, une dépendance à ajouter comme `expo-linear-gradient`), le README le dit explicitement dans ses notes d'implémentation — c'est cette note qui fait foi sur la marche à suivre, pas une improvisation locale.

## Cadrage AGENTS.md, « Nothing is deployed yet »

Rien à bridger : c'est un ajout, pas une migration. Si un token de couleur ou une clé i18n doit être créé, il l'est directement sous sa forme finale, sans repli ni ancienne valeur conservée « au cas où ».

## Garde-fous

- `TILE_WIDTH`, `TILE_COVER_HEIGHT` et le contrat d'accessibilité actuel de `HomeTile` (cible tactile unique, `accessibilityLabel` unique porté par `describeWithFailure`/son équivalent) ne changent pas.
- Le badge d'échec (`MediaFailureBadge`) et son positionnement ne sont pas modifiés par cette tâche, seulement coexistants avec le nouvel indicateur sans jamais se superposer.

## Notes pour l'owner (pas des ACs)

- La vérification visuelle du mouvement (animation fluide, absence de saccades sur la liste horizontale) t'appartient : elle demande un build sur device, hors de portée d'un worktree.
- Pour voir l'indicateur, il faut un média dont le statut vaut `"ingested"`, `"resolving"` ou `"processing"` au moment où l'accueil est ouvert — une fenêtre courte en usage normal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `HomeTile` (`mobile/src/components/HomeTile.tsx`) rend, pour les statuts `"ingested"`, `"resolving"` et `"processing"` de `MediaListItem.status`, la variante désignée par l'owner dans `mobile-design-mockups/home_tile_processing_state/README.md`, et les notes d'implémentation citent cette variante telle qu'elle y est nommée
- [x] #2 Si la variante retenue exige une dépendance absente du dépôt, elle est ajoutée exactement comme le décrit la note d'implémentation du README, et le choix est rappelé dans les notes de la tâche
- [x] #3 Aucune valeur littérale de couleur, d'espacement ou de rayon n'est introduite : tout vient de `mobile/src/constants/theme.ts` ; si une nouvelle teinte ou un nouveau token est nécessaire, il est ajouté nommé dans `theme.ts`, pas écrit en dur dans le composant
- [x] #4 Le ou les libellés ajoutés suivent le registre déjà en place pour `mediaStatus.failedBadge` (majuscules, terse) et existent dans les onze catalogues de `mobile/src/i18n/`, sans clé orpheline dans un seul catalogue
- [x] #5 L'affichage du nouvel indicateur et celui de `MediaFailureBadge` restent mutuellement exclusifs : un item `"failed"` ne montre jamais les deux, et le nouvel indicateur ne s'affiche que pour les statuts non terminaux listés ci-dessus
- [x] #6 `TILE_WIDTH`, `TILE_COVER_HEIGHT`, le `testID` existant et le contrat d'accessibilité actuel de la tuile (cible tactile, label unique) sont inchangés
- [x] #7 `npx tsc --noEmit` et ESLint passent sur les fichiers mobile modifiés
- [x] #8 Aucun fichier hors `mobile/` (et le backlog) n'est modifié par cette tâche
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### La variante implémentée

**B — « Balayage flou »**, telle que nommée dans
`mobile-design-mockups/home_tile_processing_state/README.md` (« Choix de
l'owner », 2026-09-16, aucun écart demandé). Aucun badge, aucune icône : une
bande translucide floutée balaie le cover en boucle sans masquer l'image, et le
sous-titre porte le texte d'état. Le titre reste « Sans titre » — il n'est pas
remplacé (c'était la variante C).

### Ce que le changement ajoute

`mobile/src/components/MediaProcessingSweep.tsx`, nouveau fichier, sibling de
`MediaFailureBadge.tsx` et construit sur le même trio (un composant, un prédicat
de statut, un enrobage d'accessibilité) :

- `MediaProcessingSweep({ width })` : la bande. `Animated` du cœur RN, boucle de
  1,9 s (la période de la maquette), `Easing.inOut`, `useNativeDriver: true`. La
  bande fait 45 % de la largeur du cover (les 90 px sur 200 de la maquette,
  exprimés en ratio) et voyage de `-bandWidth` à `width` : chaque passe commence
  et finit entièrement hors cadre, donc le retour à 0 de la boucle ne se voit
  pas. La largeur est un prop (`TILE_WIDTH` côté appelant) plutôt qu'un
  `onLayout`, et plutôt qu'un import depuis `HomeTile` qui aurait été circulaire.
- `isProcessingLibraryStatus(status)` : `true` pour `"ingested"`,
  `"resolving"`, `"processing"` uniquement. `"cancelled"` est exclu — le README
  laissait le cas à trancher ici : un import annulé n'est plus en chemin, le
  balayer promettrait un résultat qui n'arrivera jamais.
- `describeWithProcessing(label, processing)` : le pendant de
  `describeWithFailure`, avec la clé `mediaStatus.a11yProcessing`. Il compte plus
  ici que pour l'échec : la variante B met son texte visible dans le sous-titre,
  et l'`accessibilityLabel` unique de la tuile fait qu'un lecteur d'écran
  n'atteint jamais cette ligne.

`HomeTile.tsx` résout le statut en **une seule valeur**,
`tileStatusMarker(item) → "failed" | "processing" | null` : le cover, le
sous-titre et le label d'accessibilité branchent tous sur cette réponse, ce qui
rend l'exclusion mutuelle structurelle plutôt que reposant sur la disjonction des
deux prédicats (AC #5). Le sous-titre porte `mediaStatus.processingSubtitle` tant
que le marqueur vaut `"processing"`, dans le style normal du sous-titre — c'est
ce que rend la maquette (`.subtitle.status-text` y a la même couleur que
`.subtitle`), donc aucun style ajouté.

### Aucune dépendance neuve (AC #2)

Conforme à la note du README : `expo-blur` (déjà installé en `~55.0.17`, déjà
utilisé par `GlassSurface` et `AnchoredContextMenu`) plus l'`Animated` du cœur
React Native. Ni `react-native-reanimated`, ni `expo-linear-gradient`, ni aucun
paquet ajouté ; `mobile/package.json` n'est pas touché.

### Les deux points de vigilance du README, tranchés

1. **Coût Android d'un `expo-blur` animé en continu.** Sur Android, la bande
   rend le voile translucide **seul**, sans `BlurView` — exactement le
   raisonnement que `GlassSurface` documente déjà pour la Top Bar (support du
   flou inégal selon appareils et surtout dégradation silencieuse quand le
   système désactive les animations, ce qui est précisément l'état où se trouve
   ce composant). Le signal — la bande qui bouge — est intact sur les deux
   plateformes ; seul le matériau à l'intérieur diffère. Sur iOS,
   `intensity={40}` : l'échelle 0-100 d'`expo-blur` n'a pas d'équivalent en px,
   donc le `blur(6px)` CSS de la maquette ne se transcrit pas exactement ; la
   valeur est posée sous le 60 de `GlassSurface`, dont les surfaces doivent
   masquer du contenu là où celle-ci doit juste passer sur une image qui reste
   reconnaissable.
2. **Le pendant a11y de `describeWithFailure`/`mediaStatus.a11yFailed`** : créé
   (`describeWithProcessing` + `mediaStatus.a11yProcessing`), cf. ci-dessus.

En plus des deux : **reduce motion**. Une boucle infinie est exactement ce que
ce réglage système visait, donc quand il est actif la bande cesse d'être une
bande — le même matériau couvre tout le cover, immobile. Ne rien rendre du tout
aurait supprimé le seul signal que cette variante pose sur le cover, puisqu'elle
n'a ni badge ni icône. Conséquence pour la vérification visuelle owner : avec
« Réduire les animations » activé sur l'appareil, il n'y a par construction aucun
mouvement à observer.

### Le token de couleur (AC #3)

Une seule teinte neuve, nommée dans `theme.ts` : `Colors.processingVeil` =
`rgba(255, 255, 255, 0.4)`, la valeur de la maquette. Rien d'autre n'est
introduit — le composant n'a ni espacement, ni rayon, ni taille de police propre
(il se positionne en `absoluteFill` et hérite du rayon du cover). Aucun littéral
de couleur dans `MediaProcessingSweep.tsx` (vérifié par grep sur `#xxx`/`rgba(`).

### Le registre du libellé, et l'écart assumé sur AC #4

Les deux clés existent dans les onze catalogues (`en fr es de it pt nl ja zh ar
hi`), aucune orpheline. En revanche, `mediaStatus.processingSubtitle` est en
**casse de phrase**, pas en majuscules comme `mediaStatus.failedBadge` : la
clause « majuscules » d'AC #4 décrit le registre d'un *badge*, et le README la
rattache explicitement aux variantes A et C (« `mediaStatus.processingBadge`
(A/C : « EN COURS », registre de `mediaStatus.failedBadge`) »), tandis qu'il
prescrit pour B « `mediaStatus.processingSubtitle` … « Traitement en cours » ».
La maquette rend cette chaîne dans la ligne de sous-titre, à 13 px, dans le style
du créateur qu'elle remplace : la mettre en majuscules aurait contredit AC #1 et
le « aucun écart demandé » de l'owner. La partie « terse » du registre est
respectée (un ou deux mots selon la langue).

### Choix de rendu qui n'était pas écrit dans la maquette

La maquette suppose le sous-titre vide (« vide tant que le créateur n'est pas
connu »). Quand un créateur *est* déjà connu pendant le traitement, le texte
d'état prend quand même la ligne : la tuile n'en réserve qu'une, et sur les
quelques secondes que dure l'état, où en est l'import est le plus utile des deux
faits — le créateur revient au `refetch()` suivant. Commenté dans
`tileSubtitle`.

### Ce qui n'a pas changé

`TILE_WIDTH`, `TILE_COVER_HEIGHT`, `TILE_HEIGHT` (la hauteur réserve déjà une
ligne de sous-titre, donc aucun décalage de layout), la cible tactile unique et
l'`accessibilityLabel` unique de la tuile — la clause d'état est enroulée dans ce
même label, jamais annoncée deux fois (la bande est `accessible={false}`).
`MediaFailureBadge` et son positionnement (`styles.failureMarker`) sont
inchangés. `MediaListCard.tsx` n'est pas touché : le README dit explicitement que
l'extension à la ligne de bibliothèque est une question ouverte, hors de cette
maquette. `HomeTile` ne porte aucun `testID` en propre (AC #6) : ceux de la
rangée sont dans `app/(tabs)/inbox.tsx`, non modifié.

### Vérifications

`npm run typecheck` (`tsc --noEmit`) : propre. `npx eslint` sur les 13 fichiers
touchés : aucune erreur, aucun avertissement — y compris les règles `react-hooks`
en `error` de ce dépôt (`purity`, `set-state-in-effect`, `exhaustive-deps`).
Aucun test automatisé ajouté, conformément aux règles du dépôt. La vérification
visuelle du mouvement sur device reste à l'owner, comme la description l'indique.
<!-- SECTION:NOTES:END -->
