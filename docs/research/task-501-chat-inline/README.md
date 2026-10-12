---
owner_decision: pending
---

# Benchmark : conversation intégrée aux pages Média et Dossier

## Owner Validation

**Decision**: _(à remplir par l'owner : accepter A, retenir une autre option, ou préciser les modifications ; le cadrage proposé n'est pas une décision acquise)_

**Validated at**: _(date ISO à remplir par l'owner)_

## Recommendation

**A — un chat intégré dépliable : au repos, contenu seul ; composeur ouvert, contenu puis conversation dans un seul défilement vertical.** Le média conserve son transcript intégral ; le dossier conserve ses sous-dossiers et sources. **Les questions/réponses sont masquées tant que le composeur est fermé**, conformément à la précision de l’owner du 12 octobre 2026. Toucher le champ ouvre directement le clavier et déplie la conversation sous le contenu, sans feuille. Refermer le composeur masque de nouveau le fil, sans supprimer son historique ni arrêter une génération. L'historique et « Nouvelle conversation » occupent une seconde ligne d'en-tête, commune aux deux portées. Le bouton textuel de cette ligne permet de rejoindre la discussion ou de retrouver le passage lu.

Déplier le composeur ne déplace pas la lecture vers la fin du transcript : on peut rédiger en regardant son passage. **L'envoi accepté** rejoint la nouvelle question ; un bouton « Reprendre lecture » retrouve l'ancre précédente. Pendant une réponse, le suivi automatique reste actif seulement si le lecteur est déjà au bas de la discussion. Un déplacement volontaire vers le transcript le suspend ; « Réponse en cours ↓ » permet de revenir. L'onglet IA garde ses artefacts, sans conversation ni composeur.

La proposition privilégie la demande précise du retour TestFlight : conserver le texte et ajouter la conversation dessous quand le composeur est ouvert, puis la masquer quand il est fermé. Elle a un coût réel : sur un petit téléphone, une discussion sous un long transcript nécessite un raccourci explicite. La seconde ligne d'en-tête consomme aussi de la hauteur. Ces deux coûts sont visibles dans les [maquettes interactives](mockups.html), plutôt que dissimulés par un transcript tronqué.

**Livrable de recherche uniquement.** Aucun code applicatif, transport, quota, modèle ou contrat API n'est modifié. Les choix ci-dessous deviennent le périmètre de TASK-502 seulement après validation de ce README.

## 1. Périmètre et état réellement observé

Audit du checkout local du 12 octobre 2026, base `250ea575`. Les descriptions historiques de task-434 précèdent plusieurs livraisons ; elles ne décrivent plus entièrement l'application.

| Fichier examiné | État actuel et conséquence |
| --- | --- |
| `mobile/src/components/CompletedDetailView.tsx` | Un `Animated.ScrollView` contient héros, onglets Lecture/IA et transcript. Un `ChatDock` est son frère, visible dans Lecture. La barre repliée porte déjà retour, vignette, titre et onglets. |
| `mobile/app/media/folders/[id].tsx` | Sources utilise une `FlatList` de sous-dossiers, légendes et médias, avec rafraîchissement. IA utilise `ArtifactsPanel`. `ChatDock` est fixé sous Sources. |
| `mobile/src/components/chat/ChatDock.tsx` | Le « champ » au repos est un `Pressable` qui ouvre `ChatSheet`, et non un champ éditable. Brouillon et état d'historique sont locaux. |
| `mobile/src/components/chat/ChatSheet.tsx` | `Modal`, clavier, en-tête, liste d'historique ou fil, et composeur. Son changement de taille appelle actuellement `scrollToEnd` sans tenir compte d'une relecture. |
| `ChatThread.tsx`, `ChatAnswer.tsx`, `ChatComposer.tsx`, `ChatHistoryList.tsx` | Rendu Markdown, citations nommées pour les dossiers, arrêt, états d'échec, reprise de question et historique paginé existent. La saisie est limitée à 1 000 caractères, jusqu'à quatre lignes visibles. |
| `mobile/src/contexts/ChatSessionContext.tsx` | Session par portée au-dessus de la navigation ; flux, reprise et repli polling sont indépendants de la feuille. Quitter une page ne demande pas l'arrêt serveur. |
| `mobile/src/components/TranscriptReader.tsx` | Paragraphes `Text selectable`, traduction et états de chargement/erreur ; le backend sépare déjà le texte en paragraphes. |
| `mobile/app/(tabs)/digest/[period].tsx` | Le même `CompletedDetailView` est monté dans un carrousel horizontal. Un changement de ce composant touche aussi le Digest. |
| `mobile/src/constants/theme.ts` et `mobile-design-mockups/my_design_system/DESIGN.md` | Deux palettes Amber Clarity, surfaces tonales, corps 16/25,6, titres 20 et 32, espacements 4/8/16/24/32/48, cibles 48 minimum. Le thème prime sur les anciens exemples statiques. |
| `mobile/package.json` et manifeste Android | Expo 55, React Native 0.83.6 ; `adjustResize` sur Android. Pas de Keyboard Controller ni de Reanimated déclarés dans l'app. |

Le serveur borne une conversation à vingt tours (`chat_prompt.MAX_TURNS_PER_CONVERSATION`). Cela borne le nombre de messages, **pas** la hauteur de vingt réponses Markdown ni celle du transcript. Aucun chiffre de fluidité ou de mémoire n'a été mesuré dans ce travail documentaire.

## 2. Recherche externe et limites de la comparaison

Sources officielles consultées le 12 octobre 2026. Les règles de parcours proposées sont une **déduction de design**, pas une prescription des fournisseurs.

| Source primaire | Fait retenu | Application à Deepn |
| --- | --- | --- |
| [React Native 0.83 — ScrollView](https://reactnative.dev/docs/0.83/scrollview) | Tous les enfants sont rendus ; les listes paresseuses sont adaptées aux longs ensembles. La documentation expose le maintien de position et prévient des sauts lors de réordonnancements. | Comparer une extension minimale de la page et une liste par blocs ; ne pas promettre que maintenir une position résout tout. |
| [React Native 0.83 — FlatList](https://reactnative.dev/docs/0.83/flatlist) | Les lignes ont des clés ; les données externes de rendu doivent être signalées. Les hauteurs connues facilitent les sauts ; une cible hors fenêtre sans mesures pose problème. | Une réponse en flux a une hauteur variable. Un simple `scrollToIndex` vers la fin d'un transcript non mesuré n'est pas une solution complète. |
| [React Native 0.83 — KeyboardAvoidingView](https://reactnative.dev/docs/0.83/keyboardavoidingview) | Ajustement de taille, position ou padding ; comportement et décalage dépendent du contexte et de la plateforme. | Garder le champ hors du conteneur défilant, avec un seul propriétaire de l'évitement du clavier. |
| [React Native 0.83 — Keyboard](https://reactnative.dev/docs/0.83/keyboard) | Événements de clavier et synchronisation des changements de layout ; les événements disponibles diffèrent entre plateformes. | Ne pas transposer un délai d'ouverture de modal au champ de la page. |
| [Expo — Keyboard handling](https://docs.expo.dev/guides/keyboard-handling/) | Les primitives natives servent aux cas usuels ; Keyboard Controller couvre des interactions avancées et requiert un build de développement ainsi que Reanimated. | Commencer avec le stack installé ; une nouvelle bibliothèque ajouterait ici deux dépendances et une intégration native. |
| [Android — IME animations](https://developer.android.com/develop/ui/compose/system/keyboard-animations) | Les mouvements du contenu et de l'IME doivent être coordonnés. Les exemples utilisent Compose. | Principe utile pour la checklist appareil ; ce code Kotlin n'est pas une recette React Native. |
| [React Native 0.83 — Accessibility](https://reactnative.dev/docs/0.83/accessibility) | Libellés, rôles, états et annonces ont des API dédiées et des différences de plateforme. | Annoncer début/fin/échec, garder l'ordre source-question-réponse et rendre les raccourcis explicites. |
| [Readwise — Chat with your documents](https://docs.readwise.io/reader/guides/ghostreader/chat) | Conversation contextuelle sur un document, disponible aussi sur mobile ; le contenu et la position de lecture font partie de son contexte. | Confirme la pertinence de l'aller-retour lecture/question, sans décider du placement dans Deepn. Deepn n'envoie pas actuellement la position au modèle. |
| [Readwise — Default Ghostreader Prompts](https://docs.readwise.io/reader/guides/ghostreader/default-prompts) | L'entrée mobile « Ask anything » ouvre une feuille de chat avec des commandes contextuelles. | Contre-exemple concret : un champ apparent peut cacher une feuille, comme aujourd'hui dans Deepn. Ce mécanisme ne satisfait pas le retour reçu. |

Ces références ne démontrent ni la supériorité d'un parcours par mesure d'usage, ni sa fluidité sur nos appareils. Aucun test utilisateur n'a été conduit. Les maquettes sont une simulation HTML autonome : elles permettent de juger hiérarchie, encombrement et transitions, pas les insets natifs, VoiceOver/TalkBack ou la latence du backend.

## 3. Options de navigation comparées

L'exigence forte est « transcript conservé, puis questions/réponses dessous, clavier sur la page ». On compare aussi les options qui n'y répondent qu'en partie, pour rendre le compromis explicite.

| Option | Média et long transcript | Dossier | Historique | IA | Verdict |
| --- | --- | --- | --- | --- | --- |
| **A. Chat intégré dépliable + raccourcis d'en-tête** | Au repos transcript seul ; ouvert, transcript intégral puis fil, rédaction au passage courant et saut à l'envoi | Au repos sources seules ; ouvert, sous-dossiers/sources puis fil | Page empilée, retour au même fil | Séparé et inchangé | **Recommandée** : respecte l'ordre demandé et garde une seule surface verticale |
| B. Transcript repliable + fil | Lecture initiale complète, mais repli automatique au premier envoi ou au focus | Sources repliées en compteur | Même page empilée | Inchangé | Facilite le chat ; fait disparaître précisément le contexte que le retour demande de conserver. Variante possible seulement si l'owner accepte le repli explicite |
| C. Troisième onglet Discussion | Bascule vers un chat plein écran ; retour Lecture nécessaire pour relire | Même troisième onglet | Page empilée ou liste dans l'onglet | IA reste distinct | Parcours clair, mais ne place pas les réponses sous le transcript et encombre les segments sur petit écran |
| D. Chat dans l'onglet IA | Transcript hors de la conversation | Sources hors de la conversation | Mélange avec l'historique des artefacts si mal séparé | Redéfinit `ArtifactsPanel` partagé | Ne répond pas à la demande et transforme deux usages indépendants en destination ambiguë |
| E. Deux panneaux verticaux indépendants | Transcript au-dessus et chat en dessous, chacun défilant ; clavier réduit les deux fenêtres | Même problème sur les sources | Page empilée | Inchangé | Utile sur tablette large ; trop peu de hauteur et gestes ambigus sur téléphone |
| F. Feuille actuelle améliorée | Bonne séparation et retour au passage après fermeture ; transcript derrière la feuille | Même fonctionnement actuel | Dans la feuille | Inchangé | Une amélioration du clavier ne satisfait pas « sans modal » ; écartée pour ce retour |
| G. Route dédiée de chat | Tout l'écran au chat, retour natif au média | Même route par portée | Route adjacente | Inchangé | Coût raisonnable, mais ajoute une navigation à chaque lecture/question et ne garde pas le contenu au-dessus |

La comparaison est qualitative, sans score numérique arbitraire. A paie la gestion d'ancres et de défilement ; C/G paient un changement de lieu ; B paie la disparition du contexte ; E paie la hauteur. Aucun fournisseur, modèle ni moteur de chat n'est rouvert.

## 4. Contenus longs : trois implémentations de A

| Structure | Bénéfice | Coût / limite | Choix proposé |
| --- | --- | --- | --- |
| `Animated.ScrollView` média actuel + `ChatThread` en dessous ; dossier `FlatList` avec fil en footer | Préserve le lecteur, sa sélection, traduction et héros. Ancres média mesurables dans la page déjà montée | Transcript et réponses montés en entier ; footer dossier non virtualisé. Le coût augmente avec le contenu | **Base KISS de TASK-502** ; aucune prétention à une optimisation de volume |
| Liste commune de paragraphes/sources/messages | Virtualise le contenu et le chat ; une seule surface verticale | Refonte du lecteur et de sa traduction, suivi des hauteurs variables, retour à une ligne hors fenêtre, héros animé et progression à réécrire | Alternative si l'owner veut financer ce chantier dans TASK-502 ; ne pas le glisser dans une simple extraction de feuille |
| Deux listes verticales imbriquées | Réutilise deux composants autonomes | Deux positions, gestes concurrents, fenêtre de chat réduite et saut de focus difficile à expliquer | Écartée sur téléphone |

**Pourquoi ne pas imposer une réécriture du lecteur dans ce correctif ?** L'app rend déjà les paragraphes intégralement et aucune mesure locale n'établit un défaut de performance. La tâche demande une révision de parcours. Ajouter une virtualisation complète sans observation chiffrée serait un second chantier. Le fil étant masqué au repos, le moteur actuel n’a aucune réponse supplémentaire à rendre dans cet état. La proposition conserve donc le moteur actuel, documente sa limite et interdit de vendre le résultat comme une solution de performance. Les contenus longs restent intégraux, jamais tronqués ou repliés à l'insu du lecteur.

Pour le dossier, le footer reste une extension de la `FlatList` existante, et non une `ScrollView` imbriquée. Atteindre un footer éloigné demande une stratégie de saut **bornée et annulable** : exploiter la longueur de contenu mesurée et le nouvel `onContentSizeChange` après remplissage de fenêtre, arrêter dès que l'ancre du fil est visible, annuler au geste utilisateur/changement de portée. Pas de hauteur de source supposée ni de boucle infinie de `scrollToEnd`. Si cette stratégie ne donne pas un saut stable, retenir l'alternative liste par blocs explicitement ; ne pas tronquer la liste pour masquer le problème. Ce point reste une incertitude native à vérifier lors de l'implémentation.

## 5. Règles précises du parcours recommandé

### 5.1 Lecture et rédaction

À l'ouverture de la page, Lecture/Sources affiche uniquement le contenu, sans questions/réponses. Le composeur est replié. Il reste un champ directement activable ; ce n’est pas une invitation à ouvrir une modal. Le champ fixe est un vrai `TextInput`, à portée explicite (« Question sur ce média… » / « Question sur ce dossier… »). Il ne prend pas le focus automatiquement au montage. Le toucher donne le focus immédiatement, ouvre le clavier dans la page et rend le fil sous le contenu. Une commande explicite « Fermer la discussion » replie le composeur, ferme le clavier et masque le fil, en restaurant l’ancre de lecture. Elle ne stoppe pas le serveur. Un simple masquage du clavier pendant la lecture d’une réponse ne replie pas la discussion : « ouvert » désigne l’état UI du composeur, distinct du focus clavier. Cette distinction permet de lire une réponse sans clavier ; elle ne permet jamais de laisser les questions/réponses visibles avec le composeur replié. Le brouillon ne crée pas de conversation réseau. Le clavier réduit la fenêtre disponible ; il ne déclenche pas un saut arbitraire à la discussion.

Le transcript ou la liste de sources conserve sa position. Le composeur utilise les composants et limites existants : quatre lignes visibles puis défilement interne, compteur sur 1 000 caractères, Retour pour une nouvelle ligne, envoi explicite. Après un envoi accepté, la question apparaît sous le contenu et devient la cible du défilement. Le clavier reste ouvert pour faciliter une relance ; un glissement le ferme suivant les conventions de plateforme. Un échec d'envoi garde le brouillon/question et son identifiant de reprise, conformément au contexte actuel.

### 5.2 Ancres, lecture et suivi du flux

L'ancre de lecture est capturée **avant** un saut volontaire vers la discussion, jamais à chaque fragment. Elle reste propre au média/dossier et à l'onglet. Avec le moteur média conservé, garder l'offset et la version du contenu ; si une traduction ou une taille de texte change le layout, remettre une ancre mesurée valide, sinon revenir au début du lecteur plutôt qu'à un offset sans sens. Le dossier préfère une identité de source plus un décalage ; si elle a disparu, retrouver le voisin disponible. Ces ancres sont une aide locale, pas un nouvel état envoyé au backend.

Quand une nouvelle question est envoyée, rejoindre le début de son tour, puis suivre le bas tant que l'utilisateur reste dans la zone de suivi. Proposition de seuil : `TouchTarget.comfortable` (56 unités de layout), **paramètre de design**, pas un délai. Un geste vers le haut suspend ce suivi même si la génération continue. Un bouton nommé « Réponse en cours ↓ » ou « Voir la réponse ↓ » réactive le suivi. Ne jamais recopier l'actuel `onContentSizeChange → scrollToEnd` inconditionnel.

**La progression de lecture ignore la conversation, y compris lorsque le composeur est déplié.** Aujourd'hui `maxScroll = contentHeight - viewportHeight` mélange tout le contenu de la page. TASK-502 devra mesurer le début et la fin du transcript et calculer la progression sur cette plage, en tenant compte du viewport utile. Une nouvelle réponse ne doit ni faire régresser le pourcentage lu ni allonger sa distance. La barre repliée reste liée au passage du segment sous l'en-tête, avec le nouvel encombrement de l'en-tête inclus dans les calculs.

### 5.3 Commandes d'en-tête sans collision

Ne pas ajouter deux icônes dans la rangée repliée actuelle. À 320 unités, les mesures géométriques de task-434 lui laissent environ 84 unités de titre ; deux cibles de 48 en mangeraient davantage. **Seconde rangée**, sous Lecture/IA ou Sources/IA : cible textuelle flexible « Discussion ↓ » / « Reprendre lecture ↑ », puis Historique et Nouvelle conversation, chacune 48 minimum. Les autres actions du média/dossier restent dans leur menu actuel.

Sur une largeur de 320 avec gouttières 16, deux cibles de 48 et deux espaces de 8, il reste 176 unités à la cible textuelle. Elle peut tenir sur deux lignes et faire croître la rangée avec le Dynamic Type ; le titre principal n'est pas comprimé davantage. La commande de fermeture est dans la zone du composeur déplié, pas une troisième icône ajoutée à la rangée. La rangée existe une seule fois à l'écran, y compris lorsque le segment du média se replie ; les commandes ne sont pas dupliquées dans le corps du fil. Les maquettes montrent l'état replié, pas une promesse d'en-tête natif déjà implémenté.

### 5.4 Historique et nouvelle conversation

Historique ouvre une **page empilée**, liée au même scope, avec titre, retour et liste paginée existante. Le clavier est fermé avant la navigation. Choisir une conversation revient à Lecture/Sources, déplie le composeur et son fil, puis rejoint son dernier tour sans ouvrir le clavier. Retour sans choix conserve aussi l’état ouvert/replié précédent. Retour sans choix retrouve le même offset et le même brouillon. La suppression garde sa confirmation ; supprimer la conversation active revient à un fil vide sans toucher au transcript ni aux sources.

« Nouvelle conversation » conserve l'historique précédent et vide seulement le fil actif après confirmation si un brouillon serait perdu. Aucun appel de création avant la première question. Comme aujourd'hui, l'action reste indisponible pendant envoi/génération : proposer l'arrêt explicite, sans confondre nouvelle conversation et annulation. L'historique peut être consulté pendant une génération ; reprendre une autre conversation ne stoppe pas implicitement le travail serveur. La maquette représente ces états, avec données fictives et aucun réseau.

### 5.5 Onglet IA, dossier et Digest

IA garde `ArtifactsPanel` et son historique d'artefacts. Le composeur et la seconde rangée de chat disparaissent sur IA ; changer d'onglet ferme le clavier et conserve le brouillon et la session. Le retour à Lecture/Sources retrouve sa position et l’état ouvert/replié précédent, sans refocaliser le champ. Un fil replié demeure invisible même si sa génération se termine pendant la visite de l’onglet IA ; le champ au repos peut signaler qu’une réponse est prête.

Un dossier n'a pas de transcript agrégé à fabriquer pour l'UI : sous-dossiers et médias restent visibles au-dessus du chat. Les citations nommées ouvrent leur média puis le retour retrouve la discussion. Le corpus de la conversation demeure son snapshot actuel ; une liste de sources actualisée n'est pas une promesse que l'ancien fil a été recalculé. Garder les refus typés actuels quand aucun contenu n'est exploitable, quand une limite de corpus est atteinte ou quand le quota manque.

Dans le Digest, le clavier ne doit appartenir qu'à la page active. Recommandation : bloquer le swipe horizontal du pager pendant la saisie, puis le réactiver à la fermeture du clavier ; ne jamais bloquer le défilement vertical. En quittant volontairement la page par navigation, sauvegarder le brouillon local, fermer le clavier, détacher seulement le suivi UI ; le serveur continue. Les états de transport restent dans `ChatSessionContext`. La barre d'onglets native du Digest et la safe area de la route média ont des propriétaires distincts : ne jamais ajouter les deux insets à la fois.

### 5.6 Clavier et accessibilité

Base proposée : `KeyboardAvoidingView` iOS autour du viewport et du composeur, décalage mesuré de l'en-tête ; Android conserve `adjustResize` sans ajouter un second padding de hauteur IME. Un seul composant possède la safe area basse et la compensation clavier. `keyboardShouldPersistTaps="handled"` permet d'actionner l'envoi au premier toucher ; dismissal interactif iOS, `on-drag` Android. La version exacte devra être ajustée à la hiérarchie route/Digest, jamais avec un délai arbitraire.

Keyboard Controller est une option techniquement crédible, documentée par Expo, mais n'est pas proposée par défaut : ajout de Reanimated et intégration native, alors que le besoin initial est un champ fixe et un seul viewport. Si les primitives installées ne donnent pas le mouvement attendu sur appareil, documenter ce constat avant de choisir cette alternative ; les maquettes web ne permettent pas de la départager.

Ordre accessible : en-tête, contenu, titre Discussion, questions/réponses, champ. Libellés complets pour les icônes, états désactivé/occupé, cibles 48 minimum, texte secondaire `textSubtle` pour la lisibilité. Annonces à début, fin, interruption ou échec, jamais à chaque token. Un saut explicite déplace le focus vers la cible nommée, sans le voler pendant une relecture. Les nouvelles chaînes passent par les onze catalogues V1 de `packages/core/src/i18n`, et les couleurs passent par le thème actif.

## 6. Maquettes et mode de revue

Ouvrir [mockups.html](mockups.html). Huit téléphones couvrent **média et dossier × lecture, rédaction, génération, historique**. Chaque téléphone est manipulable : champ, envoi fictif, arrêt, raccourci Discussion/lecture, historique, reprise d'une conversation, nouvelle conversation et onglet IA. La barre de revue change thème clair/sombre, largeur 390/320 et taille du texte. Le scénario « Contenu long » ajoute des paragraphes ou sources ; la discussion reste à leur suite uniquement dans l’état déplié. Lecture masque entièrement questions/réponses. La commande « Fermer la discussion » permet de vérifier ce retour au contenu seul.

Les états rédaction montrent un clavier schématique, pas une simulation des événements IME. Les exemples de questions, de sources et de réponses sont inventés. La vue historique représente une destination empilée, pas une modal. Les glyphes SVG sont des équivalents de revue ; l'app utilisera ses Ionicons. Aucune fonte externe n'est téléchargée : pile système de l'app actuelle, avec les tailles du thème. Les dimensions des téléphones et du clavier sont des cadres de présentation ; couleurs, corps, espacements et cibles de l'UI suivent `theme.ts`.

Points de revue décisifs : la hauteur perdue par la seconde ligne d'en-tête, le maintien du contexte pendant la rédaction, le saut vers le fil après envoi et le retour au passage lu. Une validation peut demander une autre option ou un complément ; elle ne doit pas être déduite de l'existence de ces maquettes.

## 7. Conséquences sur task-434 et TASK-502

La décision F validée dans task-434 reste le document historique autoritaire **jusqu'à la décision de ce benchmark**. Si A est acceptée, elle en conserve la portée (média Lecture, dossier Sources, jamais bibliothèque) et le composeur persistant, mais **remplace la feuille comme destination conversationnelle**. Les anciennes réserves de task-434 sur `NativeTabs.BottomAccessory` ne décrivent pas le dock actuel, qui est déjà un composant d'écran commun iOS/Android.

TASK-502 devra supprimer `ChatSheet` et le `Pressable` qui l'invoque, déplacer les responsabilités d'orchestration de `ChatDock` vers le chat intégré, et réutiliser `ChatComposer`, `ChatThread`, `ChatAnswer`, `ChatHistoryList` et `ChatSessionContext`. Les commentaires « histoire dans la feuille », clés de traduction devenues inutiles et imports remplacés sont retirés dans la même passe. Pas de flag d'ancienne UI, pas de deux destinations concurrentes. Les composants de quiz et la génération de quiz ne sont pas concernés.

La route d'historique peut prendre scope/scopeId sans nouvelle API. Aucun nouveau stockage de conversation ou dépendance serveur n'est nécessaire. Un brouillon doit survivre à la route d'historique, au changement d'onglet et au pager ; sa durée de vie doit être portée au-dessus de ces montages UI, sans installer un système de stockage persistant supplémentaire.

Contrôles réalisables depuis la branche : typecheck/lint mobile et core, catalogue complet, relecture des call sites, absence de modal de chat et anciennes clés mortes. **Pas de tests automatisés ajoutés.** Les vérifications natives restent la checklist owner après distribution : clavier iOS/Android, 320 unités et Dynamic Type, longs contenus, saisie depuis le milieu du transcript, arrêt/reprise, navigation historique, citation et retour, IA, pager Digest et lecture pendant le flux. Aucune de ces vérifications ne doit devenir une AC exigeant un déploiement.

## 8. État du livrable

Benchmark initial ; décision en attente. La production du README et des maquettes remplit le travail de recherche, mais **ne clôt pas TASK-501**. Selon le cycle de `AGENTS.md`, elle reste `To Do`, exclue des prochains dispatchs tant que `owner_decision: pending` ; TASK-502 reste bloquée. L'owner décide ici, puis le dispatcher synchronise `ok` vers `Done`.

### Vérification du livrable, 12 octobre 2026

Revue manuelle dans Chrome du prototype servi uniquement sur loopback : huit états présents, lecture sans fil pour les deux portées ; fermeture pendant génération puis réouverture sans perte du fil média ; envoi fictif sur dossier, fermeture masquant les échanges avec indication de génération conservée ; ouverture d'historique et sélection d'un ancien fil revenant avec composeur déplié et clavier fermé ; passage à IA sans fil ni composeur. La combinaison thème sombre, largeur 320, texte agrandi et contenu long conserve 35 paragraphes ou 32 sources, sans débordement horizontal des huit cadres. Inspection visuelle en clair et en sombre, et contrôle de syntaxe du JavaScript effectués. Ces observations portent uniquement sur les maquettes, sans test automatisé ajouté ni validation native prétendue.
