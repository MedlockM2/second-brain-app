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
- [ ] #1 La navigation actuelle est inventoriée avec ses fichiers et ses symboles : les quatre onglets principaux de mobile/app/(tabs)/_layout.tsx, le segment Lecture | IA de CompletedDetailView.tsx et son repli dans MediaReaderBar.tsx, les onglets Sources | IA de folders/[id].tsx, la primitive ScreenTabs.tsx et ses quatre appelants, ArtifactsPanel et les deux portées qui le partagent, et les écrans qui montent CompletedDetailView
- [ ] #2 Une revue web sourcée couvre les recommandations d'Apple et de Material sur les barres d'onglets (nombre de destinations, ajout d'une destination, feuilles modales) et au moins cinq références d'applications offrant une conversation sur du contenu de l'utilisateur ; chaque constat cite son URL et sa date de consultation
- [ ] #3 Les trois questions de l'owner reçoivent chacune une réponse explicite et argumentée dans le README de recherche : chat dans l'onglet IA contre troisième onglet, chat global et son prix dans la barre d'onglets, et au moins une direction sur six qui sort du cadre de ces deux questions
- [ ] #4 Six directions distinctes sont livrées sous mobile-design-mockups/chatbot_integration_ui/, dans six sous-répertoires nommés, plus un README.md d'index ; chaque sous-répertoire contient un code.html autonome (aucun script, link ou img, aucune URL distante) et un screen.png rendu à 1200 px de large
- [ ] #5 Chaque direction traite les trois portées — un média, un dossier, et une portée globale si elle en propose une — ou dit explicitement laquelle elle ne sert pas et pourquoi
- [ ] #6 Chaque direction dessine le composeur de saisie libre, qui n'existe pas dans l'app aujourd'hui : sa hauteur au repos, clavier ouvert, l'envoi, le compteur de longueur et le cas d'une question longue
- [ ] #7 Chaque direction montre l'attente d'une réponse dans les deux régimes, texte en flux et réponse arrivant d'un bloc après 5 à 15 s, ainsi que l'état d'erreur et le refus de quota, sans supposer l'architecture retenue par task-430
- [ ] #8 Toute direction qui ajoute, remplace, déplace ou évince un onglet principal cite la règle Apple ou Material qui s'y applique, et propose et montre dans sa maquette le chemin d'accès de remplacement vers la page évincée
- [ ] #9 Toute direction qui propose un chat sur toute la bibliothèque dit ce qu'elle devient si cette portée s'avère infaisable, sans supposer la capacité acquise
- [ ] #10 Chaque maquette est rendue à 414x896 pt et à 320x568 pt, en thème clair et en thème sombre ; les débordements et adaptations sont documentés et aucune cible tactile ne descend sous 48 pt
- [ ] #11 Chaque direction respecte les tokens et les règles Amber Clarity de mobile/src/constants/theme.ts ; tout écart est nommé, justifié et proposé comme évolution explicite du design system plutôt que codé en dur
- [ ] #12 Le README de recherche compare les six directions sur la découvrabilité du chat, le coût de navigation pour revenir à une conversation en cours, la cohabitation avec les artefacts, la charge imposée à ScreenTabs et à ArtifactsPanel, l'accessibilité et la faisabilité React Native, puis formule une recommandation et un repli
- [ ] #13 Le README de recherche dit, pour chaque direction, quels fichiers de mobile/ sont à étendre et ce qui est entièrement neuf, sans supposer l'architecture de task-430
- [ ] #14 Le livrable de recherche est docs/research/task-434-chatbot-integration-ui/README.md, avec front-matter owner_decision: pending et une section Owner Validation prête à être complétée ; la tâche reste à To Do dans l'attente de cette décision
- [ ] #15 Aucun fichier de mobile/ ni de media_summarizer/ n'est modifié : ils sont lus pour l'inventaire et pour les tokens
<!-- AC:END -->
