---
id: TASK-425
title: >-
  Créer dans le backlog les tâches dispatchables de l'app web et de l'extension
  découpées par le benchmark validé (task-424)
status: To Do
assignee: []
created_date: '2026-10-04 16:22'
updated_date: '2026-10-11 15:48'
labels:
  - orchestration
  - backlog
  - web
dependencies:
  - TASK-424
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
  - mobile-design-mockups/web_app_owner_direction/README.md
  - >-
    backlog/tasks/task-431 -
    Découper-en-tâches-de-backlog-dispatchables-limplémentation-du-chatbot-retenue-par-le-benchmark-validé-task-430.md
  - .claude/agents/backlog-dispatcher.md
  - AGENTS.md
  - CLAUDE.md
priority: medium
dispatchable: true
type: task
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi cette tâche existe

Le benchmark task-424 est validé : lire `docs/research/task-424-website-and-browser-extension/README.md`, section **Owner Validation**. Son champ `Decision` du 2026-10-11 est la source de vérité. Il renvoie à `complement-response-2026-10-11.md` du même répertoire, qui **prime sur la Recommendation et sur les §8 à §12 du README**. La direction A, Cloudflare, Astro, Stripe via RevenueCat et les lots en jours ne sont pas retenus.

Le complément contient déjà le découpage de l'app web et de l'extension, au §3 : 22 tâches (W-01 à W-14, X-01 à X-04, B-01/B-01i, B-02/B-02i), chacune avec son titre, ses labels, ses dépendances, son périmètre et ses AC, puis un graphe et un ordre de dispatch. **Cette tâche n'écrit aucun code applicatif.** Son livrable est la création de ces tâches dans le backlog, rédigées pour qu'un agent isolé, sans mémoire de cette session, puisse les implémenter.

Cette tâche remplace l'ancienne « implémenter le site web avec paiement Stripe et l'extension ». Le paiement web n'est pas dans le périmètre, conformément au point 3 du `Decision`.

## Ce que le `Decision` fixe et que les tâches créées doivent restituer

- **Interface** : la direction de l'owner, `mobile-design-mockups/web_app_owner_direction/`, dont le `README.md` fait foi écran par écran. Les dossiers n'ont qu'un niveau, et « Déplacer le dossier » n'existe pas. Pas de version téléphone en V1 : sous 900 px, une page invite à installer l'app mobile, sans lien « continuer sur ordinateur ».
- **Hébergement tout AWS, dans Terraform**. task-445 précède le développement de la session web.
- **Jeton de l'extension** (X-01) : lignée `browser_extension` à portée réduite, renouvelée à chaque usage. Il expire après **90 jours sans utilisation**, avec un **plafond absolu d'un an** depuis l'appairage.
- **Façade du flux** : elle garde son URL `execute-api`. Seul le CORS est ajouté (W-04).
- **W-02** met à jour les textes légaux. task-444 reste la relecture et la publication par l'owner.
- **B-01** (paiement web) est créé en `dispatchable: false`, avec la raison « à ouvrir à la fin de la bêta ». B-01i dépend de B-01.

## Règles de rédaction des tâches créées

Celles de `AGENTS.md` et `CLAUDE.md`, rappelées dans task-431 :

- **AC satisfaisables depuis un worktree.** Pas d'« endpoint déployé », pas d'AC en forme de test, pas de suite Maestro. Les contrôles de déploiement vont en note à l'owner.
- **Rien n'est déployé** : aucune compatibilité, aucun double chemin.
- **Une tâche donne une PR relisible**, avec sa documentation et son i18n.
- **Labels** routés selon `.claude/agents/backlog-dispatcher.md`. Une tâche qui modifie `mobile/` porte `mobile`. Aucune tâche d'implémentation ne porte `benchmark`, `pricing`, `product` ou `scoping`.
- **Benchmarks B-01 et B-02** : créés en paire avec leur implémentation, selon la convention de `CLAUDE.md`. L'implémentation reste générique et renvoie au README du benchmark.
- **Dépendances** : celles du §3.4 du complément, en identifiants réels `task-NNN`. Les prérequis existants (task-443, task-444, task-445) sont référencés tels quels.
- **`dispatchable:`** : Backlog.md efface les champs personnalisés à chaque réécriture. Vérifier dans le front-matter, après création, que B-01 porte bien `dispatchable: false`, et le remettre sinon.

## Note à l'owner

Après ce découpage, rien n'est implémenté. Le chemin critique est **task-443**, l'achat du domaine, qui vous revient. Sans lui, seules X-02 et B-02 sont dispatchables.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les tâches du §3.2 de complement-response-2026-10-11.md existent dans backlog/tasks/, créées via l'outillage Backlog.md, chacune avec le périmètre et les AC du §3.3 et un renvoi au Decision du README task-424 et au complément
- [ ] #2 Les dépendances du §3.4 sont renseignées dans le front-matter en identifiants réels, prérequis task-443 et task-445 compris, et aucune tâche n'est dispatchable avant ce dont elle dépend
- [ ] #3 Chaque tâche créée porte des labels qui la routent vers l'agent voulu selon la table de .claude/agents/backlog-dispatcher.md ; B-01 et B-02 sont des paires benchmark plus implémentation selon CLAUDE.md, et B-01 porte dispatchable: false dans son front-matter
- [ ] #4 Aucun AC d'aucune tâche créée ne dépend d'un déploiement, n'a la forme d'un test ou n'exige une suite Maestro verte ; les vérifications déployées sont des notes à l'owner
- [ ] #5 Les points du Decision sont restitués dans les tâches qui les portent : page d'installation sous 900 px sans lien vers la version ordinateur, jeton d'extension à 90 jours d'inactivité et plafond d'un an, façade du flux sans domaine personnalisé, mise à jour des textes légaux dans W-02, aucun paiement web hors B-01i
- [ ] #6 Le diff de cette tâche ne contient que des fichiers de backlog ; la note de fin liste les identifiants créés, leur titre, l'agent visé, le graphe de dépendances et l'ordre de dispatch recommandé
<!-- AC:END -->
