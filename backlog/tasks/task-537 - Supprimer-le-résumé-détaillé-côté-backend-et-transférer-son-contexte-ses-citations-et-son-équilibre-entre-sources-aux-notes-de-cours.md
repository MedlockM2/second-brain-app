---
id: TASK-537
title: >-
  Supprimer le résumé détaillé côté backend et transférer son contexte, ses
  citations et son équilibre entre sources aux notes de cours
status: To Do
assignee: []
created_date: '2026-10-26 16:59'
labels:
  - backend
  - artifacts
  - cleanup
  - llm
  - infrastructure
dependencies: []
references:
  - mobile-design-mockups/ai_tab_notebooklm/README.md
  - media_summarizer/workers/artifact_generator/generators/summary_detailed.py
  - media_summarizer/workers/artifact_generator/generators/notes.py
  - media_summarizer/workers/artifact_generator/generators/__init__.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/core/models/media_artifact.py
  - media_summarizer/api/models/media_contracts.py
  - media_summarizer/api/endpoints/artifacts.py
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/core/services/llm_corpus.py
  - infrastructure/terraform/modules/platform/s3.tf
  - infrastructure/terraform/modules/platform/iam_lambda.tf
  - infrastructure/terraform/modules/platform/runtime_env.tf
  - infrastructure/terraform/modules/platform/sqs.tf
  - infrastructure/observability/slo-definitions.yaml
  - infrastructure/observability/runbooks/pipeline-alerts.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - docs/CANONICAL_MEDIA_API_OPENAPI.yaml
priority: high
type: chore
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Décision du propriétaire (2026-10-26) : le format « Résumé détaillé » (`summary_detailed`) est supprimé.
- Sa **profondeur** passe dans l'option `length` du résumé (TASK-531).
- Ce qu'il apportait en propre passe dans les **notes de cours**.

Le reste faisait doublon :
- `key_points` existe déjà dans les notes, avec la même règle de couverture ;
- `main_topics` est moins utile que les `concepts` des notes ;
- `conclusion` fait double emploi avec le `takeaway` du résumé.

Rien n'est déployé : pas de couche de compatibilité, on supprime dans la même tâche.

## Périmètre

**Ce que les notes de cours reprennent** (`notes.py`) :
- **`context`** : 2-3 phrases qui posent qui, quoi, pourquoi. Même consigne que l'actuel résumé détaillé ; facultatif quand les sources ne s'y prêtent pas.
- **`notable_quotes`** : liste de `{text, source_ref}`.
  - Facultatif, avec la même consigne : ne citer que les passages qui portent le propos, jamais un passage qu'un point clé énonce déjà.
  - `source_ref` obligatoire (`source_ref_instruction(required=True)`) et validé comme aujourd'hui dans `summary_detailed.py`.
  - Exception verbatim de `subject_matter_instruction` (`verbatim_exception=True`).
- **`source_balance_instruction`** sur `concepts` et `key_points`, pour qu'une fiche de dossier ne parle pas que des sources les plus longues.
- Les fragments restent partagés via `llm_corpus.py`. Le rang des nouveaux champs dans le schéma JSON est au choix de l'implémenteur ; le client (TASK-538) les affiche après le titre (`context`) et après les points clés (`notable_quotes`).

**Ce qui est supprimé** :
- Le générateur `summary_detailed.py`, son entrée dans `GENERATORS` et la valeur d'enum dans `media_artifact.py` et `media_contracts.py`.
- Toute branche du service et du worker qui le cite.
- Côté Terraform :
  - le bucket `aws_s3_bucket.summary_detailed` et sa sortie ;
  - ses droits IAM ;
  - la variable `SUMMARY_DETAILED_BUCKET` et sa lecture `required_env` dans `artifact_service.py` ;
  - la mention dans `sqs.tf`.
  - Le bucket doit pouvoir être détruit par l'apply : `force_destroy` le temps de la suppression, ou vidage documenté dans la note au propriétaire.
- Les mentions dans `slo-definitions.yaml` et `pipeline-alerts.md`.
- Les entrées `summary_detailed` de `media_artifacts-dev` (comptes et entrées partagées `shared_*`), supprimées avec l'AWS CLI (`AWS_PROFILE=second-brain-app`). `prod` n'a jamais servi.

**Contrat d'API** : `summary_detailed` disparaît des types acceptés. Une requête qui le nomme reçoit la même 400 qu'un type inconnu. Les nouveaux champs des notes sont documentés.

Note pour le propriétaire : l'apply Terraform qui suit le push détruit le bucket. Vérifier qu'il a réussi et que le worker démarre sans `SUMMARY_DETAILED_BUCKET`, puis générer des notes sur un dossier `-dev` pour voir le contexte et les citations sourcées. Vérifications manuelles, pas des critères d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le générateur notes produit context et notable_quotes (source_ref obligatoire et validée, citations facultatives) et applique source_balance_instruction à concepts et key_points
- [ ] #2 summary_detailed n'existe plus dans le code backend : générateur, registre, enums, service, worker, variable SUMMARY_DETAILED_BUCKET ; une requête qui le nomme reçoit la 400 d'un type inconnu
- [x] #3 Le bucket summary_detailed, ses droits IAM, sa sortie et sa variable d'environnement sont retirés de Terraform, et terraform validate passe
- [x] #4 Les entrées summary_detailed de media_artifacts-dev sont supprimées, vérifié par un scan AWS CLI qui n'en renvoie aucune
- [x] #5 slo-definitions.yaml, pipeline-alerts.md et le contrat d'API (markdown et OpenAPI) ne mentionnent plus summary_detailed et documentent les nouveaux champs des notes
- [x] #6 ruff et mypy passent sans erreur sur les fichiers modifiés
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Fait (code)**
- `generators/notes.py` : `context` (facultatif), `notable_quotes` (facultatif, `source_ref` obligatoire, validé comme l'ancien `SummaryDetailedQuote`), `source_balance_instruction` sur `concepts` et `key_points`, `verbatim_exception=True`. Version de prompt des notes passée à `prompt-v5`. Les notes existantes ne sont pas régénérées (l'id d'un artefact n'inclut pas la version).
- `summary_detailed` supprimé : `generators/summary_detailed.py` (git rm), registre `GENERATORS`, enums `MediaArtifactType` et `ArtifactType`, `REQUESTABLE_ARTIFACT_TYPES`, prompt version, `get_artifact_bucket`, `SUMMARY_DETAILED_BUCKET`, branche du worker, description de l'endpoint, `.env.example`.
- Changement de comportement, hors pure suppression : `artifact_service._artifact_type` levait un `ValueError` nu pour tout type inconnu, que l'endpoint transformait en 500. Il lève désormais `ArtifactTypeNotEnabledError`, donc la 400 `INVALID_ARTIFACT_TYPE`. Sans ce changement, « même 400 qu'un type inconnu » n'était pas vrai.
- Terraform : `aws_s3_bucket.summary_detailed` (et son `prevent_destroy`), sortie, droits IAM (4 occurrences), `SUMMARY_DETAILED_BUCKET` dans `runtime_env.tf`, commentaire de `sqs.tf`. `terraform validate` (module platform et env dev) : `Success`.
- Documentation : `slo-definitions.yaml`, `pipeline-alerts.md`, `CANONICAL_MEDIA_API_CONTRACT.md` (exemples, `notes.context` et `notes.notable_quotes`, liste des types), `CANONICAL_MEDIA_API_OPENAPI.yaml` (enums corrigées à `summary_short, quiz, notes, flashcards` ; l'ancienne valeur `summary` n'existait plus ; exemple notes complété), `INGESTION_WORKERS_PROVIDERS.md`.

**Vérifications**
- `ruff check` sur les 7 modules modifiés : `All checks passed!`. `mypy` sur les mêmes fichiers : `Success: no issues found in 7 source files`.
- `scripts/check_env_example_complete.py` : `OK`, 237 variables déclarées.
- DynamoDB `media_artifacts-dev` (profil `second-brain-app`) : scan avant suppression, 227 entrées (dont 4 `summary_detailed`, dont une `shared_`). Suppression des 4 par `delete-item`. Scan après : 223 entrées, `Count: 0` pour `artifact_type = summary_detailed`. Prod non touché.
- Plan dev en lecture seule (`plan -refresh=false -lock=false`, rien appliqué) : `1 to destroy` (le bucket), sans erreur `prevent_destroy`. Le plan a demandé deux variables Cognito sensibles, que je n'ai pas ; j'ai passé des valeurs factices, donc les 23 `change` contiennent du bruit lié à ces valeurs. Les changements réels sont ceux attendus : env Lambda, hash de code, ARN retirés des policies IAM.

**Points non cochés, et pourquoi**
- AC #2 : la suppression est faite et vérifiable par grep ; la moitié « reçoit la 400 d'un type inconnu » est un comportement de l'endpoint déployé, donc inatteignable depuis le worktree. Le chemin de code est en place (voir ci-dessus).

**À faire par le propriétaire (hors AC)**
- AVANT l'apply Terraform : vider le bucket `media-summarizer-summary-detailed-<compte>-dev`, sinon la destruction échoue (`BucketNotEmpty`, pas de `force_destroy`). Il reste 3 objets (environ 28 Ko), versioning désactivé : `aws s3 rm s3://<bucket> --recursive`. Même opération sur `prod` si le bucket y existe (dormant, non touché ici).
- Après le push et l'apply : vérifier que le worker démarre sans `SUMMARY_DETAILED_BUCKET`, puis générer des notes sur un dossier `-dev` pour voir `context` et les citations sourcées. Vérifier aussi qu'une requête `summary_detailed` renvoie 400 `INVALID_ARTIFACT_TYPE`.

**Volontairement laissé**
- `docs/research/**` et `docs/dispatch-runs/` : archives de décisions passées, non réécrites.
- `docs/MOBILE_APP_IMPLEMENTATION_PLAN.md` (plan historique) et `docs/store-listing/app-store-connect.md` (texte de store, « summary detailed » visible par les utilisateurs) : décision produit du propriétaire, à traiter avec task-538 ou à part.
- `mobile/`, `web/`, `packages/`, `mobile-design-mockups/` : task-538.
- `.github/workflows/{pr,main}.yml` : la garde qui bloque les noms de queues `summary-detailed-queue` est conservée (elle empêche la réintroduction, elle ne fait pas référence au type).
- `docs/INGESTION_WORKERS_PROVIDERS.md` : la liste des variables d'environnement retirées cite encore `SUMMARY_DETAILED_LLM_MODEL` (ne plus être lue, c'est le fait documenté).
<!-- SECTION:NOTES:END -->
