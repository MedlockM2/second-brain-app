---
id: TASK-556
title: Passer la traduction du texte complet des médias sur GPT-6 Luna
status: To Do
assignee: []
created_date: '2026-10-27 16:21'
labels:
  - backend
  - llm
  - translation
dependencies: []
references:
  - media_summarizer/core/services/transcript_translation.py
  - media_summarizer/core/services/llm_config.py
  - media_summarizer/core/services/llm_pricing.py
  - docs/research/task-72-llm-artifact-benchmark/README.md
  - docs/research/task-547-beta-budget-control/README.md
priority: high
type: enhancement
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

La décision owner du 2026-10-10 (docs/research/task-72-llm-artifact-benchmark/README.md, Owner Validation) a unifié sur `gpt-6-luna` en mode Standard les artefacts, les aperçus `review_blurb` et la retraduction des artefacts. La traduction du texte complet d'un média (transcription ou document, pour la lecture) est restée hors de cette bascule : `core/services/transcript_translation.py` appelle toujours `gpt-5-nano-2025-08-07` (décision task-189), avec ses propres constantes de prix. Le 2026-10-27, l'owner a décidé d'étendre Luna à cette traduction aussi. C'est un choix de modèle déjà validé ailleurs : aucun benchmark n'est requis.

## Périmètre

- Faire utiliser à la traduction le modèle commun de `core/services/llm_config.py` (`LLM_MODEL`) au lieu de `TRANSLATION_LLM_MODEL`, dans les mêmes conditions (mode Standard). Supprimer `TRANSLATION_LLM_MODEL`, le défaut GPT-5-nano et les constantes de prix locales `_INPUT_USD_PER_1M` / `_OUTPUT_USD_PER_1M` : le coût passe par `core/services/llm_pricing.py`, comme le reste des appels Luna (tarifs court/long contexte et cache). Rien n'est déployé : pas de repli sur nano, pas de période de transition.
- Vérifier sur la page du modèle (https://developers.openai.com/api/docs/models/gpt-6-luna) que les paramètres envoyés par la traduction sont acceptés par Luna (`reasoning_effort` éventuel, absence de paramètres refusés) et que la fenêtre de contexte couvre la plus longue entrée acceptée ; le commentaire « 400k-token window » de `_call_translation_llm` doit dire la vérité pour Luna.
- Mettre à jour les docstrings et commentaires qui nomment GPT-5-nano / task-189 comme modèle de traduction (`transcript_translation.py`, `llm_config.py` section « What is not governed here »), et noter l'extension dans l'Owner Validation de task-72 comme fait daté, sans réécrire sa décision.
- Ne pas toucher au plafond de sortie ni à la réservation budgétaire de la traduction : ils relèvent de TASK-548/TASK-549 (décision docs/research/task-547-beta-budget-control/README.md), qui réserveront au prix du modèle configuré.

## Note owner

Le passage effectif en dev se constate après le déploiement sur `main` (traduction d'un média étranger, modèle `gpt-6-luna` dans les journaux du worker de traduction) : vérification owner, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La traduction du texte complet appelle le modèle commun `llm_config.LLM_MODEL` ; `TRANSLATION_LLM_MODEL`, le défaut `gpt-5-nano-2025-08-07` et les constantes de prix locales de `transcript_translation.py` n'existent plus dans le code ni dans l'infrastructure.
- [ ] #2 Le coût d'une traduction est calculé par `llm_pricing` au tarif Luna applicable, sans double source de prix.
- [ ] #3 Les paramètres envoyés par la traduction et l'hypothèse de fenêtre de contexte sont conformes à la documentation Luna, citée avec sa date de consultation dans le code ou la note de tâche.
- [ ] #4 Docstrings, commentaires et Owner Validation de task-72 reflètent l'extension de Luna à la traduction du texte complet.
- [ ] #5 Ruff et mypy passent sur les fichiers backend modifiés ; terraform validate passe si l'infrastructure est modifiée.
<!-- AC:END -->
