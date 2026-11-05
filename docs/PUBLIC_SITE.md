# Générer le site public Deepn

TASK-472 étend `scripts/build_legal_site.py`, le générateur Python existant.
TASK-444 reste responsable de la relecture/approbation des textes et de leur
publication ; TASK-471 porte les ressources AWS, TASK-591 la mise en service web,
TASK-592/593 les soumissions des extensions. Aucun déploiement n'est fait par la
génération. Le site existant de confidentialité dev n'est pas remplacé à distance.

## Commandes locales

Depuis la racine :

```sh
uv run --no-project --with markdown==3.7 python scripts/build_legal_site.py /tmp/deepn-public-site
```

Sorties : `index.html` pour `/`, `privacy` pour `/privacy`, `extension` pour
`/extension`, l'icône SVG de la marque déjà utilisée par web, et
`site-manifest.json` (allow-list des fichiers/types MIME à publier). Le nom Deepn,
l'entité Second Brain Labs et le lien vers la confidentialité sont sur l'accueil.
La racine CloudFront www est `index.html`. Les routes légales restent sans suffixe
et sans repli SPA ; les ancres `#delete-account` et `#delete-data` sont conservées.

La décision propriétaire du 2026-10-30 dans TASK-357 reste la règle bêta : pas de
page `/terms` générée, le lien Terms utilise l'EULA standard Apple depuis la source
partagée `packages/core/src/constants/legal.ts`. `terms-of-service.md` est un
brouillon non publié, pas une seconde politique active. Le générateur ne le lit pas.

## Paramètres publics facultatifs

Un JSON local hors des fichiers suivis peut être passé avec `--config` :

```json
{
  "site_url": "",
  "web_app_url": "",
  "chrome_store_url": "",
  "edge_store_url": "",
  "firefox_store_url": "",
  "contact_email": ""
}
```

- `site_url` : origine réelle de `www`, pour les liens canoniques. Vide, aucun
  domaine n'est déduit de la marque. Le script de publication la lit depuis
  l'output Terraform `www_base_url` ; un désaccord avec le JSON est refusé.
- `web_app_url` : origine HTTPS réelle de la SPA, choisie dans TASK-591. Vide,
  aucun bouton ne prétend ouvrir une web app déjà publiée.
- Liens Chrome/Edge/Firefox : liens vers les fiches officielles réellement ouvertes
  par le propriétaire après TASK-592/593. Vides, la page indique qu'aucun lien
  d'installation n'est publié ici, sans ancre fictive. Seuls les hôtes des stores
  correspondants sont acceptés. Chrome/Edge gardent l'appairage en un clic et le
  code de secours ; Firefox propose le code comme parcours principal.
- `contact_email` : uniquement une boîte de contact publique approuvée. Vide, le
  contact dédié déjà présent dans le Markdown est conservé. Renseignée, cette
  valeur remplace ce contact dans la page générée, y compris les `mailto` de
  suppression. Ne jamais utiliser un login cloud, compte reviewer, secret ou
  adresse de testeur. La nouvelle adresse doit réellement recevoir et permettre
  une réponse avant publication (TASK-443/444).

Les origines sont sans chemin ; les liens stores peuvent contenir leur chemin et
query string. Credentials dans l'URL et clés inconnues sont refusés. Les paramètres
ne prouvent pas la disponibilité des services : le propriétaire la vérifie avant
publication. La génération ne contacte aucune API, store ni fournisseur de compte.

## Apple et absence de .well-known

Le raccordement actuel passe par Cognito : le Services ID Apple est associé à
l'App ID primaire, au domaine Cognito et au retour `/oauth2/idpresponse`, comme le
code/documentation dans `docs/AUTHENTICATION_SETUP.md` et `platform/cognito.tf`.
La configuration du nouveau domaine auth relève de TASK-528.

La [documentation Apple, consultée le 2026-11-05](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)
indique que l'enregistrement des domaines/sous-domaines Sign in with Apple ne
nécessite pas de téléverser un fichier sur le serveur. La
[procédure Cognito pour Apple](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-social-idp-apple.html)
confirme le domaine Cognito et `/oauth2/idpresponse`. En conséquence aucun
`apple-developer-domain-association.txt`, ancien callback API ou fichier Apple Pay
n'est généré ici. Cette absence est intentionnelle, pas un fichier vide à remplir.
Un éventuel autre produit exigeant une preuve de domaine demande sa propre
configuration et un apport propriétaire hors dépôt ; aucune donnée de compte Apple
n'est copiée pour anticiper un besoin absent.

## Mise à jour factuelle de confidentialité

Le Markdown reste la source et conserve les clauses/amendements propriétaire,
contact dédié et sections de suppression. Cette livraison décrit plus précisément
la sélection/origine de l'extension, le contexte web des signalements, les réservations
et mesures de traitement ainsi que le stockage des sessions mobile/web/extension.
La date de mise à jour est le 2026-11-05 ; la date d'effet antérieure est conservée
pour validation propriétaire, sans annoncer cette révision déjà publiée.

Revue des destinataires déjà listés, depuis le code et les réglages documentés :

| Destinataires | Chemins/capacités effectivement présents |
|---|---|
| OpenAI | `core/services/llm_config.py`, générations, chat et traductions ; choix propriétaire commun, pas de nouveau modèle choisi ici |
| Deepgram | `workers/transcription/deepgram_worker.py` et configuration de transcription |
| LlamaParse / Unstructured | résolveurs documentaires `infrastructure/resolvers/` |
| Apify / X | résolveurs de contenu public, sans envoi de l'identité du compte dans le lien de collecte |
| Algolia / AWS | index de recherche et infrastructure/stockage/Cognito existants |
| RevenueCat | intégration de statut d'accès/abonnements existante, aucune nouvelle vente web |
| Expo / Sentry / Canny | notifications mobile, rapports mobile et board de feedback existants |
| Apple / Google | fédération d'identité Cognito et chemins natifs documentés |

Les mentions de localisation, contrats de sous-traitance, garanties et droits
restent celles déjà approuvées dans la politique. Elles ne sont pas réécrites ni
nouvellement certifiées par cette revue de code. TASK-444 confirme le texte final,
les dates, contacts et obligations avant toute publication.

## Publication propriétaire

Après relecture de l'HTML généré, appliquer le raccordement voulu selon
[WEB_HOSTING.md](WEB_HOSTING.md), puis, depuis la racine :

```sh
AWS_PROFILE=second-brain-app ./scripts/publish_legal_site.sh dev /chemin/vers/public-config.json
```

Omettre le second argument conserve les paramètres facultatifs vides et le contact
approuvé du Markdown. Le script publie seulement les fichiers de son manifeste,
avec `text/html` pour les routes sans extension et `image/svg+xml` pour l'icône,
l'accueil en dernier, puis invalide `/*`. Il ne supprime pas les objets existants.
Ne jamais publier un dossier arbitraire qui contiendrait un ancien `/terms` ou un
fichier de compte. Aucun effet sur le bucket app ni sur la release SPA.

Vérifier ensuite `/`, `/privacy#delete-account`, `/privacy#delete-data`, `/extension`,
leurs contenus/types MIME, les liens réellement ouverts et l'ancien lien de
confidentialité dev. La bascule des URL légales mobile/web et des métadonnées stores
est propriétaire. Revenir à une version antérieure de ces fichiers est une nouvelle
publication volontaire de leurs sources approuvées ; ne pas restaurer le paquet SPA
à la place du site public.
