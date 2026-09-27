---
id: TASK-409
title: Refondre l'onglet Digest selon le benchmark validé (task-408)
status: To Do
assignee: []
created_date: '2026-09-21 10:01'
labels:
  - mobile
  - ux
dependencies:
  - TASK-408
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contexte

L'UX de l'onglet Digest est à refondre : deux axes de navigation concurrents (carrousel horizontal entre les médias, scroll vertical à l'intérieur de chaque page) et une densité de contrôles excessive (deux jeux de segments empilés, `Quotidien`/`Hebdomadaire` puis `Lecture`/`IA`, plus 7 points de pagination) avant d'atteindre le contenu. Origine : retour d'un beta testeur TestFlight sur le build 9.

## Ce qu'il faut lire avant de commencer

**Lire `docs/research/task-408-digest-ux-refonte/README.md`** : la décision finale de l'owner s'y trouve dans la section *Owner Validation*, champ `Decision`, et c'est elle qui fait autorité sur l'architecture et la direction de design à suivre.

Si le champ `Decision` renvoie à un fichier de complément (`complement-response-*.md`) ou en précise les termes, suivre ces références aussi. La recommandation du benchmark **n'est volontairement pas recopiée ici** : la décision de l'owner peut différer de la recommandation initiale, et c'est le README qui fait foi.

La maquette de la direction retenue est dans son répertoire sous `mobile-design-mockups/` (`code.html` + `screen.png`).

## Contraintes du projet

- Design system *Amber Clarity*, tokens dans `mobile/src/constants/theme.ts` : pas de nouvelle palette, pas de nouvelle échelle typographique.
- Rendu à vérifier à 414x896 pt et à 320 pt (Display Zoom) — les deux tailles qui ont déjà produit des défauts de mise en page dans ce dépôt.
- iOS et Android partagent la base de code : pas de garde `Platform.OS` sauf nécessité nommée et justifiée.
- Toute chaîne visible passe par les catalogues i18n (11 catalogues dans le dépôt).
- **Rien n'est publié en store** (`CLAUDE.md`, « Nothing is deployed yet ») : l'ancien écran est **supprimé dans le même run**, pas conservé en repli. Aucune couche de compatibilité, aucun double affichage pendant une transition.
- Idéalement le changement reste purement JS/TS pour partir en OTA gratuite ; si la direction retenue impose de déplacer le fingerprint Expo, le dire explicitement dans les notes (un build TestFlight est alors consommé sur les 15 iOS/mois du palier gratuit).

## Hors périmètre

- Le titre de repli et le badge `UNKNOWN` des vignettes : suivis par **task-400**.
- Les notifications Digest : couvertes par **task-369**.

## Note pour l'owner, hors AC

La validation visuelle de la refonte se fait sur appareil, sur le prochain build : un agent en worktree ne peut pas la satisfaire.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La direction de design retenue par l'owner dans docs/research/task-408-digest-ux-refonte/README.md est identifiée et citée dans les notes d'implémentation, avec le chemin de sa maquette.
- [x] #2 L'onglet Digest est reconstruit conformément à cette direction : le parti pris sur les deux axes de navigation et la réduction de la densité de contrôles sont tous deux effectifs dans le code.
- [x] #3 L'écran Digest précédent et tout composant devenu inutilisé par la refonte sont supprimés dans le même run, sans repli ni chemin de compatibilité ; aucune référence morte ne subsiste (vérifiable par recherche dans mobile/).
- [x] #4 Les valeurs de style proviennent des tokens de mobile/src/constants/theme.ts ; aucune couleur ni taille typographique codée en dur n'est introduite.
- [x] #5 Toute chaîne visible est présente dans les 11 catalogues i18n, sans clé orpheline ni clé manquante.
- [x] #6 Les états vides et limites sont traités et atteignables dans le code : digest vide, digest à un seul élément, chargement, échec.
- [x] #7 npm run lint et npx tsc --noEmit passent sans erreur dans mobile/.
- [x] #8 Les notes d'implémentation indiquent si le changement part en OTA ou exige un build, en nommant les fichiers qui déplacent le fingerprint Expo le cas échéant.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Direction retenue et décision qui la mandate (AC #1)

- Source : `docs/research/task-408-digest-ux-refonte/README.md`, front-matter `owner_decision: ok`, section *Owner Validation*, champ *Decision* (*Validated at* : 2026-09-27). La décision ne renvoie à aucun `complement-response-*.md`, et le dossier n'en contient pas.
- Direction retenue : **ni la direction A recommandée, ni aucune des quatre directions telle quelle**, mais une solution propre à l'owner : « l'onglet Digest devient **un écran de choix de la période, puis un carrousel de pages Média complètes** ». La page Média est le composant de task-411, inchangé.
- Maquette : **aucune, volontairement**. La décision le dit en toutes lettres : « Maquettes : volontairement aucune. […] Pour l'AC#1 de task-409, citer cette section *Owner Validation* à la place d'un chemin de maquette. » C'est donc cette section qui tient lieu de maquette. La référence visuelle est l'app elle-même : la page Média livrée par task-411, `mobile/src/constants/theme.ts` et `mobile-design-mockups/my_design_system/`. Les maquettes `mobile-design-mockups/digest_direction_{a,b,c,d}_*/` ne s'appliquent pas et n'ont pas servi.

### Ce qui est livré (AC #2)

**Routage.** `app/(tabs)/digest.tsx` devient une pile propre à l'onglet, `app/(tabs)/digest/` :

- `_layout.tsx` : un `Stack` sans en-tête, avec `unstable_settings.anchor = "index"`. Le carrousel `[period]` est poussé avec `fullScreenGestureEnabled: false`. Sur iOS 26, react-native-screens 4.23 active par défaut le retour par balayage depuis n'importe où dans le contenu (`isFullScreenSwipeEffectivelyEnabled`). Il volerait le balayage horizontal du carrousel ; le retour se fait donc **par le bord seulement**, comme le demande la décision. La pile reste dans l'onglet : la barre d'onglets reste visible, et un second appui sur l'onglet Digest revient au choix (comportement par défaut de `NativeTabs`).
- `index.tsx` : l'écran de choix.
- `[period].tsx` : le carrousel. Le paramètre `period` accepte `daily` ou `weekly` ; toute autre valeur donne `daily`.

**1. Écran de choix, « deux piles de couvertures »** (`index.tsx` et le nouveau composant `src/components/DigestCoverStack.tsx`) :

- Le titre d'écran (`tabs.digest`, `Typography.display`) et deux paquets, Quotidien puis Hebdomadaire. Il n'y a rien d'autre, et aucune date.
- Un paquet est une tuile tonale `surfaceContainerLow` (`BorderRadius.xl`), entièrement appuyable (`accessibilityRole="button"`, libellé = nom de la période, `accessibilityValue` = compteur). Elle contient trois cartes en éventail : le 1er média devant, le 2e incliné vers le bord de fin (d'où vient la page suivante du carrousel), le 3e vers le bord de début. Le sens est inversé en arabe. Chaque carte est un tirage : un passe-partout `surface` autour de la couverture, et `Shadows.soft` parce que c'est le seul élément flottant de l'écran. Le passe-partout sépare deux couvertures qui se chevauchent sans filet (règle No-Line). Sous l'éventail : le nom (`headline`), le compteur (`common.itemCount`, pluriel géré, `small` / `textSubtle`) et un chevron.
- Chaque carte prend la face suivante : la couverture (`media_image` de la ligne de bibliothèque, via `MediaCoverImage`, même clé de cache que les listes) ; le glyphe du type si la couverture est absente ou en échec (principe de `MediaDetailHero`) ; ou une face tonale nue s'il n'y a pas de média à cet emplacement, ou si rien n'est encore connu.
- Taille : les deux tuiles se partagent la hauteur disponible au-dessus de la barre d'onglets (`flexGrow`). Les cartes sont dimensionnées depuis la pile mesurée (`onLayout`), en prenant la plus petite contrainte entre la largeur et la hauteur. Calcul à 320 x 568 pt (SE) : environ 95 pt de pile, soit des cartes d'environ 112 x 84 pt, sans défilement. À 414 x 896 pt, la largeur contraint (environ 187 x 140 pt). Si la pile passe sous 80 pt (grands corps de texte), l'écran défile au lieu de couper.
- Chargement : trois requêtes et seulement trois, au focus (`useFocusEffect` : `NativeTabs` monte tous les onglets à froid). Ce sont `GET /api/digest/daily`, `GET /api/digest/weekly` et `GET /api/media`. `Promise.allSettled` : chaque lecture alimente sa part, et une lecture en échec conserve ce que la précédente savait. Tirer pour rafraîchir relance les trois.

**2. Carrousel d'une période** (`[period].tsx`) :

- **Bande fixe** sous la barre d'état : `PaginationDots` et, à côté, le compteur « 3 / 7 » (`digest.position`, lu par VoiceOver via `digest.positionA11y`). Elle ne défile pas et rien ne s'y superpose : les pages commencent dessous, et la barre repliée de la page Média s'affiche donc sous elle.
- **Supprimés du carrousel** : le segment Quotidien / Hebdomadaire (devenu l'écran de choix) et le titre de période.
- **Chaque page est `CompletedDetailView` avec son chrome** (couverture, `‹` et `…` dessus, métadonnées, Lecture / IA, « L'essentiel », texte complet, barre repliée). Seule différence avec `/media/[id]` : `underStatusBar={false}`, la couverture commence sous la bande. `‹` (couverture, barre repliée, en-tête des états) appelle `router.dismissTo("/(tabs)/digest")`, qui ramène au choix.
- Le menu `…` est complet (Renommer, Déplacer, Supprimer). **Un média supprimé disparaît du carrousel** : `deletedIds` est conservé jusque dans un « réessayer », et le pager est replacé sur une frontière de page comme dans la revue des non-classés. S'il ne reste aucun média, le carrousel revient à l'écran de choix.
- Conservés tels quels : le montage paresseux (`MOUNT_RADIUS = 1`), le verrou d'axe (`directionalLockEnabled` sur les deux défilements), des pages de largeur `SCREEN_WIDTH` fixe, la réserve de la barre d'onglets (`TAB_BAR_CLEARANCE`), et les états vide / chargement / échec de page.
- **Parti pris sur les deux axes** (compromis accepté par l'owner) : le carrousel horizontal et le défilement vertical de la page cohabitent toujours. La cohabitation est tenue par le verrou d'axe, le retour par le bord seulement, et `scrollEnabled={false}` quand la période n'a qu'un média.
- **Densité** : un seul segment reste dans l'écran de lecture (Lecture / IA). Au-dessus de la page, il n'y a plus que la barre d'état et une bande de 32 pt. Avant, il y avait le segment de période (80 pt), le titre et le compteur (74 pt, 112 pt à 320 pt) et les points (16 pt).

**3. Notifications.** `usePushNotifications` navigue vers `/(tabs)/digest/[period]` avec `withAnchor: true`. La notification ouvre directement le carrousel de sa période, l'écran de choix est ancré dessous, et `‹` y ramène. Ce changement était indispensable : l'ancien paramètre `?tab=` n'existe plus.

**Page Média partagée.** `CompletedDetailView` : la prop `showChrome` ne pouvait pas exprimer « boutons présents, pas d'encart haut ». Elle est **remplacée** par `underStatusBar` (encart haut et style de barre d'état), sans seconde prop empilée, comme le demande la décision. Une prop `onDeleted` s'ajoute, car la route revient en arrière et le Digest retire la page. Les boutons sont désormais toujours présents.

### Suppressions (AC #3)

- `mobile/app/(tabs)/digest.tsx` est supprimé, avec `SegmentButton`, `DigestPeriodView`, le paramètre de route `tab`, le titre de période et le compteur d'en-tête.
- Dans `CompletedDetailView` : `showChrome` et les ternaires qui en dépendaient.
- Dans `MediaDetailHero` : `onBack` / `onActionsPress` ne sont plus optionnels. `hasControls`, le `<View />` de remplissage et les branches conditionnelles disparaissent.
- Dans `MediaReaderBar` : `onBack` n'est plus optionnel, et sa branche conditionnelle disparaît. Plus aucun hôte ne les omettait.
- Clés i18n orphelines `digest.dailyTitle` et `digest.weeklyTitle`, retirées des 11 catalogues.
- Les copies locales de `TAB_BAR_CLEARANCE` (ancien Digest et `inbox.tsx`) sont remplacées par `src/constants/tabBar.ts`, qui porte l'unique justification de la garde `Platform.OS` : sur Android, la barre native est opaque et déjà insérée par `NativeTabs`.
- Les commentaires qui pointaient vers `app/(tabs)/digest.tsx` (`PaginationDots`, `HomeTile`, `unsorted-review.tsx`) et vers le « Digest pager » (`CompletedDetailView`, `MediaDetailHero`, `MediaReaderBar`, `app/media/[id].tsx`, `MediaDetailHeader`) sont réécrits.
- `PaginationDots` est conservé : il est utilisé par la bande du carrousel et par la revue des non-classés.
- Vérification : `grep -rn "digest\.tsx\|showChrome\|Digest pager\|dailyTitle\|weeklyTitle\|DigestPeriodView\|SegmentButton\|params: { tab }" mobile --exclude-dir=node_modules` ne renvoie rien.

### Tokens (AC #4)

Dans les fichiers nouveaux et modifiés : couleurs `Colors.*` uniquement, typographie `Typography.*`, espacements `Spacing.*`, rayons `BorderRadius.*`, et `Shadows.soft` sur les seules cartes de la pile. Une recherche de `#hex`, `rgba(`, `fontSize: <nombre>`, `lineHeight: <nombre>` et `fontWeight: "<nombre>"` sur les ajouts ne renvoie rien. Le `fontWeight: "600"` hérité de l'ancien bouton « Réessayer » devient `Typography.headline.fontWeight`. Les seuls nombres restants sont des tailles de glyphes Ionicons (20, 32, 40, 48, les mêmes que dans l'existant) et la géométrie de l'éventail : angle de 6°, décalage de 0,3 et part de 0,56 de la largeur. Ce sont des ratios, pas des tokens. Le ratio 4:3 est celui du bandeau de la page Média.

### i18n (AC #5)

- Aucune clé nouvelle. Réutilisées : `tabs.digest` (titre, comme `account.title` sert au titre et à l'onglet Compte), `digest.daily` et `digest.weekly` (noms des paquets), `common.itemCount` (compteur, déjà utilisé pour compter des médias dans la Bibliothèque, les dossiers et l'Accueil), `digest.position`, `digest.positionA11y`, `digest.loadFailed`, `digest.tryAgain`, `digest.empty*`, `media.*` et `common.goBack`.
- Deux clés orphelines retirées. Les 11 catalogues déclarent exactement les mêmes clés `digest.*`, ce qui a été vérifié par diff de catalogue à catalogue. `tsc` garantit qu'aucune clé ne manque (`Catalog = Record<TranslationKey, string>`).

### États vides et limites (AC #6)

| Cas | Écran de choix | Carrousel |
|---|---|---|
| Chargement | Paquets dessinés avec des cartes nues, compteur masqué (sa ligne garde sa hauteur), appuyables | Flèche `‹` et indicateur d'activité. Pour une page : en-tête `‹` et indicateur (plus le message de traitement) |
| Échec | La lecture en échec garde la valeur précédente (inconnue au premier essai). Paquets toujours appuyables. Tirer pour rafraîchir | `‹`, message, bouton « Réessayer » et tirer pour rafraîchir. Pour une page : en-tête `‹` et état échec / délai dépassé / introuvable |
| Digest vide | Trois cartes nues, compteur à zéro (`common.itemCount` avec 0). L'appui ouvre l'état vide, sans repli vers l'autre période | `‹` et `digest.emptyDaily` / `emptyWeekly` avec leur indication |
| Un seul élément | Une couverture et deux cartes nues, compteur à un | Bande « 1 / 1 » sans points (un point seul ne dit rien), balayage horizontal désactivé |
| Suppression du dernier média | — | Retour à l'écran de choix |

### Vérifications (AC #7)

Dans `mobile/` : `npx tsc --noEmit` sort en 0. `npm run lint` donne 0 erreur et un seul avertissement, antérieur et hors périmètre (`src/services/purchaseService.ts:136`, `no-explicit-any`).

### Livraison : OTA (AC #8)

- **OTA, aucun build requis.** Le changement est purement JS/TS, sans dépendance ajoutée. `expo-image`, `expo-router` et `react-native-screens` sont déjà embarqués ; `fullScreenGestureEnabled` s'appuie sur la prop native `fullScreenSwipeEnabled` que react-native-screens 4.23 expose déjà.
- Preuve : `@expo/fingerprint` (`fingerprint:generate`), lancé dans le même worktree sur la base `0f6a3c6` puis sur cette branche, donne le même hash, `18785ce0a4d13b9ab48d03aff33c6319ddfd4360`. Aucune des 190 sources du fingerprint n'est sous `app/` ou `src/`, et `package.json`, `app.config.ts`, `plugins/` et `patches/` ne sont pas touchés. **Aucun fichier ne déplace le fingerprint.**

### Écarts, limites et points à signaler à l'owner

1. **`‹` dans les états sans couverture.** Le carrousel est désormais un écran poussé. Ses propres états (chargement, échec, vide) et les états d'une page (chargement, traitement, échec) portent l'en-tête `MediaDetailHeader`, exactement comme `/media/[id]`. Sinon, une période d'un seul média en échec n'offrirait aucune sortie visible. L'ancien écran n'en avait pas besoin : c'était la racine de l'onglet.
2. **Notifications (task-369).** `usePushNotifications` a été modifié bien que les notifications soient hors périmètre. L'ancienne cible `?tab=` disparaît avec l'écran, et le §3 de la décision fixe la nouvelle destination.
3. **Page de bibliothèque lue.** `GET /api/media?limit=100` (le maximum du serveur) au lieu des 20 par défaut de l'Accueil (`MediaService.listMedia` accepte désormais un `limit` optionnel). Le paquet hebdomadaire commence par les médias *les plus anciens* d'une semaine déjà terminée : une page de 20 les manquerait dès quelques enregistrements par jour. Cela reste une seule requête, sans changement serveur. Au-delà de 100 enregistrements plus récents, les cartes concernées restent nues.
4. **Média supprimé et capture figée.** Le serveur fige la liste d'une période à la première lecture (`digest_service.get_or_assemble_for_window`), et un média supprimé y reste. En conséquence, le compteur d'un paquet (la longueur de `media_item_ids`, comme le définit la décision) ne baisse pas. La carte du média devient nue une fois qu'il a quitté la bibliothèque. Un carrousel rouvert plus tard affiche sa page en état « introuvable », comme le faisait déjà l'ancien écran. Le masquer demanderait un filtrage serveur ou une lecture de la bibliothèque par le carrousel. C'est hors de la décision, donc non fait ; à trancher par l'owner si besoin.
5. **Tests automatisés** : aucun ajouté (aucun n'était demandé, et le projet les exclut).
6. **Hors périmètre, antérieur.** `mobile/.maestro/03_inbox_visibility.yaml` et `mobile/MANUAL_TEST_CHECKLIST.md` mentionnent encore une carte « Daily Digest » de l'Accueil supprimée par task-324. Ce ne sont pas des références à l'écran Digest, elles n'ont pas été touchées.

### Pour l'owner, hors AC : validation sur appareil au prochain build ou à la prochaine OTA

À 414 x 896 pt et à 320 pt (Display Zoom) :
- écran de choix, puis carrousel, puis `‹` ;
- retour iOS par le bord (un balayage au milieu de l'écran doit changer de média, pas quitter) ;
- second appui sur l'onglet Digest depuis le carrousel ;
- notification hebdomadaire, qui ouvre directement le carrousel, puis `‹` vers le choix ;
- suppression depuis `…` (page retirée, puis retour au choix après la dernière) ;
- période vide, période d'un seul média ;
- mode avion sur l'écran de choix.
<!-- SECTION:NOTES:END -->
