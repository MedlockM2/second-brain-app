---
id: TASK-440.1
title: 'Recette agent web — authentification, persistance de session et comptes liés'
status: To Do
assignee:
  - agent
created_date: '2026-11-04 19:12'
updated_date: '2026-11-04 19:29'
labels:
  - web
  - v1-launch
  - release
  - agent
  - recette
dependencies:
  - TASK-591
  - TASK-529
  - TASK-530
  - TASK-601
references:
  - web/src/session/sessionStore.ts
  - web/src/session/cognito.ts
  - docs/AUTHENTICATION_SETUP.md
  - TASK-601
parent_task_id: TASK-440
priority: high
type: task
ordinal: 195000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent de recette — exécuter lui-même les parcours avec les outils autorisés de contrôle navigateur/ordinateur, recueillir les constats et livrer le rapport depuis son worktree. Le propriétaire fournit ponctuellement les accès/consentements qu’il ne peut pas déléguer et conserve les décisions de publication et de go/no-go. La recette est dispatchable ; elle n’est pas réservée au propriétaire.

Méthode de vérification autonome demandée par le propriétaire :
- Vérifier en début de run les outils de navigation disponibles, navigateurs/versions, origine de la web app, environnement AWS dev, comptes de recette dédiés et fixtures utilisables. Employer un profil de recette séparé des comptes personnels. Utiliser les mécanismes d’accès autorisés sans copier de credential dans la tâche ni dans le rapport.
- Piloter le vrai navigateur : ouvrir les écrans, cliquer/saisir, parcourir les états et observer le résultat effectif après chaque action. Le contrôle ordinateur est approprié pour les interfaces d’extension, popup et menu contextuel que l’outil de pages web ne sait pas atteindre. Utiliser uniquement les outils autorisés par l’environnement ; ne pas contourner une désactivation du contrôle navigateur.
- Compléter, quand utile, par les API existantes et les lectures AWS autorisées pour confirmer sauvegarde, destination, résultat ou révocation. Un appel API, une lecture du code, un build vert ou une capture isolée ne remplace pas la vérification des interactions d’interface concernées. Le backend reste celui déployé sur AWS, sans FastAPI in-process, backend local ou API simulée.
- Il s’agit d’une recette exploratoire pilotée par l’agent, sans nouvelle suite de tests automatisés, harness ni scripts de tests persistants au dépôt. La tâche ne demande ni merge/push, ni déploiement de sa branche, ni publication store. Vérifier le système déjà mis à disposition par les dépendances, relever sa révision réellement servie et ne pas attribuer à cette révision une correction seulement présente dans le worktree.
- Si un outil, compte, code de connexion, consentement ou action sensible exige une intervention, demander uniquement ce qui manque puis poursuivre les scénarios indépendants. Ne pas acheter, publier, modifier les protections/quotas globaux, injecter de pannes dans les fournisseurs ni supprimer de données non prévues par la recette. Une permission requise par l’outil reste requise. Les comptes/fixtures sacrifiables et le périmètre des mutations sont explicités avant les actions ; les cas irréversibles non autorisés restent à faire confirmer.
- Produire une matrice scénario / navigateur / résultat observé / preuve / anomalie avec statuts vérifié, échec ou non vérifié. Les preuves sont expurgées de données personnelles, credentials, codes d’appairage, payloads et contenus privés avant tout dépôt. Créer ou réutiliser les tâches de correction après recherche, avec reproduction et gravité. Fournir une conclusion technique et les limites ; le go/no-go appartient au propriétaire. Ne jamais cocher comme validé un parcours non exécuté. Si l’absence d’outil ou de prérequis empêche une vérification demandée, laisser son critère non atteint et expliquer la limite ; ne pas clore sur une simple checklist théorique.

Valider les parcours réellement déployés dans un navigateur, sur le domaine de la bêta. Le succès d’un typecheck, les redirections publiques des fournisseurs et une session temporaire sur localhost ne suffisent pas : le refresh HttpOnly SameSite=Strict demande notamment app. et api. sur le même site. TASK-529 et TASK-530 livrent les règles de compte ; TASK-528 livre le domaine et les mécanismes de changement de compte, sans prouver leur fonctionnement final. Cette recette est un volet de TASK-440.

Parcours : inscription/confirmation et renvoi de code ; compte existant et inscription non confirmée ; connexion mot de passe ; Google et Apple ; liaison après preuve des deux identités, annulation et reconnexion ; récupération et refus compte exclusivement social ; session après rechargement, nouvelle fenêtre, expiration/rotation, plusieurs onglets et déconnexion ; changement de compte sans fuite de bibliothèque ni de cache. Consigner navigateur/OS, révision et limites, sans identité ni justificatif. Qualifier les anomalies dans des tâches agent distinctes.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.

Livrable : docs/validation/task-440.1-web-auth/README.md. La mise en service TASK-591 est un prérequis externe : la recette contrôle ce qui est déjà servi, elle ne déploie pas le code de son worktree. Les résultats de ce rapport alimentent TASK-440.

Prérequis de capacité : consulter TASK-601 avant exécution et employer la session/runtime équipée qui y est consignée. Un dispatch vers un worker sans contrôle navigateur/ordinateur n’est pas une recette exécutée ; demander le lancement dans l’environnement autorisé approprié, poursuivre les contrôles indépendants possibles et laisser les parcours UI non réalisés explicitement non vérifiés. La désactivation du navigateur lors d’un ancien audit ne prouve pas son état au début de ce run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le rapport décrit les scénarios de compte, connexion sociale, liaison et récupération avec observations et éventuels cas non vérifiés ; aucun compte reviewer ni jeton n’est enregistré.
- [ ] #2 Le rapport couvre la session après rechargement, rotation, plusieurs onglets, déconnexion et changement de compte sur le domaine effectif, et distingue les limites localhost des anomalies du produit.
- [ ] #3 Chaque anomalie bloquante est reliée à une tâche de correction ; le rapport fournit une conclusion technique sur ce volet web à TASK-440.
- [ ] #4 Le rapport décrit le contrôle navigateur/ordinateur effectivement utilisé, le préflight des accès, les versions et la révision réellement servie ; il distingue les constats UI des contrôles API/AWS complémentaires et des simples contrôles statiques.
- [ ] #5 La matrice scénario/navigateur fournit résultats, preuves expurgées, cas non vérifiés et demandes ponctuelles d’intervention ; les anomalies sont reliées à leurs tâches et la conclusion technique ne se substitue pas au go/no-go propriétaire.
<!-- AC:END -->
