# Direction 7 : « Studio remanié »

Les six premières directions remettent en cause le principe de l’onglet. Celle-ci le garde : on choisit un format,
l’IA le rédige à partir de la source. Elle refait tout ce qui l’entoure selon les bonnes pratiques établies, et va
jusqu’au détail de la page de chaque fiche.

| Dossier | Contenu |
|---|---|
| `onglet_et_creation/` | les principes, l’onglet (média, première visite, dossier, 320 pt), la création (options, attente courte, attente longue, prête ailleurs, échec), le menu d’une fiche |
| `fiche_resume/` | résumé : haut de page, fin de page, version dossier |
| `fiche_resume_detaille/` | résumé détaillé : haut de page, lecture en cours, citations d’un dossier |
| `fiche_notes/` | notes de cours : objectifs et notions, actions et glossaire |
| `fiche_cartes_memo/` | cartes mémo : accueil du paquet, recto, verso, fin de série |
| `fiche_quiz/` | quiz : accueil, question, correction, bilan |

Chaque page liste ce que le modèle produit aujourd’hui pour ce format et ce qui change. Les contenus sont fictifs ;
les champs, eux, sont ceux des générateurs (`media_summarizer/workers/artifact_generator/generators/`).

## Ce qui change dans l’onglet

- **Une liste au lieu de deux.** Une carte par format, dans un ordre fixe, qui porte tout le cycle de la fiche : à
  créer, en préparation, prête, échouée. « Générer » et « Généré » disparaissent : l’action s’appelle « Créer »,
  le résultat est une fiche. C’est le principe de la variante A de `../../ai_tab_refonte/`.
- **Deux groupes par usage**, « Lire » (résumé, résumé détaillé, notes) et « S’entraîner » (cartes mémo, quiz).
  L’onglet s’appelle « Fiches » : un libellé dit ce qu’on trouve, pas la technique.
- **Une carte prête en dit assez pour choisir** : titre de la fiche, durée de lecture ou nombre de cartes, dernier
  score pour un entraînement.
- **Des options à la demande.** Les trois formats de lecture se créent d’un appui. Le quiz et les cartes ouvrent
  une feuille courte (nombre, difficulté, sujet), dont les valeurs par défaut suffisent.
- **Le coût annoncé avant le geste, sur un dossier** : 1 min de forfait pour 5 sources (task-287), dans
  l’introduction, la feuille et le bouton. Sur un média, il n’y a rien à annoncer.
- **La création ouvre la fiche.** Un appui ouvre la page tout de suite, en squelette de sa forme finale. On peut
  partir : un toast dit « prêt » où que l’on soit dans l’app. Cela remplace l’écran « Pas encore prêt » et son
  bouton Actualiser.
- **Un menu par fiche** (⋯ ou appui long) : partager, copier, ouvrir la source, recréer, supprimer.

## Ce qui change dans les pages de fiche

Ce qui est commun aux cinq pages :

- **Le titre de la fiche** devient le titre de la page. Aujourd’hui, c’est celui de la source.
- **Une ligne de type** avec la durée de lecture ou le nombre d’éléments. Le résumé détaillé y porte son propre
  nom : aujourd’hui, il partage la clé de libellé du résumé court.
- **La source** dans une carte qui s’ouvre ; sur un dossier, « D’après 12 sources », et un encart « Mettre à jour »
  si le dossier a changé.
- **Partager et ⋯** dans l’en-tête, qui se réduit au titre quand on défile.
- **« Et ensuite ? »** en pied de page, puis un retour sur la qualité (pouce haut ou bas) et une mention qui rappelle
  que la fiche est rédigée par l’IA.

Ce qui change format par format :

| Format | Aujourd’hui | Proposé |
|---|---|---|
| Résumé | points, puis la conclusion en dernier | l’essentiel en tête (pyramide inversée), points numérotés |
| Résumé détaillé | cinq sections à la suite, `source_ref` affiché tel quel | sommaire collant, barre de lecture, citations attribuées à leur source et cliquables |
| Notes de cours | « CORE » en anglais, actions à coche décorative | objectifs en contrat de lecture, « Essentiel » et « Complément », actions qu’on coche, glossaire alphabétique |
| Cartes mémo | toutes les cartes empilées, réponse à toucher | accueil du paquet, séance plein écran, « Afficher la réponse », « À revoir » et « Je savais », fin de série et révision des cartes manquées |
| Quiz | corrigé au premier appui, « Terminé » sans score | accueil, choisir puis valider, correction avec la bonne réponse, bilan avec les erreurs, refaire seulement les erreurs |

## Les bonnes pratiques, et d’où elles viennent

| Pratique | Appliquée à | Source |
|---|---|---|
| Moins d’une seconde : aucun indicateur. Moins de 10 s : un squelette de la page, pas une barre. Au-delà de 10 s : une estimation de durée | création d’une fiche sur un média ; sur un dossier | [NN/g, Skeleton screens](https://www.nngroup.com/articles/skeleton-screens/), [Cloudscape, Progressive steps](https://cloudscape.design/patterns/genai/progressive-steps/) |
| Un statut court et discret, le détail à la demande | ligne « Rédaction en cours » | Cloudscape, Progressive steps |
| Pendant une attente longue, donner quelque chose à faire ou à voir | on peut quitter la page ; un toast prévient | [Apple HIG, Loading](https://developer.apple.com/design/human-interface-guidelines/loading) |
| Un état vide qui explique ce que la zone contiendra et donne un chemin direct | première visite, format recommandé | [NN/g, Designing empty states](https://www.nngroup.com/articles/empty-state-interface-design/) |
| Texte web : on balaye, conclusion d’abord, intertitres parlants | l’essentiel en tête, sommaire, points numérotés | NN/g, How users read on the web (Nielsen 1997) |
| Révision : question, « Afficher la réponse », auto-évaluation | séance de cartes mémo | [Anki, Studying](https://docs.ankiweb.net/studying.html) |
| Tri « Encore en apprentissage » / « Connu » | « À revoir » / « Je savais » | [Quizlet, Studying with flashcards](https://help.quizlet.com/hc/en-us/articles/360030988091) |
| Retour immédiat sur l’exactitude ; retour différé en plus du retour immédiat | correction à chaque question, puis bilan | [Kolibri 0.10](https://blog.learningequality.org/kolibri-0-10-exercise-mastery-d7213efd6f58), Codecademy (blog, retours immédiat et différé) |
| Un retour qui donne le verdict et la bonne réponse corrige mieux qu’un verdict seul | panneau de correction | études sur l’effet de test, synthèse UBC ([The testing effect](https://blogs.ubc.ca/assessmentguidebook/assessment-appendix/the-testing-effect/)) |
| Éloigner les contrôles qu’on confond, éviter les appuis accidentels | choisir puis valider | Kolibri 0.10 |
| Options de format : nombre, difficulté, sujet | feuille de création du quiz et des cartes | NotebookLM (réglages des cartes et des quiz, 9to5Google) |
| Recueillir un retour sur une sortie d’IA, dire qu’elle est générée | pied de page des fiches | Google PAIR Guidebook, chapitre « Feedback + Control » |

Les liens ont été consultés le 2026-10-26. Les sources de Codecademy, Kolibri et NotebookLM sont des billets de blog
ou de presse, pas des études : elles décrivent une pratique, sans en prouver l’effet. La page Apple n’a pas pu
être lue directement ; ce qui en est cité provient d’un résumé de recherche.

## Ce qu’il faut au backend et à l’app

| Besoin | Où | Nouveau ? |
|---|---|---|
| Options de création (nombre, difficulté, sujet) passées au générateur | API et générateurs quiz et cartes | oui, backend |
| Coût d’une création sur un dossier, et solde restant | feuille de création d’un dossier | la règle existe (task-287) ; il faut l’exposer avant le geste |
| Sondage du statut sur la page de fiche, et squelette par type | `app/artifacts/[artifactId].tsx` | app seulement |
| Toast « prêt » hors de l’onglet | état global de l’app | app seulement |
| Résolution de `source_ref` (`[S2]`) en titre et type de source | citations, cartes et quiz d’un dossier | le backend la fait déjà pour `sources` ; à exposer par élément |
| Actions cochées, résultats des séances de cartes et de quiz | notes, cartes, quiz, onglet | sur l’appareil seulement ; un historique entre appareils serait du backend |
| Retour pouce haut ou bas | pied de page des fiches | oui, backend (stockage du retour) |
| Couleur « juste » (vert) | quiz, cartes | ajout de deux tokens à `theme.ts` |

Effort estimé : **M**. Aucune brique n’est inconnue ; le plus long est la séance plein écran des cartes et du quiz.

## À vérifier

- **Le vert.** Le design system n’a pas de couleur de succès : la page actuelle marque une bonne réponse en ambré.
  L’ambré servant déjà aux actions, un vert distinct évite de lire « bouton » sur une réponse. Il faut l’ajouter
  aux tokens et vérifier son contraste en mode sombre.
- **« Environ 1 minute » sur un dossier** est une hypothèse : la durée d’une création sur 15 sources n’est pas
  mesurée. Il faut la mesurer avant d’écrire l’estimation, ou la calculer à partir du nombre de sources.
- **Un message « prêt » quand l’app est fermée** suppose une notification push par fiche. La livraison existe
  (task-368), mais pas cet usage. Sans cette notification, le texte de l’attente longue doit dire « dans l’app ».
- **Le score conservé sur l’appareil** disparaît quand on change de téléphone. C’est acceptable pour un repère
  personnel ; un suivi réel de la mémorisation relève de la direction 3.
