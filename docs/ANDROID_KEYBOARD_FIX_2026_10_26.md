# Champs masqués par le clavier Android — TASK-544

## Diagnostic et correction

Les captures Android du 26 octobre montrent le composeur du chat et la carte
« Nouveau dossier » recouverts par le clavier, avec navigation système à trois
boutons. Le chat et le nommage avaient deux copies du même calcul : pour réduire
leur conteneur, le rectangle du clavier devait atteindre le bas de la modale.
Or [React Native 0.83.6](https://github.com/facebook/react-native/blob/v0.83.6/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactRootView.java)
calcule sa hauteur Android par `imeInsets.bottom - barInsets.bottom`. Dans une
fenêtre qui s'étend derrière les barres système, cette condition peut donc être
fausse alors que le champ est recouvert. Ce défaut est établi dans le code ; les
captures seules ne fournissent pas les coordonnées natives du téléphone.

`getKeyboardViewportHeight` calcule désormais l'espace jusqu'au haut du clavier
quand son rectangle chevauche le conteneur. Sur Android, son bord inférieur n'a
plus à rejoindre celui de la fenêtre. La hauteur est bornée par celle du
conteneur mesuré : un redimensionnement natif `adjustResize` n'est pas soustrait
une seconde fois. Le traitement iOS des claviers flottants est conservé.

`useKeyboardViewport` suit les événements natifs, les changements de dimensions
et la disposition du conteneur. Une présentation/reprise relit les métriques ;
les mesures asynchrones dépassées sont ignorées. Le conteneur extérieur reste
mesurable à sa taille native et seul son contenu est réduit. Les champs ne sont
ni masqués ni remontés pendant ces calculs ; aucune animation de layout n'est
ajoutée. L'animation du clavier reste celle du système.

## Surfaces couvertes

| Surface | Gestion livrée |
| --- | --- |
| Chat média et dossier | Hook commun ; focus du champ ou du titre inchangé selon l'ouverture, l'historique et le retour d'une citation |
| Création et renommage média/dossier | `RenameDialog` utilise le conteneur commun pour tous ses points d'entrée |
| Saisie d'URL | Conteneur commun, carte défilante et focus après présentation native |
| Sélecteur de dossiers en page et en feuille de revue | Conteneur commun ; recherche et création intégrée conservées |
| Personnaliser | Conteneur commun ; champ multiligne à hauteur bornée et défilement interne, bouton Générer dans la zone disponible |
| Édition intégrée de Recherche | Calcul de hauteur commun ; réserve de défilement et suivi de la tuile conservés |
| Authentification et signalement de bug | Gestion explicite existante `KeyboardAvoidingView` iOS padding / Android height conservée, vérifiée par lecture du code |

Les cartes URL/nommage et les listes de dossiers ramènent le champ focalisé dans
leur zone de défilement mesurée. Ce calcul tient compte du véritable bas de la
liste, y compris quand un en-tête ou un pied de page occupe une partie du
conteneur. Les taps sur les boutons restent directs ; le tap hors carte/feuille
reste disponible. Les validations, limites de longueur, erreurs et verrous
d'enregistrement sont conservés.

## Contrôles locaux

Aucun test automatisé ajouté ou exécuté. Contrôles effectués le 26 octobre 2026,
tous terminés avec un code de sortie 0 :

- `npm run typecheck --workspace=mobile`.
- `npm run lint --workspace=mobile` (avertissement `any` préexistant dans
  `purchaseService.ts`).
- Depuis `mobile/`, `npx expo export --platform android --max-workers 2 --output-dir /tmp/deepn-task544-android`.
- Depuis `mobile/`, `npx expo export --platform ios --max-workers 2 --output-dir /tmp/deepn-task544-ios`.
- Revue du diff de la correction et contrôle des espaces avec `git diff --check`
  limité aux fichiers de cette tâche, le workspace contenant d'autres travaux.

Les nouveaux fichiers ont également été relus pour les espaces et les chaînes
sensibles. Les exports signalent les avertissements locaux habituels de
configuration API/Sentry, sans empêcher la production des bundles. Leurs sorties
restent dans `/tmp`, hors du dépôt.

Ces contrôles valident les types, le lint et la production des bundles Hermes.
Ils ne démontrent pas le comportement du clavier sur appareil. Aucune
distribution, publication, modification native ou nouvelle dépendance dans ce
correctif. Parité : `Web: n/a (gestion native du clavier Android)`.

## Recette manuelle après distribution — à effectuer

Effectuer d'abord les parcours signalés sur le téléphone Android des captures,
avec son clavier habituel et la navigation à trois boutons, puis en navigation
gestuelle. Répéter avec clavier fermé et déjà ouvert depuis Recherche.

| Parcours | Résultat à vérifier |
| --- | --- |
| Composeur d'un média puis d'un dossier | Champ et envoi visibles au-dessus du clavier ; saisir plusieurs lignes, envoyer, fermer/réouvrir et reprendre un brouillon |
| Média → menu `…` → Nouveau dossier | Nom, Créer et Annuler accessibles ; création et rangement du média conservés |
| Média/dossier → menu `…` → Renommer | Nom initial sélectionné, champ visible, validation et annulation utilisables |
| Recherche → appui long dossier/média → Renommer/Nouveau dossier | Même visibilité ; les actions de déplacement et leur sélecteur restent utilisables |
| Recherche → création de dossier dans la grille | Tuile éditée visible après ouverture du clavier et après changement de tri |
| Déplacer → sélecteur de dossiers ; sélection depuis un partage ; revue → Ranger | Recherche et nouveau dossier accessibles, y compris après défilement d'une longue liste |
| Accueil/dossier → ajout par URL | Collage, correction d'une URL refusée, validation et tap hors carte fonctionnent |
| Média/dossier → IA → Personnaliser | Prompt long défilant, curseur visible, options et bouton Générer atteignables |
| Authentification et signalement de bug | Champs inférieurs accessibles au clavier, fermeture et défilement conservés |

Pour ces parcours, vérifier aussi fermeture/réouverture répétée, masquage du
clavier par Retour puis refocus, changement de hauteur du clavier (suggestions,
emoji), grandes polices, petite hauteur disponible, erreur de formulaire et
reprise réseau. Avec un clavier matériel, le champ reste visible sans attendre
un événement de clavier logiciel.

Sur iOS, vérifier chat média/dossier, historique, retour de citation sans focus
forcé, brouillons, nommage, URL, sélecteur et Personnaliser. Contrôler les marges
de safe area et, sur iPad, le clavier flottant. Ne pas présenter cette recette
comme effectuée tant qu'elle n'a pas été exécutée sur appareil.

## Complément — clavier absent à la création dans Recherche (TASK-546)

Une troisième capture du 26 octobre montre le nom du nouveau dossier sélectionné
dans la grille de Recherche, sans clavier logiciel. Il s'agit d'un chemin
différent de celui des modales de TASK-544 : le nom est ici un `TextInput`
directement dans la grille. La capture ne permet pas de savoir si Android a
refusé la première ouverture ou si le clavier a été refermé immédiatement.

Le code demandait le focus dès un effet React, sans attendre le layout du champ.
Le chemin attend désormais un layout de taille positive du `TextInput`, puis
une frame de rendu pour laisser le montage natif se terminer. Les demandes
différées sont annulées à la perte de focus écran, pendant la sauvegarde, à un
changement de demande ou au démontage. La demande est identifiée par le champ,
l'identité de création et la révision après erreur : recevoir l'identifiant
serveur ne redemande pas le focus et ne resélectionne pas un nom déjà en cours de
saisie. Fermer volontairement le clavier n'entraîne pas une boucle de réouverture.

La liste garde également `keyboardShouldPersistTaps="handled"` pendant
l'édition. Le champ peut recevoir directement un tap, notamment pour rouvrir le
clavier après Retour. Les handlers existants de validation clavier, fin de saisie
et actions extérieures sont conservés. La création optimiste, la clé stable du
champ et l'enregistrement du nom ne changent pas.

Cette correction traite des fragilités constatées dans le code ; aucune
reproduction native ni mesure IME n'est disponible dans cette session. Il reste
à confirmer la résolution sur le téléphone de la capture.

### Recette ciblée — à effectuer sur Android puis iOS

1. Dans Recherche, clavier fermé et grille dépliée, toucher `+`. Le nom initial
   est sélectionné et le clavier s'ouvre sans second tap ; saisir immédiatement.
2. Refaire avec grille repliée, grille longue défilée et barre de recherche déjà
   focalisée sans requête. Le champ nouvellement créé devient la cible de saisie.
3. Vérifier avec réponse réseau rapide puis lente : l'arrivée du dossier serveur
   conserve texte tapé, sélection et focus sans remonter le champ.
4. Fermer le clavier par Retour : il reste fermé jusqu'au prochain tap sur le
   champ. Ce tap doit rouvrir le clavier directement.
5. Valider par Terminé, par tap extérieur et par action sur une autre tuile.
   Vérifier aussi une erreur de nom/doublon avec acquittement et reprise de saisie.
6. Quitter rapidement l'onglet pendant l'ouverture, puis revenir : aucune
   demande différée ne vole le focus à l'autre écran. Refaire plusieurs créations
   consécutives, avec grandes polices et navigation Android à trois boutons.

Contrôles locaux TASK-546 terminés avec code de sortie 0 :

- `npm run typecheck --workspace=mobile`.
- `npm run lint --workspace=mobile` ; seul avertissement `any` préexistant dans
  `purchaseService.ts`.
- Depuis `mobile/`, `npx expo export --platform android --max-workers 2 --output-dir /tmp/deepn-task546-android`.
- Depuis `mobile/`, `npx expo export --platform ios --max-workers 2 --output-dir /tmp/deepn-task546-ios`.
- Revue du diff de Recherche et contrôle des espaces/chaînes sensibles.

Aucun test automatisé ajouté ou exécuté, aucun commit, push ou distribution.
Les exports ne certifient pas la recette native ci-dessus, qui reste à effectuer.

`Web: n/a (synchronisation du focus et du clavier natifs Android)`.
