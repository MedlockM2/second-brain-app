# Web dev sur CloudFront — livraison du 2026-11-06

Publication explicitement autorisée par le propriétaire dans la conversation de
TASK-605, avant achat du domaine. Environnement : **dev**, profil AWS
`second-brain-app`. Aucun déploiement sur prod.

## Adresse et ressources

- Site : https://d3n3qjz3si2rme.cloudfront.net
- Distribution app : `E31Z5U8Y6RDUWR`, déployée.
- Bucket privé : `media-summarizer-app-125313707865-dev`, OAC, chiffrement AES256 et
  blocage de tout accès public S3.
- `/api` et `/api/*` : proxy HTTPS vers l’API Gateway dev existante
  `jji077bi8e.execute-api.eu-west-3.amazonaws.com`.
- API : politiques AWS `CachingDisabled` et `AllViewerExceptHostHeader`, cookies,
  Authorization, X-Session-Transport et query strings transmis. Erreurs conservées
  sans page de remplacement ni cache d’erreur.
- SPA : fonction `media-summarizer-app-routes-dev` attachée uniquement au
  comportement S3 ; les fichiers absents restent des erreurs S3.
- Les pages légales restent sur la distribution `www` existante.

Terraform est appliqué en deux étapes ciblées : création de l’hébergement, puis
origines/callbacks web, API, streaming et uploads. Les plans ont été relus avant
application. Le renouvellement du déploiement REST de streaming accompagne son
changement CORS ; aucune donnée métier n’a été supprimée. La réapplication du
champ privé Apple est attendue : AWS ne renvoie pas cette valeur, le wrapper relit
la même source en mémoire dans Secrets Manager.

`envs/dev/web_hosting.tf` conserve l’origine CloudFront explicitement pour éviter
un cycle Terraform entre la distribution, API Gateway et le CORS. Les callbacks
mobile, le pool et les clients Cognito existants sont conservés. Le callback web
est désormais `https://d3n3qjz3si2rme.cloudfront.net/auth/callback`.

## Paquet publié

- Mode : `beta`, distribution autorisée par le vérificateur.
- Révision de source web : `e38c66fd` ; aucun fichier exécutable web n’a été modifié
  pendant cette livraison. Les modifications Terraform et documentaires sont sur
  la branche locale `codex/task-605-web-cloudfront`, sans push ni merge.
- Release : `c641ddab951e4c02d2c9a939643f480a14e49caad223279fc0c10a8330c704f7`.
- Archive : `_releases/<releaseId>.tar.gz` dans le bucket app ; copie locale dans
  `/tmp/deepn-web-releases/`. L’archive contient uniquement le paquet web public.
- Configuration publique : `VITE_API_BASE_URL` vaut l’origine du site ci-dessus,
  sans suffixe `/api`. Le streaming utilise
  `https://evh853pvbl.execute-api.eu-west-3.amazonaws.com/v1`.
- Les autres réglages optionnels de release sont vides : aucun lien store/site,
  fallback feedback ni identifiant d’extension n’a été inventé. Les liens légaux
  existants dans le code partagé restent utilisés.

Le fichier local ignoré `web/.env.beta.local` conserve ces paramètres publics pour
le prochain build. Assets et archive ont été publiés avec cache immuable, les
autres fichiers sans cache, `index.html` en dernier. Aucune suppression d’assets.
L’invalidation CloudFront `/*` est terminée. Le manifeste distant correspond au
manifeste local et les empreintes de chacun de ses cinq fichiers sont identiques.

## Vérifications effectuées

- `terraform fmt -check`, `terraform validate`, typecheck et lint web : réussis.
- Builds `ci` et `beta` : réussis ; seul le paquet `beta` a été publié.
  Avertissement Vite existant sur la taille du bundle, sans échec de compilation.
- `/`, `/library` et `/auth/callback` : 200, même index SPA.
- `/api/auth/oauth/config` en transport cookie : 200 et callback CloudFront.
- `/api/media` sans session : 401 JSON ; route API inexistante : 404 JSON ;
  aucune transformation en index HTML, aucun en-tête Age sur ces réponses.
- Fichier JS inexistant : 403 XML S3, sans remplacement par la SPA.
- Preflights CORS documents/audio (PUT content-type) et streaming
  (GET authorization) : 200 et origine CloudFront exacte.
- Chrome piloté via les outils natifs disponibles : connexion Google avec un
  compte existant, accueil et bibliothèque chargés ; rechargement complet de
  `/library` sans nouvelle connexion ; ouverture d’un second onglet indépendant
  directement sur `/library`, bibliothèque et navigation authentifiée présentes
  sans passage par l’écran de connexion.

Ces contrôles de publication ne remplacent pas les recettes complètes
TASK-440.1 à TASK-440.4 : pas de recette Safari/Firefox/Edge, Apple, de génération
payante ou de création/suppression de contenu. Aucun test automatisé ajouté.

## Prochaines publications et domaine

Suivre `docs/WEB_RELEASE.md`, avec les outputs app de la racine dev et le mode
`beta`. Cette première livraison constitue le premier paquet de retour arrière :
pour revenir dessus, récupérer son archive S3, vérifier le manifeste, republier
assets puis index en dernier et invalider `/*`. Aucun paquet antérieur n’existait.

TASK-591 reste la bascule ultérieure vers le domaine personnalisé ; `/api/*`
restera sur la même origine que le site. La nouvelle adresse nécessitera une
reconnexion. Le Vite local n’est plus l’origine/callback web configuré dans dev.
