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
le Services ID à l’App ID existant. Le client OAuth Android identifie le package et le certificat de signature pour
Credential Manager ; le client Web Cognito reste l’audience des preuves Google. Sur iOS, Apple utilise
le SDK natif et son App ID ; le Services ID et le retour Cognito concernent Apple
sur web et Android. Aucun mot de passe n’est demandé aux comptes sociaux. La clé
de fédération Apple doit rester récupérable
dans le coffre même après retrait des anciennes variables du secret runtime.

Terraform injecte directement `COGNITO_USER_POOL_ID`, `COGNITO_MOBILE_CLIENT_ID`,
`COGNITO_WEB_CLIENT_ID`, `COGNITO_DOMAIN`, `COGNITO_MOBILE_CALLBACK` et
`COGNITO_WEB_CALLBACK` dans les runtimes. Les apps découvrent la configuration
publique avec `GET /api/auth/oauth/config` ; le web ajoute
`X-Session-Transport: cookie`. Il n’y a aucune clé de signature applicative.
Les droits administratifs de l’API sont limités au pool de son environnement :
`AdminGetUser`, `AdminDeleteUser`, et, pour provisionner un compte Apple natif,
`AdminCreateUser` / `AdminSetUserPassword`. Le stream utilise les opérations Cognito
autorisées par l’access token, pas des droits d’administration.

## Google natif sur Android (task-540)

Le bouton Google et la liaison Google utilisent le module Expo local
`mobile/modules/google-credential-manager`, déjà choisi et validé dans task-325.
Il ouvre le sélecteur système Android via Credential Manager et
`GetSignInWithGoogleOption`, sans navigateur. iOS conserve Google via la Hosted UI ;
le web utilise également son parcours OAuth. `Web: n/a (sélecteur système Android)`.

Avant la fenêtre, `POST /api/auth/google/native/challenge` reçoit
`{purpose: "sign_in" | "link"}`. Pour une liaison, une session Cognito du compte
cible est obligatoire. La réponse `{client_id, nonce}` porte un nonce aléatoire
valable dix minutes, enregistré dans la table existante `APPLE_AUTH_TABLE` sous
`google-proof#<hash>`. Le module passe le nonce à Google. La réponse native est
soit une preuve, soit une annulation silencieuse, soit l’absence de compte Google,
qui affiche le message traduit existant. Aucune redirection navigateur de secours.

`POST /api/auth/google/native` reçoit `{identity_token, nonce}`. L’API vérifie la
signature RS256 avec les clés Google, l’émetteur, l’audience Web exacte,
l’expiration, le sujet, l’adresse vérifiée et le nonce. Elle consomme atomiquement
le nonce avec sa date et le compte cible (vide pour une connexion) : une preuve de
connexion ne peut pas servir à une liaison, ni inversement. Aucun token Google
n’est conservé ou journalisé. Les sessions passent par le même challenge Cognito
à usage unique qu’Apple (`native_cognito.py`) ; Cognito reste l’unique émetteur.

La correspondance durable `google#<hash du sub>` et les `identities` Cognito
retrouvent le compte par sujet Google exact. Une adresse seule ne permet jamais
la connexion au compte ni sa fusion. Un conflit d’adresse renvoie
`AUTH_ACCOUNT_EXISTS` et ses méthodes, comme la Hosted UI. Après connexion au
compte cible, `POST /api/auth/link/google` vérifie une nouvelle preuve liée à cette
session et applique les règles de liaison existantes, dont le refus de supprimer
un profil ayant déjà une bibliothèque.

Un nouveau profil natif porte `custom:google_subject`, attribut réservé à
l’administration, et son identité Google est liée dans Cognito pour ouvrir le
même compte sur le web et iOS. Un profil Google fédéré existant conserve son
`sub` et sa bibliothèque. Pour permettre `CUSTOM_AUTH`, que Cognito refuse à un
profil `EXTERNAL_PROVIDER`, l’API le marque social seul puis le confirme avec un
mot de passe aléatoire qui ne quitte pas la mémoire. Les méthodes proposées et la
récupération de mot de passe excluent ce mot de passe technique. Les comptes
locaux auxquels Google est lié conservent leur mot de passe choisi.

Configuration : `GOOGLE_NATIVE_CLIENT_ID` vient du même `cognito_google.client_id`
Web que le fournisseur Cognito, injecté par Terraform ; aucun nouveau secret ni
client ID EAS. Le client OAuth Android doit appartenir au même projet Google et
déclarer `com.secondbrainlabs.core` avec le SHA-1 du certificat du binaire installé.
Pour la piste interne, utiliser le certificat **Play App Signing**, distinct de
la clé d’upload EAS (configuration validée historiquement dans task-165).

Livraison après intégration : appliquer Terraform Dev (attribut Cognito, droit
`AdminUpdateUserAttributes`, variable Lambda et trigger), déployer l’API, puis
produire un **nouveau binaire Android** depuis `mobile/` avec
`eas build --platform android --profile internal --auto-submit --non-interactive`.
Une OTA ne peut pas ajouter le module natif. Vérifier ensuite sur téléphone :
sélection de compte, annulation, nouvelle connexion, retour à la même bibliothèque
et liaison après conflit d’adresse. Les contrôles statiques ne remplacent pas
cette vérification utilisateur.

Sources : [Credential Manager et le bouton Google](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation),
[nonce Google](https://developers.google.com/identity/android-credential-manager/android/reference/com/google/android/libraries/identity/googleid/GetSignInWithGoogleOption.Builder),
[statut fédéré et authentification API Cognito](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminSetUserPassword.html).

## Apple natif sur iOS (task-527)

Le bouton système `expo-apple-authentication` ouvre directement la feuille Apple
sur iOS : aucune session de navigateur Cognito n’est lancée. L’annulation ferme
la feuille sans message d’erreur. Google hors Android et Apple sur Android/web conservent leur
parcours navigateur avec PKCE. La disponibilité du bouton iOS est vérifiée via
l’API système, sans repli silencieux vers le navigateur.

Le mobile génère un nonce et un state aléatoires par tentative et contrôle le
state retourné. `/api/auth/apple/native` vérifie la signature RS256 Apple, issuer,
audience exacte `APPLE_NATIVE_CLIENT_ID` (App ID du binaire), expiration, nonce,
sujet et email vérifié. Il échange ensuite le code auprès d’Apple avec les clés
existantes `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` du coffre : le code
est consommé une seule fois. Le token retourné par cet échange est lui aussi
vérifié et doit désigner le même sujet et le même nonce. Aucune preuve Apple ni
clé privée n’est conservée dans la table ou transmise au client après échange.

Cognito reste l’émetteur des access/refresh tokens. Le client mobile autorise
`CUSTOM_AUTH`. L’API crée une autorisation aléatoire de 90 secondes dans la table
`media-summarizer-apple-auth-<env>`, indexée par son SHA-256 et liée au username,
au client mobile et au challenge Cognito. Le trigger vérifie ces quatre conditions
et supprime atomiquement l’autorisation. La TTL nettoie les autorisations abandonnées ;
elle ne remplace pas le contrôle explicite d’expiration. Seul le rôle API peut
créer une autorisation ; le trigger peut uniquement la lire/consommer. Le client
web ne dispose pas de `ALLOW_CUSTOM_AUTH`.

La même table conserve la correspondance durable entre le hash du sujet Apple et
le username Cognito. Un profil Apple fédéré existant est retrouvé par son sujet
et ses `identities`. Un nouveau profil natif porte `custom:apple_subject`, que les
clients publics ne peuvent pas écrire. L’attribut reste mutable côté administrateur
car AWS interdit le rattachement fédéré à un profil ayant un attribut immuable.
Un mot de passe aléatoire inconnu du client confirme uniquement le provisionnement
administrateur ; les endpoints de récupération refusent ces comptes Apple.

Une adresse déjà portée par un compte confirmé, quel qu’il soit, n’est jamais
reprise et ne crée pas de second compte : l’API répond `AUTH_ACCOUNT_EXISTS` avec
les méthodes du compte existant, et l’app propose de lier Apple après connexion
(section « Une adresse, un compte »). Une création concurrente ne peut réutiliser
un profil que si son sujet Apple correspond exactement. Lors d’une première connexion web/Android après la création native,
`PreSignUp_ExternalProvider` rattache le fournisseur au compte déjà identifié par
ce même sujet, jamais par l’adresse e-mail. La suppression du compte retire aussi
sa correspondance de sujet. Le Services ID Apple doit rester associé au même
App ID primaire pour que les deux plateformes reçoivent le même sujet Apple.

Les triggers sont un zip Python standard + boto3 défini par Terraform ; leur rôle
n’a accès ni au coffre ni aux preuves Apple. Le workflow Terraform Dev suit aussi
les changements de `infrastructure/lambda/apple_auth.py`. L’API et la table sont
isolées par environnement ; prod n’est pas activé par ce changement.

**Publication et validation** : appliquer Terraform dev, puis publier l’API et un
nouveau binaire iOS avec `usesAppleSignIn` et le plugin Expo Apple rétablis. Une OTA
ne peut pas ajouter ce module natif au build 15. Les fingerprints des deux
plateformes doivent être recalculés et les builds internes renouvelés si nécessaire.
La validation finale sur appareil doit couvrir première connexion, reconnexion,
annulation, adresse Apple masquée, restauration de session, déconnexion, et passage
au même compte depuis le web. Elle exige l’intervention de l’utilisateur Apple ;
les vérifications statiques ne constituent pas une connexion Apple E2E.

Sources : [SDK Expo Apple](https://docs.expo.dev/versions/v55.0.0/sdk/apple-authentication/),
[validation Apple](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens),
[triggers Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-challenge.html),
[rattachement Cognito](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminLinkProviderForUser.html).

## Une adresse, un compte (task-529, task-530)

Le pool utilise l’e-mail comme username, mais un profil fédéré (`Google_<sub>`,
`SignInWithApple_<sub>`) ne réserve pas son adresse : sans contrôle explicite, une
même personne obtenait un compte, donc une bibliothèque, par méthode de connexion.
La règle est désormais : **une adresse vérifiée appartient à un seul compte**.

- **Titulaires.** `cognito_auth.account_holders` et le trigger listent tous les
  utilisateurs du pool portant l’adresse (`ListUsers`, filtre `email`, insensible à
  la casse, vérifié sur le pool dev le 2026-10-20), profils fédérés compris. Un
  titulaire compte s’il a l’e-mail vérifié et n’est pas `UNCONFIRMED`.
- **Inscriptions non confirmées.** Elles n’ont jamais prouvé l’adresse : une
  connexion sociale, une création Apple native ou une nouvelle inscription les
  supprime au lieu de les reprendre. Sinon, celui qui a inscrit l’adresse d’autrui
  garderait le mot de passe que la victime active en confirmant son code
  (pre-hijacking, Sudhodanan & Paverd, MSRC 2022).
- **Refus.** `PreSignUp_ExternalProvider` (Google hors Android, Apple Android/web), la
  création Apple native de l’API et `PreSignUp_SignUp` refusent une nouvelle
  identité dont l’adresse a déjà un titulaire. Le trigger lève
  `AUTH_ACCOUNT_EXISTS:<méthodes>` ; Cognito le renvoie dans `error_description`
  du retour Hosted UI, que les apps lisent sans jamais afficher le texte brut.
  L’API répond 409 `{error_code: AUTH_ACCOUNT_EXISTS, methods}` avec `password`,
  `apple`, `google`. `SignUp` étant appelable directement sur le client public, la
  règle vit dans le trigger, pas seulement dans l’API. `cognito_auth.profile` refuse
  aussi de créer un profil applicatif pour une identité dont l’adresse a un autre
  titulaire : un profil fédéré resté en attente n’ouvre jamais de bibliothèque.
- **Liaison prouvée.** Jamais sur la seule adresse : AWS réserve
  `AdminLinkProviderForUser` aux attributs de confiance, et lier sur l’e-mail est la
  cause des prises de compte de type nOAuth. La personne se connecte avec une méthode
  existante, puis refait la preuve du fournisseur refusé :
  - Hosted UI : `POST /link/start {provider}` (session Cognito requise, jamais un
    jeton d’extension) ouvre une intention à usage unique de dix minutes, liée au
    username, dans la table `apple-auth` (`link#sha256(username#provider)`). Le
    trigger laisse alors Cognito créer le profil fédéré. `POST /link/complete
    {code, code_verifier}` échange le code, consomme l’intention, supprime ce profil
    fédéré (AWS l’exige pour un fédéré déjà connecté) puis le lie au compte de la
    session par son `sub` fournisseur. Un profil fédéré qui possède déjà une
    bibliothèque n’est jamais supprimé : `AUTH_PROVIDER_IN_USE`.
  - Apple natif : `POST /link/apple` vérifie la preuve Apple comme `/apple/native`,
    lie le sujet et enregistre sa correspondance. `custom:apple_subject` n’est pas
    posé sur un compte à mot de passe, qui reste donc éligible à la récupération.
  - Les connexions suivantes par ce fournisseur ouvrent le compte existant. Une
    destination fédérée est désignée par son fournisseur et son identifiant, une
    destination locale par `Cognito` et son username.
- **Apps.** Mobile et web affichent « Un compte Deepn existe déjà avec cette
  adresse. Connectez-vous avec <méthodes> pour y ajouter <fournisseur>. ». Après la
  connexion par une méthode existante, la liaison s’enchaîne ; l’annuler laisse la
  personne connectée. Sur le web, ce lien en attente (fournisseur et méthodes, aucun
  justificatif) survit aux redirections dans `sessionStorage` pendant dix minutes.
  Le premier retour après une liaison faite par le trigger (sujet Apple connu)
  échoue une fois avec « Already found an entry for username » : les apps
  relancent alors l’autorisation une fois.
- **Formulaires e-mail (décision propriétaire du 2026-10-20).** Sans SES, aucun
  e-mail « compte existant » n’est envoyé ; les formulaires disent les choses :
  `/register` répond 409 `AUTH_ACCOUNT_EXISTS` (« Un compte existe déjà avec cette
  adresse e-mail. », avec « Se connecter » et « Mot de passe oublié ? »
  pré-remplis). `/login`, seulement après un refus du mot de passe, et
  `/forgot-password` ou `/confirm-password` répondent 409 `AUTH_SOCIAL_ONLY`
  quand aucun titulaire n’a choisi de mot de passe (« Ce compte n’a pas de mot de
  passe : connectez-vous avec Apple ou Google. »). Le propriétaire accepte que ces
  formulaires révèlent qu’une adresse est inscrite ; ils ne nomment jamais le
  fournisseur, la personne n’ayant rien prouvé. Aucun mot de passe n’est créé pour
  un compte exclusivement social.

Sources : [Linking federated users](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html),
[AdminLinkProviderForUser](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminLinkProviderForUser.html),
[Pre sign-up](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html),
[re:Post, liaison et consentement](https://repost.aws/questions/QURvkKUJpaQCCanZpnzpF5aA/what-s-the-best-practice-for-external-idp-and-existing-account-linking),
[re:Post, « Already found an entry »](https://www.repost.aws/questions/QUzzrn542nS0yuSWl4JAHlSg/signing-in-with-social-google-facebook-throws-error-already-found-an-entry-for-username),
[nOAuth](https://www.descope.com/blog/post/noauth),
[pre-hijacking](https://thehackernews.com/2022/05/learn-how-hackers-can-hijack-your.html).

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
| `POST /register` | `{email, password}` → 202 `{status: verification_required}` ; 409 `AUTH_ACCOUNT_EXISTS` si l’adresse a déjà un compte ; une inscription non confirmée est remplacée ; aucune session avant confirmation |
| `POST /confirm-registration` | `{email, code}` → `{status: confirmed}` ; le formulaire ouvre ensuite automatiquement la session par `/login` |
| `POST /resend-confirmation` | `{email}` → 202 générique |
| `POST /login` | `{email, password}` → session Cognito et profil ; 409 `AUTH_SOCIAL_ONLY` après refus si le compte n’a pas de mot de passe |
| `GET /oauth/config` | domaine, client et retour publics du transport choisi |
| `POST /google/native/challenge` | `{purpose}` → `{client_id, nonce}` ; session cible obligatoire pour `link` |
| `POST /google/native` | `{identity_token, nonce}` natifs Android → session Cognito mobile et profil |
| `POST /link/google` | session Cognito mobile, preuve Google native liée au compte → `{status: linked}` |
| `POST /apple/native` | `{identity_token, authorization_code, nonce}` natifs iOS → session Cognito mobile et profil |
| `POST /oauth/token` | `{code, code_verifier}` → session Cognito et profil ; retour fixé côté API ; 409 `AUTH_ACCOUNT_EXISTS` + `methods` si l’adresse appartient à un autre compte |
| `POST /link/start` | session Cognito, `{provider}` → 202 ; intention de liaison de dix minutes |
| `POST /link/complete` | session Cognito, `{code, code_verifier}` du fournisseur → `{status: linked}` |
| `POST /link/apple` | session Cognito mobile, preuve Apple native → `{status: linked}` |
| `POST /forgot-password` | `{email}` → 202 `{status: accepted}` pour un compte à mot de passe ou une adresse inconnue ; 409 `AUTH_SOCIAL_ONLY` pour un compte exclusivement social |
| `POST /confirm-password` | `{email, code, password}` → `{status: password_changed}` ; le formulaire ouvre ensuite automatiquement la session par `/login` |
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
passe avec le code. Après une réinitialisation, le nouveau mot de passe ouvre lui
aussi automatiquement la session, sans écran de succès supplémentaire.

Les champs mot de passe de connexion, inscription et récupération ont un bouton
afficher/masquer accessible, masqué par défaut. Les labels sont au-dessus de la
saisie et les règles sous le champ ; aucun texte d’aide ne partage la ligne de
l’input. La récupération demande d’abord l’e-mail, puis uniquement le code et le
nouveau mot de passe, avec l’adresse en contexte et une action pour la modifier.
Les consignes et les règles sont courtes et propres à chaque étape.

Un mot de passe comprend au moins 12 caractères, une majuscule, une minuscule et
un chiffre. Le serveur délègue la validation à Cognito. Les erreurs sont des codes
(`AUTH_CODE_INVALID`, `AUTH_CODE_EXPIRED`, `AUTH_PASSWORD_POLICY`,
`AUTH_RATE_LIMITED`, `AUTH_RESET_REQUIRED`, `AUTH_UNAVAILABLE`,
`AUTH_ACCOUNT_EXISTS`, `AUTH_SOCIAL_ONLY`, `AUTH_LINK_EXPIRED`,
`AUTH_PROVIDER_IN_USE`, `EMAIL_NOT_VERIFIED`, `INVALID_CREDENTIALS`), traduits dans
les onze langues des apps.
Aucune prose fournisseur n’est affichée. Les écrans proposent renvoi, état de
chargement, résultat, erreurs et retour à la connexion.

La récupération contrôle le statut Cognito : seuls les comptes dont un mot de passe
a été choisi (locaux confirmés ou à réinitialiser, sans `custom:apple_subject` ni `custom:google_subject`)
peuvent recevoir ce parcours, y compris s’ils sont liés à Google ou Apple. Un
compte exclusivement social reçoit `AUTH_SOCIAL_ONLY` (décision du 2026-10-20), et
un code ne peut jamais y créer de mot de passe. Une adresse inconnue reçoit
l’accusé de réception générique, et les erreurs de livraison restent masquées.
Cognito masque les utilisateurs inconnus sur les clients
(`prevent_user_existence_errors = ENABLED`) ; l’API ne révèle un compte qu’aux
endroits décrits dans « Une adresse, un compte ».

Google et Apple restent accessibles depuis l’inscription et la connexion. Les
boutons utilisant le navigateur lancent `/oauth2/authorize` avec le fournisseur explicite, un état aléatoire
et PKCE S256. Le navigateur mobile est géré par `expo-auth-session`, qui vérifie
l’état et conserve le vérificateur pendant la demande. Sur iOS, la session est
privée (`preferEphemeralSession`) : sans partage de cookies avec Safari, iOS
n’affiche plus l’alerte « Deepn souhaite utiliser <domaine Cognito> », et aucun
cookie Cognito ne rouvre le dernier compte après déconnexion. En contrepartie, la
page Google ne reprend pas les comptes déjà connectés dans Safari. La page Google
affiche encore le domaine Cognito (« Accéder à l’application … ») : Google montre
l’hôte du retour OAuth. Le remplacer exige un domaine Cognito personnalisé (domaine
Deepn, certificat ACM us-east-1) et la vérification de marque de l’écran de
consentement Google. Sur le web, état,
vérificateur et date vivent uniquement dans `sessionStorage` pendant au plus dix
minutes ; le retour les consomme une seule fois, vérifie l’état, efface l’URL puis
échange le code. Aucun jeton de session ne va dans le stockage du navigateur.
Les anciens callbacks maison sont supprimés. Les preuves natives Google Android et
Apple iOS ne sont jamais utilisées comme tokens de session : seule leur validation
par l’API autorise la création d’une session Cognito.
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
une connexion à une ancienne bibliothèque. Une adresse n’ouvre qu’un compte : une
autre méthode de connexion s’y ajoute seulement par la liaison prouvée décrite
dans « Une adresse, un compte », et le provisionnement refuse une identité dont
l’adresse a déjà un titulaire. Un e-mail fournisseur non vérifié n’est jamais une
preuve de propriété. Les apps ne peuvent pas écrire l’attribut
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
(`AdminDeleteUser`, qui emporte les identités Google/Apple liées, après les
correspondances de sujet Apple du compte), profil. Le contenu partagé reste régi par la purge existante.
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

À cette date, le retour dans Apple Developer attendait la connexion du propriétaire
à la console. Ce raccordement a été terminé le 2026-10-26 (section suivante).
Aucun changement n’a été appliqué à prod. Les images applicatives, le web
et les binaires mobiles n’ont pas été déployés pendant ce raccordement.

### Apple Android/web : `Invalid web redirect url` (2026-10-26)

Le refus `invalid_request / Invalid web redirect url` a été reproduit avec les
configurations publiques mobile et web du dev AWS : Cognito redirigeait bien vers
Apple, mais seul l’ancien retour API était enregistré chez Apple. Le réglage
Apple Developer a été corrigé et sauvegardé le 2026-10-26, sans nouveau binaire.

Dans **Certificates, Identifiers & Profiles → Identifiers → Services IDs**, ouvrir
`com.secondbrainlabs.core.signinwithapple`, puis **Sign in with Apple → Configure**.
Conserver l’association à l’App ID primaire de Deepn et renseigner :

| Champ Apple Developer | Valeur dev |
| --- | --- |
| Domains and Subdomains | `deepn-125313707865-dev.auth.eu-west-3.amazoncognito.com` |
| Return URLs | `https://deepn-125313707865-dev.auth.eu-west-3.amazoncognito.com/oauth2/idpresponse` |

Le champ **Description** du Services ID est **Deepn** depuis le 2026-10-26. Il
remplace « Second Brain Labs sign in with Apple » sur l’écran Apple du parcours
navigateur Android/web. Pour modifier ce nom, éditer Description puis valider
**Continue → Save**. L’identifiant technique du Services ID reste celui ci-dessus.
Les pages publiques Apple des deux parcours ont été relues après sauvegarde :
elles contiennent Deepn et plus l’ancien libellé. Aucun nouveau binaire requis.

Valider **Done → Continue → Save**. Le domaine n’a pas de préfixe `https://` ; le
retour inclut le protocole et le chemin exact. `media-summarizer://auth-callback`
est le retour de Cognito vers l’app, pas celui d’Apple vers Cognito. Le retour web
de l’app ne doit pas non plus être enregistré à la place du callback Cognito.

L’ancien domaine API `jji077bi8e.execute-api.eu-west-3.amazonaws.com` et son retour
`/api/auth/apple/callback`, dont le code a été supprimé lors de la bascule Cognito,
ont été retirés du Services ID. La relecture après sauvegarde confirme uniquement
le domaine et le retour Cognito ci-dessus, avec le même App ID primaire.

Vérification réelle après enregistrement, pour les configurations publiques mobile
et web : Cognito répond 302 vers Apple, qui répond 200 avec la page de connexion
« Sign in to Apple Account », sans `invalid_request` ni `Invalid web redirect url`.
Aucune connexion utilisateur complète n’a été exécutée ; elle reste à valider sur
appareil. Ce réglage concerne le dev ; il devra suivre le domaine effectivement
déployé si task-528 change le domaine Cognito.

Sources : [configuration Apple des Services IDs](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web),
[retour Apple vers Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-social-idp-apple.html).

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
retour dans Apple Developer était encore en attente lors de cette release ; elle
a été terminée le 2026-10-26 (section précédente). Prod reste inchangé.
