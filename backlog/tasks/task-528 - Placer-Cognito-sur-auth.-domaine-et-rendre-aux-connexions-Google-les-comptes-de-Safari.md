---
id: TASK-528
title: >-
  Placer Cognito sur auth.<domaine> et rendre aux connexions Google les comptes
  de Safari
status: To Do
assignee: []
created_date: '2026-10-18 15:11'
labels:
  - infrastructure
  - mobile
  - auth
dependencies:
  - TASK-443
references:
  - infrastructure/terraform/modules/platform/cognito.tf
  - infrastructure/terraform/modules/platform/lambda_api.tf
  - mobile/src/services/authService.ts
  - docs/AUTHENTICATION_SETUP.md
  - docs/testflight-feedback-log.md
priority: medium
type: feature
ordinal: 135000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Feedback TestFlight `AA8bmF16TZrm0st12jdmNGM` (build 16) : pendant la connexion Google sur iOS, l’utilisateur voit le domaine technique `deepn-<compte>-dev.auth.eu-west-3.amazoncognito.com`, à deux endroits :
1. l’alerte système « Deepn souhaite utiliser <domaine> », qu’iOS affiche pour une session d’authentification partageant les cookies de Safari ;
2. la page Google « Accéder à l’application <domaine> », où Google affiche l’hôte du retour OAuth tant que la marque n’est pas vérifiée.

Correctif provisoire du 2026-10-18 (commit `6f6735f3`) : `promptAsync(discovery, { preferEphemeralSession: true })` dans `mobile/src/services/authService.ts`. L’alerte disparaît, mais Google ne propose plus les comptes déjà connectés dans Safari. Le domaine Cognito reste visible sur la page Google.

Avec Cognito sur `auth.<domaine>`, les deux écrans affichent le domaine Deepn. La session partagée redevient alors le bon choix, et les comptes Google de Safari réapparaissent. Le nom Deepn à la place du domaine sur la page Google relève de la vérification de marque, dans TASK-451.

## Périmètre

**Infrastructure** (`infrastructure/terraform/modules/platform/cognito.tf`) :
- Certificat ACM pour `auth.<domaine>` en **us-east-1**, exigence de Cognito pour un domaine personnalisé, avec validation DNS. Le module n’a aujourd’hui qu’un provider eu-west-3 : ajouter l’alias nécessaire.
- `aws_cognito_user_pool_domain` avec `domain = auth.<domaine>` et `certificate_arn`, et l’enregistrement DNS alias vers la distribution CloudFront fournie par Cognito. Suivre le motif optionnel `api_custom_domain` / `api_zone_id` de `lambda_api.tf`. La zone DNS est celle retenue par TASK-443/TASK-445.
- `local.cognito_domain`, la sortie `cognito_configuration` et `COGNITO_DOMAIN` passent au domaine personnalisé lorsqu’il est défini. Le domaine préfixe `deepn-<compte>` est **supprimé** dans le même changement pour l’environnement concerné, sans double domaine ni période de transition (règle « Nothing is deployed yet », `CLAUDE.md`).
- Cognito exige que le domaine parent possède un enregistrement A résolvable avant de créer le domaine personnalisé : le documenter comme prérequis.

**Mobile** (`mobile/src/services/authService.ts`) :
- Retirer `preferEphemeralSession: true` pour revenir à la session partagée avec Safari.
- La session partagée garde un cookie Cognito : après une déconnexion, appuyer sur Google reconnecterait le compte précédent sans laisser choisir. La déconnexion mobile doit donc fermer la session navigateur Cognito, par exemple via l’endpoint `/logout` de Cognito avec le `logout_uri` déjà enregistré pour le client mobile (`media-summarizer://auth-callback`). Sur iOS, cette ouverture déclenche elle aussi l’alerte système : choisir la solution la moins intrusive et la justifier dans les notes d’implémentation, par exemple en vérifiant si Cognito transmet un paramètre de choix de compte à Google.

**Documentation** : `docs/AUTHENTICATION_SETUP.md`, sections infrastructure et parcours Google/Apple. Remplacer le paragraphe sur la session privée, ainsi que le nom du domaine dans « Raccordement dev ».

## Note au propriétaire (hors critères)

Après fusion : appliquer Terraform pour l’environnement visé, puis remplacer le retour `/oauth2/idpresponse` par `https://auth.<domaine>/oauth2/idpresponse` dans le client OAuth Web Google et dans le Services ID Apple (Apple sur web et Android). Apple natif sur iOS n’est pas concerné. Vérifier ensuite sur appareil iOS :
- l’alerte affiche `auth.<domaine>` ;
- la page Google propose les comptes de Safari ;
- après une déconnexion, Google laisse choisir un autre compte.

Le changement mobile se distribue par OTA, sans nouveau module natif.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `cognito.tf` déclare un certificat ACM us-east-1 validé par DNS, un `aws_cognito_user_pool_domain` sur le domaine personnalisé et son enregistrement alias, selon le motif optionnel de `api_custom_domain` ; le domaine préfixe Cognito est supprimé pour l’environnement concerné, sans double domaine.
- [ ] #2 `local.cognito_domain`, la sortie `cognito_configuration` et `COGNITO_DOMAIN` désignent `https://auth.<domaine>` lorsque le domaine personnalisé est défini ; `terraform fmt -check` et `terraform validate` passent pour dev et prod.
- [ ] #3 `authService.ts` n’utilise plus `preferEphemeralSession`, et la déconnexion mobile ferme la session navigateur Cognito par un chemin de code branché ; la solution retenue et son effet sur l’alerte iOS sont justifiés dans les notes d’implémentation.
- [ ] #4 `docs/AUTHENTICATION_SETUP.md` décrit le domaine personnalisé, son certificat us-east-1, le prérequis d’enregistrement A du domaine parent, et les retours Google/Apple à mettre à jour ; le paragraphe sur la session privée est remplacé.
- [ ] #5 Typecheck et lint mobile passent.
<!-- AC:END -->
