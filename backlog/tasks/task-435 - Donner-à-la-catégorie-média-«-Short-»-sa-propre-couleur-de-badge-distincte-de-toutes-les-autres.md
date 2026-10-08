---
id: TASK-435
title: >-
  Donner à la catégorie média « Short » sa propre couleur de badge, distincte de
  toutes les autres
status: Done
assignee: []
created_date: '2026-10-07 10:23'
updated_date: '2026-10-08 14:22'
labels:
  - mobile
  - enhancement
dependencies: []
priority: low
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dans la vignette média, le badge de type `short_video` est aujourd'hui indiscernable de `youtube_video` : les deux prennent le même remplissage (`errorContainer`) et le même glyphe (`play-circle-outline`), dans `getMediaTypeBadgeTones` et `getMediaTypeIcon`. Seul le mot du badge (« SHORT » vs « VIDÉO ») les sépare, ce qui est trop faible pour un repérage à l'œil dans une liste.

Le propriétaire demande une couleur propre au Short, différente non seulement de Vidéo mais aussi de toutes les autres catégories affichées : podcast (`primary` ambré), article et image_post (`surfaceContainerHigh` tonal), audio, texte, document, lien (tonal par défaut). La teinte retenue doit donc être une quatrième famille lisible, pas une nuance du rouge vidéo — et elle ne doit pas faire tache : elle reste dans la direction de design Amber Clarity que suit la palette de `mobile/src/constants/theme.ts`.

Contraintes connues à respecter :
- La palette est définie dans `mobile/src/constants/theme.ts`, en deux modes (clair et sombre) ; une couleur de badge ne peut être choisie indépendamment de son encre, comme l'explique le commentaire de `getMediaTypeBadgeTones` (l'ambre exige `onPrimary`, le rouge et le tonal gardent `textMain`).
- Précédent à suivre pour la méthode : task-297, qui a donné au dossier « Non classés » sa propre teinte en restant dans Amber Clarity au lieu d'introduire une couleur étrangère.

Note au propriétaire (hors critères d'acceptation) : la validation finale est visuelle. Après merge, vérifier sur simulateur iOS et sur Android, en mode clair et sombre, qu'un Short et une vidéo YouTube côte à côte dans la Bibliothèque se distinguent au premier regard, que le Short ne se confond pas avec le badge podcast, et que l'écran garde son équilibre chromatique.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le badge de type d'un média `short_video` utilise un remplissage qui n'est utilisé par aucun autre type de média, en mode clair comme en mode sombre
- [x] #2 La teinte choisie est exprimée par des tokens de `mobile/src/constants/theme.ts` (ajoutés si besoin dans les deux palettes), et non par une valeur hexadécimale écrite en dur dans un composant
- [x] #3 La teinte choisie appartient à la direction de design Amber Clarity déjà en place : sa justification cite les tokens voisins de la palette dont elle dérive
- [x] #4 Le contraste entre l'encre du badge Short et son remplissage est mesuré et documenté dans le code, pour les deux modes, et vaut au moins 4.5:1
- [x] #5 Le choix de teinte, et la raison pour laquelle elle ne concurrence ni le rouge vidéo ni l'ambre podcast, est expliqué en commentaire à l'endroit où les tons du badge sont décidés
- [x] #6 Les autres types de média gardent exactement les tons qu'ils avaient avant la tâche
- [x] #7 `npm run lint` et `npx tsc --noEmit` passent dans `mobile/`
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
La teinte retenue est **le rouge vidéo transposé sur la teinte d'encre de la palette** : un
nouveau token `shortVideoContainer`, `#d6e4fd` en clair et `#1a4975` en sombre.

Pourquoi cette famille et pas une autre : les trois premières familles sont déjà prises
(ambre pour le podcast, rouge pour la vidéo, containers tonaux pour tout ce qui se lit), et
le seul ton qu'Amber Clarity possède déjà sans l'avoir dépensé en remplissage est le
bleu-gris de sa famille d'encre — les « secondary tones [that] ground the interface » du
DESIGN.md, soit `textMuted`, `textSubtle`, `textMain`. La teinte Lab du token est à 0,1°
de celle de `textMuted` (271,2° clair / 271,3° sombre contre 271,3°), donc rien d'étranger
n'entre dans la palette.

Pourquoi elle ne fait pas tache : clarté et chroma sont copiés sur `errorContainer`, à un
pas d'arrondi près (L\* 90,3 contre 90,0 et C\* 13,7 contre 13,9 en clair ; L\* 30,1 contre
30,0 en sombre). Les deux pastilles pèsent donc exactement le même poids optique — seule la
teinte bouge, à 242° de distance —, ce qui laisse l'équilibre chromatique de l'écran
inchangé. Le chroma sombre est la seule valeur délibérément non copiée (29,8 contre 66,3) :
c'est la décision 3 de la palette sombre appliquée à une seconde teinte, un bleu marine
saturé sur un fond chaud sombre se lisant comme du chrome système emprunté.

Contrastes mesurés, encre `textMain` sur le remplissage, documentés dans `theme.ts`, dans
`getMediaTypeBadgeTones` et dans `mobile/docs/DARK_THEME_CONTRAST.md` : **10,52:1** en clair
(`#2b2d42` sur `#d6e4fd`) et **7,86:1** en sombre (`#f1ebe1` sur `#1a4975`), pour un seuil
AA de 4,5:1 sur les 13 px du libellé. Séparation ΔE (CIE76) vis-à-vis des voisins : 23,6
clair / 87,0 sombre contre le rouge vidéo, 98,6 / 115,3 contre l'ambre podcast, 15,2 / 35,9
contre `surfaceContainerHigh`.

Portée : le seul badge rempli de l'app est celui de `MediaListCard` (les autres surfaces ne
montrent que le glyphe), et seul le cas `short_video` en sort — `youtube_video` garde
`errorContainer`, le podcast garde l'ambre, tout le reste garde `surfaceContainerHigh`. Le
glyphe `play-circle-outline` et le mot « SHORT » sont inchangés, aucun critère ne les
demandait. Le commentaire de `MediaFailureBadge` a été corrigé : il affirmait que le rouge
doux est le fond « des badges VIDÉO et SHORT », ce qui est devenu faux.

Vérifié : `npm run typecheck` propre ; `npm run lint` 0 erreur (1 avertissement préexistant
dans `purchaseService.ts`, fichier non touché). Aucun test automatisé écrit, conformément à
la politique du dépôt ; aucun critère n'en demandait. La validation visuelle sur simulateur
iOS et sur Android, dans les deux modes, reste celle du propriétaire comme la tâche le
prévoyait.
<!-- SECTION:NOTES:END -->
