---
id: TASK-530
title: >-
  Dire à l'inscription, à la connexion et à la récupération qu'un compte existe
  déjà ou n'a pas de mot de passe, et remplacer une inscription non confirmée
status: In Progress
assignee: []
created_date: '2026-10-20 09:40'
updated_date: '2026-10-20 09:59'
labels:
  - auth
  - security
  - cognito
  - mobile
  - web
dependencies:
  - TASK-529
references:
  - media_summarizer/api/endpoints/auth.py
  - media_summarizer/core/services/cognito_auth.py
  - infrastructure/lambda/apple_auth.py
  - infrastructure/terraform/modules/platform/cognito.tf
  - mobile/src/components/AuthCodeScreen.tsx
  - web/src/pages/AuthPage.tsx
  - web/src/pages/AuthCodePage.tsx
  - packages/core/src/auth/cognito.ts
  - docs/AUTHENTICATION_SETUP.md
  - docs/USER_FACING_ERROR_MESSAGES.md
  - 'https://thehackernews.com/2022/05/learn-how-hackers-can-hijack-your.html'
  - >-
    https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html
  - mobile/app/(auth)/login.tsx
modified_files:
  - media_summarizer/api/endpoints/auth.py
  - media_summarizer/core/services/cognito_auth.py
  - infrastructure/lambda/apple_auth.py
  - packages/core/src/auth/cognito.ts
  - packages/core/src/i18n/*.ts
  - mobile/app/(auth)/register.tsx
  - mobile/src/lib/getFriendlyErrorMessage.ts
  - web/src/pages/AuthPage.tsx
  - docs/AUTHENTICATION_SETUP.md
  - docs/USER_FACING_ERROR_MESSAGES.md
priority: high
type: bug
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Analyse du 2026-10-20. Aujourd'hui, `/register` (`media_summarizer/api/endpoints/auth.py`) ignore `UsernameExistsException` et répond `202 verification_required`, quel que soit le titulaire de l'adresse.

- **Compte Apple natif (créé par l'API) ou compte à mot de passe déjà confirmé** : aucun code n'est envoyé. Le renvoi répond « accepted » sans rien envoyer, la connexion avec le nouveau mot de passe échoue, et la récupération est muette pour un compte Apple. La personne reste bloquée sur l'écran du code, sans explication.
- **Compte fédéré (Google, Apple Hosted UI)** : `sign_up` réussit et crée un doublon. La task-529 ferme ce cas pour les connexions sociales ; il reste à le fermer pour l'inscription.
- **Compte natif `UNCONFIRMED`** : renvoyer simplement le code au premier inscrit permettrait l'attaque de « pre-hijacking classique » (Sudhodanan & Paverd, MSRC 2022). Un attaquant inscrit l'adresse de sa victime avec son propre mot de passe ; la victime confirme ensuite le code reçu et active ainsi un compte dont l'attaquant connaît le mot de passe.

La connexion et la récupération par e-mail échouent de la même façon sur un compte sans mot de passe choisi, c'est-à-dire un compte Google ou Apple seul, non lié :
- **`/login`** : Cognito refuse. Un compte fédéré n'a pas de mot de passe, et celui d'un compte Apple natif est aléatoire. L'app affiche `INVALID_CREDENTIALS` (« e-mail ou mot de passe incorrect »), ce qui est faux.
- **`/forgot-password`** : `password_account()` écarte le compte, mais l'app affiche `auth.codeSent` alors qu'aucun e-mail ne part.

La personne réessaie indéfiniment sans comprendre qu'il faut passer par le bouton Apple ou Google.

## Décision propriétaire (2026-10-20)

On reste sur l'envoi Cognito par défaut (`COGNITO_DEFAULT`), sans SES : aucun e-mail « compte existant » n'est envoyé. Les formulaires e-mail/mot de passe disent explicitement ce qu'il en est de l'adresse. Le propriétaire accepte ainsi qu'ils révèlent si une adresse est inscrite, et pour la connexion et la récupération, si son compte a un mot de passe. Ils ne précisent jamais quel fournisseur (Apple ou Google), car la personne qui saisit l'adresse n'a encore rien prouvé. Ils proposent les actions possibles. Aucun mot de passe local n'est créé ni proposé pour un compte exclusivement social (décision task-526).

## Périmètre

- **Inscription, titulaire confirmé**, quel qu'il soit (natif, Apple natif, fédéré, lié) : `/register` répond par un code stable, par exemple `AUTH_ACCOUNT_EXISTS` en 409, sans créer de compte. Pour les fédérés, `PreSignUp_SignUp` refuse la création. Réutiliser le contrôle d'unicité livré par la task-529, sans le dupliquer. L'API traduit le refus du trigger (`UserLambdaValidationException`) en ce code ; le message brut de Cognito n'est jamais exposé.
- **Inscription, titulaire uniquement `UNCONFIRMED`** : supprimer l'inscription en attente, puis inscrire à nouveau avec le mot de passe saisi. Le code part vers l'adresse, et seul ce dernier mot de passe sera actif. Gérer la course entre deux inscriptions simultanées sans renvoyer d'erreur interne.
- **Connexion** : uniquement quand Cognito refuse le mot de passe, vérifier si le compte de l'adresse a un mot de passe choisi. Le critère est le même que `password_account()` : fédéré seul, ou natif portant `custom:apple_subject`, n'a pas de mot de passe choisi ; un compte lié à un compte à mot de passe en a un. Pour un compte sans mot de passe choisi, renvoyer un code stable, par exemple `AUTH_SOCIAL_ONLY`. Dans tous les autres cas, garder `INVALID_CREDENTIALS` : adresse inconnue, compte à mot de passe, lié ou non. Ne rien vérifier quand la connexion réussit, et ne jamais nommer le fournisseur.
- **Récupération** : `/forgot-password` renvoie ce même code pour un compte sans mot de passe choisi, au lieu de `202 accepted`. `/confirm-password` refuse de la même façon. Les autres cas restent inchangés : 202 neutre pour une adresse inconnue ou un échec d'envoi.
- **Mobile et web, à parité** :
  - Inscription : afficher « Un compte existe déjà avec cette adresse. » avec deux actions, « Se connecter » (connexion avec l'adresse pré-remplie) et « Mot de passe oublié » (récupération avec l'adresse pré-remplie). Le rappel des boutons Google et Apple reste visible. Ne pas naviguer vers l'écran du code.
  - Connexion et récupération : afficher « Ce compte n'a pas de mot de passe : connectez-vous avec Apple ou Google. » à côté des boutons sociaux, sans écran de code ni promesse d'envoi.
  - Codes dans `packages/core/src/auth/cognito.ts` et les onze langues. Si un code porte le même nom que celui de la task-529, réutiliser la clé, sinon en créer une distincte.
- **Documentation** : dans `docs/AUTHENTICATION_SETUP.md` et `docs/USER_FACING_ERROR_MESSAGES.md`, décrire :
  - les réponses explicites de l'inscription, de la connexion et de la récupération ;
  - la décision d'accepter que ces formulaires révèlent les adresses inscrites ;
  - le remplacement des inscriptions non confirmées et sa raison.
  Retirer la mention d'une réponse 202 identique pour une adresse déjà inscrite, ainsi que celle de `auth.codeSent` couvrant les comptes exclusivement sociaux.

## Note au propriétaire (hors AC)

Après déploiement de l'API et OTA, vérifier sur mobile et web :
- l'inscription avec une adresse portée par un compte à mot de passe, un compte Apple natif, un compte Google, et une inscription non confirmée ; dans ce dernier cas, seul le dernier mot de passe doit permettre la connexion après confirmation ;
- la connexion et la récupération par e-mail sur un compte Apple seul, un compte Google seul, et un compte à mot de passe lié à Google, qui doit garder le parcours habituel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 /register répond par un code stable explicite, sans créer de compte, quand l'adresse appartient à un compte confirmé natif, Apple natif, fédéré ou lié ; PreSignUp_SignUp bloque le cas fédéré en réutilisant le contrôle d'unicité de la task-529, et le refus du trigger est traduit en ce code, sans texte Cognito brut.
- [x] #2 Une inscription sur une adresse portée uniquement par un utilisateur UNCONFIRMED supprime l'inscription en attente et inscrit à nouveau avec le mot de passe saisi ; ce chemin est câblé et la course entre inscriptions simultanées ne produit pas d'erreur 5xx.
- [x] #3 Après un refus du mot de passe, /login renvoie un code stable « compte sans mot de passe » si le compte de l'adresse n'a pas de mot de passe choisi (même critère que password_account()) et INVALID_CREDENTIALS dans tous les autres cas ; aucune vérification quand la connexion réussit, aucun fournisseur nommé.
- [x] #4 /forgot-password et /confirm-password renvoient ce même code pour un compte sans mot de passe choisi, au lieu du 202 neutre ; le 202 neutre reste pour une adresse inconnue ou un échec d'envoi.
- [x] #5 Mobile et web affichent sur le formulaire, sans naviguer vers l'écran du code, « Un compte existe déjà avec cette adresse » à l'inscription avec « Se connecter » et « Mot de passe oublié » pré-remplis, et « Ce compte n'a pas de mot de passe : connectez-vous avec Apple ou Google » à la connexion et à la récupération ; textes présents dans packages/core et les onze langues.
- [x] #6 docs/AUTHENTICATION_SETUP.md et docs/USER_FACING_ERROR_MESSAGES.md décrivent les réponses explicites, la décision du 2026-10-20 et le remplacement des inscriptions UNCONFIRMED ; les mentions du 202 identique à l'inscription et de auth.codeSent pour les comptes exclusivement sociaux sont retirées.
- [x] #7 ruff, mypy, typecheck et lint mobile, web et packages/core, build web, terraform fmt -check et validate sont propres ; aucun test automatisé n'est ajouté.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Réalisé le 2026-10-20 dans la même session que task-529, en réutilisant son contrôle d'unicité.

**Inscription.**
- `/register` boucle au plus deux fois.
  - Sur `UsernameExistsException`, il cherche les titulaires de l'adresse : s'il y en a un confirmé, il répond 409 `AUTH_ACCOUNT_EXISTS`.
  - Sinon, il supprime l'inscription `UNCONFIRMED` puis réinscrit avec le mot de passe saisi.
  - Si une course se répète, il répond 429 `AUTH_RATE_LIMITED`, jamais 5xx.
- `PreSignUp_SignUp` lève `AUTH_ACCOUNT_EXISTS` dès qu'un titulaire est confirmé : le client public peut appeler `SignUp` directement, la règle doit donc vivre dans le trigger. L'API traduit `UserLambdaValidationException` sans exposer le texte de Cognito.

**Connexion et récupération.** `cognito_auth.credential_kind` remplace `password_account` et sert à trois endroits :
- `/login`, seulement après `INVALID_CREDENTIALS` ;
- `/forgot-password` ;
- `/confirm-password`.

Sur un compte exclusivement social, les trois répondent 409 `AUTH_SOCIAL_ONLY`. Une adresse inconnue garde le 202 neutre (récupération) ou `INVALID_CREDENTIALS` (connexion). Un compte à mot de passe, lié ou non, garde le parcours habituel.

**Apps.** Mobile et web affichent `error.emailAlreadyExists` (clé existante, mêmes mots que demandés) avec « Se connecter » et « Mot de passe oublié ? », l'adresse pré-remplie, sans écran de code. La connexion et la récupération affichent `auth.socialOnly`.

**Vérifications.** Identiques à task-529 : ruff, mypy, typecheck, lint, build web et Terraform propres, sans test automatisé ni déploiement.
<!-- SECTION:NOTES:END -->
