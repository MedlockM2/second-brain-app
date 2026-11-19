# Extension Deepn — Chrome, Edge et Firefox

Extension Manifest V3 en WXT (task-487/488), un zip commun pour Chrome et Edge,
et une cible Firefox dédiée.

- **Un clic ouvre le panneau et enregistre.** Il n'y a pas de popup : cliquer sur
  l'icône, ou `Alt+S`, ouvre le panneau latéral (barre latérale sur Firefox) et
  enregistre l'onglet dans le dernier dossier utilisé (`lib/save.ts`, dans le
  service worker). Une page déjà enregistrée ne l'est pas deux fois : l'en-tête dit
  « Déjà dans votre bibliothèque » (`GET /api/media?url=`).
- **La page telle qu'on la voit.** Au clic seulement, l'extension lit l'onglet et
  envoie son HTML nettoyé avec l'adresse (`page_html`) : une page payante ou
  derrière une connexion arrive en entier. Décision de l'owner du 2026-11-17, qui
  reprend la voie A de `docs/research/task-490-paywalled-page-capture/README.md`
  (abandonnée le 2026-10-11). Le serveur l'extrait comme une page qu'il télécharge ;
  sans texte exploitable, il télécharge lui-même la page.
- **Clic droit** : « Enregistrer la sélection » (une note qui garde son adresse et
  ses sauts de ligne) et « Enregistrer ce lien » (sans ouvrir la page).
- **Le panneau reprend la page média de l'app** (maquette
  `mobile-design-mockups/extension_panneau_lateral/`) :
  - en-tête : le média, son état, son dossier (modifiable sur place, avec recherche
    et création), « Ouvrir dans Deepn », le menu « … » (raccourci, déconnexion) ;
  - **Lecture** : l'essentiel, le texte complet replié (un clic le déroule, « Voir
    l'original » s'il est traduit), la discussion avec le média ;
  - **Cahier** : les quatre formats générés d'un clic avec les réglages par défaut,
    la liste des fiches (génération en cours, échec à relancer), la fiche ouverte
    dans le panneau (résumé, notes, révision des cartes mémo, quiz). Personnaliser,
    renommer et supprimer restent dans l'app.
- **Le panneau garde sa page.** Sans la permission `tabs`, il ne voit pas l'onglet
  où l'on passe ; un nouveau clic sur l'icône enregistre la page courante et l'affiche.
  Chrome ne laisse pas l'extension fixer la largeur du panneau : l'utilisateur la règle.

## Installation et configuration

L'extension est un projet npm autonome : son outillage WXT a son propre
`package-lock.json`, pour ne pas modifier les résolutions du mobile dans le
lockfile racine. Les types communs sont importés depuis `../packages/core/src`
par alias, sans copie ni dépendance à `mobile/` ou `web/`. Les commandes des
workspaces existants continuent à se lancer depuis la racine du dépôt.

Utiliser Node.js 22.13 ou supérieur pour cet outillage : une dépendance WXT
(`listr2`) exige cette version, même si les contrôles locaux ont aussi passé
sous Node 20 avec un avertissement npm.

Depuis `extension/` :

```sh
cp .env.example .env.local
npm ci
npm run typecheck
npm run lint
npm run build
```

Renseigner avant le build :

- `VITE_API_BASE_URL` : l'origine de l'API dev. Récupérer l'URL avec
  `terraform output -raw api_endpoint` depuis `infrastructure/terraform/envs/dev`.
- `VITE_WEB_APP_ORIGIN` : l'origine exacte de l'app web qui appaire l'extension,
  par exemple `http://localhost:5173` en local, puis `https://dev.deepn.app` (bêta) ou `https://deepn.app` (prod).

Ces deux valeurs sont publiques, intégrées au manifeste et au bundle. Ne jamais
mettre de secret dans une variable `VITE_*`. Utiliser les mêmes API dev et origine
web dans les deux applications. Le build refuse une origine vide ou un chemin.

## Chargement non empaqueté contre dev

1. Construire avec `npm run build` ; le dossier obtenu est `.output/chrome-mv3`.
2. Dans `chrome://extensions` ou `edge://extensions`, activer le mode développeur,
   choisir « Charger l'extension non empaquetée », puis ce dossier.
3. Copier l'identifiant affiché dans `web/.env.local` sous `VITE_EXTENSION_IDS`
   (liste séparée par des virgules). Redémarrer Vite pour prendre la configuration.
4. Dans l'app web connectée, ouvrir Mon compte › Extension navigateur, puis
   « Relier cette extension ». Si le navigateur ne permet pas l'appairage direct,
   afficher un code, puis saisir ce code et l'e-mail du compte dans le panneau.
5. Ouvrir une page publique `https` et cliquer sur l'extension (ou `Alt+S`) : le
   panneau s'ouvre et la page est enregistrée sans autre clic. Changer de dossier
   dans l'en-tête, en cherchant puis en créant un dossier. Recliquer sur l'icône sur
   la même page : « Déjà dans votre bibliothèque », sans doublon.
6. Ouvrir un article réservé aux abonnés avec un compte abonné, l'enregistrer, et
   vérifier dans Deepn que le texte complet est là (`extraction_mode:
   "client_html"` dans les métadonnées du job).
7. Sélectionner du texte sur plusieurs paragraphes, puis clic droit › Enregistrer
   la sélection dans Deepn : la note garde ses sauts de ligne. Clic droit sur un
   lien › Enregistrer ce lien dans Deepn. Le badge ✓ confirme ; en cas d'échec, un
   « ! » reste sur l'icône et le panneau affiche la raison avec « Réessayer » (sauf
   refus définitif).
8. Dans le panneau : l'essentiel quand il est prêt, le texte complet déroulé puis
   replié, une question. Dans le Cahier, générer chaque format, ouvrir chaque fiche,
   réviser les cartes, faire le quiz, relancer une génération échouée.
9. Vérifier dans la bibliothèque dev la page et la note, puis `origin_url` sur la
   note. Révoquer depuis Mon compte et vérifier la demande de ré-appairage lors du
   prochain rafraîchissement. Essayer aussi le code depuis un autre profil.

Ces parcours contre l'API AWS sont à effectuer après le déploiement des
changements backend de task-485 et task-486. Aucun appel FastAPI in-process ne
remplace cette vérification.

## Session et permissions

Le grant de rafraîchissement stable propre à l'extension est dans `storage.local`, fermé aux scripts
de contenu par `setAccessLevel(TRUSTED_CONTEXTS)` sur Chromium. Firefox ne propose
pas cette restriction locale : l'extension ne contient aucun script de contenu. L'access token est dans
`storage.session` et disparaît au redémarrage du navigateur. Le backend renouvelle le délai d’inactivité du même grant à chaque `/refresh` et
émet un nouvel access token de cinq minutes. Il ne fait pas tourner un jeton à
usage unique : aucune fenêtre de rejeu de 60 secondes n’existe sur ce parcours.
Le serveur décide de l’expiration (90 jours d’inactivité, plafond d’un an) ; un 401 de refresh efface
les jetons et demande de relier l'extension. « Se déconnecter » révoque la lignée
par `/api/auth/logout`. Si le réseau empêche la révocation, le panneau affiche une
erreur et conserve la session pour réessayer ; Mon compte permet aussi de révoquer.

**Compte relié (TASK-634).** La session de l'extension est indépendante de celle de
l'app web, comme pour 1Password ou Claude in Chrome : se déconnecter du web, ou s'y
connecter avec un autre compte, ne déconnecte pas l'extension, qui doit pouvoir
enregistrer l'onglet web fermé. Pour qu'on ne puisse pas enregistrer dans un compte
sans le savoir :

- le panneau affiche en permanence, tant que l'extension est reliée, l'e-mail du compte
  relié, lu sur `/api/auth/me` et gardé dans `storage.local`. Il est placé dans un encart
  de largeur fixe en haut du panneau, hors du menu « … » ; une adresse trop longue
  finit par des points de suspension et reste lisible en entier au survol (`title`) ;
- sur Chrome et Edge, Mon compte › Extension navigateur demande à l'extension
  installée le message externe `whoami` : elle répond l'identifiant du compte relié
  (ou `null`), jamais un jeton ni une adresse. Si ce n'est pas le compte connecté sur le
  web, la page le dit et propose « Relier à ce compte », par l'appairage en un clic.
  Firefox n'a pas `externally_connectable` : seul l'encart du panneau s'y applique ;
- un ré-appairage révoque d'abord, au mieux, l'ancien grant par `/api/auth/logout`
  (cinq secondes au plus) : l'ancienne lignée ne reste plus valide ni listée sur
  l'ancien compte. Un échec réseau n'empêche pas l'appairage.

Le manifeste demande :

| Permission | Justification pour les stores |
| --- | --- |
| `activeTab` | Accéder à l'onglet sur lequel l'utilisateur vient d'agir (icône, `Alt+S`, menu contextuel), et à lui seul. |
| `scripting` | Lire, sur ce clic, la page à enregistrer (son HTML nettoyé) ou le texte sélectionné avec ses sauts de ligne. Jamais avant, jamais un autre onglet. |
| `contextMenus` | Proposer au clic droit l'enregistrement de la sélection et d'un lien. |
| `sidePanel` (Chromium) | Afficher l'aperçu, le résumé et la discussion de la page enregistrée. Firefox utilise `sidebar_action`, sans permission. |
| `storage` | Garder la session propre à cette extension, le dossier choisi, et le temps de la session du navigateur la page montrée par le panneau et un enregistrement échoué à réessayer. |
| Hôte exact de l'API | Envoyer les sauvegardes, lire le résumé et la discussion, gérer la session auprès de Deepn. Aucun autre hôte. |

`externally_connectable` n'autorise que l'hôte de l'app web. Le service worker
vérifie en plus `sender.origin` exactement, port compris, avant toute écriture.
Il n'y a ni script de contenu, ni `<all_urls>`, ni permission d'hôte sur les
sites, ni code chargé à distance : `scripting` n'atteint que l'onglet que
`activeTab` ouvre, au moment du geste. Le raccourci `Alt+S` (`commands`,
`_execute_action`) se modifie dans `chrome://extensions/shortcuts`. Version minimale Chromium : 140 (`storage.local.setAccessLevel`). Le code de secours est à usage
unique ; l'app web masque le code à son expiration.

Les libellés utilisent les 11 catalogues `_locales` : ar, de, en, es, fr, hi, it,
ja, nl, pt_PT, zh_CN. Pour les régénérer : `python3 scripts/messages.py`. Les icônes du
panneau sont celles de l'app web, recopiées par `python3 scripts/icons.py` dans
`lib/icons.generated.ts`. Les
libellés que l'app possède déjà (statuts, refus du chat et des artefacts, dossiers)
sont recopiés de `packages/core/src/i18n` par ce script (`CORE_MESSAGES`) au lieu
d'être retraduits : les modifier dans l'app, puis relancer le script.
Les icônes se régénèrent avec `python3 scripts/make_icons.py` (Pillow).

## Même zip pour les deux stores

Depuis `extension/`, avec `EXT_API_ORIGIN` et `EXT_WEB_ORIGIN` renseignées par le
propriétaire avec les origines publiques de la livraison :

```sh
npm ci
npm run typecheck
npm run lint
npm run zip -- --api "$EXT_API_ORIGIN" --web "$EXT_WEB_ORIGIN"
```

Livrable vérifié : `.output/delivery/distribution/<configuration>/deepn-extension-1.0.0-chrome.zip`,
avec `delivery.json` et son SHA-256 (version de `package.json`). Les sorties WXT brutes
à la racine de `.output/` ne portent aucune preuve de distribution.
Téléverser **ce même fichier** sur Chrome Web Store et Microsoft Edge Add-ons,
sans reconstruire pour Edge. Ce dépôt manuel n'a servi qu'à la création des deux
fiches : les mises à jour passent par la CI (« Publication automatique » ci-dessous),
qui numérote elle-même les versions. Vérifier le
manifeste : origines choisies, aucun localhost ni nom d’exemple. **L’API AWS dev
est autorisée pendant la bêta**, si le propriétaire la retient. L’origine web doit
être la véritable origine HTTPS publique ; le nom d’environnement de l’API ne
décide pas à lui seul de la validité d’une livraison.

Sur Chrome Web Store, créer la fiche développeur puis importer le zip. Compléter
la description et les captures, les déclarations de données et les justifications
des permissions. Sur Microsoft Partner Center, créer la fiche Edge Add-ons,
importer le même zip et remplir notamment Privacy :

- Objet unique : sauvegarder une page, un lien ou une sélection dans la bibliothèque
  Deepn, et en afficher le résumé et une discussion dans le panneau latéral.
- Permissions : reprendre les justifications du tableau ci-dessus.
- Code distant : aucun, tout le JavaScript est dans le paquet.
- Données : adresse et titre affiché localement ; adresse, contenu de la page
  (HTML nettoyé) et sélection envoyés seulement sur action explicite, pour en
  extraire le texte ; le HTML n'est pas conservé par Deepn, seul le texte extrait
  l'est. Questions posées dans le panneau envoyées sur action explicite. Jetons de
  session stockés dans l'extension.
  L'e-mail et le code ne sont envoyés que pour l'appairage de secours.
- URL de confidentialité : `https://www.<domaine>/privacy`, publiée et accessible
  avant soumission. Reprendre les déclarations conformes aux pages légales validées.

Après attribution des identifiants par les stores, renseigner les deux dans
`VITE_EXTENSION_IDS` de l'app web et reconstruire celle-ci. Les identifiants sont
publics ; aucun identifiant de compte développeur ni credential ne va dans le dépôt.
L'app web essaie les identifiants dans l'ordre et s'arrête au premier qui confirme.
La vérification finale sur les deux navigateurs reste à effectuer par l'owner.

### Publication automatique

`.github/workflows/deploy-extension.yml` tourne à chaque push sur `main` qui touche
`extension/**` ou `packages/core/**`. Il vérifie que `_locales` correspond à
`scripts/messages.py`, construit le paquet de distribution contre dev
(`https://api.dev.deepn.app`, `https://dev.deepn.app`) en version
`1.0.<numéro du run>`, puis `scripts/publish_stores.py` le soumet à chaque store
**seulement si son contenu diffère** de la dernière version que ce store a acceptée.
L'empreinte ignore le numéro de version ; elle est gardée dans le paramètre SSM dev
`/deepn/extension/store-state`. Un store qui examine encore une soumission est
sauté, sans échec, et marqué « pending » dans ce paramètre ; le push suivant ou un passage planifié (toutes les 30 minutes, comme la distribution beta mobile) rattrape. Un passage planifié ne lit d'abord que ce paramètre et s'arrête en quelques secondes quand aucun store n'est en attente ; sinon il réutilise le paquet que le dernier push a construit (artefact `extension-package`, gardé 90 jours) au lieu de le reconstruire. Fiches, visibilité et déclarations ne
sont pas touchées : elles restent celles des tableaux de bord.

Identifiants, secrets GitHub du dépôt :

- `CWS_SERVICE_ACCOUNT_JSON` : clé JSON du compte de service
  `cws-publisher@media-summarizer-473920.iam.gserviceaccount.com` (projet Google
  Cloud `media-summarizer-473920`, API Chrome Web Store activée), déclaré dans le
  tableau de bord Chrome Web Store › Compte › Compte de service. Il n'a aucun rôle IAM.
- `EDGE_CLIENT_ID`, `EDGE_API_KEY` : Partner Center › Edge › Publish API. **La clé
  expire après 72 jours** (créée le 2026-11-19, donc vers le 2027-01-30) : en créer
  une nouvelle sur la même page et remplacer le secret. Une clé expirée fait échouer
  le workflow sur un 401 explicite.

Edge exige des notes de certification à chaque soumission : `scripts/store-review-notes.txt`,
complété avec le compte de démo `edge` du secret dev `deepn-review-accounts`
(`scripts/create_review_account.py edge …`). Lancer le workflow à la main
(`workflow_dispatch`) relance une soumission sautée sans attendre un push.

Références officielles consultées le 11 octobre 2026 :
[appairage externe Chrome](https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable),
[stockage Chrome](https://developer.chrome.com/docs/extensions/reference/api/storage),
[publication Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension).


## Firefox et publication AMO

Firefox desktop **140 minimum** (déclaration Android : **142 minimum** pour le
consentement intégré, sans validation de parcours Android dans cette tâche) : la cible MV3 fournit un background script (WXT),
un identifiant Gecko fixe généré pour cette extension (ce n'est pas un identifiant
personnel de développeur), et le consentement de collecte intégré à Firefox.
La déclaration `data_collection_permissions.required` couvre :

- `authenticationInfo` : code et jetons d'appairage/session ;
- `personallyIdentifyingInfo` : e-mail fourni pour le code de secours ;
- `browsingActivity` : adresse enregistrée sur action explicite ;
- `websiteContent` : contenu de la page et texte sélectionné, envoyés sur action
  explicite.

Aucune télémétrie n'est ajoutée. Le minimum 140 évite une interface de consentement
pour les versions antérieures. Les permissions et l'hôte API restent les mêmes.
Le libellé du navigateur dans Mon compte distingue Firefox.

**Appairage Firefox : code de secours uniquement.** La documentation Mozilla
confirme que ni `runtime.connect` ni `runtime.sendMessage` depuis une page web
ne sont pris en charge sur Firefox. La cible Firefox n'émet donc pas de clé
`externally_connectable` et n'enregistre aucun listener de message externe.
Sur Firefox, la barre latérale propose directement « Afficher un code » depuis Mon
compte ; les consignes Chromium gardent le bouton d’appairage et le code de secours.
Depuis Mon compte › Extension navigateur, afficher un code ; dans la barre latérale
de Firefox, saisir le code et l'e-mail du compte. Son bouton ouvre cette page de compte. Ne pas ajouter l'ID Gecko à `VITE_EXTENSION_IDS` (Chrome/Edge seuls).
Source consultée le 11 octobre 2026 :
[Mozilla — externally_connectable](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/externally_connectable).

Depuis `extension/`, avec les origines de la version à livrer :

```sh
npm ci
npm run typecheck
npm run lint
npm run zip:firefox -- --api "$EXT_API_ORIGIN" --web "$EXT_WEB_ORIGIN"
```

Le wrapper construit et inspecte **ensemble** le paquet Firefox et son archive
de sources, puis les place dans `.output/delivery/distribution/<configuration>/`
avec `delivery.json` et les SHA-256. Les variables désignent les origines publiques
choisies pour cette livraison, dont l’API dev est une option valide en bêta. Il inclut les
sources de l'extension et de `packages/core/src`, le lockfile autonome, les assets,
une `.env` générée ne contenant que les deux origines publiques et un README
racine qui enregistre l'OS, les versions exactes Node/npm/Python et les commandes.
Il exclut les fichiers d'environnement locaux, les dépendances installées, les
builds et les autres applications. WXT ne produit pas son archive automatique,
qui ne contient pas les sources partagées hors de `extension/`.

Avant soumission, extraire l'archive de sources dans un dossier vide et suivre
son README : `cd extension`, `npm ci`, puis la commande WXT avec le mode indiqué. Comparer les fichiers
extraits du zip reconstruit avec ceux du zip à soumettre : aucun écart de contenu
n'est permis (les métadonnées ZIP peuvent différer). Outils open source seulement ;
le reviewer n'a besoin d'aucun compte Deepn ni de credentials pour reconstruire.
Les sources sont jointes à **chaque version**, avec une limite de 200 Mo vérifiée
par le script. L'archive est autonome, sans installation des workspaces racine.

Chargement dev : `npm run build:firefox` avec les variables dev configurées, puis
`about:debugging` › Ce Firefox › Charger un module temporaire › choisir
`.output/firefox-mv3/manifest.json`. Après déploiement backend, vérifier le code de
secours, la page, la sélection et son `origin_url`, le dossier, la révocation et
la demande de ré-appairage. Le chargement temporaire disparaît au redémarrage.

Pour AMO, l'owner ouvre le Developer Hub, crée la fiche Firefox, téléverse le zip
Firefox et joint l'archive de sources correspondante après validation. Renseigner
les descriptions, captures, permissions et données selon le tableau ci-dessus,
et l'URL de confidentialité définitive `https://www.<domaine>/privacy`. Conserver
l'ID Gecko pour les versions suivantes. Récupérer le paquet signé après review,
puis vérifier ces parcours sur Firefox installé. Ni signature ni soumission AMO
n'est effectuée par le script de livraison.

Références officielles consultées le 11 octobre 2026 :
[consentement Firefox](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/),
[soumission des sources AMO](https://extensionworkshop.com/documentation/publish/source-code-submission/),
[stockage Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/setAccessLevel),
[API communes WXT](https://wxt.dev/guide/essentials/extension-apis.html).

## Refus et reprise d'une sauvegarde

Le panneau distingue réseau, session à relier, source refusée, capacité épuisée,
limite par élément, traitement fermé et fournisseur suspendu. Il reprend les
libellés budgétaires mobile/web, avec la date de renouvellement quand elle est
connue, sans prix ni achat. Une sauvegarde par l'icône qui échoue garde dans
`storage.session` ce qu'elle aurait envoyé, page comprise (elle ne peut être relue
sans un nouveau clic), et le panneau propose « Réessayer », sauf refus définitif
(capacité épuisée, élément trop gros, traitement fermé, source refusée). Une session
révoquée demande de relier l'extension. Les erreurs du code d'appairage restent
neutres sur l'existence du compte.

Le menu contextuel montre ✓ seulement après acceptation de la sauvegarde, et un !
qui reste sur l'icône en cas d'échec. Le panneau affiche alors un bandeau avec la
raison et « Réessayer », qui renvoie la même sélection ou le même lien ; ils sont
gardés dans `storage.session` (mémoire, fermée aux pages) jusqu'à ce que le bandeau
soit fermé ou la sauvegarde réussie. Aucune sauvegarde n'est rejouée automatiquement.
La génération des `_locales` réutilise les phrases des catalogues de core ; elle
échoue si une traduction attendue manque.

## Trois usages explicites du packaging

Les scripts de livraison demandent les deux origines en arguments. Ils suppriment
les `VITE_*` héritées du processus, valident les valeurs choisies, puis vérifient
la présence de ces origines dans le bundle et leur concordance avec le manifeste.
Les permissions restent `activeTab`, `contextMenus`, `storage` et le seul hôte API.
Un reçu ne paraît qu’après tous les contrôles ; un échec retire l’ancien reçu de
cette configuration pour qu’il ne qualifie pas un paquet partiellement remplacé.

| Usage | Commande depuis `extension/` | Destination / garde |
|---|---|---|
| Local | `python3 scripts/package_release.py --purpose local --target all --api http://127.0.0.1:9 --web http://localhost:5173` | `.output/delivery/local/` ; non distribuable |
| Validation technique CI | `npm run package:ci -- --api https://api.deepn-validation.invalid --web https://app.deepn-validation.invalid` | `.output/delivery/validation/` ; noms réservés `.invalid`, aucun service réel, **ne pas soumettre** |
| Chrome et Edge | `npm run zip -- --api "$EXT_API_ORIGIN" --web "$EXT_WEB_ORIGIN"` | `.output/delivery/distribution/` ; HTTPS public obligatoire, même ZIP pour les deux stores |
| Firefox et sources | `npm run zip:firefox -- --api "$EXT_API_ORIGIN" --web "$EXT_WEB_ORIGIN"` | même garde, ZIP Firefox et sources inspectées ensemble |

Le but de livraison `local` utilise le mode WXT/Vite `development` : le nom de
mode `local` est réservé par Vite au suffixe des fichiers d’environnement.

`npm run build` et `build:firefox` restent des compilations de développement,
indépendamment du nom `production` du mode par défaut WXT : aucun reçu ne les
annonce prêtes à soumettre. Le mode `distribution` refuse aussi directement les
origines loopback ou réservées. Le contrôle est syntaxique et vérifie le paquet ;
le propriétaire valide l’existence des origines, CORS et les parcours réels dans
TASK-592/593/598. Il n’exécute aucun achat ni soumission aux stores.

L’archive Firefox utilise l’allow-list du script de sources existant. Aucun `.env`
local n’est copié : le seul fichier d’environnement archivé est généré depuis les
deux arguments publics. La validation contrôle ce contenu exact et exclut chemins
privés, clés, dépendances et sorties générées. Le README de reconstruction indique
le mode, les versions d’outillage et les origines ; il marque une archive CI comme
validation technique. `npm ci` dans les sources extraites reste autonome et ne
requiert aucun accès Deepn.

## Contrôles CI

PR et main exécutent le même job extension, sans filtre de chemin : une modification
de `packages/core` est donc aussi contrôlée. Ce job utilise Node 22, Python 3.10,
`npm ci` dans `extension/` avec son lockfile autonome, puis `typecheck`, `lint` et
`package:ci` pour les deux cibles et les sources Firefox. Les origines explicites
`api.deepn-validation.invalid` / `app.deepn-validation.invalid` désignent uniquement
la compilation. Aucun appel API, accès store, secret, publication ou test automatisé
n’intervient ; il vérifie aussi que `public/_locales` correspond à `scripts/messages.py`.
La publication est le workflow à part décrit plus haut. Les reçus restent sous `delivery/validation`, non distribuables.
Les apps gardent leur installation racine, leurs checks et leur Node distincts.
