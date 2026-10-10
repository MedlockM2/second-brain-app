---
id: TASK-439
title: 'Unifier sur GPT-6 Luna le modèle des artefacts, des aperçus et du futur chat'
status: Done
assignee: []
created_date: '2026-10-10 14:22'
updated_date: '2026-10-10 16:41'
labels:
  - backend
  - llm
  - artifacts
  - feature
dependencies: []
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - docs/research/task-72-llm-artifact-benchmark/README.md
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/core/services/llm_pricing.py
  - media_summarizer/core/services/pricing_config_service.py
  - .env.example
  - 'https://developers.openai.com/api/docs/models/gpt-6-luna'
  - 'https://developers.openai.com/api/docs/pricing'
modified_files:
  - media_summarizer/core/services/llm_config.py
  - media_summarizer/core/services/llm_pricing.py
  - media_summarizer/core/models/media_artifact.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/workers/artifact_generator/generators/base.py
  - media_summarizer/workers/artifact_generator/generators/summary_short.py
  - media_summarizer/workers/artifact_generator/generators/summary_detailed.py
  - media_summarizer/workers/artifact_generator/generators/notes.py
  - media_summarizer/workers/artifact_generator/generators/flashcards.py
  - media_summarizer/workers/artifact_generator/generators/quiz.py
  - media_summarizer/workers/artifact_generator/generators/review_blurb.py
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/core/services/artifact_translation_service.py
  - media_summarizer/core/services/pricing_config_service.py
  - media_summarizer/scripts/purge_review_blurbs.py
  - .env.example
  - docs/INGESTION_WORKERS_PROVIDERS.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: medium
type: enhancement
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Décision explicite de l'owner du 2026-10-10 : utiliser OpenAI `gpt-6-luna` en mode Standard pour le chat, la génération de tous les artefacts et celle des aperçus. Aucun nouveau benchmark comparatif, essai de plusieurs modèles ou tâche de sélection préalable n'est demandé. Cette décision remplace le choix par type de task-72 et étend le choix initialement limité au chatbot dans task-430.

L'objectif est de supprimer la dispersion actuelle des modèles et de rendre cohérents le modèle réellement appelé, les paramètres API, les identités de génération et le coût enregistré. Remplacer uniquement OPENAI_MODEL laisserait notamment le résumé court sur un autre modèle et les règles actuelles de reconnaissance GPT-4/GPT-5 pourraient désactiver les sorties structurées ou envoyer des paramètres inadaptés.

Périmètre existant : résumés courts et détaillés, notes, flashcards, quiz et aperçu interne `review_blurb`, sur média et dossier lorsque le parcours existe. La retraduction des artefacts et des aperçus est incluse. La demande explicite porte aussi sur le changement de modèle du quiz ; elle autorise cette modification limitée malgré la restriction générale d'AGENTS.md, sans refonte fonctionnelle du quiz.

Le chatbot n'est pas encore implémenté. Cette tâche livre la configuration et les capacités LLM communes nécessaires à son intégration ; task-431 doit faire dépendre les futures tâches d'appel LLM du chat de ce socle et leur imposer Luna dès la première livraison. La clôture de cette tâche ne requiert pas d'avoir construit le chat. Les futurs artefacts, notamment le script de podcast de task-387, doivent également consommer ce choix commun ; le fournisseur de synthèse vocale reste régi par task-386.

Le modèle reste configurable, mais le paramétrage livré doit sélectionner Luna pour tous ces parcours. Supprimer les sélections et replis obsolètes au lieu de conserver deux chemins. Le choix de modèle ne relève pas les plafonds de corpus ni ne change les quotas produit. Aucun backfill ou régénération des contenus déjà stockés n'est requis.

Note à l'owner après merge et déploiement : vérifier sur l'API dev réelle la génération des types existants, un aperçu et une retraduction, ainsi que le modèle et l'usage enregistrés. Ces vérifications déployées ne sont pas des critères bloquants de l'agent. Aucun test automatisé ni benchmark multi-modèles à ajouter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les générateurs existants de résumés courts et détaillés, notes, flashcards, quiz et review_blurb, ainsi que la retraduction des artefacts et aperçus, sélectionnent gpt-6-luna dans le paramétrage livré ; les valeurs par défaut et exemples de configuration ne sélectionnent plus d'ancien modèle pour ces parcours.
- [x] #2 Le choix du modèle a une source de configuration commune utilisable par le futur chat et les futurs artefacts ; aucune sélection divergente par type ni repli vers un ancien modèle ne subsiste dans les parcours concernés.
- [x] #3 Les appels LLM des parcours concernés utilisent les paramètres pris en charge par Luna d'après la documentation officielle : réglage de raisonnement explicite et documenté, limites de sortie et paramètres de sampling cohérents ; les sorties structurées et le cache de prompt restent câblés pour les générateurs qui les utilisent.
- [x] #4 Le modèle effectivement appelé figure dans les métadonnées d'usage et les identités/versions de génération ; les clés de réutilisation ou de cache des nouvelles générations ne présentent pas un ancien résultat comme une génération Luna.
- [x] #5 Le calcul et les configurations de coût des parcours concernés connaissent les tarifs Standard de Luna, les entrées mises en cache et les éventuels paliers de contexte applicables, avec source et date documentées ; Luna ne tombe plus sur le tarif de repli d'un autre modèle.
- [x] #6 La documentation de configuration et de livraison décrit les variables retenues, les anciens réglages à retirer ou remplacer dans l'environnement runtime et l'intégration attendue par les tâches du chat, sans ajouter de migration de données ni modifier les plafonds de corpus ou les quotas produit.
- [x] #7 ruff check et mypy passent sur les fichiers Python concernés ; les vérifications statiques effectuées et les limites de vérification sont consignées dans les Implementation Notes, sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implémentation

- **Source unique** : nouveau `media_summarizer/core/services/llm_config.py` — `LLM_MODEL` (défaut `gpt-6-luna`), `LLM_REASONING_EFFORT` (défaut `medium`), `LLM_MAX_COMPLETION_TOKENS` (défaut 64000) et `chat_completion_parameters()`, que le worker d'artefacts utilise et que le futur chat devra utiliser.
- **Sélections supprimées** : `default_model` retiré du protocole et des 6 générateurs ; `OPENAI_MODEL`, `SUMMARY_SHORT/SUMMARY_DETAILED/NOTES/FLASHCARDS/QUIZ_LLM_MODEL`, `LLM_TEMPERATURE` et les surcharges `*_ARTIFACT_GENERATOR_VERSION` ne sont plus lus. La retraduction d'artefact (worker + `artifact_translation_service`) utilise `LLM_MODEL` au lieu de `TRANSLATION_MODEL`. La traduction de transcript (task-189) est hors périmètre et garde `TRANSLATION_LLM_MODEL`.
- **Paramètres API** (page modèle gpt-6-luna lue le 2026-10-10) : `reasoning_effort` explicite, `max_completion_tokens` explicite, plus de `temperature`. Les sorties structurées sont toujours envoyées quand le générateur a un schéma (l'ancien test par marqueurs `gpt-4o/gpt-5/gpt-4.1` les aurait désactivées pour Luna). `prompt_cache_key` reste envoyé.
- **Identités** : `generator_version` = `<type>:<LLM_MODEL>:<prompt-version>` ; version de traduction `…:translated:<LLM_MODEL>:prompt-v1` ; le modèle entre dans `prompt_cache_key`. `ArtifactLlmUsage` porte `model` (celui renvoyé par le fournisseur) et `cache_write_tokens`, persistés en DynamoDB. `build_artifact_id` est inchangé : une ancienne entrée réutilisée garde son propre `generator_version`, qui nomme son ancien modèle.
- **Coût** : `llm_pricing` ne liste plus que gpt-6-luna Standard (entrée 0,10 $, entrée en cache 0,01 $, écriture en cache 0,125 $, sortie 0,50 $ ; au-delà de 272K tokens de prompt, 0,20/0,02/0,25/0,75 sur toute la requête), avec source et date. Les écritures en cache sont lues depuis `prompt_tokens_details.cache_write_tokens`. `pricing_config.providers.llm` = `{model: gpt-6-luna, processing: standard}`.
- **Docs** : `.env.example` (section 10), `docs/INGESTION_WORKERS_PROVIDERS.md` (modèle, variables, réglages à retirer, intégration attendue pour task-431), exemple de `docs/CANONICAL_MEDIA_API_CONTRACT.md`.

## Vérifications

- `uv run ruff check` et `uv run mypy` sur les 19 fichiers Python concernés : OK.
- `scripts/check_env_example_complete.py` : OK.
- `estimate_llm_cost_eur` évalué à la main sur le palier court et le palier long : résultats conformes.
- Aucun test ajouté.

## Limites

- Le nom du champ `cache_write_tokens` de Chat Completions vient du SDK OpenAI et du guide prompt caching (en-tête Responses `input_tokens_details`) ; je n'ai pas eu accès à la référence officielle de Chat Completions. Si le champ est absent, ces tokens sont comptés au tarif d'entrée normal, donc le coût est un peu sous-estimé (0,10 $ au lieu de 0,125 $).
- `docs/V1_LAUNCH_PLAN.md:577` mentionne encore `OPENAI_MODEL=gpt-5.4-nano…`. Je ne l'ai pas modifié parce que le fichier contient des modifications de l'owner non commitées.

## Vérification AWS (profils `second-brain-app` et `prod`)

Correction de la limite ci-dessus : les identifiants existaient, mais je n'avais testé que le profil par défaut.
- `media-summarizer-runtime-dev` et `media-summarizer-runtime-prod` : la seule clé LLM présente est `OPENAI_MODEL`. Aucune clé `*_LLM_MODEL`, `LLM_TEMPERATURE`, `LLM_*` ni `*_GENERATOR_VERSION`. Le code ne lit plus `OPENAI_MODEL`. La clé a été supprimée des deux secrets le 2026-10-10 (nouvelles versions dev `85039da4…` et prod `71145690…`) : le secret ne contient que des identifiants, et le modèle est défini dans le code.
- Variables d'environnement de la Lambda `media-summarizer-worker-artifact_generator-dev` : aucune variable de modèle ou LLM.
- `pricing_config-dev` : aucune ligne `providers` et rien qui mentionne `llm` ou `gpt`. Il n'y a rien à nettoyer dans cette table.
<!-- SECTION:NOTES:END -->
