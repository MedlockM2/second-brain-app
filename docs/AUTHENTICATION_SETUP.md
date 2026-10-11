# Guide d’Authentification — Deepn

Objectif
- Décrire les flux d’authentification supportés par l’API (OAuth Google/Apple + fallback email/mot de passe)
- Documenter la configuration (variables d’environnement, transport des tokens, CORS) et les bonnes pratiques de sécurité
- Fournir des exemples d’enchaînement côté client et des tests rapides (curl)

Composants & Endpoints
- Auth sociale native (le seul chemin qui ouvre une session sociale)
  - POST /api/auth/google/native {"id_token": "..."} → vérifie l’id_token (SDK Google sur mobile, Google Identity Services sur le web), relie/crée l’utilisateur, ouvre une session (mobile : access_token + refresh_token en JSON ; web : voir « Mode web »)
  - POST /api/auth/apple/native {"identity_token": "...", "user": {...}} → idem via la JWKS Apple (SDK natif ou Sign in with Apple JS)
- Auth sociale web (flux navigateur, conservé pour les redirect URIs enregistrées chez Google/Apple)
  - GET /api/auth/google/login → redirige vers Google avec un state lié au navigateur par un cookie oauth_state_google
  - GET /api/auth/google/callback?code=...&state=... → échange code→tokens, vérifie id_token, relie/crée l’utilisateur, redirige FRONTEND_URL. **N’émet aucun token de session** : l’app web ouvre la sienne par les endpoints natifs ci-dessus
  - GET /api/auth/apple/login et GET /api/auth/apple/callback → même contrat (client_secret ES256 généré à la volée)
- Local (email/mot de passe)
  - POST /api/auth/register → crée un utilisateur local auto-vérifié et ouvre directement la session (201 + access_token + refresh_token)
  - POST /api/auth/login → access_token 60 min (JWT) + refresh_token (mobile : glissant 1 an en JSON ; web : cookie, voir « Mode web »)
  - POST /api/auth/refresh {"refresh_token": "..."} → rotation du refresh (expiration recalculée selon le type de lignée) + nouvel access token. Un token consommé depuis moins de 60 s rejoue le couple déjà émis au lieu de répondre 401 (fenêtre de grâce, task-294). En mode web, pas de corps : le refresh est le cookie
  - POST /api/auth/logout {"refresh_token": "..."} → révoque la seule lignée de l’appareil qui appelle ; les autres appareils du compte gardent leur session. En mode web, pas de corps : le refresh est le cookie, et la réponse l’efface
  - GET  /api/auth/me → retourne l’utilisateur courant
  - PATCH /api/auth/me {"reading_language": "...", "iana_timezone": "..."} → met à jour les préférences du compte et renvoie le profil. `reading_language` est plafonné à **un changement par mois et par compte** (task-396) : changer de langue retraduit le texte intégral de chaque média ouvert ensuite, donc l’intervalle entre deux changements est borné. Le premier réglage (choix d’onboarding) n’est pas un changement et n’est jamais refusé ; il ne démarre pas le compteur. Un second changement dans la fenêtre répond **429** avec `{"detail": {"error_code": "reading_language_change_too_soon", "available_at": "<ISO 8601>"}}` — un code stable et la date de réouverture, jamais une phrase : c’est l’app qui formule le refus depuis ses catalogues. Le profil renvoyé par les cinq endpoints de session porte `reading_language_change_available_at` (null quand un changement est possible tout de suite)
- Exigences d’accès API
  - La plupart des routes sensibles nécessitent un access token (Authorization: Bearer <JWT>)
  - Exemple strict: POST /api/podcast-search/submit-episode → require_verified_email

Lignées et politique de durée (task-294, task-473)
- Chaque refresh token porte un `lineage_id` généré côté serveur au login et recopié à chaque rotation : c’est l’identité de la session d’un appareil, jamais fournie par le client, et c’est ce que /logout révoque
- Une lignée a un **type**, fixé au login par le mode de transport de la requête et recopié à chaque rotation avec `lineage_started_at` (l’instant du login). Le type décide de la durée (`get_refresh_token_expires_at`, `media_summarizer/utils/auth_utils.py`) :

  | Type | Ouverte par | Inactivité max. | Plafond absolu | Rotation |
  |---|---|---|---|---|
  | `mobile` | l’app mobile (mode par défaut) | 1 an (REFRESH_TOKEN_EXPIRE_DAYS=365) | aucun | repose `expires_at` à now + 1 an |
  | `browser` | l’app web (`X-Session-Transport: cookie`) | 7 jours (BROWSER_REFRESH_IDLE_DAYS) | 30 jours après le login (BROWSER_REFRESH_MAX_DAYS) | repose `expires_at` à min(now + 7 j, login + 30 j) |
  | `browser_extension` | l’appairage d’une extension navigateur (voir « Extension navigateur ») | 90 jours (EXTENSION_REFRESH_IDLE_DAYS) | 1 an après l’appairage (EXTENSION_REFRESH_MAX_DAYS) | repose `expires_at` à min(now + 90 j, appairage + 1 an) |

  - `mobile` : un utilisateur qui ouvre l’app une fois par an ne se reconnecte jamais ; un appareil abandonné tombe seul au bout d’un an
  - `browser` : un navigateur est un lieu moins gardé que le Keychain/Keystore. La rotation ne prolonge jamais la durée initiale (RFC 10017 §6.3.2.3) : au plus tard 30 jours après le login, l’utilisateur se reconnecte, même s’il a utilisé l’app web chaque jour
  - Une ligne écrite avant task-473 n’a ni type ni début : elle est lue comme `mobile`, débutée à sa création — seule l’app mobile pouvait l’avoir ouverte
- Chaque transport n’accepte que les lignées qu’il ouvre : un refresh `browser` présenté dans le corps, ou un refresh `mobile` présenté par cookie, répond 401 « Invalid refresh token ». Une lignée `browser_extension` passe par le corps, comme le mobile

Extension navigateur (task-485, `media_summarizer/api/endpoints/extension_tokens.py`)
- L’extension ne se connecte jamais : elle est **appairée** à un compte déjà connecté sur l’app web et reçoit le refresh d’une lignée à elle, de type `browser_extension` (durées dans le tableau ci-dessus, décision de l’owner du 2026-10-11 ; au-delà, l’extension demande de ré-appairer en un clic). Le refresh passe dans le corps JSON ; l’extension le garde dans son stockage et le présente à `/api/auth/refresh`
- **Portée réduite** : l’access token d’une lignée d’extension porte la revendication `scope: extension`. La dépendance d’authentification (`get_current_user`, `EXTENSION_ROUTES` dans `media_summarizer/api/dependencies/auth.py`) ne l’accepte que sur `POST /api/media/ingest-url`, `POST /api/media/ingest-shared-content`, `GET /api/folders` et `POST /api/auth/logout` ; **toute autre route répond 403**. Son refresh n’a pas besoin d’access token. Le contrôle compare le chemin de la requête, pas le gabarit de route : les quatre routes sont statiques, et un écart ne peut que refuser
- Routes (préfixe `/api/auth/extension-tokens`)
  - `POST ""` (session web) `{"client_label": "Chrome sur macOS"}` → 201 `{lineage_id, refresh_token, expires_at}` : l’appairage en un clic, l’app web transmet le refresh à l’extension par `externally_connectable`
  - `GET ""` (session web) → `{"extensions": [{lineage_id, client_label, paired_at, last_used_at, expires_at}]}` : une entrée par lignée vivante, appairage le plus récent d’abord
  - `DELETE "/{lineage_id}"` (session web) → 204 : délie une extension du compte appelant (404 sinon)
  - `POST "/pairing-code"` (session web) → 201 `{code, expires_at}` : le **code de secours**, quand le message `externally_connectable` ne passe pas. 6 chiffres, 5 minutes, usage unique ; en redemander un remplace le précédent. Stocké haché (`sha256(user_id:code)`), jamais en clair
  - `POST "/pairing-code/claim"` (non authentifié) `{"email": "...", "code": "482913", "client_label": "..."}` → 201 `{lineage_id, refresh_token, expires_at}`. La réclamation nomme le compte par son e-mail pour que chaque erreur soit comptée **sur le code de ce compte** : à la 3e erreur le code est détruit. Sans ce compteur porté par le code, six chiffres se forcent en quelques milliers d’essais malgré le throttling d’API Gateway. Toutes les erreurs (e-mail inconnu, pas de code vivant, code faux, code détruit) répondent le même 400 `invalid_pairing_code`
- `/logout` depuis l’extension révoque sa propre lignée. La déconnexion de l’app web **ne délie pas** l’extension (autre lignée). La suppression du compte efface toutes les lignes `auth_tokens`, lignées d’extension et codes compris

Transport des tokens
- Mode mobile (par défaut)
  - Refresh transporté dans le **corps JSON** : champ `refresh_token` des réponses de register/login/refresh et des endpoints natifs, champ `refresh_token` du corps de /refresh et /logout
  - Le client mobile le garde dans expo-secure-store (Keychain / Keystore)
- Mode web (task-473), choisi par l’en-tête de requête **`X-Session-Transport: cookie`** sur login, register, google/native, apple/native, refresh et logout
  - La réponse des routes qui ouvrent ou tournent une session ne contient que `access_token`, `token_type`, `expires_in` et `user` : **jamais** `refresh_token`
  - Le refresh est posé en cookie `__Secure-refresh_token` : `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`, sans `Domain` (host-only sur `api.<domaine>`), `Max-Age` aligné sur l’expiration de la lignée. Le préfixe `__Secure-` fait refuser le cookie par le navigateur s’il n’est pas `Secure` ; `__Host-` exigerait `Path=/`
  - /refresh et /logout n’ont pas de corps : ils lisent ce cookie. Un /refresh sans cookie répond 401 « Missing refresh token ». /logout efface le cookie dans tous les cas
  - L’app web garde l’access token **en mémoire seulement**, et rouvre la session au chargement de la page par un /refresh
  - Pourquoi un en-tête plutôt qu’un champ : /refresh et /logout n’ont pas de corps en mode web, et un en-tête personnalisé impose un pré-vol CORS. Une page d’une autre origine ne peut donc ni déclencher un /refresh authentifié par le cookie ni en lire la réponse ; `SameSite=Strict` est le second verrou
  - Le cookie n’est utilisable que si `app.<domaine>` et `api.<domaine>` sont sur le même site enregistrable. Avec l’URL `execute-api`, il serait tiers et bloqué : l’app web en local se connecte, mais sa session ne survit pas à un rechargement tant que `api.<domaine>` n’existe pas (task-443, task-445)
- Refresh token, commun aux deux modes
  - Valeur opaque stockée en base (table auth_tokens). Rotation à chaque /refresh : l’ancien est marqué used_at + is_active=false et ne sert plus qu’à rejouer son successeur pendant 60 s
  - La table a un TTL (`expire_at` = expires_at + 7 jours) : une ligne périmée finit par disparaître, et la marge garantit qu’un balayage TTL ne peut pas tuer une session encore rafraîchissable
- Access token (header Authorization: Bearer)
  - Durée configurable (JWT_ACCESS_TOKEN_EXPIRE_MINUTES, 60 par défaut ; JWT_ACCESS_TOKEN_EXPIRE_SECONDS pour un dev flow). Sans effet sur la révocation : get_current_user relit l’utilisateur en DynamoDB à chaque requête
  - Généré à /register, /login, /refresh et sur les deux endpoints natifs
- Les autres cookies posés par l’API sont `oauth_state_<provider>` : garde CSRF du flux de redirection OAuth, host-only, Secure, httpOnly, SameSite=lax, 10 minutes, lu par le callback du même hôte

CORS & Redirections
- Le CORS de l’API HTTP est répondu par API Gateway (`cors_configuration` de `infrastructure/terraform/modules/platform/lambda_api.tf`), pas par FastAPI : une API HTTP dotée d’une configuration CORS ignore les en-têtes CORS de son intégration
  - Origine autorisée : la variable Terraform `web_app_origin` de chaque environnement, **jamais `*`** (un cookie n’est pas envoyé vers une origine `*`), avec `allow_credentials = true` et des en-têtes nommés (`authorization`, `content-type`, `x-request-id`, `x-session-transport`)
  - dev : `http://localhost:5173`, le serveur local de l’app web, tant que `app.<domaine>` n’existe pas ; staging et prod : vide, aucune origine navigateur, jusqu’à `https://app.<domaine>`
  - L’app mobile n’est pas soumise au CORS
- FRONTEND_URL utilisé pour construire les URLs de redirection après succès/erreur d’OAuth web

Sécurité & Bonnes Pratiques
- Sessions
  - Ne jamais logguer un refresh token : c’est un porteur de session (un an sur mobile, 30 jours sur le web)
  - Un refresh token consommé est mort passé la fenêtre de grâce de 60 s, donc un rejeu tardif répond 401 « Expired or used refresh token ». Un token révoqué par /logout n’est jamais rejouable
  - La révocation de toutes les lignées d’un compte n’existe qu’au sein de la suppression de compte, qui supprime les lignes plutôt que de les désactiver
- OAuth
  - Valider id_token (aud/iss/sub/email_verified) côté serveur
  - Lier les comptes par email vérifié
- Logs
  - Éviter de logguer des secrets ou des tokens bruts

Variables d’Environnement (extrait)
- JWT & sessions
  - JWT_SECRET_KEY
  - JWT_ALGORITHM=HS256
  - JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
  - REFRESH_TOKEN_EXPIRE_DAYS=365 (lignée mobile : fenêtre glissante, sans plafond absolu)
  - La lignée navigateur n’a pas de variable : 7 jours d’inactivité et 30 jours de plafond sont des constantes de `auth_utils.py`
  - (aucune variable COOKIE_* : les attributs du cookie web sont fixes, `media_summarizer/api/dependencies/session.py`)
- Frontend
  - FRONTEND_URL=https://app.yourdomain.com
  - (aucune variable CORS_ORIGINS : le CORS est la variable Terraform `web_app_origin`)
- Google OAuth
  - GOOGLE_CLIENT_ID
  - GOOGLE_CLIENT_SECRET
  - GOOGLE_REDIRECT_URI=https://api.yourdomain.com/api/auth/google/callback
- Apple OAuth
  - APPLE_CLIENT_ID
  - APPLE_TEAM_ID
  - APPLE_KEY_ID
  - APPLE_PRIVATE_KEY (PEM; peut être fourni en une ligne avec \n)
  - APPLE_REDIRECT_URI=https://api.yourdomain.com/api/auth/apple/callback

Exemples — Flux côté client
- Login Google / Apple (mobile)
  - 1) Le SDK natif rend un id_token (Google) ou un identity_token (Apple)
  - 2) POST /api/auth/google/native ou /api/auth/apple/native avec ce token
  - 3) Stocker access_token + refresh_token du corps de la réponse dans le secure store
  - 4) À l’expiration de l’access token, POST /api/auth/refresh avec le refresh token stocké

Sign-in Google mobile — un chemin par plateforme (task-325)
- iOS : flux navigateur `expo-auth-session` (`src/hooks/useGoogleSignIn.ts`). Le
  `redirect_uri` est le scheme réservé du client OAuth **iOS**
  (`com.googleusercontent.apps.<guid>:/oauthredirect`), et le code est échangé
  contre l’id_token auprès de ce même client : l’`aud` de l’id_token est donc le
  client iOS (`GOOGLE_NATIVE_AUDIENCE_IOS` côté API)
- Android : **Credential Manager**, via le module Expo local
  `mobile/modules/google-credential-manager`
  (`GetSignInWithGoogleOption` → `GoogleIdTokenCredential`, appelé par
  `src/hooks/useGoogleSignIn.android.ts`). Le `serverClientId` passé au module est
  le client OAuth **Web** (`EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB`, c’est-à-dire la même
  valeur que `GOOGLE_CLIENT_ID` côté API), comme la documentation Google l’exige :
  l’`aud` de l’id_token rendu est donc le client Web, déjà accepté par
  `/api/auth/google/native` — aucune variable d’environnement API à ajouter
  - Il n’y a **pas** de `redirect_uri` sur Android, et il ne peut pas y en avoir :
    Google refuse un custom URI scheme pour un client OAuth Android (`Erreur 400 :
    invalid_request`, « Custom URI scheme is not enabled for your Android client »),
    sans réglage pour le réactiver. C’est ce qui a tué le flux navigateur sur
    Android et motivé le module natif
  - Aucun ID de client Android n’entre dans l’app. Mais un client OAuth **Android**
    doit exister côté Google : Credential Manager vérifie l’appelant sur son nom de
    package (`com.secondbrainlabs.core`) **et l’empreinte SHA-1 du certificat qui
    signe le binaire installé**
  - Pour tout binaire distribué par Google Play (piste interne comprise), ce
    certificat n’est pas le keystore d’upload EAS : Play re-signe l’APK servi. Le
    **SHA-1 de Play App Signing doit donc être déclaré sur un client OAuth
    Android**, en plus de celui du keystore EAS (deux clients Android, même nom de
    package). Sans ça, la feuille de sélection de compte échoue sur l’app installée
    depuis Play alors qu’elle fonctionne sur un build local
    - Où le lire : Play Console → *Test et publication* → *Intégrité de
      l’application* → onglet *Signature de l’application* → *Certificat de clé de
      signature d’application* (SHA-1)
    - Où le déclarer : Google Cloud Console → *API et services* → *Identifiants* →
      *ID clients OAuth 2.0* → *Créer des identifiants* → *ID client OAuth* →
      type *Android*

- Login local (curl)
  ```bash path=null start=null
  curl -X POST http://localhost:8000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email": "user@example.com", "password": "your-pass"}'
  # → {"access_token":"...","refresh_token":"...","token_type":"bearer","expires_in":1800,"user":{...}}
  ```

- Refresh (curl)
  ```bash path=null start=null
  curl -X POST http://localhost:8000/api/auth/refresh \
    -H 'Content-Type: application/json' \
    -d '{"refresh_token": "<value>"}'
  # → même contrat, avec un refresh_token neuf : l’ancien est consommé
  ```

- Login web (curl, depuis l’origine de l’app web)
  ```bash path=null start=null
  curl -i -X POST https://api.<domaine>/api/auth/login \
    -H 'Origin: https://app.<domaine>' \
    -H 'X-Session-Transport: cookie' \
    -H 'Content-Type: application/json' \
    -d '{"email": "user@example.com", "password": "your-pass"}'
  # → set-cookie: __Secure-refresh_token=...; HttpOnly; Max-Age=604800; Path=/api/auth; SameSite=strict; Secure
  # → {"access_token":"...","token_type":"bearer","expires_in":3600,"user":{...}}
  curl -i -X POST https://api.<domaine>/api/auth/refresh \
    -H 'X-Session-Transport: cookie' \
    -b '__Secure-refresh_token=<value>'
  ```

- Appel d’une route protégée
  ```bash path=null start=null
  curl -X GET http://localhost:8000/api/auth/me \
    -H 'Authorization: Bearer <access_token>'
  ```

Gestion des Erreurs Courantes
- 401 Invalid authentication token → vérifier le header Authorization
- 401 Invalid refresh token / Expired or used refresh token → le refresh stocké est inconnu, expiré ou déjà rotaté : il faut se reconnecter
- 401 Missing refresh token sur /api/auth/refresh → ni champ refresh_token dans le corps (mobile), ni cookie (web)
- 400 OAuth non configuré → vérifier GOOGLE_* ou APPLE_* dans l’environnement

La vérification d’email par lien a été retirée : les comptes sont auto-vérifiés
à l’inscription. Les endpoints stubs `/api/auth/verify-email` et
`/api/auth/resend-verification` ont été supprimés (task-222) — le premier
était non authentifié et mutait le champ `email_verified_at` d’un email
arbitraire.

Références Code
- Auth locale: media_summarizer/api/endpoints/auth.py
- OAuth social: media_summarizer/api/endpoints/auth_social.py
- Dépendances/auth: media_summarizer/api/dependencies/auth.py
- Transport de session (mode web, cookie): media_summarizer/api/dependencies/session.py
- Politique de durée des lignées: media_summarizer/utils/auth_utils.py
- CORS: infrastructure/terraform/modules/platform/lambda_api.tf (variable web_app_origin)
