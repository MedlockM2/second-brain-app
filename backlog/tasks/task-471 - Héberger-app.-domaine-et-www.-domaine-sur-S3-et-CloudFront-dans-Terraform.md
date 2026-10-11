---
id: TASK-471
title: 'Héberger app.<domaine> et www.<domaine> sur S3 et CloudFront, dans Terraform'
status: To Do
assignee: []
created_date: '2026-10-11 15:54'
labels:
  - infrastructure
  - web
  - feature
dependencies:
  - TASK-445
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - infrastructure/terraform/modules/platform/lambda_api.tf
  - infrastructure/terraform/modules/platform/s3.tf
  - infrastructure/terraform/modules/platform/variables.tf
priority: medium
type: feature
ordinal: 78000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'app web et l'extension de Deepn sont décidées par l'owner dans `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11. Ce `Decision` renvoie à `complement-response-2026-10-11.md` (même répertoire), qui **prime sur la Recommendation et sur les §8 à §12 du README**. Cette tâche est l'élément **W-01** du §3 de ce complément.

Le `Decision`, point 2 : **hébergement tout AWS, dans Terraform**. Route 53 pour le DNS (zone de task-443), `app.<domaine>` (la SPA) et `www.<domaine>` (pages statiques) sur **S3 + CloudFront**, `api.<domaine>` en domaine personnalisé d'API Gateway (task-445). Pas de Cloudflare, pas d'Astro (complément §9).

## Périmètre

- Deux buckets privés (`app`, `www`) et deux distributions CloudFront avec **Origin Access Control**.
- Un certificat ACM en `us-east-1` (exigence de CloudFront) couvrant `app.` et `www.`, validé par DNS dans la zone Route 53.
- Les enregistrements alias `app` et `www`.
- Pour `app`, le **repli SPA** : une 403 ou 404 de l'origine sert `index.html` avec un code 200.
- En-têtes de sécurité par une *response headers policy* : HSTS, `X-Content-Type-Options`, `frame-ancestors 'none'`.
- Variables de domaine **vides par défaut**, sur le modèle d'`api_custom_domain` et `api_zone_id` dans `lambda_api.tf` : rien n'est créé tant que le domaine n'est pas renseigné.
- Un runbook qui décrit le dépôt d'un build : `aws s3 sync` puis invalidation CloudFront.

## Règles

Rien n'est déployé : aucune compatibilité, aucun double chemin. Pas de tests automatisés. Aucun secret, e-mail de compte ni identifiant de support dans les fichiers suivis ; le nom de domaine retenu par task-443 n'est pas un secret.

## Note à l'owner

`terraform apply` sur dev puis prod une fois le domaine renseigné ; vérifier ensuite qu'une URL profonde de `app.` (par exemple `/media/x`) renvoie `index.html` en 200.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les buckets, distributions CloudFront avec Origin Access Control, le certificat ACM us-east-1 et les alias Route 53 de app. et www. existent dans le module platform, conditionnés à des variables de domaine vides par défaut
- [ ] #2 La distribution de app. sert index.html en 200 sur une 403 ou 404 de l'origine, et les deux distributions portent une response headers policy avec HSTS, X-Content-Type-Options et frame-ancestors 'none'
- [ ] #3 Aucun fournisseur Terraform hors AWS n'est ajouté
- [ ] #4 terraform validate passe pour dev et pour prod
- [ ] #5 Un runbook décrit le dépôt d'un build par aws s3 sync puis l'invalidation CloudFront
<!-- AC:END -->
