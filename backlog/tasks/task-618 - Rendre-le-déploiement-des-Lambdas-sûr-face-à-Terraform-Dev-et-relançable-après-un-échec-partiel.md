---
id: TASK-618
title: >-
  Rendre le déploiement des Lambdas sûr face à Terraform Dev et relançable après
  un échec partiel
status: Done
assignee: []
created_date: '2026-11-08 18:09'
updated_date: '2026-11-08 18:34'
labels:
  - tooling
  - infrastructure
  - bug
dependencies: []
references:
  - .github/workflows/deploy-lambda.yml
  - .github/workflows/terraform-dev.yml
  - infrastructure/terraform/modules/platform/lambda_workers.tf
priority: medium
type: bug
ordinal: 224000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Le push du 2026-11-08 (commit 1169c55c) touchait à la fois `infrastructure/terraform/**` et le code backend. `terraform-dev.yml` et `deploy-lambda.yml` sont partis ensemble, chacun dans son propre groupe de concurrence. Terraform mettait à jour la configuration des Lambdas (retrait de deux variables d'environnement) pendant que `deploy-workers` appelait `update-function-code` : AWS a répondu `ResourceConflictException` sur `media-summarizer-worker-media-lifecycle-dev`, le pas a échoué, et 5 workers sur 19 sont restés sur l'image du commit précédent alors que leur environnement venait de changer. L'ancien code de ces workers exigeait l'une des variables retirées au chargement : seul un redéploiement manuel rapide a évité des plantages au démarrage.

La relance du job a échoué à son tour. Elle reconstruit l'image et la repousse sous `worker-<sha>` ; le dépôt ECR `media-summarizer-lambda` est `IMMUTABLE_WITH_EXCLUSION` (seul `*-latest` est modifiable), donc le push est refusé. Les jobs `deploy-api` et `deploy-chat-stream` ont la même construction (`api-<sha>`, `chat-stream-<sha>`). Après un échec partiel, le workflow ne peut donc pas finir son propre travail : il a fallu donner à la main l'image déjà construite (par digest) aux 5 workers restants.

## Responsabilité

Deux défauts à corriger dans `.github/workflows/deploy-lambda.yml`, sans changer l'isolation des environnements ni la promotion prod par digest :

1. **La course avec Terraform Dev.** Un déploiement ne doit plus échouer parce qu'une mise à jour de configuration Lambda est en cours, et ne doit pas laisser une partie des fonctions sur l'ancienne image quand une seule bute. Le choix du mécanisme revient à l'implémenteur (attendre la fin de la mise à jour en cours avant chaque `update-function-code` et réessayer sur conflit, ordonner le déploiement après Terraform Dev quand les deux sont déclenchés par le même push, ou autre), justifié dans le workflow.
2. **La relance.** Relancer un run dont l'image `<kind>-<sha>` existe déjà doit déployer cette image existante par son digest, au lieu de tenter de la repousser. Vaut pour les trois images (API, workers, chat).

Ne pas rendre les tags `<kind>-<sha>` modifiables : leur immutabilité est ce qui garantit que la prod reçoit l'image testée en dev.

Note owner : la preuve réelle ne peut venir que d'un run. Au prochain push qui touche à la fois Terraform et le code backend, vérifier que « Deploy Lambda Functions » est vert et que toutes les fonctions `-dev` partagent le digest du commit ; puis relancer une fois un job de déploiement déjà réussi et vérifier qu'il réussit sans reconstruire d'image.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dans `deploy-lambda.yml`, chaque `update-function-code` (API, workers, chat, dev) ne part qu'une fois la fonction hors mise à jour en cours, et un `ResourceConflictException` passager ne fait plus échouer le job ni ne laisse des fonctions sur l'ancienne image ; le mécanisme retenu et sa raison sont commentés dans le workflow.
- [x] #2 Quand l'image `api-<sha>`, `worker-<sha>` ou `chat-stream-<sha>` existe déjà dans ECR, le job correspondant récupère son digest et déploie ce digest sans reconstruire ni repousser l'image ; sinon il construit et pousse comme aujourd'hui.
- [x] #3 L'isolation par environnement (filtre de tag `Environment`, refus d'une fonction hors `-dev`), le déploiement par digest et le job `promote-prod` sont inchangés.
- [x] #4 Le workflow est syntaxiquement valide (actionlint ou équivalent sans erreur) et le dépôt ECR garde des tags `<kind>-<sha>` immuables.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nouveau helper `.github/scripts/lib/lambda-deploy.sh`, sourcé par les trois jobs dev de `deploy-lambda.yml`.

1. Course avec Terraform Dev : `update_function_image` attend que la fonction ne soit plus en cours de mise à jour (`wait function-updated-v2`) avant chaque `update-function-code`, puis réessaie sur `ResourceConflictException` (10 tentatives, attente croissante), et vérifie à la fin State=Active / LastUpdateStatus=Successful. On attend la fonction elle-même au lieu d'ordonner le workflow après Terraform Dev : le conflit est propre à chaque fonction et bref, et l'attente couvre aussi un apply manuel. La raison est en commentaire dans le helper et dans chaque étape. Dans la boucle des workers, chaque worker est tenté même si un autre échoue ; l'étape échoue à la fin en listant ceux qui n'ont pas reçu l'image.
2. Relance : une étape « Find an image this commit already pushed » lit le digest de `<kind>-<sha>` via `ecr batch-get-image` (le rôle de déploiement dev a `BatchGetImage` mais pas `DescribeImages`, donc aucun changement IAM n'est nécessaire). Si l'image existe, buildx, QEMU et le build sont sautés et ce digest est déployé ; sinon le build reste celui d'avant.
3. Le filtre par tag `Environment`, le refus d'une fonction hors `-dev` et le déploiement par digest sont inchangés ; le bloc `promote-prod` est identique octet pour octet (vérifié avec diff contre HEAD). L'ECR reste `IMMUTABLE_WITH_EXCLUSION`.
4. `actionlint` (avec shellcheck sur les blocs `run`) et `shellcheck` sur le helper : aucune erreur.

Vérifié sur le vrai dev : le digest de `batch-get-image` pour `api-1169c55c…` est exactement celui que tourne `media-summarizer-api-dev`, et un tag absent ne renvoie rien. Sur `media-summarizer-chat-stream-dev`, avec une mise à jour de config en cours (timeout réappliqué à l'identique), un `update-function-code` brut est rejeté alors que `update_function_image` passe et redéploie le même digest.

Vérification owner (nécessite un run) : au prochain push qui touche à la fois Terraform et le backend, « Deploy Lambda Functions » doit être vert avec toutes les fonctions -dev sur le digest du commit ; puis relancer un job déjà réussi doit passer sans reconstruire l'image.
<!-- SECTION:NOTES:END -->
