---
id: TASK-608
title: Déployer automatiquement la web app dev sur CloudFront à chaque push sur main
status: Done
assignee: []
created_date: '2026-11-06 16:15'
updated_date: '2026-11-06 16:32'
labels:
  - tooling
  - web
  - infrastructure
  - release
dependencies: []
references:
  - .github/workflows/deploy-lambda.yml
  - docs/WEB_RELEASE.md
  - infrastructure/terraform/envs/dev/gha_oidc.tf
  - scripts/verify_web_release.mjs
  - docs/validation/task-605-web-cloudfront/README.md
modified_files:
  - .github/workflows/deploy-web.yml
  - .gitignore
  - web/.env.beta
  - infrastructure/terraform/envs/dev/gha_oidc.tf
  - infrastructure/terraform/modules/platform/web_hosting.tf
  - docs/WEB_RELEASE.md
  - web/README.md
priority: high
ordinal: 215000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Aujourd'hui, la publication de la web app dev (https://d3n3qjz3si2rme.cloudfront.net, TASK-605) est manuelle : `docs/WEB_RELEASE.md`, section « Dépôt et invalidation ». La CI de `main` ne fait que compiler le web en mode `ci`. Le contrôle de parité (`scripts/check_web_parity.py`) garantit que le code web suit le mobile sur `main`, mais le site en ligne ne le suit pas : il garde la version de la dernière publication faite à la main. Exemple du 2026-11-06 : la correction de largeur de `.page` (commit 60507455) a dû être publiée à la main.

Objectif : faire comme `.github/workflows/deploy-lambda.yml`. Chaque push sur `main` qui touche le web publie le paquet `beta` sur la distribution app dev. La prod n'est jamais déployée automatiquement.

Périmètre :
- Nouveau workflow `.github/workflows/deploy-web.yml`. Déclencheurs : push sur `main` avec des chemins `web/**`, `packages/core/**`, `package-lock.json`, le workflow lui-même, et `workflow_dispatch`. Concurrence : une seule publication à la fois, la plus récente gagne.
- Étapes : `npm ci`, typecheck, lint, `npm run build --workspace web -- --mode beta`, `node scripts/verify_web_release.mjs web/dist`. Ensuite, dans l'ordre exact du runbook : archive `_releases/<releaseId>.tar.gz`, `assets/` en cache immuable, autres fichiers en `no-store`, `index.html` en dernier, **sans `--delete`**, puis invalidation `/*` dont on attend la fin. Contrôle final : le `releaseId` de `release.json` distant est égal au local.
- Configuration publique du mode `beta` : un `web/.env.beta` commité, qui ne contient que des valeurs publiques (`VITE_API_BASE_URL` = `app_base_url`, `VITE_CHAT_STREAM_URL` = output `chat_stream_url`, les autres optionnelles vides). Il doit être accepté par les validations de build existantes. Le nom du bucket et l'ID de distribution passent par l'environnement du workflow ou sont lus côté AWS par un tag, jamais devinés par préfixe. Même principe que `DEPLOY_ENVIRONMENT` dans `deploy-lambda.yml`.
- Droits : ajouter au rôle de déploiement OIDC dev (`infrastructure/terraform/envs/dev/gha_oidc.tf`, secret `AWS_DEPLOY_ROLE_ARN`) les seules actions nécessaires : `s3:PutObject`, plus `s3:ListBucket` si `sync` l'exige, sur le bucket app dev uniquement, et `cloudfront:CreateInvalidation` / `cloudfront:GetInvalidation` sur cette seule distribution.
- Documentation : `docs/WEB_RELEASE.md` et `web/README.md` décrivent le déploiement automatique sur dev. La procédure manuelle ne sert plus qu'à la prod et au retour à un paquet précédent.

Note propriétaire (hors AC) : le `terraform apply` des droits IAM part automatiquement au merge via `terraform-dev.yml`. Le premier run réel de `deploy-web.yml` après le merge est la vérification qui compte : `release.json` distant = révision de `main`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `.github/workflows/deploy-web.yml` existe, se déclenche sur push `main` (chemins web/core/lock/workflow) et sur `workflow_dispatch`, et ne cible que dev
- [x] #2 Les étapes d'envoi reprennent l'ordre et les en-têtes de cache de `docs/WEB_RELEASE.md`, sans `--delete`, et attendent la fin de l'invalidation puis comparent le `releaseId` distant au local
- [x] #3 `web/.env.beta` est commité, ne contient que des valeurs publiques, et `npm run build --workspace web -- --mode beta` suivi de `node scripts/verify_web_release.mjs web/dist` réussit en local
- [x] #4 Le rôle OIDC dev reçoit uniquement les droits S3 (bucket app dev) et CloudFront (distribution app dev) nécessaires ; `terraform fmt -check` et `terraform validate` sur `envs/dev` sont propres
- [x] #5 `docs/WEB_RELEASE.md` et `web/README.md` décrivent le déploiement automatique dev et limitent la procédure manuelle à la prod et au retour à un paquet précédent
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Nouveau workflow `.github/workflows/deploy-web.yml`, lancé par un push sur `main` (web/, packages/core/, package.json, package-lock.json, le workflow lui-même) ou à la main. Il fait le typecheck, le lint, le build `beta`, passe le vérificateur, puis envoie dans l'ordre du runbook : archive, assets immuables, autres fichiers en no-store, index.html en dernier, sans suppression. Il attend la fin de l'invalidation `/*` et vérifie que le `release.json` servi porte le `releaseId` construit. Une seule publication à la fois, sans interruption, la plus récente en attente gagne. Le compte AWS dev est contrôlé avant tout envoi.

Configuration publique : `web/.env.beta` est commité (exception dans `.gitignore`) avec `app_base_url` et `chat_stream_url`. Un build local `--mode beta` et le vérificateur passent avec ce seul fichier (releaseId ca9804ce…).

Droits : le module expose `app_bucket_arn` et `app_distribution_arn`. Le rôle OIDC dev reçoit `s3:ListBucket` sur le bucket app, `s3:PutObject` sur ses objets, et `cloudfront:CreateInvalidation` / `GetInvalidation` sur la seule distribution app. `fmt` et `validate` passent. Le plan relu ne contenait que ces changements, plus la clé Apple réappliquée à chaque fois. Appliqué en ciblé sur dev avant le push, pour que le premier run ne parte pas avant ses droits.

Documentation : `docs/WEB_RELEASE.md` et `web/README.md` décrivent la publication automatique de dev. La procédure manuelle ne sert plus qu'à la prod et au retour à un paquet précédent. Ils recommandent de ne pas créer de `web/.env.beta.local`, qui passerait devant `web/.env.beta`.
<!-- SECTION:FINAL_SUMMARY:END -->
