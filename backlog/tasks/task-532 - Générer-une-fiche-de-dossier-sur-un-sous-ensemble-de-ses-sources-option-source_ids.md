---
id: TASK-532
title: >-
  Générer une fiche de dossier sur un sous-ensemble de ses sources (option
  source_ids)
status: Done
assignee: []
created_date: '2026-10-26 16:46'
updated_date: '2026-10-26 19:48'
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
- [x] #1 parameters.source_ids est accepté sur un dossier et restreint la résolution des sources à ce sous-ensemble ; exclusions et plafonds s'appliquent au sous-ensemble
- [x] #2 Option sur un média, liste vide, ou identifiant étranger au dossier ou à l'utilisateur : 422 typée, sans entrée créée ni débit
- [x] #3 source_ids est retiré des paramètres hachés ; une liste couvrant tout le dossier donne le même artifact_id qu'une requête sans l'option
- [x] #4 Le débit en minutes est calculé sur les sources retenues, selon la règle 1 min pour 5 sources
- [x] #5 Le contrat d'API (markdown et OpenAPI) documente l'option et ses refus
- [x] #6 ruff et mypy passent sans erreur sur les fichiers modifiés
- [x] #7 source_ids est accepté pour les quatre types de fiche (summary_short, notes, flashcards, quiz), sans exception par type
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Réalisé (2026-10-26)

- **Forme de l'option** : `artifact_service.resolve_source_selection(scope, parameters)`, appelée par `POST /api/artifacts` juste après `resolve_request_options`, avant toute lecture. Les refus :
  - sur un média : `not_applicable` ;
  - une liste vide, un élément qui n'est pas une chaîne non vide, ou un doublon : `invalid_value` ;
  - un `null` vaut une clé absente.

  Elle ne regarde pas le type : `source_ids` vaut pour les quatre types. `resolve_request_options` saute la clé pour tous les types, si bien qu'elle n'entre jamais dans les `parameters` stockés ni dans le hachage. Le refus `not_accepted` posé par task-531 ne vise plus que `language`.
- **Appartenance au dossier** : `resolve_scope_sources(source_ids=…)` liste les lignes du dossier et de ses sous-dossiers. `_list_scope_media_records` rend désormais toutes les lignes, doublons compris, et la déduplication par `media_key` passe dans `_one_row_per_content`. `_select_scope_rows` filtre ensuite **avant toute lecture de transcript**. Un id qui n'est pas une ligne du compte dans ce dossier est refusé avec la nouvelle raison `not_in_scope` : même 422 typée `invalid_artifact_parameters`, levée avant le plan, le quota et l'écriture, donc aucune entrée ni aucun débit.
  - Vérifié sur `-dev` : la clé de `user_media-dev` est `(user_id, media_item_id)` et `folder-index` est indexé sur `user_id`. Une ligne d'un autre compte ne peut donc pas remonter dans la liste.
  - Sur un échantillon de 50 lignes, toutes ont un `media_item_id` distinct du `media_key` : c'est bien l'id de la sauvegarde que le client envoie.
- **Exclusions, plafonds, débit** : tout ce qui suit lit la résolution, donc ne voit que le sous-ensemble :
  - les trois issues (lue, en attente, exclue) ;
  - `enforce_scope_ceilings` ;
  - `check_generation_allowed(source_count=len(expected_source_ids))` ;
  - `record_generation(source_count=record.source_count)`, soit 1 minute pour 5 sources (`minutes_for_folder_sources`, task-287) ;
  - `source_count` et `sources` de l'entrée.
- **Identité** : le sous-ensemble entre dans l'`artifact_id` uniquement par `expected_source_ids`. Une liste qui couvre tous les contenus du dossier (couverture jugée sur les `media_key`, pas sur les lignes) rend les lignes intactes et aucune sélection : la requête suit exactement le chemin sans option. Même `artifact_id`, même ligne écrite. Les lignes gardent l'ordre de la liste du dossier, si bien que le corpus ne dépend pas de l'ordre de la requête.
- **Reprise d'une attente (task-360)** : sans rien de plus, une entrée sur un sous-ensemble en attente d'une transcription aurait été reprise sur tout le dossier, puis terminée en `sources_changed`. L'entrée garde donc `selected_source_ids` (`MediaArtifactRecord`, écrit seulement pour un sous-ensemble strict, jamais haché), et `artifact_wait_service._resume_one` le repasse à `resolve_scope_sources`. Si une source choisie a quitté le dossier entre-temps, l'attente se termine en `sources_changed`.
- **Contrat** :
  - `docs/CANONICAL_MEDIA_API_CONTRACT.md` : ligne `source_ids` du tableau, paragraphe dédié (restriction, débit, non-hachage, équivalence de la liste complète, refus), reprise sur le même sous-ensemble, raisons `not_applicable`, `invalid_value` et `not_in_scope`, exemple de requête.
  - `docs/CANONICAL_MEDIA_API_OPENAPI.yaml` : propriété `source_ids` d'`ArtifactGenerationOptions` et valeur `not_in_scope` de l'énumération `reason`. Le YAML se lit sans erreur.
- **Vérifications** : `ruff check` et `mypy` ne signalent rien sur les quatre fichiers Python modifiés.
- Aucun test automatisé ajouté (règle du projet). Rien n'est déployé : la vérification sur `-dev` décrite dans la note pour le propriétaire (5 sources sur 15 : 1 minute débitée, 5 lignes dans `sources`) reste à faire après le push.
- **Pour task-533**, qui touche les mêmes fonctions : seule la ligne `_PARAMETERS_NOT_ACCEPTED` (et son commentaire) et la ligne `not_accepted` des deux contrats ont bougé côté langue. Le conflit attendu est trivial.
<!-- SECTION:NOTES:END -->
