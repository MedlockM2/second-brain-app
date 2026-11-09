---
id: TASK-445
title: Préparer le domaine API et la configuration mobile de production de Deepn
status: Done
assignee:
  - agent
created_date: '2026-10-10 15:13'
updated_date: '2026-11-09 13:20'
labels:
  - v1-launch
  - release
  - agent
dependencies:
  - TASK-443
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/PRODUCTION_RELEASE_RUNBOOK.md
  - mobile/MOBILE_CI_CD.md
priority: high
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Agent — livrer les changements de configuration et de runbook ; owner — fournir domaine/zone acquis puis appliquer DNS, certificats et secrets hors dépôt.

## Contexte et périmètre

Phase 9/10 : le profil EAS production pointe encore sur un domaine placeholder. Après acquisition, préparer la configuration Terraform du domaine API et aligner les profils clients appropriés ainsi que les procédures OAuth web. Préserver la séparation dev/prod : les builds internes de bêta restent sur dev tant qu’aucune décision ne les bascule. Ne pas remplacer indistinctement toutes les URLs dev par prod. Les opérations DNS, la mise à jour des secrets et le déploiement sont des prérequis de release de l’owner, pas des ACs du travail en branche.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution par un agent dans son worktree : livrer les fichiers et vérifications locales, sans merge, push, déploiement ni publication. Toute validation déployée relève de la checklist owner, pas des critères du travail en branche.

## Découpage DNS retenu (TASK-443, 2026-11-09)

`deepn.app` est enregistré sur le compte prod ; `dev.deepn.app` est délégué à une zone du compte dev. Le périmètre couvre donc **les deux environnements**, pas seulement prod : la bêta tourne sur dev (TASK-441, TASK-591) et doit recevoir ses propres noms.

- **dev** : domaine de base `dev.deepn.app`, zone du compte dev ; API `api.dev.deepn.app`.
- **prod** : domaine de base `deepn.app`, zone du compte prod ; API `api.deepn.app`.

Chaque environnement ne référence que la zone de son propre compte, jamais celle de l’autre ; l’enregistrement `NS` de délégation est une opération owner hors Terraform (TASK-443). Les identifiants de zone sont des identifiants de ressource, pas des secrets (`AGENTS.md`) : ils sont écrits dans les roots, car la CI dev applique sans variable externe. Réutiliser `api_custom_domain` / `api_zone_id` (`modules/platform/lambda_api.tf`) et `web_public_domain` / `web_public_zone_id` (`envs/*/web_hosting.tf`) plutôt que d’introduire une nouvelle convention : un environnement se configure avec un domaine de base et une zone, dont dérivent `api.`, `auth.`, `app.` et `www.`. Les profils EAS de test (bêta) visent `https://api.dev.deepn.app`, le profil production `https://api.deepn.app` ; l’URL API Gateway technique de dev est retirée des profils dans le même changement. `mobile/eas.json` porte aussi `EXPO_PUBLIC_CHAT_STREAM_URL`, servie par une autre API Gateway : lui donner un nom sous le même domaine de base, ou consigner dans les notes pourquoi elle reste sur son URL technique.

Fichiers à reprendre : voir les notes de TASK-443, section « #3 — Recensement », lignes attribuées à TASK-445. On y trouve les URL `execute-api` de dev dans les profils, la configuration Maestro, les tests E2E et les scripts, ainsi que `api.mediasummarizer.com` et `secondbrainlabs.com`, domaines que le projet ne possède pas, dans `mobile/eas.json`, `mobile/MOBILE_CI_CD.md` et `docs/V1_LAUNCH_PLAN.md`. Les URL des pages légales n'en font pas partie : elles relèvent de la gate de TASK-454.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les configurations Terraform dev et prod dérivent leurs noms d’un domaine de base (`dev.deepn.app`, `deepn.app`) et de la zone de leur propre compte, sans fournisseur nouvellement imposé ni secret suivi ; `terraform fmt -check` et `terraform validate` passent pour dev et prod.
- [x] #2 Le profil EAS production et les références de release visent `https://api.deepn.app` ; les profils de test visent `https://api.dev.deepn.app`, sans URL API Gateway technique restante.
- [x] #3 Le runbook décrit les opérations owner DNS/certificat, OAuth web, Secrets Manager et rebuild ainsi que l’ordre de mise en service.
- [x] #4 Les vérifications locales pertinentes de configuration sont consignées ; aucune URL placeholder n’est annoncée comme endpoint de production valide.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**2026-11-09 — implémenté dans la session principale (Claude), avec TASK-528.**

**Terraform.**
- Un domaine de base par environnement : `public_domain` / `public_zone_id`, anciennement `web_public_domain` / `web_public_zone_id`, renommés partout. `api_custom_domain` / `api_zone_id` sont supprimés : `api.`, `auth.`, `app.`, `www.` et l’apex dérivent du domaine de base (`modules/platform/web_hosting.tf`, locals `api_domain`, `auth_domain`).
- dev : `dev.deepn.app`, zone du compte dev. prod : `deepn.app`, zone du compte prod. staging reste vide.
- La variable dev `web_app_origin`, qui pointait sur l’adresse CloudFront, est supprimée : l’origine vaut `https://app.dev.deepn.app`.
- Certificat `api.` eu-west-3 : ajout des enregistrements et de la ressource de validation, qui manquaient. Sans eux, le domaine API Gateway n’aurait jamais trouvé de certificat valide. La sortie `api_endpoint` vaut `https://api.<domaine>`.
- Certificat us-east-1 : SAN apex + `www` + `auth`. L’apex pointe vers la distribution `www`, qui le porte en alias.
- Vérifications : `terraform fmt -check` et `validate` passent sur dev, prod et staging. `plan` dev en lecture seule : 22 créations, 33 modifications, 2 suppressions (domaine préfixe Cognito, déploiement du chat stream recréé pour son CORS). Aucun apply.

**Clients.**
- Pointés vers `https://api.dev.deepn.app` : profils EAS `development`, `preview`, `internal` ; Maestro ; workflow E2E ; tests E2E ; `scripts/create_review_account.py`.
- Profil `production` : `https://api.deepn.app`, à la place de `api.mediasummarizer.com`, domaine qui n’appartient pas au projet.
- Web : `web/.env.beta`, `deploy-web.yml` et `web/README.md` passent à `https://app.dev.deepn.app`.
- Extension : `extension/.env.example` documente les deux origines.

**Streaming du chat.** Il garde son URL `execute-api`, et le choix est consigné dans le runbook. C’est une API REST distincte en streaming : un domaine personnalisé ajouterait un saut non éprouvé devant le streaming, pour une URL qu’aucun utilisateur ne voit.

**Runbook.** `docs/PRODUCTION_RELEASE_RUNBOOK.md`, section « Domain bring-up (deepn.app) » :
- ordre de mise en service : push Terraform seul, retours Google/Apple, vérifications, push clients, builds, extensions ;
- aucun secret Secrets Manager ne dépend du domaine (`APPLE_REDIRECT_URI` / `GOOGLE_REDIRECT_URI` ne sont plus lus par aucun code) ;
- prod au réveil : conflit d’alias `www.deepn.app` avec la gate de TASK-454, URL de streaming du profil production.

**Documentation.** Mises à jour : `docs/WEB_HOSTING.md`, `docs/WEB_RELEASE.md`, `mobile/MOBILE_CI_CD.md`, `mobile/app.config.ts` (commentaire), `docs/V1_LAUNCH_PLAN.md` (statut du domaine, étapes historiques remplacées par le runbook).

**Note owner (hors critères).** Deux commits à pousser séparément : d’abord Terraform et docs, attendre l’apply, ensuite les clients. Le push Terraform casse les connexions Google et Apple via Cognito jusqu’à la mise à jour des retours chez Google et Apple (runbook, étape 2).
<!-- SECTION:NOTES:END -->
