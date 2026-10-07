---
owner_decision: pending   # pending | ok | abandoned | redo | more
---

# Benchmark : six directions d'intégration du chatbot dans l'UI de l'app

## Owner Validation

**Decision**: _(à remplir par l'owner après relecture — texte libre décrivant la décision finale :
accept recommandation X, reject parce que Y, accept with modifications Z, OU, si redo, les
consignes précises de correction à intégrer au prochain passage)_
**Validated at**: _(date ISO à remplir par l'owner)_

---

## Recommendation

**Direction retenue : D — « Une feuille invocable de partout », avec l'entrée contextuelle de la
direction E2 (appui long sur un paragraphe) greffée dessus.**

**Repli : C — « Un cinquième onglet principal ».**

Trois faits mesurés portent cette recommandation, et aucun des trois ne dépend de l'architecture de
task-430 ni de la faisabilité de la portée bibliothèque.

1. **D est la seule des six directions qui ne modifie aucune des trois structures de navigation
   existantes.** La barre native de `mobile/app/(tabs)/_layout.tsx` garde ses quatre
   `NativeTabs.Trigger` ; `ScreenTabs` garde ses deux onglets sur un média comme sur un dossier ;
   `ArtifactsPanel` — partagée *verbatim* entre les deux portées — n'est pas touchée. Les cinq
   autres directions paient au moins l'une de ces trois structures : A paie `ArtifactsPanel` pour
   les deux portées à la fois, B paie `ScreenTabs` **et** un débordement mesuré dans la barre
   repliée (36 pt de titre à 320 pt), C et F paient la barre d'onglets, E ne paie rien mais ne sert
   qu'une portée sur trois.
2. **C'est aussi la direction dont la dégradation est la moins coûteuse si la portée bibliothèque
   s'avère infaisable** : l'entrée globale est un bouton de 44 pt dans l'en-tête de la Librairie,
   et son absence ne laisse ni destination vide, ni onglet grisé, ni promesse non tenue. La
   direction C, elle, doit garder un onglet qu'Apple interdit de masquer ou de griser
   (« *Don't disable or hide tab bar buttons, even when their content is unavailable* »), et la
   direction F doit changer la promesse écrite dans son champ permanent.
3. **La pilule réduite ramène à un seul tapotement le retour à une conversation en cours**, et
   c'est ce qui rend tolérables les deux régimes d'attente que ce benchmark doit servir sans en
   choisir un : 5 à 15 s pendant lesquelles on peut relire le texte, ou un flux qu'on laisse
   s'écrire pendant qu'on fait autre chose. Aucune autre direction ne descend sous deux
   tapotements, et les directions A, B et E perdent le fil dès qu'on quitte la page.

**Ce que la greffe de E2 corrige, et pourquoi elle est nécessaire.** La faiblesse de D est sa
découvrabilité : une entrée dans un menu `…` ne se voit pas. E2 — un appui long sur un paragraphe
du lecteur, qui ouvre la même feuille avec le passage joint — met le point d'entrée dans le
contenu, là où la question naît, et ne coûte presque rien : `TranscriptReader` rend déjà chaque
paragraphe comme un `<Text selectable>` distinct, il suffit de l'envelopper dans un `Pressable`.
C'est aussi le geste que Readwise Reader documente sur mobile et que YouTube a posé sous son
lecteur. **E1 — l'ajout d'une entrée au menu de sélection natif — est écarté** : React Native
n'expose aucun moyen de le faire depuis un `Text`, et le faire demanderait de rendre le transcript
dans un `TextInput` en lecture seule, donc de réécrire `TranscriptReader`.

**Ce que le repli C achète, et ce qu'il coûte.** Si l'owner juge la découvrabilité décisive, ou
veut que le chat soit un **lieu** nommé du produit plutôt qu'un geste, C est le bon choix : c'est
la direction la moins chère à construire, la plus simple côté clavier, la meilleure en
accessibilité (une destination native hérite gratuitement du rôle, de l'état sélectionné, du
Dynamic Type et du retour au sommet), et la seule qui offre un chat global sans détour. Son prix
est une destination permanente **au maximum exact autorisé par Material** (« *three to five
destinations* », « *Avoid putting more than five navigation items in a navigation bar* ») et une
marge de 12,8 pt par item à 320 pt de large, que le Dynamic Type mange. La variante qui évince
`digest` est dessinée, avec son chemin de remplacement (une carte « Votre Digest du jour » en tête
d'Accueil, qui pousse la même route).

**Les trois directions écartées, et la raison de chacune.**

- **A (dans l'onglet IA)** — elle modifie `ArtifactsPanel`, partagée verbatim, donc **les deux
  portées en une fois**, et elle réouvre la règle que le commentaire de ce fichier pose
  explicitement (« *there is deliberately no prop per visual difference — a knob would just let the
  two callers drift again* »). Et c'est la pire configuration de clavier des six : un composeur
  dans le `Animated.ScrollView` d'une page qui est, dans le Digest, un enfant d'un carrousel
  horizontal.
- **B (un troisième onglet)** — deux débordements mesurés (libellé tronqué aux deux tailles, titre
  de la barre repliée à 36 pt à 320 pt), une évolution de la primitive partagée `ScreenTabs`, une
  restructuration de `CompletedDetailView` pour que l'onglet vive **à côté** du `ScrollView` et non
  dedans — et, au bout de tout ça, toujours **aucune** portée bibliothèque.
- **F (composeur persistant)** — le composant existe déjà (`NativeTabs.BottomAccessory` dans
  l'`expo-router` installé), mais il est `@platform iOS 26+` : le chemin de rendu principal ne
  couvre qu'une partie du parc, et le repli JS devient le rendu réel sur Android et sur iOS 18.
  Deux implémentations d'une même barre, posées sur une API en alpha, pour une invitation
  permanente à utiliser une feature dont l'usage n'est pas mesuré. **À reconsidérer plus tard** :
  c'est la plus belle des six, et elle sera la bonne le jour où le chat aura un usage établi et où
  `NativeTabs` sera stable.

---

## 0. Ce que ce benchmark ne tranche pas, et pourquoi il peut tourner maintenant

Trois indépendances, posées avant tout le reste parce qu'elles conditionnent la validité de la
recommandation.

**Indépendant de l'architecture.** Le benchmark `docs/research/task-430-chatbot-architecture/README.md`
porte `owner_decision: more` et attend un complément : on ne sait pas si la réponse arrivera en flux
ou d'un bloc. Ce benchmark-ci ne suppose **ni l'un ni l'autre**. Chaque direction dessine son
attente **dans les deux régimes** — texte qui s'écrit token par token avec un bouton d'arrêt, et
pilule d'attente nommée pendant 5 à 15 s — et la comparaison du §5 ne note aucune direction sur le
transport. Le seul endroit où le régime change quelque chose est le §5.2 (coût de retour à une
conversation en cours), et il le change **dans le même sens pour les six** : un régime bloc rend la
pilule réduite plus précieuse, un régime flux la rend indispensable.

**Indépendant de la portée bibliothèque.** Sa faisabilité technique n'est pas établie : task-430
§13.1 la nomme comme un benchmark distinct et mesure que le corpus entier de `-dev` vaut 2,5 fois
la fenêtre d'entrée du modèle. Les trois directions qui proposent un chat global (C, D, F) disent
**et dessinent** ce qu'elles deviennent sans lui ; les trois autres (A, B, E) déclarent ne pas la
servir et disent pourquoi.

**Indépendant d'un plafond de saisie.** Le compteur dessiné dans les six maquettes s'arrête à
1 000 caractères. C'est une **valeur candidate** proposée par task-430 §9.4, pas une décision de
l'owner. Ce que les maquettes établissent, c'est qu'un composeur de question libre a besoin d'un
compteur et d'un comportement au-delà du plafond ; **lequel** est un paramètre.

**Lecture restreinte, déclarée.** Du benchmark task-427, seule la section §9 (le tableau des cinq
concurrents directs et leur modèle d'interaction) a été lue, comme matière produit. Ses conclusions
d'architecture ne lient pas ce benchmark et n'y sont pas reprises.

---

## 1. Inventaire de la navigation actuelle

Fichiers lus dans `mobile/` pour l'inventaire et pour les tokens. **Aucun fichier de `mobile/` ni
de `media_summarizer/` n'a été modifié.**

### 1.1 La barre d'onglets principale : quatre destinations, et c'est une barre native

`mobile/app/(tabs)/_layout.tsx` déclare **quatre** `NativeTabs.Trigger`, pas trois :

| Nom de route | Libellé (clé i18n) | SF Symbol | Ionicon | Lignes |
|---|---|---|---|---|
| `inbox` | `tabs.home` → « Accueil » | `tray` | `file-tray-outline` | 98-109 |
| `search` | `tabs.search` → « Recherche » | `books.vertical` | `library-outline` | 118-128 |
| `digest` | `tabs.digest` → « Digest » | `sparkles` | `sparkles-outline` | 130-141 |
| `account` | `tabs.account` → « Compte » | `person.crop.circle` | `person-outline` | 143-154 |

Ce que cette barre contraint, et qui est écrit dans le fichier :

- **Elle n'est pas dessinée par nous.** `NativeTabs` passe les quatre items à
  `UITabBarController` sur iOS et à la barre Material sur Android (`:30-36`). Sous Liquid Glass,
  « *the background stops being ours to set* » : `backgroundColor`, `blurEffect`, `shadowColor` et
  `disableTransparentOnScrollEdge` ne s'appliquent qu'à iOS 18 et antérieurs, et aucun n'est passé
  (`:38-44`). Une direction qui voudrait teinter ou redessiner la barre n'en a donc **pas** le
  moyen.
- **Deux couleurs, et seulement deux** : `tintColor` pour l'item sélectionné,
  `iconColor: { default, selected }` (`:82-87`).
- **`minimizeBehavior="never"`**, avec une raison écrite : « *this is an app people switch tabs in
  rather than read in one long scroll — a bar that minimizes on scroll would spend the gesture
  hiding the way out of the screen* » (`:88-93`). C'est la décision que la direction F demande de
  rouvrir.
- **Pas de `role="search"`**, délibérément (`:108-116`) : iOS 26 sort un onglet de rôle « search »
  vers le bord de fuite, et le rôle a un bogue de badge ouvert (expo/expo#41573).
- **`NativeTabs` est en alpha**, API « *subject to change* », avec deux bogues amont nommés et non
  poursuivis : expo/expo#44029 (couleurs de `labelStyle` non appliquées sur iOS, raison pour
  laquelle les libellés prennent leur couleur de `tintColor`) et expo/expo#39930 (teinte d'icône
  non rafraîchie sur iOS 26) (`:45-52`).

### 1.2 La page média : un segment de deux onglets, et son repli

`mobile/src/components/CompletedDetailView.tsx` déclare
`type MediaDetailTabKey = "reader" | "ai"` et `MEDIA_DETAIL_TABS` (`:118-129`) :

- `reader` — `media.tab.reader` → « Lecture », glyphe `book-outline` ;
- `ai` — `media.tab.ai` → « IA », glyphe `sparkles-outline`.

Le segment est rendu **deux fois** dans la page, et c'est la contrainte structurante :

1. **déplié**, dans le flux du `Animated.ScrollView`, enveloppé dans `styles.tabsBar`
   (`paddingHorizontal: Spacing.lg` = 24, `paddingVertical: Spacing.md` = 16) (`:1294-1302`,
   `:1409-1412`) ;
2. **replié en glyphes** dans `MediaReaderBar`, qui apparaît en fondu dès que le segment déplié
   passe sous le bord haut (`:1248-1256`).

`MediaReaderBar` est une couche fixe de `MEDIA_READER_BAR_HEIGHT = TouchTarget.large` = **64 pt**
sous l'encoche, avec une rangée de `paddingHorizontal: Spacing.md` = 16 et `gap: Spacing.sm` = 8
entre quatre enfants : un bouton retour de `MEDIA_HEADER_BUTTON_SIZE` = **44 pt**, une vignette de
`Spacing.xl` = **32 pt**, le titre en `flex: 1`, et le segment replié. **Le titre est le seul
élément de la rangée autorisé à se comprimer** : « *a long title costs an ellipsis here, never a
collision with the segment* » (`MediaReaderBar.tsx:206-214`).

Le segment replié de `ScreenTabs` en mode `iconOnly` mesure `4 + 48n + 4` pt. D'où la mesure qui
décide du sort de la direction B :

| Onglets | Segment replié | Chrome fixe de la rangée | Titre à 414 pt | Titre à 320 pt |
|---|---|---|---|---|
| 2 (aujourd'hui) | 104 pt | 236 pt | **178 pt** | **84 pt** |
| 3 | 152 pt | 284 pt | **130 pt** | **36 pt** |

Chrome fixe = 16 + 44 + 8 + 32 + 8 + 8 + segment + 16.

### 1.3 La page dossier : deux onglets, le même vocabulaire

`mobile/app/media/folders/[id].tsx` déclare `type FolderTabKey = "sources" | "ai"` et
`FOLDER_TABS` (`:110-123`) :

- `sources` — `folder.tab.sources` → « Sources », glyphe `documents-outline` ;
- `ai` — `folder.tab.ai` → « IA », glyphe `sparkles-outline`.

Le segment n'est rendu **qu'une fois**, dans `styles.tabsContainer`
(`paddingHorizontal: Spacing.lg` = 24, `paddingBottom: Spacing.md` = 16) (`:447-454`, `:868-871`).
**Un dossier n'a pas de `MediaReaderBar`** : le débordement du §1.2 ne le concerne pas.

### 1.4 `ScreenTabs`, la primitive partagée — et une correction à l'énoncé

`mobile/src/components/ScreenTabs.tsx` a **trois** appelants, pas quatre :

| Appelant | Usage |
|---|---|
| `mobile/src/components/CompletedDetailView.tsx:1296` | « Lecture / IA », déplié |
| `mobile/src/components/MediaReaderBar.tsx:135` | le même segment, `iconOnly` |
| `mobile/app/media/folders/[id].tsx:448` | « Sources / IA » |

La quatrième occurrence, `mobile/app/(tabs)/search.tsx:691`, est une **mention dans un commentaire
qui explique pourquoi la primitive a été écartée** sur cet écran : « *Chosen over `ScreenTabs`, the
other shape the design system offers, for two reasons. First, the two halves come from two
independent requests, and the requirement is that a failure of one leaves the other usable &hellip;
Second, a segmented control would be a second bar of chrome directly under the floating search
pill* » (`search.tsx:686-701`). **La Librairie n'a donc pas de segment**, et c'est la raison pour
laquelle aucune direction en onglet intra-écran ne peut y loger un chat global.

**Ce qu'un troisième onglet coûte à la primitive.** Elle est générique sur le type de clé, chaque
onglet est `flex: 1`, le libellé est `flexShrink: 1` avec `numberOfLines={1}`, et chaque onglet
porte `minHeight: TouchTarget.minimum` = 48 pt. **Elle tient donc à trois sans aucune refonte.** Ce
qu'elle ne sait pas faire, c'est raccourcir un libellé selon la largeur : elle prend une `labelKey`
par onglet, résolue au rendu — et c'est délibéré, « *because callers declare their tabs as module
constants, and a string resolved at import time would keep the language the app was launched in* »
(`:36-41`). Mesure du besoin :

| Onglets | Pilule (gouttière 24) | Par onglet | Libellé disponible | « Discussion » à 14 pt |
|---|---|---|---|---|
| 2 à 414 pt | 366 pt | 179 pt | 135 pt | tient |
| 3 à 414 pt | 366 pt | 119 pt | **61 pt** | ~74 pt → tronqué |
| 2 à 320 pt | 272 pt | 136 pt | 92 pt | tient |
| 3 à 320 pt | 272 pt | 88 pt | **30 pt** | tronqué net |

Libellé disponible = largeur par onglet − 2 × `Spacing.md` − glyphe 18 − `Spacing.sm`.

### 1.5 `ArtifactsPanel`, partagée verbatim entre les deux portées

`mobile/src/components/ArtifactsPanel.tsx` rend **tout** l'onglet IA : le titre « Générer », les
cinq pastilles `ARTIFACT_TILES` (`summary_short`, `summary_detailed`, `notes`, `flashcards`,
`quiz` — `ArtifactTile.tsx:73-100`), le bandeau de refus, le titre « Généré » et l'historique. Elle
est montée par `CompletedDetailView.tsx:1327` (portée média, `showSourceCount={false}`) et par
`folders/[id].tsx:562` (portée dossier, dans `AiTab`).

Le commentaire du fichier pose une règle qui conditionne la direction A : « *this component owns
**all** of the layout and every presentational state, and there is deliberately **no prop per
visual difference** — a knob would just let the two callers drift again inside here* » (`:1-23`).
Et `AiTab` le redit : « *Everything visible is `ArtifactsPanel`, shared verbatim with the AI tab of
a media item so the two cannot drift apart again* » (`folders/[id].tsx:560-566`).

**Conséquence** : une direction qui loge le chat dans `ArtifactsPanel` le pose sur **les deux
portées en une seule modification**. C'est un bénéfice (la portée dossier est gratuite) et un
risque (livrer l'une sans l'autre demanderait exactement le drapeau que ce commentaire interdit).

### 1.6 Les écrans qui montent `CompletedDetailView` : deux, et le second est un carrousel

| Écran | Montage |
|---|---|
| `mobile/app/media/[id].tsx:206` | la route d'un média |
| `mobile/app/(tabs)/digest/[period].tsx:477` | **une page du carrousel du Digest** |

Le constat de task-410 est inscrit dans le composant : « *it reads no route parameter and holds no
polling of its own, so the same component renders the `/media/[id]` route and a page of the Digest
carousel &hellip; a change to the media page lands in both by construction, chrome included* »
(`CompletedDetailView.tsx:1-16`). Le Digest est un **pager horizontal** — « *one full media page
per swipe* » (`digest/[period].tsx:1-3`) — et le `ScrollView` de la page porte
`directionalLockEnabled` précisément pour cohabiter avec lui (`:1274-1280`).

**Conséquence** : tout onglet, bloc ou composeur ajouté à la page média apparaît aussi dans le
Digest, **à l'intérieur d'un pager horizontal**, et y ouvre le clavier.

### 1.7 Ce que l'app n'a pas : aucun composeur de texte libre multiligne

Deux champs de saisie existent, et aucun n'est multiligne :

| Composant | Nature |
|---|---|
| `mobile/src/components/UrlEntryDialog.tsx` | une URL, `multiline={false}` (`:115`), `keyboardType="url"`, `returnKeyType="go"`, `clearButtonMode="while-editing"`, dans un `KeyboardAvoidingView` (`:93`) et une carte centrée |
| `mobile/src/components/RenameDialog.tsx` | un nom, `maxLength` passé par l'appelant (`:130`), `returnKeyType="done"`, même carte centrée |

Les deux sont des **cartes centrées**, et le commentaire d'`UrlEntryDialog` dit pourquoi :
« *`Alert.prompt` is iOS-only — it does not exist on Android — so a dialog of our own is the only
shape that can be the same on both platforms* » (`:1-18`).

**L'app n'a donc ni feuille de bas d'écran, ni champ multiligne, ni bouton d'arrêt de génération,
ni compteur de caractères.** C'est le poste d'UI le plus lourd de cette feature, il est **commun
aux six directions**, et chaque maquette le dessine : hauteur au repos, clavier ouvert, croissance
jusqu'à quatre lignes puis défilement interne, compteur, question longue, envoi, arrêt.

Ce que l'app sait déjà peindre, en revanche, et que les six réutilisent : le bandeau de refus
(`ArtifactsPanel.tsx:223-237`, `errorContainer` + rayon 12 + icône 18), les refusals typés de
`mobile/src/lib/artifactRefusal.ts` et `quotaError.ts`, et les clés `quota.refusal.*` qui portent
déjà les chiffres (« ce qui manque, ce qui reste, quand ça revient »), y compris la suppression de
la route vers le paywall sous `beta_access`.

### 1.8 Les tokens, et le fait que le thème sombre existe

`mobile/src/constants/theme.ts` est autoritaire, et sa structure impose une règle aux maquettes :
les tokens **dépendants du mode** (couleurs, ombres) viennent en deux palettes et ne sont lus que
par `ThemeContext` — « *There is deliberately no static `Colors` export* » (`:1-20`) — tandis que
`Typography`, `Spacing`, `BorderRadius` et `TouchTarget` sont des exports statiques invariants.
`TouchTarget.minimum = 48` est le plancher déclaré pour toute cible tactile (`:433-441`).

Le thème sombre existe depuis task-433, re-dérivé plutôt qu'inversé, et deux de ses propriétés
changent le dessin d'un chat : `highlight` / `onHighlight` **changent de polarité** (bande pâle en
clair, bloc ambre sombre en sombre — « *a pale `#fff0b3` band would flash in a dark list of
snippets* »), et `textMuted` n'y a plus la dette de contraste de la palette claire. **Les six
maquettes sont donc rendues dans les deux thèmes.**

Deux références de design : `mobile-design-mockups/my_design_system/DESIGN.md` (la « No-Line
rule », le « Callout Aside », le « Segmented Control », la règle « *Don't over-apply shadows* ») et
`mobile-design-mockups/notebooklm-reference/` — dont `collection-sources-tab.png`, qui établit que
NotebookLM met « Sources / Chat / Studio » dans une **barre de navigation basse à trois
destinations**, scopée au carnet et non à l'application.

---

## 2. Revue web sourcée

Toutes les pages ci-dessous ont été consultées le **2026-10-07**. Les pages d'Apple sont
JS-rendues : leur texte a été lu via l'endpoint de données DocC
(`https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`), qui
sert le même contenu que la page publique. Les pages de Material sont JS-rendues aussi et ont été
lues via un rendu headless de l'URL publique citée.

### 2.1 Apple HIG — Tab bars

<https://developer.apple.com/design/human-interface-guidelines/tab-bars> — consulté 2026-10-07.
La page porte un journal de modifications dont la dernière entrée est « June 8, 2026 — Updated
terminology and art », et « December 16, 2025 — Updated guidance for Liquid Glass ».

- **Navigation, pas action** : « *Use a tab bar to support navigation, not to provide actions. A
  tab bar lets people navigate among different sections of an app &hellip; If you need to provide
  controls that act on elements in the current view, use a toolbar instead.* »
- **Pas de maximum chiffré, mais une préférence explicite** : « *Use the appropriate number of
  tabs required to help people navigate your app. As a representation of your app's hierarchy, it's
  important to weigh the complexity of additional tabs against the need for people to frequently
  access each section; keep in mind that it's generally easier to navigate among fewer tabs.* »
- **Le débordement est à éviter** : « *Avoid overflow tabs. Depending on device size and
  orientation, the number of visible tabs can be smaller than the total number of tabs. If
  horizontal space limits the number of visible tabs, the trailing tab becomes a More tab in iOS
  and iPadOS &hellip; so limit scenarios in your app where this can happen.* »
- **Interdiction de griser ou de masquer** : « *Don't disable or hide tab bar buttons, even when
  their content is unavailable. Having tab bar buttons available in some cases but not others makes
  your app's interface appear unstable and unpredictable. If a section is empty, explain why its
  content is unavailable.* »
- **La barre reste visible, sauf sous un modal** : « *Make sure the tab bar is visible when people
  navigate to different sections of your app. If you hide the tab bar, people can forget which area
  of the app they're in. The exception is when a modal view covers the tab bar, because a modal is
  temporary and self-contained.* »
- **Le seul chiffre de la page, côté iPadOS** : « *If you let people select their own tabs, aim for
  a default list of five or fewer to preserve continuity between compact and regular view sizes.* »
- **iOS 26 / Liquid Glass** : « *A tab bar floats above content at the bottom of the screen. Its
  items rest on a Liquid Glass background that allows content beneath to peek through.* » Et, pour
  un accessoire : « *For tab bars with an attached accessory, like the MiniPlayer in Music, you can
  choose to minimize the tab bar and move the accessory inline with it when a person scrolls down.
  A person can exit the minimized state by tapping a tab or scrolling to the top of the view.* »
- **Et l'onglet de recherche** : « *A tab bar can include a dedicated search tab at the trailing
  end.* » (Raison de plus de ne pas donner ce rôle à un onglet Chat.)
- **Libellés** : « *Include tab labels to help with navigation &hellip; Use single words whenever
  possible.* » Et « *Prefer filled symbols or icons for consistency with the platform.* »

### 2.2 Apple HIG — Sheets

<https://developer.apple.com/design/human-interface-guidelines/sheets> — consulté 2026-10-07.

- **Modal ou non-modal sur iOS** : « *In iOS and iPadOS, a sheet can be either modal or nonmodal.
  When a nonmodal sheet is onscreen, people use its functionality to affect the parent view without
  dismissing the sheet.* »
- **Le cas d'usage exact d'un chat sur le contenu qu'on lit** : « *Use a nonmodal view when you
  want to present supplementary items that affect the main task in the parent view &hellip; in iOS
  and iPadOS, you can use a nonmodal sheet for this workflow.* »
- **Les hauteurs de repos** : « *A resizable sheet expands when people scroll its contents or drag
  the grabber &hellip; The system defines two detents: large is the height of a fully expanded
  sheet and medium is about half of the fully expanded height.* »
- **La poignée est aussi une affordance d'accessibilité** : « *Include a grabber in a resizable
  sheet &hellip; In addition to providing a visual indicator of resizability, a grabber also works
  with VoiceOver so people can resize the sheet without seeing the screen.* »
- **Une seule feuille à la fois** : « *Display only one sheet at a time from the main interface.
  When people close a sheet, they expect to return to the parent view or window.* »
- **L'avertissement qui vise la direction D** : « *For complex or prolonged user flows, consider
  alternatives to sheets.* »
- **Et le geste de fermeture** : « *Support swiping to dismiss a sheet. People expect to swipe
  vertically to dismiss a sheet instead of tapping a dismiss button.* »

### 2.3 Apple HIG — Generative AI

<https://developer.apple.com/design/human-interface-guidelines/generative-ai> — consulté
2026-10-07. Journal : « June 8, 2026 — Added guidance for letting people refine results and
providing feedback during content generation » ; page créée le 9 juin 2025.

C'est la page qui dicte le dessin des états d'attente, d'erreur et de refus des six maquettes.

- **Prévoir la latence, et ne pas bloquer l'app** : « *Factor processing time into your design
  &hellip; Generative models typically take longer to produce a result, so design a loading
  experience or generate in the background while a person uses another part of the app.* » C'est
  l'argument d'Apple en faveur d'une attente qu'on peut quitter — donc en faveur de la pilule
  réduite de la direction D et de l'accessoire de la direction F.
- **Nommer le travail plutôt que « Chargement… »** : « *Consider giving specific, reassuring
  feedback during generation. Messages that describe what's actually happening can be more helpful
  than a vague status message. For example, instead of "Processing…", say "Finding substitutions
  for ingredients" or "Summarizing key themes from your notes." Specific feedback reduces
  uncertainty and makes waiting feel purposeful. If something goes wrong, describe what happened in
  plain language and offer a clear next step.* » Les six maquettes écrivent donc « Lecture du
  transcript et rédaction… 8 s ».
- **Les actions à poser près d'une réponse** : « *Make it easy for people to refine or revert
  generated results &hellip; surfacing controls like Edit, Undo, Retry, or Adjust near generated
  content preserves people's agency.* » D'où « Copier » et « Régénérer » sous chaque bulle.
- **Les suggestions de départ** : « *For open-ended features like a search bar or generation
  prompt, consider offering curated suggestions that make it easy to get started.* » D'où les trois
  puces de 48 pt.
- **Et le refus** : « *Help people improve requests when blocked or undesirable results occur.
  Minimize scoped or blocked output by coaching people how to be more successful next time.* »
- **Enfin, un principe qui légitime un chat facultatif** : « *Ensure a great experience even when
  generative features aren't available or people opt not to use them &hellip; When possible,
  consider offering a non-AI fallback.* » C'est un argument contre une destination permanente
  (direction C) et contre un composeur permanent (direction F).

### 2.4 Apple — l'accessoire de barre d'onglets (iOS 26)

<https://developer.apple.com/documentation/swiftui/view/tabviewbottomaccessory(content:)> —
consulté 2026-10-07 : « *Places a view as the bottom accessory of the tab view.* » Et, en
discussion : « *On iPhone, the placement of the bottom accessory depends on the tab bar size: when
the tab bar is normal size, the accessory appears above it; when the tab bar is collapsed, the
accessory displays inline. Use the `TabViewBottomAccessoryPlacement` environment value to adjust
the accessory's content based on its placement.* »

L'équivalent UIKit, référencé par le typage d'`expo-router`, est
<https://developer.apple.com/documentation/uikit/uitabbarcontroller/bottomaccessory>.

**Fait du dépôt associé** : `expo-router@~55.0.16` — la version installée — expose déjà
`NativeTabs.BottomAccessory` avec `usePlacement()` renvoyant `"regular" | "inline"`, annoté
`@platform iOS 26+` (`mobile/node_modules/expo-router/build/native-tabs/common/elements.d.ts:201-225`
et `NativeTabs.d.ts`). La direction F n'a donc pas de composant natif à écrire sur iOS 26 — mais
elle doit écrire son propre rendu pour Android et pour iOS 18.

### 2.5 Material 3 — Navigation bar

<https://m3.material.io/components/navigation-bar/guidelines> — consulté 2026-10-07. C'est la seule
source des deux qui donne un **chiffre**, et elle le donne quatre fois.

- « *Navigation bars provide access to three to five destinations. The nav bar is positioned at the
  bottom of windows for convenient access.* »
- « *Navigation bars can have three to five destinations.* » Et, en critère d'emploi : « *Three to
  five main pages in the product* ».
- **L'interdit haut** : « *Avoid putting more than five navigation items in a navigation bar* », et
  « *For products with more than five navigation items, don't use a navigation bar; the elements
  may collide and there likely won't be enough space for translated text.* » Le motif du **texte
  traduit** nous vise directement : l'app a un catalogue multilingue.
- **L'interdit bas** : « *Don't use a navigation bar for fewer than three destinations. Instead,
  use tabs.* » C'est l'argument qui justifie de garder le chat intra-écran en direction B plutôt
  que de le monter dans la barre.
- **La stabilité des positions** : « *Navigation bar destinations have fixed positions. Don't
  scroll them or modify their positions.* » Donc : pas d'onglet Chat qui n'apparaîtrait qu'après la
  première conversation, et pas d'éviction réversible selon l'usage.
- **Les glyphes** : « *Use a filled icon for the active destination and outlined icons for inactive
  destinations.* »
- **Et l'état préservé au retour** : « *Preserve state: If someone has interacted with this
  destination, it returns to their scroll position, current tab, and in-line search status.* »
  C'est ce qui rend le coût de retour d'une destination de chat (direction C) égal à deux
  tapotements et non à une reconstruction.
- **Un avertissement utile pour les directions A, B et E** : « *Avoid placing swipeable items in
  the content area of a UI that has tabs, as the user may mistakenly swipe the wrong component.* »
  Le Digest est exactement ça : un carrousel horizontal sous un segment.

### 2.6 Material 3 — Tabs

<https://m3.material.io/components/tabs/guidelines> — consulté 2026-10-07.

- **Le chiffre qui autorise la direction B** : « *Avoid using more than four tabs at once. At five
  or more tabs, the container becomes cramped.* » Trois onglets intra-écran sont donc dans la zone
  recommandée — ce que la mesure du §1.4 nuance : la zone est recommandée, la **largeur** ne suit
  pas à 320 pt.
- « *Primary tabs display an app's main content destinations. They're placed at the top of the
  screen, often under a top app bar.* » C'est le rôle que « Lecture / IA / Discussion » occuperait.
- « *Don't truncate labels unless required, as truncated text can impede comprehension.* » C'est
  l'argument qui impose le libellé court « Chat » plutôt que « Discussion » à 320 pt.
- « *When a set of tabs cannot fit on screen, use scrollable tabs.* » Écarté ici : un segment
  défilable à trois items est plus coûteux à comprendre qu'un libellé abrégé.

### 2.7 Material 3 — Bottom sheets

<https://m3.material.io/components/bottom-sheets/guidelines> — consulté 2026-10-07.

- **La distinction qui fonde la direction D** : « *Standard bottom sheets co-exist with the
  screen's main UI region and allow for simultaneously viewing and interacting with both regions,
  especially when the main UI region is frequently scrolled or panned.* » Et l'exemple donné est
  exactement le modèle de la pilule réduite : « *Use a standard bottom sheet to display content
  that complements the screen's primary content, such as an audio player in a music app.* »
- **Le modal, par contraste** : « *Modal bottom sheets appear in front of app content, disabling
  all other app functionality when they appear, and remaining on screen until confirmed, dismissed,
  or a required action has been taken.* »
- **Le plafond de la position initiale d'un modal** : « *The initial vertical position of modal
  bottom sheets can't exceed 50 % of the screen height.* » Et : « *Modal bottom sheets whose
  contents exceed 50 % of the screen height can then be pulled across the full screen and scrolled
  internally to access their remaining items.* » C'est ce qui fixe la feuille du sélecteur de
  portée de la direction C à 320 pt sur 896 (35,7 %) et impose de la ramener à 280 pt à 320 x 568.
- **La poignée et le scrim** : « *Sheets should be able to cycle through preset heights and close
  completely without dragging. Selecting the drag handle should toggle through preset heights or
  close the sheet, while selecting the scrim should always close the bottom sheet.* » Et
  « *Display a close affordance in a full-screen modal bottom sheet.* »
- « *At full-screen height, standard bottom sheets contain a collapse icon in an app bar to return
  to their initial position.* »

### 2.8 Material 3 — Floating action button

<https://m3.material.io/components/floating-action-button/guidelines> — consulté 2026-10-07. Lu
parce que la direction C propose une pilule d'action « Nouvelle conversation ».

- « *Don't display multiple FABs on a single screen.* »
- « *Don't use FABs for minor, overflow, unclear, or destructive actions.* »
- « *Don't keep the FAB on screen when switching pages.* » C'est ce qui interdit de poser la pilule
  d'action ailleurs que sur l'onglet Chat — et, dans le repli Android de la direction F, ce qui
  oblige l'accessoire JS à être lié à l'écran plutôt que global.
- « *Individual components, such as cards, shouldn't have their own FAB.* »

### 2.9 Six applications qui offrent une conversation sur le contenu de l'utilisateur

Six produits, tous consultés le **2026-10-07**, choisis parce qu'ils posent une conversation sur du
contenu que l'utilisateur a lui-même collecté — exactement notre cas — et parce qu'ils documentent
leur **point d'entrée**, qui est le sujet de ce benchmark.

| Produit | Où vit le chat | Portées offertes | Ce que la source dit du point d'entrée |
|---|---|---|---|
| **Google Gemini Notebook** (ex-NotebookLM), app mobile | une **destination** dans une barre de navigation basse à **trois** items : « Sources / Chat / Studio », scopée au carnet | le carnet, et une sélection de sources dans le carnet | Le chat est un **panneau** nommé : « *In the "Chat" panel, select Configure Chat* », et l'historique s'y efface par « *Delete Chat History using the three dots menu within the chat panel* ». Les réponses sont ancrées : « *Gemini Notebook uses direct quotes, text, and images from your sources as citations &hellip; To navigate directly to the quote and review it in context, select a citation.* » L'app mobile sert d'abord à « *Get insights in the moment by asking questions about your sources* ». La capture `notebooklm-reference/collection-sources-tab.png` du dépôt montre la barre basse à trois destinations |
| **Readwise Reader** (Ghostreader) | sur mobile, une **feuille** par-dessus le document, avec **trois** entrées ; sur web, un panneau latéral, et le chat global est une **destination** de la barre latérale | le document, une sélection/annotation, et — sur web/desktop seulement — toute la bibliothèque | « *The conversation opens in a sheet that slides up over the document. When you're done chatting, swipe the sheet down or tap the X in the top right to get back to reading.* » Les trois entrées : « *Tap the Ask anything… field in the bottom toolbar* » ; « *Open the actions menu (…) in the bottom right and tap Ghostreader* » ; « *To ask about a specific passage, tap a highlight (or select some text) and tap the ghost icon in the annotation bar. The chat opens with that highlight attached.* » Les suggestions suivent la portée : « *you'll see a different set of options if you have a word or two selected &hellip; versus if you have a full sentence or paragraph selected. If you have nothing selected, the listed prompts will be for the full document content.* » Et le chat global est une destination : « *To open the global chat, click Ghostreader in the left sidebar, directly below Home.* » |
| **YouTube** (« Ask » sur la page de lecture) | une **icône sous le lecteur**, sans libellé | la vidéo regardée | « *Tap [icon] below the video* » ; « *Select one of the suggested prompts, or type your own question* » ; le but affiché est de « *dive deeper into the content you are watching &hellip; all without leaving the video* ». La fonction « *will appear on the watch page for select videos* » |
| **Snipd** | une conversation **par épisode** | l'épisode | « *Chat with Podcasts* » / « *Get instant answers and rediscover valuable insights from the episodes you've listened to* » / « *Like ChatGPT for your podcasts* ». La page produit ne décrit **pas** le point d'entrée dans l'interface ; seule la portée (l'épisode) est établie |
| **Podwise** (« Ask Anything ») | une boîte de question **sur l'épisode** | l'épisode, et une recherche sur la bibliothèque | « *Ask questions and get instant answers from any episode. Like having a conversation with the podcast itself.* » Les réponses sont horodatées (l'exemple de la page affiche « 02:14 »). Le seul chemin d'accès documenté hors interface est la CLI (`podwise ask --episode <id> …`) |
| **Notion AI** | une **destination** de la barre latérale pour le mode recherche, et des entrées **dans la page** | l'espace de travail, la page, une sélection | « *you can use the keyboard shortcut shift + cmd/ctrl + J to engage Notion AI whenever you need it* » ; dans une page : « *You can highlight text in a page or hit space in a page and have Notion AI&hellip;* » ; et pour l'analyse approfondie : « *can go to Notion AI in your sidebar and toggle on Research Mode* ». Les sources incluent « *pages in your Notion workspace that you have access to* » |

### 2.10 Ce que la revue établit, et qui n'était pas évident

1. **Personne ne met le chat dans un onglet d'artefacts.** Les six produits lui donnent soit une
   **destination** (Gemini Notebook, Readwise sur web, Notion), soit une **surface invocable**
   (Readwise sur mobile), soit une **entrée dans le contenu** (YouTube, Readwise par l'annotation).
   Aucun ne l'empile au-dessus d'une grille de générations. C'est l'argument produit le plus net
   contre la direction A.
2. **Le produit le plus proche de nous met le chat dans une feuille sur mobile et dans une
   destination sur grand écran.** Readwise Reader a exactement notre forme (une bibliothèque de
   contenus longs, un lecteur, des annotations) et il a tranché : **feuille** sur téléphone,
   **destination** sur web. La direction D sur mobile et une destination plus tard, c'est
   littéralement son chemin.
3. **Deux produits sur six ont plusieurs points d'entrée pour une seule surface.** Readwise en a
   trois, Notion en a trois. La conclusion n'est donc pas « choisir une entrée » mais « choisir une
   **maison** et lui greffer des entrées » — ce qui est précisément la forme de la recommandation.
4. **Quand la portée globale existe, elle est une destination ; quand elle n'existe pas, il n'y a
   rien.** Readwise ne propose pas de chat de bibliothèque sur mobile — « *Global Ghostreader is
   available in the web and desktop apps. In the mobile app, you can still chat with an individual
   document* » — et il ne laisse pas pour autant une destination vide. C'est la validation
   extérieure du repli de la direction D.
5. **L'entrée par la sélection est un standard, pas une idée.** Readwise la documente avec le
   passage joint et des suggestions dépendantes de la portée de la sélection ; YouTube pose une
   icône sous le lecteur ; Notion ouvre sur `space` ou sur une sélection. La direction E n'est donc
   pas exotique — c'est son implémentation en React Native qui est contrainte.

---

## 3. Les trois questions de l'owner, tranchées

### 3.1 « Au niveau des artefacts, ou dans un onglet de plus ? » — **Ni l'un ni l'autre**

**Réponse : pas au niveau des artefacts, et pas non plus dans un troisième onglet intra-écran.**

**Pourquoi pas au niveau des artefacts** (direction A), trois raisons, dont deux sont des faits du
dépôt et une est un fait produit :

1. `ArtifactsPanel` est partagée **verbatim** et son propre commentaire interdit le drapeau par
   différence visuelle (`:1-23`). Y loger le chat, c'est modifier **les deux portées en un seul
   geste** — et renoncer à livrer la portée média avant la portée dossier.
2. **La configuration de clavier est la plus fragile des six.** L'onglet IA est un bloc du
   `Animated.ScrollView` de `CompletedDetailView` ; un composeur qui doit rester au-dessus du
   clavier y demande un `KeyboardAvoidingView` de page **plus** un défilement programmé. Et comme
   la même page est une vignette du carrousel horizontal du Digest, le champ se focalise dans un
   pager horizontal — le cas que Material déconseille nommément.
3. **Aucun des six produits examinés ne le fait.** Ils donnent au chat une destination, une surface
   invocable, ou une entrée dans le contenu ; aucun ne l'empile au-dessus d'une grille de
   générations.

**Pourquoi pas un troisième onglet** (direction B), bien que ce soit la direction la plus
conforme aux règles citées (Material autorise jusqu'à quatre onglets intra-écran, et
`ScreenTabs` tient à trois sans refonte) :

1. **Deux débordements mesurés.** Le libellé « Discussion » ne tient à **aucune** des deux tailles
   (61 pt disponibles à 414, 30 pt à 320, pour ~74 pt de texte), et le titre de la barre repliée
   tombe à **36 pt à 320 pt**, soit deux caractères. Les deux se corrigent — libellé court « Chat »,
   vignette abandonnée sous 375 pt — mais les deux corrections demandent des **évolutions de
   primitives partagées** (`ScreenTabs` et `MediaReaderBar`) qui bénéficient à cette feature seule.
2. **Un coût caché structurel.** Pour que le composeur soit ancré — ce qui est l'avantage de cette
   direction sur A — l'onglet doit être rendu **à côté** du `Animated.ScrollView` de la page et non
   dedans. C'est une restructuration de `CompletedDetailView`, pas une branche de `switch` en plus.
3. **Et au bout de tout ça, toujours aucune portée bibliothèque**, parce que la Librairie n'a pas
   de segment et que `search.tsx:686-701` explique pourquoi elle n'en aura pas.

**La réponse positive : une surface qui n'est ni l'une ni l'autre.** La feuille de la direction D
laisse l'onglet IA aux artefacts, laisse `ScreenTabs` à deux onglets, et donne au chat une surface
entière avec un composeur ancré — c'est-à-dire exactement ce que la direction B cherchait, sans
payer `ScreenTabs` ni restructurer la page.

### 3.2 « Un chat global, et à quel prix dans la barre d'onglets ? »

**D'abord le fait, qui corrige l'énoncé : la barre a quatre onglets, pas trois**
(`_layout.tsx:98-154`). « Remplacer un onglet par Chat » n'est donc pas la seule option.

**Un cinquième onglet est tenable, à la limite exacte des deux systèmes.** Material donne le
chiffre et l'interdit : « *three to five destinations* », « *Avoid putting more than five
navigation items in a navigation bar* ». Apple ne donne pas de maximum mais pose « *it's generally
easier to navigate among fewer tabs* », « *Avoid overflow tabs* », et, côté iPadOS, « *aim for a
default list of five or fewer* ». **Cinq est donc autorisé, et c'est le plafond.** Mesure :

| | Largeur utile de la barre | Par item à 4 | Par item à 5 | Marge sur « Recherche » (48 pt à 10 pt) |
|---|---|---|---|---|
| 414 x 896 | 398 pt | 99,5 pt | 79,6 pt | 31,6 pt |
| 320 x 568 | 304 pt | 76,0 pt | **60,8 pt** | **12,8 pt** |

**Mais le prix n'est pas celui de la largeur : c'est celui de la permanence.** Deux arguments, et
aucun n'est esthétique :

1. **Apple interdit de griser ou de masquer un onglet dont le contenu est indisponible.** Si la
   portée bibliothèque n'arrive pas, l'onglet Chat doit rester là et montrer quelque chose — en
   l'occurrence une liste de fils ouverts ailleurs. C'est tenable (la maquette C le dessine) mais
   c'est une destination dont la raison d'être est amputée.
2. **La HIG sur l'IA génératrice demande que l'app reste bonne pour qui n'utilise pas l'IA** :
   « *Ensure a great experience even when generative features aren't available or people opt not to
   use them.* » Une destination permanente sur cinq pour une feature sans usage mesuré va contre ce
   principe.

**Donc : le prix d'un chat global ne se paie pas forcément dans la barre.** La direction D l'obtient
avec un **bouton de 44 pt dans l'en-tête de la Librairie**, et la direction F avec un **accessoire**
qui n'est pas une destination (« *Use a tab bar to support navigation, not to provide actions* »
est respecté à la lettre : l'action est au-dessus de la barre, pas dedans). Les deux disparaissent
proprement si la portée n'arrive pas.

**Et si l'owner veut quand même la destination**, la variante qui **évince** `digest` est dessinée
dans la maquette C, avec son chemin de remplacement : une carte « Votre Digest du jour » épinglée en
tête d'Accueil, qui pousse la même route `digest/[period]` — route que la notification Digest atteint
déjà directement, donc le chemin profond existe sans rien ajouter. L'éviction porte sur `digest` et
pas ailleurs parce que c'est la seule destination dont le contenu est **périodique et déjà poussé** :
`account` porte les réglages, l'abonnement et la déconnexion, `search` est la bibliothèque, `inbox`
est l'écran d'arrivée. Et Material impose que l'éviction soit définitive : « *Navigation bar
destinations have fixed positions.* »

### 3.3 « Mieux, si mieux existe » — **deux directions sortent du cadre, et l'une est retenue**

**Direction D — la feuille invocable de partout** : ni onglet d'artefacts, ni onglet de plus, ni
destination. Une surface qu'on appelle depuis l'écran où l'on est, qui emprunte sa portée, et qui se
réduit en pilule pour survivre à la navigation. C'est la forme que **Readwise Reader a retenue sur
mobile**, et c'est celle que la HIG d'Apple décrit pour « *supplementary items that affect the main
task in the parent view* ».

**Direction E — l'entrée par le texte** : un appui long sur un paragraphe (ou une sélection) ouvre la
conversation avec le passage joint. C'est le geste de Readwise et de YouTube, et c'est le seul point
d'entrée des six qui **porte son propre contexte** : la question n'a pas à nommer ce dont elle parle.

**Direction F — le composeur persistant dans l'accessoire de la barre** sort aussi du cadre, et elle
est techniquement la plus élégante : `NativeTabs.BottomAccessory` existe déjà dans l'`expo-router`
installé. Elle est écartée pour la V1 et nommément recommandée pour plus tard (§7.3).

**La recommandation combine D et E2** : D est la maison, E2 est l'entrée qui la rend découvrable
là où la question naît.

---

## 4. Les six directions, en une page

Maquettes : `mobile-design-mockups/chatbot_integration_ui/` — un `README.md` d'index et six
sous-répertoires, chacun avec un `code.html` autonome et un `screen.png` à 1200 px de large.

| | Direction | Où vit le chat | Portées servies | Ce qu'elle casse |
|---|---|---|---|---|
| **A** | `direction_a_dans_longlet_ia/` | en tête de l'onglet IA, au-dessus des pastilles | média, dossier | `ArtifactsPanel`, **pour les deux portées à la fois** |
| **B** | `direction_b_troisieme_onglet/` | onglet « Discussion » / « Chat » | média, dossier | `ScreenTabs`, `MediaReaderBar`, et la structure de `CompletedDetailView` |
| **C** | `direction_c_cinquieme_onglet/` | une destination « Chat » qui liste les fils | média, dossier, bibliothèque | la barre d'onglets (5 items, ou éviction de `digest`) |
| **D** | `direction_d_feuille_invocable/` | une feuille non modale, réductible en pilule | média, dossier, bibliothèque | **rien** des trois structures |
| **E** | `direction_e_depuis_le_texte/` | une sélection (E1) ou un paragraphe (E2) du lecteur | **média seulement** | rien (E2) / `TranscriptReader` (E1) |
| **F** | `direction_f_composeur_persistant/` | `NativeTabs.BottomAccessory` au-dessus de la barre | média, dossier, bibliothèque | la décision `minimizeBehavior="never"`, et la parité iOS/Android |

Chaque page de maquette montre, pour sa direction : le parti pris, les règles Apple et Material qui
s'y appliquent, l'écran actuel en référence, la direction au repos **à 414 x 896 et 320 x 568, en
clair et en sombre**, le composeur (repos, clavier ouvert, croissance, compteur, question longue),
l'attente **dans les deux régimes**, l'erreur, le refus de quota et la conversation pleine, les
trois portées (ou la déclaration de celle qu'elle ne sert pas), ce que le Digest en fait, puis les
mesures, les écarts au design system, l'accessibilité et la faisabilité React Native fichier par
fichier.

---

## 5. Comparaison

### 5.1 Découvrabilité du chat

| Direction | Ce qu'on voit sans rien savoir | Note |
|---|---|---|
| **C** | une destination permanente dans la barre, libellée « Chat », visible depuis tous les écrans | **5/5** |
| **F** | un champ « Poser une question sur cet épisode… » permanent au-dessus de la barre | **5/5** |
| **B** | un troisième onglet sur la page média et sur la page dossier, visible dès l'ouverture | **4/5** |
| **A** | un bloc « Discussion » en tête de l'onglet IA — visible, mais après un tapotement | **3/5** |
| **E** | rien : il faut savoir qu'un appui long sur un paragraphe fait quelque chose | **1/5** |
| **D** | rien : une entrée dans un menu `…` | **1/5** |

**C'est la faiblesse de la recommandation, et elle est traitée plutôt que minimisée.** La greffe de
E2 déplace le point d'entrée dans le contenu mais ne le rend pas visible pour autant. Deux
atténuations qui ne coûtent aucune structure, et qui relèvent du choix de l'owner plutôt que du
benchmark : (a) l'entrée du menu `…` est **la première** de la liste et porte le glyphe
`sparkles-outline` que l'app associe déjà à l'IA ; (b) la première ouverture d'un média transcrit
peut afficher **une fois** la pilule réduite au repos, avec « Poser une question sur cet épisode ».
L'option (b) est une invitation unique, pas un composeur permanent : elle n'engage pas l'interface
comme la direction F le ferait.

### 5.2 Coût de navigation pour revenir à une conversation en cours

Mesuré en **tapotements depuis un écran quelconque**. C'est le critère sur lequel les six s'écartent
le plus.

| Direction | Depuis la même page | Depuis un autre onglet | Le fil survit-il à la navigation ? |
|---|---|---|---|
| **D** | **1** (la pilule) | **1** (la pilule, posée au-dessus de la barre) | **oui**, par construction |
| **F** | **1** (l'accessoire) | **1** | **oui**, et l'attente se peint dedans |
| **C** | 2 (onglet Chat, puis le fil) | 2 | oui, et Material garantit l'état préservé |
| **B** | 2 (retour au média, puis l'onglet) | 3 à 4 | non : le fil est l'état d'une page |
| **A** | 2 | 3 à 4 | non |
| **E** | — | — | **non** : le fil naît d'un passage et meurt avec la page |

**Et c'est là que les deux régimes d'attente comptent — dans le même sens pour les six.** En régime
bloc (5 à 15 s), pouvoir relire le texte pendant l'attente est un confort ; en régime flux, pouvoir
laisser la réponse s'écrire pendant qu'on fait autre chose est ce que la HIG recommande
explicitement (« *generate in the background while a person uses another part of the app* »). Les
directions D et F sont les seules à l'offrir, **quel que soit** le transport retenu par task-430.

### 5.3 Cohabitation avec les artefacts

| Direction | L'onglet IA | Le risque |
|---|---|---|
| **A** | **le chat est dedans** | les deux portées changent ensemble ; la grille de génération est repoussée sous un bloc de hauteur variable ; aucun des six produits examinés ne fait ça |
| **B** | intact, à côté | aucun — le chat et les artefacts sont deux onglets frères, ce qui est exactement la structure de Gemini Notebook (« Sources / Chat / Studio ») |
| **C** | intact | le chat est ailleurs : il faut dire quelque part, depuis la page média, qu'on peut en parler (l'entrée du menu `…`) |
| **D** | intact | le même : une entrée à poser |
| **E** | intact | le même, et le chat ne couvre pas le dossier |
| **F** | intact | aucun : l'accessoire est sur une autre couche |

**Un point pour la direction B**, et il est réel : c'est la seule qui reproduit la structure du
produit le plus comparable (un carnet avec ses sources, son chat et son studio côte à côte). Ce qui
la disqualifie n'est pas cette cohabitation, c'est son coût mesuré en largeur et en restructuration.

### 5.4 Charge imposée à `ScreenTabs` et à `ArtifactsPanel`

| Direction | `ScreenTabs` | `MediaReaderBar` | `ArtifactsPanel` |
|---|---|---|---|
| **A** | intact | intact | **étendu, pour les deux portées ; réouvre la règle « no prop per visual difference »** |
| **B** | **étendu** : une `labelKeyShort` facultative, bénéficiant aux trois appelants | **étendu** : masquer la vignette sous 375 pt | intact |
| **C** | intact | intact | intact |
| **D** | intact | intact | intact |
| **E** | intact | intact | intact |
| **F** | intact | intact | intact |

`ScreenTabs` **tient à trois sans refonte** — c'est le fait, et il va dans le sens de la direction
B. Ce qu'elle ne sait pas faire, c'est varier un libellé selon la largeur, et c'est ce que la mesure
du §1.4 rend obligatoire. L'évolution proposée (une clé courte facultative) est propre et
réutilisable ; elle n'est simplement pas gratuite.

### 5.5 Accessibilité

| Direction | Ce qui est gratuit | Ce qui est à écrire | Note |
|---|---|---|---|
| **B** | `tablist` / `tab` / `selected` par la primitive, et le libellé complet conservé même replié (`ScreenTabs.tsx:84-88`) | faire que l'abréviation « Chat » **n'abrège pas l'annonce** | **5/5** |
| **C** | le rôle, l'état sélectionné, le Dynamic Type et le retour au sommet, par la barre native | rien de particulier ; **mais** 60,8 pt par item à 320 pt déborde en Dynamic Type 150 % | **4/5** |
| **A** | idem B (le segment ne change pas) | la région vivante de la conversation, et le défilement programmé vers le champ | **4/5** |
| **D** | rien | **la gestion du focus** (entrer dans la feuille, revenir sur l'entrée de menu), le retrait de la page de l'arbre pendant que la feuille est haute, la poignée annoncée comme ajustable, une fermeture au bouton et pas seulement au geste | **3/5** |
| **E** | la sélection est déjà au rotor VoiceOver via `selectable` | idem D, **plus** un point de retour qui est un nœud de texte et non un bouton | **3/5** |
| **F** | rien | idem D, **plus** un disque d'envoi de 36 pt dessinés dont la cible doit être portée à 48 par `hitSlop`, **plus** la parité du repli Android | **2/5** |

Dans les six maquettes, **aucune cible n'est sous 48 pt**. Le seul endroit où la distinction
« taille dessinée » / « taille de cible » est nécessaire est le disque de l'accessoire de la
direction F, et elle y est nommée.

### 5.6 Faisabilité React Native

| Direction | Clavier | Digest | Risque spécifique |
|---|---|---|---|
| **C** | **le plus simple** : un écran à lui, la barre passe sous le clavier | gratuit (aucun contact) | un `Trigger` de plus sur une API en alpha, mais aucun des deux bogues amont n'en dépend |
| **D** | simple : feuille au niveau de l'écran, un `KeyboardAvoidingView` comme les deux dialogues existants | **gratuit** : même page, même menu, même feuille | **le contexte de session au-dessus de la barre d'onglets** — une pièce d'architecture que les autres n'écrivent pas |
| **F** | simple | gratuit | `@platform iOS 26+` : **deux rendus à maintenir**, et une feature de produit posée sur une API en alpha |
| **E** | simple | gratuit | **E1 n'est pas faisable** sans réécrire `TranscriptReader` ; E2 est la moins coûteuse des six |
| **B** | **ancré sans effort**, mais il faut sortir l'onglet du `ScrollView` de la page | champ focalisé dans un pager horizontal | la restructuration de `CompletedDetailView` |
| **A** | **le plus fragile** : `KeyboardAvoidingView` de page + défilement programmé dans un `ScrollView` | idem, en pire | le couplage des deux portées par `ArtifactsPanel` |

Le fait qui tranche E1, vérifié dans les typages installés : `Text` n'a que `selectable`
(`react-native/Libraries/Text/Text.d.ts:63-71`) et **pas** d'`onSelectionChange` ; seul `TextInput`
en a (`TextInput.d.ts:870`), avec `contextMenuHidden` (`:770`). Lire une sélection dans le lecteur
demande donc un `TextInput` en lecture seule, c'est-à-dire la perte du `<Text>` imbriqué qui porte
le nom du locuteur (`TranscriptReader.tsx:299-303`).

### 5.7 Couverture des portées, et comportement si la portée bibliothèque n'arrive pas

| Direction | Média | Dossier | Bibliothèque | Ce qu'elle devient sans la portée globale |
|---|---|---|---|---|
| **A** | oui | oui, **gratuitement** | non | inchangée : elle ne l'a jamais proposée |
| **B** | oui | oui | non | inchangée |
| **C** | oui | oui | oui | l'entrée du sélecteur reste **visible et désactivée avec sa raison** ; l'onglet reste plein, parce qu'il liste les fils des deux autres portées. Apple interdit de le griser |
| **D** | oui | oui | oui | **l'entrée n'existe pas** : un bouton de 44 pt qui n'est pas rendu. Aucune destination vide, aucune promesse non tenue. **Le repli le moins coûteux des six** |
| **E** | oui | **non**, par construction | non | inchangée |
| **F** | oui | oui | oui | l'accessoire **change de promesse** sur la Librairie (« Poser une question sur un média… ») : il ne peut pas disparaître, sinon la hauteur du chrome varierait d'un onglet à l'autre |

### 5.8 Synthèse pondérée

Les poids répondent aux contraintes posées par la tâche, pas à une préférence : la robustesse au
non-tranché (architecture, portée globale) pèse le plus, parce que c'est ce qui permet de décider
maintenant ; la charge sur les structures partagées vient ensuite, parce que c'est le coût qu'on ne
récupère pas.

| Axe | Poids | A | B | C | D | E | F |
|---|---|---|---|---|---|---|---|
| Ne casse aucune structure partagée | 25 % | 1 | 2 | 4 | **5** | 5 | 4 |
| Coût de retour à une conversation | 20 % | 2 | 2 | 4 | **5** | 1 | 5 |
| Repli si la portée globale n'arrive pas | 15 % | 3 | 3 | 3 | **5** | 3 | 3 |
| Faisabilité RN et risque | 15 % | 1 | 2 | **5** | 4 | 3 | 2 |
| Découvrabilité | 15 % | 3 | 4 | **5** | 1 | 1 | 5 |
| Accessibilité | 10 % | 4 | **5** | 4 | 3 | 3 | 2 |
| **Total** | | **2,05** | **2,70** | **4,15** | **4,15** | **2,90** | **3,65** |

**C et D sont à égalité, et c'est un résultat honnête plutôt qu'une esquive.** Elles gagnent sur des
axes différents : C sur la découvrabilité et la faisabilité, D sur l'absence de dégâts structurels,
le coût de retour et le repli. **Ce qui les départage est la greffe de E2**, qui achète à D deux
points de découvrabilité pour un `Pressable` autour d'un nœud qui existe déjà — et le fait qu'une
destination de barre d'onglets est la seule des deux décisions qu'on ne peut pas défaire
discrètement.

**D + E2 : 4,45.** C reste le repli, et il reste bon.

---

## 6. Fichiers à étendre, et ce qui est entièrement neuf

Aucune ligne de ce tableau ne suppose l'architecture de task-430 : `chatService.ts` est l'unique
point de contact réseau, et il est neuf dans les six cas quel que soit le transport.

### 6.1 Les quatre pièces que les six directions paient de toute façon

| Pièce | Nature |
|---|---|
| `ChatComposer.tsx` | **neuf.** `TextInput multiline`, croissance jusqu'à 4 lignes puis défilement interne, compteur, bouton envoi **et** bouton d'arrêt distincts. L'app n'a aujourd'hui que `UrlEntryDialog` (`multiline={false}`) et `RenameDialog` |
| `ChatThread.tsx` | **neuf.** Les bulles, la citation horodatée, les deux régimes d'attente, les actions « Copier » / « Régénérer », l'erreur et le refus |
| `chatService.ts` | **neuf.** L'appel réseau, sous quelque forme que task-430 retienne |
| `mobile/src/i18n/*.ts` | **étendus.** Les libellés du chat, les mots du refus et les libellés accessibles |

### 6.2 Direction A

| Fichier | État |
|---|---|
| `mobile/src/components/ArtifactsPanel.tsx` | **étendu** — un bloc « Discussion » en tête, et des props de conversation ; **modifie les deux portées à la fois** |
| `mobile/src/components/CompletedDetailView.tsx` | **étendu** — l'état de la conversation, à côté de `artifactStates` |
| `mobile/app/media/folders/[id].tsx` | **étendu** — le même état dans `AiTab` |
| `ScreenTabs.tsx`, `_layout.tsx`, `MediaReaderBar.tsx` | intacts |

### 6.3 Direction B

| Fichier | État |
|---|---|
| `mobile/src/components/CompletedDetailView.tsx` | **étendu et restructuré** — `MediaDetailTabKey` à trois valeurs, `MEDIA_DETAIL_TABS` à trois entrées (`:118-129`), `progress` à `null` sur le nouvel onglet, et l'onglet rendu **hors** du `Animated.ScrollView` |
| `mobile/app/media/folders/[id].tsx` | **étendu** — `FolderTabKey` et `FOLDER_TABS` (`:110-123`) |
| `mobile/src/components/ScreenTabs.tsx` | **étendu** — une `labelKeyShort` facultative |
| `mobile/src/components/MediaReaderBar.tsx` | **étendu** — vignette masquée sous 375 pt |
| `ChatPane.tsx` | **neuf** — la surface entière, composeur ancré |
| `ArtifactsPanel.tsx`, `_layout.tsx` | intacts |

### 6.4 Direction C

| Fichier | État |
|---|---|
| `mobile/app/(tabs)/_layout.tsx` | **étendu** — un cinquième `NativeTabs.Trigger` ; en variante C2, le `Trigger` `digest` **supprimé** (la route reste) |
| `mobile/app/(tabs)/inbox.tsx` | **étendu, variante C2 seulement** — la carte « Votre Digest du jour » |
| `mobile/src/hooks/useMediaActions.ts` | **étendu** — « Discuter de ce média » dans le menu `…` |
| `app/(tabs)/chat/index.tsx`, `app/(tabs)/chat/[id].tsx`, `ScopePickerSheet.tsx` | **neufs** |
| `ScreenTabs.tsx`, `ArtifactsPanel.tsx`, `MediaReaderBar.tsx`, `CompletedDetailView.tsx` | intacts |

### 6.5 Direction D *(recommandée)*

| Fichier | État |
|---|---|
| `mobile/src/hooks/useMediaActions.ts` | **étendu** — « Discuter de ce média », et l'entrée sert les **trois** points où ce menu existe déjà (page média, ligne de liste, Digest) |
| `mobile/app/media/folders/[id].tsx` | **étendu** — la même entrée dans `folderActions` (menu d'en-tête, `:436-444`) |
| `mobile/app/(tabs)/search.tsx` | **étendu, et seulement si la portée bibliothèque est faisable** — un bouton de 44 pt dans l'en-tête ; sinon intact |
| `mobile/src/components/TranscriptReader.tsx` | **étendu (greffe E2)** — chaque paragraphe, déjà un `<Text selectable>` distinct (`:290-305`), enveloppé dans un `Pressable onLongPress`, et la pastille de gouttière |
| `ChatSheet.tsx` | **neuf** — deux hauteurs de repos, poignée, en-tête, gestion du focus |
| `ChatSessionContext.tsx` | **neuf, et c'est le vrai coût** — la conversation survit au changement d'écran et d'onglet, donc un contexte monté au-dessus de `NativeTabs`, comme `AuthContext`, `ThemeContext` et `UserPreferencesContext` le sont déjà |
| `ChatMiniPill.tsx`, `PassageChip.tsx` | **neufs** |
| `_layout.tsx`, `ScreenTabs.tsx`, `ArtifactsPanel.tsx`, `MediaReaderBar.tsx` | **intacts** |
| `CompletedDetailView.tsx` | **intact**, hors la déclaration de portée au contexte |

### 6.6 Direction E

| Fichier | État |
|---|---|
| `mobile/src/components/TranscriptReader.tsx` | **E2 : étendu légèrement** (un `Pressable` par paragraphe). **E1 : réécrit** — un `TextInput` en lecture seule, perte du `<Text>` imbriqué du locuteur, et un module natif ou une dépendance pour l'entrée de menu |
| `mobile/src/components/CompletedDetailView.tsx` | **étendu** — l'état de la conversation et la feuille |
| `mobile/src/hooks/useMediaActions.ts` | **étendu** — « Demander sur tout l'épisode » |
| `PassageChip.tsx`, `ChatSheet.tsx` | **neufs** |
| `folders/[id].tsx` | **intact** — et c'est le problème : la portée dossier n'est pas servie |

### 6.7 Direction F

| Fichier | État |
|---|---|
| `mobile/app/(tabs)/_layout.tsx` | **étendu** — un `<NativeTabs.BottomAccessory>` ; et la décision `minimizeBehavior="never"` (`:88-93`) à rouvrir si l'on veut le placement `inline` |
| `mobile/app/(tabs)/account.tsx` | **étendu** — déclarer l'absence de portée |
| `ChatAccessory.tsx` | **neuf** — les deux placements via `usePlacement()` |
| `ChatAccessoryFallback.tsx` | **neuf, et c'est le surcoût** — la même barre en JS pour Android et iOS 18 |
| `ChatScopeContext.tsx`, `ChatSheet.tsx` | **neufs** |
| `ScreenTabs.tsx`, `ArtifactsPanel.tsx`, `MediaReaderBar.tsx` | intacts |

---

## 7. La recommandation en détail

### 7.1 Ce qui est recommandé, précisément

**La maison : la feuille de la direction D.**

- Une feuille **non modale** au sens d'Apple, qui emprunte la portée de l'écran d'où elle est
  ouverte : un média, un dossier, ou la bibliothèque si cette portée existe.
- **Position initiale 62 % de la hauteur** (560 pt à 414 x 896, 360 pt à 320 x 568), haute au
  clavier, poignée de 36 x 5 pt annoncée comme ajustable, fermeture **au bouton** de 48 pt **et** au
  geste.
- **Réductible en pilule de 48 pt**, qui survit au changement d'écran et d'onglet, porte l'état
  d'attente, et ramène le retour à **un** tapotement.
- Entrée principale : **la première ligne du menu `…`** qui existe déjà sur la page média, sur
  chaque ligne de liste, dans le Digest, et dans l'en-tête d'un dossier.

**L'entrée contextuelle : E2.**

- **Appui long sur un paragraphe** du lecteur → la même feuille, avec le **passage joint** dessiné
  comme un « Callout Aside » du design system, et trois puces contextuelles.
- Et **« Demander sur tout l'épisode »** dans le menu `…` pour le cas sans passage, exactement comme
  Readwise documente le comportement sans sélection.
- **E1 est écarté** : l'entrée au menu de sélection natif n'est pas atteignable depuis un `Text` en
  React Native.

**Ce qui n'est pas touché, et c'est le cœur de la recommandation** :
`mobile/app/(tabs)/_layout.tsx`, `mobile/src/components/ScreenTabs.tsx`,
`mobile/src/components/ArtifactsPanel.tsx` et `mobile/src/components/MediaReaderBar.tsx` restent
**tels quels**.

### 7.2 Le repli, et la condition qui le déclenche

**Repli : direction C, le cinquième onglet principal.** À prendre si l'owner tranche sur l'un de
ces deux points :

1. **La découvrabilité est décisive** — c'est-à-dire : il est inacceptable que la feature soit
   invisible pour qui n'ouvre pas un menu. C'est un arbitrage de produit que ce benchmark ne peut
   pas faire à la place de l'owner.
2. **Le chat doit être un lieu nommé du produit**, listant les conversations toutes portées
   confondues, et pas seulement un geste sur un contenu.

Dans ce cas, deux sous-décisions, toutes deux dessinées :

- **C1, cinq destinations** — tenable, à 60,8 pt par item à 320 pt (12,8 pt de marge sur le libellé
  le plus long). C'est le maximum de Material et la limite d'Apple.
- **C2, Chat remplace `digest`** — plus confortable (99,5 / 76 pt par item), au prix d'un chemin
  d'accès indirect au Digest : une carte épinglée en tête d'Accueil, et la notification qui y mène
  déjà directement.

**Et le repli est compatible avec la recommandation.** Rien dans D n'empêche d'ajouter plus tard la
destination de C : `ChatSheet`, `ChatComposer`, `ChatThread`, `ChatSessionContext` et `chatService`
seraient réutilisés tels quels, et l'écran de liste serait la seule pièce neuve. L'inverse est vrai
aussi. **Aucune des deux ne verrouille l'autre** — c'est ce qui rend cette décision peu risquée.

### 7.3 Ce qui est recommandé pour plus tard, et pourquoi pas maintenant

**La direction F, dès que deux conditions seront remplies** : que `NativeTabs` ne soit plus en
alpha, et que le chat ait un usage mesuré. C'est la plus belle des six et la seule qui rende
l'attente visible sans ouvrir quoi que ce soit. Ce qui l'exclut aujourd'hui n'est pas son dessin,
ce sont deux faits : `NativeTabs.BottomAccessory` est `@platform iOS 26+`, donc le repli JS devient
le rendu réel sur Android et sur iOS 18 — **deux implémentations d'une même barre** — et un
composeur permanent est une invitation permanente, ce que la HIG déconseille pour une feature
facultative.

**La direction B, si la portée dossier devient le cas d'usage dominant.** C'est la structure du
produit le plus comparable (Gemini Notebook), et sur un dossier elle ne paie **aucun** des deux
débordements mesurés, puisqu'un dossier n'a pas de `MediaReaderBar`. Si l'usage montrait que les
conversations se font sur des dossiers et presque jamais sur un média isolé, l'arbitrage
changerait.

---

## 8. Ce que la recommandation ne décide pas

- **Le transport.** Rien dans D + E2 ne dépend du flux ni de son absence. Les deux régimes sont
  dessinés, et le seul endroit où le choix de task-430 change l'interface est la valeur que la
  pilule réduite apporte — qui augmente dans les deux cas.
- **La faisabilité de la portée bibliothèque.** Le repli est un bouton d'en-tête qui n'existe pas.
- **Le plafond de longueur d'une question, le nombre de tours, le nombre de tours en vol.** Les
  maquettes dessinent le compteur, le bandeau « une réponse est déjà en cours » et le bandeau
  « conversation pleine » ; les **valeurs** sont des paramètres, et celles affichées viennent de
  task-430 §9.4 sans être validées.
- **Le modèle, le prix, l'unité de quota.** Hors périmètre.
- **Le site web et l'extension** (task-424). Hors périmètre, et la forme « feuille » n'y transpose
  pas : Readwise, qui a exactement ce problème, utilise une feuille sur mobile et un panneau
  latéral sur web.
- **Le libellé définitif.** Les maquettes écrivent « Discussion » et « Chat » ; l'owner a déjà
  tranché des noms d'onglets par le passé (« Reader », « AI », « Sources » —
  `notebooklm-reference/README.md`), et celui-ci lui revient.

---

## 9. Risques et angles morts

| Risque | Portée | Ce qui est fait, et ce qui ne l'est pas |
|---|---|---|
| **La découvrabilité de D est faible, et c'est son vrai défaut** | adoption | Assumé et noté (1/5 au §5.1). Deux atténuations proposées au §5.1, dont une — l'invitation unique — reste un choix de l'owner. **Si l'owner juge ce point rédhibitoire, le repli C est le bon choix et il est bon** |
| **`ChatSessionContext` est une pièce d'architecture mobile nouvelle** | coût de construction | Nommée au §6.5. Le dépôt a déjà trois contextes montés au-dessus de la barre (`AuthContext`, `ThemeContext`, `UserPreferencesContext`), donc le motif existe ; ce qui est neuf, c'est qu'un **rendu** (la pilule) vive à ce niveau |
| **Apple met en garde contre les feuilles pour les flux prolongés** | ergonomie | Cité tel quel au §2.2. La réponse est la pilule réduite, qui transforme un flux prolongé en une suite de passages courts. C'est aussi le modèle du *standard bottom sheet* de Material (« *such as an audio player in a music app* »), donc la forme a un précédent |
| **146 pt de conversation visible à 320 pt, clavier ouvert** | lisibilité sur petit écran | Mesuré et dessiné. C'est le plus serré des six (C en offre 215, A et B 163). La raison est le surcoût de 61 pt de la poignée et de l'en-tête de feuille. **Non résolu** : à 320 pt avec le clavier, une conversation se lit un tour à la fois quelle que soit la direction |
| **Le menu `…` grossit** | ergonomie | L'entrée du chat devient la première de cinq. Au-delà, ce menu deviendrait une liste à trier — un sujet distinct, pas créé par cette feature |
| **La hauteur de clavier retenue (301 / 253 pt) est une valeur de référence, pas une mesure sur appareil** | précision des maquettes | Déclaré dans l'en-tête de chaque `code.html`. La valeur exacte vient des événements `Keyboard` à l'exécution et varie avec la langue de saisie et la barre QuickType. Les conclusions des §5.2 et §5.6 ne tiennent pas à quelques points près |
| **Les largeurs de texte sont estimées, pas mesurées sur SF Pro** | précision des mesures de libellé | Les chiffres des §1.4 et §3.2 sont des estimations à 14 pt et 10 pt de corps. Le sens des conclusions ne change pas : « Discussion » ne tient pas dans 30 pt, « Recherche » tient dans 60,8 pt avec une marge mince. **Une vérification sur appareil reste à faire avant d'implémenter la direction B ou C** |
| **La portée dossier n'est pas servie par la greffe E2** | couverture | Vrai, et c'est pourquoi E2 est une **greffe** et non la direction retenue : l'entrée du menu d'en-tête de dossier de la direction D la couvre |
| **`NativeTabs` est en alpha** | stabilité | La recommandation **ne touche pas** `_layout.tsx`, ce qui est le meilleur moyen de ne pas s'exposer à cette instabilité. C'est un argument pour D, et contre C et F |

---

## 10. Sources

Toutes consultées le **2026-10-07**. Les pages d'Apple et de Material sont rendues en JavaScript :
le texte d'Apple a été lu via l'endpoint de données DocC de la même page, celui de Material via un
rendu headless de l'URL publique citée.

**Lignes directrices de plate-forme**

1. Apple HIG — Tab bars : <https://developer.apple.com/design/human-interface-guidelines/tab-bars>
2. Apple HIG — Sheets : <https://developer.apple.com/design/human-interface-guidelines/sheets>
3. Apple HIG — Generative AI :
   <https://developer.apple.com/design/human-interface-guidelines/generative-ai>
4. Apple HIG — Modality : <https://developer.apple.com/design/human-interface-guidelines/modality>
5. SwiftUI — `tabViewBottomAccessory(content:)` :
   <https://developer.apple.com/documentation/swiftui/view/tabviewbottomaccessory(content:)>
6. UIKit — `UITabBarController.bottomAccessory` :
   <https://developer.apple.com/documentation/uikit/uitabbarcontroller/bottomaccessory>
7. Material 3 — Navigation bar : <https://m3.material.io/components/navigation-bar/guidelines>
8. Material 3 — Tabs : <https://m3.material.io/components/tabs/guidelines>
9. Material 3 — Bottom sheets : <https://m3.material.io/components/bottom-sheets/guidelines>
10. Material 3 — Floating action button :
    <https://m3.material.io/components/floating-action-button/guidelines>

**Applications de référence**

11. Gemini Notebook — « Use chat » : <https://support.google.com/gemininotebook/answer/16179559>
12. Gemini Notebook — l'app mobile : <https://support.google.com/gemininotebook/answer/16296687>
13. Readwise Reader — « Chat with your documents » :
    <https://docs.readwise.io/reader/guides/ghostreader/chat>
14. Readwise Reader — « Global Ghostreader » :
    <https://docs.readwise.io/reader/guides/ghostreader/global>
15. YouTube — « Ask YouTube on the watch page » :
    <https://support.google.com/youtube/answer/14110396>
16. Snipd : <https://www.snipd.com/>
17. Podwise : <https://podwise.ai/>
18. Notion — « Notion AI FAQs » : <https://www.notion.com/help/notion-ai-faqs>

**Dépôt** (lus, non modifiés)

`mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/search.tsx`,
`mobile/app/(tabs)/digest/[period].tsx`, `mobile/app/media/[id].tsx`,
`mobile/app/media/folders/[id].tsx`, `mobile/src/components/CompletedDetailView.tsx`,
`mobile/src/components/MediaReaderBar.tsx`, `mobile/src/components/ScreenTabs.tsx`,
`mobile/src/components/ArtifactsPanel.tsx`, `mobile/src/components/ArtifactTile.tsx`,
`mobile/src/components/TranscriptReader.tsx`, `mobile/src/components/UrlEntryDialog.tsx`,
`mobile/src/components/RenameDialog.tsx`, `mobile/src/lib/artifactRefusal.ts`,
`mobile/src/constants/theme.ts`, `mobile/src/i18n/en.ts`, `mobile/src/i18n/fr.ts`,
`mobile-design-mockups/my_design_system/DESIGN.md`,
`mobile-design-mockups/notebooklm-reference/`,
`mobile-design-mockups/media_reading_tab_refonte/README.md`,
`docs/research/task-430-chatbot-architecture/README.md`,
`docs/research/task-427-ask-question-vs-chatbot/README.md` (§9 seulement).

**Typages de dépendances installées** (lus pour établir la faisabilité)

- `expo-router@~55.0.16` — `build/native-tabs/NativeTabs.d.ts`,
  `build/native-tabs/common/elements.d.ts:201-225`, `build/native-tabs/types.d.ts`,
  `build/native-tabs/utils/bottomAccessory.d.ts`.
- `react-native@0.83.6` — `Libraries/Text/Text.d.ts`,
  `Libraries/Components/TextInput/TextInput.d.ts`.
- `@expo/vector-icons` — `build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json` et
  `Fonts/Ionicons.ttf`, pour l'extraction des contours de glyphes des maquettes.
