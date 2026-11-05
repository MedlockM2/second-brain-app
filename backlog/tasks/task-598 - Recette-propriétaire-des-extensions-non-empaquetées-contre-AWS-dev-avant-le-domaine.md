---
id: TASK-598
title: Recette agent des extensions non empaquetées contre AWS dev avant le domaine
status: To Do
assignee:
  - agent
created_date: '2026-11-04 19:17'
updated_date: '2026-11-04 19:30'
labels:
  - web
  - v1-launch
  - release
  - extension
  - agent
  - recette
dependencies:
  - TASK-487
  - TASK-488
  - TASK-594
  - TASK-595
  - TASK-601
references:
  - extension/README.md
  - web/README.md
  - media_summarizer/api/endpoints/extension_tokens.py
  - TASK-601
priority: high
type: task
ordinal: 205000
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

Les tâches TASK-592/593 portent la publication et les tâches TASK-599/TASK-600 la vérification des extensions distribuées ; leur dépendance à la web app publique ne doit pas empêcher de vérifier les parcours de développement avant l’achat du domaine. L’extension possède son propre grant : après appairage, elle peut appeler l’API AWS dev indépendamment de la persistance du cookie de la web app locale.

Agent de recette : charger le build non empaqueté dans Chrome/Edge et la cible temporaire Firefox ; utiliser les véritables origines dev/locales et l’ID de développement Chromium dans la configuration web locale, sans les publier. Depuis la web app locale connectée, vérifier appairage externe Chromium et code de secours Firefox/autre profil ; code expiré, erroné ou déjà utilisé ; sauvegarde de page et de sélection avec URL d’origine/dossier ; état sans réseau, budget épuisé et fournisseur suspendu ; reprise explicite ; redémarrage du navigateur, renouvellement, révocation depuis Mon compte, déconnexion et ré-appairage ; absence de bibliothèque d’un ancien compte après nouvelle liaison. Ne pas modifier la configuration financière globale pour provoquer un refus : qualifier les limites et utiliser les fixtures dédiées autorisées ; si elles ne sont pas disponibles, demander uniquement ce prérequis.

L’accès navigateur était désactivé pendant l’audit du 2026-11-04 : aucun de ces parcours n’est déclaré exécuté. Le refresh web local reste limité par SameSite=Strict ; distinguer cette limite de la session d’extension. Firefox temporaire disparaît au redémarrage : consigner ce que ce mode permet réellement d’observer et réserver les cas nécessitant signature à TASK-600. Les ZIP dev ne sont pas les paquets à soumettre. Aucun compte, code d’appairage, token, contenu personnel ni dump .env dans le rapport. Cette tâche ne soumet ni n’achète rien et ne remplace pas la recette après distribution.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.

Le propriétaire autorise pour cette recette le lancement de la web app locale et le chargement des paquets de développement dans le navigateur contrôlé, exclusivement contre AWS dev. Préparer la configuration locale publique et relever l’ID de développement sans achat de domaine ; cette autorisation ne concerne ni un backend local ni la publication d’un paquet. Le chargement effectif reste soumis aux permissions requises par l’outil utilisé.

Livrable : docs/validation/task-598-extension-dev/README.md. Les observations pré-domaine et leurs limites sont transmises aux recettes après distribution TASK-599 et TASK-600.

Prérequis de capacité : consulter TASK-601 avant exécution et employer la session/runtime équipée qui y est consignée. Un dispatch vers un worker sans contrôle navigateur/ordinateur n’est pas une recette exécutée ; demander le lancement dans l’environnement autorisé approprié, poursuivre les contrôles indépendants possibles et laisser les parcours UI non réalisés explicitement non vérifiés. La désactivation du navigateur lors d’un ancien audit ne prouve pas son état au début de ce run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le rapport identifie révisions, navigateurs/modes de chargement et environnement AWS dev, avec appairage, sauvegardes et observations réellement réalisées avant domaine, sans confondre celles-ci avec une publication.
- [ ] #2 Les constats couvrent session extension, refus/erreurs, code de secours, changement de compte et révocation, ou motivent explicitement les cas non vérifiés et les limites du chargement temporaire Firefox/local web.
- [ ] #3 Chaque anomalie bloquante est reliée à une tâche agent ; les cas réservés à la validation des paquets distribués sont transmis à TASK-599/TASK-600.
- [ ] #4 Le rapport décrit le contrôle navigateur/ordinateur effectivement utilisé, le préflight des accès, les versions et la révision réellement servie ; il distingue les constats UI des contrôles API/AWS complémentaires et des simples contrôles statiques.
- [ ] #5 La matrice scénario/navigateur fournit résultats, preuves expurgées, cas non vérifiés et demandes ponctuelles d’intervention ; les anomalies sont reliées à leurs tâches et la conclusion technique ne se substitue pas au go/no-go propriétaire.
<!-- AC:END -->
