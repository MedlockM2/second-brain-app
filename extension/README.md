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
  par exemple `http://localhost:5173` en local, puis `https://app.<domaine>`.

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

Le refresh token propre à l'extension est dans `storage.local`, fermé aux scripts
de contenu par `setAccessLevel(TRUSTED_CONTEXTS)` sur Chromium. Firefox ne propose
pas cette restriction locale : l'extension ne contient aucun script de contenu. L'access token est dans
`storage.session` et disparaît au redémarrage du navigateur. Le serveur décide de
l'expiration (90 jours d'inactivité, plafond d'un an) ; un 401 de refresh efface
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

Depuis `extension/`, avec les origines HTTPS définitives dans `.env.local` :

```sh
npm ci
npm run typecheck
npm run lint
npm run zip
```

Livrable : `.output/deepn-extension-1.0.0-chrome.zip` (version de `package.json`).
Téléverser **ce même fichier** sur Chrome Web Store et Microsoft Edge Add-ons,
sans reconstruire pour Edge. Incrémenter la version dans `package.json` avant
chaque mise à jour, puis actualiser le lockfile autonome avec npm. Vérifier le
manifeste : origines définitives, aucun localhost ni hôte dev pour la publication.

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
npm run sources:firefox -- --api https://api.example.com --web https://app.example.com
```

Remplacer les deux origines exemple par les origines définitives avant publication.
Le script construit **ensemble** le paquet `.output/deepn-extension-1.0.0-firefox.zip`
et son archive `.output/deepn-extension-1.0.0-firefox-sources.zip`. Il inclut les
sources de l'extension et de `packages/core/src`, le lockfile autonome, les assets,
une `.env.production` ne contenant que les deux origines publiques et un README
racine qui enregistre l'OS, les versions exactes Node/npm/Python et les commandes.
Il exclut les fichiers d'environnement locaux, les dépendances installées, les
builds et les autres applications. WXT ne produit pas son archive automatique,
qui ne contient pas les sources partagées hors de `extension/`.

Avant soumission, extraire l'archive de sources dans un dossier vide et suivre
son README : `cd extension`, `npm ci`, `npm run zip:firefox`. Comparer les fichiers
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
