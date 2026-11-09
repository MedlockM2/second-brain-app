# Extension Deepn — Chrome, Edge et Firefox

Extension Manifest V3 en WXT (task-487/488), un zip commun pour Chrome et Edge,
et une cible Firefox dédiée. Elle
sauvegarde l'adresse de l'onglet ou le texte sélectionné avec son adresse
d'origine ; elle ne lit jamais le contenu de la page. Les pages payantes ou
privées restent hors du périmètre V1.

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
   afficher un code, puis saisir ce code et l'e-mail du compte dans la popup.
5. Ouvrir une page publique `https`, cliquer sur l'extension, choisir un dossier
   et enregistrer. Les sous-dossiers portent le chemin de leurs parents.
6. Sélectionner du texte sur une page, puis clic droit › Enregistrer la sélection
   dans Deepn. Le dossier choisi dans la popup est aussi celui du menu contextuel ;
   sans choix, le serveur utilise Non classés. Le badge ✓ confirme la sauvegarde ;
   ! indique un échec. Aucun nouvel essai automatique d'une sauvegarde échouée.
7. Vérifier dans la bibliothèque dev la page et la note, puis `origin_url` sur la
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
par `/api/auth/logout`. Si le réseau empêche la révocation, la popup affiche une
erreur et conserve la session pour réessayer ; Mon compte permet aussi de révoquer.

Le manifeste demande :

| Permission | Justification pour les stores |
| --- | --- |
| `activeTab` | Lire l'adresse et le titre de l'onglet lorsque l'utilisateur ouvre la popup. |
| `contextMenus` | Proposer l'enregistrement du texte sélectionné au clic droit. |
| `storage` | Garder la session propre à cette extension et le dossier choisi. |
| Hôte exact de l'API | Envoyer les sauvegardes et gérer la session auprès de Deepn. Aucun autre hôte. |

`externally_connectable` n'autorise que l'hôte de l'app web. Le service worker
vérifie en plus `sender.origin` exactement, port compris, avant toute écriture.
Il n'y a ni script de contenu, ni permission `scripting`, ni `<all_urls>`, ni code
chargé à distance. Version minimale Chromium : 140 (`storage.local.setAccessLevel`). Le code de secours est à usage
unique ; l'app web masque le code à son expiration.

Les libellés utilisent les 11 catalogues `_locales` : ar, de, en, es, fr, hi, it,
ja, nl, pt_PT, zh_CN. Pour les régénérer : `python3 scripts/messages.py`.
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
sans reconstruire pour Edge. Incrémenter la version dans `package.json` avant
chaque mise à jour, puis actualiser le lockfile autonome avec npm. Vérifier le
manifeste : origines choisies, aucun localhost ni nom d’exemple. **L’API AWS dev
est autorisée pendant la bêta**, si le propriétaire la retient. L’origine web doit
être la véritable origine HTTPS publique ; le nom d’environnement de l’API ne
décide pas à lui seul de la validité d’une livraison.

Sur Chrome Web Store, créer la fiche développeur puis importer le zip. Compléter
la description et les captures, les déclarations de données et les justifications
des permissions. Sur Microsoft Partner Center, créer la fiche Edge Add-ons,
importer le même zip et remplir notamment Privacy :

- Objet unique : sauvegarder une page ou une sélection dans la bibliothèque Deepn.
- Permissions : reprendre les justifications du tableau ci-dessus.
- Code distant : aucun, tout le JavaScript est dans le paquet.
- Données : adresse et titre affiché localement ; adresse et sélection envoyées
  seulement sur action explicite ; jetons de session stockés dans l'extension.
  L'e-mail et le code ne sont envoyés que pour l'appairage de secours.
- URL de confidentialité : `https://www.<domaine>/privacy`, publiée et accessible
  avant soumission. Reprendre les déclarations conformes aux pages légales validées.

Après attribution des identifiants par les stores, renseigner les deux dans
`VITE_EXTENSION_IDS` de l'app web et reconstruire celle-ci. Les identifiants sont
publics ; aucun identifiant de compte développeur ni credential ne va dans le dépôt.
L'app web essaie les identifiants dans l'ordre et s'arrête au premier qui confirme.
La soumission aux stores et la vérification finale sur les deux navigateurs sont
à effectuer par l'owner.

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
- `websiteContent` : texte sélectionné envoyé sur action explicite.

Aucune télémétrie n'est ajoutée. Le minimum 140 évite une interface de consentement
pour les versions antérieures. Les permissions et l'hôte API restent les mêmes.
Le libellé du navigateur dans Mon compte distingue Firefox.

**Appairage Firefox : code de secours uniquement.** La documentation Mozilla
confirme que ni `runtime.connect` ni `runtime.sendMessage` depuis une page web
ne sont pris en charge sur Firefox. La cible Firefox n'émet donc pas de clé
`externally_connectable` et n'enregistre aucun listener de message externe.
La popup Firefox propose directement « Afficher un code » depuis Mon compte ;
les consignes Chromium gardent le bouton d’appairage et le code de secours.
Depuis Mon compte › Extension navigateur, afficher un code ; dans la popup de
Firefox, saisir le code et l'e-mail du compte. Le bouton de la popup ouvre cette
page de compte. Ne pas ajouter l'ID Gecko à `VITE_EXTENSION_IDS` (Chrome/Edge seuls).
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

La popup distingue réseau, session à relier, source refusée, capacité épuisée,
limite par élément, traitement fermé et fournisseur suspendu. Elle reprend les
libellés budgétaires mobile/web, avec la date de renouvellement quand elle est
connue, sans prix ni achat. Un refus garde le dossier choisi et réactive le bouton
pour un nouvel essai explicite. Une session révoquée demande de relier l'extension.
Les erreurs du code d'appairage restent neutres sur l'existence du compte.

Le menu contextuel montre ✓ seulement après acceptation de la sauvegarde, et !
sur échec. Après !, ouvrir la popup pour lire l'explication du dernier refus.
Seuls son code autorisé et, éventuellement, la date de renouvellement validée sont
conservés temporairement dans `storage.session`, puis retirés à la lecture. Aucun
texte sélectionné, URL, compte ou credential n'est ajouté à ce diagnostic ; il n'y
a ni journal ni historique. Pour reprendre, sélectionner à nouveau le texte et
utiliser le menu contextuel : aucune sauvegarde n'est rejouée automatiquement.
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
n’intervient. Les reçus restent sous `delivery/validation`, non distribuables.
Les apps gardent leur installation racine, leurs checks et leur Node distincts.
