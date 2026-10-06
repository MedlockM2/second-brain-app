---
id: TASK-430
title: >-
  Benchmarker les architectures possibles d'un chatbot conversationnel sur les
  transcripts, et recommander la plus élégante pour cette app
status: To Do
assignee: []
created_date: '2026-10-06 14:42'
labels:
  - benchmark
  - scoping
dependencies: []
references:
  - media_summarizer/core/services/artifact_service.py
  - media_summarizer/core/models/media_artifact.py
  - media_summarizer/core/services/quota_enforcer.py
  - media_summarizer/workers/artifact_generator/worker.py
  - media_summarizer/api/endpoints/artifacts.py
  - infrastructure/terraform/modules/platform/lambda_api.tf
  - infrastructure/terraform/modules/platform/lambda_workers.tf
  - infrastructure/terraform/modules/platform/sqs.tf
  - docs/research/task-269-collection-artifact-aggregation/README.md
  - docs/research/task-316-artifact-prompts/README.md
  - docs/research/task-72-llm-artifact-benchmark/README.md
  - docs/research/task-212-llm-serving-architecture-benchmark/README.md
  - docs/research/pricing-challenge/README.md
priority: medium
type: spike
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## La décision déjà prise par l'owner

L'owner **veut un chatbot conversationnel** : l'utilisateur pose une question sur le transcript d'un média, ou sur la concaténation des transcripts d'un dossier, puis **relance** — plusieurs tours, avec le contexte et l'historique tenus d'un tour à l'autre, et la possibilité de retrouver ses conversations.

Ce benchmark ne rouvre donc pas la question « chatbot ou pas ». Il porte sur **comment le construire**, et sur un seul arbitrage : **quelle architecture est la plus élégante pour cette app**, en l'état où elle est.

## Interdiction explicite : ne pas ouvrir docs/research/task-427-*

Un benchmark antérieur (`task-427`) a exploré un périmètre voisin et porte une recommandation. **Ne lis ni `docs/research/task-427-ask-question-vs-chatbot/README.md`, ni `compute.py` dans ce dossier, ni aucun fichier de ce répertoire, ni les fichiers de backlog `task-427` et `task-428`.** La raison est volontaire : l'owner veut un second regard **non ancré**, qui reparte du code et des faits plutôt que d'une conclusion déjà écrite. Si un autre document du dépôt cite ce benchmark, ignore la citation et va chercher le fait à sa source.

Tout le reste de `docs/research/` est à lire, et doit l'être.

## Ce que « élégant » veut dire ici

L'owner n'attend pas la solution la moins chère, ni la plus complète : il attend celle qui **tient naturellement dans cette app**. Le benchmark doit donner à ce mot une définition opérationnelle, et classer les candidats dessus. Les axes que l'owner reconnaît comme comptant, à pondérer et à justifier :

- **Combien d'objets persistants nouveaux** l'architecture introduit (tables, index secondaires, buckets, queues, lambdas, portes d'entrée, endpoints, écrans) — et lesquels il faudrait purger.
- **Quelle part de ce qui est déjà déployé est réutilisée** telle quelle, sans adaptation.
- **Ce que l'utilisateur ressent** : la latence par tour, et ce que l'app peut afficher pendant l'attente avec les états qu'elle sait déjà peindre.
- **Comment la dépense est comptée** : si l'architecture demande un compteur nouveau, dire lequel et pourquoi ; si elle s'insère dans le mécanisme de quota existant, le démontrer dans le code.
- **Ce qui resterait à jeter** si l'architecture retenue était remplacée plus tard par une autre.
- **La surface d'exploitation** : ce que l'architecture ajoute aux alarmes et aux tableaux de bord existants, et ce qui échapperait à l'observabilité en place.

## Ce qu'il faut établir soi-même, dans le code et sur -dev

Rien de ce qui suit ne doit être supposé : chaque fait est à relever, avec le fichier et la ligne, ou la commande AWS en lecture seule et sa date.

- Le pipeline de génération déjà déployé : modèle de données, transport, états, reprises sur échec, taxonomie des pannes, et où un tour de conversation pourrait s'y insérer ou non.
- La porte d'entrée HTTP déployée et ses plafonds réels (Terraform), le runtime de la Lambda API et son adaptateur, les plafonds de la Lambda de traitement et de la queue.
- Le mécanisme de quota et de refus : où il est débité, avec quelle unité, quels refus l'app sait déjà afficher.
- Les modèles LLM retenus par le dépôt, leurs prix **datés et sourcés**, leurs fenêtres d'entrée, leurs règles de mise en cache de prompt et la durée de rétention du cache.
- Ce que les générations déjà produites sur `-dev` disent de la latence réelle et des tokens consommés (table DynamoDB des artefacts, scan en lecture seule).

**Aucun appel LLM payant ne doit être émis pour ce benchmark**, et aucun fichier source ne doit être modifié.

## Ce qu'il faut comparer

Énumérer **au moins trois architectures candidates**, couvrant l'écart entre « le minimum qui réutilise ce qui est déjà déployé » et « la conversation comme objet de première classe », plus toute voie intermédiaire que la recherche juge pertinente. Pour chacune :

1. **Où vit la conversation** : le modèle de données, les clés, la durée de vie, la purge.
2. **Le transport et le rendu de la réponse** : ce que l'UX de chat exige, ce que l'infra déployée permet et à quel prix en Terraform. Trancher la question du streaming avec les références AWS datées, et dire si l'architecture s'en passe et comment.
3. **La stratégie de contexte** : ce qui est envoyé à chaque tour, comment ça croît avec les tours et avec la taille du corpus, ce qui est nécessaire ou non pour que ça tienne dans la fenêtre des modèles retenus.
4. **La portée d'une conversation** : un média, un dossier, toute la bibliothèque — et ce que chaque portée exige de plus.
5. **Le coût LLM réel**, chiffré en euros : un premier tour sur un média d'une heure, un premier tour sur un dossier au plafond en vigueur, puis des conversations de 5, 10 et 20 tours, avec et sans mise en cache de prompt. Montrer où part le coût.
6. **L'unité de quota** proposée, rattachée au code qui débite aujourd'hui, et ce que ça pèse sur le forfait d'un abonné selon la grille tarifaire du dépôt.
7. **Les garde-fous chiffrés** : longueur de la saisie, tours par conversation, conversations simultanées, volume par période et par palier, comportement à la saturation — côté utilisateur **et** côté limites de débit du fournisseur.
8. **Le coût de construction, fichier par fichier** : ce qu'on étend, ce qui est entièrement neuf, backend, mobile, Terraform, i18n.
9. **L'articulation avec les décisions déjà validées** du dépôt sur l'agrégation d'un dossier, sur les prompts d'artefact et sur la mutualisation des générations par contenu, en citant les fichiers et les lignes.

## Contexte à ne pas refaire

Un benchmark d'architecture de serving LLM (`docs/research/task-212-llm-serving-architecture-benchmark/README.md`) a été **abandonné** par l'owner. Le lire pour ne pas rechiffrer ce qui y est déjà chiffré, mais ne pas en reprendre les conclusions d'infrastructure : ce benchmark-ci ne porte pas sur un changement de fournisseur, et l'échelle réelle du projet est d'une douzaine de testeurs beta.

## Le livrable attendu

Un classement motivé des architectures candidates sur la définition d'« élégant » posée en tête, **une recommandation tranchée**, et un **ordre de construction en tranches livrables** — ce qu'on fait d'abord, ce qui peut attendre un signal, et quel signal précisément, lisible dans des données que la V1 produit elle-même. Si une partie du périmètre exige une décision technologique encore non prise, le dire et la nommer comme un benchmark distinct à créer, sans la trancher ici.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Un fichier docs/research/task-430-chatbot-architecture/README.md existe, avec owner_decision: pending dans son front-matter et les sections Owner Validation, Recommendation et Sources
- [x] #2 Le README déclare explicitement, dans sa section de base de preuves, qu'aucun fichier de docs/research/task-427-* n'a été consulté, et aucun chiffre, option ou conclusion du document n'en provient
- [x] #3 Au moins trois architectures candidates sont comparées, couvrant l'écart entre la réutilisation maximale de ce qui est déployé et la conversation comme objet de première classe, chacune évaluée sur les six axes d'élégance posés dans la description
- [x] #4 Le README donne une définition opérationnelle d'« élégant » pour cette app, avec les axes pondérés et justifiés, et classe les candidats dessus
- [x] #5 Chaque prix de modèle, chaque plafond de fournisseur et chaque limite AWS cités portent leur URL source et leur date de consultation ; aucun n'est donné de mémoire
- [x] #6 Chaque mesure relevée sur -dev indique la commande AWS en lecture seule utilisée et sa date ; aucun appel LLM payant n'a été émis et aucun fichier source du dépôt n'a été modifié
- [x] #7 Le README chiffre en euros, pour chaque architecture candidate, un premier tour sur un média d'une heure, un premier tour sur un dossier au plafond en vigueur, et des conversations de 5, 10 et 20 tours, avec et sans mise en cache de prompt
- [x] #8 Le README tranche la faisabilité du streaming de réponse sur la porte d'entrée et le runtime réellement déployés, en citant les fichiers Terraform avec leurs lignes et les références AWS datées, et dit pour chaque architecture si elle s'en passe et comment
- [x] #9 Le README propose une unité de quota et des garde-fous chiffrés (longueur de saisie, tours par conversation, conversations simultanées, volume par période et par palier, comportement à la saturation), rattachés au code qui débite le quota aujourd'hui, avec les lignes
- [x] #10 Le README dit comment chaque architecture s'articule avec les décisions validées sur l'agrégation d'un dossier, sur les prompts d'artefact et sur la mutualisation des générations par contenu, en citant les fichiers et les lignes
- [x] #11 Le README liste, pour chaque architecture, les fichiers backend, mobile, Terraform et i18n à étendre et ce qui est entièrement neuf, et dit ce qui resterait à jeter si l'architecture était remplacée plus tard
- [x] #12 La recommandation est tranchée et accompagnée d'un ordre de construction en tranches livrables, chaque tranche au-delà de la première portant le signal chiffré qui la déclenche, lisible dans des données que la première tranche produit elle-même
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Mode initial — benchmark produit, **en attente de la validation de l'owner**

`docs/research/task-430-chatbot-architecture/` n'existait pas et ne contenait donc ni `README.md`
actif, ni `README.owner-rejected-*.md`, ni `complement-request-*.md` : **mode initial**. Le benchmark
est produit depuis zéro.

**Livrable** : `docs/research/task-430-chatbot-architecture/README.md` (~1 500 lignes), avec
`owner_decision: pending` dans son front-matter et les sections `Owner Validation`, `Recommendation`
et `Sources`.

**Recommandation tranchée** : **architecture B — « un tour de conversation est un troisième mode du
worker d'artefacts »**. Une table DynamoDB nouvelle (`chat_conversations`, les tours dans l'item), un
routeur `/api/chat` de cinq routes, un écran mobile, et **rien d'autre** : le tour est enfilé sur
`artifact-generator-queue` et calculé par la Lambda `artifact_generator`, qui porte déjà un second
mode (la traduction d'artefact, task-395). Zéro file, zéro Lambda, zéro bucket, zéro porte d'entrée,
zéro alarme, zéro compteur de quota nouveau. Un tour est débité comme une génération sur la même
portée — `max(1, ceil(S/5))` minutes — ce qui n'ajoute ni unité, ni conversion, ni code de refus.
Pas de streaming : il est **impossible** sur la porte d'entrée déployée (API Gateway HTTP, aucune
propriété `responseTransferMode` sur `apigatewayv2`, aucune Function URL, adaptateur Mangum
bufferisé) et la latence mesurée ne le justifie pas (médiane 6,3 s, p90 16,9 s sur 128 générations
réelles de `-dev`).

**Classement des quatre candidates** sur la définition opérationnelle d'« élégant » posée en §8.1 et
les six axes pondérés de §8.2 : **B 9,4** > A 7,9 (synchrone sur la Lambda API) > D 6,8 (état chez le
fournisseur) > C 4,8 (objet de première classe, WebSocket, récupération). Objets AWS nouveaux : B 1,
A 2, D 1 + un magasin tiers hors du périmètre d'`account_deletion_service`, **C 21**.

**Ordre de construction** en cinq tranches (§12), chacune au-delà de la première portant son signal
chiffré, lisible dans ce que la tranche 1 écrit elle-même (`turn_count`, et par tour
`llm_usage.cached_tokens / prompt_tokens`, `created_at`, `completed_at`) : tranche 2 (portée dossier)
sur un taux de cache ≥ 70 % et une médiane de tours ≥ 3 ; tranche 3 (desserrage du barème, sans
déploiement) sur un taux de cache ≥ 90 % ; tranche 4 (portée bibliothèque) sur ≥ 20 % de
conversations à `source_count` ≥ 20, **et bloquée par un benchmark distinct** ; tranche 5 (streaming)
sur un p90 par tour > 25 s.

**Deux benchmarks distincts nommés et non tranchés ici** (§13) : la stratégie de récupération pour la
portée bibliothèque (l'index Algolia est lexical ; task-269 §12.3 avait déjà laissé le sujet ouvert),
et le modèle d'un Q&A multi-tours ancré (task-72 a évalué la génération one-shot ; trancher exigerait
des appels LLM payants, interdits par cette tâche).

**Interdiction respectée.** Aucun fichier de `docs/research/task-427-*` n'a été consulté — ni son
`README.md`, ni son `compute.py`, ni aucun autre fichier de ce répertoire — et les fichiers de backlog
`task-427` et `task-428` n'ont pas été ouverts. Le README le déclare dans sa section de base de
preuves (§1.1), et chaque fait porte sa source propre : un fichier et une ligne, une commande AWS en
lecture seule datée, ou une URL datée.

**Mesures et garde-fous de la session.** Douze commandes AWS **en lecture seule** sur `-dev`, toutes
exécutées le 2026-10-06 et listées une par une en §1.3 du README. **Aucun appel LLM payant n'a été
émis.** **Aucun fichier source du dépôt n'a été modifié** : les seuls fichiers touchés sont le README
de recherche et ce fichier de tâche. Aucun secret, aucune clé d'API, aucun identifiant de compte
utilisateur n'apparaît dans le livrable.

**Statut** : la tâche reste en `To Do` et la recommandation **attend la validation de l'owner**, qui
la signale en éditant `owner_decision` dans le front-matter du README (`ok` / `abandoned` / `redo` /
`more`). Les douze critères d'acceptation sont cochés parce qu'ils portent sur l'existence et le
contenu du livrable, pas sur la décision.
<!-- SECTION:NOTES:END -->
