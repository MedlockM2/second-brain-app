---
id: TASK-427
title: >-
  Benchmark : question ponctuelle sous forme d'artefact ou vrai chatbot
  conversationnel sur les transcripts d'un média ou d'un dossier
status: To Do
assignee: []
created_date: '2026-10-04 19:44'
updated_date: '2026-10-04 19:44'
labels:
  - benchmark
  - product
  - scoping
dependencies: []
references:
  - docs/research/task-269-collection-artifact-aggregation/README.md
  - docs/research/task-316-artifact-prompts/README.md
  - docs/research/task-72-llm-artifact-benchmark/README.md
  - docs/research/task-212-llm-serving-architecture-benchmark/README.md
  - docs/research/pricing-challenge/README.md
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/core/models/media_artifact.py
  - media_summarizer/core/services/quota_enforcer.py
  - media_summarizer/workers/artifact_generator/worker.py
priority: medium
type: spike
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## La question de l'owner

L'owner veut que l'utilisateur puisse **poser sa propre question** sur le transcript d'un média, ou sur la concaténation des transcripts d'un dossier. Deux voies sont possibles :

- **Voie A, « artefact question »** : un nouveau type d'artefact, comme ceux qui existent, sauf que c'est l'utilisateur qui tape le prompt. Il voit la réponse, et c'est tout : pas de relance. Pour une autre question, il génère un nouvel artefact.
- **Voie B, « chatbot »** : une vraie conversation façon ChatGPT, avec plusieurs questions et réponses, le contexte et l'historique réinjectés à chaque tour, et un historique des conversations.

L'a priori de l'owner : la voie A pour une V1. Mais la voie B colle mieux à la nature de l'app (un second cerveau), et elle est **peut-être moins coûteuse à construire qu'il ne le croit**. Le benchmark doit trancher avec des faits, sans conforter l'a priori par défaut.

Les contraintes que l'owner anticipe pour la voie B : gestion du contexte, limites dures sur la saisie de l'utilisateur pour éviter de saturer la fenêtre de contexte, et plafonds d'usage pour contenir le coût en tokens.

## Ce que le dépôt impose déjà (citer, ne pas redécouvrir)

- **Agrégation d'un dossier** (task-269, `owner_decision: ok`, stratégie S1) : une passe unique sur le corpus concaténé, balisé `[S1] … [Sn]`, avec un plafond dur (25 sources / 120 000 tokens estimés) et un refus `422` au-delà, sans troncature ni map-reduce. Dire si chaque voie peut réutiliser ce mécanisme tel quel.
- **Règle de génération unique** (task-316, décision owner) : un artefact de média ne se génère qu'une fois et se met en cache ; un artefact de collection ne se regénère que si ses sources ont changé. Une question tapée par l'utilisateur rompt cette règle par nature. Dire comment chaque voie s'y articule.
- **Mutualisation par contenu** (`artifact_service.py`, en-tête du module) : une génération partagée par (contenu, type, paramètres), et un pointeur par compte. Un prompt libre rend la génération propre à l'utilisateur. Chiffrer ce que ça change au coût.
- **Quota** (`quota_enforcer.py`) : le quota est débité en minutes chaque fois qu'un compte gagne une entrée. Proposer une unité de quota pour une question et pour un tour de conversation, cohérente avec la grille tarifaire (`docs/research/pricing-challenge/README.md`).
- **Modèles LLM retenus** (task-72) : `gpt-5-nano` et `gpt-5.4-nano`. Le prompt caching d'OpenAI (préfixe ≥ 1 024 tokens) n'est presque pas exploité aujourd'hui (pricing-challenge § R.6). Or en voie B, le corpus en préfixe stable est exactement ce que le cache récompense : mesurer le gain.
- **task-212** (benchmark d'architecture de serving LLM, dont un workload chatbot) a été **abandonné** par l'owner. Le lire pour ne pas refaire ce qui y est déjà chiffré, mais ne pas en reprendre les conclusions d'infrastructure (Azure multi-région, gateway) : ce benchmark-ci ne porte pas sur un changement de fournisseur.
- **Backend Lambda** derrière API Gateway, worker d'artefacts sur SQS. Évaluer si le streaming de réponse (indispensable à une UX de chat) est possible avec ce runtime (Lambda response streaming, Function URL, WebSocket API Gateway…), ou si la voie B tolère une réponse non streamée.

## Ce qu'il faut comparer

Pour chaque voie, et pour d'éventuelles **voies intermédiaires** que la recherche juge pertinentes (par exemple : un fil de questions courtes sans réinjection de l'historique, ou un nombre de relances plafonné), évaluer :

1. **Coût LLM réel par usage**, chiffré avec les prix vérifiés et datés des modèles retenus : une question sur un média d'une heure, une question sur un dossier au plafond task-269, et une conversation de 5, 10 et 20 tours, avec et sans prompt caching. Montrer comment le coût croît avec le nombre de tours (réinjection de l'historique).
2. **Gestion du contexte en voie B** : les stratégies possibles (corpus complet en préfixe caché, fenêtre glissante sur l'historique, résumé de l'historique, RAG par morceaux de transcript), leurs coûts et leurs effets sur la qualité. Dire si le RAG est nécessaire ou si la fenêtre des modèles retenus suffit sous le plafond task-269.
3. **Garde-fous** : limite de longueur de la question, nombre de tours par conversation, nombre de conversations ou de questions par période et par palier, comportement à la saturation. Proposer des valeurs chiffrées.
4. **Coût de construction** : backend (modèle de données, endpoints, stockage de l'historique, streaming, Terraform), mobile (écran de conversation, historique, états d'erreur), en nommant les fichiers existants qu'on étend et ce qui est entièrement neuf.
5. **Valeur produit** : ce que font les concurrents directs (NotebookLM, Snipd, Readwise Reader, et ceux que la recherche juge pertinents), et ce que l'utilisateur perd avec la voie A.
6. **Chemin d'évolution** : si on fait A en V1, que coûte de passer à B ensuite ? Qu'est-ce qui est réutilisé, et qu'est-ce qui est jeté ?

## Le livrable attendu

Une recommandation tranchée pour la V1, avec le coût unitaire, les garde-fous chiffrés et l'unité de quota retenue. Si la recommandation est la voie A, dire à partir de quel signal passer à B. Si c'est B, montrer qu'elle tient dans le budget de tokens d'un abonné Standard.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Chaque prix de modèle cité porte sa source et sa date de consultation ; aucun prix n'est donné de mémoire
- [ ] #2 Le README chiffre le coût LLM d'une question sur un média d'une heure, d'une question sur un dossier au plafond task-269, et d'une conversation de 5, 10 et 20 tours, avec et sans prompt caching
- [ ] #3 Le README propose des garde-fous chiffrés (longueur de la question, tours par conversation, volume par période et par palier) et une unité de quota pour une question et pour un tour, rattachée à quota_enforcer.py
- [ ] #4 Le README dit comment chaque voie s'articule avec la décision task-269 (plafond et refus), la règle de génération unique de task-316 et la mutualisation par contenu d'artifact_service.py, en citant les fichiers et les lignes
- [ ] #5 Le README dit si le streaming de réponse est faisable sur le runtime Lambda actuel, par quel mécanisme et avec quelles modifications Terraform
- [ ] #6 Le README liste, pour chaque voie, les fichiers backend et mobile à étendre et ce qui est entièrement neuf, ainsi que ce que la voie A laisserait de réutilisable pour passer ensuite à la voie B
- [ ] #7 Un fichier docs/research/task-427-ask-question-vs-chatbot/README.md existe avec owner_decision: pending dans son front-matter et les sections Owner Validation, Recommendation et Sources
<!-- AC:END -->
