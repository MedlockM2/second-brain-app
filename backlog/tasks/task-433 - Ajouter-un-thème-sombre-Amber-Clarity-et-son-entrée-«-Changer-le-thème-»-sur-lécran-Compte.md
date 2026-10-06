---
id: TASK-433
title: >-
  Ajouter un thème sombre Amber Clarity et son entrée « Changer le thème » sur
  l'écran Compte
status: Done
assignee: []
created_date: '2026-10-06 15:47'
updated_date: '2026-10-06 18:40'
labels:
  - feature
  - mobile
dependencies: []
references:
  - mobile/app/(tabs)/account.tsx
  - mobile/src/constants/theme.ts
  - mobile/app/settings/reading-language.tsx
  - mobile/app/settings/interface-language.tsx
  - .testflight-feedback/report-2026-10-05.md
priority: medium
type: feature
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

Demande d'un testeur beta (feedback TestFlight `APwcwHB-cutTdM2Qlt-e_OU`, iPhone 11 / iOS 26.6.2, build 10, triage du 2026-10-05) :

> « Ajouter un menu « Changer le thème » qui propose de choisir entre Clair ou Sombre. D'ailleurs le theme clair existe deja mais il faut creer le theme sombre. »

Sa capture d'écran montre l'écran **Compte**, et désigne le bloc de réglages (`styles.menuCard` dans `mobile/app/(tabs)/account.tsx`) qui porte aujourd'hui *Langue de lecture*, *Langue de l'app*, *Suggestions* et *Signaler un bug*. Le **où** est donc déjà tranché par le testeur. Les deux entrées de langue ouvrent chacune un écran dédié (`/settings/reading-language`, `/settings/interface-language`) : c'est la convention du dépôt pour un réglage à choix multiple.

Le menu lui-même est trivial. Ce qu'il commande ne l'est pas, et deux choses n'existent pas aujourd'hui :

1. **Aucune palette sombre.** `mobile/src/constants/theme.ts` (164 lignes) n'a aucune variante sombre. Sa seule occurrence de « dark » est un commentaire justifiant une teinte bleu-gris assombrie pour rester lisible — le fichier porte un raisonnement de contraste explicite propre au design system *Amber Clarity*. Décliner cet accent ambre sur fond sombre est un choix de design, pas une transposition mécanique.
2. **Aucun mécanisme de thème réactif.** `useColorScheme` n'est utilisé nulle part dans `mobile/`, et **57 fichiers importent les tokens en statique** (32 sous `src/`, 25 sous `app/`). Servir un thème au choix de l'utilisateur suppose de choisir comment le distribuer et de convertir ces 57 consommateurs.

L'owner a décidé (2026-10-06) de ne pas passer par un benchmark : la tâche porte donc aussi ces deux choix, à trancher par l'implémenteur et à justifier dans le code, plutôt que dans un README de recherche préalable.

## Contraintes établies

- **Trois états à offrir**, pas deux : suivre le système, forcer clair, forcer sombre. Le testeur demande « Clair ou Sombre », mais un réglage de thème sans « suivre le système » est le défaut que tout le monde attend et que personne ne demande explicitement.
- **La persistance suit celle des réglages voisins.** La langue d'interface « ne quitte jamais l'appareil » (commentaire de `account.tsx:241-244`) ; le thème est du même ordre et n'a rien à faire au backend.
- **Android autant qu'iOS.** Ce retour vient d'iOS parce que *tout* retour TestFlight vient d'iOS. Un thème est du React Native partagé : c'est précisément le genre de sujet où une garde `Platform.OS` serait introduite à tort.
- **Ne pas sur-traduire.** Le commit `488dc6b` a retiré la traduction des noms de formats, de fonctionnalités et du store. Les libellés du menu et de ses options se traduisent ; aucun nom de fonctionnalité ne s'invente par catalogue.
- **Pas de couche de compatibilité.** Rien n'est déployé en magasin : les 57 importateurs statiques sont convertis dans la même passe, l'ancien chemin d'import n'est pas conservé « au cas où ».

## Notes pour l'owner (hors critères d'acceptation)

- La validation visuelle du thème sombre sur l'ensemble des écrans est une vérification manuelle sur appareil, iOS **et** Android. Un agent en worktree ne peut pas la remplir : à ta main après fusion.
- Changement JavaScript uniquement, aucun module natif : le coût de livraison est un `eas update` (OTA), pas un build TestFlight, donc rien sur le quota EAS.
- Les ratios de contraste de la palette sombre méritent ton œil avant la validation visuelle : c'est là que se joue la lisibilité de l'accent ambre sur fond sombre.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une entrée « Changer le thème » existe dans le bloc de réglages de l'écran Compte, parmi les entrées de langue, de suggestions et de signalement de bug désignées par la capture du testeur
- [x] #2 Le réglage offre trois états — suivre le système, clair, sombre — et l'état choisi est relu au démarrage suivant de l'app depuis un stockage local, sans aller-retour backend
- [x] #3 `mobile/src/constants/theme.ts` expose une variante sombre pour chacun des tokens que la variante claire définit : aucun token n'existe d'un seul cóté
- [x] #4 Aucun fichier de `mobile/src/` ni de `mobile/app/` n'importe plus les tokens clairs en statique pour une valeur qui doit changer avec le thème ; les 57 importateurs actuels passent par la distribution réactive, et un `grep` sur l'ancien chemin d'import le confirme
- [x] #5 Le choix du mécanisme de distribution du thème est justifié en commentaire à l'endroit qui le porte, en nommant ce que `useColorScheme` apporte et ce à quoi il ne suffit pas
- [x] #6 Les ratios de contraste de chaque paire texte/fond de la palette sombre sont calculés et écrits dans un fichier du dépôt, avec le seuil WCAG visé et le résultat atteint par paire
- [x] #7 Le libellé de l'entrée et ceux de ses trois options sont présents dans les 11 catalogues i18n, sans traduction d'un nom de fonctionnalité ni d'un nom propre
- [x] #8 Aucune garde `Platform.OS` n'est introduite sur le chemin du thème : le même code sert iOS et Android
- [x] #9 `npx tsc --noEmit` et `npx eslint` passent sans erreur sur `mobile/`
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Mécanisme de distribution retenu : un contexte + une fabrique de `StyleSheet` par fichier

Justifié en tête de `mobile/src/contexts/ThemeContext.tsx` (AC#5). En résumé :
`useColorScheme()` apporte la seule chose qu'aucun code à nous ne peut calculer —
le réglage d'apparence de l'appareil, et une re-render quand l'utilisateur le
bascule. Il ne suffit pas pour trois raisons : il ignore le choix de
l'utilisateur (« forcer clair / sombre » est à nous, stocké sur l'appareil) ; il
rend un mot, pas une palette ; et c'est un hook, donc il n'atteint pas un
`StyleSheet.create` en portée de module — ce qui était justement la forme de
*tous* les écrans de l'app. Un `useColorScheme` rendant `"dark"` n'en aurait
repeint aucun.

Retenu : `ThemeProvider` (contexte) + `useThemedStyles(makeStyles)` par
composant, où `makeStyles` déstructure `{ colors: Colors, shadows: Shadows }`.
C'est ce qui laisse les ~786 usages `Colors.xxx` inchangés au caractère près.
Écartés, avec la raison dans le même commentaire : une palette mutable en portée
de module (réactive à rien) ; `DynamicColorIOS` / `PlatformColor` (iOS seulement
→ fork `Platform.OS`, Android à résoudre deux fois) ; une bibliothèque de
styling (dépendance + plugin Babel/Metro + second idiome de style).

### Volume converti

- **57 importateurs d'origine** de `src/constants/theme` : 56 passent par
  `ThemeContext`, et `src/lib/folderTree.ts` n'importe plus rien du thème (sa
  constante `DEFAULT_FOLDER_TINT` est devenue le token `defaultFolderTint`, un
  module ne pouvant pas lire une valeur qui dépend du mode).
- **+2 nouveaux importateurs** : `src/components/GlassSurface.tsx` (son `tint` de
  `BlurView` et son fond opaque de repli dépendent du mode) et
  `app/settings/theme.tsx`.
- 53 fabriques `makeStyles`, 106 appels `useThemedStyles`, 87 `const Colors =
  useThemeColors()`.
- Les exports statiques `Colors` et `Shadows` ont **disparu** de `theme.ts` :
  c'est ce qui rend AC#4 vérifiable par `tsc` plutôt que par relecture. Grep de
  contrôle : `grep -rnE '\{[^}]*\b(Colors|Shadows)\b[^}]*\}\s*from\s*"[^"]*constants/theme"' mobile/src mobile/app`
  → aucun résultat.
- 7 littéraux de couleur en dur ont été absorbés en tokens au passage (scrim des
  4 dialogues, repli opaque de `GlassSurface`, les 2 pastilles du menu Compte) :
  aucun basculement de mode ne pouvait les atteindre.

### Ratios de contraste

`mobile/docs/DARK_THEME_CONTRAST.md` : la formule, les seuils visés (4.5:1 AA
pour tout texte — aucune taille de `Typography` n'atteint 18.66px —, 3:1 pour un
graphique non textuel, 4.5:1 aux deux extrêmes pour du texte posé sur une photo),
puis chaque paire premier-plan × fond avec le résultat, la colonne équivalente de
la palette claire, et les tokens translucides résolus en opaque avant mesure.

Deux dettes de la palette claire ne sont **pas** reproduites et c'est écrit :
`textMuted` y mesure 2.34:1 au pire (d'où l'invention de `textSubtle`) et
`primary` 1.24:1 (l'ambre clair n'est jamais lisible en glyphe, seulement en
fond). En sombre : 4.95:1 et 7.29:1.

### Six sites d'appel réparés, listés dans le même document

Six endroits dessinaient un token qui n'est un quasi-noir (ou un quasi-blanc)
*que* dans la palette claire : `textMain` sur un fond ambre (1.45:1 en sombre) à
quatre endroits, `surface` sur un fond `onPrimary` (1.04:1), et le scrim de barre
de statut de `MediaDetailHero`, qui aurait *éclairci* le haut de chaque pochette.
Réparés par un token qui bascule (`onPrimary`, `onError`, `primary`) ou qui
délibérément ne bascule pas (`coverScrimInk`, nouveau, invariant parce que ce
qu'il assombrit — une photo — ne bascule pas non plus).

### Libellé de l'entrée

`theme.title` vaut « Theme » / « Thème » et non « Changer le thème ». Les quatre
autres lignes de ce bloc sont des noms (*Langue de lecture*, *Langue de l'app*,
*Suggestions*, *Signaler un bug*) et le sous-titre de la ligne annonce déjà
l'état courant, comme les deux lignes de langue annoncent la langue courante.
6 clés en tout (`theme.title`, `.disclaimer`, `.followDevice`, `.light`, `.dark`,
`.selectA11y`) × 11 catalogues.

### `userInterfaceStyle` : la seule ligne non-JavaScript (note owner)

`mobile/app.config.ts` passe de `userInterfaceStyle: "light"` à `"automatic"`.
Avec `"light"`, iOS épinglait la trait collection de l'app en clair et
`Appearance.getColorScheme()` répondait `"light"` à vie — « suivre mon appareil »
aurait été un synonyme de « Clair ».

**Conséquence de livraison : l'hypothèse « OTA seulement » de la description ne
tient qu'à moitié.** Les deux états forcés (clair, sombre) fonctionnent par
`eas update`, puisqu'ils ne demandent rien à l'OS. « Suivre mon appareil » exige
le binaire reconstruit, et cette ligne déplace l'empreinte dont `runtimeVersion`
est calculée — donc le prochain build devient nécessaire, pas optionnel.

### Hors de portée en worktree

La validation visuelle du thème sombre sur l'ensemble des écrans, iOS **et**
Android, reste à la main de l'owner après fusion (note de la description, pas un
critère). Ce qui est vérifié ici : `tsc --noEmit` propre, `eslint` propre (seul
avertissement restant : `no-explicit-any` préexistant dans
`src/services/purchaseService.ts`, hors diff), et la complétude des deux palettes
garantie par le type `ThemeColors` dérivé de la variante claire. Aucun test
automatisé n'a été ajouté (règle du dépôt) ; Maestro n'a pas été invoqué.
<!-- SECTION:NOTES:END -->
