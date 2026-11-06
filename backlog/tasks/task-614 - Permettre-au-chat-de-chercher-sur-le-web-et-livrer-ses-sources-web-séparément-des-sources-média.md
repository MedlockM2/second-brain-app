---
id: TASK-614
title: >-
  Permettre au chat de chercher sur le web et livrer ses sources web séparément
  des sources média
status: Done
assignee: []
created_date: '2026-11-06 18:31'
updated_date: '2026-11-06 19:22'
labels:
  - backend
  - chat
  - feature
dependencies:
  - TASK-613
references:
  - media_summarizer/core/services/llm_client.py
  - media_summarizer/core/services/chat_prompt.py
  - media_summarizer/workers/chat_worker.py
  - media_summarizer/core/models/chat.py
  - media_summarizer/core/services/llm_pricing.py
  - media_summarizer/core/services/budget_guard.py
  - packages/core/src/types/chat.ts
priority: medium
type: feature
ordinal: 221000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : agent — code et contrôles statiques dans son worktree. Aucun merge, push, déploiement ni validation propriétaire demandé par les critères.

## Décision de l'owner (2026-11-06)

Le modèle qui répond dans le chat peut chercher sur internet **quand il en a besoin** pour étayer sa réponse, avec l'outil hébergé `web_search` de la Responses API (`tool_choice: auto`). Le chemin Responses API vient de TASK-613. Pas de benchmark : l'outil hébergé est retenu. **Le chat seulement** : les artefacts et la traduction ne cherchent pas.

Les sources web citées doivent arriver à l'app **séparément** des sources média (`[S1]`, `[S2]`… de l'instantané de la conversation), pour qu'elle les affiche autrement (TASK-615). Cette tâche couvre le backend et le contrat transmis à l'app.

## Ce qu'il faut faire

1. **L'outil.** `llm_client.stream` accepte une liste d'outils. Seul le chat passe `web_search`. Borner le nombre de recherches par tour (`max_tool_calls` ou équivalent) et justifier la valeur. Lire la doc actuelle de l'outil et dater la lecture.
2. **Le prompt** (`chat_prompt.chat_instructions`). Les sources du corpus restent le point de départ. Le modèle cherche quand la question demande des faits absents du corpus, récents ou à vérifier, et pas quand le corpus suffit. Les tags `[S#]` restent réservés au corpus et ne marquent jamais un fait trouvé sur le web.
3. **Le contrat des citations web.** Le modèle cite ses pages web (annotations `url_citation` de la Responses API). Le message assistant scellé porte :
   - une liste ordonnée et dédupliquée par URL de sources web, `web_sources: [{ref: "W1", url, title}]` ;
   - dans son Markdown, un tag `[W1]`, `[W2]`… à l'endroit de chaque citation, à la place du lien que le modèle écrit en ligne.

   Le préfixe `W` sépare les deux familles, et `packages/core/src/chat/markdown.ts` pourra parser les deux de la même façon. L'implémenteur peut choisir un autre format s'il le justifie, à condition que la séparation reste nette.
   - **Pendant le flux**, l'app doit pouvoir résoudre un `[W#]` affiché avant la fin du tour : les sources web connues voyagent avec les fragments ou avec la lecture du tour en cours. Un lien du modèle peut être coupé entre deux deltas ; la réécriture le gère.
   - **Dans l'historique renvoyé au modèle** (`history_turns`), un `[W#]` passé redevient lisible (titre et URL), pour que le modèle sache ce qu'il a cité.
   - Exposer `web_sources` dans le modèle Pydantic, la réponse de l'API et `packages/core/src/types/chat.ts`.
4. **Le coût et le budget.** Chaque appel à `web_search` est facturé à part, et les pages lues comptent en tokens d'entrée. Lire le nombre de recherches dans la réponse, ajouter leur prix à `llm_pricing` (prix lu sur la page tarifaire d'OpenAI, avec la date) et au coût du tour. Le budget beta réserve, à l'admission du tour, le prix du nombre maximal de recherches autorisé.
5. **L'état « recherche en cours »** (`response.web_search_call.*`). Le worker l'expose sur le tour en cours, pour que l'app puisse afficher autre chose que l'attente habituelle pendant une recherche.

Note pour l'owner : à vérifier en E2E manuel après le push. Une question d'actualité doit déclencher une recherche avec des `[W#]` résolus. Une question à laquelle le corpus suffit ne doit pas en déclencher. Le coût du tour doit inclure les recherches.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le chat worker envoie l'outil `web_search` avec une borne explicite du nombre de recherches ; `complete` (artefacts) et la traduction n'envoient aucun outil
- [x] #2 Les instructions du chat disent quand chercher et réservent les tags `[S#]` au corpus
- [x] #3 Le message assistant scellé porte `web_sources` (ref, url, titre ; dédupliqué par URL) et son Markdown porte des tags `[W#]` à la place des liens web en ligne ; le champ est exposé par l'API et typé dans `packages/core/src/types/chat.ts`
- [x] #4 Les sources web d'un tour en cours sont lisibles par l'app avant que le tour soit scellé
- [x] #5 `history_turns` renvoie au modèle les citations web passées sous une forme lisible (titre et URL), jamais un `[W#]` nu
- [x] #6 Le prix d'une recherche web est dans `llm_pricing` avec sa source datée ; le coût d'un tour l'inclut et l'admission du budget réserve le maximum de recherches autorisé
- [x] #7 Le tour en cours expose l'état « recherche web en cours » tiré des événements `web_search_call`
- [x] #8 `ruff` et `mypy` propres ; `tsc` propre sur `packages/core`
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Docs lues le 2026-11-06 et datées dans le code : guide de l'outil web search, référence Responses API (`max_tool_calls`, annotations, événements `response.web_search_call.*` et `response.output_text.annotation.added`), page tarifaire (10 $ / 1 000 appels ; les tokens de contenu sont facturés au tarif d'entrée du modèle).

Ce qui a été fait :
- **Outil** : `llm_client.stream(..., tools, max_tool_calls, on_web_search)`. Seul le chat passe `chat_prompt.WEB_SEARCH_TOOL` (`{"type": "web_search"}`, `tool_choice` auto par défaut), avec `max_tool_calls = chat_prompt.MAX_WEB_SEARCHES_PER_TURN = 3`. Justification dans le code : le plafond compte aussi `open_page` et `find_in_page` ; 3 permet de chercher puis d'affiner ou d'ouvrir la page trouvée ; le coût des appels reste à 0,03 $ par tour au plus. `complete` et la traduction n'envoient aucun outil.
- **Prompt** : `chat_instructions` dit de chercher seulement pour des faits absents du corpus, récents ou à vérifier ; de citer une page par un lien Markdown ; de ne jamais poser `[S#]` sur un fait venu du web.
- **Citations** : nouveau module `core/services/chat_web_citations.py`. `WebCitationRewriter` remplace dans le flux chaque lien web en ligne (`[t](url)` ou `([t](url))`) par `[W#]`, avec un numéro par URL dans l'ordre de première citation. Il retient la fin du texte tant qu'un lien coupé entre deux deltas peut encore se former. Vérifié à la main sur 2 000 découpages aléatoires ; aucun test commité. Les titres sont repris des annotations `url_citation` au scellement. `ChatWebSource {ref, url, title}` est stocké sur `ChatAssistantMessage.web_sources`, exposé par `ChatMessageResponse.web_sources` et typé `ChatWebSource` dans `packages/core/src/types/chat.ts`.
- **Pendant le flux** : chaque fragment écrit après la première citation porte la liste cumulée `web_sources`, transmise dans l'événement SSE `fragment` (et dans l'événement `end`). Un tour perdu reconstruit aussi ses sources à partir des fragments (`chat_db.fragments_answer`).
- **Historique** : `history_turns` développe chaque `[W#]` en `([titre](url))` via `expand_web_refs`. L'API et le worker passent tous deux par `history_turns`, donc l'estimation de contexte reste cohérente.
- **Coût et budget** : `llm_pricing.WEB_SEARCH_USD_PER_CALL = 0.01` (source datée). `ArtifactLlmUsage.web_search_calls` est lu dans `tool_usage.web_search.num_requests`, sinon compté sur les items `web_search_call` de type `search`, et intégré à `cost_eur`. Le barème du budget gagne `openai_tools.web_search.per_call = 0.01` (version 2026-11-06). `beta_budget.llm_line` et `llm_cost` prennent `web_search_calls`. L'admission du tour (`chat_turn_admission_line`), chaque tentative du worker et le pronostic `budget_capacity` réservent les 3 recherches.
- **Recherche en cours** : les événements `response.web_search_call.*` posent ou retirent `ChatAttempt.web_search_started_at` (`chat_db.set_web_search_state`, conditionné sur l'état `generating`). La porte de flux émet un événement `search {active}` ; `active_generation.web_searching` est exposé par la lecture de la conversation. Le parseur `sse.ts` reconnaît `search`.
- Docs mises à jour : `CHAT_DATA_MODEL.md`, `CANONICAL_MEDIA_API_CONTRACT.md`.

Vérifications : ruff et mypy propres sur les 15 fichiers Python touchés ; `tsc` propre sur `packages/core` (et sur `web/`) ; `check_env_example_complete.py` OK ; imports de l'API, de la porte de flux et du worker vérifiés. Aucun test ajouté.

À valider par l'owner (déduit, aucune source ne le formule) :
- Le guide web search dit que « le contexte de la recherche web est limité à 128k même quand le modèle a une fenêtre plus grande ». Le budget de contexte du chat va jusqu'à environ 247k tokens. À vérifier en E2E sur un gros dossier : si l'outil échoue au-delà de 128k, il faudra ne pas envoyer l'outil au-delà d'un seuil.
- Les pages lues sont facturées en tokens d'entrée et ne sont pas bornées par la réservation (qui ne compte que les octets de la requête et le prix des appels). Elles sont régularisées sur l'usage réel (règle 8).
- Tous les liens `http(s)` en ligne écrits par le modèle deviennent des `[W#]`, y compris un lien qui ne viendrait pas d'une recherche.

Note pour l'owner (E2E après push) : une question d'actualité doit déclencher une recherche avec des `[W#]` résolus ; une question à laquelle le corpus suffit ne doit pas en déclencher ; le coût du tour doit inclure les recherches. L'affichage côté app relève de TASK-615.
<!-- SECTION:NOTES:END -->
