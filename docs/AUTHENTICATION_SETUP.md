# Authentification Deepn — Amazon Cognito

Architecture livrée par task-526, décision propriétaire du 2026-10-17. Cognito User
Pools gère les mots de passe, la vérification d’adresse, Google, Apple, la
récupération et les sessions. DynamoDB conserve les profils, préférences et données
métier. Les identifiants applicatifs utilisés par la bibliothèque et RevenueCat ne
changent pas pour une fixture rattachée explicitement.

## Infrastructure et configuration

`infrastructure/terraform/modules/platform/cognito.tf` définit un pool par
environnement, un domaine Cognito AWS et deux clients publics sans secret : mobile
et web. Le client web existe lorsque `web_app_origin` est renseigné. Chaque client
n’accepte que son retour exact : `media-summarizer://auth-callback` pour le mobile,
`<web_app_origin>/auth/callback` pour le web. Aucune wildcard ni grant implicite.
Le module est appelé par dev, staging et prod ; staging reste une référence
volontairement conservée, pas un environnement à recréer pour cette tâche.

Les six paramètres existent déjà dans le secret AWS
`media-summarizer-runtime-<env>` : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` et `APPLE_PRIVATE_KEY`.
`scripts/terraform_with_cognito.py` lit cette source avec le profil AWS courant et
transmet uniquement ces valeurs en mémoire aux variables sensibles Terraform
`cognito_google` et `cognito_apple`. Le secret complet, les autres credentials et
les valeurs de fédération ne sont ni imprimés ni écrits dans un fichier local.
Les détails des fournisseurs Cognito restent dans le state Terraform privé.

Le workflow `Terraform Dev` utilise ce même script après son authentification AWS
OIDC existante ; aucun secret GitHub supplémentaire n’est nécessaire. L’exécution
s’arrête si une valeur manque. Les racines dev/prod exigent les deux objets : un
plan direct sans raccordement ne peut pas retirer silencieusement un fournisseur.
Pour un plan local :

```sh
AWS_PROFILE=second-brain-app python3 scripts/terraform_with_cognito.py dev plan -out=tfplan
AWS_PROFILE=second-brain-app python3 scripts/terraform_with_cognito.py dev apply tfplan
```

Pour prod, employer le profil `prod` et l’argument `prod` uniquement lors d’une
activation explicite de cet environnement. Le wrapper impose des fichiers privés
(umask 077) et désactive le debug Terraform pour que les providers ne puissent pas
journaliser les clés. Le plan sauvegardé
contient des données sensibles : garder le fichier ignoré, privé, et le supprimer
après application. Ne pas retirer les six paramètres du coffre après bascule : ils
constituent désormais la source permanente de configuration des fournisseurs.

Dans Google Cloud, autoriser comme URI de redirection la sortie Terraform
`cognito_configuration.provider_callback`. Dans Apple Developer, configurer le
Services ID, le domaine Cognito et cette même URL `/oauth2/idpresponse`, et associer
le Services ID à l’App ID existant. Les anciens clients natifs Google et le SDK
Apple embarqué ne participent plus au flux ; aucun mot de passe n’est demandé aux
comptes exclusivement sociaux. La clé de fédération Apple doit rester récupérable
dans le coffre même après retrait des anciennes variables du secret runtime.

Terraform injecte directement `COGNITO_USER_POOL_ID`, `COGNITO_MOBILE_CLIENT_ID`,
`COGNITO_WEB_CLIENT_ID`, `COGNITO_DOMAIN`, `COGNITO_MOBILE_CALLBACK` et
`COGNITO_WEB_CALLBACK` dans les runtimes. Les apps découvrent la configuration
publique avec `GET /api/auth/oauth/config` ; le web ajoute
`X-Session-Transport: cookie`. Il n’y a aucune clé de signature applicative.
Les seuls droits administratifs de l’API sont `AdminGetUser` et `AdminDeleteUser`,
limités au pool de son environnement. Le stream utilise les opérations Cognito
autorisées par l’access token, pas des droits d’administration.

## E-mails Cognito par défaut

La configuration est `COGNITO_DEFAULT`, sans `from_email_address`, `source_arn`,
identité SES ni domaine d’expédition Deepn. L’expéditeur est l’adresse AWS standard.
Le quota vérifié dans la documentation AWS le **2026-10-17** est **50 e-mails par
jour et par compte AWS**, non augmentable dans ce mode, remis à zéro à **09:00 UTC**.
Inscriptions, renvois de confirmation et récupérations consomment ce même budget ;
ce n’est ni un quota par utilisateur ni 50 réinitialisations supplémentaires.
Un rebond peut aussi être supprimé par la liste AWS dont Deepn n’a pas la maîtrise.
La réponse générique à une récupération ne garantit donc pas la réception d’un
message. Une configuration SES propre serait une décision ultérieure distincte.
Sources : [quota AWS](https://docs.aws.amazon.com/cognito/latest/developerguide/quotas.html),
[configuration e-mail](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html).

## Contrats API et parcours

Toutes les routes ci-dessous restent sous `/api/auth`, avec les routes historiques
montées également sous `/api/v1/auth` par le routeur existant. Aucun nouvel endpoint
média ou artefact n’est ajouté sous `/api/v1/`.

| Route | Entrée et réponse |
|---|---|
| `POST /register` | `{email, password}` → 202 `{status: verification_required}` ; aucune session avant confirmation |
| `POST /confirm-registration` | `{email, code}` → `{status: confirmed}` ; le formulaire ouvre ensuite automatiquement la session par `/login` |
| `POST /resend-confirmation` | `{email}` → 202 générique |
| `POST /login` | `{email, password}` → session Cognito et profil |
| `GET /oauth/config` | domaine, client et retour publics du transport choisi |
| `POST /oauth/token` | `{code, code_verifier}` → session Cognito et profil ; retour fixé côté API |
| `POST /forgot-password` | `{email}` → 202 `{status: accepted}`, compte absent/social compris |
| `POST /confirm-password` | `{email, code, password}` → `{status: password_changed}` |
| `POST /refresh` | refresh du corps mobile ou du cookie web → paire renouvelée et profil |
| `POST /logout` | même transport de refresh → révocation Cognito et suppression du cookie web |
| `GET /me`, `PATCH /me` | profil et préférences existants, après authentification |

Après inscription, le formulaire web/mobile reste monté pendant la saisie du code.
Les justificatifs restent uniquement dans son état React, sans passage dans les
paramètres de navigation, l’historique, un stockage ou un cache global. Une fois
le code confirmé, le formulaire appelle `/login` automatiquement puis rejoint la
destination demandée sur web ou `POST_AUTH_ENTRY_POINT` sur mobile : les gates
existants choisissent l’onboarding de langue ou l’app. Il n’y a aucun écran de
succès de vérification à valider. Quitter le parcours libère les justificatifs ;
sur mobile, ils sont également effacés lorsque l’écran perd le focus.

Si l’ouverture de session échoue après confirmation, le formulaire permet de
réessayer la connexion sur place sans rejouer le code déjà consommé. Une reprise
directe de la page de vérification sans formulaire d’origine demande le mot de
passe avec le code. La récupération de mot de passe reste un parcours distinct.

Un mot de passe comprend au moins 12 caractères, une majuscule, une minuscule et
un chiffre. Le serveur délègue la validation à Cognito. Les erreurs sont des codes
(`AUTH_CODE_INVALID`, `AUTH_CODE_EXPIRED`, `AUTH_PASSWORD_POLICY`,
`AUTH_RATE_LIMITED`, `AUTH_RESET_REQUIRED`, `AUTH_UNAVAILABLE`,
`EMAIL_NOT_VERIFIED`, `INVALID_CREDENTIALS`), traduits dans les onze langues des apps.
Aucune prose fournisseur n’est affichée. Les écrans proposent renvoi, état de
chargement, résultat, erreurs et retour à la connexion.

La récupération contrôle le statut Cognito : seuls les comptes locaux confirmés
ou à réinitialiser peuvent recevoir ce parcours. Un compte absent ou
`EXTERNAL_PROVIDER` reçoit le même accusé de réception, et un code ne peut jamais
y créer de mot de passe. Les erreurs de livraison sont aussi masquées sur cette
route pour ne pas révéler l’existence d’un compte. Les erreurs réseau et de service
restent présentées sans identité de compte. Cognito masque les utilisateurs
inconnus sur les clients (`prevent_user_existence_errors = ENABLED`).

Google et Apple restent accessibles depuis l’inscription et la connexion. Les
boutons lancent `/oauth2/authorize` avec le fournisseur explicite, un état aléatoire
et PKCE S256. Le navigateur mobile est géré par `expo-auth-session`, qui vérifie
l’état et conserve le vérificateur pendant la demande. Sur le web, état,
vérificateur et date vivent uniquement dans `sessionStorage` pendant au plus dix
minutes ; le retour les consomme une seule fois, vérifie l’état, efface l’URL puis
échange le code. Aucun jeton de session ne va dans le stockage du navigateur.
Les tokens ID Google/Apple natifs et les anciens callbacks maison sont supprimés.
Source : [PKCE Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html).

## Sessions, autorisation et révocation

L’API vérifie la signature RS256 avec le JWKS du pool, l’émetteur exact,
l’expiration, `sub`, `iat`, `token_use: access` et un `client_id` autorisé. Un ID
token ou un JWT signé par l’ancienne clé est refusé. Elle appelle ensuite `GetUser`
pour vérifier la révocation et obtenir les attributs depuis Cognito. Seul un
e-mail vérifié permet de créer/résoudre un profil. Le JWKS est mis en cache ; une
indisponibilité de récupération des clés répond 503 plutôt que de détruire une
session mobile. Chaque requête authentifiée implique une lecture Cognito et une
lecture DynamoDB : prendre en compte les quotas `UserRead`, notamment les limites
par utilisateur, lors de l’observation de la bêta.

Le mobile conserve les tokens dans `expo-secure-store`. Le web garde l’access token
en mémoire et le refresh dans `__Secure-refresh_token`, cookie host-only sur l’API,
`Secure; HttpOnly; SameSite=Strict; Path=/api/auth`, avec sept jours d’inactivité.
Les requêtes de session web utilisent l’en-tête personnalisé et le CORS à origine
explicite ; le corps ne contient jamais le refresh web. La configuration locale
`localhost` + `execute-api` reste de sites différents : pas de restauration durable
par cookie avant les domaines app/API sur le même site.

Les access tokens durent quinze minutes. Les refresh tokens tournent avec
`GetTokensFromRefreshToken`, grâce Cognito de 60 secondes. Leur limite absolue est
**365 jours sur mobile, 30 jours sur le web**, depuis l’ouverture initiale ; la
rotation ne prolonge pas cette limite. Cela remplace volontairement l’ancienne
fenêtre mobile glissante maison. Aucun registre de sessions utilisateurs n’est
conservé dans `auth_tokens`. La concurrence est regroupée par les gestionnaires de
session clients existants.

`RevokeToken` ferme le refresh présenté sans déconnecter les autres appareils.
Une signature JWT seule ne détecterait pas cette révocation : le `GetUser` effectué
par l’API et le stream est nécessaire. La déconnexion ne supprime pas la session
Google/Apple du navigateur externe ni tous les autres refresh du compte. Hors
ligne, les apps effacent leur stockage local ; une révocation distante ne peut pas
être garantie sans réception par Cognito. Source :
[révocation Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/token-revocation.html).

## Profils, fixtures et suppression du compte

Un nouveau profil utilise `id = sub` du pool. Aucun lookup par e-mail ne rattache
une connexion à une ancienne bibliothèque : Google, Apple et un compte local ayant
la même adresse restent des identités distinctes tant qu’un administrateur ne les
a pas liés explicitement dans Cognito. Un e-mail fournisseur non vérifié n’est
jamais une preuve de propriété. Les apps ne peuvent pas écrire l’attribut
`custom:app_user_id`.

Pour conserver une fixture protégée, dont l’article **Commonplace book**, le
propriétaire relève en privé le profil applicatif qui la possède, crée/confirme sa
nouvelle identité Cognito puis lui affecte `custom:app_user_id = <id du profil>`
avec `AdminUpdateUserAttributes`, avant sa première connexion applicative. Ce
choix administratif est la preuve du rattachement ; il ne faut ni import de hash,
ni synchronisation de mots de passe, ni purge de bibliothèque. Le premier login
lie atomiquement le profil à ce `sub` si aucun autre ne le possède, en supprimant
les anciens champs de justificatifs. Ne pas consigner les identités réelles dans
un fichier public. Les produits Test Store protégés restent en place.

La suppression de compte conserve l’ordre existant : données découvrables et
contenus privés, tables applicatives, autorisations d’extension, identité Cognito
(`AdminDeleteUser`), profil. Le contenu partagé reste régi par la purge existante.
Si une étape de données échoue, l’identité survit pour permettre de réessayer.
Si l’effacement de la dernière ligne DynamoDB échoue après suppression Cognito,
il ne reste qu’un profil orphelin à supprimer administrativement ; aucun contenu
applicatif ne reste à effacer par l’utilisateur. Les anciens tokens Cognito ne
peuvent pas recréer le compte puisque `GetUser` refuse l’identité supprimée.

## Extension navigateur

L’appairage et son code de secours restent les routes existantes
`/api/auth/extension-tokens`. Ils exigent une session Cognito complète ; un token
d’extension ne peut pas en émettre d’autres. La réclamation d’un code reste
éphémère, consommée atomiquement une seule fois et limitée en tentatives. Si
plusieurs profils partagent une adresse, le code désigne son profil sans les
fusionner ; une erreur compte contre les codes vivants de cette adresse. Deux
codes identiques simultanés sont refusés plutôt que de choisir un profil arbitraire.

L’extension reçoit un secret opaque `ext_r_…`, stocké haché dans `auth_tokens`.
Son refresh rend un access token opaque `ext_a_…`, haché également et valable cinq
minutes. Le secret de renouvellement est stable, renouvelé jusqu’à 90 jours
d’inactivité, plafonné à un an après appairage. Il ne devient jamais une session
Cognito. Chaque accès relit le grant parent de façon cohérente pour appliquer
immédiatement sa révocation. Les seules routes autorisées restent :
`POST /api/media/ingest-url`, `POST /api/media/ingest-shared-content`,
`GET /api/folders`, `POST /api/auth/logout`. Toute autre route est interdite.
La déconnexion web ne délie pas l’extension. Supprimer le compte révoque les deux.

## Bascule et validation propriétaire après fusion

1. Utiliser le wrapper Terraform qui reprend les paramètres Google/Apple depuis
   le coffre existant, configurer les retours fournisseurs et appliquer le plan. Vérifier
   les deux fournisseurs, les callbacks et les clients dans la console Cognito.
2. Conserver les six paramètres Google/Apple lus par le wrapper. Retirer seulement
   les anciennes clés JWT/refresh et les autres paramètres d’authentification sans
   lecteur, sans toucher les clés IAP, App Store Connect ou RevenueCat.
3. Créer les nouvelles identités nécessaires et rattacher explicitement les
   fixtures protégées. Aucun import d’ancien mot de passe et aucune purge globale.
   Les anciennes lignes `auth_tokens` peuvent être supprimées : elles ne portent
   aucune bibliothèque ; les extensions se réappairent.
4. Déployer l’image API et celle du stream, publier le web et reconstruire les
   binaires mobiles (suppression des modules natifs de login). Commande Android de
   référence depuis `mobile/` :
   `eas build --platform android --profile internal --auto-submit --non-interactive`.
   Pour iOS : workflow Mobile Build & Distribute ou le runbook mobile existant.
5. Sur appareil et navigateur, vérifier inscription, réception/renvoi/expiration
   des codes, confirmation, connexion, récupération et refus sur un compte social,
   Google et Apple, retours annulés, restauration après reload/reprise, logout et
   refus de l’ancien access token, appairage/portée/révocation de l’extension,
   suppression du compte et préservation des fixtures et contenus partagés.

Ces opérations après fusion/déploiement sont le contrôle propriétaire. Aucun
apply, déploiement, build EAS ni test automatisé n’est requis pour terminer le
travail de code de cette tâche. Le backend local n’est pas un substitut au dev AWS.

## Raccordement dev du 2026-10-17

Le pool `eu-west-3_kvjrhVwnV` et le domaine
`deepn-125313707865-dev.auth.eu-west-3.amazoncognito.com` ont été créés par le plan
Terraform : 7 créations, 19 mises à jour de configuration, aucune suppression.
Les deux fournisseurs reprennent les identifiants du secret runtime dev, sans
rotation ni création de credentials. Les lectures Cognito ont confirmé les deux
clients, les retours exacts, la rotation, la révocation et l’interdiction d’écrire
l’attribut de rattachement des fixtures depuis les apps.

Le client Google Web existant a été enregistré avec l’origine du domaine Cognito
et son retour `/oauth2/idpresponse`, en remplacement de l’ancien callback API.
Les endpoints d’autorisation Cognito redirigent vers Google et Apple avec le retour
Cognito attendu. Cela vérifie le raccordement, sans créer de compte utilisateur
ni prétendre qu’une connexion de bout en bout a été exécutée.

Terraform conserve explicitement le mapping `username = sub` ajouté par Cognito
et ignore uniquement les URL/métadonnées de découverte produites par AWS. La clé
privée Apple est en écriture seule : AWS ne la renvoie pas à la lecture. Avec le
provider actuel, un plan ultérieur propose donc sa réapplication sur le fournisseur
Apple, même sans rotation ; ne pas ignorer ce champ, sinon changer la clé dans le
coffre ne la mettrait plus à jour dans Cognito. Le problème des métadonnées calculées
est documenté dans [l’issue du provider AWS](https://github.com/hashicorp/terraform-provider-aws/issues/4831).

Le retour dans Apple Developer attend encore la connexion du propriétaire à la
console. Aucun changement n’a été appliqué à prod. Les images applicatives, le web
et les binaires mobiles n’ont pas été déployés pendant ce raccordement.

## Release dev du 2026-10-18

Le frontend web local utilisait le nouveau contrat alors que l’API AWS exécutait
encore l’ancien code : `/api/auth/oauth/config` répondait 404, ce qui rendait les
parcours incompatibles. Après autorisation du propriétaire, les commits ont été
poussés sur `main` et le [workflow de déploiement dev](https://github.com/MedlockM2/second-brain-app/actions/runs/39088195368)
a reconstruit et déployé l’API, le chat stream et les workers avec succès.
Le [workflow Terraform dev](https://github.com/MedlockM2/second-brain-app/actions/runs/39088195365)
a également terminé avec succès en réutilisant les paramètres AWS existants.

Contrôles sur l’API publiée : santé 200, configuration OAuth 200 pour les deux
transports avec leurs clients/retours distincts et `Cache-Control: no-store`, CORS
autorisé pour `http://localhost:5173`. Le contrat OpenAPI publié expose
l’inscription 202, la confirmation, le renvoi de code et la récupération de mot
de passe. Ces lectures ne créent aucun compte et ne valident pas le parcours
utilisateur complet ; l’inscription et le code reçu restent à effectuer par le
propriétaire depuis son navigateur.

Le workflow mobile a démarré de nouveaux builds internes Android et iOS avec
soumission automatique : les empreintes natives ont changé. La configuration du
retour dans Apple Developer attend toujours la connexion du propriétaire. Prod
reste inchangé.
