---
id: TASK-526
title: >-
  Confier l’authentification de Deepn à Amazon Cognito et intégrer la
  récupération de mot de passe
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-16 13:55'
updated_date: '2026-10-17 15:49'
labels:
  - auth
  - mobile
  - web
  - security
  - aws
  - cognito
dependencies: []
documentation:
  - AGENTS.md
  - docs/AUTHENTICATION_SETUP.md
  - docs/USER_FACING_ERROR_MESSAGES.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - >-
    https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html
  - 'https://docs.aws.amazon.com/cognito/latest/developerguide/quotas.html'
modified_files:
  - media_summarizer/core/services/cognito_auth.py
  - media_summarizer/api/endpoints/auth.py
  - media_summarizer/api/dependencies/auth.py
  - mobile/src/components/AuthCodeScreen.tsx
  - mobile/src/services/authService.ts
  - web/src/session/cognito.ts
  - web/src/pages/AuthCodePage.tsx
  - packages/core/src/auth/cognito.ts
  - infrastructure/terraform/modules/platform/cognito.tf
  - docs/AUTHENTICATION_SETUP.md
type: feature
ordinal: 133000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deepn gère aujourd'hui elle-même les mots de passe, les connexions sociales et les sessions. Ajouter une récupération de mot de passe imposerait de maintenir aussi la sécurité de ce parcours et un service d'envoi d'e-mails. Le propriétaire a décidé le 2026-10-17 de confier l'authentification à Amazon Cognito plutôt que d'ajouter ce parcours à l'authentification maison.

DÉCISION PROPRIÉTAIRE : Cognito User Pools devient le service d'authentification des utilisateurs. Le choix du fournisseur est acté ; aucun benchmark de fournisseurs ni prérequis de sélection d'un service d'e-mails n'est demandé. La configuration initiale utilise l'envoi Cognito par défaut (COGNITO_DEFAULT), avec l'adresse d'expédition AWS, sans domaine d'expédition personnalisé ni SES propre à Deepn. La documentation AWS consultée le 2026-10-17 indique une limite non augmentable de 50 e-mails/jour par compte AWS avec ce mode, tous messages concernés confondus. Revalider ce quota lors de l'exécution et le documenter ; un passage ultérieur à SES serait une décision distincte, pas un prérequis de cette tâche.

Périmètre : inscription e-mail/mot de passe et vérification de l'adresse, connexion e-mail/mot de passe, Google et Apple, récupération de mot de passe, sessions et déconnexion sur mobile et web, autorisation API et suppression de l'identité lors de la suppression du compte. Cognito gère les justificatifs d'authentification ; les profils, préférences, bibliothèques et droits métier restent dans les services applicatifs existants. Inclure les adaptations nécessaires pour que l'appairage, la révocation et la portée limitée de l'extension navigateur restent cohérents après la bascule. La portée métier de l'extension ne doit pas être élargie.

La récupération doit utiliser le parcours Cognito, y compris son code envoyé par e-mail, sans imposer un lien de réinitialisation maison. Les écrans d'entrée et de retour doivent être utilisables sur mobile et web. Les états, erreurs et traductions font partie du livrable.

Bascule de pré-production : remplacer puis supprimer l'authentification maison devenue inutile, sans double authentification, fallback, synchronisation de mots de passe ou migration de compatibilité. Ne pas importer les anciens mots de passe. Les fixtures explicitement protégées par AGENTS.md restent préservées ; décrire le rattachement des identités aux données applicatives et les éventuelles actions ponctuelles du propriétaire, sans purge globale ni destruction des bibliothèques. Ne pas journaliser ou consigner de secrets ni d'identités de comptes réelles. Aucune refonte de la facturation ni des fonctions hors périmètre.

Validation propriétaire après fusion et déploiement : appliquer la configuration d'infrastructure et les secrets/réglages externes documentés, puis vérifier sur appareil et navigateur l'inscription, la réception des e-mails, les connexions e-mail/Google/Apple, la récupération, les sessions, l'appairage de l'extension et la suppression de compte. Ces opérations déployées ne sont pas des critères bloquants pour l'agent travaillant dans son worktree. Respecter les règles de packages/core, la parité web et l'absence de tests automatisés sans demande explicite.

CLARIFICATION PROPRIÉTAIRE (2026-10-17) : conserver les connexions Google et Apple ainsi que leurs boutons sur mobile et web. La transition vers Cognito ne signifie ni retirer ces fournisseurs ni imposer un compte e-mail/mot de passe. Les parcours sociaux restent accessibles ; aucun mot de passe local n'est demandé ou créé pour un compte exclusivement social. La récupération de mot de passe concerne seulement les comptes e-mail/mot de passe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La configuration Cognito nécessaire aux environnements concernés est décrite dans Terraform : pool, clients, fournisseurs Google/Apple, retours mobile/web et permissions ; les réglages externes et secrets à fournir sont documentés sans valeur sensible.
- [x] #2 Les parcours mobile et web sont câblés à Cognito pour l’inscription et la vérification d’e-mail, les connexions e-mail/mot de passe et Google/Apple, le renouvellement et la déconnexion ; les protections de stockage et de transport des sessions restent adaptées à chaque plateforme.
- [x] #3 « Mot de passe oublié ? » est accessible sur mobile et web et déclenche le parcours Cognito jusqu’au nouveau mot de passe ; chargement, confirmation, code invalide/expiré, renvoi et erreurs sont gérés et traduits, sans divulguer l’existence du compte ni créer de mot de passe pour un compte exclusivement social.
- [x] #4 L’envoi initial des messages d’authentification utilise COGNITO_DEFAULT avec l’adresse AWS, sans identité SES propre ni domaine d’expédition personnalisé ; le quota actuel et ses conséquences pour inscriptions et récupération sont explicités dans la documentation.
- [x] #5 L’API est câblée à la validation des justificatifs Cognito (signature, émetteur, expiration, client et type de jeton attendus) et à leur rattachement sûr aux profils applicatifs ; les contrôles de propriété et de droits restent en place, sans rapprochement sur un e-mail non vérifié.
- [x] #6 L’appairage, la révocation et les restrictions de portée de l’extension sont pris en compte dans le code adapté ; la suppression du compte inclut l’identité Cognito et les sessions concernées en plus des données applicatives prévues par le parcours existant.
- [x] #7 Les anciens chemins de gestion des mots de passe et de sessions utilisateurs remplacés par Cognito, leurs dépendances et leur configuration inutilisées sont supprimés ; aucun fallback d’authentification, double-write ni import de mots de passe historiques n’est ajouté.
- [x] #8 docs/AUTHENTICATION_SETUP.md décrit l’architecture cible, les contrats, la sécurité et les limites de révocation, le rattachement aux profils et fixtures protégées, la bascule, les configurations externes et la validation propriétaire après déploiement ; les autres documents affectés sont alignés.
- [x] #9 Les vérifications statiques applicables passent : ruff/mypy backend, typecheck/lint mobile, web et packages/core si modifié, ainsi que format/validate Terraform ; toute modification mobile comporte la ligne Web requise dans le commit de livraison.
- [x] #10 Les boutons « Continuer avec Google » et « Continuer avec Apple » et leurs parcours restent disponibles sur mobile et web ; la transition Cognito ne force ni inscription e-mail/mot de passe ni création d’un mot de passe local pour les comptes exclusivement sociaux.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Décrire Cognito dans le module Terraform commun : pool, clients public mobile/web, Google/Apple, retours exacts, rotation et révocation ; envoi COGNITO_DEFAULT et IAM limité.
2. Remplacer les mots de passe, JWT et sessions utilisateurs maison par les opérations Cognito ; valider les access tokens RS256 et GetUser, rattacher les profils par sub (jamais par e-mail), permettre un rattachement administratif explicite des fixtures protégées. Conserver uniquement les autorisations propres aux extensions et leur portée.
3. Câbler inscription avec vérification, récupération par code et flux Google/Apple Cognito avec PKCE sur mobile et web ; partager contrats et messages, conserver les transports sécurisés et traduire tous les états.
4. Intégrer la suppression Cognito au parcours de suppression de compte, enlever les anciens chemins et configurations inutilisés et documenter la bascule et les opérations propriétaire après déploiement.
5. Exécuter les vérifications statiques backend/mobile/web/core et Terraform sans tests automatisés, vérifier le diff et les secrets, committer avec Web: done puis mettre à jour le backlog.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bascule de code réalisée : Cognito possède les justificatifs et sessions utilisateurs ; Google/Apple utilisent le flux autorisation + PKCE sur mobile/web. Profils liés par sub, rattachement administratif explicite des fixtures protégées, aucune fusion par e-mail. Seules les autorisations d’extension restent en DynamoDB, opaques/hachées et limitées aux quatre routes existantes. Suppression Cognito ajoutée à la purge de compte ; anciens JWT, mots de passe et SDK natifs supprimés.

Vérifications exécutées sans tests automatisés : ruff backend, mypy (205 fichiers), uv lock --check ; typecheck/lint mobile, web et packages/core ; build web ; terraform fmt -check et validate sur module platform et racines dev/staging/prod. Succès. Avertissement lint préexistant dans purchaseService.ts, hors périmètre ; build web signale un chunk > 1000 kB. Aucun apply ni déploiement effectué.

Quota Cognito_DEFAULT revérifié dans la documentation AWS le 2026-10-17 : 50 e-mails/jour/compte, non augmentable, remise à zéro 09:00 UTC. Le runbook décrit les secrets et retours Google/Apple, le rattachement de Commonplace book sans suppression de bibliothèque, le nettoyage des seules anciennes sessions et la validation propriétaire après déploiement. Les fichiers .env.example racine/mobile/web ont été alignés ; aucun .env réel n’a été lu ni modifié.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Authentification des utilisateurs remplacée par Amazon Cognito sur API, mobile et web : inscription avec vérification d’adresse, récupération par code, Google/Apple avec PKCE, refresh rotatif, révocation et suppression de l’identité. Profils rattachés au sub, sans fusion par e-mail ; attachement administratif explicite des fixtures protégées. Les autorisations d’extension restent indépendantes, hachées et limitées aux quatre routes autorisées. Anciens mots de passe/JWT/sessions maison, endpoints sociaux natifs et modules remplacés supprimés. Terraform commun et trois racines configurés, messages traduits dans les onze langues, runbook de bascule et .env.example alignés. Vérification : ruff/mypy backend (205 fichiers), uv lock --check, typecheck/lint mobile/web/core, build web, terraform fmt et validate module/dev/staging/prod. Aucun test automatisé exécuté. Un avertissement lint préexistant hors périmètre et l’avertissement de taille du bundle web restent signalés. Après fusion : fournir les secrets de fédération, appliquer Terraform, rattacher les fixtures, déployer API/stream/web et reconstruire les binaires ; les contrôles sur AWS et appareils appartiennent à la validation propriétaire décrite dans le runbook.
<!-- SECTION:FINAL_SUMMARY:END -->
