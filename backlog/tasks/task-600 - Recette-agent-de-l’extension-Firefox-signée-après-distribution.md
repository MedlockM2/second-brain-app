---
id: TASK-600
title: Recette agent de l’extension Firefox signée après distribution
status: To Do
assignee:
  - agent
created_date: '2026-11-04 19:27'
updated_date: '2026-11-04 19:30'
labels:
  - web
  - extension
  - v1-launch
  - agent
  - recette
dependencies:
  - TASK-593
  - TASK-598
  - TASK-601
references:
  - extension/README.md
  - web/src/pages/AccountPage.tsx
  - TASK-601
priority: high
type: task
ordinal: 207000
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

Contrôler le paquet Firefox signé et disponible depuis le canal fourni par TASK-593, après la recette de développement TASK-598. Vérifier le consentement de collecte affiché et l’appairage par code depuis la web app, sauvegardes URL/sélection avec origine/dossier, refus et erreurs, révocation, déconnexion et ré-appairage. Examiner le renouvellement et la conservation de session après redémarrage sur cette installation signée, ce que le chargement temporaire ne permet pas de conclure. Aucun appairage externe Chromium n’est promis à Firefox. Les opérations AMO, signature/soumission et dossier de sources restent dans TASK-593 ; cette recette n’y intervient pas.

Livrable : docs/validation/extension-firefox-distribuee/README.md. Le compte rendu de publication de la dépendance fournit les versions et liens publics à contrôler ; la présence d’un ZIP local ne prouve pas une distribution. Si la review n’a pas encore rendu le paquet disponible, documenter ce prérequis et ne pas annoncer cette recette exécutée.

Contraintes : aucun nouveau test automatisé, secret ni identité de compte dans le dépôt. Respecter les décisions de périmètre de TASK-424 et TASK-490 : URL ou sélection, sans capture intégrale de page privée/payante.

Prérequis de capacité : consulter TASK-601 avant exécution et employer la session/runtime équipée qui y est consignée. Un dispatch vers un worker sans contrôle navigateur/ordinateur n’est pas une recette exécutée ; demander le lancement dans l’environnement autorisé approprié, poursuivre les contrôles indépendants possibles et laisser les parcours UI non réalisés explicitement non vérifiés. La désactivation du navigateur lors d’un ancien audit ne prouve pas son état au début de ce run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le rapport identifie les versions installées depuis les canaux effectivement distribués, les liens publics et les navigateurs/OS couverts ; un chargement de développement n’est pas présenté comme une installation distribuée.
- [ ] #2 Le compte rendu décrit appairage, sauvegarde page/sélection avec URL d’origine et dossier, refus, session après redémarrage, révocation et ré-appairage avec observations ou limites explicites.
- [ ] #3 Le rapport décrit le contrôle navigateur/ordinateur effectivement utilisé, le préflight des accès, les versions et la révision réellement servie ; il distingue les constats UI des contrôles API/AWS complémentaires et des simples contrôles statiques.
- [ ] #4 La matrice scénario/navigateur fournit résultats, preuves expurgées, cas non vérifiés et demandes ponctuelles d’intervention ; les anomalies sont reliées à leurs tâches et la conclusion technique ne se substitue pas au go/no-go propriétaire.
<!-- AC:END -->
