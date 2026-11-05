---
id: TASK-471
title: 'Héberger app.<domaine> et www.<domaine> sur S3 et CloudFront, dans Terraform'
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 15:54'
updated_date: '2026-11-05 09:03'
labels:
  - infrastructure
  - web
  - feature
  - agent
dependencies: []
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - infrastructure/terraform/modules/platform/lambda_api.tf
  - infrastructure/terraform/modules/platform/s3.tf
  - infrastructure/terraform/modules/platform/variables.tf
  - infrastructure/terraform/modules/platform/www.tf
  - TASK-590
priority: medium
type: feature
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — préparer les ressources et le runbook dans son worktree ; propriétaire — appliquer et publier dans la tâche de mise en service web, sans opération distante exigée ici.

Source : Owner Validation de docs/research/task-424-website-and-browser-extension/README.md et complément du 2026-10-11 : hébergement AWS/Terraform, S3 privé + CloudFront pour app. et www., Route 53, API Gateway pour api. La décision technique est acquise, aucun benchmark supplémentaire.

Réconciliation de l’audit du 2026-11-04 : www.tf, le bucket privé et la distribution de confidentialité existent déjà et servent la page dev. Les réutiliser pour l’alias www. et le certificat ; ne pas recréer cette moitié ni affirmer que rien n’est déployé. Il reste la configuration d’hébergement de la SPA, certificats/alias paramétrables, repli des routes profondes et en-têtes de sécurité. Les paramètres de domaine restent optionnels et vides par défaut : la préparation de code peut avancer avant l’achat, sans inventer le domaine réel ni changer l’environnement ouvert.

La dépendance bloquante TASK-445 est remplacée par une référence de raccordement : son domaine API sera nécessaire à la mise en service, pas à la livraison des ressources paramétrables de cette tâche. Les applications et le public www restent séparés ; respecter le site légal actuellement publié. Le runbook de dépôt est coordonné avec la tâche de livraison web, qui porte configuration du paquet, cache et retour arrière.

Notes au propriétaire hors AC : après achat et livraison des configurations API/auth, appliquer l’environnement bêta retenu puis publier le paquet selon la tâche de mise en service web. Cela ne réveille pas prod implicitement.

Aucun nouveau test automatisé, secret ni identité de compte dans le dépôt. Les critères portent uniquement sur les fichiers et vérifications atteignables dans le worktree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le module contient la configuration paramétrable du bucket privé app, de CloudFront/OAC et du repli SPA vers index.html, sans dépendre d’un domaine réellement acheté pour livrer le code.
- [x] #2 La distribution www existante est réutilisée ; certificats ACM us-east-1, alias DNS app/www et en-têtes HSTS, nosniff et frame-ancestors sont déclarés avec des paramètres explicites et sans domaine inventé.
- [x] #3 Les configurations du repli SPA et du cache sont lisibles dans les fichiers ; les notes distinguent vérification statique et contrôle distant propriétaire.
- [x] #4 terraform fmt -check et terraform validate passent sur le module et les roots dev/prod concernés ; aucun fournisseur hors AWS n’est ajouté.
- [x] #5 Le runbook décrit le raccordement DNS/TLS et les commandes de dépôt/invalidation en renvoyant à la préparation de livraison web pour le paquet et le retour arrière.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ajouter les paramètres publics domaine/zone vides par défaut et un petit module ACM dédié, alimenté par un provider AWS us-east-1 dans chaque root, afin de préserver la validation autonome de platform sans alias interne.
2. Ajouter app privé/OAC/CloudFront conditionné au domaine, repli 403/404 SPA et cache min_ttl=0 ; réutiliser www à la même adresse Terraform en ajoutant seulement alias/certificat lorsque configurés.
3. Déclarer les alias Route 53 A/AAAA, les en-têtes de sécurité et les origines de la CSP ; exposer les outputs nécessaires au runbook WEB_RELEASE. Les valeurs par défaut gardent le comportement dev/prod existant.
4. Documenter raccordement TLS/DNS, coordination API/auth/CORS et étapes propriétaire ; exécuter fmt et validate sans backend sur modules et roots dev/prod/staging, sans plan/apply ni publication.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
terraform fmt -check -recursive et init -backend=false/validate réussis sur modules/web_certificate, modules/platform et roots dev/prod/staging avec le provider AWS 5.100.0 local (Terraform 1.16.2). Aucun backend/state lu, plan/apply ou appel API AWS. Les CI valident également le nouveau module ACM.

Revue du code : domaine/zone vides => ni certificat, ni app, ni alias ; www garde ses adresses Terraform et son nom CloudFront. ACM us-east-1 est fourni par un module régional indépendant, sans alias interne qui casserait la validation autonome de platform. App privé/OAC, repli 403/404 index, TTL et en-têtes sont explicites. Les roots conservent leurs valeurs CORS actuelles jusqu’à activation volontaire du domaine et les réglages de sommeil restent inchangés.

WEB_HOSTING.md décrit zone dans le compte cible, TLS/DNS, raccordement API/auth et vérifications distantes propriétaire. WEB_RELEASE.md reste la procédure de dépôt/invalidation et rollback ; aucune publication de la confidentialité existante n’a été faite.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prépare l’hébergement app privé S3/CloudFront et le raccordement app/www au domaine, avec certificat ACM us-east-1, alias Route 53, repli SPA, cache et en-têtes. Réutilise www sans changer son adressage ni activer le domaine par défaut. Les modules et trois roots passent fmt/validate ; le runbook sépare livraison de code et mise en service propriétaire.
<!-- SECTION:FINAL_SUMMARY:END -->
