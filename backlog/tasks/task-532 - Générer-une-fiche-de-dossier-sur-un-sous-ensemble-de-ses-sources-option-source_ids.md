---
id: TASK-532
title: >-
  Générer une fiche de dossier sur un sous-ensemble de ses sources (option
  source_ids)
status: To Do
assignee: []
created_date: '2026-10-26 16:46'
updated_date: '2026-10-26 17:01'
labels:
  - backend
  - artifacts
dependencies:
  - TASK-531
references:
  - mobile-design-mockups/ai_tab_notebooklm/README.md
  - media_summarizer/api/endpoints/artifacts.py
  - media_summarizer/core/services/artifact_service.py
  - docs/research/task-287-consumption-model/README.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/CANONICAL_MEDIA_API_OPENAPI.yaml
priority: medium
type: feature
ordinal: 139000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'écran « Personnaliser » d'un dossier propose, comme NotebookLM, de choisir les sources sur lesquelles porte la fiche. Toutes sont cochées par défaut (maquette : `mobile-design-mockups/ai_tab_notebooklm/`). Aujourd'hui, `resolve_scope_sources` prend toujours toutes les sources du dossier.

## Périmètre

- Ajouter une option `source_ids` dans `parameters`, valable seulement pour `scope = folder`. C'est une liste non vide d'identifiants de médias du dossier, sans doublon.
- **Validation**, avec une 422 typée sans entrée créée ni débit :
  - option envoyée sur un média ;
  - liste vide ;
  - identifiant qui n'appartient pas au dossier ou à l'utilisateur.
- **La résolution se limite à ces sources.** Les exclusions existantes (source pas prête, illisible, etc.) et les plafonds (`enforce_scope_ceilings`) s'appliquent au sous-ensemble.
- **L'ensemble choisi entre dans l'identité de la fiche par la liste de sources déjà hachée** (`expected_source_ids`), pas une seconde fois par `parameters` : `source_ids` est retiré de `parameters` avant le hachage. Si la liste couvre toutes les sources du dossier, la requête équivaut à une requête sans l'option.
- **Le débit suit la règle de task-287** (1 minute pour 5 sources), calculé sur les sources retenues.
- La ligne d'historique garde `source_count`, qui reflète alors le sous-ensemble.
- Documenter l'option dans le contrat d'API (markdown et OpenAPI).

Note pour le propriétaire : vérifier après déploiement, sur `-dev`, qu'une fiche sur 5 sources d'un dossier qui en compte 15 débite 1 minute et que son `sources` en liste 5. Vérification manuelle, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 parameters.source_ids est accepté sur un dossier et restreint la résolution des sources à ce sous-ensemble ; exclusions et plafonds s'appliquent au sous-ensemble
- [ ] #2 Option sur un média, liste vide, ou identifiant étranger au dossier ou à l'utilisateur : 422 typée, sans entrée créée ni débit
- [ ] #3 source_ids est retiré des paramètres hachés ; une liste couvrant tout le dossier donne le même artifact_id qu'une requête sans l'option
- [ ] #4 Le débit en minutes est calculé sur les sources retenues, selon la règle 1 min pour 5 sources
- [ ] #5 Le contrat d'API (markdown et OpenAPI) documente l'option et ses refus
- [ ] #6 ruff et mypy passent sans erreur sur les fichiers modifiés
- [ ] #7 source_ids est accepté pour les quatre types de fiche (summary_short, notes, flashcards, quiz), sans exception par type
<!-- AC:END -->
