---
id: TASK-463
title: >-
  Générer les réponses du chat dans une file et un worker dédiés, en flux
  persisté, avec reprise bornée et arrêt observé
status: To Do
assignee: []
created_date: '2026-10-10 17:59'
labels:
  - backend
  - chat
  - llm
  - feature
dependencies:
  - TASK-439
  - TASK-457
  - TASK-460
  - TASK-462
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - >-
    docs/research/task-430-chatbot-architecture/complement-response-2026-10-07.md
  - infrastructure/terraform/modules/platform/sqs.tf
  - infrastructure/terraform/modules/platform/lambda_workers.tf
  - infrastructure/terraform/modules/platform/llm_alerts.tf
  - infrastructure/terraform/modules/platform/pipeline_alerts.tf
  - media_summarizer/workers/lambda_handlers.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/core/services/llm_config.py
  - media_summarizer/utils/llm_failure.py
  - .github/workflows/deploy-lambda.yml
priority: medium
type: feature
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat est décidée par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10 — **source de vérité**, qui prime sur la Recommendation (B : un troisième mode du worker d'artefacts sur sa file) et sur le complément (E : le worker d'artefacts écrit les fragments). Le point 2 du Decision tranche : « Créer une **file SQS de chat avec sa DLQ** et un **worker Lambda de chat**, indépendants de la file et du worker d'artefacts. Le worker peut utiliser l'image de workers existante. […] Le chat a sa propre concurrence, ses délais et sa politique de nouvelles tentatives. »

Cette tâche réalise les appels LLM du chat : elle dépend de task-439 (modèle `gpt-6-luna` en mode Standard, `media_summarizer/core/services/llm_config.py`) et de la couche LLM commune extraite par task-460. **Luna dès cette première livraison**, par `llm_config.chat_completion_parameters()` ; aucune sélection de modèle propre au chat, aucun benchmark de modèles.

## Infrastructure

- File `chat` + DLQ dans `infrastructure/terraform/modules/platform/sqs.tf`, et une entrée dans `local.workers` (`lambda_workers.tf`) : le worker reçoit ainsi gratuitement son log group, son mapping SQS, et les alarmes et widgets en `for_each` (`pipeline_alerts.tf`, `pipeline_dashboard.tf`). Le nommer `media-summarizer-worker-…` pour que la boucle de `.github/workflows/deploy-lambda.yml` le déploie avec l'image des workers. Handler dans `media_summarizer/workers/lambda_handlers.py`.
- **Sa propre politique** : concurrence maximale, `timeout` de la Lambda, `visibility_timeout` de la file et `maxReceiveCount` choisis pour un usage interactif et cohérents entre eux (la visibilité doit dépasser le timeout pour qu'aucune redélivrance ne chevauche une invocation vivante). Decision point 2 : « La visibilité actuelle de 1 800 s des artefacts ne doit pas devenir la politique de reprise interactive du chat. » Les valeurs et leur raison sont écrites en commentaire Terraform.
- **`llm_alerts.tf`** : ajouter le worker de chat à `llm_worker_keys`. Le commentaire du fichier dit pourquoi c'est obligatoire : sinon les refus du fournisseur sur ce chemin sont invisibles.
- Permissions : la table chat (déjà ouverte au rôle workers par task-457) et la file.

## Ce que fait le worker, par message

Le contenu exact du message SQS est celui que le relais d'outbox expédiera (tâche dépendante d'un benchmark séparé) : identifiants de compte, conversation, tour, tentative. Le worker relit tout le reste en DynamoDB.

1. **Idempotence** (Decision point 4) : une livraison dupliquée ne crée ni deuxième réponse visible ni deuxième débit. Claim de la tentative sous condition et bail ; une tentative déjà terminale ou sous bail vivant est acquittée sans appel LLM — sur le modèle de `claim_artifact_generation` des artefacts (README §2.2). Le débit est déjà fait à l'acceptation ; le worker ne débite pas. Le Decision le dit : un crash après appel fournisseur peut provoquer un nouvel appel ; ne pas promettre une exécution exactement une fois.
2. **Prompt** par le module partagé posé par la tâche d'envoi d'un tour : corpus en préfixe stable reconstruit depuis l'instantané de la conversation, instructions, historique avec rôles, question. Revérifier le budget avec la même règle ; un dépassement scelle le tour en échec typé, jamais une troncature.
3. **Appel en flux** avec les paramètres de `llm_config.chat_completion_parameters()`, plafond de sortie compris (décision de l'owner du 2026-10-10 : pas de plafond propre au chat, voir task-460), et **écriture des fragments** avec numéro de séquence croissant et TTL, sous condition d'identité de tentative (une tentative périmée ne peut plus écrire). Cadence de vidange regroupant les deltas (le complément C1.8 chiffre une vidange toutes les 200 ms).
3 bis. **Réponse coupée par le plafond** : quand le fournisseur termine avec `finish_reason == "length"`, le texte reçu est conservé et le tour est scellé en état **interrompu** avec la cause « plafond de sortie atteint », jamais en terminé (Decision point 6 : une réponse interrompue reste identifiable comme telle). Si rien de visible n'a été produit, le tour est scellé en échec typé. Aucune nouvelle tentative automatique : elle repartirait sur le même plafond.
4. **Arrêt observé** (Decision point 6) : le worker relit la demande d'annulation pendant le flux, interrompt sa consommation du flux fournisseur, conserve le partiel et scelle en état **interrompu** explicite.
5. **Échecs** (Decision point 2) : erreurs transitoires **avant émission de texte** → tentatives courtes et bornées dans le worker ; erreur après émission de texte → le partiel est conservé et le tour scellé en échec partiel identifiable (complément C1.11 point 1 : un texte déjà streamé ne se retire pas). Refus permanents du fournisseur selon la taxonomie `llm_failure` (acquittement, pas de redélivrance brûlée). Toute nouvelle tentative a sa propre identité et ne concatène jamais sa réponse au partiel d'une autre.
5 bis. **Remboursement** (décision de l'owner du 2026-10-10) : chaque fois que le worker scelle un tour en **échec sans aucun texte visible** (refus permanent, tentatives épuisées avant le premier texte, budget dépassé, fin en `length` sans texte), il appelle l'opération de remboursement de task-462 après le scellement. Un tour interrompu ou en échec partiel n'est pas remboursé. L'idempotence de l'opération couvre une redélivrance qui rescellerait le même tour.
6. **Fin** : la réponse finale et son état terminal sont persistés **avant** toute notification de fin (Decision point 3) ; l'identité de génération en cours est effacée sous condition.
7. **Usage et coût** par la couche commune et `llm_pricing.estimate_llm_cost_eur` (tarifs Luna, cache, marche des 272 000), y compris l'usage estimé et marqué quand le flux ne le livre pas ; enregistrement par `record_observed_cost` sous un token propre au tour. Les champs d'usage par tour (tokens d'entrée, en cache, de sortie, latence) sont lisibles sur les items, comme ceux des artefacts.

## Règles

Rien n'est déployé : pas de compatibilité. Pas de tests automatisés. Documentation : `docs/INGESTION_WORKERS_PROVIDERS.md` (le worker de chat, sa file, sa politique de reprise) et le runbook d'exploitation existant le plus proche (DLQ du chat).

## Note à l'owner

Le worker ne recevra de messages qu'une fois le relais d'outbox livré. Après merge et `terraform apply`, vérifier en `-dev` la file, la DLQ, la Lambda et la présence du worker dans les filtres LLM. Le contrôle du débit de tokens partagé avec les artefacts fait l'objet d'un benchmark et d'une tâche séparés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Une file SQS de chat et sa DLQ, et un worker Lambda de chat dans local.workers nommé media-summarizer-worker-…, sont déclarés avec leur propre concurrence, timeout, visibilité et maxReceiveCount justifiés en commentaire, la visibilité dépassant le timeout ; terraform validate passe
- [ ] #2 Le worker de chat figure dans llm_worker_keys de llm_alerts.tf
- [ ] #3 Le worker claim la tentative sous condition et bail, acquitte sans appel LLM une tentative terminale ou sous bail vivant, et ne débite aucun quota
- [ ] #4 Le worker construit sa requête par le module de prompt partagé et llm_config.chat_completion_parameters(), donc gpt-6-luna, et revérifie le budget de contexte avec la même règle que l'acceptation
- [ ] #5 Les fragments sont écrits en flux avec numéro de séquence et TTL sous condition d'identité de tentative, et la réponse finale et son état terminal sont persistés avant l'effacement de la génération en cours
- [ ] #6 Une demande d'annulation observée pendant le flux interrompt la consommation du flux fournisseur et scelle le partiel en état interrompu ; une fin en finish_reason length scelle le tour en interrompu avec la cause plafond de sortie (en échec typé s'il n'a produit aucun texte visible), sans nouvelle tentative automatique
- [ ] #7 Les erreurs transitoires avant le premier texte sont retentées de façon bornée dans le worker, une erreur après le premier texte scelle un échec partiel identifiable, et les refus permanents suivent la taxonomie llm_failure
- [ ] #8 L'usage et le coût de chaque tour sont enregistrés par la couche commune, estimés et marqués quand le flux ne livre pas l'usage ; docs/INGESTION_WORKERS_PROVIDERS.md décrit le worker, sa file et sa politique de reprise ; ruff check et mypy passent
- [ ] #9 Un tour scellé par le worker en échec sans texte visible déclenche l'opération de remboursement de task-462 ; un tour interrompu ou en échec partiel n'en déclenche pas
<!-- AC:END -->
