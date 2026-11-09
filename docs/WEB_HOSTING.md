# Hébergement web AWS paramétrable

TASK-471 livre du Terraform et ce runbook. La mise en service, les valeurs du domaine
et les opérations distantes appartiennent au propriétaire dans TASK-591, après
TASK-443/445/528. La génération/publication de `www` est séparée (TASK-472/444).
Aucun apply, réveil de prod ou changement du site légal publié n'est exécuté ici.

## Ressources et valeurs par défaut

- `platform/www.tf` garde les adresses Terraform du bucket, de l'OAC et de la
  distribution **existants**. Le défaut reste son nom CloudFront avec certificat
  CloudFront. Pas de second `www`, déplacement d'état ou migration.
- `platform/web_hosting.tf` déclare le bucket `app` privé, chiffrement AES256,
  public-access block, propriété BucketOwnerEnforced et policy de lecture limitée
  à l'ARN de sa distribution par OAC SigV4. Ces ressources restent désactivées
  tant que `public_domain` est vide.
- `modules/web_certificate` crée un certificat ACM `app` + SAN apex, `www` et
  `auth` (domaine Cognito, task-528) et sa validation DNS. Chaque root lui passe son provider `aws.us_east_1`, dans le même
  compte que ce root. Aucun provider de plateforme n'est configuré dans les modules.
  Le provider secondaire de prod garde son `allowed_account_ids` existant.
- `public_domain` et `public_zone_id` vont ensemble : le domaine de base de
  l'environnement et sa zone Route 53, dans le compte de cet environnement. Depuis
  le 2026-11-09 (task-443, task-445) : dev = `dev.deepn.app` (zone du compte dev,
  déléguée depuis la zone prod), prod = `deepn.app` (zone du compte prod) ; staging
  reste vide. L'apex, `app.`, `www.`, `api.` et `auth.` en dérivent.

Lorsqu'ils sont renseignés, le certificat validé en `us-east-1` est attaché aux deux
distributions (SNI, TLSv1.2_2021), avec les alias `app`, `www` et apex (sur `www`) et
les records Route 53 A/AAAA. Le choix de région suit [l'exigence CloudFront pour ACM](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html).
Les roots transmettent alors `https://app.<domaine choisi>` comme origine web à la
plateforme, à la place de localhost dev ou de l'origine vide prod/staging. Ce
changement attend l'activation volontaire du domaine ; les défauts ne l'activent pas.

## SPA, cache et sécurité

La distribution app redirige HTTP vers HTTPS, ne sert que GET/HEAD et prend
`index.html` comme racine. Une erreur S3 403 ou 404 renvoie `/index.html` en 200 :
React Router résout les routes profondes. La configuration met le TTL d'erreur à
zéro ; cela ne remplace pas les vérifications réelles des routes après publication.
Une ressource statique manquante peut aussi recevoir l'index : contrôler les assets
et leur type MIME dans la recette, pas seulement un code HTTP 200.

Sa cache policy a `min_ttl = 0`, `default_ttl = 0`, `max_ttl = 31536000` : les
Cache-Control du paquet commandent index non conservé et assets hachés immuables.
Cookies, query strings et en-têtes utilisateur ne sont pas transmis à S3. Le JWT,
le cookie de session et les réponses API restent hors de cette distribution.
La distribution `www` conserve sa policy existante et l'invalidation du script
public, sans appliquer le repli SPA aux pages légales.

Les deux distributions ont HSTS, nosniff et interdiction d'encadrement via
frame-ancestors/X-Frame-Options. La CSP app autorise ses scripts propres, les styles
React en ligne, les images HTTPS des éditeurs et l'audio HTTPS/blob. `connect-src`
énumère l'API HTTP, le streaming et les buckets d'upload du même environnement ;
un domaine API configuré est inclus. `web_connect_origins` ajoute uniquement des
origines HTTPS exactes si la release en emploie d'autres (sans wildcard ni chemin).
Le propriétaire doit comparer cette liste aux valeurs du manifeste du paquet :
un build valide ne prouve pas que les CORS/presigned PUT/OAuth fonctionnent.

## Raccordement propriétaire

1. Domaine acquis et délégué (TASK-443) ; domaines de base et zones renseignés
   dans les roots dev et prod (TASK-445). L'ordre de mise en service et les
   réglages OAuth sont dans `docs/PRODUCTION_RELEASE_RUNBOOK.md`, section
   « Domain bring-up (deepn.app) ».
2. Le certificat us-east-1 couvre l'apex, app, www et auth ; `api.` a son
   certificat régional eu-west-3 (`lambda_api.tf`).
3. Ajouter si besoin des `web_connect_origins`. Ne pas écrire d'identité de compte
   ou credential dans un fichier suivi.
4. Revoir le plan : conservation de `aws_cloudfront_distribution.www` et de son
   bucket existant, créations app attendues, certificat uniquement us-east-1,
   zone et compte voulus, origine API/S3/streaming cohérente. Appliquer volontairement.
5. Attendre validation ACM et déploiement CloudFront/DNS. Relever seulement les
   outputs publics `app_base_url`, `app_bucket_name`, `app_distribution_id` et
   `www_base_url`, `www_bucket_name`, `www_distribution_id`. N'enregistrer aucun
   dump d'outputs Terraform : les valeurs sensibles restent chez le propriétaire.
6. Construire/vérifier le paquet pour cet environnement, le déposer et invalider
   selon [WEB_RELEASE.md](WEB_RELEASE.md) : assets d'abord, index en dernier,
   aucun `--delete`, archive identifiée pour le retour arrière.
7. Pour `www`, utiliser la génération/publication de TASK-472. La confidentialité
   dev actuelle reste la référence tant que le propriétaire n'a pas publié et
   validé la bascule des liens légaux partagés et des métadonnées stores.
8. Vérifier en distant TLS, alias, refus d'accès S3 direct, en-têtes, routes profondes,
   cache, API, streaming, upload, retours OAuth et session persistante. Ces contrôles
   relèvent de TASK-591 et des recettes, pas des AC de cette livraison de code.

Les commandes de dépôt/invalidation exactes et le retour à une archive précédente
sont dans [WEB_RELEASE.md](WEB_RELEASE.md). Pour les pages publiques existantes,
`scripts/publish_legal_site.sh dev` reste une commande propriétaire ; aucune page
n'est automatiquement téléversée par Terraform.

## Vérification locale de cette livraison

`terraform fmt -check -recursive infrastructure/terraform`, puis `init -backend=false`
et `validate` sur `modules/web_certificate`, `modules/platform`, `envs/dev`,
`envs/prod` et `envs/staging` passent sans lire de state ou contacter les API AWS.
Ces validations vérifient schéma et références avec le provider AWS 5.x ; elles ne
prétendent ni appliquer un plan ni constater une configuration distante. Les deux
CI valident aussi le module certificat. Les autres choix et réglages de sommeil
prod/staging restent ceux de leurs roots.
