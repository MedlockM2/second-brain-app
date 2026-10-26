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
- [ ] #1 La requête de création valide length, count, difficulty et focus selon le tableau du contrat : une clé inconnue, une valeur hors liste ou une option non applicable au type répond 422 typée, sans entrée créée ni débit
- [ ] #2 Les valeurs par défaut et un focus vide sont retirés des paramètres avant le hachage : artifact_id et build_shared_artifact_id d'une requête aux valeurs par défaut sont identiques à ceux d'une requête sans options
- [ ] #3 Le générateur summary_short applique length (long couvre tout le contenu, avec équilibre entre sources) sans changer son schéma ; quiz et flashcards appliquent count et difficulty ; les quatre générateurs appliquent focus, placé après le corpus et délimité comme une demande de l'utilisateur
- [ ] #4 language et source_ids envoyés par le client sont rejetés (levés par TASK-533 et TASK-532)
- [ ] #5 Le contrat d'API (markdown et OpenAPI) documente les clés, les valeurs, les défauts et la 422
- [ ] #6 ruff et mypy passent sans erreur sur les fichiers modifiés
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Tâches liées : sous-ensemble de sources en TASK-532, langue explicite en TASK-533. Les refus de `source_ids` et de `language` posés ici sont levés par ces deux tâches.
<!-- SECTION:NOTES:END -->
