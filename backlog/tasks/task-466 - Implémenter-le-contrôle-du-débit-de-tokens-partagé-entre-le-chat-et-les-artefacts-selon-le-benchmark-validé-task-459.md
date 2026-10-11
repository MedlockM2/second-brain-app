---
id: TASK-466
title: >-
  Faire respecter Retry-After aux réessais du worker de chat et documenter la
  politique de débit LLM retenue par task-459
status: Done
assignee: []
created_date: '2026-10-10 18:00'
updated_date: '2026-10-11 14:59'
labels:
  - backend
  - llm
  - chat
  - feature
dependencies:
  - TASK-459
references:
  - docs/research/task-459-llm-token-rate-control/README.md
  - media_summarizer/utils/llm_failure.py
  - media_summarizer/core/services/llm_client.py
  - media_summarizer/workers/chat_worker.py
  - infrastructure/terraform/modules/platform/llm_alerts.tf
  - 'https://developers.openai.com/api/docs/guides/rate-limits'
priority: medium
type: feature
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Le benchmark task-459 recommandait un compteur de tokens partagé en DynamoDB. L'owner ne l'a pas retenu : lire `docs/research/task-459-llm-token-rate-control/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-11, qui est la source de vérité. Pour la bêta, le dépôt garde **M1, la concurrence existante et le 429 réactif**, au palier actuel du compte OpenAI (Build), qui montera de lui-même avec l'usage. Il n'y a donc ni compteur partagé, ni réservation, ni `LLM_TPM_LIMIT`, ni classe de priorité, et le plafond `LLM_MAX_COMPLETION_TOKENS = 32 000` ne change pas.

Reste à appliquer M1 selon la pratique standard (guide des limites d'OpenAI) : traiter `Retry-After` comme un **minimum**, ajouter une petite gigue, borner les réessais en nombre et en durée. Un appel refusé compte aussi dans la limite, donc réessayer trop tôt aggrave la saturation.

## Ce qui existe

- `classify_llm_failure` (`media_summarizer/utils/llm_failure.py`) lit un 429 avec `Retry-After` comme `TRANSIENT + rate_limit`, mais ne vérifie que la **présence** de l'en-tête, pas sa valeur. `llm_client.py` lui passe `response.headers.get("Retry-After")`.
- `chat_worker.py` : avant toute émission de texte, `MAX_PROVIDER_CALLS = 3` appels avec `RETRY_BACKOFF_SECONDS = (1.0, 3.0)` fixes, sans gigue et sans tenir compte de `Retry-After`. Au-delà, le tour est scellé en échec et remboursé (task-463).
- Le worker d'artefacts laisse SQS redélivrer un échec `TRANSIENT` (`process_message_with_retry`). Le délai de visibilité dépasse déjà tout `Retry-After` de cadence : ce chemin ne change pas.
- L'alarme `llm-provider-refused` (`infrastructure/terraform/modules/platform/llm_alerts.tf`) se déclenche dès qu'un `llm.generation_failed` porte un `refusal_reason`, `rate_limit` compris, sur les workers d'artefacts, de traduction et de chat. C'est le signal prévu par le Decision pour rouvrir la question : pas de nouvelle alarme.

## À faire

1. L'erreur levée sur un refus du fournisseur porte le délai `Retry-After` en secondes quand l'en-tête est présent et lisible (nombre de secondes ou date HTTP). Sinon, la valeur reste absente. La taxonomie de `llm_failure` ne change pas.
2. `chat_worker.py` : chaque attente entre deux appels vaut `max(backoff prévu, Retry-After)`, plus une gigue aléatoire. Si `Retry-After` dépasse une attente maximale compatible avec un tour interactif et avec le bail (constante nommée, par exemple 10 s, justifiée en commentaire), le worker ne réessaie pas : le tour est scellé en échec avec `refusal_reason = rate_limit` et remboursé, par le chemin existant des tentatives épuisées avant le premier texte. Le nombre d'appels reste borné.
3. Documenter dans `docs/INGESTION_WORKERS_PROVIDERS.md` la politique de débit LLM : pas de contrôle partagé du TPM pendant la bêta, le palier du compte (Build aujourd'hui, Launch au fil des recharges) et pourquoi cela suffit, le comportement au 429 de chaque worker (chat : attente bornée sur `Retry-After` puis échec remboursé ; artefacts : redélivrance SQS), l'alarme qui sert de signal, et les conditions de réouverture du Decision.

## Règles

Rien n'est déployé : pas de compatibilité, pas de second chemin. Pas de tests automatisés. Ne pas créer de table, de variable `LLM_TPM_LIMIT` ni de plafond de sortie par type.

## Note à l'owner

Après merge et déploiement, il n'y a pas de 429 à provoquer en `-dev` : lire les journaux `chat.provider_retry` au prochain 429 réel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L'erreur de refus levée par la couche LLM commune expose le délai Retry-After en secondes quand l'en-tête est présent et lisible, en nombre de secondes ou en date HTTP, et la classification de llm_failure est inchangée
- [x] #2 Les réessais de chat_worker.py attendent au moins Retry-After, plus une gigue aléatoire, et restent bornés par MAX_PROVIDER_CALLS
- [x] #3 Un Retry-After supérieur à l'attente maximale nommée du chat scelle le tour en échec avec refusal_reason rate_limit et le rembourse, sans nouvel appel au fournisseur
- [x] #4 docs/INGESTION_WORKERS_PROVIDERS.md décrit la politique de débit LLM retenue par le Decision de task-459 : pas de contrôle partagé du TPM, palier du compte, comportement au 429 du chat et des artefacts, alarme llm-provider-refused comme signal, conditions de réouverture
- [x] #5 Aucune table, aucune variable LLM_TPM_LIMIT ni aucun plafond de sortie par type n'est ajouté ; ruff check et mypy passent sur les fichiers Python modifiés
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-11 — Livré.

- `llm_failure.parse_retry_after` lit les deux formes de `Retry-After` : secondes (y compris fractionnaires) ou date HTTP. Une date passée vaut 0 ; une valeur illisible vaut `None`.
- `LlmProviderRefusedError.retry_after_seconds` est renseigné dans `llm_client._raise_for_provider_error`. `classify_llm_failure` n'a pas changé.
- `chat_worker` : chaque attente vaut `max(backoff, Retry-After)` plus une gigue aléatoire de 0 à 0,5 s, avec au plus `MAX_PROVIDER_CALLS` = 3 appels. Au-delà de `MAX_RETRY_WAIT_SECONDS` = 10 s, l'erreur est relancée sans nouvel appel ; le chemin existant scelle alors le tour `failed` avec `provider_refused_rate_limit` et le rembourse. Le bail est couvert pendant l'attente par le heartbeat ajouté par task-470.
- `docs/INGESTION_WORKERS_PROVIDERS.md`, « LLM rate policy » : pas de contrôle partagé du TPM, palier Build puis Launch, comportement au 429 du chat et des artefacts, alarme `llm-provider-refused` comme signal, conditions de réouverture.
- Aucune table, aucun `LLM_TPM_LIMIT`, aucun plafond par type. ruff et mypy propres.
<!-- SECTION:NOTES:END -->
