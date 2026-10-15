# Cache mémoire des consultations mobiles (task-506)

Les réponses déjà consultées sont affichées dès le montage de l'écran, puis
revalidées sur le réseau à chaque ouverture, reprise de focus ou retour de
l'application au premier plan. Le premier accès sans réponse conservée garde
son indicateur de chargement. Le cache ne déclenche aucune génération.

## Durée de vie et limites

`packages/core/src/cache/resourceCache.ts` fournit le moteur TypeScript neutre,
sans dépendance. Les services mobiles identifient les ressources ;
`ResourceCacheProvider`, au-dessus de la navigation, fournit leurs snapshots
avec `useSyncExternalStore`.

Une instance appartient à un seul compte. La déconnexion, l'expiration de
session et le changement de compte détruisent l'ancienne instance. Ses requêtes
peuvent terminer leur transport, mais ne peuvent plus publier de résultat.
Une erreur réseau ne détruit ni la session valide ni ses réponses conservées.
Aucune donnée de ce cache n'est écrite sur disque.

Les ressources montées sont épinglées. Après leur dernier désabonnement, les
entrées inactives sont limitées par LRU à **100 entrées et 8 Mio estimés**.
L'estimation utilise la longueur JSON multipliée par deux ; elle ne mesure pas
l'intégralité du tas JavaScript. Une entrée dépassant **2 Mio estimés** reste
lisible pendant son utilisation, puis est évincée à sa fermeture. Une ressource
évincée retrouve le chargement initial lors de sa prochaine ouverture.

## Ressources et cohérence

| Ressource | Identité |
| --- | --- |
| Dossiers | Compte |
| Page de médias | Dossier éventuel, taille, tri, curseur |
| Fenêtre de bibliothèque | Compte, pages déjà parcourues |
| Détail média | Média, langue de lecture |
| Texte | Média, variante originale/traduite, langue pour la traduction |
| Métadonnées et corps d'artefact | Artefact, langue de lecture |
| Liste d'artefacts | Scope, identifiant, langue, taille, curseur |
| Page d'historique du chat | Scope, identifiant, taille, curseur |
| Fenêtre d'historique du chat | Scope, identifiant, pages déjà parcourues |
| Composition du Digest | Daily/weekly, dernière réponse et période capturée (`period_key`) |

Chaque appel de lecture demande réellement le réseau. Les appels simultanés de
la même ressource partagent la requête en cours. Les fenêtres paginées sont
revalidées depuis la première page jusqu'à la profondeur déjà consultée, puis
publiées ensemble ; leur revalidation ne réutilise jamais le chargeur d'un ancien
« charger plus ».

Les mutations réussies passent par les helpers de `mobile/src/services/resourceCache.ts`.
Renommages, déplacements et suppressions connus sont répercutés immédiatement.
Un média déplacé quitte les pages de son ancien dossier et de ses anciens
ancêtres lorsque la destination n'en fait plus partie. Il n'est pas inséré
arbitrairement dans une page paginée de destination. Les dépendances sont ensuite
invalidées et les ressources montées revalidées. Une invalidation change la
révision : une lecture antérieure ne peut pas annuler la mutation.

Une erreur transitoire conserve les réponses lisibles et affiche une reprise
sans remplacer les listes ou le lecteur. Un refus d'accès ou une absence
définitive (403/404) retire la réponse concernée. La disparition d'un média
retire aussi ses textes et ses lignes conservées ; celle d'un artefact retire
ses autres variantes et ses lignes d'historique.

Les changements de langue sélectionnent d'autres clés et relancent les lectures.
Une requête pour l'ancienne langue ne peut pas écrire une réponse obtenue dans
la nouvelle. Les réponses conservées de l'ancienne langue restent isolées.

Le détail complet du média reste distinct des vignettes de bibliothèque : une
vignette ne prouve ni que le détail est complet ni que le transcript est prêt.
Les suivis des traitements, traductions et générations restent actifs selon
leurs états réels. Une génération acceptée publie l'entrée renvoyée par le POST ;
une liste éventuellement retardée conserve les entrées en cours déjà connues.

Le Digest conserve sa fenêtre de montage d'une page de chaque côté et sa
composition capturée à l'ouverture. Les pages remontées retrouvent le détail,
les textes et les artefacts dans les mêmes ressources que le lecteur. Le cache
ne change pas l'ordre du carrousel. Depuis task-507, sa composition est également
partagée entre l'onglet et le lecteur : le lecteur démarre sur la réponse déjà
obtenue par l'onglet, y compris lorsqu'elle est vide. Une nouvelle période reçue
pendant la lecture est conservée pour l'ouverture suivante. Les suppressions
connues sont retenues avec chaque composition : le serveur conserve sa capture
d'origine, mais la revalidation ne doit pas y réintroduire un média supprimé
localement. Ces informations suivent les mêmes limites LRU que les réponses.
Un premier détail média jamais consulté conserve son propre chargement ; une
couverture ne constitue pas un détail complet. Le contrôleur de chat conserve les messages
et le streaming ; seul l'historique des conversations rejoint le cache commun.
La revue « À trier » initialise sa séance depuis la page conservée du dossier
par défaut (tri ascendant, 100 médias), y compris une page connue vide. Ses
lectures actualisent le cache pour la prochaine ouverture sans remplacer la file
déjà présentée : une séance reste figée. Le sélecteur partage la liste des
dossiers. Une première page absente conserve son chargement initial ; une erreur
de revalidation laisse la séance lisible et propose une reprise discrète.

## Vérification

Aucun test automatisé ajouté. Contrôles locaux de livraison : typecheck et lint
mobile/core, typecheck web, exports Expo iOS et Android, revue du diff. Le lint
mobile conserve l'avertissement préexistant dans `purchaseService.ts`.

Validation native à réaliser **après distribution interne** :

- Ouvrir puis rouvrir un dossier, un média et un artefact : réponse conservée
  immédiate, actualisation sans spinner bloquant ni perte de position/chat.
- Ouvrir le sélecteur de dossiers et l'historique du chat depuis plusieurs pages.
- Renommer, déplacer entre deux sous-arbres ou supprimer, puis revenir ; vérifier
  qu'une lecture lancée avant la mutation ne restaure pas l'ancien élément.
- Actualiser hors réseau avec et sans réponse conservée, puis réessayer en ligne.
- Parcourir plusieurs pages de bibliothèque et d'historique, fermer puis rouvrir.
- Éloigner une page Digest au-delà de sa fenêtre de montage puis la retrouver ;
  vérifier son contenu, l'ordre du carrousel et la poursuite d'une traduction.
- Ouvrir un Digest depuis l'onglet, fermer puis rouvrir : sa composition doit
  apparaître immédiatement. Refaire hors réseau et avec un Digest vide ; vérifier
  qu'un changement de période pendant la lecture ne remplace pas le carrousel,
  et qu'une suppression suivie d'une actualisation ne restaure pas le média.
- Poursuivre un traitement, une génération ou un flux de chat pendant les
  allers-retours ; le cache ne doit pas annoncer prématurément leur achèvement.
- Changer de langue pendant une lecture en cours et vérifier l'isolation des
  textes et artefacts.
- Se déconnecter pendant un chargement puis ouvrir un autre compte : aucune
  réponse du compte précédent ne doit réapparaître.

Les exports locaux valident les bundles, pas l'exécution sur appareil. La
publication interne utilise le workflow existant `Mobile OTA or Build` au push
sur `main` ; la validation native doit être rapportée séparément.
