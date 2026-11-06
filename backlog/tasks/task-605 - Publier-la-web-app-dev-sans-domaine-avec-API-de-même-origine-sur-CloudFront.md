---
id: TASK-605
title: Publier la web app dev sans domaine avec API de même origine sur CloudFront
status: Done
assignee:
  - '@codex'
created_date: '2026-11-06 15:32'
updated_date: '2026-11-06 15:52'
labels:
  - web
  - infrastructure
  - release
dependencies: []
references:
  - docs/WEB_RELEASE.md
  - web/README.md
  - docs/validation/task-605-web-cloudfront/README.md
priority: high
ordinal: 212000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Le propriétaire autorise explicitement la publication immédiate de la web app sur son adresse CloudFront AWS avant achat du domaine. Les appels /api doivent passer par cette même adresse vers l’API dev existante pour permettre la restauration de session par cookie. TASK-591 conserve la future bascule vers un domaine. Cette exécution inclut les opérations AWS dev et la publication, autorisées dans la conversation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Terraform permet un hébergement app sans domaine, avec routage /api vers API Gateway sans cache et transmission des cookies et en-têtes nécessaires.
- [x] #2 Le routage SPA reste limité aux pages du site et conserve les erreurs JSON de l’API.
- [x] #3 La configuration web et les origines/callbacks dev sont documentés pour l’adresse CloudFront effective, avec vérifications et limites de mise en service consignées sans secrets.
- [x] #4 Les vérifications locales de format Terraform, validation Terraform, typecheck, lint et build web sont effectuées.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Examiner l’état AWS dev et les ressources existantes. 2. Adapter Terraform pour CloudFront sans domaine et le proxy API, puis examiner/appliquer le plan ciblé. 3. Configurer origine web, callbacks et uploads ; construire et publier le paquet web identifié. 4. Vérifier les routes publiques et la restauration de session dans le navigateur disponible ; documenter les limites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Autorisation de publication AWS dev donnée explicitement par le propriétaire. Typecheck et lint web réussis ; terraform validate et fmt passent. Plan initial relu : créations de l’hébergement app, aucune suppression ; réapplication attendue du champ Apple private_key (champ non renvoyé par AWS). Les paramètres fournisseurs restent en mémoire via le wrapper existant ; plans/logs privés hors dépôt.

Hébergement et origine appliqués avec succès sur AWS dev ; distribution E31Z5U8Y6RDUWR déployée, index publié en dernier et invalidation terminée. Paquet beta c641ddab951e4c02d2c9a939643f480a14e49caad223279fc0c10a8330c704f7 : manifeste distant et empreintes des cinq fichiers identiques. Vérifiés : proxy OAuth et callback CloudFront, 401/404 API JSON conservés sans cache, routes SPA, CORS uploads/streaming. Chrome : connexion Google existante, rechargement de /library et nouvel onglet sur /library sans reconnexion. Limites et procédure de retour arrière consignées dans docs/validation/task-605-web-cloudfront/README.md ; TASK-591 reste la future bascule domaine. Aucun test automatisé ajouté, aucun push/merge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web app dev publiée sur https://d3n3qjz3si2rme.cloudfront.net avec proxy /api de même origine, sans cache, et infrastructure Terraform permettant le fonctionnement avant achat du domaine. Vérifications locales et distantes réussies, connexion Google puis restauration après rechargement et dans un nouvel onglet confirmées dans Chrome. Détails de livraison et retour arrière : docs/validation/task-605-web-cloudfront/README.md.
<!-- SECTION:FINAL_SUMMARY:END -->
