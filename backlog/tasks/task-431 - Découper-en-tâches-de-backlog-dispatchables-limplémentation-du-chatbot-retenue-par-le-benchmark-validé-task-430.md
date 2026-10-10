---
id: TASK-431
title: >-
  Découper en tâches de backlog dispatchables l'implémentation du chatbot
  retenue par les benchmarks validés (task-430 et task-434)
status: Done
assignee: []
created_date: '2026-10-06 14:43'
updated_date: '2026-10-10 18:02'
labels:
  - orchestration
  - backlog
dependencies:
  - TASK-430
  - TASK-434
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - AGENTS.md
  - CLAUDE.md
  - .claude/agents/backlog-dispatcher.md
  - docs/BENCHMARK_OWNER_WORKFLOW.md
  - scripts/dispatch_backlog.sh
  - docs/research/task-434-chatbot-integration-ui/README.md
  - mobile-design-mockups/chatbot_integration_ui/
  - >-
    backlog/tasks/task-439 -
    Unifier-sur-GPT-6-Luna-le-modèle-des-artefacts-des-aperçus-et-du-futur-chat.md
priority: medium
type: task
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi cette tâche existe

Deux benchmarks vont trancher le chatbot conversationnel : `task-430` pour son **architecture** (où vit la conversation, quel transport, quelle stratégie de contexte, quel quota) et `task-434` pour son **intégration dans l'UI** (où le chat entre dans la navigation, à quelle portée, avec quelles maquettes). L'owner tranche chacun des deux dans son README.

Ce que ces deux décisions produisent n'est pas une tâche d'implémentation unique : c'est un chantier qui traverse le backend, le mobile, Terraform, le quota, les prompts et l'i18n. Le dispatcher (`./scripts/dispatch_backlog.sh`) sait lancer plusieurs agents en parallèle sur des tâches bien découpées, mais il ne sait pas découper. Et une tâche fourre-tout produirait une PR que personne ne peut relire.

**Cette tâche n'écrit donc aucun code applicatif.** Son livrable est un **ensemble de tâches de backlog**, découpées, ordonnées et rédigées de telle sorte qu'on puisse lancer le dispatcher dessus et que le chantier s'implémente correctement, agent par agent, sans que l'owner ait à re-cadrer à chaque étape.

## Les deux sources de vérité

1. **L'architecture** : `docs/research/task-430-chatbot-architecture/README.md`.
2. **L'intégration UI** : `docs/research/task-434-chatbot-integration-ui/README.md`, et les maquettes de la direction retenue sous `mobile-design-mockups/chatbot_integration_ui/`.

Dans les deux cas, lire la section **Owner Validation** : le champ `Decision` porte la décision finale de l'owner, qui **peut différer de la recommandation** du benchmark. Si un `Decision` renvoie à des fichiers `complement-response-*.md` du même répertoire, les suivre aussi.

**C'est le `Decision` de l'owner qui fait le périmètre, pas la `Recommendation`.** Si les deux divergent, le découpage suit le `Decision` et le dit explicitement.

L'ordre de construction en tranches que le README d'architecture propose est le point de départ du découpage, pas une contrainte : si le découpage s'en écarte, dire pourquoi.

**Si les deux décisions se contredisent** — par exemple une direction d'UI qui suppose une réponse en flux alors que l'architecture retenue n'en produit pas — **ne pas arbitrer à la place de l'owner** : nommer la contradiction dans la note de fin de tâche, dire laquelle le découpage a suivie et pourquoi, et créer la tâche qui manque plutôt que de rogner silencieusement l'une des deux décisions.

## Les règles de rédaction que les tâches créées doivent respecter

Elles sont dans `AGENTS.md` et `CLAUDE.md`, et elles sont impératives parce que chaque tâche sera exécutée par un agent isolé, sans mémoire de cette session.

- **Chaque critère d'acceptation doit être satisfiable par l'agent qui implémentera la tâche**, depuis son worktree, pendant son run. Il ne merge pas, ne pousse pas, et son code n'est pas déployé pendant qu'il travaille. Les trois formes interdites : « l'endpoint déployé répond X », les AC en forme de test unitaire, « la suite Maestro est verte ». Un contrôle de déploiement ou une vérification visuelle qui compte vraiment se met **dans la description, comme note à l'owner**, jamais en AC.
- **Rien n'est déployé : on supprime, on ne migre pas.** Aucune tâche ne doit scoper une couche de compatibilité, un double écrit, une fenêtre de dépréciation, ni justifier de garder quelque chose par les utilisateurs ou les données de production — il n'y en a pas.
- **Les cleanups d'abord.** Si une tâche restructure une forme (un schéma, une convention de nommage, une clé de configuration) et que d'autres la peuplent, la restructuration passe **avant** et les autres en dépendent.
- **Une tâche = une PR relisible en une fois**, avec ses propres AC, et sa documentation et son i18n dans la même tâche — aucun report en « tâche de suivi ».
- Le titre dit le résultat visé sans détail d'implémentation ; la description dit le **pourquoi** et le contexte qu'un agent ne peut pas retrouver dans le code.

## Le routage vers les bons agents

Le dispatcher choisit l'agent d'après les labels, dans l'ordre de la table de `.claude/agents/backlog-dispatcher.md`. Lire cette table avant de poser les labels, parce qu'un label mal choisi envoie une tâche mobile à un agent backend. En particulier : toute tâche qui touche `mobile/` doit porter le label `mobile` — ce qui vaut pour **toutes** les tâches issues de la décision d'UI — et une tâche qui porte un label de recherche part en recherche même si elle est destinée à être implémentée.

## Si une décision technologique manque encore

Si le découpage fait apparaître un choix non tranché par les benchmarks validés — un service externe, une bibliothèque parmi plusieurs, une politique de quota, ou un périmètre dont la forme n'est pas évidente — **ne pas le trancher ici**. Créer une paire de tâches selon la convention de `CLAUDE.md` : une tâche benchmark, et une tâche d'implémentation qui en dépend et qui renvoie à son README sans en préjuger la conclusion.

## Note à l'owner

Après ce découpage, rien n'est implémenté : il reste à commiter les fichiers de backlog créés, puis à lancer `./scripts/dispatch_backlog.sh --max-dispatch N`. Le récapitulatif produit par cette tâche est là pour que l'owner puisse choisir `N` et l'ordre en connaissance de cause.

## Décision de modèle du 2026-10-10

L'owner impose OpenAI `gpt-6-luna` en mode Standard pour le chat, tous les artefacts et les aperçus, sans nouveau benchmark de modèles. `task-439` porte la bascule des parcours existants et le socle LLM commun. Ne pas recréer cette migration dans le découpage : les futures tâches d'appel LLM du chat doivent dépendre de task-439 et consommer sa configuration commune, avec Luna dès la première livraison. Les tâches de stockage, transport ou UI qui n'utilisent pas ce socle peuvent avancer indépendamment ; task-431 elle-même n'a pas à attendre task-439 pour produire son découpage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les tâches de backlog couvrant l'intégralité du périmètre décidé par l'owner dans la section Owner Validation de docs/research/task-430-chatbot-architecture/README.md existent dans backlog/tasks/, créées via l'outillage Backlog.md et non à la main
- [x] #2 Aucun fichier de code applicatif, de configuration Terraform ou de l'app mobile n'a été modifié par cette tâche : son diff ne contient que des fichiers de backlog et sa propre note de synthèse
- [x] #3 Chaque tâche créée renvoie dans sa description à docs/research/task-430-chatbot-architecture/README.md comme source de vérité, et restitue le contexte nécessaire à un agent qui n'a aucune mémoire de cette session
- [x] #4 Chaque tâche créée porte des labels qui la routent vers l'agent voulu selon la table de .claude/agents/backlog-dispatcher.md, et toute tâche touchant mobile/ porte le label mobile
- [x] #5 Aucun critère d'acceptation d'aucune tâche créée ne prend l'une des trois formes interdites par CLAUDE.md : dépendance à un déploiement, forme de test unitaire ou d'appel in-process sur l'app FastAPI, ou suite Maestro verte
- [x] #6 Les contrôles de déploiement et les vérifications visuelles mobiles qui comptent apparaissent comme notes à l'owner dans les descriptions, jamais en critère d'acceptation
- [x] #7 Aucune tâche créée ne scope de couche de compatibilité, de double écrit, de fenêtre de dépréciation ni de repli sur l'ancien comportement, et aucune ne justifie de conserver un artefact par les utilisateurs, les clients ou les données de production
- [x] #8 Les dépendances entre les tâches créées sont renseignées dans leur front-matter et forment un ordre où aucune tâche n'est dispatchable avant que ce dont elle dépend soit Done, les restructurations précédant les tâches qui peuplent la forme restructurée
- [x] #9 Chaque tâche créée tient dans une PR relisible en une fois et porte, dans la même tâche, ses attentes de documentation et d'i18n lorsqu'elles s'appliquent, sans report en tâche de suivi
- [x] #10 Tout choix technologique non tranché par le benchmark validé donne lieu à une paire tâche benchmark plus tâche d'implémentation dépendante selon la convention de CLAUDE.md, l'implémentation renvoyant au README du benchmark sans en préjuger la conclusion
- [x] #11 La note de fin de tâche liste les identifiants des tâches créées, leur titre, l'agent vers lequel leurs labels les routent, le graphe de dépendances, et l'ordre de dispatch recommandé
- [x] #12 La note de fin de tâche dit explicitement si le découpage suit la Recommendation du benchmark ou le Decision de l'owner lorsque les deux divergent, et dit où le découpage s'écarte de l'ordre de construction proposé par le README et pourquoi
- [x] #13 Le périmètre découpé couvre la décision d'architecture de la section Owner Validation de docs/research/task-430-chatbot-architecture/README.md et la décision d'intégration UI de celle de docs/research/task-434-chatbot-integration-ui/README.md ; si les deux décisions se contredisent sur un point, la note de fin de tâche nomme la contradiction et dit laquelle le découpage a suivie, sans la trancher à la place de l'owner
- [x] #14 Les tâches qui portent l'intégration UI renvoient aux maquettes de la direction retenue sous mobile-design-mockups/chatbot_integration_ui/ et portent le label mobile
- [x] #15 Les tâches issues du découpage qui réalisent les appels LLM du chat dépendent de task-439 et consomment son choix configurable gpt-6-luna en mode Standard dès la première livraison ; aucun benchmark de modèles ni doublon de la migration des artefacts et aperçus n'est créé.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Découpage réalisé le 2026-10-10

Sources lues : `Decision` de `docs/research/task-430-chatbot-architecture/README.md` (owner_decision: ok, 2026-10-10), le README et `complement-response-2026-10-07.md` comme base de preuves ; `Decision` de `docs/research/task-434-chatbot-integration-ui/README.md` (owner_decision: ok) et les maquettes `mobile-design-mockups/chatbot_integration_ui/direction_f_composeur_persistant/`. task-430 et task-434 passées `Done` (synchronisation Phase 0 du dispatcher, `owner_decision: ok`). Treize tâches créées par l'outil Backlog.md, aucun fichier de code, de Terraform ou de `mobile/` modifié.

### Tâches créées

| ID | Titre | Labels → agent |
|---|---|---|
| task-457 | Créer le socle de données durable du chat : table DynamoDB dédiée, modèles et couche d'accès | backend, chat, feature → task-feature |
| task-458 | Benchmark du relais de l'outbox du chat et de la récupération des tours non expédiés ou au bail expiré | benchmark → task-research |
| task-459 | Benchmark du contrôle du débit de tokens par minute partagé entre le chat et les artefacts | benchmark → task-research |
| task-460 | Extraire du worker d'artefacts la couche LLM commune et lui ajouter un mode de réponse en flux | backend, llm, chat, feature → task-feature |
| task-461 | Ouvrir, lister, lire et supprimer les conversations sous /api/chat | backend, api, chat, feature → task-feature |
| task-462 | Accepter un tour avec plafonds, budget de contexte et débit unique, et permettre son arrêt | backend, api, chat, feature → task-feature |
| task-463 | Générer les réponses dans une file et un worker dédiés, en flux persisté | backend, chat, llm, feature → task-feature |
| task-464 | Diffuser en SSE reprenable par une Lambda dédiée derrière une API Gateway REST en mode STREAM | backend, infrastructure, chat, feature → task-feature |
| task-465 | Implémenter le relais de l'outbox selon le benchmark validé (task-458) | backend, chat, feature → task-feature |
| task-466 | Implémenter le contrôle du débit de tokens selon le benchmark validé (task-459) | backend, llm, chat, feature → task-feature |
| task-467 | Service de chat mobile et contrôleur de conversation partagé qui reprend le flux SSE | mobile → task-mobile |
| task-468 | Composeur persistant dans Lecture (média) et Sources (dossier), avec sa feuille de conversation | mobile → task-mobile |
| task-469 | Retrouver, reprendre et supprimer les conversations passées depuis la feuille | mobile → task-mobile |

Aucune tâche ne porte `pricing`, `product` ou `scoping`, qui l'enverraient en recherche.

### Graphe de dépendances

    task-439 (Done) ─> 460 ─┬─────────────> 462 ─> 463 ─┬─> 465 <─ 458 (benchmark)
    457 ─┬─> 461 ───────────┘                ▲          └─> 466 <─ 459 (benchmark)
         ├──────────────────────────────────┘ (457 -> 462, 463)
         └─> 464
    461 + 462 + 464 ─> 467 ─> 468 ─> 469

Les tâches qui font les appels LLM du chat (460, 463, et 466 par 460) dépendent de task-439 et passent par `llm_config.chat_completion_parameters()`, donc `gpt-6-luna` dès la première livraison. Aucun benchmark de modèles, aucune reprise de la migration des artefacts.

### Ordre de dispatch recommandé

1. **457, 460, 458, 459** en parallèle (fichiers disjoints ; les deux benchmarks ne touchent que `docs/research/`).
2. **461, 464** (après 457).
3. **462** (après 460 et 461).
4. **463**.
5. **467** ; **465** dès que l'owner aura validé le README de task-458 ; **466** dès qu'il aura validé celui de task-459.
6. **468**, puis **469**.

La chaîne serveur ne fonctionne de bout en bout qu'avec 465 : **la décision de l'owner sur task-458 est sur le chemin critique de la première livraison**. Les deux benchmarks partent dans la première vague pour cette raison.

### Recommendation contre Decision : le découpage suit le Decision

- **task-430** : la Recommendation était B (troisième mode du worker d'artefacts, tours dans un item, pas de flux, portée média seule) ; le complément proposait E (Function URL `NONE`, worker d'artefacts qui écrit les fragments, arrêt sans annulation). Le Decision prime et le découpage le suit : file, DLQ et worker de chat dédiés (463) ; extraction d'une couche commune plutôt qu'un mode chat (460) ; items distincts conversation, messages, tentatives, fragments et intentions (457) ; outbox (458/465) ; API Gateway REST en mode STREAM et pas de Function URL (464) ; annulation observée par le worker (462/463) ; Luna au lieu de `gpt-5.4-nano`.
- **task-434** : la Recommendation était D + E2 (feuille invocable), avec F écartée pour la V1. Le Decision retient F, limitée aux onglets Lecture et Sources ; le découpage suit le Decision (468).

### Écarts à l'ordre de construction du §12 du README task-430

Le §12 proposait média sans flux, puis dossier, barème, bibliothèque, puis le flux, chacun derrière un signal. Le Decision point 9 le remplace : « La première livraison fonctionnelle aux testeurs inclut le streaming reprenable et les portées média et dossier ». Le découpage suit donc socle durable → exécution dédiée → diffusion et reprise, sans tranche B préalable. La tranche 3 (desserrage du barème, un `put-item` de l'owner selon le taux de cache mesuré) et la tranche 4 (bibliothèque, hors périmètre selon le Decision) n'ont pas de tâche.

### Contradictions entre les deux décisions

Aucune sur le fond : l'UI F suppose un flux et l'architecture en livre un. Un écart de **mécanisme**, nommé dans task-468 : la direction F du benchmark est un `NativeTabs.BottomAccessory` de la barre d'onglets. `media/[id]` et `media/folders/[id]` sont des écrans de la pile racine, sans barre d'onglets, et le Decision limite le composeur à deux onglets de ces écrans. Le composeur est donc un composant d'écran, le même sur iOS et Android. C'est la seule réalisation possible du Decision tel qu'écrit ; ce n'est pas un arbitrage entre les deux décisions.

### Points déduits, à valider par l'owner (aucune source ne les tranche)

1. **Digest** : `CompletedDetailView` est aussi une page du carrousel du Digest. Par lecture littérale (« onglet Lecture d'un média »), le composeur y apparaît. Le benchmark de task-434 §1.6 signale que le clavier s'ouvrirait alors dans un pager horizontal. Tranché par l'owner le 2026-10-10 : le composeur y apparaît (task-468).
2. **Débit d'un tour dont le lancement échoue définitivement** : le README task-430 §14.1 le laisse à l'owner, et le dépôt ne rembourse jamais de minutes. Tranché par l'owner le 2026-10-10 : « On rembourse ». Un tour scellé en échec sans texte visible est remboursé (opération dans task-462, appelée par task-463 et task-465).
3. **Plafond de sortie du chat sur Luna** : les 2 000 tokens du §9.4 ont été calculés pour `gpt-5.4-nano`, et les tokens de raisonnement de Luna entrent dans ce plafond. Tranché par l'owner le 2026-10-10 : pas de plafond propre au chat, le chat garde `LLM_MAX_COMPLETION_TOKENS` (32 000 depuis le 2026-10-10, partagé avec les artefacts) ; la longueur se règle dans le prompt, une fin en `length` scelle le tour en interrompu (task-457, 460, 462, 463, 468 mises à jour).
4. **task-466 hors du chemin de la première livraison** : le Decision exige le contrôle du débit de tokens mais ne dit pas qu'il conditionne la première livraison. Les tâches de la première livraison n'en dépendent donc pas.

### Hors périmètre, relevé

- task-428 (« Implémenter les questions de l'utilisateur sur les transcripts… », dépend du benchmark task-427, encore `pending`) recouvrait le même besoin que ce chantier. Supprimées sur décision de l'owner du 2026-10-10 : task-427 et task-428 archivées, README task-427 en `owner_decision: abandoned`.
- Le champ `Validated at` du README de task-434 est vide (l'`owner_decision` est bien `ok`).
- Domaine personnalisé du flux SSE : non requis par le Decision ; renvoyé à task-445 dans la note de task-464.

### Note à l'owner

Rien n'est encore implémenté. Il reste à commiter les fichiers de backlog (task-430, task-431, task-434, task-457 à task-469), puis à lancer `./scripts/dispatch_backlog.sh --max-dispatch 4` pour la première vague.
<!-- SECTION:NOTES:END -->
