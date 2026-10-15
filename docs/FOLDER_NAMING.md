# Création dans la grille et noms de dossiers — task-516

Le « + » de la section Dossiers de la bibliothèque mobile crée un vrai dossier
vide à la racine, avec le premier nom libre dans la langue d'interface :
« Dossier sans titre », « Dossier sans titre 2 », « Dossier sans titre 3 », etc.
La section est dépliée si nécessaire. La nouvelle tuile entre en édition ; son
nom est sélectionné et le clavier ouvert. La liste mesure la tuile et son
viewport et la rend visible au-dessus du clavier, sans animation de layout.
La position dans la grille reste celle du nom enregistré pendant la saisie ; le
tri alphabétique est recalculé après enregistrement.

La touche de validation et la fin de saisie native (notamment en touchant
ailleurs) enregistrent le texte courant. Une référence synchrone et les textes
finaux des événements natifs protègent la dernière modification ; un verrou
empêche deux soumissions du même geste. Le changement de recherche et le repli
de la section attendent aussi la fin de l'enregistrement. Quitter l'écran
termine la saisie sans supprimer le dossier créé. Un nom laissé inchangé garde
le dossier et son nom standard. Un nom vide est refusé avec un message et « OK » ;
le champ reste éditable. Une erreur réseau conserve le brouillon et propose de
réessayer en validant de nouveau. Aucun dossier n'est supprimé à la sortie.

## Unicité

Les noms sont uniques entre dossiers d'un même compte et d'un même parent.
Le même nom peut être utilisé dans deux parents différents. La comparaison
normalise Unicode en NFKC, réduit les espaces et ignore les majuscules ; elle
ne retire pas les accents. Le nom affiché conserve la graphie enregistrée.
La création, le renommage et le déplacement vérifient les noms frères dans le
service backend. Toutes les nouvelles écritures réservent aussi le nom dans la
même transaction DynamoDB que le dossier, pour empêcher deux écritures
simultanées de l'acquérir. Le renommage/déplacement libère l'ancien nom dans
cette transaction ; la suppression libère le nom avec le dossier.

Les réservations sont des lignes internes de `user_folders`, identifiées par
un hash du compte, du parent et du nom normalisé. Elles portent `user_id` pour
être supprimées avec le compte, mais aucun attribut `name` : les listes de
dossiers les excluent et paginent jusqu'au bout de l'index. Aucun changement de
table ou d'index Terraform n'est nécessaire. Le renommage met à jour seulement
nom, parent et date et conserve les engagements écrits simultanément.
Les transactions portent un token d'idempotence pour les reprises du SDK AWS.

`POST /api/folders` et `PUT /api/folders/{id}` refusent un doublon avec HTTP 409
et `detail.error_code = FOLDER_NAME_CONFLICT`. Le nom en place n'est pas modifié.
Les écritures mobiles affichent un encart natif non annulable, avec seulement
« OK ». La saisie reste disponible après acquittement. Les formulaires web de
création/renommage affichent le même refus traduit et un acquittement obligatoire.
Les candidats de nom automatique refusés par concurrence sont incrémentés sans
interrompre l'utilisateur ; une erreur de transport n'est pas rejouée à l'aveugle.

Les onze catalogues et le comparateur neutre sont dans `packages/core`.
Aucune dépendance ajoutée et aucun test automatisé écrit ou lancé.

## Vérifications et distribution

Typecheck/lint mobile, core et web ; Ruff et mypy backend ; exports Hermes iOS
et Android. Le lint mobile conserve son warning `any` préexistant dans
`purchaseService`. Vérification directe des expressions transactionnelles sur
DynamoDB dev : opérations racine et sous-dossier volontairement refusées par une
condition sur une ligne inexistante, sans aucune écriture. Cela valide la syntaxe
DynamoDB, pas les interactions natives ni un endpoint déployé.

Après déploiement backend et distribution mobile, vérifier sur iOS et Android :

- Créer plusieurs dossiers ; noms standard libres, sélection complète et nouvelle
  tuile entièrement visible, y compris loin dans la grille et avec clavier déjà ouvert.
- Saisir un nom puis toucher le fond, une autre tuile, la recherche ou un autre
  onglet ; le nom courant est conservé, y compris la dernière lettre.
- Valider au clavier ; le nom enregistré apparaît à sa place alphabétique.
- Nom vide ou doublon, avec variation de casse/espaces : encart, OK obligatoire,
  brouillon conservé et correction possible ; dossier créé toujours présent.
- Couper le réseau pendant la sauvegarde puis réessayer : même dossier, pas de
  nouvelle création ni perte du brouillon.
- Créer/renommer simultanément depuis deux clients : une seule acquisition du nom.
- Renommer depuis le menu d'une tuile et depuis la page Dossier ; créer depuis
  les autres sélecteurs ; vérifier le même refus. Vérifier aussi les formulaires web.
- Clavier matériel, grandes polices et rotation : édition accessible et défilable.

Ces validations natives et déployées restent à réaliser par l'owner. Les contrôles
locaux ne les présentent pas comme acquises. Le push sur main déclenche les
workflows existants de déploiement backend et de distribution mobile.

Référence de la réservation atomique :
[Transactions DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).
