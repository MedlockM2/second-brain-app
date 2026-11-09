---
id: TASK-445
title: Préparer le domaine API et la configuration mobile de production de Deepn
status: To Do
assignee:
  - agent
created_date: '2026-10-10 15:13'
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
dispatchable: true
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

Chaque environnement ne référence que la zone de son propre compte, jamais celle de l’autre ; l’enregistrement `NS` de délégation est une opération owner hors Terraform (TASK-443). Les identifiants de zone sont des entrées de configuration de l’owner, pas des valeurs suivies. Réutiliser `api_custom_domain` / `api_zone_id` (`modules/platform/lambda_api.tf`) et `web_public_domain` / `web_public_zone_id` (`envs/*/web_hosting.tf`) plutôt que d’introduire une nouvelle convention : un environnement se configure avec un domaine de base et une zone, dont dérivent `api.`, `auth.`, `app.` et `www.`. Les profils EAS de test (bêta) visent `https://api.dev.deepn.app`, le profil production `https://api.deepn.app` ; l’URL API Gateway technique de dev est retirée des profils dans le même changement. `mobile/eas.json` porte aussi `EXPO_PUBLIC_CHAT_STREAM_URL`, servie par une autre API Gateway : lui donner un nom sous le même domaine de base, ou consigner dans les notes pourquoi elle reste sur son URL technique.

Fichiers à reprendre : voir les notes de TASK-443, section « #3 — Recensement », lignes attribuées à TASK-445. On y trouve les URL `execute-api` de dev dans les profils, la configuration Maestro, les tests E2E et les scripts, ainsi que `api.mediasummarizer.com` et `secondbrainlabs.com`, domaines que le projet ne possède pas, dans `mobile/eas.json`, `mobile/MOBILE_CI_CD.md` et `docs/V1_LAUNCH_PLAN.md`. Les URL des pages légales n'en font pas partie : elles relèvent de la gate de TASK-454.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les configurations Terraform dev et prod dérivent leurs noms d’un domaine de base (`dev.deepn.app`, `deepn.app`) et de la zone de leur propre compte, sans fournisseur nouvellement imposé ni secret ou identifiant de zone suivi ; `terraform fmt -check` et `terraform validate` passent pour dev et prod.
- [ ] #2 Le profil EAS production et les références de release visent `https://api.deepn.app` ; les profils de test visent `https://api.dev.deepn.app`, sans URL API Gateway technique restante.
- [ ] #3 Le runbook décrit les opérations owner DNS/certificat, OAuth web, Secrets Manager et rebuild ainsi que l’ordre de mise en service.
- [ ] #4 Les vérifications locales pertinentes de configuration sont consignées ; aucune URL placeholder n’est annoncée comme endpoint de production valide.
<!-- AC:END -->
