---
id: TASK-434
title: >-
  Benchmarker 6 directions d'intégration du chatbot dans l'UI de l'app, du média
  au dossier jusqu'à une portée globale
status: To Do
assignee: []
created_date: '2026-10-07 10:07'
labels:
  - benchmark
  - mobile
  - ui
  - ux
dependencies: []
references:
  - mobile/app/(tabs)/_layout.tsx
  - mobile/src/components/CompletedDetailView.tsx
  - mobile/src/components/MediaReaderBar.tsx
  - mobile/src/components/ScreenTabs.tsx
  - mobile/src/components/ArtifactsPanel.tsx
  - 'mobile/app/media/folders/[id].tsx'
  - mobile/src/constants/theme.ts
  - mobile-design-mockups/my_design_system/
  - mobile-design-mockups/media_reading_tab_refonte/README.md
  - mobile-design-mockups/notebooklm-reference/
  - docs/research/task-430-chatbot-architecture/README.md
  - docs/research/task-410-media-reading-tab-refonte/README.md
priority: medium
type: spike
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Objectif

Produire **six propositions d'intégration réellement distinctes** pour faire entrer le chatbot conversationnel dans l'interface de l'app, et permettre à l'owner de choisir **avant** toute implémentation. La question n'est pas celle d'un écran : c'est celle de la place du chat dans la navigation entière, à trois portées — un média, un dossier, et éventuellement la bibliothèque entière.

## Les trois questions de l'owner, à trancher et non à supposer

**1. Au niveau des artefacts, ou dans un onglet de plus ?** Le chat se loge-t-il dans l'onglet IA existant, à côté des artefacts que `ArtifactsPanel` y rend déjà, ou devient-il un **troisième onglet** — à côté de « Lecture » et « IA » sur un média, et à côté de « Sources » et « IA » sur un dossier ?

**2. Un chat global, et à quel prix dans la barre d'onglets ?** Attention, le fait est différent de ce que l'énoncé suppose : **il y a quatre onglets principaux, pas trois** — `inbox`, `search` (la Librairie), `digest` et `account`, déclarés en `NativeTabs.Trigger` dans `mobile/app/(tabs)/_layout.tsx:98-153`. La question « remplacer un onglet par Chat » n'est donc pas la seule possible : un **cinquième** onglet est peut-être tenable, et le benchmark doit le dire, sources Apple et Material à l'appui, plutôt que de le supposer. Toute direction qui **remplace, déplace ou évince** un onglet existant doit proposer **et montrer dans la maquette** le chemin d'accès de remplacement vers la page évincée.

**3. Mieux, si mieux existe.** Les deux premières questions ne bornent pas le périmètre. Au moins **une des six directions doit en sortir** : entrée contextuelle depuis une sélection de texte dans le lecteur, point d'entrée depuis le Digest, conversation ouverte depuis une recherche, composeur persistant, feuille modale invocable de partout, ou toute autre idée que la revue des pratiques fait apparaître.

## Ce qui rend ce benchmark possible maintenant

**Il doit être indépendant de l'architecture.** Le benchmark d'architecture (`docs/research/task-430-chatbot-architecture/README.md`) est en cours de complément et **n'est pas tranché** : on ne sait pas encore si la réponse arrivera en flux ou d'un coup. Ce benchmark-ci ne doit donc ni supposer le streaming ni le supposer absent : chaque direction montre son attente **dans les deux régimes** — texte qui s'écrit token par token, et réponse qui apparaît d'un bloc après 5 à 15 s. C'est précisément ce qui lui permet de tourner en parallèle, et sa recommandation ne doit pas dépendre du choix de transport.

Même règle pour la portée : la faisabilité technique d'un chat sur **toute la bibliothèque** n'est pas établie (task-430 §13.1 la nomme comme benchmark distinct). Une direction qui propose un chat global doit donc dire ce qu'elle devient **si cette capacité n'existe pas** — portée réduite, entrée masquée, ou autre — sans la supposer acquise.

## Faits du dépôt à inventorier, pas à redécouvrir

- **Barre d'onglets** : `mobile/app/(tabs)/_layout.tsx`, quatre `NativeTabs.Trigger` (`inbox`, `search`, `digest`, `account`) avec leurs glyphes Ionicons. C'est une barre **native** : dire ce que ça contraint.
- **Page média** : le segment « Lecture | IA » vit dans `mobile/src/components/CompletedDetailView.tsx`, et `mobile/src/components/MediaReaderBar.tsx` replie ce segment en deux glyphes au défilement. Un troisième segment doit tenir **dans les deux**. Et `CompletedDetailView` est **aussi monté par le Digest** (constat de task-410) : un onglet de plus apparaît donc là aussi.
- **Page dossier** : `FolderTabKey = "sources" | "ai"` et `FOLDER_TABS` en `mobile/app/media/folders/[id].tsx:110-123`.
- **La primitive partagée** : `mobile/src/components/ScreenTabs.tsx`, utilisée par `search.tsx`, `folders/[id].tsx`, `CompletedDetailView.tsx` et `MediaReaderBar.tsx`. Dire ce qu'un troisième onglet lui coûte, et si elle tient à trois sans refonte.
- **`ArtifactsPanel` est partagé verbatim** entre l'onglet IA du média et celui du dossier (`mobile/app/media/folders/[id].tsx:562`). Une direction qui loge le chat dedans le modifie donc **pour les deux portées à la fois** : le dire.
- **L'app n'a aucun composeur de texte libre multiligne** : il n'existe que `UrlEntryDialog` et `RenameDialog`. C'est le poste d'UI le plus lourd de cette feature, et **chaque direction doit le dessiner**, clavier ouvert compris.
- **Design system Amber Clarity** : tokens autoritaires dans `mobile/src/constants/theme.ts`, références dans `mobile-design-mockups/my_design_system/`. Le **thème sombre existe désormais** (task-433), donc les maquettes se montrent dans les deux thèmes.
- **Matière de comparaison déjà au dépôt** : `mobile-design-mockups/notebooklm-reference/`.
- Le projet n'a **pas d'ancienne base installée à préserver** : une direction retenue peut remplacer directement la composition actuelle.

Du benchmark task-427, **seule la section §9 (le tableau des cinq concurrents directs et leur modèle d'interaction) est à lire**, comme matière produit. Ses conclusions d'architecture ne lient pas ce benchmark.

## Livrable attendu

Créer `mobile-design-mockups/chatbot_integration_ui/` : un `README.md` d'index comparant les six pistes, et six sous-répertoires nommés, un par direction, chacun avec un `code.html` autonome et un `screen.png`, selon les conventions des répertoires existants (`digest_direction_*`, `media_reading_tab_refonte/`). L'analyse, la comparaison et la recommandation vont dans `docs/research/task-434-chatbot-integration-ui/README.md`.

## Hors périmètre

- Toute implémentation React Native, tout changement de contrat backend, tout endpoint.
- Trancher l'architecture du chatbot (task-430) ou la faisabilité de la portée bibliothèque (task-430 §13.1).
- Le site web et l'extension navigateur (task-424).
- Ajouter des tests automatisés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La navigation actuelle est inventoriée avec ses fichiers et ses symboles : les quatre onglets principaux de mobile/app/(tabs)/_layout.tsx, le segment Lecture | IA de CompletedDetailView.tsx et son repli dans MediaReaderBar.tsx, les onglets Sources | IA de folders/[id].tsx, la primitive ScreenTabs.tsx et ses quatre appelants, ArtifactsPanel et les deux portées qui le partagent, et les écrans qui montent CompletedDetailView
- [x] #2 Une revue web sourcée couvre les recommandations d'Apple et de Material sur les barres d'onglets (nombre de destinations, ajout d'une destination, feuilles modales) et au moins cinq références d'applications offrant une conversation sur du contenu de l'utilisateur ; chaque constat cite son URL et sa date de consultation
- [x] #3 Les trois questions de l'owner reçoivent chacune une réponse explicite et argumentée dans le README de recherche : chat dans l'onglet IA contre troisième onglet, chat global et son prix dans la barre d'onglets, et au moins une direction sur six qui sort du cadre de ces deux questions
- [x] #4 Six directions distinctes sont livrées sous mobile-design-mockups/chatbot_integration_ui/, dans six sous-répertoires nommés, plus un README.md d'index ; chaque sous-répertoire contient un code.html autonome (aucun script, link ou img, aucune URL distante) et un screen.png rendu à 1200 px de large
- [x] #5 Chaque direction traite les trois portées — un média, un dossier, et une portée globale si elle en propose une — ou dit explicitement laquelle elle ne sert pas et pourquoi
- [x] #6 Chaque direction dessine le composeur de saisie libre, qui n'existe pas dans l'app aujourd'hui : sa hauteur au repos, clavier ouvert, l'envoi, le compteur de longueur et le cas d'une question longue
- [x] #7 Chaque direction montre l'attente d'une réponse dans les deux régimes, texte en flux et réponse arrivant d'un bloc après 5 à 15 s, ainsi que l'état d'erreur et le refus de quota, sans supposer l'architecture retenue par task-430
- [x] #8 Toute direction qui ajoute, remplace, déplace ou évince un onglet principal cite la règle Apple ou Material qui s'y applique, et propose et montre dans sa maquette le chemin d'accès de remplacement vers la page évincée
- [x] #9 Toute direction qui propose un chat sur toute la bibliothèque dit ce qu'elle devient si cette portée s'avère infaisable, sans supposer la capacité acquise
- [x] #10 Chaque maquette est rendue à 414x896 pt et à 320x568 pt, en thème clair et en thème sombre ; les débordements et adaptations sont documentés et aucune cible tactile ne descend sous 48 pt
- [x] #11 Chaque direction respecte les tokens et les règles Amber Clarity de mobile/src/constants/theme.ts ; tout écart est nommé, justifié et proposé comme évolution explicite du design system plutôt que codé en dur
- [x] #12 Le README de recherche compare les six directions sur la découvrabilité du chat, le coût de navigation pour revenir à une conversation en cours, la cohabitation avec les artefacts, la charge imposée à ScreenTabs et à ArtifactsPanel, l'accessibilité et la faisabilité React Native, puis formule une recommandation et un repli
- [x] #13 Le README de recherche dit, pour chaque direction, quels fichiers de mobile/ sont à étendre et ce qui est entièrement neuf, sans supposer l'architecture de task-430
- [x] #14 Le livrable de recherche est docs/research/task-434-chatbot-integration-ui/README.md, avec front-matter owner_decision: pending et une section Owner Validation prête à être complétée ; la tâche reste à To Do dans l'attente de cette décision
- [x] #15 Aucun fichier de mobile/ ni de media_summarizer/ n'est modifié : ils sont lus pour l'inventaire et pour les tokens
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Mode initial — benchmark produit, **en attente de la validation de l'owner**

`docs/research/task-434-*` n'existait pas : ni `README.md` actif, ni `README.owner-rejected-*.md`,
ni `complement-request-*.md`. **Mode initial**, benchmark produit depuis zéro ; aucun retour
antérieur à intégrer.

### Livrables

1. **`mobile-design-mockups/chatbot_integration_ui/`** — un `README.md` d'index comparant les six
   pistes, et six sous-répertoires nommés. Chacun contient un `code.html` **autonome** (vérifié par
   grep : aucun `script`, `link`, `img`, aucune URL distante) et un `screen.png` rendu à
   **1200 px de large** (21 000 à 27 000 px de haut selon la direction). Glyphes Ionicons extraits
   de l'`Ionicons.ttf` installé, tokens repris de `mobile/src/constants/theme.ts` **une fois par
   palette** (claire et sombre).
2. **`docs/research/task-434-chatbot-integration-ui/README.md`** — l'analyse (~1 100 lignes), avec
   `owner_decision: pending` et la section `Owner Validation` prête à être complétée.

### Les six directions

| | Nom | Où vit le chat |
|---|---|---|
| **A** | `direction_a_dans_longlet_ia/` | en tête de l'onglet IA, au-dessus des pastilles de génération |
| **B** | `direction_b_troisieme_onglet/` | un troisième onglet intra-écran « Discussion » / « Chat » |
| **C** | `direction_c_cinquieme_onglet/` | un cinquième onglet principal « Chat » (+ variante qui évince `digest`) |
| **D** | `direction_d_feuille_invocable/` | une feuille non modale invocable de partout, réductible en pilule |
| **E** | `direction_e_depuis_le_texte/` | une sélection (E1) ou un paragraphe (E2) du lecteur, passage joint |
| **F** | `direction_f_composeur_persistant/` | `NativeTabs.BottomAccessory` au-dessus de la barre (iOS 26+) |

### Les trois questions de l'owner

1. **Au niveau des artefacts, ou un onglet de plus ?** **Ni l'un ni l'autre.** A est écartée parce
   qu'`ArtifactsPanel` est partagée verbatim (donc modifier les deux portées en un geste, contre la
   règle écrite dans ce fichier) et parce que son composeur vit dans le `ScrollView` d'une page qui
   est aussi une vignette du carrousel horizontal du Digest. B est écartée pour deux débordements
   **mesurés** (libellé « Discussion » tronqué aux deux tailles ; titre de la barre repliée à
   **36 pt** à 320 pt) plus une restructuration de `CompletedDetailView`.
2. **Un chat global, et à quel prix dans la barre ?** Fait corrigé : la barre a **quatre** onglets.
   Un **cinquième est tenable**, au maximum exact de Material (« *three to five destinations* »,
   « *Avoid putting more than five* ») et à la limite d'Apple (« *five or fewer* », « *Avoid
   overflow tabs* ») : 79,6 pt par item à 414 pt, **60,8 pt** à 320 pt. Mais le prix réel est la
   **permanence** : Apple interdit de griser ou de masquer un onglet vide. **Un chat global ne se
   paie donc pas forcément dans la barre** : D l'obtient par un bouton de 44 pt dans l'en-tête de
   la Librairie, F par un accessoire qui n'est pas une destination. La variante qui évince `digest`
   est dessinée **avec son chemin de remplacement** (carte « Votre Digest du jour » en tête
   d'Accueil, même route).
3. **Mieux, si mieux existe ?** **Trois** directions sortent du cadre des deux premières : D (la
   feuille), E (l'entrée par le texte) et F (l'accessoire de barre).

### Recommandation et repli

**Recommandation : direction D, avec l'entrée contextuelle E2 greffée dessus** (appui long sur un
paragraphe → la même feuille avec le passage joint). Trois raisons mesurées : D est la **seule**
des six à ne modifier **aucune** des trois structures de navigation existantes (`_layout.tsx`,
`ScreenTabs`, `ArtifactsPanel`) ; c'est celle dont la dégradation est la moins coûteuse si la portée
bibliothèque s'avère infaisable (un bouton qui n'est pas rendu, aucune destination vide) ; et sa
pilule réduite ramène à **un** tapotement le retour à une conversation en cours, ce qui vaut dans
les deux régimes d'attente. E1 est écarté sur un fait du dépôt : `Text` n'expose pas
d'`onSelectionChange` en React Native, seul `TextInput` le fait.

**Repli : direction C**, le cinquième onglet, si l'owner juge la découvrabilité décisive ou veut que
le chat soit un **lieu** nommé du produit. Les deux sont compatibles : les pièces neuves de D
(`ChatSheet`, `ChatComposer`, `ChatThread`, `ChatSessionContext`, `chatService`) se réutilisent
telles quelles si C est préférée plus tard, et réciproquement. **F est recommandée pour plus tard**,
quand `NativeTabs` ne sera plus en alpha et que le chat aura un usage mesuré.

### Indépendances tenues

- **Architecture non supposée** : chaque direction dessine l'attente dans les **deux** régimes
  (flux token par token avec bouton d'arrêt ; pilule nommée pendant 5 à 15 s), plus l'erreur, le
  refus de quota et la conversation pleine. Aucune note du classement ne porte sur le transport.
- **Portée bibliothèque non supposée** : C, D et F disent **et dessinent** ce qu'elles deviennent
  sans elle ; A, B et E déclarent ne pas la servir et disent pourquoi.
- **Plafond de saisie non supposé** : le compteur dessiné à 1 000 caractères est une valeur
  candidate de task-430, signalée comme telle dans les six pages.

### Revue sourcée

Apple HIG (Tab bars, Sheets, Generative AI, Modality), `tabViewBottomAccessory(content:)`,
`UITabBarController.bottomAccessory`, Material 3 (Navigation bar, Tabs, Bottom sheets, FAB), et
**six** applications de référence (Gemini Notebook, Readwise Reader, YouTube « Ask », Snipd,
Podwise, Notion AI). Chaque constat cite son URL et sa date de consultation (2026-10-07).

### Correction factuelle à l'énoncé

`ScreenTabs` a **trois** appelants, pas quatre : `CompletedDetailView.tsx:1296`,
`MediaReaderBar.tsx:135` et `folders/[id].tsx:448`. La quatrième occurrence, `search.tsx:691`, est
un **commentaire qui explique pourquoi la primitive a été écartée** sur la Librairie — ce qui est
précisément la raison pour laquelle aucune direction en onglet intra-écran ne peut y loger un chat
global.

### Périmètre respecté

**Aucun fichier de `mobile/` ni de `media_summarizer/` n'a été modifié** (l'état de l'arbre de
travail le confirme) : ils ont été lus pour l'inventaire et pour les tokens. Les seules écritures
sont `mobile-design-mockups/chatbot_integration_ui/`,
`docs/research/task-434-chatbot-integration-ui/` et ce fichier de tâche.

### Statut

**La tâche reste `To Do`**, et la recommandation **attend la validation de l'owner** via le champ
`owner_decision` du `README.md` de recherche.
<!-- SECTION:NOTES:END -->
