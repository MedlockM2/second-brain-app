---
id: TASK-533
title: >-
  Permettre de choisir la langue d'une fiche à sa création, sans qu'elle soit
  retraduite dans la langue de lecture
status: To Do
assignee: []
created_date: '2026-10-26 16:46'
updated_date: '2026-10-26 17:01'
labels:
  - backend
  - artifacts
  - i18n
dependencies:
  - TASK-531
references:
  - mobile-design-mockups/ai_tab_notebooklm/README.md
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/api/endpoints/artifacts.py
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/CANONICAL_MEDIA_API_OPENAPI.yaml
priority: medium
type: feature
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'écran « Personnaliser » propose, comme NotebookLM, une option « Langue ». La langue de lecture y est sélectionnée par défaut (maquette : `mobile-design-mockups/ai_tab_notebooklm/`).

Aujourd'hui, la langue de sortie suit toujours `reading_language` : `plan_artifact_generation` écrase `parameters["language"]` (task-398). De plus, quand le lecteur change de langue, les fiches sont traduites dans sa nouvelle langue au lieu d'être regénérées (task-395, `_arm_reading_language_translations`). Si l'on se contente de remplacer la langue, une fiche demandée en anglais par un lecteur francophone serait aussitôt retraduite en français : le choix serait perdu.

## Périmètre

- **Accepter `parameters.language`** envoyé par le client. C'est une étiquette parmi les langues que le service sait déjà normaliser (`normalize_language_tag`) ; sinon, 422 typée sans entrée ni débit. Cela lève le refus posé par TASK-531.
- **Égale à la langue de lecture, elle équivaut à une requête sans l'option** : même `artifact_id`, même comportement de traduction qu'aujourd'hui.
- **Différente, elle devient la langue de sortie et entre dans le hachage**, comme aujourd'hui. L'entrée est marquée comme fixée par l'utilisateur. Le marqueur est au choix de l'implémenteur, et il doit survivre à la relecture DynamoDB (`normalize_artifact_parameters`).
- **Une fiche à langue fixée n'est jamais armée pour une traduction** vers la langue de lecture, ni à la liste, ni à la lecture du contenu. Elle se lit dans sa langue.
- **Mutualisation entre comptes (task-394)** : une fiche à langue fixée peut être servie à un autre compte qui demande la même langue fixée, puisque la clé partagée inclut déjà les paramètres. Elle ne sert jamais une demande sans langue fixée.
- Documenter l'option et la règle de traduction dans le contrat d'API (markdown et OpenAPI).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 parameters.language envoyé par le client est accepté s'il est normalisable, sinon 422 typée sans entrée ni débit
- [ ] #2 Une langue égale à la langue de lecture donne le même artifact_id et le même comportement de traduction qu'une requête sans l'option
- [ ] #3 Une langue différente devient la langue de sortie, et l'entrée porte un marqueur de langue fixée qui survit à normalize_artifact_parameters
- [ ] #4 Une entrée à langue fixée n'est jamais armée pour une traduction vers la langue de lecture, ni par la liste ni par la lecture du contenu
- [ ] #5 Le contrat d'API (markdown et OpenAPI) documente l'option et la règle de traduction
- [ ] #6 ruff et mypy passent sans erreur sur les fichiers modifiés
- [ ] #7 parameters.language est accepté pour les quatre types de fiche (summary_short, notes, flashcards, quiz), sur un média comme sur un dossier
<!-- AC:END -->
