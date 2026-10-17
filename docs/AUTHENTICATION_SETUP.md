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

Les variables sensibles `cognito_google` (client Web Google et secret) et
`cognito_apple` (Services ID, team ID, key ID et clé privée) se fournissent aux racines
Terraform par le coffre ou un fichier local ignoré. Ne pas les mettre dans git,
une tâche ou un journal. Les valeurs sont conservées dans le state privé Terraform.
Sans ces entrées, Terraform ne crée pas les fournisseurs concernés : renseigner
**les deux avant la bascule** pour que les boutons conservés fonctionnent.
Le workflow `Terraform Dev` lit les objets JSON depuis les secrets GitHub Actions
`COGNITO_GOOGLE_PROVIDER_JSON` et `COGNITO_APPLE_PROVIDER_JSON` et les transmet
comme `TF_VAR_cognito_google` / `TF_VAR_cognito_apple`. Il refuse l’apply si un des
deux manque, pour ne jamais retirer silencieusement un fournisseur lors d’un apply
ultérieur. Configurer ces deux secrets avant le premier push de la bascule.


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
| `POST /confirm-registration` | `{email, code}` → `{status: confirmed}` ; retour à la connexion |
| `POST /resend-confirmation` | `{email}` → 202 générique |
| `POST /login` | `{email, password}` → session Cognito et profil |
| `GET /oauth/config` | domaine, client et retour publics du transport choisi |
| `POST /oauth/token` | `{code, code_verifier}` → session Cognito et profil ; retour fixé côté API |
| `POST /forgot-password` | `{email}` → 202 `{status: accepted}`, compte absent/social compris |
| `POST /confirm-password` | `{email, code, password}` → `{status: password_changed}` |
| `POST /refresh` | refresh du corps mobile ou du cookie web → paire renouvelée et profil |
| `POST /logout` | même transport de refresh → révocation Cognito et suppression du cookie web |
| `GET /me`, `PATCH /me` | profil et préférences existants, après authentification |

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
éphémère, à usage unique et limitée en tentatives.

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

1. Récupérer les paramètres Google/Apple depuis le coffre, configurer les retours
   fournisseurs et appliquer Terraform avec les variables sensibles. Vérifier
   les deux fournisseurs, les callbacks et les clients dans la console Cognito.
2. Garder dans le coffre la clé Apple utile à la fédération. Retirer du secret
   runtime les anciennes clés JWT/refresh et `GOOGLE_*`, `APPLE_*` d’authentification
   maison, sans toucher les clés IAP, App Store Connect ou RevenueCat.
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
