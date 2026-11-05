---
id: TASK-440.2
title: 'Recette agent web — imports, bibliothèque, lecture, recherche et Digest'
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
  - TASK-587
  - TASK-588
  - TASK-601
references:
  - web/src/media/ingest.ts
  - web/src/pages/LibraryPage.tsx
  - web/src/pages/FolderPage.tsx
  - web/src/pages/DigestPage.tsx
  - TASK-601
parent_task_id: TASK-440
priority: high
type: task
ordinal: 196000
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

La présence des écrans web ne prouve pas le passage des contenus par AWS. Valider les parcours avec le backend dev déployé et la web app configurée, sans backend local, API simulée ni nouvelle suite automatisée. Cette recette alimente TASK-440 ; son contrôle du digest porte l’affichage web et ne remplace pas la validation du déclenchement journalier déjà portée par le parent.

Parcours : import lien, note texte, document/photo, fichier audio ; glisser-déposer et collage hors/dans un champ ; microphone autorisé/refusé, sauvegarde/annulation ; destination dossier ; erreur réseau, format/taille refusés et maintien de la saisie ; traitement en cours puis terminé/échoué. Bibliothèque paginée et dossier au-delà de 100 sources, compteurs et mutations ; revue des non classés et retour depuis Approfondir ; recherche paginée et passage cité ; lecture originale/traduction, tableaux, liens source ; Digest quotidien/hebdomadaire et contenus supprimés. Respecter les fournisseurs et les fonctions déjà disponibles, sans exiger l’artefact podcast encore hors livraison. Employer les comptes et fixtures de recette dédiés disponibles via les accès autorisés, sans migration ni identité suivie ; si leur choix manque, demander seulement ce prérequis.

Contraintes : aucun nouveau test automatisé. Ne pas modifier le sync Spotify, la livraison email, la génération des quiz, Whisper ni la facturation à crédits. Aucun secret, identité de compte ou compte reviewer dans les fichiers suivis. Les contrats restent sous /api/media et /api/artifacts.

Livrable : docs/validation/task-440.2-web-sources/README.md. La mise en service TASK-591 est un prérequis externe : la recette contrôle ce qui est déjà servi, elle ne déploie pas le code de son worktree. Les résultats de ce rapport alimentent TASK-440.

Prérequis de capacité : consulter TASK-601 avant exécution et employer la session/runtime équipée qui y est consignée. Un dispatch vers un worker sans contrôle navigateur/ordinateur n’est pas une recette exécutée ; demander le lancement dans l’environnement autorisé approprié, poursuivre les contrôles indépendants possibles et laisser les parcours UI non réalisés explicitement non vérifiés. La désactivation du navigateur lors d’un ancien audit ne prouve pas son état au début de ce run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le compte rendu décrit imports, upload direct S3, microphone, refus et conservation de la saisie avec environnement, révision et observations ; les cas non réalisables restent explicitement non vérifiés.
- [ ] #2 Le rapport couvre pagination bibliothèque/dossier, actualisation des traitements, dossiers et revue, recherche, lecture/traduction et Digest avec observations ou limites distinctes.
- [ ] #3 Les anomalies bloquantes sont reliées à leurs corrections et le volet reçoit une conclusion technique de validation ou report transmise à TASK-440.
- [ ] #4 Le rapport décrit le contrôle navigateur/ordinateur effectivement utilisé, le préflight des accès, les versions et la révision réellement servie ; il distingue les constats UI des contrôles API/AWS complémentaires et des simples contrôles statiques.
- [ ] #5 La matrice scénario/navigateur fournit résultats, preuves expurgées, cas non vérifiés et demandes ponctuelles d’intervention ; les anomalies sont reliées à leurs tâches et la conclusion technique ne se substitue pas au go/no-go propriétaire.
<!-- AC:END -->
