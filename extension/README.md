# Extension Deepn — Chrome et Edge

Extension Manifest V3 en WXT (task-487), un seul zip pour les deux stores. Elle
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
de contenu par `setAccessLevel(TRUSTED_CONTEXTS)`. L'access token est dans
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
chargé à distance. Version minimale Chromium : 116. Le code de secours est à usage
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

Livrable : `.output/deepn-extension-1.0.0.zip` (version de `package.json`).
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
