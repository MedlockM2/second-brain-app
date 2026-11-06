---
id: TASK-614
title: >-
  Permettre au chat de chercher sur le web et livrer ses sources web séparément
  des sources média
status: To Do
assignee: []
created_date: '2026-11-06 18:31'
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
- [ ] #1 Le chat worker envoie l'outil `web_search` avec une borne explicite du nombre de recherches ; `complete` (artefacts) et la traduction n'envoient aucun outil
- [ ] #2 Les instructions du chat disent quand chercher et réservent les tags `[S#]` au corpus
- [ ] #3 Le message assistant scellé porte `web_sources` (ref, url, titre ; dédupliqué par URL) et son Markdown porte des tags `[W#]` à la place des liens web en ligne ; le champ est exposé par l'API et typé dans `packages/core/src/types/chat.ts`
- [ ] #4 Les sources web d'un tour en cours sont lisibles par l'app avant que le tour soit scellé
- [ ] #5 `history_turns` renvoie au modèle les citations web passées sous une forme lisible (titre et URL), jamais un `[W#]` nu
- [ ] #6 Le prix d'une recherche web est dans `llm_pricing` avec sa source datée ; le coût d'un tour l'inclut et l'admission du budget réserve le maximum de recherches autorisé
- [ ] #7 Le tour en cours expose l'état « recherche web en cours » tiré des événements `web_search_call`
- [ ] #8 `ruff` et `mypy` propres ; `tsc` propre sur `packages/core`
<!-- AC:END -->
