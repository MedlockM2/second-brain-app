---
id: TASK-529
title: >-
  Une adresse, un compte : lier Google et Apple au compte existant après preuve
  des deux identités
status: In Progress
assignee: []
created_date: '2026-10-20 09:39'
updated_date: '2026-10-20 09:59'
labels:
  - auth
  - security
  - cognito
  - mobile
  - web
  - infrastructure
dependencies: []
references:
  - media_summarizer/core/services/apple_native_auth.py
  - media_summarizer/core/services/cognito_auth.py
  - media_summarizer/api/endpoints/auth.py
  - infrastructure/lambda/apple_auth.py
  - infrastructure/terraform/modules/platform/cognito.tf
  - mobile/src/services/authService.ts
  - mobile/src/components/SocialAuthButtons.tsx
  - web/src/session/cognito.ts
  - web/src/pages/AuthCallbackPage.tsx
  - packages/core/src/auth/cognito.ts
  - docs/AUTHENTICATION_SETUP.md
  - docs/USER_FACING_ERROR_MESSAGES.md
  - >-
    https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html
  - >-
    https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminLinkProviderForUser.html
  - >-
    https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html
  - >-
    https://repost.aws/questions/QURvkKUJpaQCCanZpnzpF5aA/what-s-the-best-practice-for-external-idp-and-existing-account-linking
  - >-
    https://www.repost.aws/questions/QUzzrn542nS0yuSWl4JAHlSg/signing-in-with-social-google-facebook-throws-error-already-found-an-entry-for-username
  - 'https://developers.google.com/identity/gsi/web/guides/verify-google-id-token'
  - 'https://www.descope.com/blog/post/noauth'
  - 'https://workos.com/blog/oauth-auto-link-email-account-takeover'
  - 'https://thehackernews.com/2022/05/learn-how-hackers-can-hijack-your.html'
modified_files:
  - media_summarizer/core/services/account_links.py
  - media_summarizer/core/services/cognito_auth.py
  - media_summarizer/core/services/apple_native_auth.py
  - media_summarizer/api/endpoints/auth.py
  - infrastructure/lambda/apple_auth.py
  - infrastructure/terraform/modules/platform/apple_native_auth.tf
  - infrastructure/terraform/modules/platform/cognito.tf
  - packages/core/src/auth/cognito.ts
  - packages/core/src/i18n/*.ts
  - mobile/src/services/authService.ts
  - mobile/src/components/SocialAuthButtons.tsx
  - mobile/app/(auth)/login.tsx
  - mobile/app/(auth)/register.tsx
  - mobile/src/lib/getFriendlyErrorMessage.ts
  - web/src/session/cognito.ts
  - web/src/pages/AuthCallbackPage.tsx
  - web/src/pages/AuthPage.tsx
  - docs/AUTHENTICATION_SETUP.md
  - docs/USER_FACING_ERROR_MESSAGES.md
priority: high
type: feature
ordinal: 136000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Analyse du 2026-10-20 (session propriétaire). Le pool Cognito utilise l'e-mail comme username, mais un utilisateur fédéré (`Google_<sub>`, `SignInWithApple_<sub>`) ne réserve pas son adresse. Résultat : une même personne peut se retrouver avec deux comptes Deepn distincts, chacun avec sa bibliothèque, selon la méthode utilisée. Cas constatés dans le code :

1. Google, ou Apple par Hosted UI (Android/web), après un compte e-mail/mot de passe ou un compte Apple natif iOS ayant la même adresse : `PreSignUp_ExternalProvider` (`infrastructure/lambda/apple_auth.py`) ne lie que le sujet Apple déjà connu ; Cognito crée un second compte.
2. Apple natif iOS après un compte Google ou Apple Hosted UI ayant la même adresse : `admin_create_user` (`apple_native_auth.apple_username`) réussit, puisque le fédéré ne réserve pas l'e-mail, et crée un doublon.
3. Apple natif iOS après un compte e-mail/mot de passe : l'API renvoie `409 AUTH_ACCOUNT_CONFLICT`, mais le mobile ne traite pas ce code et ne propose aucune issue.
4. Google après Apple Hosted UI, et inversement : deux fédérés, deux comptes.

La politique actuelle « aucune fusion par e-mail » (`docs/AUTHENTICATION_SETUP.md`, task-526/527) est juste du point de vue de la sécurité, mais elle produit ces doublons.

## Décision : une adresse vérifiée = un seul compte, liaison seulement après preuve

Pratique documentée (AWS « Linking federated users », réponses AWS re:Post, schéma de Firebase et d'Auth0, retours d'expérience nOAuth 2023 et des prises de compte de 2026 décrites par WorkOS) :
- **Jamais de fusion automatique sur la seule adresse.** AWS rappelle que `AdminLinkProviderForUser` ne doit servir qu'avec des attributs de confiance. Lier sur l'e-mail est la cause directe de nOAuth et des prises de compte récentes.
- **Pas de doublon non plus.** Quand une nouvelle identité présente une adresse déjà portée par un compte confirmé, sa création est refusée. La personne voit quelles méthodes existent déjà pour ce compte. Ce n'est pas de l'énumération : elle vient de présenter cette adresse vérifiée par Google ou Apple, et le propriétaire a accepté le 2026-10-20 d'annoncer qu'un compte existe.
- **Liaison = preuve des deux identités dans le même parcours.** La personne se connecte avec la méthode existante, puis refait la preuve du nouveau fournisseur. Le serveur lie l'identité du fournisseur au compte existant par son `sub`, jamais par l'adresse. Il s'appuie sur la session existante et sur une preuve fraîche du fournisseur, liées au parcours qui a lancé la liaison. Une simple coïncidence d'adresse dans une fenêtre de temps ne suffit pas.
- **Un compte non confirmé ne compte pas.** Un utilisateur natif `UNCONFIRMED` portant l'adresse n'a jamais prouvé qu'elle lui appartient. Il ne bloque pas la connexion sociale, et il n'est surtout pas lié : il est supprimé, puis la connexion sociale se poursuit normalement. Cela ferme l'attaque « pre-hijacking classic-federated merge » (Sudhodanan & Paverd, MSRC 2022).
- **Pas de liaison automatique, même quand Google fait autorité** (Gmail ou `hd`). Google l'autorise, mais la règle reste uniforme et conforme à la décision antérieure de ne jamais fusionner par e-mail.

## Périmètre

**Contrôle d'unicité.** Pour toute création d'identité (`PreSignUp_ExternalProvider` pour Google et Apple Hosted UI, création Apple native dans l'API), chercher les utilisateurs du pool portant l'adresse, sans tenir compte de la casse et fédérés compris (`ListUsers` avec un filtre `email`). En cas de titulaire confirmé : refus avec un code stable (par exemple `AUTH_ACCOUNT_EXISTS`) et la liste des méthodes du compte existant (mot de passe, Apple, Google), lue sur son statut, ses `identities` et `custom:apple_subject`. En cas de titulaire `UNCONFIRMED` uniquement : le supprimer, puis continuer. IAM minimal pour ces lectures et suppressions.

**Parcours de liaison.** Recommandation, à affiner dans les notes d'implémentation :
- Hosted UI (Google partout, Apple Android/web) : la session existante ouvre une intention de liaison courte et à usage unique côté API. Le refus de `PreSignUp_ExternalProvider` est levé uniquement pour cette intention. Une fois la preuve du fournisseur reçue, l'API lie avec `AdminLinkProviderForUser` (source `Cognito_Subject`) au compte de la session qui a lancé l'intention, et retire tout profil fédéré temporaire (AWS impose de supprimer un fédéré déjà connecté avant de le lier). Aucune session ni aucun profil applicatif utilisable ne doit exister pour une identité en attente : l'API refuse de provisionner un profil pour une identité dont l'adresse appartient à un autre compte. Traiter l'erreur connue « Already found an entry for username » du premier passage après une liaison en pre-sign-up, avec la reprise documentée.
- Apple natif iOS : la session existante et une nouvelle preuve Apple (jeton, code à usage unique, nonce, comme `sign_in`) arrivent sur une route authentifiée. La liaison suit le même mécanisme, et la correspondance sujet → username est enregistrée dans la table Apple existante. Ne pas poser `custom:apple_subject` sur un compte à mot de passe : `password_account()` lui refuserait alors la récupération.

**Apps mobile et web, à parité.** Le refus d'une connexion sociale affiche : « Un compte Deepn existe déjà avec cette adresse. Connectez-vous avec <méthodes> pour y ajouter <fournisseur>. » Une action ouvre directement la connexion par la méthode existante, l'adresse pré-remplie quand c'est un mot de passe. Après connexion, la liaison s'enchaîne sans repasser par un écran intermédiaire. L'annulation laisse la personne connectée à son compte existant. Le texte brut du fournisseur (`error_description`) n'est jamais affiché. Codes ajoutés à `packages/core/src/auth/cognito.ts` et aux onze langues. `AUTH_ACCOUNT_CONFLICT` est remplacé par le nouveau code, sans conserver d'alias.

**Suppression de compte.** Elle retire aussi les identités liées et les correspondances de sujet Apple.

**Documentation.** `docs/AUTHENTICATION_SETUP.md` : remplacer les paragraphes « Une collision avec un compte local… aucune fusion » et « Google, Apple et un compte local ayant la même adresse restent des identités distinctes » par la règle ci-dessus, le parcours de liaison et ses sources. Mettre à jour `docs/USER_FACING_ERROR_MESSAGES.md`.

Hors périmètre : un écran « Méthodes de connexion » pour ajouter ou retirer un fournisseur à froid, l'ajout d'un mot de passe à un compte exclusivement social, et le message de `/register` (tâche suivante, qui dépend de celle-ci). Aucun outil de fusion des doublons existants : rien n'est en production.

## Note au propriétaire (hors AC)

Après fusion : `terraform apply` dev, déploiement de l'API, OTA ou binaire. Puis valider sur appareil et sur le web les quatre cas ci-dessus, la liaison suivie d'une reconnexion par chaque méthode sur le même compte, la récupération d'un compte à mot de passe lié à Google, et la suppression d'un compte lié.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Chaque chemin de création d'identité (PreSignUp_ExternalProvider pour Google et Apple Hosted UI, création Apple native dans l'API) est branché sur un contrôle d'unicité qui inclut les utilisateurs fédérés et ignore la casse : refus codé avec les méthodes existantes si le titulaire est confirmé ; suppression du titulaire UNCONFIRMED puis poursuite sinon ; aucun rattachement sur la seule adresse.
- [x] #2 Des routes API authentifiées et le trigger réalisent la liaison Google, Apple Hosted UI et Apple natif par AdminLinkProviderForUser (ou la correspondance de sujet pour Apple natif) seulement quand la session existante et une preuve fraîche du fournisseur sont présentes ; l'intention de liaison est à usage unique, expire et est liée à la session qui l'a ouverte ; aucun profil applicatif n'est provisionné pour une identité en attente.
- [x] #3 Un compte à mot de passe lié à Apple ou Google reste éligible à la récupération de mot de passe ; un compte Apple natif sans mot de passe choisi reste refusé, comme aujourd'hui.
- [x] #4 Mobile et web traitent le refus : message indiquant les méthodes existantes, connexion par la méthode existante puis liaison enchaînée, annulation sans perte de session ; codes ajoutés à packages/core et aux onze langues ; AUTH_ACCOUNT_CONFLICT supprimé sans alias ; le texte brut du fournisseur n'est jamais affiché.
- [x] #5 La suppression de compte retire les identités liées et les correspondances de sujet Apple du compte.
- [x] #6 docs/AUTHENTICATION_SETUP.md et docs/USER_FACING_ERROR_MESSAGES.md décrivent la règle « une adresse, un compte », le parcours de liaison, le cas UNCONFIRMED et les sources ; les paragraphes « aucune fusion / identités distinctes » sont remplacés.
- [x] #7 Un relevé AWS CLI en lecture seule sur le pool dev (AWS_PROFILE=second-brain-app) liste, dans les notes d'implémentation, les adresses portées par plusieurs utilisateurs, sans rien modifier.
- [x] #8 ruff, mypy, typecheck et lint mobile, web et packages/core, build web, terraform fmt -check et validate (module platform et racines) sont propres ; aucun test automatisé n'est ajouté.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Réalisé le 2026-10-20 dans la session propriétaire, en même temps que task-530.

**Contrôle d'unicité.**
- `cognito_auth.account_holders` / `confirmed` / `purge_unconfirmed` / `sign_in_methods` / `account_exists` : `ListUsers` avec un filtre `email`, fédérés compris. Un titulaire est confirmé s'il n'est pas `UNCONFIRMED` et a `email_verified=true`.
- Le trigger (`infrastructure/lambda/apple_auth.py`) applique les mêmes règles, recopiées car le zip est autonome. `PreSignUp_ExternalProvider` supprime les inscriptions `UNCONFIRMED` et lève `AUTH_ACCOUNT_EXISTS:<méthodes>`, sauf si une intention de liaison vivante existe pour un titulaire et ce fournisseur. Le lien automatique d'un sujet Apple déjà connu est conservé.
- La création Apple native (`apple_username`) refuse avec `AUTH_ACCOUNT_EXISTS` et ses méthodes ; l'ancien `AUTH_ACCOUNT_CONFLICT` est supprimé partout, sans alias.
- `cognito_auth.profile` refuse de provisionner un profil applicatif quand un autre titulaire confirmé porte l'adresse.

**Liaison.**
- `account_links.py` et les routes `POST /api/auth/link/start`, `/link/complete` et `/link/apple`. Elles exigent un access token Cognito ; un jeton `ext_` est refusé.
- L'intention est stockée dans la table `apple-auth` sous la clé `link#sha256(username#provider)`, à usage unique, avec 10 minutes d'expiration contrôlées explicitement et la TTL en nettoyage.
- `link/complete` échange le code, consomme l'intention, puis supprime le profil fédéré (`AUTH_PROVIDER_IN_USE` s'il possède déjà un profil applicatif). Il lie ensuite par `AdminLinkProviderForUser` (`Cognito_Subject`) : une destination locale est désignée par `Cognito`/username, une destination fédérée par son identité primaire.
- Pour Apple, la correspondance de sujet est enregistrée et `custom:apple_subject` n'est jamais posé sur un compte à mot de passe, qui reste éligible à la récupération (AC3).

**IAM.** Le trigger reçoit `ListUsers` et `AdminDeleteUser` ; l'API reçoit `ListUsers` et `AdminLinkProviderForUser`.

**Apps.**
- `packages/core/src/auth/cognito.ts` : `pendingLinkFrom`, `hostedUiRefusal` (extrait le code de `error_description` et renvoie `"retry"` sur « Already found an entry for username ») et `pendingLinkMessage`.
- Mobile : `AuthService.linkProvider`, puis `SocialAuthButtons` (`onAccountExists`, `onSignedIn`). L'écran de connexion affiche le bandeau et enchaîne la liaison ; un échec est présenté dans une alerte et la personne reste connectée. L'inscription renvoie vers la connexion avec le lien en attente.
- Web : le lien en attente est gardé dans `sessionStorage` (10 minutes, aucun justificatif). Les redirections Hosted UI portent leur but (connexion ou liaison) et une seule reprise.
- Nouvelles clés dans les onze langues.

**Suppression de compte (AC5).** `delete_identity` retire déjà les correspondances de sujet Apple (attribut et `identities`) avant `AdminDeleteUser`, qui emporte les identités liées. La liaison enregistre la correspondance sous le username de destination, que cette suppression conditionnelle cible. Aucun changement de code nécessaire.

**Relevé dev (AC7).** `AWS_PROFILE=second-brain-app`, lecture seule, 2026-10-20 : 6 utilisateurs dans le pool, **aucune adresse portée par plusieurs utilisateurs**. Le filtre `email` de `ListUsers` est insensible à la casse : la même adresse en majuscules renvoie le même utilisateur.

**Vérifications.**
- `ruff check` et `mypy` (207 fichiers) passent.
- Typecheck et lint passent sur `packages/core`, mobile et web. Un avertissement `any` existait déjà dans `purchaseService.ts`.
- Le build web passe (avertissement de taille de chunk déjà présent).
- `terraform fmt` et `validate` passent sur le module platform et sur dev, staging et prod.
- Aucun test automatisé, aucun apply, aucun déploiement.

**Limites connues.**
- Un profil fédéré laissé par une liaison abandonnée compte comme titulaire : la liste des méthodes peut alors contenir ce fournisseur. Une liaison relancée depuis le compte principal le supprime et le relie.
- `CUSTOM_AUTH` sur une destination fédérée (iOS natif lié à un compte Google) repose sur le même mécanisme que task-527 : à valider sur appareil.
<!-- SECTION:NOTES:END -->
