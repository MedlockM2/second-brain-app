---
id: TASK-459
title: >-
  Benchmark du contrôle du débit de tokens par minute partagé entre le chat et
  les artefacts sur le fournisseur LLM
status: Done
assignee: []
created_date: '2026-10-10 17:57'
updated_date: '2026-10-11 14:50'
labels:
  - benchmark
  - chat
  - llm
dependencies: []
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - >-
    docs/research/task-430-chatbot-architecture/complement-response-2026-10-07.md
  - media_summarizer/core/services/llm_config.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/utils/llm_failure.py
  - 'https://developers.openai.com/api/docs/guides/rate-limits'
priority: medium
type: spike
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi ce benchmark existe

L'architecture du chat est décidée par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10 (source de vérité ; il prime sur la Recommendation et sur le complément). Son point 8 impose : « Contrôler aussi la consommation de tokens par fenêtre de temps à l'échelle des appels au fournisseur partagés avec les artefacts : **des files séparées et un plafond de concurrence ne suffisent pas, à eux seuls, à respecter les limites de débit en tokens**. »

Le README §9.4 l'a chiffré sur l'ancien modèle : deux premiers tours concurrents sur un dossier au plafond dépassaient de 21 % le TPM du palier 1, et le complément C3.3 a établi que les tokens servis par le cache comptent plein dans le TPM. Le Decision ajoute une file et un worker de chat **séparés** de ceux des artefacts (point 2), donc deux flottes concurrentes qui tirent sur la même limite d'organisation OpenAI. Depuis task-439, le chat et tous les artefacts appellent le même modèle, `gpt-6-luna` (`media_summarizer/core/services/llm_config.py`).

La forme du contrôle n'est pas évidente (où il vit, d'où vient la limite alors que le palier du compte n'est pas lisible depuis le dépôt, ce que fait un appel qui dépasserait — attendre, se replanifier, refuser — et si le chat interactif passe avant les artefacts). C'est donc un benchmark.

## La question

Quel mécanisme borne la consommation de tokens par minute de l'ensemble des appels LLM du dépôt (chat, artefacts, aperçus, retraduction), avec quelle source pour la limite, quel comportement au dépassement pour chaque type d'appel, et quelle priorité entre le chat et les générations en tâche de fond ?

Pistes à évaluer au minimum : compteur de fenêtre partagé en DynamoDB (seau de jetons ou fenêtre glissante) consulté avant chaque appel ; lecture des en-têtes `x-ratelimit-remaining-tokens` / `x-ratelimit-reset-tokens` renvoyés par OpenAI ; réservation estimée avant appel puis ajustement sur l'usage réel ; réglage de la concurrence et du délai de redélivrance des files ; toute autre option documentée.

## Critères

Exactitude face aux limites réelles (estimation à `byte_length / 3.4`, cache compté plein), latence ajoutée au premier octet du chat, comportement sous contention, objets AWS et coût fixe, et ce que chaque option change dans `media_summarizer/workers/artifact_generator/worker.py`, dans la taxonomie `media_summarizer/utils/llm_failure.py` (le 429 avec `Retry-After`) et dans le futur worker de chat. Les limites Luna par palier sont à relever à la source, avec la date.

Faits déjà établis le 2026-10-10, à reprendre et à compléter :
- **Palier du compte** relevé par l'owner dans sa console : palier « Build » ; `gpt-6-luna` y a 2 000 000 TPM et 5 000 RPM.
- **Le plafond de sortie pèse sur le TPM.** Guide des limites de débit (https://developers.openai.com/api/docs/guides/rate-limits) : « *Your rate limit is calculated as the maximum of `max_tokens` and the estimated number of tokens* » d'après les caractères de la requête. Article d'aide 429 (https://help.openai.com/en/articles/5955604-how-can-i-solve-429-too-many-requests-errors) : « *unnecessarily large output-token allowances can also contribute to token-rate errors* », Chat Completions utilisant `max_completion_tokens`. Le plafond partagé est donc passé à 32 000 dans `llm_config.py`.
- **Point non documenté** : OpenAI ne dit pas si la totalité de `max_completion_tokens` est retenue à l'arrivée de la requête (c'est le comportement documenté d'Azure OpenAI). Le benchmark doit le tenir pour l'hypothèse prudente, ou le mesurer par l'en-tête `x-ratelimit-remaining-tokens` si l'owner autorise deux appels de quelques tokens.

## Garde-fous

Benchmark seulement : aucun fichier source modifié, aucun appel LLM payant. Recherche internet exhaustive, faits datés et sourcés. Lecture seule sur AWS `-dev`. Livrable : `docs/research/task-459-llm-token-rate-control/README.md` avec `owner_decision: pending`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs/research/task-459-llm-token-rate-control/README.md existe avec owner_decision: pending et une section Owner Validation à remplir
- [x] #2 Les limites TPM et RPM de gpt-6-luna par palier sont relevées à la source avec leur date, et confrontées à la charge d'un premier tour de chat sur un dossier au plafond de corpus en vigueur
- [x] #3 Au moins trois mécanismes de contrôle sont comparés sur l'exactitude, la latence ajoutée au chat, le comportement au dépassement par type d'appel, la priorité chat contre artefacts, les objets AWS et le coût fixe
- [x] #4 Le README se termine par une recommandation argumentée et la liste des fichiers et ressources qu'elle touche
- [x] #5 Aucun fichier hors du répertoire de recherche n'est modifié
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-11 — Mode initial. Livrable : docs/research/task-459-llm-token-rate-control/README.md (owner_decision: pending). Limites de gpt-6-luna relevées à la source (Build 5 000 RPM / 2 000 000 TPM ; Launch 10 000 / 10 000 000 ; Grow 30 000 / 180 000 000) et confrontées à un premier tour sur un dossier au plafond (152 460 tokens réservés, 7,6 % du TPM ; 152 % avec 10 artefacts + 10 tours concurrents). Cinq mécanismes comparés. Recommandation : réservation dans des fenêtres partagées de 10 s en DynamoDB (plafond TPM × 0,9 / 7), fond plafonné à 60 %, chat prioritaire avec attente bornée, renvoi différé des artefacts ; 429 et en-tête x-ratelimit-limit-tokens en filet et calibrage. Aucun appel LLM fait : l'hypothèse prudente sur max_completion_tokens est retenue. **La recommandation attend la validation de l'owner.**
<!-- SECTION:NOTES:END -->
