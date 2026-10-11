---
id: TASK-425
title: >-
  Créer dans le backlog les tâches dispatchables de l'app web et de l'extension
  découpées par le benchmark validé (task-424)
status: Done
assignee: []
created_date: '2026-10-04 16:22'
updated_date: '2026-10-11 16:00'
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
type: task
ordinal: 32000
dispatchable: true
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
- [x] #1 Les tâches du §3.2 de complement-response-2026-10-11.md existent dans backlog/tasks/, créées via l'outillage Backlog.md, chacune avec le périmètre et les AC du §3.3 et un renvoi au Decision du README task-424 et au complément
- [x] #2 Les dépendances du §3.4 sont renseignées dans le front-matter en identifiants réels, prérequis task-443 et task-445 compris, et aucune tâche n'est dispatchable avant ce dont elle dépend
- [x] #3 Chaque tâche créée porte des labels qui la routent vers l'agent voulu selon la table de .claude/agents/backlog-dispatcher.md ; B-01 et B-02 sont des paires benchmark plus implémentation selon CLAUDE.md, et B-01 porte dispatchable: false dans son front-matter
- [x] #4 Aucun AC d'aucune tâche créée ne dépend d'un déploiement, n'a la forme d'un test ou n'exige une suite Maestro verte ; les vérifications déployées sont des notes à l'owner
- [x] #5 Les points du Decision sont restitués dans les tâches qui les portent : page d'installation sous 900 px sans lien vers la version ordinateur, jeton d'extension à 90 jours d'inactivité et plafond d'un an, façade du flux sans domaine personnalisé, mise à jour des textes légaux dans W-02, aucun paiement web hors B-01i
- [x] #6 Le diff de cette tâche ne contient que des fichiers de backlog ; la note de fin liste les identifiants créés, leur titre, l'agent visé, le graphe de dépendances et l'ordre de dispatch recommandé
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Les 22 tâches du §3 de `complement-response-2026-10-11.md` sont créées par l'outillage Backlog.md, de task-471 à task-492. Chacune renvoie au `Decision` du README task-424 et au complément. Le diff ne contient que des fichiers de `backlog/tasks/`.

### Tâches créées

| ID complément | Tâche | Titre | Agent |
|---|---|---|---|
| W-01 | task-471 | Héberger app. et www. sur S3 et CloudFront, dans Terraform | task-feature |
| W-02 | task-472 | Générer les pages statiques de www. : pages légales à jour, installation de l'extension, .well-known | task-feature |
| W-03 | task-473 | Session web par cookie sur api., lignée navigateur plafonnée, CORS de l'API HTTP restreint | task-feature |
| W-04 | task-474 | CORS de la façade de streaming du chat | task-feature |
| W-05 | task-475 | Socle de l'app web : projet, barre, connexion, i18n, thème, page d'installation sous 900 px | task-feature |
| W-06 | task-476 | Accueil et Bibliothèque | task-feature |
| W-07 | task-477 | Page média en trois volets : Lecture et IA | task-feature |
| W-08 | task-478 | Page dossier en trois volets | task-feature |
| W-09 | task-479 | Ajouter une source (lien, fichier, dépôt, collage) et la ranger | task-feature |
| W-10 | task-480 | Volet Discussion : le chat web en flux | task-feature |
| W-11 | task-481 | Digest : deux périodes et lecture d'une période | task-feature |
| W-12 | task-482 | Revue des non classés au clavier | task-feature |
| W-13 | task-483 | Recherche plein texte dans la barre | task-feature |
| W-14 | task-484 | Mon compte en barre latérale de réglages | task-feature |
| X-01 | task-485 | Jeton propre à l'extension, avec code de secours | task-feature |
| X-02 | task-486 | Adresse d'origine d'une sélection (`ingest-shared-content`) | task-feature |
| X-03 | task-487 | Extension Chrome et Edge, appairage en un clic | task-feature |
| X-04 | task-488 | Extension Firefox et archive de sources AMO | task-feature |
| B-01 | task-489 | Benchmark du moteur de paiement web (`dispatchable: false`, à ouvrir en fin de bêta) | task-research |
| B-01i | task-491 | Implémenter le paiement web selon le benchmark validé (task-489) | task-feature |
| B-02 | task-490 | Benchmark des pages payantes ou derrière une connexion | task-research |
| B-02i | task-492 | Implémenter l'enregistrement des pages payantes selon le benchmark validé (task-490) | task-feature |

Aucune tâche ne porte `mobile` : aucune ne modifie `mobile/`. Toutes portent `dispatchable: true` dans leur front-matter, sauf task-489 qui porte `dispatchable: false` (vérifié après création).

### Graphe de dépendances

    task-443 (owner) ─> task-445 ─┬─> 471 ─> 472 (+ task-443)
                                  └─> 473 ─┬─> 475 ─┬─> 476 ─┬─> 479 ─> 482
                                           │        │        └─────────> 482
                                           │        ├─> 477 ─┬─> 478 ─┐
                                           │        │        ├─> 481  ├─> 480 <─ 474 <─ task-443
                                           │        │        └────────┘
                                           │        ├─> 483
                                           │        └─> 484 ─┐
                                           └─> 485 ──────────┴─> 487 <─ 486 ;  487 ─> 488
    489 (verrouillée, fin de bêta) ─> 491 (+ 484)      490 ─> 492 (+ 487)

### Ordre de dispatch recommandé

1. **486** et **490** maintenant : elles ne dépendent de rien.
2. Une fois task-443 faite par l'owner : **task-445** et **474**.
3. **471** et **473** en parallèle, puis **472**.
4. **475**, puis **485**.
5. **476**, **477**, **483** et **484** en parallèle.
6. **478**, **479** et **481**, puis **480** et **482**.
7. **487**, puis **488**.
8. **489** à la fin de la bêta (retirer le verrou), puis **491**.

Le chemin critique est **task-443**, qui revient à l'owner.

### Points déduits, à valider par l'owner

Aucune source ne tranche ces points :

1. **`parseSseBlock` tire Expo** (task-480). `mobile/src/services/chatService.ts` importe `expo/fetch` et `expo-crypto` en tête de fichier. L'importer par l'alias, comme le prévoit le complément, mettrait donc des modules Expo dans le bundle web. task-480 interdit de modifier `mobile/` et laisse à l'implémenteur le choix entre résoudre ces imports côté Vite et écrire un analyseur propre au web. L'autre voie serait une petite tâche `mobile` qui sort la fonction dans un module pur.
2. **L'appairage dans l'app web** est livré par task-487 (X-03), dans le volet Compte › Extension que pose task-484 (W-14). C'est la lecture de « la ligne Extension porte l'appairage (X-03) ».
3. **Les libellés propres au web** vivent dans les catalogues de `web/` (11 langues), pour ne pas modifier `mobile/`.
4. **Durées du jeton d'extension** : task-485 applique celles du `Decision` (90 jours d'inactivité, un an au plus) et non « à l'implémentation » comme le disait le §7.
5. **Priorités** : medium partout, sauf task-489 et task-491 en low (fin de bêta).

### Note à l'owner

Rien n'est implémenté. Sans task-443, seules task-486 et task-490 peuvent partir.
<!-- SECTION:FINAL_SUMMARY:END -->
