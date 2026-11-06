# Livrer un paquet web identifié

TASK-590 prépare le mécanisme local. TASK-591 porte la future bascule sur le domaine
du propriétaire. TASK-605 publie d’abord la web app dev sur l’adresse CloudFront,
avec autorisation explicite du propriétaire dans la conversation du 2026-11-06.
TASK-471 porte les ressources `app`, TASK-472 le site `www`. Les agents ordinaires
d’implémentation préparent le paquet ; les opérations distantes nécessitent une
instruction explicite de publication. Aucun domaine fictif n’est utilisé.

## Configuration publique et provenance

Toutes les `VITE_*` finissent dans le JavaScript et dans `release.json`. Aucun secret,
jeton de connexion, compte de recette ou identifiant privé n'y appartient. Les builds
refusent les clés publiques inconnues. Les URL de distribution utilisent HTTPS ;
identifiants/mots de passe dans l'URL et fragments sont refusés. API, streaming et
site n'ont pas de query string. Les liens Play peuvent conserver leur paramètre `id`.

| Variable | Provenance du propriétaire | Absence / règle |
|---|---|---|
| `VITE_API_BASE_URL` | output Terraform `app_base_url` pour le web hébergé : CloudFront transmet `/api/*` à l’API existante. `api_endpoint` reste l’accès direct mobile/local. | Obligatoire : origine HTTPS sans suffixe `/api`. Pas de repli implicite vers l’origine web. |
| `VITE_CHAT_STREAM_URL` | output `chat_stream_url` de la même racine Terraform | Optionnelle. Finit par `/v1` si présente. Absente : relecture de la conversation jusqu'à la réponse complète, sans streaming. |
| `VITE_SITE_URL` | output `www_base_url`, puis origine publique retenue par TASK-443/472 | Optionnelle. Absente : Mon compte ne propose pas le lien d'installation de l'extension. Origine sans chemin si présente. |
| `VITE_APP_STORE_URL` | lien TestFlight réel pour la bêta, ou fiche App Store | Optionnelle pour compiler/livrer le bureau. Absente : lien iOS désactivé sur l'écran sous 900 px. TASK-591 vérifie la disponibilité de la distribution souhaitée. |
| `VITE_PLAY_STORE_URL` | lien d'opt-in Play réel ou fiche Play | Même règle pour Android ; hôte `play.google.com`. |
| `VITE_FEEDBACK_URL` | adresse publique du board configuré, même valeur que le mobile | Optionnelle. L'API tente toujours `/api/feedback/token`. Sans API ni URL de secours, le message d'indisponibilité existant apparaît. |
| `VITE_EXTENSION_IDS` | IDs effectivement attribués par Chrome Web Store et Edge Add-ons, ou ID de développement connu | Optionnelle. IDs uniques séparés par virgule, 32 lettres a-p. Absente : appairage par code de secours disponible ; pas d'ID inventé. Firefox utilise ce code. |

Les URL légales sont partagées dans `packages/core/src/constants/legal.ts` (TASK-589),
indépendamment de `VITE_SITE_URL`. Leur bascule exige la publication réelle de la
page et la décision propriétaire ; aucun `/terms` Deepn n'est présumé publié.
Cognito est lu depuis `/api/auth/oauth/config` : aucun secret OAuth dans Vite.

Le mode `ci` utilise `web/.env.ci`, une adresse loopback de compilation. Son manifeste
porte `distributable: false`. Le vérificateur de distribution le refuse. Les valeurs
optionnelles absentes ne sont ni remplies artificiellement ni déclarées disponibles.

## Préparation locale par environnement

1. Utiliser une révision commitée identifiée et Node 20. Depuis la racine : `npm ci`.
2. Choisir un mode explicite, par exemple `beta`. Copier `web/.env.example` vers
   `web/.env.beta.local` (ignoré par git), puis renseigner les valeurs publiques
   vérifiées par le propriétaire. Écarter les anciens `.env.local` et les variables
   `VITE_*` héritées du shell : celles du processus ont priorité sur les fichiers.
3. Exécuter depuis la racine :

```sh
npm run typecheck --workspace web
npm run lint --workspace web
npm run build --workspace web -- --mode beta
node scripts/verify_web_release.mjs web/dist
WEB_RELEASE_ID=$(node -p 'JSON.parse(require("fs").readFileSync("web/dist/release.json", "utf8")).releaseId')
mkdir -p /tmp/deepn-web-releases
tar -czf "/tmp/deepn-web-releases/$WEB_RELEASE_ID.tar.gz" -C web/dist .
```

Le manifeste identifie mode, révision git, configuration publique effective et SHA-256
complet de chaque fichier. Son `releaseId` est l'empreinte de ce manifeste sans le
champ d'identité ; aucun horodatage aléatoire. Le vérificateur contrôle identité,
fichiers, empreintes, chemins et absence de fichiers supplémentaires. Il vérifie
l'intégrité du paquet, pas l'accessibilité des services ni l'authenticité d'une archive
issue d'un tiers. La révision explique la source ; les empreintes identifient les
sorties exactes, y compris un éventuel travail local non commité. Pour une vraie
release, le propriétaire part d'une révision propre et conserve le lock npm.

Une compilation sans domaine reste possible avec `--mode ci`, suivie de
`node scripts/verify_web_release.mjs web/dist --compilation-only` ; cela n'en fait
pas un paquet de distribution. Les builds ne contactent aucune API.

## Dépôt et invalidation — propriétaire uniquement

Prérequis TASK-471/605 : bucket privé avec OAC, distribution `app`, routage SPA et cache
respectant les en-têtes d'origine (`min_ttl = 0` pour l'index). Vérifier l'environnement,
le profil AWS et les outputs ciblés avant toute écriture. Exemple sur dev :

```sh
WEB_TF_ROOT=infrastructure/terraform/envs/dev
WEB_BUCKET=$(terraform -chdir="$WEB_TF_ROOT" output -raw app_bucket_name)
WEB_DISTRIBUTION=$(terraform -chdir="$WEB_TF_ROOT" output -raw app_distribution_id)
node scripts/verify_web_release.mjs web/dist
WEB_RELEASE_ID=$(node -p 'JSON.parse(require("fs").readFileSync("web/dist/release.json", "utf8")).releaseId')
aws s3 cp "/tmp/deepn-web-releases/$WEB_RELEASE_ID.tar.gz" "s3://$WEB_BUCKET/_releases/$WEB_RELEASE_ID.tar.gz" --cache-control 'public,max-age=31536000,immutable'
aws s3 sync web/dist/assets/ "s3://$WEB_BUCKET/assets/" --cache-control 'public,max-age=31536000,immutable'
aws s3 cp web/dist/ "s3://$WEB_BUCKET/" --recursive --exclude 'assets/*' --exclude 'index.html' --cache-control 'no-store,max-age=0'
aws s3 cp web/dist/index.html "s3://$WEB_BUCKET/index.html" --content-type 'text/html; charset=utf-8' --cache-control 'no-store,max-age=0'
aws cloudfront create-invalidation --distribution-id "$WEB_DISTRIBUTION" --paths '/*'
```

L'index est publié en dernier. Les assets hachés sont immuables et conservés :
**aucun `--delete`**. Les onglets déjà ouverts et les anciennes archives restent
lisibles. Le nettoyage éventuel des anciennes releases est une opération distincte.
Attendre la fin de l'invalidation puis vérifier le `release.json` distant, les routes
profondes, CORS API/S3/streaming, les retours OAuth et le cookie de session. La
persistance de session utilise les appels `/api/*` sur l’origine CloudFront du site ;
un build valide ne prouve pas la restauration dans le navigateur. Le compte rendu
de TASK-605 distingue les contrôles de publication des recettes complètes de
TASK-440.1 à TASK-440.4 et des prérequis de TASK-601.

## Première création sans domaine et bascule ultérieure

Dev active `web_app_hosting_enabled` sans DNS ni certificat personnalisé. Le module
renvoie `app_base_url` avec le nom `*.cloudfront.net`. Le proxy API utilise les
politiques AWS `CachingDisabled` et `AllViewerExceptHostHeader` : aucune réponse de
session n’est mise en cache ; cookies, Authorization, X-Session-Transport et query
strings sont transmis. La réécriture SPA est une fonction attachée seulement au
comportement S3 ; les erreurs de l’API conservent leur code et leur corps.

La première création se fait en deux étapes : créer la distribution, puis renseigner
la variable dev `web_app_origin` avec son URL et appliquer les origines et callbacks.
Cette entrée explicite évite le cycle Terraform CloudFront → API Gateway → CORS →
CloudFront. Elle est conservée dans la configuration dev pour les applies suivants.
Le build utilise cette même URL pour `VITE_API_BASE_URL`, le streaming gardant sa
porte dédiée et ses autorisations CORS. L’API et les comptes mobiles restent sur
leurs ressources existantes.

Après achat du domaine, renseigner `web_public_domain`/`web_public_zone_id`, appliquer
le certificat et les alias existants, reconstruire avec la nouvelle `app_base_url`,
puis publier le paquet. Le routage `/api/*` reste en place ; vérifier les callbacks
Cognito et les origines d’upload/streaming. Une reconnexion est nécessaire sur la
nouvelle adresse. La publication de `www` et les liens légaux gardent leur workflow.

## Retour à un paquet précédent — propriétaire uniquement

1. Choisir le `releaseId` précédent dans le registre de livraison, avec son mode et
   sa configuration effective ; ne pas reconstruire l'ancien code avec les valeurs
   du nouvel environnement.
2. Télécharger son archive `_releases/<releaseId>.tar.gz` dans un dossier vide,
   l'extraire et lancer le vérificateur sur ce dossier. Comparer son identité à
   l'identité demandée avant tout upload. Conserver le paquet courant pour revenir.
3. Réexécuter les mêmes commandes d'upload (d'abord assets, ensuite autres fichiers,
   index en dernier) depuis ce dossier, sans suppression d'assets. Invalider `/*`.
4. Attendre l'invalidation, relever le `releaseId` distant et refaire les vérifications
   navigateur du périmètre concerné. Enregistrer quel paquet a remplacé lequel.

Référence de chargement des modes : [documentation officielle Vite 6](https://v6.vite.dev/config/#using-environment-variables-in-config).
