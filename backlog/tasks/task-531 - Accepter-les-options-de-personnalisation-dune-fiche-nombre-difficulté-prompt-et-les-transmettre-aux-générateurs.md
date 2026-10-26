---
id: TASK-531
title: >-
  Accepter les options de personnalisation d'une fiche (longueur, nombre,
  difficulté, prompt) et les transmettre aux générateurs
status: To Do
assignee: []
created_date: '2026-10-26 16:46'
updated_date: '2026-10-26 17:01'
labels:
  - backend
  - artifacts
  - llm
dependencies:
  - TASK-537
references:
  - mobile-design-mockups/ai_tab_notebooklm/README.md
  - media_summarizer/api/endpoints/artifacts.py
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/workers/artifact_generator/generators/quiz.py
  - media_summarizer/workers/artifact_generator/generators/flashcards.py
  - media_summarizer/workers/artifact_generator/generators/summary_short.py
  - media_summarizer/workers/artifact_generator/generators/notes.py
  - media_summarizer/core/services/llm_corpus.py
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/CANONICAL_MEDIA_API_OPENAPI.yaml
priority: high
type: feature
ordinal: 138000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'onglet IA est refait sur le modèle du Studio de NotebookLM (maquette : `mobile-design-mockups/ai_tab_notebooklm/`). Avant chaque création, un écran « Personnaliser » propose des options. Aujourd'hui, `POST /artifacts` accepte un champ `parameters` libre, mais le service n'y ajoute que la langue, et aucun générateur ne lit autre chose.

Cette tâche fournit au backend les options propres à chaque format et le prompt. Elle passe après TASK-537, qui supprime `summary_detailed` : il reste quatre types (`summary_short`, `notes`, `flashcards`, `quiz`). Les sources (TASK-532) et la langue explicite (TASK-533) font chacune l'objet d'une tâche à part.

## Contrat des options (dans `parameters`)

| Clé | Valeurs | Types concernés | Défaut |
|---|---|---|---|
| `length` | `short`, `medium`, `long` | `summary_short` | `short` |
| `count` | `fewer`, `standard`, `more` | `quiz`, `flashcards` | `standard` |
| `difficulty` | `easy`, `medium`, `hard` | `quiz`, `flashcards` | `medium` |
| `focus` | texte libre, 300 caractères au plus après nettoyage des espaces | les quatre types | absent |

- **Une valeur par défaut est retirée de `parameters` avant le hachage**, comme une chaîne `focus` vide. Une requête avec les valeurs par défaut produit donc le même `artifact_id` et le même `build_shared_artifact_id` qu'une requête sans options. Les fiches existantes et la mutualisation entre comptes (task-394) continuent de jouer.
- **Une clé inconnue, une valeur hors liste, ou une option qui ne s'applique pas au type demandé** (par exemple `count` sur `notes`, `length` sur `quiz`) répond par une 422 typée. Aucune entrée n'est créée et rien n'est débité.
- **`language` reste posé par le service** à partir de la langue de lecture. Si le client l'envoie, il est rejeté jusqu'à TASK-533. **`source_ids` est rejeté jusqu'à TASK-532.**

## Effet dans les générateurs

- **`length`** (résumé) : même schéma (`title`, `key_points`, `takeaway`), seule la profondeur change.
  - `short` : comportement actuel, l'essentiel pour un digest ;
  - `medium` : les points importants, avec une phrase d'explication chacun ;
  - `long` : tout le contenu couvert (`coverage_instruction` et `source_balance_instruction`), au niveau de détail de l'ancien résumé détaillé.
- **`count`** :
  - `standard` garde la consigne actuelle (« la matière décide du nombre ») ;
  - `fewer` demande seulement l'essentiel, environ la moitié de ce que la matière justifierait ;
  - `more` demande d'aller jusqu'aux points secondaires, environ le double ;
  - les schémas ne changent pas.
- **`difficulty`** : une consigne par niveau.
  - `easy` : rappel direct des faits énoncés ;
  - `medium` : comportement actuel ;
  - `hard` : application, comparaison, distracteurs plausibles pour le quiz.
- **`focus`** :
  - inséré après le corpus, comme les autres consignes de type, pour ne pas casser le préfixe mis en cache (voir l'en-tête de `llm_corpus.py`) ;
  - délimité et présenté comme une demande de l'utilisateur sur le sujet à privilégier, jamais comme une instruction qui remplace les règles ;
  - si le corpus ne traite pas le sujet, la fiche le dit au lieu d'inventer.
- Les fragments partagés entre générateurs vont dans `llm_corpus.py`, selon la règle de ce fichier.

## Documentation

`docs/CANONICAL_MEDIA_API_CONTRACT.md` et `docs/CANONICAL_MEDIA_API_OPENAPI.yaml` décrivent les clés, les valeurs, les défauts et la 422.

Note pour le propriétaire : vérifier après déploiement, sur `-dev`, qu'un résumé `long` couvre bien toute la source, et qu'un quiz `hard` / `fewer` avec un `focus` produit moins de questions, centrées sur le sujet. Vérification manuelle, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La requête de création valide length, count, difficulty et focus selon le tableau du contrat : une clé inconnue, une valeur hors liste ou une option non applicable au type répond 422 typée, sans entrée créée ni débit
- [x] #2 Les valeurs par défaut et un focus vide sont retirés des paramètres avant le hachage : artifact_id et build_shared_artifact_id d'une requête aux valeurs par défaut sont identiques à ceux d'une requête sans options
- [x] #3 Le générateur summary_short applique length (long couvre tout le contenu, avec équilibre entre sources) sans changer son schéma ; quiz et flashcards appliquent count et difficulty ; les quatre générateurs appliquent focus, placé après le corpus et délimité comme une demande de l'utilisateur
- [x] #4 language et source_ids envoyés par le client sont rejetés (levés par TASK-533 et TASK-532)
- [x] #5 Le contrat d'API (markdown et OpenAPI) documente les clés, les valeurs, les défauts et la 422
- [x] #6 ruff et mypy passent sans erreur sur les fichiers modifiés
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Tâches liées : sous-ensemble de sources en TASK-532, langue explicite en TASK-533. Les refus de `source_ids` et de `language` posés ici sont levés par ces deux tâches.

### Réalisé (2026-10-26)

- **Vocabulaire** : `media_summarizer/core/models/artifact_options.py` (enums `SummaryLength`, `ItemCount`, `Difficulty`, défauts, `MAX_FOCUS_CHARS = 300`, `clean_focus`, lecture `ArtifactOptions.from_parameters` côté worker).
- **Règle de requête** : `artifact_service.resolve_request_options` valide `parameters` contre `OPTIONS_BY_ARTIFACT_TYPE` et renvoie les options sans aucun défaut (une valeur par défaut, un `focus` vide après nettoyage et un `null` sont retirés). `plan_artifact_generation(options=…)` y ajoute `language` : un `{}` donne exactement le matériau haché avant la tâche (`{"language": …}`), donc les fiches existantes, `artifact_id` et l'id partagé (task-394) ne bougent pas.
- **422 typée** : `POST /api/artifacts` appelle `resolve_request_options` en premier, avant la vérification de propriété, la résolution des sources, le quota et toute écriture. Corps : `error_code: invalid_artifact_parameters`, `parameter`, `reason` ∈ `unknown_parameter`, `not_accepted` (`language`, `source_ids`), `not_applicable`, `invalid_value`. Un type inconnu garde son 400.
- **Générateurs** : fragments partagés dans `llm_corpus.py` (`count_instruction`, `difficulty_instruction`, `focus_instruction`, `extra_rule`, variante `exhaustive=False` de `source_balance_instruction` pour `fewer`). `summary_short` lit `length` (`long` = intro et profondeur de l'ancien résumé détaillé + `source_balance_instruction`, même schéma) ; quiz et cartes lisent `count` et `difficulty` (le quiz `hard` change aussi la règle des distracteurs) ; les quatre lisent `focus`, placé après les règles, donc après le corpus, entre deux marqueurs, présenté comme les mots du lecteur. Sujet absent : dit dans la 1re entrée de `key_points` (résumé), `context` (notes), `title` (quiz, cartes). `review_blurb` reçoit les options et les ignore. Versions de prompt : summary v5, quiz v5, flashcards v5, notes v6.
- **Prompts par défaut inchangés** : vérifié en comparant, sur un corpus fixe, les prompts des cinq générateurs produits par `HEAD` et par la branche sans options : identiques octet pour octet.
- **Contrat** : `docs/CANONICAL_MEDIA_API_CONTRACT.md` §3 (tableau des options, règle des défauts, effet de chaque option, ligne et corps de la 422) ; `docs/CANONICAL_MEDIA_API_OPENAPI.yaml` : le POST documenté sur la route par média supprimée (task-270) est déplacé sur `POST /api/artifacts`, avec `ArtifactCreateRequest` à jour, `ArtifactGenerationOptions`, `ArtifactCreateResponse` réel et la réponse 422 `ArtifactRequestRefused`.
- **Traduction (task-395)** : `artifact_translation_service` traduit toujours l'entrée `ready` la plus ancienne d'un type, options comprises (elles sont recopiées). Son chemin rapide ne cherche que le pointeur d'une requête aux défauts : quand l'entrée la plus ancienne porte des options, chaque ouverture coûte deux lectures avant de s'arrêter, et les autres variantes d'un même type restent dans leur langue. C'est documenté dans le code, pas corrigé ici ; TASK-533 retouche ce service.
- Aucun test automatisé ajouté (règle du projet). Rien de déployé : la vérification manuelle sur `-dev` décrite dans la note pour le propriétaire reste à faire après le push.
<!-- SECTION:NOTES:END -->
