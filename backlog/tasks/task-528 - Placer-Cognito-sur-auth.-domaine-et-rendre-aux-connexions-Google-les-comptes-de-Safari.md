---
id: TASK-528
title: >-
  Placer Cognito sur auth.<domaine> et permettre le changement de compte Google
  iOS et Apple Android
status: In Progress
assignee: []
created_date: '2026-10-18 15:11'
updated_date: '2026-11-09 13:20'
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
  - 'https://developers.google.com/identity/openid-connect/openid-connect'
  - >-
    https://developer.apple.com/documentation/signinwithapplerestapi/request-an-authorization-to-the-sign-in-with-apple-server.
  - >-
    https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
priority: medium
type: feature
ordinal: 135000
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
- `aws_cognito_user_pool_domain` avec `domain = auth.<domaine>` et `certificate_arn`, et l’enregistrement DNS alias vers la distribution CloudFront fournie par Cognito. Suivre le motif optionnel `api_custom_domain` / `api_zone_id` de `lambda_api.tf`. Découpage retenu par TASK-443 (2026-11-09) : `auth.dev.deepn.app` dans la zone `dev.deepn.app` du compte dev, `auth.deepn.app` dans la zone `deepn.app` du compte prod ; chaque environnement dérive ce nom du domaine de base et de la zone configurés par TASK-445. Prérequis Cognito sur l’enregistrement A du domaine parent : pour dev, le parent est `dev.deepn.app` (apex de la zone dev), qui doit donc porter un enregistrement A résolvable ; pour prod, c’est `deepn.app`.
- `local.cognito_domain`, la sortie `cognito_configuration` et `COGNITO_DOMAIN` passent au domaine personnalisé lorsqu’il est défini. Le domaine préfixe `deepn-<compte>` est **supprimé** dans le même changement pour l’environnement concerné, sans double domaine ni période de transition (règle « Nothing is deployed yet », `CLAUDE.md`).
- Cognito exige que le domaine parent possède un enregistrement A résolvable avant de créer le domaine personnalisé : le documenter comme prérequis.

**Mobile** (`mobile/src/services/authService.ts`) :
- Pour Google sur iOS, retirer `preferEphemeralSession: true` pour revenir à la session partagée avec Safari.
- La session partagée garde un cookie Cognito : après une déconnexion, appuyer sur Google reconnecterait le compte précédent sans laisser choisir. La déconnexion mobile doit donc fermer la session navigateur Cognito, par exemple via l’endpoint `/logout` de Cognito avec le `logout_uri` déjà enregistré pour le client mobile (`media-summarizer://auth-callback`). Sur iOS, cette ouverture déclenche elle aussi l’alerte système : choisir la solution la moins intrusive et la justifier dans les notes d’implémentation, par exemple en vérifiant si Cognito transmet un paramètre de choix de compte à Google.

**Documentation** : `docs/AUTHENTICATION_SETUP.md`, sections infrastructure et parcours Google/Apple. Remplacer le paragraphe sur la session privée, ainsi que le nom du domaine dans « Raccordement dev ».

## Clarification propriétaire — 2026-10-26

Le besoin commun à **Google sur iOS et Apple sur Android** est de pouvoir utiliser un autre compte fournisseur après une déconnexion Deepn, depuis le bouton de connexion existant, sans être reconnecté silencieusement au compte Deepn précédent. Aucun bouton Deepn « Utiliser un autre compte » supplémentaire n’est demandé.

**Google sur iOS :** conserver les sessions Google présentes dans Safari pour proposer les comptes déjà connectés et permettre leur sélection sans ressaisie systématique de l’adresse et du mot de passe. Le mode éphémère actuel est provisoire et doit être retiré pour ce parcours après passage au domaine personnalisé. Google documente `prompt=select_account` ; vérifier son acheminement et sa prise en charge avec la version de login Cognito réellement configurée.

**Apple sur Android — précision propriétaire finale :** une liste de comptes mémorisés semblable à celle de Google est souhaitable mais n’est pas exigée si Apple ne propose pas d’équivalent. Un parcours permettant de saisir à nouveau l’adresse et le mot de passe d’un autre compte Apple satisfait le besoin. Cette saisie reste dans le parcours officiel Apple du navigateur, jamais dans un formulaire de collecte de justificatifs Apple par Deepn. La conservation de la session Apple du navigateur n’est donc pas une contrainte si elle empêche ce changement ; un nouveau contexte d’authentification peut être étudié pour ce parcours. Ne pas appliquer à Apple l’interdiction de session privée propre à la cible Google iOS. Les authentifications supplémentaires éventuellement exigées par Apple restent sous son contrôle.

**Faisabilité à établir pour Apple.** Son endpoint d’autorisation ne documente pas de paramètre équivalent à `prompt=select_account` : ne pas promettre qu’envoyer ce paramètre suffit. Retenir un mécanisme pris en charge permettant de choisir ou saisir un autre compte depuis le bouton Apple existant, sans demander d’effacer les données de Chrome ni de se déconnecter manuellement d’Apple dans les réglages du navigateur. Documenter les limites réellement établies et signaler tout écart à ce besoin avant de substituer un autre comportement.

La fermeture de la session navigateur Cognito à la déconnexion fait partie du travail, mais elle ne ferme pas la session Apple/Google et ne prouve donc pas à elle seule que le changement de compte est possible. Le domaine personnalisé rendra acceptable l’alerte de session partagée sur iOS ; il ne commande pas la sélection du compte et ne constitue pas un prérequis technique au parcours Apple Android. La vérification utilisateur finale, après livraison, couvrira deux comptes distincts sur chaque parcours ; ce contrôle sur appareil n’est pas un critère bloquant de l’agent en worktree.

## Note au propriétaire (hors critères)

Après fusion : appliquer Terraform pour l’environnement visé, puis remplacer le retour `/oauth2/idpresponse` par `https://auth.<domaine>/oauth2/idpresponse` dans le client OAuth Web Google et dans le Services ID Apple (Apple sur web et Android). Apple natif sur iOS n’est pas concerné. Vérifier ensuite sur appareil iOS :
- l’alerte affiche `auth.<domaine>` ;
- la page Google propose les comptes de Safari ;
- après une déconnexion, Google laisse choisir un autre compte.

Le changement Google iOS décrit ici se distribue par OTA, sans nouveau module natif. Pour Apple Android, préciser le mode de livraison selon le mécanisme retenu ; ne pas promettre une OTA si une modification native est nécessaire.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `cognito.tf` déclare un certificat ACM us-east-1 validé par DNS, un `aws_cognito_user_pool_domain` sur le domaine personnalisé et son enregistrement alias, selon le motif optionnel de `api_custom_domain` ; le domaine préfixe Cognito est supprimé pour l’environnement concerné, sans double domaine.
- [x] #2 `local.cognito_domain`, la sortie `cognito_configuration` et `COGNITO_DOMAIN` désignent `https://auth.<domaine>` lorsque le domaine personnalisé est défini ; `terraform fmt -check` et `terraform validate` passent pour dev et prod.
- [x] #3 Le parcours Google iOS n’utilise plus preferEphemeralSession ; la déconnexion mobile ferme la session navigateur Cognito par un chemin branché. La solution et son effet sur l’alerte iOS sont justifiés. Cette contrainte de session partagée ne s’impose pas au parcours Apple Android.
- [x] #4 `docs/AUTHENTICATION_SETUP.md` décrit le domaine personnalisé, son certificat us-east-1, le prérequis d’enregistrement A du domaine parent, et les retours Google/Apple à mettre à jour ; le paragraphe sur la session privée est remplacé.
- [x] #5 Typecheck et lint mobile passent.
- [x] #6 Google sur iOS conserve les sessions Google de Safari et utilise un mécanisme documenté de sélection du compte. Les boutons Google et Apple existants sont conservés, sans bouton Deepn supplémentaire pour changer de compte.
- [ ] #7 Le parcours Apple Android permet de choisir ou saisir les identifiants d’un autre compte sur les pages officielles Apple après déconnexion Deepn, sans effacement manuel des données de Chrome. Une liste de comptes mémorisés et la conservation de la session Apple ne sont pas exigées.
- [x] #8 Le runbook décrit le mécanisme retenu et son raccordement Cognito pour chaque fournisseur, ainsi que les contraintes navigateur et les limites établies. Aucun paramètre Apple non documenté ni la seule fermeture Cognito n’est présenté comme une garantie de changement de compte.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Clarification propriétaire du 2026-10-26 consignée : conserver les comptes du navigateur et permettre le choix du compte via le bouton fournisseur existant, pour Google iOS comme Apple Android. Les recommandations précédentes de session privée systématique et de bouton supplémentaire sont écartées. Google documente select_account ; le contrat Apple consulté ne liste aucun équivalent. Ne pas confondre fermeture Cognito, fermeture fournisseur et sélection de compte. La tâche reste To Do avec sa dépendance domaine pour la partie Google iOS ; aucun changement applicatif ni réglage fournisseur effectué dans cette clarification.

Précision propriétaire finale : Apple Android peut redemander une adresse et un mot de passe Apple si aucun sélecteur équivalent à Google n’existe. L’exigence obligatoire est de pouvoir changer de compte depuis le bouton Apple existant. Les contraintes précédentes de conservation absolue des sessions Apple et d’interdiction d’un contexte privé sont remplacées par cette précision ; elles restent pertinentes pour Google iOS, qui doit proposer les comptes de Safari. Description, titre et critères alignés. Aucun changement applicatif ni réglage fournisseur effectué dans cette mise à jour.

**2026-11-09 — implémenté dans la session principale (Claude), avec TASK-445.**

**Infrastructure** (`modules/platform/cognito.tf`).
- Deux ressources remplacent l’ancienne : `prefix`, pour un environnement sans domaine (staging), et `custom`, pour `auth.<domaine>`. Un bloc `moved` reprend l’ancienne adresse. Avec une seule ressource renommée en place, sa destruction formait un cycle de dépendances avec le certificat, CloudFront et les Lambdas.
- Le certificat est celui de l’environnement, en us-east-1, avec le SAN `auth.`. L’alias A/AAAA pointe vers la distribution de Cognito. Le domaine personnalisé dépend de l’enregistrement apex (`aws_route53_record.apex`), parent exigé par Cognito.
- `local.cognito_domain`, la sortie `cognito_configuration` et `COGNITO_DOMAIN` valent `https://auth.<domaine>`. Plan dev : création de `auth.dev.deepn.app`, destruction du domaine préfixe.

**Managed login (version 2).** C’est la seule version de Cognito qui transmet `prompt` à Google (doc AWS de l’endpoint authorize : « Available in the managed login branding version only, not in the classic hosted UI »). Le domaine dev était en version 1, et le pool est en ESSENTIALS. Chaque client créé par API a besoin d’un style de managed login, ce que le provider AWS v5 ne sait pas faire (`aws_cognito_managed_login_branding` n’existe qu’en v6) : commande CLI propriétaire dans le runbook.

**Google iOS.** `preferEphemeralSession` est retiré : la session est partagée avec Safari. `prompt=select_account` est envoyé via `providerAuthorizeParams` (`packages/core`), dont le web profite aussi.

**Déconnexion mobile.**
- Après une session ouverte par la page Cognito (drapeau `hosted_ui_session` dans le trousseau), `logout()` ouvre `/logout` de Cognito avec le retour mobile déjà enregistré. L’ouverture ne se fait que dans ce cas, pour éviter l’alerte iOS après un mot de passe, Apple natif ou Google natif.
- Effet sur l’alerte iOS : elle apparaît aussi à la déconnexion, et nomme `auth.<domaine>`.
- Cette déconnexion ferme la session Cognito, pas celle de Google ni d’Apple : c’est `select_account` qui permet de changer de compte Google.

**Apple Android : non établi.** Apple ne documente aucun paramètre de choix de compte (rien ne lui est envoyé). Aucune source n’établit si la page Apple, dans un Custom Tab qui partage la session Apple de Chrome, laisse saisir un autre identifiant après déconnexion Deepn. Expo ne propose pas de contexte privé sur Android. AC #7 reste donc **non coché** : il dépend de la vérification sur appareil. Si Apple réutilise le compte précédent sans choix, c’est un écart à signaler avant toute substitution, comme le demande la clarification du 2026-10-26.

**Vérifications.** Typecheck et lint passent sur `packages/core`, mobile et web ; le seul avertissement, sur `purchaseService.ts`, existait déjà. `terraform fmt -check` et `validate` passent sur dev, prod et staging. Aucun test automatisé, apply ni build.

**Note owner (hors critères).**
- Après l’apply : créer les styles de managed login, puis remplacer les retours Google et Apple par `https://auth.dev.deepn.app/oauth2/idpresponse`.
- Vérifier sur appareil, avec deux comptes par fournisseur : la sélection Google sur iOS, la saisie d’un autre compte Apple sur Android.
- Le changement mobile sort par OTA (aucun module natif), après le push Terraform.
- À vérifier aussi après l’apply : que la connexion Apple native iOS (`CUSTOM_AUTH` via l’API) fonctionne toujours. La doc AWS indique que les pages du managed login ne prennent pas en charge les triggers d’authentification personnalisée ; l’API n’est pas concernée, mais ce n’est pas encore vérifié.
<!-- SECTION:NOTES:END -->
