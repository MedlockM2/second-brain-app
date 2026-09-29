---
id: TASK-420
title: Retirer le seuil empirique CARD_MIN_OPACITY du fondu du menu contextuel
status: To Do
assignee: []
created_date: '2026-09-29 13:24'
labels:
  - mobile
  - cleanup
dependencies: []
references:
  - mobile/src/components/AnchoredContextMenu.tsx
  - mobile/src/components/GlassSurface.tsx
  - mobile/src/components/MediaDetailHero.tsx
  - docs/testflight-feedback-log.md
priority: low
type: chore
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Découvert au passage pendant le triage des feedbacks beta du 2026-09-29, sans être rapporté par un testeur : `AnchoredContextMenu` anime l'apparition de sa carte de menu en pilotant l'`opacity` de `cardWrapper`, un ancêtre de la vue de verre. Comme `expo-glass-effect` refuse de dessiner son matériau dès qu'une `opacity` inférieure à 1 est posée sur la vue ou l'un de ses ancêtres, le fondu part de `CARD_MIN_OPACITY = 0.05` au lieu de 0 (`mobile/src/components/AnchoredContextMenu.tsx:156`, `:239-244`).

Le commentaire en place est honnête sur ce qu'il fait : maintenir le matériau dans l'arbre de rendu pendant toute l'animation en restant invisible à la première image. **Mais 0,05 est une valeur trouvée à l'usage face à une contrainte formulée en « strictement inférieur à 1 » — pas une valeur que la contrainte autorise.** Rien ne garantit que la prochaine version d'`expo-glass-effect`, ou une autre densité d'écran, continue de peindre le matériau à 5 %. Ça fonctionne aujourd'hui ; ça repose sur un seuil, pas sur un mécanisme.

C'est exactement le piège qui a produit le défaut rapporté le 2026-09-29 sur le bandeau de titre de `MediaDetailHero` (registre `docs/testflight-feedback-log.md`, `ANlesyTagOEOrwZx2yj70ko`) : un `opacity: 0` posé sur un `GlassSurface` le laissait en boîte vide non teintée pour toute la vie de la page. Ce site-là ne repose plus sur un seuil — la vue masquée a disparu avec la mesure qui la justifiait. Celui-ci reste le dernier endroit du dépôt où une vue de verre dépend d'une valeur d'alpha empirique.

Pistes, à trancher par l'implémenteur — aucune ne demande d'arbitrage produit, l'animation doit rester identique à l'œil :
- animer autre chose que l'`opacity` d'un ancêtre du verre (l'échelle est déjà animée ; un fondu porté par une couche non-verre superposée, ou par le voile de la carte, ne touche pas le matériau) ;
- ou monter/démonter la carte sur les bornes de l'animation plutôt que la faire tendre vers l'invisible, en s'assurant que la vue de verre n'est jamais mise en page pendant qu'elle est masquée — `expo-glass-effect` n'installe l'effet qu'au premier passage de layout, donc un montage tardif est correct mais un montage masqué ne l'est pas.

Périmètre strictement local : un composant, aucune API publique, aucun choix de design ouvert — donc pas de benchmark.

**Note à l'owner, hors critères d'acceptation :** le rendu de l'animation ne se juge pas depuis un worktree. À regarder sur appareil iOS 26 (matériau `GlassView`) *et* sur un iOS antérieur (`BlurView`), en ouvrant le menu contextuel depuis une tuile de la Bibliothèque : la carte doit apparaître teintée dès la première image, sans saut d'opacité ni palier visible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `CARD_MIN_OPACITY` n'existe plus dans `mobile/src/components/AnchoredContextMenu.tsx`, et aucune constante d'alpha empirique ne la remplace
- [x] #2 Aucune `opacity` strictement comprise entre 0 et 1 n'est posée sur la vue de verre de la carte ni sur aucun de ses ancêtres, à aucune image de l'animation d'ouverture comme de fermeture
- [x] #3 La vue de verre n'est jamais mise en page alors qu'elle est masquée : soit elle est absente de l'arbre, soit elle est visible
- [x] #4 Les durées `OPEN_DURATION` et `CLOSE_DURATION` et la courbe d'échelle de la carte sont inchangées — l'animation reste la même à l'œil
- [x] #5 Le commentaire de tête du composant explique le mécanisme retenu et pourquoi il ne dépend plus d'un seuil, en gardant la contrainte `expo-glass-effect` nommée pour le prochain lecteur
- [x] #6 `GlassSurface.tsx` ne cite plus `CARD_MIN_OPACITY` comme l'exemple à suivre : sa section « No tolerance for alpha » renvoie au mécanisme retenu
- [x] #7 `npx tsc --noEmit` et `npx eslint` sortent propres sur `mobile/`
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Le mécanisme retenu

Des deux pistes de la description, c'est **la combinaison des deux** qui tombe, et
elle tombe d'elle-même dès qu'on prend les AC #2 et #3 au mot : si la vue de verre
est soit absente de l'arbre soit pleinement opaque, alors **le matériau ne peut pas
faire de fondu du tout**. Il ne restait donc pas un choix entre « animer autre
chose » et « monter/démonter », mais un seul montage :

- **Le montage porte la présence.** Le `Modal` entier renvoie `null` tant que
  `visible` est faux (`if (!visible || target === null || !anchor) return null;`),
  et l'appelant garde `visible` vrai jusqu'à la fin de l'animation de sortie
  (`requestClose` n'appelle `onClose` que dans le callback de fin). La carte de
  verre est donc dans l'arbre exactement pendant la durée de l'animation, et
  pleinement opaque à chaque image : jamais mise en page masquée, jamais fondue.
- **L'échelle porte le mouvement.** `cardWrapper` n'anime plus que
  `transform: [{ scale: cardScale }]` — un transform ne touche pas l'effet.
- **Le fondu passe de l'autre côté du matériau.** Les lignes du menu sont
  enveloppées dans un `Animated.View style={{ opacity: progress }}` **à l'intérieur**
  du `GlassSurface` : la contrainte porte sur la vue de verre et ses ancêtres, pas
  sur ses enfants, et le dépôt en avait déjà la preuve à l'usage — `styles.rowDisabled`
  pose `opacity: 0.5` sur une ligne à l'intérieur de cette même carte de verre, sur
  un matériau qui se dessine.

`progress` va toujours de 0 à 1, sans plancher : plus une seule valeur d'alpha
choisie à la main dans le fichier.

## Ce qui change à l'œil, et ce qui ne change pas

Inchangés : `OPEN_DURATION` (160 ms), `CLOSE_DURATION` (120 ms), les easings
`Easing.out/in(Easing.quad)`, l'interpolation d'échelle 0,92 → 1, le fondu du fond
flouté et le soulèvement de la vue pressée.

Ce qui change est le seul écart que la contrainte laisse : **le matériau de la carte
et son ombre arrivent à pleine opacité sur la première image de l'ouverture**, au
lieu de monter de 5 % à 100 %, tandis que les lignes, elles, gardent exactement le
fondu d'avant. C'est aussi ce que la note à l'owner décrit comme attendu (« la carte
doit apparaître teintée dès la première image »). L'ombre n'est pas animée : à
`shadowOpacity: 0,04`, `Shadows.soft` est en deçà du seuil de perception sur une
carte qui grandit en 160 ms, et animer `shadowOpacity` obligerait à sortir
`progress` du driver natif pour l'ensemble des interpolations.

Effet de bord utile : la branche pré-iOS 26 de `GlassSurface` (`BlurView`) ne subit
plus non plus de fondu d'ancêtre, là où le plancher à 0,05 s'appliquait aux deux
matériaux sans distinction.

## Références croisées nettoyées

`CARD_MIN_OPACITY` était cité comme *l'exemple à suivre* dans deux commentaires de
tête, dont l'un donnait un conseil désormais faux (« Fade a wrapper, not this » — un
wrapper est précisément un ancêtre) :

- `GlassSurface.tsx`, section « No tolerance for alpha » : énonce maintenant la règle
  (hors de l'arbre, ou opaque ; l'animation va sur un transform ou sur les enfants
  dessinés par-dessus le matériau) et renvoie à `AnchoredContextMenu` comme forme à
  copier, sans nommer de constante.
- `MediaDetailHero.tsx` : la contrainte est attribuée à `GlassSurface`, qui l'énonce
  pour tous ses appelants, au lieu d'une constante supprimée.

`docs/testflight-feedback-log.md:68` cite aussi `CARD_MIN_OPACITY`, et **n'est pas
modifié** : c'est le registre daté d'un triage, où la phrase décrit correctement
l'état du dépôt au 2026-09-29. Réécrire un registre pour suivre le code d'après
rendrait le triage illisible.

## Ce qui n'est pas vérifiable depuis le worktree

Le rendu de l'animation, c'est-à-dire la note à l'owner : aucun AC ne le demandait,
et il ne se juge ni depuis un worktree ni sur simulateur pour la branche
`GlassView`. À regarder sur appareil iOS 26 *et* sur un iOS antérieur
(`BlurView`) en ouvrant le menu depuis une tuile de la Bibliothèque. Aucun test
automatisé n'a été écrit, conformément à `AGENTS.md`.

`tsc --noEmit` et `eslint . --ext .ts,.tsx` sont propres sur `mobile/` (le seul
avertissement restant, `no-explicit-any` dans `src/services/purchaseService.ts:136`,
préexiste et est hors périmètre).
<!-- SECTION:NOTES:END -->
