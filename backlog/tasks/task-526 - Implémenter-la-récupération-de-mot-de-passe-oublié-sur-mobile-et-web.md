---
id: TASK-526
title: >-
  Confier l’authentification de Deepn à Amazon Cognito et intégrer la
  récupération de mot de passe
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-16 13:55'
updated_date: '2026-10-18 02:29'
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

6. Lors de l’intégration finale, corriger la réclamation du code de secours pour les profils distincts partageant un e-mail : rechercher le code parmi les profils concernés sans les fusionner, conserver la limite de tentatives et consommer le code atomiquement.

7. Suite autorisée par le propriétaire : réutiliser directement les six valeurs d’authentification existantes dans AWS Secrets Manager, retirer le prérequis de secrets GitHub dupliqués, appliquer la configuration Cognito nécessaire et adapter les retours Google/Apple avec les accès disponibles. Préserver les fixtures et documenter précisément les vérifications et tout blocage externe.

8. Suite au signalement d’échec d’inscription web du 2026-10-18, terminer la bascule de release dev : le frontend local appelle déjà Cognito mais /api/auth/oauth/config répond encore 404 sur le backend AWS. Faire déployer les commits prêts via le workflow habituel après le push propriétaire, vérifier la santé, la configuration OAuth publique et la présence des routes d’inscription/confirmation/récupération. Ne pas recopier les données du formulaire ni créer un compte au nom du propriétaire.

9. Correction UX autorisée le 2026-10-18 : après confirmation d’adresse, ouvrir directement la session Cognito puis afficher l’onboarding ou la destination initiale, sur web et mobile. Utiliser la session éphémère renvoyée par ConfirmSignUp avec InitiateAuth USER_AUTH côté serveur (pool dev déjà ESSENTIALS), sans mémoriser le mot de passe ni transporter cette session dans la navigation. Autoriser USER_AUTH dans les clients Terraform ; faire répondre /confirm-registration avec le contrat de session existant, consommé par les couches de session web/mobile. Supprimer l’état de succès de vérification et ses textes obsolètes, conserver les erreurs de code et le renvoi, préserver la destination web demandée et le parcours distinct de récupération. Contrôles statiques backend/mobile/web/core et Terraform sans tests automatisés, commit Web: done, puis push et déploiement dev selon l’autorisation déjà donnée, et vérifications publiques sans créer de compte au nom du propriétaire.

10. Ajustement du point 9 avant implémentation, après lecture des prérequis AWS : USER_AUTH avec Session de confirmation ne supprime les challenges que pour un utilisateur éligible à l’OTP, alors que le pool actuel autorise PASSWORD uniquement. Le correctif utilisera donc la connexion USER_PASSWORD_AUTH existante, sans modifier les modes d’authentification ni Terraform : conserver le formulaire d’origine monté pendant la saisie du code, passer les justificatifs uniquement comme props en mémoire aux composants de vérification, confirmer le code puis ouvrir la session via les couches de session existantes. Aucun mot de passe dans l’URL, l’historique, un stockage web ou un cache global. Conserver une étape de connexion inline uniquement si l’ouverture de session échoue après confirmation, pour permettre de réessayer sans rejouer le code déjà consommé ; une reprise directe de vérification sans formulaire demande le mot de passe dans ce même formulaire. Préserver la destination web initiale, le gate mobile POST_AUTH_ENTRY_POINT et la récupération distincte. Aucun changement backend ni apply nécessaire.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bascule de code réalisée : Cognito possède les justificatifs et sessions utilisateurs ; Google/Apple utilisent le flux autorisation + PKCE sur mobile/web. Profils liés par sub, rattachement administratif explicite des fixtures protégées, aucune fusion par e-mail. Seules les autorisations d’extension restent en DynamoDB, opaques/hachées et limitées aux quatre routes existantes. Suppression Cognito ajoutée à la purge de compte ; anciens JWT, mots de passe et SDK natifs supprimés.

Vérifications exécutées sans tests automatisés : ruff backend, mypy (205 fichiers), uv lock --check ; typecheck/lint mobile, web et packages/core ; build web ; terraform fmt -check et validate sur module platform et racines dev/staging/prod. Succès. Avertissement lint préexistant dans purchaseService.ts, hors périmètre ; build web signale un chunk > 1000 kB. Aucun apply ni déploiement effectué.

Quota Cognito_DEFAULT revérifié dans la documentation AWS le 2026-10-17 : 50 e-mails/jour/compte, non augmentable, remise à zéro 09:00 UTC. Le runbook décrit les secrets et retours Google/Apple, le rattachement de Commonplace book sans suppression de bibliothèque, le nettoyage des seules anciennes sessions et la validation propriétaire après déploiement. Les fichiers .env.example racine/mobile/web ont été alignés ; aucun .env réel n’a été lu ni modifié.

Livraison commitée dans 73c3a653 (Web: done). Le workflow Terraform Dev reçoit désormais les deux configurations de fédération par secrets GitHub Actions et refuse l’apply si elles manquent. Syntaxe YAML des workflows vérifiée. Mise à Done après le commit de résolution ; aucune validation déployée déclarée comme exécutée.

Revue finale : le secours d’appairage choisissait le premier profil de l’index e-mail. Cognito peut conserver des identités distinctes avec la même adresse ; le code doit identifier son propriétaire, jamais l’ordre des résultats de l’index. Correction incluse dans le périmètre de cohérence de l’extension (AC6).

Correction finale AC6 : le code de secours recherche tous les profils concernés par l’adresse, retient uniquement le code qui désigne son propriétaire et refuse une collision plutôt que de choisir arbitrairement. Consommation et compteur d’échecs atomiques DynamoDB, sans recréer un code déjà consommé. ruff/mypy backend et diff --check passent après cette correction ; aucun test automatisé ajouté ni exécuté.

Correction d’intégration commitée dans 5c734a3d ; ruff et mypy repassés avec succès (205 fichiers). Les vérifications TypeScript et de parité web ont également passé sur main après la première fusion. Aucun changement de configuration externe ni de données AWS n’a été effectué.

Les six valeurs Google/Apple nécessaires sont présentes dans les secrets runtime de dev et prod ; présence et format vérifiés sans en afficher les valeurs. Le propriétaire demande de réaliser le raccordement et les adaptations des retours fournisseurs. Aucun identifiant ni secret n’est recopié dans le backlog.

Suite de raccordement livrée dans b4f029f7 et 159fda7a, intégrée localement à main. Les secrets GitHub de fédération dupliqués ne sont plus nécessaires : scripts/terraform_with_cognito.py charge en mémoire les six champs existants du secret runtime AWS, les transmet comme variables Terraform sensibles, neutralise le debug et impose umask 077. Les variables racines dev/prod exigent désormais les fournisseurs pour éviter une suppression involontaire ; le workflow utilise le wrapper et se déclenche aussi sur ses modifications.

Apply réel dev exécuté avec le profil existant : 7 créations, 19 mises à jour, aucune suppression. Pool Cognito, domaine, fournisseurs Google/Apple et clients mobile/web créés. Lectures AWS : paramètres fournisseurs comparés en mémoire à la source, retours exacts et mécanismes de rotation/révocation confirmés, attribut de rattachement des fixtures non inscriptible par les apps. Aucun secret affiché ni recopié ; aucune donnée utilisateur ni fixture modifiée. Aucune image applicative, aucun web ni binaire mobile déployé ; prod inchangé.

Client Google Web existant enregistré dans la console avec le domaine Cognito dev comme origine et /oauth2/idpresponse comme retour, en remplacement de l’ancien callback API ; succès confirmé par la console. Les deux autorisations Cognito renvoient HTTP 302 vers les fournisseurs avec le retour attendu. Ce contrôle de raccordement ne constitue pas une connexion utilisateur de bout en bout.

Validation de cette suite : ruff du wrapper, syntaxe YAML et déclencheur du workflow, terraform fmt -check et validate dev réussis, diff --check et contrôle des ajouts sensibles réussis. Plan réel final : aucune création/suppression ; seule la clé privée Apple, en écriture seule et jamais renvoyée par AWS, est réappliquée. Seules les métadonnées de découverte AWS sont ignorées ; une rotation de clé reste appliquée. Plans sauvegardés privés puis supprimés. Aucun test automatisé ajouté ni exécuté.

Reste à réaliser dans Apple Developer : enregistrer le domaine et le retour Cognito sur le Services ID existant. La console attend la validation de connexion par clé d’accès du propriétaire ; demande de reprise envoyée dans cette session, onglet conservé ouvert. La tâche reste In Progress jusqu’à ce réglage autorisé ; les AC de livraison de code restent satisfaits. Les mentions historiques de secrets GitHub requis et d’absence d’apply sont remplacées par le présent résultat.

Diagnostic du 2026-10-18 : API dev saine (HTTP 200), mais GET /api/auth/oauth/config = 404 ; Lambda active avec les variables Cognito attendues et encore l’ancienne image. Le frontend local possède le nouveau parcours, l’API déployée non. Le retour d’erreur du formulaire ne démontre donc pas une panne de Cognito : la release applicative nécessaire à la bascule n’a pas encore été effectuée. Commits prêts sur main local, remote main encore à la version antérieure ; demande de push transmise au propriétaire pour déclencher le workflow dev habituel.

Après accord explicite du propriétaire, push main réalisé le 2026-10-18 (53073045), puis déploiement dev terminé avec succès : https://github.com/MedlockM2/second-brain-app/actions/runs/39088195368 ; API, chat stream et workers reconstruits et déployés par digest. Terraform dev également vert : https://github.com/MedlockM2/second-brain-app/actions/runs/39088195365. Le backend déployé expose désormais le contrat Cognito : santé 200, configuration OAuth web/mobile 200 avec retours distincts, no-store et Vary attendus, CORS localhost:5173, routes d’inscription/confirmation/récupération présentes dans OpenAPI publié. Aucune inscription exécutée au nom du propriétaire ; les données du formulaire ne sont pas enregistrées dans les notes.

Le premier Main Branch Checks a révélé 16 erreurs ruff préexistantes dans quatre scripts d’outillage (imports et longues lignes). Correction de formatage seule commitée dans d37882a5 ; ruff sur tout le dépôt, mypy sur 205 fichiers et gardes des variables d’environnement/écrivains TTL réussis localement. Le workflow mobile 39088195367 a terminé avec succès et lancé de nouveaux builds internes Android/iOS avec soumission automatique, car les empreintes natives ont changé. Les builds EAS sont distincts du succès du workflow qui les a lancés ; ne pas les déclarer distribués avant leur fin. Prod inchangé. Le réglage du retour Apple dans sa console attend toujours la connexion du propriétaire.

Le propriétaire a confirmé le parcours attendu : inscription → code → connexion automatique → onboarding ou bibliothèque. AWS documente l’échange direct de la Session de ConfirmSignUp via InitiateAuth USER_AUTH ; le pool dev décrit par AWS est déjà ESSENTIALS, MFA OFF. Les sessions de confirmation resteront dans la mémoire de l’appel serveur et ne seront ni journalisées, ni stockées, ni exposées aux clients. Sources : APIReference/API_ConfirmSignUp.html et APIReference/API_InitiateAuth.html dans la documentation officielle Cognito.

La piste ConfirmSignUp Session / USER_AUTH n’est pas retenue : la documentation AWS impose l’éligibilité au facteur OTP pour l’auto-connexion sans challenge ; le pool actuel n’autorise que PASSWORD. La correction reste sur le mode existant et ne change pas l’authentification publique. Le mot de passe vit uniquement dans l’état React du formulaire, détruit lorsque le parcours est quitté. La confirmation et la connexion utilisent les contrats déployés existants.

Correction UX livrée dans e8930411 (Web: done) : inscription et connexion d’un compte non confirmé conservent le formulaire d’origine monté sur web/mobile, puis confirment le code et ouvrent automatiquement la session existante. Le succès de vérification n’est plus un écran d’arrêt ; chargement bref puis onboarding/app. La destination web traverse aussi le choix initial de langue ; mobile utilise POST_AUTH_ENTRY_POINT. Les justificatifs ne vivent que dans l’état React, sans URL, historique, stockage ou cache global ; abandon et perte de focus native les effacent. Une erreur d’ouverture de session après confirmation se réessaie sur place sans réutiliser le code. La récupération reste distincte. Consignes mises à jour dans les onze langues et runbook aligné.

Vérifications de la correction : typecheck/lint web, mobile et packages/core réussis ; un avertissement any préexistant dans purchaseService.ts reste hors périmètre. Diff --check et contrôle des ajouts sensibles réussis. Aucun changement backend/Terraform, aucun nouveau mode de connexion, aucun compte ou envoi d’e-mail initié au nom du propriétaire, aucun test automatisé ajouté ou exécuté. La vérification complète avec le code reçu reste une interaction du propriétaire ; la tâche globale demeure In Progress pour le retour Apple dans sa console.

Après intégration locale : build web réussi (avertissement de taille du chunk préexistant), garde Web: done réussie. Inspection manuelle du web local : consigne de vérification alignée, reprise directe avec e-mail/code/mot de passe et abandon vers la connexion fonctionnel. Aucun formulaire d’inscription ni code utilisateur soumis pendant cette vérification ; aucun test automatisé exécuté.

Push c3f75c48 réalisé après intégration de e8930411. Main Branch Checks vert : https://github.com/MedlockM2/second-brain-app/actions/runs/39090085771. Publication OTA interne Android et iOS réussie, manifeste servi et source maps vérifiés par le workflow : https://github.com/MedlockM2/second-brain-app/actions/runs/39090085773. Les deux binaires internes compilés pendant la release précédente sont FINISHED (Android versionCode 19, iOS build 15) ; les OTA ciblent leurs empreintes natives. Le web local reçoit les sources mises à jour. Aucun déploiement backend nécessaire à cette correction frontend ; état global In Progress inchangé pour le réglage Apple déjà documenté.
<!-- SECTION:NOTES:END -->
