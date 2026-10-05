---
id: TASK-428
title: >-
  Implémenter les questions de l'utilisateur sur les transcripts d'un média ou
  d'un dossier selon le benchmark validé (task-427)
status: To Do
assignee: []
created_date: '2026-10-04 19:44'
labels:
  - feature
  - mobile
dependencies:
  - TASK-427
references:
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/core/services/quota_enforcer.py
  - media_summarizer/workers/artifact_generator/worker.py
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: feature
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Permettre à l'utilisateur de poser sa propre question sur le transcript d'un média, ou sur les transcripts concaténés d'un dossier.

**Avant d'écrire une ligne, lire `docs/research/task-427-*/README.md`** : la section `Owner Validation` porte la décision de l'owner. Elle dit quelle voie est retenue (artefact question sans relance, chatbot conversationnel, ou voie intermédiaire), quelle stratégie de contexte suivre, quels garde-fous appliquer, quelle unité de quota débiter et quel mécanisme de streaming adopter, le cas échéant. Si le champ `Decision` renvoie à un `complement-response-*.md`, le lire aussi. La décision de l'owner prime sur la recommandation initiale du README.

Si le README découpe l'implémentation en plusieurs lots, ne réaliser que le premier, puis créer les tâches des lots suivants dans le backlog, chacune dépendant de celle-ci.

## Notes pour l'owner (non vérifiables par l'agent)

- **Déploiement** : les changements backend et Terraform ne sont actifs sur `-dev` qu'après le push sur `main`.
- **Test manuel** : depuis l'app sur `-dev`, poser une question sur un média puis sur un dossier, vérifier la réponse, le débit du quota et le refus au-delà des garde-fous. Si la voie retenue est le chatbot : enchaîner plusieurs tours et vérifier que le contexte est conservé.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le périmètre de la décision owner du README task-427 (ou de son premier lot) est implémenté, rien au-delà
- [ ] #2 Les garde-fous et l'unité de quota retenus par le README sont appliqués côté backend avant tout appel LLM, et une requête qui les dépasse reçoit un refus typé
- [ ] #3 Le chemin est câblé de bout en bout dans le code : de l'écran mobile jusqu'à l'appel LLM et au stockage de la réponse (et de l'historique si la voie retenue en a un)
- [ ] #4 ruff et mypy passent sur le backend, terraform validate passe si l'infrastructure est modifiée, et le typecheck mobile passe
- [ ] #5 docs/CANONICAL_MEDIA_API_CONTRACT.md décrit les nouveaux endpoints, leurs refus et leur débit de quota
- [ ] #6 Si le README prévoit d'autres lots, chacun a sa tâche dans le backlog, qui dépend de celle-ci
<!-- AC:END -->
