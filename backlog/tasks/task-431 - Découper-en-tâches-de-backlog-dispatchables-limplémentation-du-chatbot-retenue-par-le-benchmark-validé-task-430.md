---
id: TASK-431
title: >-
  Découper en tâches de backlog dispatchables l'implémentation du chatbot
  retenue par le benchmark validé (task-430)
status: To Do
assignee: []
created_date: '2026-10-06 14:43'
labels:
  - orchestration
  - backlog
dependencies:
  - TASK-430
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - AGENTS.md
  - CLAUDE.md
  - .claude/agents/backlog-dispatcher.md
  - docs/BENCHMARK_OWNER_WORKFLOW.md
  - scripts/dispatch_backlog.sh
priority: medium
dispatchable: true
type: task
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi cette tâche existe

Le benchmark `task-430` va recommander une architecture de chatbot conversationnel, et l'owner va trancher. Ce que cette décision produit n'est pas une tâche d'implémentation unique : c'est un chantier qui traverse le backend, le mobile, Terraform, le quota, les prompts et l'i18n. Le dispatcher (`./scripts/dispatch_backlog.sh`) sait lancer plusieurs agents en parallèle sur des tâches bien découpées, mais il ne sait pas découper. Et une tâche fourre-tout produirait une PR que personne ne peut relire.

**Cette tâche n'écrit donc aucun code applicatif.** Son livrable est un **ensemble de tâches de backlog**, découpées, ordonnées et rédigées de telle sorte qu'on puisse lancer le dispatcher dessus et que le chantier s'implémente correctement, agent par agent, sans que l'owner ait à re-cadrer à chaque étape.

## La source de vérité

Lire `docs/research/task-430-chatbot-architecture/README.md`, et en particulier la section **Owner Validation** : le champ `Decision` porte la décision finale de l'owner, qui **peut différer de la recommandation** du benchmark. Si le `Decision` renvoie à des fichiers `complement-response-*.md` du même répertoire, les suivre aussi.

**C'est le `Decision` de l'owner qui fait le périmètre, pas la `Recommendation`.** Si les deux divergent, le découpage suit le `Decision` et le dit explicitement.

L'ordre de construction en tranches que le README propose est le point de départ du découpage, pas une contrainte : si le découpage s'en écarte, dire pourquoi.

## Les règles de rédaction que les tâches créées doivent respecter

Elles sont dans `AGENTS.md` et `CLAUDE.md`, et elles sont impératives parce que chaque tâche sera exécutée par un agent isolé, sans mémoire de cette session.

- **Chaque critère d'acceptation doit être satisfiable par l'agent qui implémentera la tâche**, depuis son worktree, pendant son run. Il ne merge pas, ne pousse pas, et son code n'est pas déployé pendant qu'il travaille. Les trois formes interdites : « l'endpoint déployé répond X », les AC en forme de test unitaire, « la suite Maestro est verte ». Un contrôle de déploiement ou une vérification visuelle qui compte vraiment se met **dans la description, comme note à l'owner**, jamais en AC.
- **Rien n'est déployé : on supprime, on ne migre pas.** Aucune tâche ne doit scoper une couche de compatibilité, un double écrit, une fenêtre de dépréciation, ni justifier de garder quelque chose par les utilisateurs ou les données de production — il n'y en a pas.
- **Les cleanups d'abord.** Si une tâche restructure une forme (un schéma, une convention de nommage, une clé de configuration) et que d'autres la peuplent, la restructuration passe **avant** et les autres en dépendent.
- **Une tâche = une PR relisible en une fois**, avec ses propres AC, et sa documentation et son i18n dans la même tâche — aucun report en « tâche de suivi ».
- Le titre dit le résultat visé sans détail d'implémentation ; la description dit le **pourquoi** et le contexte qu'un agent ne peut pas retrouver dans le code.

## Le routage vers les bons agents

Le dispatcher choisit l'agent d'après les labels, dans l'ordre de la table de `.claude/agents/backlog-dispatcher.md`. Lire cette table avant de poser les labels, parce qu'un label mal choisi envoie une tâche mobile à un agent backend. En particulier : toute tâche qui touche `mobile/` doit porter le label `mobile`, et une tâche qui porte un label de recherche part en recherche même si elle est destinée à être implémentée.

## Si une décision technologique manque encore

Si le découpage fait apparaître un choix non tranché par le benchmark validé — un service externe, une bibliothèque parmi plusieurs, une politique de quota, ou un périmètre dont la forme n'est pas évidente — **ne pas le trancher ici**. Créer une paire de tâches selon la convention de `CLAUDE.md` : une tâche benchmark, et une tâche d'implémentation qui en dépend et qui renvoie à son README sans en préjuger la conclusion.

## Note à l'owner

Après ce découpage, rien n'est implémenté : il reste à commiter les fichiers de backlog créés, puis à lancer `./scripts/dispatch_backlog.sh --max-dispatch N`. Le récapitulatif produit par cette tâche est là pour que l'owner puisse choisir `N` et l'ordre en connaissance de cause.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les tâches de backlog couvrant l'intégralité du périmètre décidé par l'owner dans la section Owner Validation de docs/research/task-430-chatbot-architecture/README.md existent dans backlog/tasks/, créées via l'outillage Backlog.md et non à la main
- [ ] #2 Aucun fichier de code applicatif, de configuration Terraform ou de l'app mobile n'a été modifié par cette tâche : son diff ne contient que des fichiers de backlog et sa propre note de synthèse
- [ ] #3 Chaque tâche créée renvoie dans sa description à docs/research/task-430-chatbot-architecture/README.md comme source de vérité, et restitue le contexte nécessaire à un agent qui n'a aucune mémoire de cette session
- [ ] #4 Chaque tâche créée porte des labels qui la routent vers l'agent voulu selon la table de .claude/agents/backlog-dispatcher.md, et toute tâche touchant mobile/ porte le label mobile
- [ ] #5 Aucun critère d'acceptation d'aucune tâche créée ne prend l'une des trois formes interdites par CLAUDE.md : dépendance à un déploiement, forme de test unitaire ou d'appel in-process sur l'app FastAPI, ou suite Maestro verte
- [ ] #6 Les contrôles de déploiement et les vérifications visuelles mobiles qui comptent apparaissent comme notes à l'owner dans les descriptions, jamais en critère d'acceptation
- [ ] #7 Aucune tâche créée ne scope de couche de compatibilité, de double écrit, de fenêtre de dépréciation ni de repli sur l'ancien comportement, et aucune ne justifie de conserver un artefact par les utilisateurs, les clients ou les données de production
- [ ] #8 Les dépendances entre les tâches créées sont renseignées dans leur front-matter et forment un ordre où aucune tâche n'est dispatchable avant que ce dont elle dépend soit Done, les restructurations précédant les tâches qui peuplent la forme restructurée
- [ ] #9 Chaque tâche créée tient dans une PR relisible en une fois et porte, dans la même tâche, ses attentes de documentation et d'i18n lorsqu'elles s'appliquent, sans report en tâche de suivi
- [ ] #10 Tout choix technologique non tranché par le benchmark validé donne lieu à une paire tâche benchmark plus tâche d'implémentation dépendante selon la convention de CLAUDE.md, l'implémentation renvoyant au README du benchmark sans en préjuger la conclusion
- [ ] #11 La note de fin de tâche liste les identifiants des tâches créées, leur titre, l'agent vers lequel leurs labels les routent, le graphe de dépendances, et l'ordre de dispatch recommandé
- [ ] #12 La note de fin de tâche dit explicitement si le découpage suit la Recommendation du benchmark ou le Decision de l'owner lorsque les deux divergent, et dit où le découpage s'écarte de l'ordre de construction proposé par le README et pourquoi
<!-- AC:END -->
