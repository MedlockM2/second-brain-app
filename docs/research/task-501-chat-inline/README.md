---
owner_decision: ok
---

# Benchmark : la source comme premier bloc d’une conversation modale

## Owner Validation

**Decision**: Direction et [maquettes interactives](mockups.html) validées explicitement par l’owner le 12 octobre 2026. Retenir le modal plein écran qui se substitue visuellement à la page média sur place, sans glissement du bas vers le haut. Au toucher sur « Poser une question sur cette source », les onglets Lecture/IA et les commandes de lecture superflues disparaissent ; conversations passées et nouvelle conversation apparaissent en haut, et le clavier s’ouvre. L’icône de nouvelle conversation est le stylo entrant dans un carré (`create-outline`), conformément à la dernière correction validée.

Le transcript intégral conserve sa largeur et ses gouttières et constitue le premier bloc du même fil défilant. La première question apparaît immédiatement après son dernier paragraphe, suivie de la réponse et des relances. Modal fermé, aucun échange n’apparaît sur la page de lecture ; sa position et sa progression sont conservées. Appliquer le même parcours au dossier, avec ses sources au début du fil.

Le composeur n’a ni limite ni compteur de caractères, ni boutons « Masquer le clavier » ou « Reprendre la lecture », ni libellés « Fermer la discussion » ou « Génération en cours ». Conserver l’icône de sortie discrète en haut et le bouton envoyer/arrêter. Réutiliser sessions, historique, flux, reprise, Markdown et citations selon le cadrage ci-dessous. Cette validation clôt le benchmark TASK-501 et débloque son implémentation TASK-502.

**Validated at**: 2026-10-12

## Direction révisée — consignes owner du 12 octobre 2026

**On conserve un modal au-dessus de la page média, mais il se substitue visuellement à elle sur place.** Il ne monte pas du bas, ne réduit pas le transcript à une carte et ne montre pas la page derrière un voile. Le toucher sur « Poser une question sur cette source » fait disparaître les onglets Lecture/IA et les actions de lecture superflues. Un en-tête compact affiche conversations passées et nouvelle conversation ; le clavier apparaît. Le transcript conserve sa largeur et devient le premier bloc du fil. Dès le premier envoi, la question est ajoutée directement après son dernier paragraphe, puis la réponse.

Les corrections owner remplacent la précédente proposition de chat déplié dans la page : **aucun compteur ni plafond de caractères dans les maquettes, aucun bouton pour masquer le clavier ou reprendre la lecture, aucun libellé de fermeture de discussion ou de génération en cours**. La saisie et le bouton envoyer/arrêter suffisent au bas de l’écran. Une icône de fermeture discrète dans l’en-tête permet de quitter le modal. Le clavier peut être fermé par les gestes système ; sa fermeture ne ferme pas la conversation.

Le modal fermé laisse uniquement la page de lecture et son point d’entrée, sans questions/réponses. Son ouverture ne lance aucune requête de génération. La première question, les réponses et les relances appartiennent à une seule surface verticale avec le transcript intégral. Aucun bloc « Discussion » ou état vide ne s’intercale entre le texte et la première question.

**Livrable de cette révision : les [maquettes interactives](mockups.html) et ce cadrage, uniquement.** Aucun code applicatif, quota, modèle ou contrat API n’est modifié. Direction validée par l’owner le 12 octobre 2026 ; TASK-502 peut appliquer cette décision.

## 1. Appuis dans l’application et portée

Audit initial sur la base `250ea575`, révisé ici suivant les consignes owner. La direction produit prime sur les anciennes limites ou descriptions présentes dans ce checkout.

| Surface existante | Conséquence pour la direction révisée |
| --- | --- |
| `CompletedDetailView.tsx`, `MediaReaderBar.tsx` | La lecture a un transcript et deux onglets. Ces onglets restent sur la page de lecture, mais sont absents de la conversation modale. |
| `ChatDock.tsx`, `ChatSheet.tsx` | On conserve un point d’entrée et une présentation modale. Le déplacement vertical et la feuille à hauteur partielle sont remplacés par une surface plein écran sans animation d’entrée. |
| `TranscriptReader.tsx` | Même prose, même largeur, même taille de texte et même ordre des paragraphes dans le lecteur et dans le modal ; conserver sélection, traduction et états du contenu. |
| `ChatComposer.tsx`, `ChatThread.tsx`, `ChatAnswer.tsx` | Réutiliser saisie, messages, Markdown, citations et arrêt. TASK-503 retire le compteur et le plafond de saisie côté client ; quatre lignes restent visibles puis le champ défile. Le serveur applique un garde-fou de 64 000 caractères et le budget total de contexte ; les refus conservent le brouillon. |
| `ChatHistoryList.tsx`, `ChatSessionContext.tsx` | Réutiliser historique paginé et session par portée. Quitter le modal ne demande jamais l’arrêt serveur. |
| `mobile/app/media/folders/[id].tsx` | Même transformation sur Sources : sources conservées au début du fil, Sources/IA absents du modal. Aucun transcript agrégé artificiel n’est inventé pour le dossier. |
| `mobile/app/(tabs)/digest/[period].tsx` | Le modal doit couvrir la page active du Digest, y compris son chrome de navigation ; les pages voisines du pager ne prennent pas le clavier. |
| `theme.ts`, `DESIGN.md` | Amber Clarity clair/sombre, corps 16/25,6, surfaces tonales et cibles 48 minimum. Les mêmes gouttières sont utilisées avant et après ouverture. |

## 2. Recherche externe et limites de la comparaison

Sources officielles consultées le 12 octobre 2026. Les règles de parcours proposées sont une **déduction de design**, pas une prescription des fournisseurs.

| Source primaire | Fait retenu | Application à Deepn |
| --- | --- | --- |
| [React Native 0.83 — ScrollView](https://reactnative.dev/docs/0.83/scrollview) | Tous les enfants sont rendus ; les listes paresseuses sont adaptées aux longs ensembles. La documentation expose le maintien de position et prévient des sauts lors de réordonnancements. | Comparer une extension minimale de la page et une liste par blocs ; ne pas promettre que maintenir une position résout tout. |
| [React Native 0.83 — FlatList](https://reactnative.dev/docs/0.83/flatlist) | Les lignes ont des clés ; les données externes de rendu doivent être signalées. Les hauteurs connues facilitent les sauts ; une cible hors fenêtre sans mesures pose problème. | Une réponse en flux a une hauteur variable. Un simple `scrollToIndex` vers la fin d'un transcript non mesuré n'est pas une solution complète. |
| [React Native 0.83 — KeyboardAvoidingView](https://reactnative.dev/docs/0.83/keyboardavoidingview) | Ajustement de taille, position ou padding ; comportement et décalage dépendent du contexte et de la plateforme. | Garder le champ hors du conteneur défilant, avec un seul propriétaire de l'évitement du clavier. |
| [React Native 0.83 — Keyboard](https://reactnative.dev/docs/0.83/keyboard) | Événements de clavier et synchronisation des changements de layout ; les événements disponibles diffèrent entre plateformes. | Distinguer le montage du modal sans animation et l’ouverture du clavier natif. |
| [Expo — Keyboard handling](https://docs.expo.dev/guides/keyboard-handling/) | Les primitives natives servent aux cas usuels ; Keyboard Controller couvre des interactions avancées et requiert un build de développement ainsi que Reanimated. | Commencer avec le stack installé ; une nouvelle bibliothèque ajouterait ici deux dépendances et une intégration native. |
| [Android — IME animations](https://developer.android.com/develop/ui/compose/system/keyboard-animations) | Les mouvements du contenu et de l'IME doivent être coordonnés. Les exemples utilisent Compose. | Principe utile pour la checklist appareil ; ce code Kotlin n'est pas une recette React Native. |
| [React Native 0.83 — Accessibility](https://reactnative.dev/docs/0.83/accessibility) | Libellés, rôles, états et annonces ont des API dédiées et des différences de plateforme. | Annoncer début/fin/échec, garder l'ordre source-question-réponse et rendre les raccourcis explicites. |
| [Readwise — Chat with your documents](https://docs.readwise.io/reader/guides/ghostreader/chat) | Conversation contextuelle sur un document, disponible aussi sur mobile ; le contenu et la position de lecture font partie de son contexte. | Confirme la pertinence de l'aller-retour lecture/question, sans décider du placement dans Deepn. Deepn n'envoie pas actuellement la position au modèle. |
| [Readwise — Default Ghostreader Prompts](https://docs.readwise.io/reader/guides/ghostreader/default-prompts) | L'entrée mobile « Ask anything » ouvre une feuille de chat avec des commandes contextuelles. | Le point d’entrée contextuel reste pertinent ; Deepn remplace le mouvement de feuille par un modal plein écran sur place avec la source dans le fil. |

Ces références ne démontrent ni la supériorité d'un parcours par mesure d'usage, ni sa fluidité sur nos appareils. Aucun test utilisateur n'a été conduit. Les maquettes sont une simulation HTML autonome : elles permettent de juger hiérarchie, encombrement et transitions, pas les insets natifs, VoiceOver/TalkBack ou la latence du backend.

## 3. Comparaison des parcours après les corrections owner

| Option | Transcript et échanges | Chrome et transition | Conclusion |
| --- | --- | --- | --- |
| **A. Modal plein écran sur place, source au début du fil** | Même largeur ; source complète puis questions/réponses | Onglets retirés ; historique/nouveau en haut ; entrée sans glissement | **Direction demandée**, représentée dans les nouvelles maquettes |
| B. Chat dépliable dans Lecture, proposition précédente | Source puis fil | Onglets visibles, seconde barre d’actions, raccourci lecture | Remplacée : trop de chrome et commandes inutiles |
| C. Feuille modale actuelle | Transcript derrière la conversation | La feuille monte et recouvre la page | Remplacée : mouvement explicitement refusé et source séparée du fil |
| D. Transcript repliable | Source remplacée par un résumé ou compteur au moment de discuter | Libère de la hauteur | Ne conserve pas le transcript comme premier bloc intégral |
| E. Troisième onglet Discussion | Lecture et conversation séparées | Nouveau segment et navigation entre deux lieux | Ne suit pas la demande de continuité |
| F. Discussion dans IA | Source hors du fil | Mélange conversation et artefacts | Ne suit pas le parcours demandé |
| G. Deux panneaux indépendants | Transcript et chat défilent séparément | Deux petites fenêtres avec clavier | Trop peu de hauteur sur téléphone et gestes concurrents |
| H. Route de chat dédiée | Peut reprendre la source au début | Navigation visible vers un autre écran | Même contenu possible, mais le modal sans déplacement exprime mieux la transformation sur place demandée |

La comparaison est qualitative. La direction A n’est pas issue d’un score de performance : elle applique la précision owner sur le placement et la transition. Les références techniques existantes restent utiles pour le clavier et les longs contenus ; aucune nouvelle bibliothèque n’est nécessaire aux maquettes.

## 4. Transition et géométrie

### Au repos

La page garde son en-tête de média, Lecture/IA, le transcript et le point d’entrée « Poser une question sur cette source ». Les commandes d’historique/nouvelle conversation sont réservées au mode conversation. Les questions/réponses restent invisibles.

### Au toucher

Le modal occupe la même surface que la page, immédiatement : **aucune translation, aucun zoom, aucune feuille qui progresse du bas vers le haut**. Il n’a ni poignée de feuille ni marge latérale, ni rayon autour du transcript, ni backdrop visible. Les arrondis des cadres de téléphone dans le fichier HTML sont uniquement une présentation de revue.

L’en-tête de lecture est remplacé par une rangée compacte : fermeture par icône, titre de la source, conversations passées et nouvelle conversation. Les onglets disparaissent. Le transcript garde la même largeur et les mêmes gouttières de texte ; ce n’est pas une bulle utilisateur. Sa position de défilement est reprise à l’ouverture, sans saut automatique vers sa fin. La hauteur utile change avec le retrait des onglets et l’apparition du clavier ; la maquette ne prétend pas figer la position verticale de chaque ligne pendant cette adaptation.

Le clavier ouvre directement le champ. Le mouvement natif du clavier reste indépendant de la présentation du modal : l’interdiction de glissement vise la surface de chat, pas l’animation du clavier du système.

### Au premier envoi

La question est ajoutée **immédiatement après le dernier paragraphe**. Aucun titre « Discussion », notice vide ou compteur ne la sépare du transcript. La réponse suit, puis les relances. L’envoi rejoint ce premier tour, en gardant un morceau de la fin du transcript visible lorsque la hauteur le permet. Un long transcript n’est ni tronqué ni replié : il reste accessible au-dessus, dans le même défilement.

Le bouton d’envoi devient le bouton d’arrêt pendant la réponse. Il n’y a pas de ligne supplémentaire annonçant la génération. Un arrêt ou un échec doit rester explicite pour qu’une réponse partielle ne passe pas pour complète ; ce message terminal se place au niveau de la réponse, pas comme chrome permanent.

## 5. Défilement, clavier et contenus longs

Une seule surface verticale contient la source et le fil. Le composeur reste fixé au-dessus du clavier. Le lecteur peut remonter au transcript naturellement ; aucun bouton de reprise de lecture n’est ajouté. Le flux suit le bas seulement tant que l’utilisateur n’a pas remonté volontairement. Les changements de taille des réponses ne doivent pas arracher le passage relu.

| Structure possible | Avantage | Coût / limite |
| --- | --- | --- |
| Lecteur existant puis fil dans un viewport modal unique | Réutilise sélection, traduction et paragraphes ; source et réponses partagent la largeur | Transcript et réponses rendus intégralement ; pas de promesse de performance sur de très gros contenus |
| Liste commune par paragraphes/sources/messages | Virtualise les contenus longs | Réécriture du lecteur, mesures de hauteurs variables et sauts hors fenêtre à traiter explicitement |
| Deux listes verticales imbriquées | Réutilise deux surfaces autonomes | Deux défilements concurrents et continuité perdue ; écartée |

La base KISS reste un seul viewport avec les rendus existants. Sur dossier, la liste des sources doit appartenir à la surface du fil, sans sous-liste verticale à défilement indépendant. Un saut au premier échange éloigné doit être borné et annulable ; pas de hauteur de ligne supposée ni de boucle de scroll infinie. La virtualisation constitue une alternative de réalisation, pas une modification du parcours décidé.

La page de lecture conserve sa progression ; le modal ne dessine pas une seconde barre de progression de lecture. Les échanges ne doivent pas modifier la progression mémorisée du transcript derrière le modal. Fermer le modal retrouve la page à sa position d’origine et cache tous les échanges, sans effacer la conversation.

Pour l’app native : un seul propriétaire de l’évitement clavier et de la safe area basse. Le modal doit avoir la même largeur réelle que la route, y compris dans le Digest. Pas de double padding IME/safe area. Les gestes système ferment le clavier ; ils ne changent pas de conversation. Les primitives natives déjà installées restent la première option ; le fichier HTML ne permet pas de départager les animations IME iOS et Android.

## 6. Conversations passées, nouvelle conversation et accessibilité

Conversations passées remplace le corps du modal par la liste d’historique, sans mouvement de feuille ni navigation visible vers la page média. Retour retrouve le fil. Sélectionner une conversation remet la source au début, puis les échanges de cette conversation, sans ouvrir le clavier de force.

L’icône de nouvelle conversation est le stylo entrant dans un carré (`create-outline`), et non un « + ». Nouvelle conversation conserve le même contenu source, vide le fil actif et focalise le composeur. La création réseau attend la première question. Pendant l’envoi ou la génération, cette commande reste désactivée ; l’arrêt est explicite. Un brouillon qui serait perdu demande confirmation. Quitter le modal n’interrompt pas le serveur et le brouillon doit survivre à l’historique et à la fermeture/réouverture.

Les deux commandes du haut et l’icône de sortie ont des cibles d’au moins 48 et des libellés accessibles, sans texte permanent de fermeture dans le composeur. À 320, le titre peut être ellipsé ; les boutons gardent leur taille. Le modal isole le focus du contenu derrière lui et le rend au point d’entrée à la fermeture. Les annonces début/fin/échec sont accessibles, sans répéter les tokens et sans ajouter de statut visible de génération. Les nouvelles chaînes de l’app utiliseront les onze catalogues V1.

## 7. Maquettes révisées et revue

Ouvrir [mockups.html](mockups.html). Huit cadres couvrent **média et dossier × avant, ouverture/rédaction, premier échange, historique**. Le premier écran de chaque portée permet de jouer la transition sur place. Les autres rendent directement visibles les états attendus.

Manipulations disponibles : entrée dans le modal, saisie sans `maxlength`, envoi avec réponse fictive progressive, arrêt, historique, reprise d’une ancienne conversation, nouveau fil et fermeture par icône. Les options de revue changent thème, largeur 390/320, taille du texte et longueur du contenu. Aucun compteur, bouton de masquage clavier, raccourci lecture, libellé de fermeture ou statut visible de génération n’est ajouté. Toucher le texte ou utiliser Échap ferme le clavier schématique ; la conversation reste ouverte.

Le transcript occupe le viewport entier, avec les mêmes gouttières de 16 de part et d’autre avant/après. Les questions restent des bulles ; la source et les réponses restent des blocs de lecture pleine largeur. Les glyphes SVG sont des équivalents de revue, remplacés par les Ionicons existants dans l’app. Aucun service externe ni fonte distante n’est chargé. Ces maquettes ne valident pas les insets, le clavier ou l’accessibilité natifs.

## 8. Conséquences sur task-434 et TASK-502

La portée de la direction F de task-434 demeure : média depuis Lecture, dossier depuis Sources, jamais bibliothèque. La direction révisée **conserve le modal** et remplace son animation de feuille, son gabarit et son contenu. La première version de ce README recommandait de supprimer la destination modale et d’ajouter une seconde barre de commandes : cette recommandation est remplacée, pas conservée comme variante à implémenter.

La formule « sans modal » de la description historique de TASK-502 est donc dépassée par la présente précision owner. L’implémentation devra suivre la décision finale de ce README : modal plein écran sans animation d’entrée, transcript/source au début du thread, commandes en haut et composeur simple. Réutiliser transport, reprise, arrêt, Markdown, citations et historique ; supprimer l’ancienne présentation de feuille dans la même passe. Aucune coexistence derrière un flag.

La directive owner retire la limite de saisie : les maquettes ne reconduisent aucun plafond arbitraire. TASK-503 aligne désormais le composeur mobile et le serveur : ni compteur ni plafond côté client, garde-fou serveur de 64 000 caractères indépendant du budget total de contexte, refus explicite à l’envoi avec conservation du brouillon. TASK-502 réutilisera ce comportement dans le modal, sans réintroduire la limite historique de 1 000 caractères.

Contrôles du futur travail : typecheck/lint mobile et core, traductions et relecture du câblage. Pas de nouveaux tests automatisés. Après distribution, les vérifications appareil restent la checklist owner : entrée sans glissement, largeur identique, clavier iOS/Android, première question après un long transcript, défilement pendant le flux, arrêt/reprise, historique, sortie et Digest. Elles ne constituent pas des ACs dépendant d’un déploiement.

## 9. État du livrable

Révision et maquettes validées explicitement par l’owner le 12 octobre 2026, après la correction de l’icône de nouvelle conversation. `owner_decision` vaut `ok` ; TASK-501 passe à `Done` et TASK-502 est débloquée. Son implémentation n’est pas lancée dans cette mise à jour du benchmark. La recherche précédente est remplacée dans ce README courant et reste consultable dans l’historique git.

### Vérification de la révision

Revue manuelle Chrome du 12 octobre 2026 : ouverture depuis le premier média, modal sans animation ni transform, aucun onglet dans le modal, largeur de paragraphe identique avant/après (358 sur un cadre de 390), même alignement horizontal, clavier présent. Envoi fictif : source puis fil directement adjacents dans le même viewport, sans titre intermédiaire. Historique et reprise vérifiés ; saisie de 1 200 caractères acceptée sans attribut `maxlength` ; fermeture retrouvant la lecture sans échanges. Thème sombre, 320 et contenu long inspectés : aucun débordement horizontal des huit cadres, 35 paragraphes conservés dans la conversation média. Contrôle de syntaxe JavaScript et `git diff --check` propres. Aucun test automatisé ajouté ; aucune validation native prétendue.
