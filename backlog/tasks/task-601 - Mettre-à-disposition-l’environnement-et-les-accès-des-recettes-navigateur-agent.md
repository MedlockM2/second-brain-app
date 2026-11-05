---
id: TASK-601
title: >-
  Mettre à disposition l’environnement et les accès des recettes navigateur
  agent
status: To Do
assignee:
  - owner
created_date: '2026-11-04 19:29'
labels:
  - web
  - extension
  - v1-launch
  - owner-only
dependencies: []
references:
  - .claude/agents/task-feature.md
  - .claude/agents/backlog-dispatcher.md
priority: high
type: task
ordinal: 208000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : propriétaire — rendre disponibles l’environnement de contrôle et les accès/consentements initiaux qui nécessitent son autorisation. Les agents effectuent ensuite eux-mêmes les recettes TASK-440.1 à TASK-440.4, TASK-598, TASK-599 et TASK-600. Tâche de prérequis opérationnel verrouillée pour le dispatcher (dispatchable: false), sans transfert des vérifications fonctionnelles au propriétaire.

Le contrôle navigateur a été signalé désactivé pendant l’audit du 2026-11-04. De plus, les agents task-feature/task-tooling actuellement déclarés dans .claude/agents n’exposent que Read/Edit/Write/Grep/Glob/Bash ; rendre une tâche dispatchable ne lui donne pas automatiquement les outils de navigateur/ordinateur. Fournir une session agent effectivement équipée et autorisée pour les surfaces à contrôler (web app, popup/menu d’extension et chargement du paquet), et documenter comment y lancer les recettes. Ne pas supposer que le dispatcher générique apporte cette capacité. Il n’est demandé ici ni de modifier .claude/, ni d’installer un nouveau harness de tests ou d’acheter un service.

Utiliser les outils déjà disponibles et autorisés dans la session retenue ; activer/configurer les autorisations navigateur/ordinateur et le profil de recette si nécessaire. Rendre accessibles les comptes/fixtures de test et leurs modalités de récupération hors dépôt ; préciser ce qui peut être créé, modifié ou supprimé et les limites des appels fournisseurs. Les identifiants, mots de passe, tokens et codes ne sont pas consignés. Le backend cible reste AWS dev ; ce prérequis n’achète pas le domaine et ne déploie ni backend ni web app.

La fiche d’environnement identifie les navigateurs réellement pilotables, les surfaces d’extension accessibles, les prérequis manquants pour les autres navigateurs et le canal d’intervention ponctuelle pour connexion, CAPTCHA ou autorisation. Elle distingue ces interventions initiales des recettes courantes que l’agent exécutera seul. Le contrôle d’extensions doit être vérifié concrètement : un outil limité aux pages DOM ne doit pas être annoncé capable de piloter leur popup ou menu contextuel.

Livrable : docs/validation/environnement-recette-agent/README.md, expurgé de toute identité de compte et de tout secret. Aucune vérification fonctionnelle du produit n’est déclarée réalisée par la seule préparation de cet environnement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La fiche indique la session/runtime équipé retenu, les outils réellement accessibles et le mode de lancement des recettes ; elle distingue cette exécution du worker générique sans contrôle navigateur.
- [ ] #2 Les navigateurs et surfaces web/extension effectivement pilotables, profil de recette et permissions disponibles sont décrits avec les limites explicites ; aucun contrôle désactivé n’est contourné.
- [ ] #3 Les modalités d’accès hors dépôt aux comptes/fixtures autorisés, périmètre des mutations et interventions ponctuelles du propriétaire sont documentées sans valeur d’authentification ni donnée personnelle.
<!-- AC:END -->
