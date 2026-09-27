---
owner_decision: ok   # pending | ok | abandoned | redo | more
---

# Benchmark : refonte UX de l'onglet Digest (deux axes de navigation, densité de contrôles)

## Owner Validation

**Decision**: **Aucune des quatre directions telle quelle, ni la direction A recommandée.** Une solution propre à l'owner, rendue possible par la refonte de la page Média (task-410 direction C, livrée par task-411) : l'onglet Digest devient **un écran de choix de la période, puis un carrousel de pages Média complètes**. La page Média n'est pas redessinée pour le Digest : c'est le composant de task-411, inchangé.

Pourquoi ce choix plutôt que A : depuis task-411, la page Média est l'écran de lecture que l'owner veut montrer. Le Digest la présente telle quelle au lieu de renvoyer vers elle depuis une liste. Le « trop plein de boutons » se règle en sortant le segment de période de l'écran de lecture, pas en supprimant le carrousel.

**1. Écran de choix, racine de l'onglet — « deux piles de couvertures ».**

- Le principe : chaque période est représentée par **un paquet de cartes**, fait des **couvertures des trois premiers médias** de la période (ordre de `media_item_ids`), empilées pour évoquer une pile. Chaque paquet porte le nom de sa période et son nombre de médias (la longueur de `media_item_ids`). L'écran contient deux paquets, **Quotidien** puis **Hebdomadaire**, et rien d'autre qu'un titre d'écran. Tout le paquet est la cible d'appui.
- L'intention est un écran de choix plus expressif qu'une liste de deux lignes, où l'on voit ce qui attend dans chaque période. La forme exacte (disposition, décalage ou rotation des cartes, emplacement du nom et du compteur, matériaux, tailles) **revient à l'implémenteur** : elle doit sortir du design system Amber Clarity et des composants existants (`MediaCoverImage`, `GlassSurface`, les tokens de `theme.ts`), pas d'une maquette.
- **Chargement retenu, et lui seul** : les deux digests (`GET /api/digest/daily` et `/weekly`) et la liste de la bibliothèque (`GET /api/media`, déjà appelée par l'Accueil), soit **3 requêtes**. Les couvertures sont les `media_image` des éléments de la liste dont l'identifiant figure dans le digest. **Pas** de fiche détail par couverture, et **aucun** changement côté serveur.
- Couverture absente ou en échec : repli sur le glyphe du type de média, selon le même principe que `MediaDetailHero`. Période vide : paquet sans couverture, compteur à zéro ; l'appui ouvre l'état vide actuel, sans repli vers une autre période. Chargement ou erreur réseau : les deux paquets restent affichés et appuyables. Leurs couvertures sont un enrichissement : elles ne bloquent jamais le choix.
- Pas de dates sur cet écran. Pour mémoire, l'hebdomadaire couvre la semaine lundi-dimanche **déjà terminée** annoncée par l'envoi du lundi 09:30, et non la semaine en cours (`digestService.ts`).
- La période choisie n'est pas mémorisée : un démarrage à froid rouvre l'écran de choix.

**2. Carrousel d'une période, poussé depuis l'écran de choix.**

- **Une bande fixe dédiée, en haut de l'écran sous la barre d'état**, porte les points de pagination (`PaginationDots`) **et, à côté, le compteur de position** (« 3 / 7 »). Elle ne défile jamais, et rien ne s'y superpose : la barre repliée de la page Média s'affiche en dessous d'elle quand on lit. L'alternative « points posés sur la couverture » est écartée. La hauteur et l'habillage de la bande relèvent du design system.
- **Supprimés du carrousel** : le segment `Quotidien` / `Hebdomadaire` (déplacé sur l'écran de choix) et le titre de période (« Votre journée en revue »).
- **Chaque page est `CompletedDetailView` avec son chrome** : couverture, boutons `‹` et `…` posés dessus, métadonnées, segment Lecture / IA, « L'essentiel », texte complet, barre repliée au défilement. **Seule différence avec la route `/media/[id]`** : la couverture commence sous la bande des points au lieu de passer sous la barre d'état. Si `showChrome` ne peut pas exprimer « boutons présents, pas d'encart haut », le remplacer plutôt qu'empiler une seconde prop. Aucune branche morte ne doit subsister.
- `‹` (sur la couverture et dans la barre repliée) ramène à l'écran de choix, tout comme le geste de retour d'iOS, **par le bord seulement**, pour ne pas voler le balayage horizontal du carrousel.
- Le menu `…` reste complet (Renommer, Déplacer, Supprimer). **Un média supprimé depuis le Digest disparaît du carrousel**, et s'il n'en reste aucun, retour à l'écran de choix.
- Montage paresseux, verrou d'axe (`directionalLockEnabled`), réserve de la barre d'onglets, états vide / chargement / échec de page : conservés tels que `digest.tsx` les fait aujourd'hui.

**3. Notifications (task-369).** Une notification de digest ouvre **directement le carrousel de sa période**, sans passer par l'écran de choix. `‹` ramène ensuite à l'écran de choix.

**Compromis accepté sciemment :** le carrousel horizontal et le défilement vertical dans la page **cohabitent toujours**. C'est le premier grief du testeur ; l'owner le garde en échange d'une page de lecture complète dans l'onglet. Ce qui est réglé, c'est la densité : un seul segment (Lecture / IA) reste dans l'écran de lecture, et le titre de période disparaît.

**Livraison attendue** : JS/TS seulement (`expo-image` est déjà installé, et empiler des cartes ne demande que des styles), donc une mise à jour OTA. Si l'implémentation déplace malgré tout le fingerprint Expo, le dire.

**Maquettes : volontairement aucune.** Cette décision est un principe, pas un dessin. Les croquis montrés à l'owner pendant l'arbitrage n'étaient que des illustrations rapides et ne sont **pas** dans le dépôt, exprès : ils ne sont pas fidèles au design de l'app. Pour l'AC#1 de task-409, citer cette section *Owner Validation* à la place d'un chemin de maquette. La référence visuelle, c'est l'app elle-même : la page Média livrée par task-411, le design system Amber Clarity (`mobile/src/constants/theme.ts`, `mobile-design-mockups/my_design_system/`) et les composants existants. Aucune maquette des directions A à D (`mobile-design-mockups/digest_direction_*`) ne s'applique. Les §4 à §8 et §12 de ce README décrivent des directions non retenues ; seuls l'inventaire du §1 et les sources restent utiles.

**Validated at**: 2026-09-27

---

## Recommendation

**Direction A — « Sommaire » : le digest est une liste, le média est un écran.**
Maquette : `mobile-design-mockups/digest_direction_a_sommaire/`.

L'axe horizontal disparaît. Le `ScrollView horizontal pagingEnabled` de `mobile/app/(tabs)/digest.tsx` est supprimé, `PaginationDots` quitte cet écran, et l'imbrication `CompletedDetailView showChrome={false}` — la cause réelle du second segment — est défaite. L'onglet redevient ce que le contrat de données décrit déjà : `media_item_ids`, une liste ordonnée. Chaque ligne est un `MediaListCard`, celui de l'Accueil et de la Recherche, et un appui pousse `/media/[id]`, écran qui porte **déjà** son segment Lecture/IA et sa flèche de retour.

Cinq arguments, dans l'ordre de force.

1. **Le défaut est mesuré, pas invoqué.** L'écran actuel consomme **448 pt sur 896 (50 %)** avant le premier mot de contenu à 414x896 pt, et **520 pt sur 568** à 320x568 pt — il reste alors **48 pt** de contenu visible, soit moins de deux lignes de corps de texte, et **763 pt** à faire défiler dans la page pour lire la suite (§1.2). A ramène ce chrome à **202 pt** à 414 (**−55 %**) et **212 pt** à 320 (**−59 %**), et rend **4 lignes de média entièrement visibles** à 414 pt, **2** à 320 pt, sans un geste (§4).

2. **Elle répond littéralement à l'exigence d'accessibilité que Material formule pour les carrousels, et à laquelle l'écran actuel ne répond pas.** « On vertically-scrolling pages, carousels require an accessible way to view all the items without horizontally scrolling. (This requirement doesn't apply to full-screen carousels.) […] Material recommends adding a *Show all* button below the carousel, which opens a dedicated vertically-scrolling page of all carousel items. » ([Material 3, Carousel guidelines](https://m3.material.io/components/carousel/guidelines), consulté le 2026-09-21). L'écran actuel tombe dans la lettre de cette exigence — chacune de ses pages défile verticalement — et n'offre **aucun** moyen de voir les 7 médias sans balayer. A *est* cette page verticale de tous les éléments, promue au rang d'écran plutôt qu'ajoutée comme rustine derrière un bouton. Pour mémoire, B n'a pas de carrousel donc l'exigence ne l'atteint pas, C en est **nommément dispensée** (carrousel plein écran), et D, qui supprime tout défilement vertical, sort de la lettre du texte tout en restant la seule des quatre à ne proposer aucun survol des 7 médias.

3. **Les 7 points ne sont pas seulement encombrants : ils ne disent rien à personne.** `mobile/src/components/PaginationDots.tsx` les retire explicitement de l'arbre d'accessibilité (`accessible={false}`, `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`, `pointerEvents="none"`), les plafonne à `MAX_VISIBLE = 7` — donc un digest de 12 médias affiche 7 points — et le code de `digest.tsx` admet lui-même la limite dans son commentaire (« The dots cap at seven and cannot state where in the period the user is »), raison pour laquelle un compteur textuel `1 / 7` a dû être ajouté juste au-dessus. Apple, de son côté, demande de « center a page control at the bottom of the view or window » alors qu'ils sont ici en **haut** ([Apple HIG, Page controls](https://developer.apple.com/design/human-interface-guidelines/page-controls), consulté le 2026-09-21). Une liste n'a pas de pages : les deux contrôles disparaissent ensemble, et la position est portée par le défilement lui-même.

4. **A est une suppression, pas une construction.** Aucun composant nouveau, aucune dépendance ajoutée (`MediaListCard`, `FlatList`, `/media/[id]` existent), donc **empreinte Expo inchangée et livraison OTA gratuite** (§8.3). C'est la direction la moins coûteuse des quatre à implémenter *et* la moins coûteuse à abandonner si elle déplaît, puisqu'elle ne crée aucun composant propre au Digest.

5. **Elle ramène l'onglet à un seul niveau de navigation.** Material : « Secondary tabs […] are always placed below primary tabs » et « Use tabs to group related content, **not sequential content** » ([Material 3, Tabs guidelines](https://m3.material.io/components/tabs/guidelines), consulté le 2026-09-21). L'écran actuel empile **trois** niveaux à l'allure d'onglets — la barre `NativeTabs` du système, le segment de période, puis Lecture/IA — pour naviguer, au dernier niveau utile, dans du contenu **séquentiel** (les 7 médias de la journée). A en retire un et rend le troisième à l'écran de détail : il reste un niveau dans l'onglet.

**Compromis explicitement acceptés :**

- **On ne lit plus dans l'onglet.** Le texte complet se lit sur `/media/[id]`. C'est le prix réel de A, et c'est le seul. Il est payé une fois par média, en un appui, vers un écran qui existe et que l'utilisateur connaît déjà par l'Accueil.
- **Le Digest ressemble à l'Accueil et à la Recherche**, puisqu'il emprunte leur ligne. Réponse au §8.5 : ce que le Digest apporte en propre est le **cadrage** — la période, la sélection, l'ordre figé à la capture — et non la forme de ses lignes. Réutiliser `MediaListCard` est d'ailleurs ce qui rend la direction gratuite.
- **Un digest d'un seul média donne une liste d'une ligne**, ce qui est pauvre. C'est la faiblesse reconnue de A, et le seul cas où B fait mieux (§8.4).

**Repli, si l'owner refuse de sortir de l'onglet pour lire** : **direction B — « Journal continu »** (`mobile-design-mockups/digest_direction_b_journal_continu/`). Elle supprime le même axe horizontal, garde toute la lecture dans l'onglet, et coûte un composant : une ligne dépliante (`LayoutAnimation`, cœur de React Native, donc OTA aussi). Son prix est la longueur : le journal mesure **3966 pt** à 414 pt et **4268 pt** à 320 pt, première entrée dépliée (§5).

**Pourquoi pas C ni D** : C (pagination verticale plein écran) est la seule direction légitimée par une disposition documentée de Material, mais elle demande **n + 1 gestes** pour le n-ième média, supprime tout survol, et transforme l'onglet en fil social — un changement de nature que rien dans le retour du testeur ne demande. D (carrousel conservé, scroll supprimé) est le choix miroir, construit exprès pour que l'owner puisse trancher sciemment : elle **conserve le geste que le testeur a nommé en premier**. Elle est la plus propre sur les cas limites, et la plus risquée sur le grief d'origine.

**Où lire quoi** : AC#1 → §1 · AC#2 → §2 · AC#3 → §3.1 et les répertoires cités · AC#4 → §4.1, §5.1, §6.1, §7.1 et §8.1 · AC#5 → §4.2, §5.2, §6.2, §7.2 et §8.1 · AC#6 → §3.4 · AC#7 → §3.2, §3.3 et les tableaux « Mesures » de §4 à §7, récapitulés au §8.2 · AC#8 → §8.3 · AC#9 → §8 · AC#10 → §9 · AC#11 → ce fichier, `owner_decision: pending`, section *Owner Validation* vide. Aucun fichier de `mobile/` n'a été modifié : il a été lu pour l'inventaire et pour les tokens.

---

## 1. L'écran Digest actuel, contrôle par contrôle (AC#1)

### 1.1 Les contrôles de navigation présents

Lecture faite sur l'arbre courant, après task-366 (Digest V1) et task-350 (la barre d'onglets est dessinée par `UITabBarController`). Les numéros de ligne sont ceux de l'arbre au 2026-09-21.

| # | Contrôle | Ce qu'il pilote | Où c'est implémenté |
|---|---|---|---|
| 0 | **Barre d'onglets du système** (Accueil, Recherche, Digest, Compte) | Change d'onglet. Dessinée par iOS, pas par l'app. | `mobile/app/(tabs)/_layout.tsx:76-155` (`NativeTabs`, `NativeTabs.Trigger name="digest"` l. 128-139). Le Digest lui réserve `TAB_BAR_CLEARANCE` = `TouchTarget.large + Spacing.lg` = **88 pt** sur iOS (`digest.tsx:113-114`) |
| 1 | **Segment `Quotidien` / `Hebdomadaire`** | Écrit le paramètre de route `?tab=` via `router.setParams` — c'est donc de la *navigation*, pas un état local — ce qui remonte `DigestPeriodView` par son `key={activeTab}` et remet à zéro digest, erreur, rafraîchissement et position du pager | `digest.tsx:130-137` (handler), `141-154` (rendu), `382-409` (`SegmentButton`, **local au fichier**, ce n'est pas `ScreenTabs`), styles `498-526` |
| 2 | **Titre de période** (« Votre journée en revue ») | Rien : c'est un titre. `Typography.display` (32 pt / 700 / −0.5) | `digest.tsx:251-254`, clés `digest.dailyTitle` / `digest.weeklyTitle` |
| 3 | **Compteur textuel `1 / 7`** | Rien : il *rapporte* la position du pager. Existe parce que les points ne peuvent pas la dire — commentaire du code : « The dots cap at seven and cannot state where in the period the user is. This is where that information lives, for the eye and for a screen reader alike » | `digest.tsx:256-267`, clés `digest.position` / `digest.positionA11y` |
| 4 | **Les 7 points de pagination** | Rien du tout : `pointerEvents="none"`, donc non tappables, et retirés de l'arbre d'accessibilité (`accessible={false}`, `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`). Purement indicatifs | `digest.tsx:351-355` ; composant `mobile/src/components/PaginationDots.tsx` : `MAX_VISIBLE = 7` (l. 20), `DOT_SIZE = 8` (l. 29), rangée `height: Spacing.md` = 16 pt et `gap: Spacing.sm` (l. 130-137), `if (count <= 0) return null` (l. 53) |
| 5 | **Le pager horizontal** — *axe 1* | Passe d'un média au suivant. `pagingEnabled`, page = `SCREEN_WIDTH`, `directionalLockEnabled`, `onScroll` dérive `activeIndex` de `contentOffset.x`. Seules les pages à distance ≤ `MOUNT_RADIUS = 1` sont montées ; les autres sont des `View` vides de la même largeur. Pas de `RefreshControl` : « It only works on a vertical scroll view » | `digest.tsx:357-378`, `MOUNT_RADIUS` l. 117, `handleScroll` l. 217-224, style `page` l. 598-600 |
| 6 | **Segment `Lecture` / `IA`** | Change de volet **à l'intérieur** de la page courante. Collé en haut par `stickyHeaderIndices={[1]}` | Vient de la page elle-même : `digest.tsx:433-441` monte `CompletedDetailView … showChrome={false}` ; le segment est `ScreenTabs` avec `MEDIA_DETAIL_TABS` (`CompletedDetailView.tsx:86-89`, rendu l. 868-875, `stickyHeaderIndices` l. 833) ; composant `mobile/src/components/ScreenTabs.tsx` (pilule `surfaceContainerLow`, `minHeight: TouchTarget.minimum`, icônes 18 pt, `accessibilityRole="tablist"`/`"tab"`) |
| 7 | **Le scroll vertical de la page** — *axe 2* | Fait défiler Aperçu puis Texte complet sous le segment collé | `CompletedDetailView.tsx:826-839`. Son `directionalLockEnabled` est commenté comme la condition de la cohabitation : « One axis per drag, which is what makes this page swipeable when the Digest nests it in a horizontal pager » |

**Ce que l'inventaire établit, et qui n'est pas cosmétique :**

- **Les deux axes ne sont pas juxtaposés, ils sont imbriqués** : le scroll vertical appartient à un composant partagé (`CompletedDetailView`, 1102 lignes, également monté par la route `/media/[id]`), que le Digest héberge sans son chrome. Le Digest ne possède donc *pas* le second segment : il l'hérite.
- **Trois niveaux à l'allure d'onglets** se superposent : la barre du système (#0), le segment de période (#1), le segment Lecture/IA (#6). Et entre les deux niveaux visibles dans l'onglet, l'écran intercale un titre `display`, un compteur et une rangée de points — trois éléments **non interactifs** (#2, #3, #4) qui occupent la place où l'utilisateur attend du contenu.
- **Deux contrôles disent la même chose** : le compteur `1 / 7` (#3) et les points (#4). Le code documente lui-même pourquoi : les points sont plafonnés à 7 et muets pour un lecteur d'écran.

### 1.2 Ce que ce chrome coûte en hauteur, mesuré

Mesures prises sur le cadre « État actuel » des quatre maquettes, qui reprend les valeurs exactes des styles ci-dessus (méthode au §3.3). La colonne 320 pt correspond à un iPhone SE 2/3 en Display Zoom, où le titre de période passe sur **2 lignes** et le titre du média sur **3**.

| Bande | 414x896 pt | 320x568 pt | Provenance |
|---|---|---|---|
| Barre d'état / encoche (safe area haute) | 48 | 20 | **estimation**, méthode au §9 |
| Segment `Quotidien` / `Hebdomadaire` (#1) | 80 | 80 | mesuré (16 + 4 + 48 + 4 + 8) |
| Titre de période + compteur (#2, #3) | 74 | **112** | mesuré (titre 38 → 76 pt : il passe sur 2 lignes) |
| Rangée des 7 points (#4) | 16 | 16 | mesuré (`height: Spacing.md`) |
| Titre du média + méta + segment `Lecture`/`IA` (#6) et gouttières | 230 | **292** | mesuré (hero 110 → 172 pt ; barre d'onglets internes 72 pt) |
| **Total avant le premier mot de contenu** | **448 pt / 896 (50 %)** | **520 pt / 568 (92 %)** | mesuré |
| Hauteur restante jusqu'au bas du cadre | 448 | **48** | mesuré |
| Hauteur du contenu de la page (Aperçu + Texte complet) | 708 | 811 | mesuré |
| Reste à faire défiler dans la page | 260 | **763** | mesuré |

**Et la barre d'onglets prend encore 88 pt sur cette hauteur restante.** `digest.tsx:587-591` les retire de la hauteur du pager (`pagerContainer` a `paddingBottom: TAB_BAR_CLEARANCE`) au lieu de laisser le contenu passer dessous. D'où, par **calcul** à partir des bandes mesurées (méthode au §9) :

- à **414x896** pt, la zone de lecture réelle vaut `448 − 88 = 360 pt`, soit **40 %** de l'écran ;
- à **320x568** pt, elle vaut `48 − 88 < 0` : **il n'y a pas de place pour une seule ligne de contenu**. L'utilisateur voit le titre, la méta, et le segment Lecture/IA partiellement coupé ; le premier mot d'Aperçu est sous le pli. C'est très exactement le genre de défaut que task-408 signale à cette taille.

Dans les quatre maquettes, cette bande de 88 pt est traitée explicitement : la variable `--tabbar-clearance` du CSS vaut `calc(var(--touch-large) + var(--space-lg))`, et aucun contrôle ni bouton d'action n'y est posé.

### 1.3 Trois faits du code qui pèsent sur les directions

1. **Le digest est déjà une liste ordonnée d'identifiants.** `const ids = digest?.media_item_ids ?? []` (`digest.tsx:215`). Aucune des quatre directions ne demande un changement de contrat d'API : elles ne diffèrent que par la façon de parcourir cette liste.
2. **Le segment de période est de la navigation.** Il écrit `?tab=`, ce qui permet à une notification d'ouvrir directement la bonne période (task-369) et fait repartir la période de zéro. Aucune direction ne le supprime — c'est le seul chemin vers l'hebdomadaire.
3. **Une barre de progression accessible existe déjà dans l'app** : celle du quiz, `mobile/app/artifacts/[artifactId].tsx` (`quizProgressTrack`, 4 pt, `accessibilityRole="progressbar"`). Les directions C et D la reprennent au lieu d'inventer un indicateur : c'est ce qui leur permet de supprimer les 16 pt de points *et* le compteur textuel sans rien perdre.

---

## 2. Comment les plateformes et les apps établies présentent une série d'éléments de lecture quotidienne (AC#2)

Toutes les pages ci-dessous ont été **consultées le 2026-09-21**. Les pages Apple et Material sont des applications JavaScript : elles ont été récupérées avec Chrome headless (`--dump-dom --virtual-time-budget=12000`), un `WebFetch` ordinaire n'en renvoyant que le `<title>`. Les citations sont reproduites en anglais, telles quelles.

### 2.1 Sept approches distinctes, chacune citée

| # | Approche | Ce que la source en dit, mot pour mot | Source (consultée le 2026-09-21) | Ce que ça implique pour le Digest |
|---|---|---|---|---|
| 1 | **Liste verticale continue** — une ligne par élément, on parcourt du pouce | « Lists are continuous, vertical indexes of text and images » ; « Lists are vertical groups of text, icons, images, and other elements, **optimized for reading comprehension** » ; « A list should be easy to scan. […] Place supporting visuals and primary text in the same position in each list item » | [Material 3 — Lists guidelines](https://m3.material.io/components/lists/guidelines) | C'est la forme que Material donne à un index d'éléments hétérogènes. C'est la direction A |
| 2 | **Le digest lui-même est un défilement** — l'implémentation de référence la plus proche de notre cas | « The Daily Digest collects an assortment of documents from your Feed and your Saved for Later and presents them to you in an **easily-scrollable format** to help you triage your feed » ; « On mobile, you can find the Daily Digest at the top of your Home section » ; « … all the same documents that you would see when **scrolling through the Digest on your mobile device** » | [Readwise Reader — Daily Digest (FAQ)](https://docs.readwise.io/reader/docs/faqs/daily-digest) | Readwise Reader, dont notre Digest reprend le concept, décrit sa propre fonctionnalité mobile comme un **défilement**, jamais comme un carrousel. Et le digest y est *dans* l'accueil, pas dans un onglet séparé |
| 3 | **Carrousel horizontal + page control** — ce que fait l'écran actuel | « Use page controls to represent movement between an ordered list of pages » ; « **Center a page control at the bottom** of the view or window. To ensure people always know where to find a page control, center it horizontally and position it near the bottom of the view » ; « Although page controls can handle any number of pages, **don't display too many**. More than about 10 dots are hard to count at a glance » | [Apple HIG — Page controls](https://developer.apple.com/design/human-interface-guidelines/page-controls) | L'usage (liste ordonnée de pages) est légitime ; le **placement en haut** ne l'est pas, et le plafond de 7 imposé par `PaginationDots` est un choix de l'app, pas une contrainte d'Apple |
| 4 | **Carrousel plein écran à défilement vertical** — la pagination, mais dans l'axe du pouce | Des quatre dispositions de carrousel de Material, « **Full-screen**: the full-screen carousel layout shows one edge-to-edge large item at a time **and scrolls vertically** » ; et, sur l'accessibilité : « On vertically-scrolling pages, carousels require an accessible way to view all the items without horizontally scrolling. (**This requirement doesn't apply to full-screen carousels.**) » | [Material 3 — Carousel guidelines](https://m3.material.io/components/carousel/guidelines) | C'est la direction C, et c'est la seule des quatre qui soit une disposition **nommée** par une plateforme |
| 5 | **Sommaire d'abord, détail ensuite (« Show all »)** — l'obligation d'accessibilité que l'écran actuel ne remplit pas | « Material recommends adding a **Show all** button below the carousel, which opens a dedicated **vertically-scrolling page of all carousel items**. If the carousel has a header, you can use an arrow icon button instead » | [Material 3 — Carousel guidelines](https://m3.material.io/components/carousel/guidelines) | Un carrousel horizontal **doit** offrir une vue verticale de tous ses éléments. L'onglet Digest n'en offre aucune aujourd'hui. La direction A consiste à faire de cette vue l'écran lui-même |
| 6 | **Divulgation progressive en place (accordéons)** — tout sur une page, replié | « Accordions conserve space on mobile **but they can also cause disorientation and too much scrolling** » ; « One of the biggest advantages of accordions is that they often allow users to **get the big picture before focusing on details**, and they can effectively mitigate the common problem of overly long pages » | [NN/g — Accordions on Mobile](https://www.nngroup.com/articles/mobile-accordions/) (Raluca Budiu, 2015-05-31) | C'est la direction B, avec son risque nommé par la source elle-même : la longueur |
| 7 | **Bascule explicite entre « un à la fois » et « tout sur une page »** — laisser l'utilisateur choisir la forme | « When using Readwise on web, there are two ways to view any collection of highlights: **Review Mode** or **Scroll Mode**. Review Mode displays the highlights **one at a time** […] Scroll Mode displays **all of the collection's highlights on a single page** […] you can switch to this view during your Daily Review by clicking the list icon in the top right » | [Readwise — Reviewing highlights (FAQ)](https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights) | Une option envisageable — mais la documentation la décrit **pour le web**, et elle ajoute un contrôle de plus à un écran dont le grief est justement le nombre de contrôles. Écartée pour cette raison, pas par méconnaissance |

Deux cadrages supplémentaires, également cités parce qu'ils décident de la densité de contrôles :

| Sujet | Citation | Source (consultée le 2026-09-21) |
|---|---|---|
| **À quoi servent des onglets** | « Secondary tabs are used within a content area to further separate related content and establish hierarchy […] They're **always placed below primary tabs** » ; « Use tabs to group related content, **not sequential content**. […] Don't use tabs to move through sequential content that needs to be read in a particular order. Instead, create hierarchy within the content using techniques like typography style and open space » ; « **Avoid using more than four tabs at once** » ; « Tabs control the UI region displayed below them » | [Material 3 — Tabs guidelines](https://m3.material.io/components/tabs/guidelines) |
| **Combien de segments** | « **Limit the number of segments in a control.** Too many segments can be hard to parse and time-consuming to navigate. Aim for no more than about five to seven segments in a wide interface and **no more than about five segments on iPhone** » | [Apple HIG — Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls) |
| **Ce que vaut un carrousel, empiriquement** | « Whether looking at content on a 30-inch or 3-inch display, people often **immediately scroll past these large images and miss all of the content** within them, or at least the content that's in **any frame other than the first** » | [NN/g — Carousel Usability](https://www.nngroup.com/articles/designing-effective-carousels/) (Kara Pernice, 2013-09-14, révisé 2026-08-07) |

### 2.2 Trois conclusions qui vont contre l'intuition, et qu'il faut poser avant de comparer

1. **La cohabitation des deux axes n'est *pas* une violation de guideline.** Apple écrit exactement l'inverse de ce qu'on attendrait : « Avoid putting a scroll view inside another scroll view **with the same orientation**. […] **It's alright to place a horizontal scroll view inside a vertical scroll view (or vice versa), however.** » ([Apple HIG — Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views), consulté le 2026-09-21). Le grief du testeur est donc un grief de **charge cognitive et de densité**, pas de conformité — et il faut le traiter comme tel : ce qui est fautif, c'est la quantité de chrome empilé avant le contenu (§1.2), pas le fait technique d'imbriquer deux `ScrollView` orthogonaux. Une direction qui ne supprimerait qu'un axe sans réduire le chrome ne résoudrait rien.

2. **Le second segment n'est pas illégitime en soi — c'est son empilement qui l'est.** Material *prévoit* des onglets secondaires sous des onglets primaires (« always placed below primary tabs »). Le défaut précis de l'écran actuel est donc triple : trois niveaux au lieu de deux (§1.1), et surtout **230 pt de séparation** entre les deux niveaux visibles, remplis d'éléments non interactifs (titre, compteur, points) là où la guideline suppose deux rangées adjacentes. Et, au dernier niveau utile, l'écran utilise un mécanisme de *groupement* (le pager et ses points) pour du **contenu séquentiel**, ce que Material déconseille explicitement.

3. **Apple légitime la pagination page-par-page, sans dire dans quel axe.** « Consider supporting page-by-page scrolling if it makes sense for your content. In some situations, people appreciate scrolling by a fixed amount of content per interaction instead of scrolling continuously » (même page). C'est ce qui rend la direction C défendable : elle garde la pagination et change seulement l'axe, et Material lui donne un nom (*full-screen carousel*) en la dispensant de l'obligation de « Show all ».

---

## 3. Méthode : ce qui a été dessiné, comment ça a été mesuré (AC#3, AC#6, AC#7)

### 3.1 Les quatre maquettes (AC#3)

Un répertoire par direction sous `mobile-design-mockups/`, chacun avec `code.html` et `screen.png`, selon la convention de `daily_digest_your_day_in_review` et `weekly_digest_harmonized_v2` :

| Direction | Répertoire | `screen.png` |
|---|---|---|
| A — « Sommaire » | `mobile-design-mockups/digest_direction_a_sommaire/` | 1200 x 4698 px |
| B — « Journal continu » | `mobile-design-mockups/digest_direction_b_journal_continu/` | 1200 x 4633 px |
| C — « Pages pleines » | `mobile-design-mockups/digest_direction_c_pages_pleines/` | 1200 x 5552 px |
| D — « Fiche unique » | `mobile-design-mockups/digest_direction_d_fiche_unique/` | 1200 x 4738 px |

Chaque page contient, dans cet ordre : le parti pris en quatre lignes (axes, double segment, points, composant nouveau), **l'écran actuel rendu aux deux tailles** comme référence de comparaison, la direction aux deux tailles, ses cas limites (digest vide, digest d'un seul média), un tableau de mesures, un tableau gestes / cas limites / livraison, et ce qu'elle abandonne.

Chaque `code.html` est autonome : **aucun `<link>`, aucun `<script>`, aucune `<img>`, aucune requête réseau**. Deux conséquences voulues, toutes deux écrites en commentaire dans le fichier :

- **Police système.** L'app ne charge aucune police (aucun `useFonts`, aucun `fontFamily` dans `mobile/app` ni `mobile/src`) : elle rend en SF Pro sur iOS et Roboto sur Android. Les maquettes déclarent la pile système équivalente.
- **Icônes exactes.** Chaque glyphe est le contour extrait de `Ionicons.ttf` (la fonte que `@expo/vector-icons` embarque, 512 unités/em), reporté en `<symbol viewBox="0 0 512 512">`. Ce ne sont pas des redessins approximatifs.

`screen.png` est le rendu de la page entière à 1200 px de large (Chrome headless `--headless=new --window-size --screenshot`), pas une capture d'un seul cadre : c'est ce que font déjà les `screen.png` existants du dépôt.

### 3.2 Les deux tailles imposées, et ce que « 320 pt » veut dire ici

- **414 x 896 pt** — l'iPhone 11 du retour de testeur.
- **320 x 568 pt** — un iPhone SE 2/3 en **Display Zoom**. C'est un **choix explicite** : task-408 impose « 320 pt » sans donner la hauteur, et 320 x 568 est le gabarit 320 pt le plus contraint (hauteur la plus faible), donc le pire cas. Une direction qui tient à 320 x 568 tient à tout autre viewport de 320 pt de large.

Les cadres sont dessinés **aux dimensions logiques exactes**, avec `overflow: hidden` : ce qui ne tient pas est coupé à l'image, exactement comme sur l'appareil. La coupe *est* la mesure.

### 3.3 Le harnais de mesure (AC#7)

La convention du dépôt interdit un `<script>` dans un `code.html` livré. Les nombres sont donc obtenus en deux passes :

1. génération des quatre `code.html` sans script ;
2. copie jetable de chacun avec une sonde injectée avant `</body>`, rendue dans Chrome headless (`--dump-dom`), qui écrit un JSON dans le DOM ; le JSON est relu et réinjecté dans les légendes et les tableaux à la génération suivante. Les copies sondées sont supprimées ; elles ne sont pas versionnées.

Les six colonnes du tableau « Mesures » de chaque maquette signifient :

| Colonne | Définition exacte |
|---|---|
| **Cadre** | `getBoundingClientRect().height` du cadre, donc 896 ou 568 par construction |
| **Chrome avant contenu** | hauteur de tout ce qui précède le premier pixel de contenu : safe area, segments, titres, compteurs, indicateurs |
| **Contenu visible** | `clientHeight` de la bande de contenu — hauteur jusqu'au bas du cadre. La barre d'onglets flottante d'iOS passe **par-dessus** ses 88 derniers points |
| **Hauteur du contenu** | `scrollHeight` de la même bande : ce que le contenu mesure réellement |
| **Reste à scroller** | `scrollHeight − clientHeight` |
| **Coupé dans la page** | débordement d'un bloc qui n'est **pas** censé défiler (la fiche de D, la page de C). Une direction qui promet « un écran = une page » est fausse si ce nombre n'est pas 0 |

Les bandes verticales rouge et grise sur le bord gauche des cadres, les étiquettes de mesure et les étiquettes de geste sont **hors maquette** : elles sont dessinées en `box-shadow: inset`, donc elles ne consomment aucune hauteur et ne faussent aucune mesure.

### 3.4 Conformité au design system Amber Clarity, et les écarts nommés (AC#6)

Toutes les variables CSS des quatre maquettes sont recopiées depuis `mobile/src/constants/theme.ts`, avec un commentaire de provenance. C'est vérifiable mécaniquement, et ça a été vérifié :

- **Couleurs.** Les seules valeurs hexadécimales des quatre fichiers sont les 14 de la palette (`#ffcb05`, `#1c1b1a`, `#fcf9f6`, `#ffffff`, `#f1edea`, `#ebe7e5`, `#f7f3f0`, `#2b2d42`, `#8d99ae`, `#5c6880`, `#78776f`, `#c8c7bd`, `#fff0b3`, `#ba1a1a`) plus `rgba(255, 203, 5, 0.05)` (`primaryTint`) et `rgba(43, 45, 66, 0.04)` (`Shadows.soft`). Les deux seules autres valeurs colorimétriques du fichier, `rgba(186, 26, 26, 0.6)` et `rgba(43, 45, 66, 0.2)`, sont les bandes de mesure **hors maquette** et dérivent de `error` et de `textMain`. **Aucune palette nouvelle.**
- **Échelle typographique.** Les seules tailles de texte sont 32 / 20 / 16 / 14 / 13 px, c'est-à-dire exactement `display` / `headline` / `body` / `label` / `small`. **Aucune échelle nouvelle.**
- **Espacements, rayons, ombres, cibles tactiles** viennent de `Spacing`, `BorderRadius`, `Shadows.soft`, `TouchTarget`. La « No-Line rule » du système est respectée : les séparations sont tonales, il n'y a pas de filet de 1 px.

Les cinq écarts, nommés et justifiés :

| Écart | Où | Justification |
|---|---|---|
| **Aplats hors palette dans les vignettes de A et B** : `#ffe08a`, `#c9e4de`, `#cfe8f7`, `#d6d8f5`, `#f9d5d3` | Les covers 112x63 des lignes de A et des entrées de B | Ce sont des **images**, pas des surfaces d'interface : une couverture de média est une photo. Le fichier étant sans réseau, un aplat tient la place de la photo. C et D, qui n'utilisent pas ces aplats, montrent le **vrai repli** de l'app (`surfaceContainer` + glyphe de type), ce qui explique l'écart de teintes entre les pages |
| **Texte à 10 px** | Étiquettes de la barre d'onglets iOS, étiquettes de mesure et de geste | La barre d'onglets est dessinée par `UITabBarController` depuis task-350 : sa taille de libellé appartient à UIKit, pas à notre échelle. Les étiquettes de mesure sont hors maquette |
| **Blancs translucides `rgba(255,255,255,0.72)` et `0.86`** | Le verre de la barre d'onglets flottante, et le fond des étiquettes de mesure | Même raison : matériau système et annotations, pas des surfaces de l'app |
| **`--hairline: 0.5px`** | Séparateurs d'une liste | Ce n'est pas un token de thème mais `StyleSheet.hairlineWidth` sur un écran 2x, c'est-à-dire ce que RN dessine déjà |
| **À 320 pt, la direction C rend le titre du média en `headline` (20 pt) au lieu de `display` (32 pt)** | Cadre C à 320 x 568 | C'est un **autre palier de la même échelle**, pas une taille nouvelle. Sans quoi la promesse de C (« une page = un écran, rien à scroller dedans ») serait fausse à cette taille : la mesure « coupé dans la page » passait de 0 à 162 pt. L'écart est visible dans le HTML sous le commentaire « 320 pt (Display Zoom) : la dégradation que chaque direction assume explicitement » |

---

## 4. Direction A — « Sommaire » : le digest est une liste, le média est un écran

`mobile-design-mockups/digest_direction_a_sommaire/`

### 4.1 Parti pris sur les deux axes (AC#4)

**Un seul axe : le vertical.** Le `ScrollView horizontal pagingEnabled` de `digest.tsx:357-378` est supprimé, et avec lui tout geste horizontal dans l'onglet. Le scroll vertical est celui d'une liste, pas celui d'un article — donc il n'y a plus d'imbrication du tout : `CompletedDetailView` n'est plus monté dans l'onglet, et le Digest cesse d'hériter du chrome d'un autre écran.

### 4.2 Densité de contrôles (AC#5)

| Contrôle actuel | Devient |
|---|---|
| Segment `Quotidien` / `Hebdomadaire` | **Conservé, seul.** C'est de la navigation (il écrit `?tab=`) et le seul chemin vers l'hebdomadaire |
| Segment `Lecture` / `IA` | **Quitte l'onglet.** Il vit sur `/media/[id]`, où il est déjà implémenté et où il a du sens : on y est venu pour lire un média précis |
| 7 points de pagination | **Supprimés.** Une liste n'a pas de pages |
| Compteur `1 / 7` | **Remplacé** par « 7 médias • jeudi 18 septembre », qui nomme la **période** au lieu de rapporter la position d'un pager qui n'existe plus |

Bilan : **un** contrôle dans l'onglet, contre quatre aujourd'hui (dont deux non interactifs et un non tappable). Aucun composant nouveau : `MediaListCard` est repris tel quel, cover 112x63 comprise (dimensions validées par task-302 §6.4).

### 4.3 Mesures (AC#7)

| Cadre | Chrome avant contenu | Contenu visible | Hauteur du contenu | Reste à scroller | Coupé dans la page |
|---|---|---|---|---|---|
| **État actuel** 414x896 | 448 | 448 | 708 | 260 | 0 |
| **A** 414x896 | **202** | 694 | 952 | 258 | 0 |
| **État actuel** 320x568 | 520 | 48 | 811 | 763 | 0 |
| **A** 320x568 | **212** | 356 | 952 | 596 | 0 |

- **4 lignes de média entièrement visibles** au-dessus de la barre d'onglets à 414 pt, **2** à 320 pt (compté par la sonde : lignes dont le bas est au-dessus de `bas du cadre − 88 pt`).
- La liste de 7 médias mesure **952 pt** aux deux tailles, soit **136 pt par ligne** (calcul : 952 / 7) : les titres sont tronqués à deux lignes, donc la hauteur ne dépend pas de la largeur.
- Le chrome ne grandit que de **10 pt** entre 414 et 320 (202 → 212), parce que le titre de période passe sur deux lignes mais que la safe area haute diminue. À comparer aux **72 pt** que l'écran actuel prend dans le même passage (448 → 520).

### 4.4 Gestes, cas limites, livraison (AC#8)

Convention de comptage, la même pour les quatre directions : un balayage = un geste, un appui = un geste, le retour en arrière n'est pas compté.

- **Texte complet du n-ième média : 2 gestes.** Amener la ligne *n* à l'écran (0 geste pour les 4 premières à 414 pt, les 2 premières à 320 pt ; 1 défilement au-delà), puis 1 appui qui pousse `/media/[id]`, ouvert sur Lecture.
- **Digest vide** : l'état vide actuel, inchangé — `digest.tsx:313-339` le rend déjà.
- **Un seul média** : une liste d'une ligne. Correct, mais pauvre. C'est la faiblesse reconnue de A.
- **Livraison : OTA.** `FlatList` et `MediaListCard` sont déjà embarqués, aucune dépendance ajoutée, donc l'empreinte Expo ne bouge pas et aucun des 15 builds iOS mensuels du palier gratuit n'est consommé.

### 4.5 Ce qu'elle abandonne (AC#9)

- **La lecture sans quitter l'onglet.** Le texte se lit sur un autre écran.
- **La distinction visuelle avec l'Accueil et la Recherche**, qui utilisent la même ligne.
- **Le geste horizontal**, entièrement.

---

## 5. Direction B — « Journal continu » : tout se lit sans quitter l'onglet

`mobile-design-mockups/digest_direction_b_journal_continu/`

### 5.1 Parti pris sur les deux axes (AC#4)

**Un seul axe : le vertical**, comme A — mais un seul `ScrollView`, du haut du digest au bas du dernier média. Chaque média est une **entrée de journal** numérotée : couverture, titre, méta, Aperçu toujours visible, puis deux lignes dépliantes « Texte complet » et « Résumé IA ». Il n'y a plus de scroll imbriqué : il n'y a qu'un scroll.

### 5.2 Densité de contrôles (AC#5)

| Contrôle actuel | Devient |
|---|---|
| Segment `Quotidien` / `Hebdomadaire` | **Conservé, seul** |
| Segment `Lecture` / `IA` | **Cesse d'être un mode d'écran** et devient deux lignes dépliantes *par média*, au niveau du contenu. C'est exactement ce que Material demande : « create hierarchy within the content using techniques like typography style and open space » plutôt que des onglets sur du contenu séquentiel |
| 7 points de pagination | **Supprimés**, remplacés par une pastille ordinale « n / 7 » en tête de chaque entrée — qui, contrairement aux points, **est lue par un lecteur d'écran** (`PaginationDots` en est explicitement exclu) |
| Compteur `1 / 7` | **Supprimé** de l'en-tête : la position est portée par l'entrée qu'on est en train de lire |

Bilan : **un** contrôle d'écran, plus deux dépliants par média — dont le coût n'est payé que par celui qui veut lire.

### 5.3 Mesures (AC#7)

| Cadre | Chrome avant contenu | Contenu visible | Hauteur du contenu | Reste à scroller | Coupé dans la page |
|---|---|---|---|---|---|
| **B** 414x896 (1re entrée dépliée) | **202** | 694 | **3966** | 3272 | 0 |
| **B** 320x568 (1re entrée dépliée) | **212** | 356 | **4268** | 3912 | 0 |

C'est la mesure qui décide de B : le journal est **long par construction**, et il s'allonge encore à chaque dépliement. À 320 pt il ne se coupe pas, il s'étire (4268 pt) — c'est précisément le défaut que NN/g nomme (« too much scrolling »), assumé en échange de la promesse « rien ne quitte l'onglet ».

### 5.4 Gestes, cas limites, livraison (AC#8)

- **Texte complet du n-ième média : 2 gestes** — défiler jusqu'à l'entrée *n*, puis 1 appui sur « Texte complet », qui déplie sur place. Mais « défiler » peut demander plusieurs mouvements : il y a jusqu'à 3966 pt (414 pt) ou 4268 pt (320 pt) de journal.
- **Digest vide** : l'état vide actuel, inchangé.
- **Un seul média** : le cas le plus flatteur pour B — une entrée unique se lit comme un article. Mesuré : 784 pt de contenu, donc **90 pt à faire défiler** seulement.
- **Livraison : OTA.** `LayoutAnimation` fait partie du cœur de React Native ; aucun module natif n'est ajouté (`react-native-reanimated` n'est pas dans `mobile/package.json` et n'est pas requis).

### 5.5 Ce qu'elle abandonne (AC#9)

- **La notion de page** : plus de « n / 7 » global, seulement une pastille par entrée.
- **La garantie qu'un média tienne dans un écran.**
- **Le geste horizontal**, entièrement.

---

## 6. Direction C — « Pages pleines » : la pagination devient verticale

`mobile-design-mockups/digest_direction_c_pages_pleines/`

### 6.1 Parti pris sur les deux axes (AC#4)

**Un seul axe : le vertical, qui porte les deux rôles à la fois.** Le `pagingEnabled` passe d'`horizontal` à vertical (`ScrollView` vertical, `snapToInterval` = hauteur du viewport de page). C'est le *full-screen carousel* que Material nomme et décrit — « shows one edge-to-edge large item at a time and scrolls vertically » — et la seule de ses quatre dispositions qu'il **dispense** de l'obligation d'offrir un « Show all ». Chaque page tient dans une hauteur d'écran : il n'y a plus rien à faire défiler *dans* une page, ce que la colonne « coupé dans la page » vérifie.

### 6.2 Densité de contrôles (AC#5)

| Contrôle actuel | Devient |
|---|---|
| Segment `Quotidien` / `Hebdomadaire` | **Déplacé sur une page de garde** (page 0), qu'on traverse une fois. Conséquence : une page de média porte **zéro contrôle tappable au-dessus du contenu** |
| Segment `Lecture` / `IA` | **Deux boutons d'action en pied de page** (« Texte complet », « IA »), qui poussent `/media/[id]` sur l'onglet demandé. Ils sont *sous* le contenu, pas au-dessus |
| 7 points de pagination | **Remplacés par la barre de progression de 4 pt du quiz** (`mobile/app/artifacts/[artifactId].tsx`) : accessible (`accessibilityRole="progressbar"`), sans plafond à 7, et haute de **4 pt au lieu de 16** |
| Compteur `1 / 7` | **Déplacé dans la ligne de méta** de la page, à côté de la source et de la durée : une seule fois, au niveau où il sert |

### 6.3 Mesures (AC#7)

| Cadre | Chrome avant contenu | Contenu visible | Hauteur du contenu | Reste à scroller | Coupé dans la page |
|---|---|---|---|---|---|
| **C** page de garde 414x896 | **48** | 848 | 848 | 0 | 0 |
| **C** page de média 414x896 | **68** | 828 | 828 | 0 | 0 |
| **C** page de garde 320x568 | **20** | 548 | 548 | 0 | 0 |
| **C** page de média 320x568 | **40** | 528 | 528 | 0 | 0 |

C'est le chrome le plus faible des quatre directions, et de loin : **68 pt** à 414 pt, dont 48 de safe area système — ce qui appartient réellement à l'app tient en **20 pt** (barre de 4 pt + ses marges). À 320 pt, le chrome *diminue* (40 pt) parce que la safe area d'un SE non encoché est plus petite.

**La contrepartie, mesurée puis corrigée :** dans sa première version, la page de C débordait de **162 pt** à 320 x 568 — la promesse « une page = un écran » était donc fausse là où elle compte. La direction encode maintenant sa propre dégradation à cette taille : titre en `headline` au lieu de `display`, Aperçu ramené à 2 lignes, date retirée de la ligne de méta. La colonne « coupé dans la page » est à **0** aux deux tailles.

### 6.4 Gestes, cas limites, livraison (AC#8)

- **Texte complet du n-ième média : n + 1 gestes** — *n* balayages verticaux depuis la page de garde (la garde compte pour un), puis 1 appui sur « Texte complet ». C'est le coût le plus élevé des quatre directions, et il est linéaire.
- **Digest vide** : la page de garde porte l'état vide et il n'y a pas de page suivante. Le geste vertical ne mène nulle part, ce qui est exact.
- **Un seul média** : deux pages (la garde, puis le média). La barre de progression est pleine dès le premier écran.
- **Livraison : OTA.** Un `ScrollView` vertical `pagingEnabled` est du React Native de base ; `react-native-pager-view` n'est pas nécessaire — et n'est pas installé, donc l'éviter est aussi ce qui garde la livraison en OTA.

### 6.5 Ce qu'elle abandonne (AC#9)

- **Le survol** : on ne peut plus voir plusieurs médias d'un coup d'œil.
- **L'Aperçu complet à 320 pt**, réduit à deux lignes, et la date.
- **Le geste horizontal, et avec lui la familiarité du carrousel** : un paging vertical plein écran ressemble à un fil social, ce qui est un changement de nature que le retour du testeur ne demande pas.

---

## 7. Direction D — « Fiche unique » : on garde le carrousel, on supprime le scroll

`mobile-design-mockups/digest_direction_d_fiche_unique/`

### 7.1 Parti pris sur les deux axes (AC#4)

**Un seul axe : l'horizontal.** C'est le choix miroir de A, B et C. Le `ScrollView horizontal pagingEnabled` reste ; c'est le `ScrollView` **vertical** interne qui disparaît, la fiche devenant une `View` à hauteur contrainte. Cette direction existe pour que l'owner puisse trancher en connaissance de cause : **elle conserve le geste que le testeur a nommé en premier**, et c'est son principal risque.

### 7.2 Densité de contrôles (AC#5)

| Contrôle actuel | Devient |
|---|---|
| Segment `Quotidien` / `Hebdomadaire` | **Conservé, seul**, en haut |
| Segment `Lecture` / `IA` | **Quitte l'onglet** pour `/media/[id]`, comme en A, sous la forme de deux boutons en pied de fiche |
| 7 points de pagination | **Remplacés par la barre de progression de 4 pt du quiz**, posée à fleur du bord haut de la fiche — donc lisible comme la progression *de la fiche*, pas comme un soulignement du titre |
| Compteur `1 / 7` | **Supprimé de l'en-tête** et porté une seule fois, par la ligne de méta de la fiche |

### 7.3 Mesures (AC#7)

| Cadre | Chrome avant contenu | Contenu visible | Hauteur du contenu | Reste à scroller | Coupé dans la fiche |
|---|---|---|---|---|---|
| **D** 414x896 | **182** | 714 | 714 | 0 | 0 |
| **D** 320x568 | **192** | 376 | 376 | 0 | 0 |

D garde le chrome le plus lourd des quatre (182 pt : safe area 48 + segment 80 + titre de période 54) parce qu'elle garde l'en-tête de l'écran actuel — mais elle le divise quand même par **2,5** par rapport aux 448 pt actuels, parce que le hero du média et le segment Lecture/IA ne sont plus dedans.

**La contrepartie, mesurée puis corrigée :** la fiche débordait de **74 pt** à 320 x 568. Elle **supprime sa couverture** à cette taille, ce qui ramène le débordement à 0. Une fiche qui promet de ne pas défiler doit tenir : le nombre est vérifié, pas supposé.

### 7.4 Gestes, cas limites, livraison (AC#8)

- **Texte complet du n-ième média : n gestes** — *n − 1* balayages horizontaux, puis 1 appui sur « Texte complet ».
- **Digest vide** : le segment de période reste (c'est le seul chemin vers l'autre période) et la barre de progression disparaît, exactement comme `PaginationDots` le fait déjà à `count <= 0`.
- **Un seul média** : le cas le plus propre des quatre — pas de barre de progression, une fiche qui occupe l'écran.
- **Livraison : OTA.** Le `ScrollView` horizontal existe déjà dans `digest.tsx` ; on lui retire son contenu défilant.

### 7.5 Ce qu'elle abandonne (AC#9)

- **Tout le texte long** : il n'est plus dans l'onglet (comme A, mais sans le bénéfice du survol).
- **La couverture à 320 pt**, supprimée pour que la fiche tienne.
- **Rien du geste horizontal** — et c'est précisément ce que le testeur a nommé en premier.
- **Toute vue d'ensemble.** Des quatre directions, D est la seule à ne proposer aucun moyen de voir les 7 médias sans les balayer un à un. La lettre de l'exigence Material ne l'atteint plus — elle ne vise que les pages à défilement vertical, et D n'en a plus — mais le grief de fond (§ 2.1, approche 5) reste entier.

---

## 8. Comparaison des quatre directions (AC#9)

### 8.1 Axes et contrôles

| | Axe supprimé | Axe restant | Contrôles d'écran avant le contenu | Les 7 points | Composant nouveau |
|---|---|---|---|---|---|
| **État actuel** | aucun | horizontal **et** vertical, imbriqués | **2 segments** + 1 titre + 1 compteur + 1 rangée de points | rangée de 16 pt, plafonnée à 7, muette pour un lecteur d'écran, non tappable | — |
| **A** Sommaire | **horizontal** | vertical (liste) | **1 segment** | supprimés | aucun |
| **B** Journal continu | **horizontal** | vertical (un seul `ScrollView`) | **1 segment** | supprimés, remplacés par une pastille ordinale lue par les lecteurs d'écran | 1 ligne dépliante (`LayoutAnimation`) |
| **C** Pages pleines | **horizontal** | vertical (paginé) | **0** sur une page de média ; 1 sur la page de garde | barre de progression de 4 pt, accessible, sans plafond | 1 page de garde + reprise de la barre du quiz |
| **D** Fiche unique | **vertical** | horizontal (paginé) | **1 segment** | barre de progression de 4 pt, accessible, sans plafond | aucun (recomposition de morceaux existants) |

Les quatre directions suppriment donc l'un des deux axes — trois l'axe horizontal, une l'axe vertical — ce que l'AC#4 exigeait d'au moins une d'entre elles. Aucune ne conserve la cohabitation.

### 8.2 Hauteur volée au contenu, aux deux tailles (AC#7)

Chrome mesuré avant le premier pixel de contenu ; le pourcentage est un **calcul** (chrome / hauteur du cadre).

| | 414 x 896 pt | part de l'écran | 320 x 568 pt | part de l'écran |
|---|---|---|---|---|
| **État actuel** | 448 pt | **50 %** | 520 pt | **92 %** |
| **A** | 202 pt | 23 % | 212 pt | 37 % |
| **B** | 202 pt | 23 % | 212 pt | 37 % |
| **C** (page de média) | **68 pt** | **8 %** | **40 pt** | **7 %** |
| **D** | 182 pt | 20 % | 192 pt | 34 % |

Et la colonne qui départage les promesses — « coupé dans une page qui prétend ne pas défiler » — vaut **0 partout, aux deux tailles**, après les corrections décrites aux §6.3 et §7.3. C'est la seule vérification qui ne pouvait pas être faite à l'œil.

### 8.3 Gestes, cas limites, coût de livraison (AC#8)

| | Texte complet du n-ième média | Digest vide | Un seul média | Livraison |
|---|---|---|---|---|
| **État actuel** | **n** gestes : n − 1 balayages horizontaux puis au moins 1 défilement vertical (260 pt à 414 pt, **763 pt à 320 pt**) — Lecture étant l'onglet par défaut, aucun appui n'est nécessaire, mais à 320 pt le défilement est obligatoire dès le premier mot d'Aperçu | état vide dédié, sans issue vers une autre période — volontaire | un média, zéro point affiché (`count <= 0` est le seul cas masqué ; à 1 média un point unique s'affiche) | — |
| **A** | **2** (0 défilement pour les 4 premiers à 414 pt, les 2 premiers à 320 pt) | inchangé | liste d'une ligne : pauvre | **OTA** |
| **B** | **2**, mais jusqu'à 3966 pt (414) / 4268 pt (320) de journal à parcourir | inchangé | le meilleur cas : 90 pt à défiler | **OTA** (`LayoutAnimation`, cœur de RN) |
| **C** | **n + 1** | la page de garde porte l'état vide, sans page suivante | 2 pages, barre pleine dès la première | **OTA** (`ScrollView` vertical `pagingEnabled`, pas de `react-native-pager-view`) |
| **D** | **n** | segment conservé, barre masquée | le meilleur cas : une fiche plein écran, sans barre | **OTA** |

Aucune des quatre directions ne déplace l'empreinte Expo : `mobile/package.json` ne contient ni `react-native-reanimated`, ni `react-native-gesture-handler`, ni `react-native-pager-view`, ni `@shopify/flash-list`, et **aucune direction n'en a besoin**. Les quatre partent donc en **mise à jour OTA gratuite** et ne consomment aucun des 15 builds iOS mensuels du palier gratuit EAS. C'est un critère qui ne discrimine pas — il a été vérifié pour qu'il ne discrimine pas par accident.

### 8.4 Ce que chacune abandonne par rapport à l'écran actuel (AC#9)

| | Abandonne |
|---|---|
| **A** | la lecture dans l'onglet ; la distinction visuelle avec l'Accueil et la Recherche ; le geste horizontal |
| **B** | la notion de page ; la garantie qu'un média tienne dans un écran ; le geste horizontal |
| **C** | le survol de plusieurs médias ; l'Aperçu complet et la date à 320 pt ; le geste horizontal et la familiarité du carrousel |
| **D** | tout le texte long dans l'onglet ; la couverture à 320 pt ; **rien du geste horizontal**, qui est le grief d'origine |

Un gain commun aux quatre, qui n'apparaît dans aucune maquette : **`CompletedDetailView` n'est plus monté en trois exemplaires**. Aujourd'hui `MOUNT_RADIUS = 1` garde trois pages vivantes, et l'en-tête du fichier le dit — « Three pages, so three sets of the artifact/translation/preview polls `CompletedDetailView` runs ». A, C et D n'en montent aucune ; B n'en monte aucune non plus, puisqu'elle recompose l'Aperçu et le texte à partir de `SourcePreview` et `TranscriptReader`.

### 8.5 Pourquoi A, et les quatre objections

**A gagne sur la combinaison « chrome divisé par plus de deux, 2 gestes, zéro composant nouveau, et l'exigence d'accessibilité de Material enfin satisfaite ».** C a un chrome plus faible, mais paie *n + 1* gestes et perd le survol ; B égale A sur les gestes mais crée un écran de 4000 pt ; D est la seule à garder ce dont le testeur s'est plaint.

**Objection 1 — « A transforme le Digest en un deuxième Accueil. »** C'est le vrai risque, et il est de présentation, non de fonction. Ce que le Digest apporte en propre n'est pas la forme de ses lignes : c'est le **cadrage** — une période nommée, une sélection figée à la capture, un ordre du plus ancien au plus récent, et une notification qui y renvoie. L'en-tête de A le dit explicitement (« 7 médias • jeudi 18 septembre ») là où l'écran actuel affiche « 1 / 7 », qui ne parle que de son propre pager. Et si l'owner juge la ressemblance inacceptable, c'est B qu'il faut prendre — pas D.

**Objection 2 — « On sort de l'onglet pour lire. »** Le compte de gestes est le même que celui de B (2), la destination existe déjà, elle porte la flèche de retour et le segment Lecture/IA à l'endroit où ils ont du sens, et elle supprime les trois jeux de polls simultanés. Ce qui se perd est la sensation de « tout est là » — qui est aujourd'hui payée 448 pt de chrome.

**Objection 3 — « C a huit fois moins de chrome, pourquoi pas C ? »** Parce que le coût se déplace du haut de l'écran vers le nombre de gestes : *n + 1* pour atteindre le n-ième média, sans aucun moyen de sauter. La mise en garde de NN/g sur les carrousels (« people often immediately scroll past […] any frame other than the first ») porte sur des carrousels de page d'accueil web et non sur un lecteur paginé : elle ne condamne pas C, mais elle interdit de **compter** sur le fait que les 7 médias soient vus. C reste la direction à retenir si l'owner veut un onglet contemplatif plutôt qu'un onglet de triage — c'est un choix de nature, et il doit être fait comme tel, pas déduit d'une mesure de chrome.

**Objection 4 — « D est la moins risquée, elle change le moins. »** Elle change le moins de code et le plus de promesse : elle conserve le carrousel horizontal, c'est-à-dire l'élément que le retour de testeur nomme en premier, et elle retire du même coup tout le texte long de l'onglet. C'est aussi, des quatre, la seule qui ne laisse aucun moyen de voir les 7 médias sans les balayer un à un (§ 7.5). Elle est incluse pour que ce choix puisse être fait sciemment, pas par omission.

**Et l'approche 7 (bascule Review/Scroll de Readwise) ?** Écartée volontairement : elle ajoute **un contrôle de plus** à un écran dont le grief est le nombre de contrôles, et la documentation de Readwise la décrit pour le web, pas pour le mobile. Si l'owner y tient, elle se greffe sur A (un bouton d'en-tête qui bascule vers B) — mais elle demande alors d'implémenter **deux** directions.

---

## 9. Chaque nombre, et d'où il vient (AC#10)

| Nombre | Statut | Provenance ou méthode |
|---|---|---|
| 448 / 520 pt de chrome (état actuel), 202 / 212 (A et B), 68 / 40 (C), 182 / 192 (D) ; 48 / 20 / 80 / 74 / 112 / 16 / 230 / 292 pt du détail du §1.2 | **mesuré** | `getBoundingClientRect().height` sur les cadres rendus par Chrome headless aux dimensions logiques exactes (§3.3) |
| 694 / 356 / 828 / 528 / 714 / 376 / 848 / 548 pt de contenu visible | **mesuré** | `clientHeight` de la bande de contenu |
| 708 / 811 / 952 / 3966 / 4268 / 784 pt de hauteur de contenu, et les « reste à scroller » 260 / 763 / 258 / 596 / 3272 / 3912 / 90 | **mesuré** | `scrollHeight`, et `scrollHeight − clientHeight` |
| « coupé dans la page » = 0 partout ; les valeurs corrigées 162 → 0 (C à 320) et 74 → 0 (D à 320) | **mesuré** | débordement d'un bloc non défilant, mesuré avant et après la dégradation encodée (§6.3, §7.3) |
| 4 lignes visibles à 414 pt, 2 à 320 pt (direction A) | **mesuré** | comptage par la sonde des lignes dont le bas est au-dessus de `bas du cadre − 88 pt` |
| 88 pt de barre d'onglets | **lu dans le code** | `TAB_BAR_CLEARANCE = TouchTarget.large + Spacing.lg` = 64 + 24 (`digest.tsx:113-114`, `theme.ts`) |
| 16 pt de rangée de points, 8 pt de diamètre, plafond de 7 | **lu dans le code** | `PaginationDots.tsx` : `height: Spacing.md`, `DOT_SIZE = 8`, `MAX_VISIBLE = 7` |
| 112 x 63 pt de couverture de ligne | **lu dans le code** | `MediaListCard.tsx` : `COVER_WIDTH`, `COVER_HEIGHT` (validés par task-302 §6.4) |
| **48 pt** de safe area haute à 414, **20 pt** à 320 | **hypothèse** | Aucune source d'appareil n'a été utilisée : la maquette prend `Spacing.xxl` (48) comme tenant-lieu de l'encart haut d'un iPhone encoché, et 20 pt pour un SE non encoché. Conséquence si la valeur réelle diffère de quelques points : **toutes** les colonnes 414 pt (état actuel et les quatre directions) se décalent de la même quantité, donc aucun écart ni aucun classement de ce document ne change. Le seul chiffre sensible est le « il ne reste rien à 320 pt » du §1.2, qui resterait vrai tant que l'encart dépasse 0 |
| Zone de lecture réelle : **360 pt** à 414, **négative** à 320 | **calcul** | `contenu visible − 88`, où 88 est retiré de la hauteur du pager par `pagerContainer.paddingBottom` (`digest.tsx:587-591`). À 320 : `48 − 88 < 0` |
| Parts d'écran : 50 %, 92 %, 23 %, 37 %, 8 %, 7 %, 20 %, 34 % | **calcul** | `chrome / hauteur du cadre`, arrondi à l'entier |
| 136 pt par ligne de A | **calcul** | `952 / 7` |
| Réductions « −55 % », « −59 % », « divisé par 2,5 » | **calcul** | `202 / 448`, `212 / 520`, `448 / 182` |
| Nombres de gestes (2, 2, n + 1, n, n) | **compté sur les cadres** | convention déclarée au §4.4 : un balayage = un geste, un appui = un geste, le retour n'est pas compté. Vérifiable sur les maquettes |
| 1200 x 4698 / 4633 / 5552 / 4738 px | **mesuré** | `document.documentElement.scrollHeight` à un viewport de 1200 px, puis rendu à cette hauteur |
| 15 builds iOS par mois (palier gratuit EAS) | **donnée du projet** | `.github/workflows/mobile-ota-or-build.yml:17-18` : « EAS Free gives 15 Android + 15 iOS builds per month, 1 concurrency slot » |
| 1102 lignes de `CompletedDetailView.tsx`, 619 de `digest.tsx` | **compté** | `wc -l` sur l'arbre courant |

Aucun autre nombre n'apparaît dans ce document. En particulier, **aucun taux d'engagement, aucun temps de tâche et aucun pourcentage d'utilisateurs n'est cité** : aucune source consultée n'en fournit pour un digest quotidien mobile, et il n'en a pas été inventé.

---

## 10. Ce qui n'a pas pu être vérifié depuis cet environnement

1. **Rien n'a été rendu par React Native.** Les cadres sont du HTML dans Chrome, avec les valeurs des styles RN recopiées. Les métriques de SF Pro, les règles de césure d'iOS et les encarts réels d'un appareil peuvent décaler quelques points. Ce que la méthode garantit est la **comparabilité** : l'état actuel et les quatre directions sont rendus par le même moteur, avec les mêmes tokens, aux mêmes dimensions.
2. **Dynamic Type n'a pas été exploré.** task-408 impose deux *tailles d'écran*, pas deux échelles de texte. Une direction peut tenir à 320 pt et casser au troisième cran de gros caractères — c'est un point à vérifier sur appareil, et il vaut d'abord pour C et D, qui promettent « une page = un écran ».
3. **Android n'est pas mesuré.** Les cadres modélisent la capsule flottante d'iOS et sa réserve de 88 pt. Sur Android, `TAB_BAR_CLEARANCE` vaut `Spacing.lg` = 24 pt (`digest.tsx:113-114`) : les quatre directions y gagnent **64 pt** de contenu. Le classement n'en dépend pas.
4. **Ni VoiceOver ni TalkBack n'ont été essayés.** Ce qui est affirmé sur l'accessibilité vient du code lu (`PaginationDots` est explicitement retiré de l'arbre, la barre du quiz porte `accessibilityRole="progressbar"`) et des guidelines citées, pas d'un essai.
5. **Readwise Reader a été lu en documentation, pas observé dans l'app.** Aucun compte n'a été utilisé. Les citations du §2 décrivent donc ce que l'éditeur documente, ce qui suffit pour une approche mais pas pour une mesure.
6. **Apple News et Google Discover n'ont pas été cités.** Les pages d'aide correspondantes étaient soit indisponibles, soit sans description utile de la navigation ; les exigences de l'AC#2 (au moins 5 approches, chacune sourcée) sont atteintes sans elles, et il valait mieux ne rien citer que citer une page inaccessible.
7. **La validation visuelle sur appareil reste à faire par l'owner**, sur le prochain build, comme la description de task-408 le note.

---

## 11. Sources

Toutes consultées le **2026-09-21**.

| Source | URL | Ce qui en a été tiré |
|---|---|---|
| Apple HIG — Scroll views | https://developer.apple.com/design/human-interface-guidelines/scroll-views | L'imbrication orthogonale est permise ; la pagination page-par-page est recommandée quand le contenu s'y prête |
| Apple HIG — Page controls | https://developer.apple.com/design/human-interface-guidelines/page-controls | Un page control se centre **en bas** ; au-delà d'environ 10 points ils sont illisibles ; ils représentent une liste ordonnée de pages |
| Apple HIG — Segmented controls | https://developer.apple.com/design/human-interface-guidelines/segmented-controls | Pas plus de cinq segments environ sur iPhone |
| Material 3 — Carousel guidelines | https://m3.material.io/components/carousel/guidelines | Les quatre dispositions, dont *full-screen* (« scrolls vertically ») ; l'obligation d'offrir une vue verticale de tous les éléments, et la dispense accordée au plein écran |
| Material 3 — Tabs guidelines | https://m3.material.io/components/tabs/guidelines | Onglets secondaires sous les primaires ; des onglets groupent du contenu, ils ne font pas défiler du séquentiel ; pas plus de quatre |
| Material 3 — Lists guidelines | https://m3.material.io/components/lists/guidelines | Une liste est un index vertical continu, optimisé pour la compréhension, et doit être facile à balayer du regard |
| NN/g — Carousel Usability (Kara Pernice, 2013-09-14, révisé 2026-08-07) | https://www.nngroup.com/articles/designing-effective-carousels/ | Le contenu au-delà de la première vue est souvent manqué |
| NN/g — Accordions on Mobile (Raluca Budiu, 2015-05-31) | https://www.nngroup.com/articles/mobile-accordions/ | Les accordéons donnent la vue d'ensemble avant le détail, mais provoquent désorientation et défilement excessif |
| Readwise Reader — Daily Digest (FAQ) | https://docs.readwise.io/reader/docs/faqs/daily-digest | Le digest quotidien de l'implémentation de référence est un **défilement**, placé en haut de l'accueil |
| Readwise — Reviewing highlights (FAQ) | https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights | La bascule Review Mode (un à la fois) / Scroll Mode (tout sur une page), sur le web |

Sources internes au dépôt : `mobile/app/(tabs)/digest.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/src/components/PaginationDots.tsx`, `mobile/src/components/ScreenTabs.tsx`, `mobile/src/components/CompletedDetailView.tsx`, `mobile/src/components/MediaListCard.tsx`, `mobile/src/components/SourcePreview.tsx`, `mobile/app/artifacts/[artifactId].tsx`, `mobile/src/constants/theme.ts`, `.github/workflows/mobile-ota-or-build.yml`, `mobile-design-mockups/my_design_system/DESIGN.md`, `mobile-design-mockups/notebooklm-reference/README.md`.

---

## 12. Ce que task-409 aurait à faire si l'owner retient A

Indicatif : l'implémenteur doit lire la décision de l'owner ci-dessus, pas cette liste.

- Dans `mobile/app/(tabs)/digest.tsx` : supprimer le `ScrollView horizontal pagingEnabled`, `PaginationDots`, `MOUNT_RADIUS`, `handleScroll`, `activeIndex`, `positionLabel` / `positionA11yLabel`, le sous-composant `DigestPage` et le montage de `CompletedDetailView`. Le fichier perd sa section « The gestures » et sa section « What gets mounted » — l'une et l'autre n'existent que pour le pager.
- Rendre une liste de `MediaListCard` poussant `/media/[id]`, avec la réserve basse de `TAB_BAR_CLEARANCE` sur le `contentContainerStyle` (et non sur la hauteur du conteneur, contrairement à aujourd'hui).
- Remplacer le compteur `1 / 7` par une ligne de période (« N médias • date ») : deux clés de catalogue à ajouter dans les onze fichiers de `mobile/src/i18n/`, et `digest.position` / `digest.positionA11y` à supprimer si plus personne ne les lit.
- Ne **pas** toucher au segment de période : il écrit `?tab=`, dont dépend l'ouverture par notification (task-369).
- Laisser l'état vide tel quel.
- **Supprimer `showChrome` de `CompletedDetailView`** dans le même passage. Vérifié : `digest.tsx:441` est le **seul** appelant qui le passe à `false` dans tout `mobile/`, donc la branche sans chrome et le `DetailContainer` qui la sert deviennent du code mort. Rien n'est publié en store, il n'y a donc aucune raison de la garder « au cas où ».
- Rien de tout cela ne déplace le fingerprint Expo : la livraison est une mise à jour OTA.
