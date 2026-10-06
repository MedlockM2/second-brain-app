---
owner_decision: more   # pending | ok | abandoned | redo | more
---

# Benchmark : architectures possibles d'un chatbot conversationnel sur les transcripts

## Owner Validation

**Decision**:

Le benchmark de base est bon et je ne le rejette pas : la base de preuves, les mesures sur `-dev`,
le verdict sur le streaming de la porte d'entrée déployée et le §6.4 sur le cache sont acquis et
restent la référence. Il me manque de l'information pour trancher, pour deux raisons.

**Première raison : mes priorités ne sont pas celles du §8.2.** Je veux du **streaming**, de la
**robustesse**, et de la **qualité de génération et d'utilisation du contexte**, quitte à ce que ça
coûte cher. Le classement du §8.5 pondère « objets persistants nouveaux » à 30 %, donc il optimise
la sobriété — ce qui est défendable, mais ce n'est pas mon arbitrage. Et le §6.2 établit lui-même
que le coût ne peut pas être l'arbitre : **0,1377 € de LLM dépensés depuis la création du dépôt**.

**Deuxième raison : il manque une candidate, et elle est le standard du métier.** Le §5.1 chiffre
deux voies de streaming — remplacer la façade par une API REST en mode `STREAM` (≥ 10 objets) et
ajouter une API WebSocket (≥ 11) — et mentionne la Function URL au point 3 (« M9 :
`ResourceNotFoundException` … qui est l'autre chemin de streaming documenté ») **sans jamais la
chiffrer comme candidate**. Or, vérification faite le 2026-10-06 sur la documentation du pattern de
référence des UI de chat (Vercel AI SDK, *Chatbot Resume Streams* et *Chatbot Message
Persistence*), le transport canonique du streaming de chat texte est **SSE sur HTTP, pas
WebSocket** : « *WebSockets aren't part of this pattern at all* ». L'architecture C paie donc
≥ 11 objets Terraform pour un transport qui n'est pas celui que recommandent les bonnes pratiques.

Quatre consignes pour le complément.

**C1 — Chiffrer une cinquième candidate, « B + SSE reprenable ».** La durabilité de B (le tour en
file, persisté, rejouable, avec le bail, le DLQ et la taxonomie d'échec déjà déployés) plus le
transport canonique par-dessus. À chiffrer avec la même granularité que le §10 et à noter sur les
mêmes axes que le §8.5, pour qu'elle soit comparable aux quatre autres :

- une Lambda **dédiée au chat** avec `aws_lambda_function_url` en `invoke_mode = "RESPONSE_STREAM"`,
  le Lambda Web Adapter à la place de Mangum **sur cette fonction seulement** (la façade HTTP et
  toutes les alarmes indexées sur `local.api_gateway_id` restant intouchées), uvicorn, et une route
  FastAPI en `StreamingResponse` ;
- l'authentification de cette seconde porte d'entrée : vérification du JWT dans l'application
  contre `authorization_type = "AWS_IAM"` plus signature SigV4 côté mobile — dire laquelle, et ce
  qu'elle coûte en code mobile ; le domaine custom et CORS ; et si cette Lambda entre gratuitement
  dans les `for_each` de `lambda_error_rate` et `lambda_throttles` ou s'il faut un filtre de
  métrique et un log group de plus ;
- la couche de reprise telle que le pattern publié la décrit, parce que c'est elle qui porte la
  robustesse que je demande : la génération tourne **jusqu'au bout côté serveur et est persistée
  quoi que fasse le client** (« *client-side aborts are treated as disconnects* »), un
  `activeStreamId` par conversation, un endpoint GET de reprise qui rend 204 quand rien n'est actif,
  et un endpoint d'arrêt **explicite et distinct** qui sauve le tour partiel (« *Route cleanup is a
  disconnect, not an explicit stop* ») ;
- la question d'infrastructure que ça pose : le pattern de référence s'appuie sur Redis pour
  tamponner le flux. Dire si l'item DynamoDB de conversation peut porter l'`activeStreamId` et le
  texte partiel sans équivalent Redis, et sinon chiffrer le substitut AWS le moins cher
  (ElastiCache Serverless contre un tampon de fragments en DynamoDB), en objets nouveaux.

**C2 — Repondérer et reclasser les cinq candidates sous mes priorités.** Garder le tableau du §8.2
comme pondération alternative, pour que les deux classements soient lisibles côte à côte, et
produire explicitement la nouvelle pondération. Deux exigences :

- **ajouter un axe que le §8.2 n'a pas du tout : la robustesse de la reprise.** Que se passe-t-il
  quand l'app passe en arrière-plan au milieu d'un tour, quand le flux meurt, quand la Lambda est
  recyclée, quand le réseau tombe dans le métro ? C'est le cas réel sur mobile, et c'est le critère
  sur lequel je veux voir les cinq candidates notées ;
- **ne pas valider ma préférence par politesse.** Si, après repondération, l'architecture B reste
  devant, le dire franchement et montrer sur quels axes elle gagne malgré le poids donné au stream
  et à la robustesse. Un complément qui conclut « B gagne quand même » est un résultat utile.

**C3 — Rechiffrer sur les modèles à grande fenêtre et traiter la falaise des 272 000 tokens.** Les
chiffres ci-dessous sont relevés le 2026-10-06 et sont donnés pour orienter la recherche :
**ils doivent être revérifiés à la source**, pas repris sur parole.

- `gpt-6-luna` : contexte 1 050 000, **entrée max 922 000**, sortie max 128 000, **0,10 / 0,01 /
  0,50 $ par 1M**, écriture de cache 0,125 $/1M, `reasoning_effort` de `none` à `max`, défaut
  `medium` ;
- `gpt-6.1-sol` : mêmes fenêtres, 2 / 0,10 / 10 $ par 1M, `none` **non supporté** ;
- la falaise : au-delà de **272 000 tokens d'entrée**, la requête **entière** est repricée
  « *2x input and cache rates and 1.5x output for the full request* ».

Ce que je veux en tirer :

1. le modèle de coût du §6.3 rejoué sur Luna et Sol à côté de nano, la surcharge modélisée comme une
   **fonction en escalier** et non comme un tarif linéaire ;
2. une réponse à la question que la falaise pose : le vrai plafond économique est-il le seuil de
   272 000 plutôt que la fenêtre du modèle ? Et si oui, qu'est-ce que ça implique pour
   `MAX_FOLDER_CORPUS_TOKENS = 120_000` (`artifact_service.py:126`) — faut-il le déplacer, et à
   quelle valeur, sachant que l'estimateur est `byte_length / 3.4` (`artifact_service.py:129` et
   `:436-437`) et **pas** un comptage de tokenizer, donc que la marge réelle n'est pas celle
   affichée ;
3. la correction du §14.1 sur le TPM. Sa ligne dit « *Les tokens d'entrée servis par le cache
   comptent-ils plein dans le TPM ? La documentation ne le dit pas.* » Le guide *prompt caching*
   le dit maintenant explicitement : « *Cached input tokens still count toward tokens-per-minute
   limits* » et « *Prompt caching does not change how [rate limits] are calculated* ». Revérifier
   et transformer l'angle mort en fait établi ;
4. l'évaluation de la **compaction côté fournisseur** (`context_management`, `compact_threshold`,
   l'endpoint `/responses/compact`), que le §6.4 n'a pas considérée — il ne modélise qu'une fenêtre
   glissante faite à la main. La documentation assume son compromis : « *fewer input tokens can
   still save money even when the cache-hit rate falls* ». Dire si ça change la conclusion « pas de
   troncature, pas de résumé, pas d'étage de condensation », **sachant que la compaction appartient
   à la Responses API alors que le dépôt appelle `/v1/chat/completions`**
   (`worker.py:73-75`) — donc dire aussi ce que ce changement d'API coûterait, en reprenant les
   quatre objections que le §7.4 oppose déjà à la Responses API et en disant lesquelles tiennent
   encore quand on ne déporte **pas** l'état de la conversation chez le fournisseur.

**C4 — Rouvrir la prémisse du §13.1 sur la portée bibliothèque.** Le §13.1 déclare un benchmark
distinct obligatoire parce que « le corpus entier de `-dev` vaut 672 515 tokens, soit **2,5× la
fenêtre d'entrée** de 272 000 ». Sur les 922 000 tokens d'entrée de Luna, ce corpus **tient**, avec
environ 27 % de marge. La question n'est donc plus « avec quelle récupération » mais « récupération
ou pas de récupération du tout ». À trancher dans le complément :

- le coût d'un tour sur toute la bibliothèque sur Luna, à froid et en cache, surcharge comprise ;
- une **position argumentée** — pas un chiffre — sur la qualité : la littérature réunie au §14.2
  (*Lost in the Middle*, context rot, NoLiMa, BooookScore) disqualifie-t-elle le fait de remplir
  73 % d'une fenêtre de 922 000 ? Le §14.2 conclut que « le plafond est la réponse » dans un régime
  à 7,2 % et 48,2 % de remplissage ; dire si cette conclusion survit à 73 %, et sinon quel plafond
  elle impose ;
- et au bout : le benchmark distinct du §13.1 est-il **encore nécessaire** ? S'il l'est, donner sa
  question reformulée — « récupération contre corpus complet sur un modèle à grande fenêtre » n'est
  pas la même question que « quelle récupération ». S'il ne l'est plus, le dire, parce que ça change
  l'ordre des tranches du §12.

**Garde-fous du complément, inchangés.** Le `README.md` principal reste la référence et n'est pas
modifié : produire uniquement un `complement-response-<date>.md` dans ce répertoire. L'interdiction
de lire `docs/research/task-427-*` **tient toujours**, pour la même raison qu'au premier passage.
Aucun appel LLM payant, aucun fichier source du dépôt modifié. Chaque prix, chaque fenêtre, chaque
seuil et chaque citation de documentation porte son URL et sa date de consultation — y compris ceux
que je donne ci-dessus, qui sont à revérifier et non à recopier.

**Validated at**: 2026-10-06

---

## Recommendation

**Architecture B — « un tour de conversation est un troisième mode du worker d'artefacts ».**

Concrètement, et c'est tout :

1. **Une table nouvelle**, `chat_conversations` (PK `user_id`, SK `conversation_id`), un item par
   conversation, les tours *dans* l'item. Pas de GSI, pas de bucket, pas de file, pas de Lambda, pas
   de porte d'entrée, pas d'alarme, pas de widget.
2. **Un routeur nouveau**, `/api/chat`, quatre routes. `POST …/turns` écrit le tour en `queued`,
   débite le quota et pose **un message sur `artifact-generator-queue`** — la file déjà déployée,
   avec son DLQ, son `maxReceiveCount = 3` et sa `visibility_timeout_seconds = 1800`
   ([sqs.tf:214-227](../../../infrastructure/terraform/modules/platform/sqs.tf#L214)).
3. **Le worker `artifact_generator` apprend un troisième mode.** Il en a déjà deux : une génération
   sur corpus, et une traduction d'artefact stocké, reconnue à la présence d'un bloc `translation`
   dans le message ([worker.py:258](../../../media_summarizer/workers/artifact_generator/worker.py#L258),
   [worker.py:317-326](../../../media_summarizer/workers/artifact_generator/worker.py#L317)). Un bloc
   `chat` est la même chose : même file, même bail, même taxonomie d'échec, même appel `_call_llm`,
   même lecture d'usage, même enregistrement de coût. *« Ce qui change n'est que l'origine du texte
   d'entrée »* — la phrase est déjà écrite dans l'en-tête du worker
   ([worker.py:22-24](../../../media_summarizer/workers/artifact_generator/worker.py#L22)).
4. **Un écran nouveau**, et la cadence de polling que l'app peint déjà : 3 s pendant la première
   minute, 10 s ensuite, budget 5 min, puis un marqueur immobile
   ([useProcessingRefresh.ts:69-75](../../../mobile/src/hooks/useProcessingRefresh.ts#L69)).
5. **Aucun compteur nouveau.** Un tour coûte ce que coûte une génération sur la même portée :
   `quota_enforcer.minutes_for_folder_sources(source_count)`, soit `max(1, ceil(S/5))` minutes
   ([quota_enforcer.py:232-239](../../../media_summarizer/core/services/quota_enforcer.py#L232)),
   débité par `_debit` sous le token `f"{conversation_id}:{turn_index}"`. La seule chose qui change
   par rapport à aujourd'hui est que **l'exemption « une génération sur un média unique est
   gratuite » ne s'applique pas à un tour de chat** — et la raison est factuelle : l'ingestion a payé
   *une* lecture du transcript, pas vingt.
6. **Pas de streaming.** Il est **impossible** sur la porte d'entrée déployée sans la remplacer
   (§5), et la latence mesurée ne le justifie pas : médiane 6,3 s, p90 16,9 s sur les 128
   générations réelles de `-dev`. L'attente tient dans la phase rapide du poll.
7. **Portée média seulement en V1.** La portée dossier est la tranche 2, et elle est déclenchée par
   un signal chiffré que la tranche 1 produit elle-même : le taux de hit du cache de prompt, lisible
   dans `llm_usage.cached_tokens / llm_usage.prompt_tokens` que le worker enregistre déjà
   ([worker.py:216-232](../../../media_summarizer/workers/artifact_generator/worker.py#L216)).

**Le fait qui tranche**, et il n'est pas économique : la dépense LLM est **identique** dans les trois
architectures candidates à stratégie de contexte égale (§6). Ce qui les sépare est le nombre
d'objets persistants ajoutés — **3 pour B** (une table, un routeur, un écran), **4 pour A** (les
mêmes plus un filtre de métrique, parce que la Lambda API ne fait aujourd'hui *aucun* appel LLM et
qu'`llm_alerts.tf` ne regarde que deux log groups de workers), **13 pour C**. Et A est en plus
butée sur un plafond non négociable : **30 s d'intégration sur une API Gateway HTTP, non
augmentable**, alors qu'une génération mesurée sur `-dev` a pris **27,3 s** pour 62 601 tokens
d'entrée et **123,6 s** au maximum observé.

**Le levier de coût est unique et il est déjà en place** : la mise en page corpus-d'abord
([corpus.py:111-135](../../../media_summarizer/workers/artifact_generator/generators/corpus.py#L111))
rend le corpus un préfixe stable, donc cachable. À 20 tours sur un dossier au plafond, le cache fait
passer la conversation de **0,443 € à 0,074 €** (×6,0). Aucune autre décision d'architecture ne
déplace le coût d'un facteur comparable — et, contre-intuitivement, **tronquer l'historique coûte
plus cher que le garder** (§6.4).

**Deux décisions technologiques ne sont pas tranchées ici** et sont nommées comme benchmarks
distincts à créer (§13) : le **modèle** d'un Q&A multi-tours ancré (task-72 a évalué la génération
one-shot, pas la conversation, et le mesurer exige des appels LLM payants que ce benchmark
s'interdit), et la **stratégie de récupération** pour la portée bibliothèque (task-269 §12.3 l'avait
déjà laissée ouverte).

---

## 1. Base de preuves

### 1.1 Ce qui n'a pas été lu, et pourquoi c'est déclaré

**Aucun fichier de `docs/research/task-427-*` n'a été consulté** : ni son `README.md`, ni son
`compute.py`, ni aucun autre fichier de ce répertoire, ni les fichiers de backlog `task-427` et
`task-428`. L'interdiction était explicite dans la tâche, et elle est tenue : **aucun chiffre,
aucune option, aucune conclusion de ce document n'en provient.** Chaque fait ci-dessous porte soit
un fichier et une ligne de ce dépôt, soit une commande AWS en lecture seule avec sa date, soit une
URL avec sa date de consultation. Quand un autre document du dépôt citait ce benchmark, le fait a
été repris à sa source : le code, Terraform, ou la documentation du fournisseur.

### 1.2 Code et Terraform lus

Branche `main`, worktree propre, commit de départ `25854d8`. **Aucun fichier source du dépôt n'a
été modifié** : le seul fichier créé est ce `README.md`.

- `media_summarizer/core/services/artifact_service.py` (2 513 lignes, lu intégralement)
- `media_summarizer/core/models/media_artifact.py`
- `media_summarizer/core/services/quota_enforcer.py`
- `media_summarizer/core/services/llm_pricing.py`
- `media_summarizer/core/services/pricing_config_service.py`
- `media_summarizer/core/services/account_deletion_service.py`
- `media_summarizer/core/services/search_indexing.py`
- `media_summarizer/core/services/transcript_translation.py`
- `media_summarizer/utils/quota_usage_db.py`, `media_summarizer/utils/llm_failure.py`
- `media_summarizer/workers/artifact_generator/worker.py`,
  `media_summarizer/workers/artifact_generator/generators/corpus.py`
- `media_summarizer/api/endpoints/artifacts.py`, `media_summarizer/api/main.py`,
  `media_summarizer/api/lambda_handler.py`
- `infrastructure/terraform/modules/platform/` : `lambda_api.tf`, `lambda_workers.tf`, `sqs.tf`,
  `dynamodb_core_tables.tf`, `runtime_env.tf`, `s3.tf`, `llm_alerts.tf`, `pipeline_alerts.tf`,
  `pipeline_dashboard.tf`
- `mobile/src/components/ArtifactsPanel.tsx`, `ArtifactTile.tsx`,
  `mobile/src/hooks/useProcessingRefresh.ts`, `mobile/src/i18n/en.ts`, arborescence de `mobile/app/`
- `docs/CANONICAL_MEDIA_API_CONTRACT.md`, section « Relationship to existing runtime APIs »

Recherches internes lues : `task-269-collection-artifact-aggregation` (stratégie d'agrégation,
plafonds, cache de prompt), `task-316-artifact-prompts` (mise en page des prompts, tokens de sortie
inexpliqués), `task-72-llm-artifact-benchmark` (modèles validés),
`task-212-llm-serving-architecture-benchmark` (**abandonné** — lu pour ne pas rechiffrer, et ses
conclusions d'infrastructure ne sont pas reprises, voir §14.3), `task-287-consumption-model` (unité
de quota, produits comparables), `pricing-challenge` (grille en discussion),
`task-368-push-delivery` (transport push), `task-53.1-lexical-search` (Algolia, lexical et non
vectoriel).

### 1.3 Mesures sur `-dev`, en lecture seule

Région `eu-west-3`, compte `125313707865`, profil `second-brain-app` (il n'y a pas de profil
default). **Toutes les commandes ci-dessous ont été exécutées le 2026-10-06**, toutes en lecture
seule. Aucune écriture, et **aucun appel LLM payant n'a été émis** pour ce benchmark.

- **M1** — `aws dynamodb scan --table-name media_artifacts-dev` avec une projection sur
  `artifact_id`, `artifact_type`, `status`, `created_at`, `completed_at`, `llm_usage`,
  `source_count`, `scope`, `generator_version`, `scope_key`, `shared_artifact_id`, `error_code`
  (les noms réservés `status` et `scope` passent par `--expression-attribute-names`).
  → 157 lignes, la latence réelle par type, les tokens et le coût réels, le taux de cache réel.
- **M2** — `aws s3api list-objects-v2 --bucket media-summarizer-transcripts-125313707865-dev`
  avec une projection sur les tailles. → 326 transcripts, médiane 1 148 o, p90 16 577 o,
  max 204 320 o, total 2 286 551 o.
- **M3** — `aws dynamodb scan --table-name processing_jobs-dev` projeté sur `id`,
  `transcription_s3_key`, `transcription_metadata`, `media_type`, `title`, `total_duration`.
  → 105 jobs ; un seul média long porte une durée Deepgram enregistrée, 4 670,85 s.
- **M4** — `aws s3api head-object` sur le transcript de ce média, projeté sur `ContentLength`.
  → 85 967 o pour 77,8 min, soit **1 104 o/min, soit 325 tokens/minute de parole** à 3,4 o/token.
- **M5** — `aws dynamodb scan --table-name user_media-dev` projeté sur `media_item_id`,
  `folder_id`, `media_key`, `user_id`. → 108 lignes, 5 comptes, 99 contenus distincts, et **deux
  dossiers de 25 médias**, c'est-à-dire exactement au plafond `MAX_FOLDER_SOURCES`.
- **M6** — `aws dynamodb scan --table-name user_usage_monthly-dev`. → 88 lignes ; le **maximum
  observé de `minutes_used` sur une période est 112**.
- **M7** — `aws apigatewayv2 get-apis` puis `aws apigatewayv2 get-integrations --api-id jji077bi8e`.
  → une seule API, `media-summarizer-api-dev`, **protocole HTTP** ; une seule intégration,
  `AWS_PROXY`, payload `2.0`, `TimeoutInMillis` = 30 000.
- **M8** — `aws lambda get-function-configuration --function-name media-summarizer-api-dev`.
  → `Timeout` 30, `MemorySize` 1024, `arm64`, `PackageType` Image, CMD
  `media_summarizer.api.lambda_handler.handler`.
- **M9** — `aws lambda get-function-url-config --function-name media-summarizer-api-dev`.
  → **`ResourceNotFoundException`** : aucune Function URL n'existe sur la Lambda API.
- **M10** — `aws lambda get-function-configuration --function-name
  media-summarizer-worker-artifact_generator-dev`. → `Timeout` 300, `MemorySize` 512, `arm64` ;
  **aucune variable `*_LLM_MODEL` ni `LLM_TIMEOUT_SECONDS` posée** sur la fonction, donc les défauts
  du code s'appliquent.
- **M11** — `aws sqs get-queue-attributes` sur `artifact-generator-queue-dev`, attributs `All`.
  → `VisibilityTimeout` 1800, `MessageRetentionPeriod` 1209600, `MaximumMessageSize` 262144,
  `maxReceiveCount` 3 vers `artifact-generator-dlq-dev`, 0 message visible et 0 non visible.
- **M12** — `aws dynamodb list-tables`. → 23 tables ; aucune ne peut accueillir une conversation
  sans détourner son sens.

### 1.4 Sources externes, avec leur date de consultation

Toutes consultées le **2026-10-06**. Aucun prix, aucun plafond de fournisseur et aucune limite AWS
n'est donné de mémoire dans ce document.

| Fait établi | Source | Consulté |
|---|---|---|
| Prix par 1M de tokens, tarif standard contexte court (≤ 272k) : `gpt-5-nano` 0,05 / 0,005 / 0,40 $ ; `gpt-5.4-nano` 0,20 / 0,02 / 1,25 $ ; `gpt-5.4-mini` 0,75 / 0,075 / 4,50 $ ; `gpt-5.4` 2,50 / 0,25 / 15,00 $, et 5,00 / 0,50 / 22,50 $ au-delà de 272k (entrée / entrée en cache / sortie) | https://developers.openai.com/api/docs/pricing | 2026-10-06 |
| `gpt-5.4-nano` : contexte total 400 000, **entrée maximale 272 000**, sortie maximale 128 000, `prompt_caching` supporté | https://developers.openai.com/api/docs/models/gpt-5.4-nano | 2026-10-06 |
| `gpt-5.4-nano`, limites par défaut : palier 1 **500 RPM / 200 000 TPM** ; palier 2 5 000 / 2 000 000 ; palier 3 5 000 / 4 000 000 ; palier 4 10 000 / 10 000 000 ; palier 5 30 000 / 180 000 000 | https://developers.openai.com/api/docs/models/gpt-5.4-nano | 2026-10-06 |
| `gpt-5-nano` : contexte 400 000, entrée maximale 272 000, sortie 128 000 ; mêmes paliers RPM/TPM | https://developers.openai.com/api/docs/models/gpt-5-nano | 2026-10-06 |
| Cache de prompt : actif par défaut sur les modèles supportés ; longueur minimale 1 024 tokens visibles sur GPT-5.6+ et « varies by request settings » avant ; lecture facturée **0,1× l'entrée** ; `cached_tokens` arrondi au multiple de 128 inférieur sur les modèles antérieurs à 5.6 ; cache par organisation, porté par une machine donnée, et un `prompt_cache_key` au-delà d'environ 15 requêtes par minute peut déborder sur une autre machine | https://developers.openai.com/api/docs/guides/prompt-caching | 2026-10-06 |
| Rétention du cache, modèles antérieurs à 5.6, via `prompt_cache_retention` : `in_memory` « typically remain active for around 5 to 10 minutes of inactivity, up to one hour » ; `24h` « typically keeps entries available for around 30 minutes and can retain them for up to 24 hours » ; **défaut `24h` pour une organisation sans Zero Data Retention** ; réutiliser un préfixe rafraîchit sa durée de vie sans frais d'écriture | https://developers.openai.com/api/docs/guides/prompt-caching | 2026-10-06 |
| Paliers OpenAI : palier 1 à 5 $ dépensés (plafond 100 $/mois), palier 2 à 50 $ (500 $/mois), palier 3 à 100 $, palier 4 à 250 $, palier 5 à 1 000 $ ; progression automatique ; les limites varient par modèle et sont séparées pour le long contexte | https://developers.openai.com/api/docs/guides/rate-limits | 2026-10-06 |
| État de conversation côté fournisseur : `previous_response_id` et Conversations API ; « Response objects are saved for 30 days by default » ; « Conversation objects and items in them are **not** subject to the 30 day TTL » ; **« all previous input tokens for responses in the chain are billed as input tokens in the API »** | https://developers.openai.com/api/docs/guides/conversation-state | 2026-10-06 |
| **API Gateway HTTP API : « Maximum integration timeout, 30 seconds, Can be increased : No »** ; payload 10 Mo ; 300 routes par API ; en-têtes 10 240 octets | https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-quotas.html | 2026-10-06 |
| Ressource `Integration` de l'API `apigatewayv2` (HTTP et WebSocket) : propriétés `integrationType`, `integrationUri`, `payloadFormatVersion`, `timeoutInMillis` (50 à 30 000 ms pour HTTP), `responseParameters`, `tlsConfig`… et **aucune propriété `responseTransferMode`** | https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid-integrations.html | 2026-10-06 |
| Ressource `Integration` de l'API REST (v1) : **`responseTransferMode` existe, valeurs `BUFFERED` et `STREAM`** ; `timeoutInMillis` 50 à 29 000 ms, « You can increase the default value to longer than 29 seconds for Regional or private APIs only » | https://docs.aws.amazon.com/apigateway/latest/api/API_Integration.html | 2026-10-06 |
| Mode `STREAM` : API Gateway invoque la Lambda par `InvokeWithResponseStream`, l'URI d'intégration devient `…/2021-11-15/functions/…/response-streaming-invocations`, et la sortie doit porter des métadonnées JSON suivies d'un délimiteur de **8 octets nuls situé dans les 16 premiers Ko** ; une fonction qui ne respecte pas ce format reçoit un **500** | https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode-lambda.html | 2026-10-06 |
| Lambda response streaming : « Lambda supports response streaming on **Node.js managed runtimes**. For other languages, **including Python**, you can use a custom runtime with a custom Runtime API integration … or use the Lambda Web Adapter » ; 200 Mo de charge utile contre 6 Mo en mode bufferisé ; débit non plafonné sur les 6 premiers Mo puis 2 Mo/s ; « Streaming responses incur cost … Customers are billed for the full function duration » | https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html | 2026-10-06 |
| API WebSocket : code de fermeture 1001 renvoyé « when the client is idle for **10 minutes** or reaches the maximum **2 hour** connection lifetime » ; le backend pousse vers un client connecté par l'API `@connections` | https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-overview.html | 2026-10-06 |
| DynamoDB TTL : les items expirés sont supprimés « within a few days of their expiration time, without consuming write throughput » ; l'attribut doit être un `Number` en epoch Unix, granularité seconde | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html | 2026-10-06 |

---

## 2. Ce qui est déjà déployé, établi dans le code

### 2.1 Le pipeline de génération : modèle de données

Une table, `media_artifacts<suffixe>`, clé de hash `artifact_id`, un seul GSI `scope-index`
(hash `scope_key`, range `created_at`, projection `INCLUDE` de six attributs), PITR activé,
`deletion_protection_enabled = true` et `prevent_destroy = true`
([dynamodb_core_tables.tf:235-281](../../../infrastructure/terraform/modules/platform/dynamodb_core_tables.tf#L235)).

L'enregistrement est **append-only** et **immuable une fois `ready`**
([media_artifact.py:1-28](../../../media_summarizer/core/models/media_artifact.py#L1)). Son
`artifact_id` est **déterministe et sans composante temporelle** : un hachage de
(user, scope, scope_id, type, paramètres, ids de sources triés)
([artifact_service.py:439-487](../../../media_summarizer/core/services/artifact_service.py#L439)).
C'est **toute la mécanique de réutilisation** : deux demandes identiques du même compte collisionnent
exactement quand l'entrée existante répond déjà à la seconde, et cette collision se lit en un seul
`GetItem`.

Depuis task-394 une génération à portée média est **mutualisée entre comptes** : une **génération
partagée** (`build_shared_artifact_id`, sans `user_id` dans le matériau,
[artifact_service.py:490-519](../../../media_summarizer/core/services/artifact_service.py#L490))
indexée sous un `scope_key` qu'aucun compte ne peut produire (`@content#…`,
[media_artifact.py:88-109](../../../media_summarizer/core/models/media_artifact.py#L88)), et un
**pointeur** par compte qui la mire une fois terminale.

**Cette propriété est exactement ce qui interdit de loger une conversation dans cette table.** Le
texte d'une question entrerait dans `parameters`, donc dans le hachage ; deux comptes posant la même
question sur le même contenu avec le même historique partageraient la même ligne de génération, dont
le `user_id` est « le compte qui a déclenché »
([media_artifact.py:182-186](../../../media_summarizer/core/models/media_artifact.py#L182)). C'est
une surface de fuite entre comptes, improbable mais structurelle, et elle vient de la *bonne*
propriété de cette table : elle est **adressée par le contenu**, pas par la personne. Une
conversation est l'inverse : elle est adressée par la personne et n'a aucune identité de contenu.

### 2.2 Transport, états, reprises, taxonomie des pannes

| Élément | Valeur déployée | Où |
|---|---|---|
| File | `artifact-generator-queue<suffixe>`, `visibility_timeout_seconds = 1800`, rétention 14 j | [sqs.tf:214-227](../../../infrastructure/terraform/modules/platform/sqs.tf#L214), confirmé par M11 |
| DLQ | `artifact-generator-dlq<suffixe>`, `maxReceiveCount = 3` | [sqs.tf:205-222](../../../infrastructure/terraform/modules/platform/sqs.tf#L205) |
| Lambda worker | `timeout = 300`, `memory_size = 512`, `arm64`, image partagée | [lambda_workers.tf:64-69](../../../infrastructure/terraform/modules/platform/lambda_workers.tf#L64), confirmé par M10 |
| Mapping SQS | `batch_size = 1`, `scaling_config.maximum_concurrency = 10`, `enabled = var.enable_worker_polling` | [lambda_workers.tf:170-187](../../../infrastructure/terraform/modules/platform/lambda_workers.tf#L170) |
| Délai d'appel LLM | `LLM_TIMEOUT_SECONDS`, défaut **180 s** | [worker.py:148-150](../../../media_summarizer/workers/artifact_generator/worker.py#L148) |
| Taille max du message | 262 144 o ; aucun octet de transcript ne transite (des clés S3 seulement) | M11, [artifact_service.py:1855-1880](../../../media_summarizer/core/services/artifact_service.py#L1855) |
| États | `queued`, `generating`, `ready`, `failed` | [media_artifact.py:68-72](../../../media_summarizer/core/models/media_artifact.py#L68) |
| Bail | `GENERATION_LEASE_SECONDS = 300`, calé sur le timeout de la Lambda ; `claim_artifact_generation` rend `None` si l'entrée est terminale ou sous bail vivant, et le worker **rend la main sans appeler le LLM** | [artifact_service.py:130-132](../../../media_summarizer/core/services/artifact_service.py#L130), [artifact_service.py:2140-2166](../../../media_summarizer/core/services/artifact_service.py#L2140), [worker.py:305-315](../../../media_summarizer/workers/artifact_generator/worker.py#L305) |
| Axe de reprise | `failure_kind` lu sur l'exception : `PERMANENT` → le message est **acquitté** sans brûler ses redélivrances ; sinon les 3 tentatives sont conservées | [worker.py:463-475](../../../media_summarizer/workers/artifact_generator/worker.py#L463) |
| Taxonomie des refus fournisseur | `REFUSAL_QUOTA`, `REFUSAL_AUTHENTICATION`, `REFUSAL_RATE_LIMIT`, croisée avec `TRANSIENT`/`PERMANENT` ; un 429 avec `Retry-After` est `TRANSIENT + rate_limit`, un 429 nu est lu comme `PERMANENT + quota` | [llm_failure.py:79-90](../../../media_summarizer/utils/llm_failure.py#L79), [llm_failure.py:210-259](../../../media_summarizer/utils/llm_failure.py#L210) |
| Codes d'erreur applicatifs | `sources_preparation_timeout`, `sources_preparation_failed`, `sources_changed`, `generation_stalled`, `VALIDATION_ERROR`, `INTERNAL_ERROR` | [artifact_service.py:222-229](../../../media_summarizer/core/services/artifact_service.py#L222) |
| Bornes d'âge | attente de sources 3 600 s ; génération interne bloquée 1 800 s | [artifact_service.py:140-156](../../../media_summarizer/core/services/artifact_service.py#L140) |

### 2.3 Le worker a déjà deux modes, et c'est le fait structurant

`process_message` lit un bloc `translation` optionnel sur le message
([worker.py:256-258](../../../media_summarizer/workers/artifact_generator/worker.py#L256)) et, s'il
est présent, prend une branche entièrement différente : une lecture S3 d'un artefact déjà stocké au
lieu de N transcripts, un prompt de traduction au lieu d'un prompt de type, un modèle dédié
(`TRANSLATION_MODEL`) — **mais le même bail, la même gestion d'échec, le même appel de scellement**
([worker.py:317-326](../../../media_summarizer/workers/artifact_generator/worker.py#L317),
[worker.py:480-591](../../../media_summarizer/workers/artifact_generator/worker.py#L480)).

C'est le précédent qui rend un troisième mode banal plutôt qu'intrusif, et il est documenté comme
tel dans l'en-tête du fichier : *« Everything around it is shared on purpose — the same queue, the
same lease, the same failure taxonomy, the same sealing call — because what changes is only where
the input text comes from »*
([worker.py:22-24](../../../media_summarizer/workers/artifact_generator/worker.py#L22)).

### 2.4 Où un tour de conversation **peut** s'insérer, et où il ne peut pas

| Élément du pipeline | Un tour peut-il s'y insérer ? |
|---|---|
| `artifact-generator-queue` + DLQ + redrive | **Oui, tel quel.** Un message `chat` fait quelques Ko, très loin des 256 Ko ; `batch_size = 1` donne une invocation par tour ; `visibility_timeout = 1800` > le timeout de 300 s, donc aucune redélivrance ne chevauche une invocation vivante |
| Lambda `artifact_generator` (300 s, 512 Mo) | **Oui, tel quel.** Un appel LLM séquentiel par invocation, exactement comme aujourd'hui |
| `_call_llm`, `_read_llm_usage`, `estimate_llm_cost_eur`, `classify_llm_failure`, `log_llm_generation_failure`, `record_observed_cost` | **Oui, tels quels.** Une seule adaptation : `_call_llm` envoie aujourd'hui `messages: [{"role": "user", …}]`, un unique message ([worker.py:151-154](../../../media_summarizer/workers/artifact_generator/worker.py#L151)) ; une conversation a besoin d'un tableau de messages |
| `corpus.build_prompt` (préambule → corpus balisé → instructions) | **Oui, tel quel**, et c'est ce qui rend le cache possible : le corpus reste un préfixe stable et l'historique se place **après** ([corpus.py:111-135](../../../media_summarizer/workers/artifact_generator/generators/corpus.py#L111)) |
| `llm_alerts.tf` | **Oui, gratuitement** : le log group `artifact_generator` est déjà dans `llm_worker_keys` ([llm_alerts.tf:30](../../../infrastructure/terraform/modules/platform/llm_alerts.tf#L30)) |
| Alarme de profondeur de DLQ, widgets « Queue Backlog » et « Lambda … » du tableau de bord | **Oui, gratuitement** : ils sont en `for_each` sur les files et les workers existants ([pipeline_alerts.tf:122-146](../../../infrastructure/terraform/modules/platform/pipeline_alerts.tf#L122)) |
| Table `media_artifacts` comme domicile de la conversation | **Non** : l'`artifact_id` est content-addressed et la génération est mutualisée entre comptes (§2.1) |
| `MediaArtifactRecord` comme enregistrement de tour | **Non** : il est immuable une fois `ready` et l'historique est « ce que l'utilisateur a demandé », filtré par type ([artifact_service.py:940-978](../../../media_summarizer/core/services/artifact_service.py#L940)). Une conversation est mutable par nature : chaque tour ajoute au même objet |
| `ArtifactScope` (`media` / `folder`) | **Oui pour la V1**, et c'est aussi le vocabulaire du moteur d'engagement (`engagement_service.stamp(kind=scope.value)`, [artifacts.py:355-359](../../../media_summarizer/api/endpoints/artifacts.py#L355)). Une portée « bibliothèque » exigerait une troisième valeur et tout ce qui la lit |
| Lambda API comme lieu de l'appel LLM | **Techniquement oui, au prix d'un plafond dur** : §3 et §5 |

---

## 3. La porte d'entrée HTTP déployée et ses plafonds réels

| Fait | Valeur | Preuve |
|---|---|---|
| Type de porte d'entrée | `aws_apigatewayv2_api` avec `protocol_type = "HTTP"` | [lambda_api.tf:131-150](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L131) ; M7 confirme « HTTP » sur l'API déployée |
| Intégration | `AWS_PROXY`, `payload_format_version = "2.0"` | [lambda_api.tf:185-191](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L185) ; M7 |
| Délai d'intégration | 30 000 ms, soit le **maximum absolu** d'une API HTTP, **non augmentable** | M7 ; quotas HTTP API, consultés le 2026-10-06 |
| Route | une seule, `$default`, vers la Lambda | [lambda_api.tf:193-197](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L193) |
| Étranglement de l'étage | `throttling_burst_limit = 1000`, `throttling_rate_limit = 500` | [lambda_api.tf:157-160](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L157) |
| Lambda API | `timeout = 30`, `memory_size = 1024`, `arm64`, image, `reserved_concurrent_executions = -1` en dev et 10 ailleurs | [lambda_api.tf:86-125](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L86), [lambda_api.tf:41-47](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L41) ; M8 |
| Adaptateur | `Mangum(app, lifespan="off")`, qui rend **un dict bufferisé unique** | [lambda_handler.py:30](../../../media_summarizer/api/lambda_handler.py#L30) |
| Function URL | **aucune** | M9 : `ResourceNotFoundException` |
| Appels LLM depuis la Lambda API | **aucun aujourd'hui**. Les seuls appels à `chat/completions` du dépôt sont dans `workers/artifact_generator/worker.py` et `core/services/transcript_translation.py`, et le second n'est atteint que par `workers/transcript_translation_worker.py` — le chemin API n'importe de ce module que des aides locales (détection de langue, construction de clé, dispatch) | grep sur `chat/completions` et `OPENAI_API_KEY` ; [raw_content_service.py:44-52](../../../media_summarizer/core/services/raw_content_service.py#L44) |

**Conséquence opérationnelle du dernier point.** `llm_alerts.tf` construit ses filtres de métrique
sur `aws_cloudwatch_log_group.lambda_worker[each.key]` pour
`llm_worker_keys = ["artifact_generator", "transcript_translation"]`
([llm_alerts.tf:25-82](../../../infrastructure/terraform/modules/platform/llm_alerts.tf#L25)), et le
commentaire au-dessus dit exactement ce qui arrive sinon : *« a new worker starting to call the LLM
must be added here consciously, otherwise its failures are invisible for exactly the reason this
file exists »*. Le log group de la Lambda API n'est pas dans cette liste, et il ne peut pas y être
ajouté par une clé : la ressource est `aws_cloudwatch_log_group.lambda_api`
([lambda_api.tf:73-80](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L73)). Faire
appeler le LLM par la Lambda API coûte donc **un filtre de métrique nouveau** — sinon le refus du
fournisseur sur le chemin du chat est invisible pour les deux alarmes qui existent précisément pour
ça. Le filtre est gratuit, mais c'est un objet Terraform de plus, et surtout un objet **qu'il faut
penser à écrire**.

---

## 4. Le mécanisme de quota et de refus, établi dans le code

### 4.1 Une seule unité, et elle est la minute

*« One unit is metered: the **minute** »*
([quota_enforcer.py:1-34](../../../media_summarizer/core/services/quota_enforcer.py#L1)), avec
quatre conversions plates dans `pricing_config.unit_conversion` : un jeu de sous-titres acheté vaut
1 minute, cinq pages de document valent 1 minute, un fichier texte vaut **0**, et **cinq sources
d'une génération de dossier valent 1 minute**
([pricing_config_service.py:214-235](../../../media_summarizer/core/services/pricing_config_service.py#L214)).

La règle qui tient la comptabilité : *« the meter follows the provider call, not the URL. An API
endpoint only ever **checks**; the debit happens at the place that spends provider money »*
([quota_enforcer.py:20-25](../../../media_summarizer/core/services/quota_enforcer.py#L20)).

### 4.2 Où exactement c'est débité, pour une génération

1. `POST /api/artifacts` vérifie la propriété du scope, résout les sources, applique les plafonds,
   **planifie**, puis — et seulement si le compte ne détient pas déjà l'entrée —
   `check_generation_allowed(user_id, scope, source_count)`
   ([artifacts.py:299-321](../../../media_summarizer/api/endpoints/artifacts.py#L299)).
2. `check_generation_allowed` convertit : `minutes_for_folder_sources(source_count)` si
   `scope == "folder"`, **0 sinon**
   ([quota_enforcer.py:923-960](../../../media_summarizer/core/services/quota_enforcer.py#L923)).
3. Après l'écriture, `record_generation(user_id, scope=…, source_count=…,
   idempotency_token=record.artifact_id)`
   ([artifacts.py:334-345](../../../media_summarizer/api/endpoints/artifacts.py#L334),
   [quota_enforcer.py:1199-1216](../../../media_summarizer/core/services/quota_enforcer.py#L1199)).
4. `_debit` fait un `ADD` atomique sur `user_usage_monthly` **et** sur `user_usage_daily`, le token
   d'idempotence entrant dans l'ensemble `settled_jobs` du même item sous une condition qui rejette
   un token déjà appliqué
   ([quota_enforcer.py:1052-1130](../../../media_summarizer/core/services/quota_enforcer.py#L1052),
   [quota_usage_db.py:103-134](../../../media_summarizer/utils/quota_usage_db.py#L103)).
   `_debit` est **best-effort par conception** : une écriture de compteur qui échoue ne fait jamais
   échouer le travail que l'utilisateur attend.
5. Le coût LLM réellement mesuré est enregistré à part, pour l'observabilité seulement, par
   `record_observed_cost` sous le token `artifact_cost:<artifact_id>`
   ([worker.py:594-612](../../../media_summarizer/workers/artifact_generator/worker.py#L594),
   [quota_enforcer.py:1238-1268](../../../media_summarizer/core/services/quota_enforcer.py#L1238)).
   **Rien ne lit ce chiffre pour autoriser ou refuser** ; c'est l'allocation en minutes qui borne la
   dépense.

### 4.3 Les refus que l'app sait déjà afficher

Il n'y en a que **deux**, et c'est explicite : *« The only two refusals the product has »*
([quota_enforcer.py:56-60](../../../media_summarizer/core/services/quota_enforcer.py#L56)).

| `error_code` | HTTP | Figures envoyées | Décidé par |
|---|---|---|---|
| `out_of_minutes` | 403 | `has_plan`, et si un plan existe `minutes_needed`, `minutes_remaining`, `period_end`, `beta_access` | [quota_enforcer.py:874-920](../../../media_summarizer/core/services/quota_enforcer.py#L874) |
| `item_too_long` | 413 | `minutes_needed`, `max_minutes_per_item` | idem |

Le serveur n'envoie **jamais de phrase** : *« the numbers travel typed, and the app words them from
its own catalogue »*
([quota_enforcer.py:72-81](../../../media_summarizer/core/services/quota_enforcer.py#L72)). Côté
artefacts, l'app sait aussi peindre `scope_empty` et `scope_too_large` (422, avec ses quatre
chiffres), `INVALID_ARTIFACT_TYPE` (400), `artifact_not_ready` et `artifact_failed` (409)
([artifacts.py:48-54](../../../media_summarizer/api/endpoints/artifacts.py#L48),
[artifacts.py:401-422](../../../media_summarizer/api/endpoints/artifacts.py#L401)), et les clés i18n
correspondantes existent dans les onze catalogues
([en.ts:329-337](../../../mobile/src/i18n/en.ts#L329)).

### 4.4 Le régime beta, et ce que les testeurs consomment réellement

Tant que `beta_access.enabled` est vrai, **tout compte reçoit l'allocation du palier le plus large
du catalogue**, quoi qu'il ait acheté
([quota_enforcer.py:538-566](../../../media_summarizer/core/services/quota_enforcer.py#L538),
[quota_enforcer.py:664-672](../../../media_summarizer/core/services/quota_enforcer.py#L664)). Le
palier le plus large est aujourd'hui `audio_heavy`, **720 minutes par mois**
([pricing_config_service.py:72-82](../../../media_summarizer/core/services/pricing_config_service.py#L72)).

**Mesure M6 : le maximum observé de `minutes_used` sur une période est 112.** Soit **15,6 %** de
l'allocation beta. Il reste donc, pour le testeur le plus lourd mesuré, **608 minutes de marge par
période** — et c'est le chiffre qui dit si un chatbot tient dans le compteur existant (§9.3).

Les garde-fous journaliers, qui **n'ont jamais refusé quoi que ce soit** et ne servent qu'à prévenir
l'owner : `minutes_per_day` 150, `items_per_day` 60, `documents_per_day` 40,
`document_pages_per_day` 400, **`generations_per_day` 50**
([pricing_config_service.py:139-152](../../../media_summarizer/core/services/pricing_config_service.py#L139),
[quota_enforcer.py:968-1024](../../../media_summarizer/core/services/quota_enforcer.py#L968)).

---

## 5. Le streaming de réponse : tranché

### 5.1 Ce que la porte d'entrée déployée permet

**Elle ne permet pas le streaming, et ce n'est pas une question de réglage.**

1. La porte d'entrée est une **API HTTP** (`aws_apigatewayv2_api`, `protocol_type = "HTTP"`,
   [lambda_api.tf:131-135](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L131),
   confirmé déployé par M7).
2. Le streaming à travers API Gateway se configure par la propriété **`responseTransferMode`**
   (`BUFFERED` ou `STREAM`) de la ressource `Integration`. Cette propriété **existe sur l'API REST
   (v1) et n'existe pas sur `apigatewayv2`** : la liste complète des propriétés d'une intégration
   `apigatewayv2` (consultée le 2026-10-06) ne la contient pas. L'URI d'intégration du mode `STREAM`
   est d'ailleurs de la forme v1,
   `arn:aws:apigateway:…:lambda:path/2021-11-15/functions/…/response-streaming-invocations`, là où
   l'intégration déployée est `integration_uri = aws_lambda_function.api.invoke_arn`
   ([lambda_api.tf:188](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L188)).
3. **Il n'y a aucune Function URL** sur la Lambda API (M9 : `ResourceNotFoundException`), qui est
   l'autre chemin de streaming documenté.
4. Même en changeant de porte d'entrée, le runtime bloque : *« Lambda supports response streaming on
   **Node.js managed runtimes**. For other languages, **including Python**, you can use a custom
   runtime with a custom Runtime API integration … or use the Lambda Web Adapter »*. La Lambda API
   est une image Python dont le CMD est `media_summarizer.api.lambda_handler.handler` (M8) et dont
   l'adaptateur est `Mangum(app, lifespan="off")`
   ([lambda_handler.py:30](../../../media_summarizer/api/lambda_handler.py#L30)) — un adaptateur qui
   **rend un dict unique**, pas un flux.
5. Et le plafond de 30 s reste : **« Maximum integration timeout : 30 seconds, Can be increased :
   No »** pour une API HTTP. Sur une API REST il monte au-delà de 29 s, mais *« for Regional or
   private APIs only »*.

**Le prix en Terraform de chacune des deux voies, chiffré en objets nouveaux :**

| Voie | Objets Terraform nouveaux | Objets applicatifs nouveaux |
|---|---|---|
| **Remplacer la porte d'entrée par une API REST en mode `STREAM`** | `aws_api_gateway_rest_api`, `aws_api_gateway_resource` (au moins un proxy), `aws_api_gateway_method`, `aws_api_gateway_integration` (avec `responseTransferMode = "STREAM"` et l'URI `response-streaming-invocations`), `aws_api_gateway_deployment`, `aws_api_gateway_stage`, `aws_api_gateway_account` + le rôle de log, un nouveau certificat et un nouveau mapping de domaine, et la **réécriture de toutes les alarmes et de tous les widgets** indexés sur `local.api_gateway_id` (dimension `ApiId` → `ApiName`/`Stage`) : **≥ 10** | remplacer Mangum par le Lambda Web Adapter, écrire l'émission des métadonnées JSON + le délimiteur de **8 octets nuls dans les 16 premiers Ko** (une sortie non conforme reçoit un **500**), et le client doit lire un flux au lieu d'un JSON : **3** |
| **Ajouter une API WebSocket** à côté de l'API HTTP | `aws_apigatewayv2_api` (WEBSOCKET), son `aws_apigatewayv2_stage`, 3 routes (`$connect`, `$disconnect`, `$default`) + 3 intégrations, une table DynamoDB de `connection_id`, une politique IAM `execute-api:ManageConnections`, une `aws_lambda_permission` : **≥ 11** | un client qui gère la reconnexion contre les fermetures à **10 min d'inactivité** et à **2 h de durée de vie**, le nettoyage des `connection_id` morts sur `GoneException`, et un chemin de secours quand la socket est tombée : **3** |

### 5.2 Ce que l'UX de chat exige réellement, mesuré

Le streaming achète du **temps au premier octet**. Les 128 générations réelles de `-dev` (M1) disent
combien il y a à acheter :

| Type | n | min | médiane | p90 | max |
|---|---|---|---|---|---|
| `review_blurb` | 91 | 1,8 s | **5,8 s** | 7,4 s | 80,1 s |
| `flashcards` | 5 | 5,7 s | 10,3 s | 18,7 s | 27,3 s |
| `quiz` | 12 | 6,1 s | 13,0 s | 14,6 s | 32,1 s |
| `notes` | 8 | 5,7 s | 14,8 s | 22,9 s | **123,6 s** |
| `summary_short` | 10 | 9,1 s | 19,4 s | 37,6 s | 46,3 s |
| `summary_detailed` | 2 | 13,0 s | 20,9 s | — | 28,8 s |
| **Tous** | **128** | **1,8 s** | **6,3 s** | **16,9 s** | **123,6 s** |

Mesure : `completed_at − created_at` sur les lignes qui portent un `llm_usage`, c'est-à-dire les
vraies générations et non les pointeurs mirés. L'intervalle inclut donc la latence de file et de
démarrage à froid, pas seulement l'appel LLM : c'est exactement ce que l'utilisateur attend.

**Et la latence suit la sortie, pas l'entrée.** Les cinq générations à plus de 15 000 tokens
d'entrée :

| Tokens d'entrée | Tokens de sortie | Latence |
|---|---|---|
| 62 601 | 4 458 | 27,3 s |
| **52 130** | **78** | **2,9 s** |
| 22 668 | 1 511 | 11,8 s |
| 22 301 | 2 671 | 14,8 s |
| 21 939 | 90 | 6,1 s |

52 130 tokens d'entrée pour 78 tokens de sortie : **2,9 s**. Une réponse de chat tient dans quelques
centaines de tokens de sortie, donc dans la même zone — autour de 5 à 15 s même sur un gros corpus.

### 5.3 Verdict, architecture par architecture

**Aucune architecture ne doit streamer en V1.** Ce que l'attente coûte est déjà peint par l'app, et
sans une ligne nouvelle :

- le badge `artifacts.status.generating` et son `ActivityIndicator`
  ([ArtifactTile.tsx:118-142](../../../mobile/src/components/ArtifactTile.tsx#L118),
  [en.ts:60-61](../../../mobile/src/i18n/en.ts#L60)) ;
- la cadence **3 s pendant 60 s, puis 10 s, budget total 5 min, puis un marqueur immobile**
  ([useProcessingRefresh.ts:68-75](../../../mobile/src/hooks/useProcessingRefresh.ts#L68)) — dont le
  commentaire dit que la phase rapide est *« the window 94,3 % of processings finish in »*.

| Architecture | S'en passe-t-elle ? | Comment |
|---|---|---|
| **A — tour synchrone** | Oui, **et elle n'a même pas besoin de poller** : la réponse revient dans la même requête HTTP. Un indicateur de saisie, exactement comme un `ActivityIndicator` sur le bouton d'envoi | Prix : la réponse doit tenir dans **30 s**, plafond non augmentable. Mesuré : 27,3 s pour 62 601 tokens d'entrée et 4 458 de sortie, et 123,6 s au maximum observé. Au-delà, le client reçoit un 504 d'API Gateway sur un tour pour lequel le LLM a déjà été payé |
| **B — tour asynchrone sur la file existante** | Oui. Le tour est `queued` puis `generating` puis `ready`, et l'app poll la conversation sur la cadence qu'elle applique déjà aux artefacts | Prix : un aller-retour réseau toutes les 3 s pendant l'attente, soit ~5 requêtes `GET` pour une réponse médiane de 15 s. Sur 12 testeurs beta, c'est du bruit |
| **C — objet de première classe** | **Non, c'est son intérêt** : elle streame token par token sur une socket | Prix : ≥ 11 objets Terraform nouveaux et un client qui gère deux fermetures imposées (10 min, 2 h) |

---

## 6. Le coût LLM réel, chiffré en euros

### 6.1 Les modèles retenus par le dépôt, leurs prix et leurs fenêtres

Le dépôt a deux modèles, validés par l'owner dans task-72 (`Decision`: *« summary_short :
gpt-5-nano-2025-08-07, all other artefacts : gpt-5.4-nano-2026-03-17 »*), et ils sont câblés en
clair :

- `OPENAI_MODEL` défaut `gpt-5.4-nano-2026-03-17`, `SUMMARY_SHORT_LLM_MODEL` défaut
  `gpt-5-nano-2025-08-07`
  ([artifact_service.py:110-117](../../../media_summarizer/core/services/artifact_service.py#L110)) ;
- la table de prix du code, **prix catalogue en USD par million de tokens, convertis à
  `USD_EUR = 0.86`** : `gpt-5.4-nano` (0,20 / 0,02 / 1,25), `gpt-5-nano` (0,05 / 0,005 / 0,40), un
  modèle inconnu retombant sur le plus cher
  ([llm_pricing.py:19-34](../../../media_summarizer/core/services/llm_pricing.py#L19)).

Ces deux lignes de prix sont **identiques au tarif catalogue relevé le 2026-10-06** sur
`developers.openai.com/api/docs/pricing` (§1.4) : la table du dépôt n'a pas dérivé.

| Modèle | Entrée $/1M | Entrée en cache $/1M | Sortie $/1M | Contexte | Entrée max | Sortie max |
|---|---|---|---|---|---|---|
| `gpt-5-nano` | 0,05 | 0,005 | 0,40 | 400 000 | **272 000** | 128 000 |
| `gpt-5.4-nano` | 0,20 | 0,02 | 1,25 | 400 000 | **272 000** | 128 000 |
| `gpt-5.4-mini` (non utilisé) | 0,75 | 0,075 | 4,50 | — | — | — |
| `gpt-5.4` (non utilisé) | 2,50 | 0,25 | 15,00 | — | 272 000 puis tarif long contexte | — |

**Règles de cache qui comptent ici** (toutes relevées le 2026-10-06, §1.4) :

- le cache est **actif par défaut** ; le dépôt n'envoie que `prompt_cache_key`, jamais
  `prompt_cache_retention` ([worker.py:156-159](../../../media_summarizer/workers/artifact_generator/worker.py#L156)) ;
- une lecture en cache coûte **0,1× l'entrée** ;
- il ne mord que sur un **préfixe exactement identique**, et `cached_tokens` est **arrondi au
  multiple de 128 inférieur** sur les modèles antérieurs à 5.6 ;
- **rétention** : faute de `prompt_cache_retention` explicite, le défaut est `24h` pour une
  organisation sans Zero Data Retention — *« typically keeps entries available for around 30 minutes
  and can retain them for up to 24 hours »* ; et **réutiliser un préfixe rafraîchit sa durée de vie
  sans frais d'écriture**. C'est exactement le régime d'une conversation : chaque tour rafraîchit le
  corpus. Avec `in_memory` ce serait *« 5 to 10 minutes of inactivity, up to one hour »*, donc une
  conversation reprise le lendemain repaierait son corpus plein tarif ;
- le cache est **par organisation** et porté par une machine : au-delà d'environ 15 requêtes par
  minute sur un même `prompt_cache_key`, le trafic peut déborder sur une autre machine. À 12
  testeurs, hors d'atteinte.

### 6.2 Ce que les générations de `-dev` disent des tokens et du coût (M1)

157 lignes, dont **128 portant un `llm_usage`** (les 29 autres sont des pointeurs mirés ou des
entrées en échec). 154 `ready`, 3 `failed`, un seul `error_code` (`INTERNAL_ERROR`). 26 générations
partagées et 26 pointeurs. 145 lignes à portée média, 12 à portée dossier.

| Type | n | tokens d'entrée (méd. / max) | tokens de sortie (méd. / max) | coût € (méd. / max) | `cached_tokens` / `prompt_tokens` |
|---|---|---|---|---|---|
| `review_blurb` | 91 | 1 056 / 52 130 | 81 / 169 | 0,00027 / 0,00905 | 9,9 % |
| `summary_short` | 10 | 2 016 / 3 673 | **2 678** / 5 468 | 0,00102 / 0,00203 | **0 %** |
| `quiz` | 12 | 2 798 / 22 668 | 1 338 / 1 622 | 0,00197 / 0,00552 | 14,7 % |
| `notes` | 8 | 2 728 / 22 301 | 2 045 / 2 888 | 0,00285 / 0,00439 | 49,3 % |
| `flashcards` | 5 | 1 642 / **62 601** | 826 / 4 458 | 0,00117 / 0,01556 | **0 %** |
| `summary_detailed` | 2 | 4 156 / 7 759 | 2 408 / 3 891 | 0,00330 / 0,00552 | **0 %** |
| **Tous** | **128** | méd. 1 222, p90 8 275, max 62 601 | — | **total 0,1377 €** | **11,9 %** |

Quatre faits que ce tableau impose à la suite :

1. **Le taux de hit du cache réellement observé est de 11,9 %**, et il est de **0 %** sur trois types.
   C'est cohérent avec ce que le cache exige : cinq invocations *concurrentes* se partageant un
   préfixe qu'aucune n'a encore écrit. Une conversation est le cas inverse — **séquentielle**, même
   préfixe, même clé — donc le régime favorable est plausible, mais **ce dépôt n'en a aucune mesure**.
   D'où la double colonne « avec / sans cache » partout en §6.3, et d'où le signal chiffré de la
   tranche 2 (§12).
2. **Le plus gros prompt réellement envoyé est de 62 601 tokens**, sur une génération de dossier à
   2 sources. Le plafond du code est 120 000 : il n'a jamais été atteint sur `-dev`.
3. **`summary_short` consomme 2 678 tokens de sortie médians pour ~300 tokens visibles.** C'est
   l'écart que task-316 §2.13 n'explique pas et attribue à des tokens de raisonnement non
   instrumentés (`completion_tokens_details` est jeté par `_read_llm_usage`). Les types sur
   `gpt-5.4-nano` ne montrent pas cet écart (`review_blurb` : 81 tokens de sortie médians). **Toutes
   les estimations ci-dessous portent sur `gpt-5.4-nano`**, et un budget de sortie de 500 tokens par
   tour y est cohérent avec les mesures.
4. **Le coût total de toutes les générations jamais faites sur `-dev` est de 0,1377 €.** C'est
   l'échelle réelle du projet, et c'est ce qui disqualifie tout argument d'optimisation de coût
   comme critère d'architecture.

### 6.3 Le modèle de coût d'une conversation, et ses résultats

**Étalonnage de corpus, mesuré (M3 + M4) :** 85 967 octets de transcript pour 4 670,85 s d'audio,
soit 1 104 o/min, soit **325 tokens/minute de parole** à `BYTES_PER_TOKEN = 3.4`
([artifact_service.py:126-128](../../../media_summarizer/core/services/artifact_service.py#L126)).
Donc **un média d'une heure vaut 19 487 tokens**. Le dossier au plafond en vigueur vaut
`MAX_FOLDER_CORPUS_TOKENS = 120 000`
([artifact_service.py:124-125](../../../media_summarizer/core/services/artifact_service.py#L124)) ;
à la médiane de task-269 (4 622 tokens par source), 25 sources en valent 115 550, donc les deux
plafonds se rejoignent et 120 000 est le chiffre à retenir.

**Paramètres du modèle.** `I = 400` tokens d'instructions (hypothèse de task-269, §2.1 de ce
document pour la mise en page), `Q = 60` tokens de question (≈ 240 caractères), `A = 500` tokens de
réponse. Modèle `gpt-5.4-nano` aux prix de §6.1, `USD_EUR = 0.86`.

**Formule.** Avec la mise en page corpus → instructions → historique → question, la requête du tour
*k* vaut `C + I + (k−1)(Q+A) + Q` tokens d'entrée et produit `A` tokens de sortie. Le préfixe
partagé avec la requête du tour *k−1* est `C + I + (k−2)(Q+A) + Q`, donc **la partie fraîche d'un
tour est exactement `Q + A` = 560 tokens**, quel que soit le rang du tour et quelle que soit la
taille du corpus.

    coût(tour k) = [ frais × 0,20 + en_cache × 0,02 + 500 × 1,25 ] / 10⁶ × 0,86

| Scénario | T1 | 5 tours (cumul) | 10 tours | 20 tours |
|---|---|---|---|---|
| **Média d'1 h (19 487 tok), sans cache** | **0,00397 €** | 0,02081 € | 0,04402 € | **0,09767 €** |
| **Média d'1 h, avec cache** | 0,00397 € | 0,00793 € | 0,01311 € | **0,02418 €** |
| **Dossier au plafond (120 000 tok), sans cache** | **0,02126 €** | 0,10725 € | 0,21690 € | **0,44343 €** |
| **Dossier au plafond, avec cache** | 0,02126 € | 0,03214 € | 0,04595 € | **0,07431 €** |
| *Pour mémoire* : récupération de 8 extraits Algolia au lieu du corpus, sans cache possible | 0,00446 € | 0,02327 € | 0,04895 € | 0,10752 € |

En équivalent-minutes d'allocation (1 minute = **0,00664 €**, le coût Deepgram qui est l'unique
source de vérité du prix d'une minute,
[pricing_config_service.py:181-186](../../../media_summarizer/core/services/pricing_config_service.py#L181)) :

| Scénario | T1 | 20 tours |
|---|---|---|
| Média d'1 h, sans cache | 0,6 min | **14,7 min** |
| Média d'1 h, avec cache | 0,6 min | 3,6 min |
| Dossier au plafond, sans cache | 3,2 min | **66,8 min** |
| Dossier au plafond, avec cache | 3,2 min | 11,2 min |

**Le même chiffrage, rangé par architecture candidate.** Le tableau ci-dessus est un tableau de
*stratégies de contexte* : A, B et D envoient exactement le même prompt au même modèle, donc elles
coûtent la même chose au centime. C est la seule qui diffère, et seulement si elle active la
récupération.

| Architecture | 1ᵉʳ tour, média d'1 h | 1ᵉʳ tour, dossier au plafond | 5 tours | 10 tours | 20 tours |
|---|---|---|---|---|---|
| **A** — synchrone (sans cache / avec cache) | 0,00397 € / 0,00397 € | *hors de portée dans 30 s* | 0,02081 / 0,00793 € | 0,04402 / 0,01311 € | 0,09767 / 0,02418 € |
| **B** — file existante (sans cache / avec cache) | 0,00397 € / 0,00397 € | 0,02126 € / 0,02126 € | 0,02081 / 0,00793 € *(média)* · 0,10725 / 0,03214 € *(dossier)* | 0,04402 / 0,01311 € · 0,21690 / 0,04595 € | 0,09767 / 0,02418 € · 0,44343 / 0,07431 € |
| **C** — corpus complet, comme B | identique à B | identique à B | identique à B | identique à B | identique à B |
| **C** — avec récupération de 8 extraits *(cache impossible)* | 0,00446 € | 0,00446 € | 0,02327 € | 0,04895 € | 0,10752 € |
| **D** — état chez le fournisseur | identique à B | identique à B | identique à B | identique à B | identique à B |

La ligne qui compte : **C avec récupération est la plus chère de toutes à 20 tours** (0,10752 €),
plus chère que le corpus complet caché au plafond dossier (0,07431 €) et 4,4× le corpus complet
caché à portée média (0,02418 €).

### 6.4 Où part le coût, et les deux conséquences contre-intuitives

**Le coût est le corpus, relu à chaque tour. La question et la réponse sont des erreurs d'arrondi.**

| Scénario | Part de l'entrée dans le coût du tour |
|---|---|
| Dossier au plafond, tour 1 | **97,5 %** |
| Média d'1 h, tour 1 | 86,5 % |
| Dossier au plafond, tour 20 avec cache | 78,0 % (dont la quasi-totalité au tarif cache) |
| Média d'1 h, tour 20 avec cache | 44,9 % |

**Conséquence 1 : le cache de prompt est le seul levier qui déplace le coût d'un ordre de grandeur.**
×4,0 sur un média à 20 tours, **×6,0 sur un dossier au plafond**. Aucun choix d'architecture, de
table, de file ou de transport n'approche ce facteur. Et il est **déjà acquis** : la mise en page
corpus-d'abord existe depuis task-269 §2.6 et est protégée par un commentaire explicite
([corpus.py:1-21](../../../media_summarizer/workers/artifact_generator/generators/corpus.py#L1)).
La seule chose à faire est de **ne pas la casser** : l'historique et la question vont **après** les
instructions, jamais devant le corpus.

**Conséquence 2 : tronquer l'historique pour économiser des tokens coûte plus cher que le garder.**
Une fenêtre glissante de 4 tours mesurée dans le même modèle :

| Scénario | 20 tours, historique complet | 20 tours, fenêtre de 4 tours |
|---|---|---|
| Média d'1 h, avec cache | **0,02418 €** | 0,02762 € (+14 %) |
| Dossier au plafond, avec cache | **0,07431 €** | 0,07775 € (+5 %) |

La raison est mécanique : dès qu'on retire le tour le plus ancien, les octets qui suivent le corpus
changent, le préfixe cachable **retombe au corpus seul**, et la fenêtre conservée est refacturée
plein tarif à chaque tour. **Donc : pas de fenêtre glissante, pas de résumé de l'historique, pas
d'étage de condensation.** Le plafond de 20 tours (§9.2) est ce qui borne la croissance, et il la
borne à 10 640 tokens d'historique — **8,1 %** du corpus au plafond.

---

## 7. Les architectures candidates

Quatre candidates, couvrant l'écart demandé : de la réutilisation maximale de ce qui est déployé
jusqu'à la conversation comme objet de première classe, plus une voie intermédiaire qui déporte
l'état chez le fournisseur.

### 7.1 A — Tour synchrone sur la Lambda API

**Où vit la conversation.** Table nouvelle `chat_conversations<suffixe>`, `PAY_PER_REQUEST`,
PK `user_id` (S), SK `conversation_id` (S, un ULID : il trie chronologiquement, donc la liste des
conversations d'un compte est **une `Query` sur la PK, sans GSI**). Les tours vivent **dans l'item**,
en liste : `index`, `question`, `answer`, `status`, `created_at`, `completed_at`, `llm_usage`,
`error_code`. Attributs de tête : `scope`, `scope_id`, `content_scope_id`, `source_snapshot`,
`title`, `turn_count`, `updated_at`.

**Durée de vie et purge.** Pas de TTL (voir §9.4), une suppression explicite
`DELETE /api/chat/conversations/{id}`, et l'effacement de compte couvert par **une ligne** ajoutée à
`_USER_PARTITION_TABLES`
([account_deletion_service.py:85-97](../../../media_summarizer/core/services/account_deletion_service.py#L85)) :
la table est partitionnée par `user_id`, donc elle entre dans le balayage existant sans code
nouveau. Taille d'item bornée par le plafond de 20 tours : ~25 Ko au pire, contre 400 Ko de limite.

**Transport et rendu.** `POST /api/chat/conversations/{id}/turns` fait l'appel LLM **en ligne** et
renvoie la réponse dans la même requête. Pas de polling, pas d'état `queued` à peindre : un
indicateur sur le bouton d'envoi suffit. C'est le meilleur ressenti **tant que ça rentre dans
30 s**, et 30 s est un plafond d'API Gateway HTTP **non augmentable** (§3). Mesuré : 27,3 s pour
62 601 tokens d'entrée et 4 458 de sortie, 123,6 s au maximum observé. Un dépassement rend un 504 à
l'app **sur un tour que le fournisseur a déjà facturé**, et sans entrée persistée il n'y a rien à
reprendre.

**Stratégie de contexte.** Corpus complet, puis instructions, puis historique complet, puis
question — mise en page corpus-d'abord (§6.4). Croissance : `+560` tokens par tour. Tient dans la
fenêtre de 272 000 tokens jusqu'à ~270 tours au plafond de corpus : **la fenêtre n'est jamais la
contrainte**.

**Portée.** Média : sûr. Dossier : **à éviter**, le premier tour sur 120 000 tokens n'a pas de marge
dans 30 s. Bibliothèque : impossible sans récupération (§7.3).

**Coût.** Identique à B — lignes « média » et « dossier » de §6.3.

**Surface d'exploitation.** Un **filtre de métrique nouveau** sur
`aws_cloudwatch_log_group.lambda_api`, pour que `llm.generation_failed` entre dans la métrique
`LlmGenerationFailures` ; sans lui, les deux alarmes LLM existantes sont aveugles sur ce chemin
(§3). La latence, elle, est couverte gratuitement par `api-latency-p95-breach`, qui lit
`AWS/ApiGateway Latency` sur `ApiId`
([pipeline_alerts.tf:39-63](../../../infrastructure/terraform/modules/platform/pipeline_alerts.tf#L39))
— **mais elle va se déclencher**, parce que le p95 de l'API passerait de quelques centaines de
millisecondes à plusieurs secondes. Relever `api_slow_request_threshold_ms` **dégraderait l'alarme
pour toutes les autres routes**. C'est le coût d'exploitation le plus difficile à annuler des quatre
candidates.

### 7.2 B — Un tour est un troisième mode du worker d'artefacts *(recommandée)*

**Où vit la conversation.** Exactement le même modèle de données que A : même table, mêmes clés,
même durée de vie, même purge. La différence n'est pas le domicile de la conversation, c'est **qui
calcule le tour**.

**Transport et rendu.**

1. `POST /api/chat/conversations/{id}/turns` : propriété du scope par le `_assert_scope_owned`
   existant ([artifacts.py:209-231](../../../media_summarizer/api/endpoints/artifacts.py#L209)),
   plafonds, quota, puis écriture du tour en `queued` sous un `UpdateExpression` conditionnel
   (`turn_count = :expected`) — ce qui absorbe le double tap exactement comme la création
   conditionnelle absorbe deux générations concurrentes
   ([artifact_service.py:1938-1949](../../../media_summarizer/core/services/artifact_service.py#L1938)).
   Puis **un message sur `artifact-generator-queue`** portant un bloc `chat` : `conversation_id`,
   `turn_index`, `prompt_cache_key`, les clés S3 des sources, et l'historique. Réponse **202**.
2. Le worker reconnaît le bloc `chat`, prend le bail, télécharge les transcripts
   (`_download_transcripts`, inchangé), assemble le prompt avec `corpus.build_prompt` puis
   l'historique, appelle `_call_llm`, lit l'usage, écrit la réponse dans l'item et passe le tour en
   `ready` — ou en `failed` avec un code de la taxonomie existante.
3. L'app poll `GET /api/chat/conversations/{id}` sur la cadence **3 s / 10 s / budget 5 min** qu'elle
   applique déjà aux générations
   ([useProcessingRefresh.ts:68-75](../../../mobile/src/hooks/useProcessingRefresh.ts#L68)).

Pas de streaming : l'attente est l'état `generating` que l'app sait peindre (§5.3).

**Stratégie de contexte, portée, coût** : identiques à A, sans le plafond de 30 s. Le budget est
celui du worker : **300 s de Lambda et 180 s d'appel LLM**, soit 10× et 6× la marge de A.

**Surface d'exploitation : rien de nouveau.** Le log group `artifact_generator` est **déjà** dans
`llm_worker_keys`
([llm_alerts.tf:30](../../../infrastructure/terraform/modules/platform/llm_alerts.tf#L30)), donc
`llm-provider-refused` (seuil 0) et `llm-generation-failures` (seuil 3 en 15 min) couvrent les tours
de chat le jour où le code est déployé. La file est déjà dans l'alarme de profondeur de DLQ et dans
les widgets « Queue Backlog » et « Lambda … », tous en `for_each`. Le coût observé est déjà
enregistré par `record_observed_cost`.

Un seul effet de bord : **les métriques de la file mélangent deux charges**. Un retard de chat
ressemblera à un retard d'artefacts sur le widget « Queue Backlog ». L'alarme qui compte, elle, est
sur la **profondeur du DLQ**, qui reste exacte, et le worker multiplexe déjà deux charges depuis
task-395 (§2.3) : c'est un précédent assumé dans ce dépôt.

### 7.3 C — La conversation comme objet de première classe

**Où vit la conversation.** Deux tables : `chat_conversations` (PK `user_id`, SK `conversation_id`)
et `chat_turns` (PK `conversation_id`, SK `turn_index`) ; un GSI `user-updated-index` pour lister
les conversations d'un compte par dernière activité ; un bucket S3 pour les réponses longues, sur la
disposition des six buckets d'artefacts
([s3.tf:34-134](../../../infrastructure/terraform/modules/platform/s3.tf#L34)) ; et une table
`ws_connections` (PK `connection_id`, GSI sur `user_id`) pour le streaming.

**Durée de vie et purge.** `chat_turns` n'est **pas** partitionnée par `user_id`, donc l'effacement
de compte ne peut pas la balayer par le chemin existant : il faut une étape dédiée dans
`account_deletion_service` — lister les conversations, puis leurs tours, puis leurs objets S3 —
c'est-à-dire exactement la mécanique que `media_purge_service` porte pour les artefacts.
`ws_connections` a besoin d'un TTL : une connexion fermée sans `$disconnect` (fermeture à 2 h, perte
réseau) laisse une ligne morte.

**Transport et rendu.** API WebSocket nouvelle, 3 routes, le worker pousse les deltas par
`@connections`, le client rejoue contre les fermetures à **10 min d'inactivité** et **2 h de durée de
vie**. Gain : le texte s'écrit sous les yeux de l'utilisateur. Prix : **≥ 11 objets Terraform
nouveaux** (§5.1) et un chemin de secours **obligatoire** — quand la socket est tombée il faut quand
même pouvoir relire le tour, donc le polling de B existe **en plus**, pas à la place.

**Stratégie de contexte.** La seule des quatre qui ouvre la **portée bibliothèque**, et elle l'ouvre
en remplaçant le corpus par une récupération. L'index Algolia existe et est déjà découpé en
enregistrements de moins de 10 Ko portant `user_id`
([search_indexing.py:1-37](../../../media_summarizer/core/services/search_indexing.py#L1)), mais il
est **lexical** : task-53.1 l'a choisi pour une barre de recherche, pas pour alimenter un prompt.
Savoir si un classement BM25 suffit à sélectionner les passages d'une question en langage naturel
est une question ouverte, que task-269 §12.3 avait déjà laissée ouverte et que §13 nomme comme
benchmark distinct. Et le coût mesuré dans le même modèle est défavorable : **la récupération fait
perdre le cache** (les extraits changent à chaque tour, donc aucun préfixe stable) et finit **plus
chère** que le corpus complet caché — 0,10752 € contre 0,07431 € à 20 tours (§6.3).

**Portée.** Les trois.

**Surface d'exploitation.** Une Lambda nouvelle entre gratuitement dans `lambda_error_rate` et
`lambda_throttles` (en `for_each` sur les workers) et dans le tableau de bord ; une file et son DLQ
entrent gratuitement dans l'alarme de profondeur. **Mais** il faut un filtre de métrique LLM nouveau
(nouveau log group), et **rien ne couvre une API WebSocket** : ni alarme, ni widget, ni runbook. Une
socket qui n'ouvre plus serait **silencieuse**.

### 7.4 D — État de conversation côté fournisseur *(écartée)*

Même forme que B, mais la conversation ne vit pas dans le dépôt : on stocke un
`openai_conversation_id`, ou le dernier `previous_response_id`, et le fournisseur tient l'historique.

Quatre raisons de l'écarter, dans l'ordre de force :

1. **Aucun gain de coût.** *« Chaining does not reduce token costs. Even with
   `previous_response_id`, all previous input tokens for responses in the chain are billed as input
   tokens in the API »* (§1.4). Le poste de dépense — le corpus relu à chaque tour — est exactement
   le même.
2. **Des données utilisateur durables hors d'atteinte du module d'effacement.** *« Conversation
   objects and items in them are **not** subject to the 30 day TTL »*.
   `account_deletion_service` existe pour que l'article 17 du RGPD et la ligne 5.1.1(v) de l'App
   Store soient tenus par du code
   ([account_deletion_service.py:1-28](../../../media_summarizer/core/services/account_deletion_service.py#L1)) ;
   cette option y ajoute un magasin tiers à balayer, donc un appel réseau de plus dans le chemin
   d'erasure, dont l'échec laisse les questions de l'utilisateur chez le fournisseur.
3. **Elle oblige à changer d'API.** Le dépôt appelle `…/v1/chat/completions`
   ([worker.py:73-75](../../../media_summarizer/workers/artifact_generator/worker.py#L73)) ;
   `previous_response_id` et la Conversations API appartiennent à la Responses API. C'est un
   changement de contrat sur le **seul** chemin d'appel LLM du dépôt, donc sur les artefacts aussi.
4. **Elle rend le dépôt incapable d'afficher une conversation sans le fournisseur**, et incapable de
   la rejouer si celui-ci change de modèle de données.

**Surface d'exploitation.** Rien de nouveau côté AWS — le worker reste celui de B, donc les deux
alarmes LLM le couvrent — mais la taxonomie `llm_failure` est écrite sur les formes d'erreur de
`chat/completions` ([llm_failure.py:113-154](../../../media_summarizer/utils/llm_failure.py#L113)) :
la Responses API a les siennes, donc `classify_llm_failure` devrait être revu, et un refus mal
classé est un refus qui n'allume pas `llm-provider-refused`. À cela s'ajoute le trou décrit au
point 2 : aucun tableau de bord du dépôt ne voit ce que le fournisseur stocke.


---

## 8. « Élégant » : définition opérationnelle, axes pondérés, classement

### 8.1 La définition retenue

> **Est élégante ici l'architecture dont chaque objet nouveau a déjà un propriétaire dans le
> dépôt** — une alarme qui le voit, un compteur qui le débite, un état que l'app sait peindre, une
> ligne d'effacement qui le purge, un runbook qui le décrit — **et qui n'ajoute aucun objet dont le
> propriétaire resterait à écrire.**

Ce n'est ni « la moins chère » (le coût LLM est identique à stratégie de contexte égale, §6) ni « la
plus complète » (C est la plus complète et arrive dernière). C'est une mesure de **dette
d'exploitation ajoutée**, et elle est vérifiable objet par objet.

### 8.2 Les six axes, leur poids, et pourquoi ce poids

| Axe | Poids | Pourquoi ce poids |
|---|---|---|
| **1. Objets persistants nouveaux** | **30 %** | Le seul axe dont le coût ne disparaît jamais : une table, une file ou une porte d'entrée reste à exploiter, à sauvegarder, à purger à l'effacement de compte, et à supprimer si la fonctionnalité est retirée. Le dépôt porte déjà **23 tables** (M12), 14 files, 11 buckets et 14 Lambdas **pour 12 testeurs beta**. Chaque objet de plus se paie en charge mentale permanente, pas en euros. |
| **2. Part du déployé réutilisée telle quelle** | **20 %** | Le corollaire positif du premier : ce qui est réutilisé sans adaptation est déjà testé, déjà alarmé, déjà décrit dans un runbook. Moins lourd que (1) parce qu'une réutilisation ratée se corrige, alors qu'un objet créé se supprime. |
| **3. Ce que l'utilisateur ressent** | **20 %** | L'owner veut un chatbot, pas un formulaire asynchrone : c'est la raison d'être de la fonctionnalité, donc autant que (2). Mais pas davantage, parce que la mesure dit que l'écart de ressenti entre les candidates vaut **quelques secondes** (§5.2), pas un ordre de grandeur. |
| **4. Comment la dépense est comptée** | **10 %** | Le dépôt a **une** unité et un débit idempotent déjà écrits. L'enjeu n'est pas de les concevoir, c'est de **ne pas en ajouter un second** — task-287 §4 : *« nobody shows more than two dials »*, et sur Otter *« the second dial is not [worth copying] »*. Les quatre candidates s'y insèrent de façon voisine, donc l'axe discrimine peu. |
| **5. Ce qui resterait à jeter** | **10 %** | Rien n'est en magasin, donc la réversibilité est bornée par construction (`AGENTS.md`, « Nothing is deployed yet »). L'axe mesure un volume de code et d'infra à supprimer, pas un risque de migration. |
| **6. Surface d'exploitation** | **10 %** | Partiellement corrélé à (1), et le dépôt a une mécanique `for_each` qui absorbe **gratuitement** une file ou un worker de plus. Ce qui compte réellement est le **cas aveugle**, et il n'y en a qu'un dans les quatre candidates : l'API WebSocket, que rien ne surveille. |

### 8.3 Axe 1 — objets persistants nouveaux, comptés

| Objet | A | B | C | D |
|---|---|---|---|---|
| Tables DynamoDB | 1 | **1** | 3 | 1 |
| Index secondaires | 0 | **0** | 2 | 0 |
| Buckets S3 | 0 | **0** | 1 | 0 |
| Files SQS + DLQ | 0 | **0** | 2 | 0 |
| Lambdas (+ leur log group) | 0 | **0** | 2 | 0 |
| Portes d'entrée (API + étage + routes + intégrations) | 0 | **0** | 8 | 0 |
| Politiques IAM | 0 | **0** | 1 | 0 |
| Filtres de métrique / alarmes | 1 | **0** | 1 | 0 |
| **Total AWS, à purger** | **2** | **1** | **21** | **1** |
| Magasins persistants hors AWS | 0 | **0** | 0 | **1** (non couvert par l'effacement de compte) |
| Endpoints HTTP (routes FastAPI) | 5 | 5 | 5 + 3 routes WebSocket | 5 |
| Écrans mobiles | 1 | 1 | 1 | 1 |

Les cinq routes HTTP sont les mêmes partout : `POST /api/chat/conversations`,
`POST /api/chat/conversations/{id}/turns`, `GET /api/chat/conversations`,
`GET /api/chat/conversations/{id}`, `DELETE /api/chat/conversations/{id}`. Le préfixe `/api/chat`
respecte l'interdit d'`AGENTS.md` (rien de nouveau sous `/api/v1/`) et la règle du contrat canonique.

### 8.4 Axe 2 — ce qui est réutilisé tel quel, actif par actif

`=` réutilisé tel quel · `~` réutilisé mais adapté · `x` non réutilisé ou recopié.

| Actif déployé | A | B | C | D |
|---|---|---|---|---|
| 1. API HTTP + étage + route `$default` | = | = | = | = |
| 2. Lambda API + Mangum (bufferisé) | ~ *(devient appelante LLM, p95 dégradé)* | = | = | = |
| 3. Dépendance `get_current_user` | = | = | = | = |
| 4. `_assert_scope_owned` | = | = | = | = |
| 5. `artifact-generator-queue` + DLQ + `maxReceiveCount = 3` | x | = | x *(file recopiée)* | = |
| 6. Lambda `artifact_generator` 300 s + mapping (`batch_size = 1`, `maximum_concurrency = 10`) | x | = | x *(Lambda recopiée)* | = |
| 7. `_download_transcripts` + bucket transcripts | = | = | = | = |
| 8. `corpus.build_prompt` (corpus d'abord, préfixe cachable) | = | = | ~ *(récupération : plus de préfixe stable)* | = |
| 9. `_call_llm` + `_read_llm_usage` | ~ *(module worker importé depuis l'API)* | ~ *(tableau de messages)* | ~ | ~ *(Responses API)* |
| 10. Taxonomie `llm_failure` + `log_llm_generation_failure` | = | = | = | ~ *(autres formes d'erreur)* |
| 11. Bail de génération 300 s | x *(synchrone : rien à bailler)* | = | x *(bail recopié)* | = |
| 12. `estimate_llm_cost_eur` + `record_observed_cost` | = | = | = | ~ |
| 13. `quota_enforcer` : conversion, `evaluate_submission`, `_debit`, `settled_jobs` | = | = | = | = |
| 14. Refus `out_of_minutes` / `item_too_long` + leurs clés i18n | = | = | = | = |
| 15. `llm_alerts.tf` (filtres + 2 alarmes) | x *(filtre nouveau requis)* | = | x *(filtre nouveau requis)* | = |
| 16. Alarme DLQ + widgets « Queue Backlog » / « Lambda … » | x | = | = *(for_each)* | = |
| 17. Cadence `useProcessingRefresh` 3 s/10 s/5 min + états `artifacts.status.*` | x *(pas de poll)* | = | = *(en secours)* | = |
| 18. Effacement de compte par `_USER_PARTITION_TABLES` | = | = | ~ *(étape dédiée pour `chat_turns` + S3)* | x *(magasin tiers)* |
| **Réutilisés tels quels** | **10 / 18 — 56 %** | **17 / 18 — 94 %** | **11 / 18 — 61 %** | **14 / 18 — 78 %** |

### 8.5 Le classement

Notes de 0 à 10 par axe, puis moyenne pondérée des poids de §8.2.

| Axe (poids) | A | B | C | D |
|---|---|---|---|---|
| 1. Objets nouveaux (30 %) | 8 | **10** | 1 | 6 |
| 2. Réutilisation telle quelle (20 %) | 6 | **10** | 6 | 8 |
| 3. Ressenti utilisateur (20 %) | 9 | 7 | **10** | 7 |
| 4. Comptage de la dépense (10 %) | **10** | **10** | 8 | 8 |
| 5. Ce qui resterait à jeter (10 %) | 9 | **10** | 2 | 5 |
| 6. Surface d'exploitation (10 %) | 6 | **10** | 3 | 7 |
| **Score pondéré** | **7,9** | **9,4** | **4,8** | **6,8** |
| **Rang** | 2 | **1** | 4 | 3 |

**Ce qui fait la décision, et ce qui ne la fait pas.**

- **Le coût ne tranche pas.** À stratégie de contexte égale, A, B et D coûtent **la même chose** au
  centime (§6.3), et C est la seule différente — **plus chère**, parce que la récupération fait
  perdre le cache. L'écart total entre toutes les options, sur une conversation de 20 tours au
  plafond dossier, est de 3,3 centimes. Le dépôt a dépensé **0,1377 €** de LLM depuis sa création
  (§6.2).
- **Le ressenti ne tranche pas non plus**, et c'est le résultat qui surprend : A gagne cet axe avec
  9/10, et perd quand même. La raison est que son avance est de l'ordre de 10 s de poll économisés,
  pendant que son plafond de 30 s est **non négociable** et qu'un dépassement rend un 504 sur un
  tour déjà facturé. C gagne 10/10 et perd encore plus largement : le streaming lui coûte 20 objets
  persistants de plus pour une attente qui vaut **6,3 s en médiane** (§5.2).
- **Ce qui tranche est l'axe 1 croisé avec l'axe 6** : B est la seule candidate qui ajoute **un seul
  objet AWS** et **zéro objet d'observabilité**, parce que le worker qui calculerait le tour est
  déjà dans la liste des workers surveillés pour leurs appels LLM, et parce que le worker **a déjà
  un second mode** dont l'en-tête dit que *« what changes is only where the input text comes from »*
  (§2.3). La conversation ne demande rien de plus que ce que ce fichier a déjà accepté une fois.

---

## 9. L'unité de quota et les garde-fous chiffrés

### 9.1 L'unité proposée : aucune unité nouvelle

**Un tour coûte ce que coûte une génération sur la même portée :
`quota_enforcer.minutes_for_folder_sources(source_count)`, soit `max(1, ceil(S/5))` minutes**
([quota_enforcer.py:232-239](../../../media_summarizer/core/services/quota_enforcer.py#L232)).

Ce que cela n'ajoute **pas** :

- pas de compteur nouveau — le débit passe par `_debit`, donc `minutes_used` sur
  `user_usage_monthly` et `generations` sur `user_usage_daily`
  ([quota_enforcer.py:1052-1130](../../../media_summarizer/core/services/quota_enforcer.py#L1052)) ;
- pas de conversion nouvelle dans `pricing_config` — `folder_sources_per_minute = 5` est réutilisée
  telle quelle
  ([pricing_config_service.py:231-234](../../../media_summarizer/core/services/pricing_config_service.py#L231)) ;
- pas de code de refus nouveau — `out_of_minutes` et `item_too_long` suffisent, et l'app sait déjà
  les formuler dans onze langues (§4.3) ;
- pas de second cadran. C'est l'enseignement explicite de task-287 §4 sur Otter, qui facture
  séparément des minutes et des « AI Chat » : *« The per-conversation ceiling is worth copying; the
  second dial is not. »*

Ce que cela change, et c'est **la seule chose** : **l'exemption « une génération sur un média unique
est gratuite » ne s'applique pas à un tour de chat.** La justification est factuelle et tient dans
le commentaire qui porte l'exemption — *« A generation over a single item is free: its LLM cost is
already inside what the item cost to ingest »*
([quota_enforcer.py:232-239](../../../media_summarizer/core/services/quota_enforcer.py#L232)). Une
ingestion a payé **une** lecture du transcript ; une conversation de vingt tours en paie vingt. La
prémisse de l'exemption est fausse pour le chat, donc l'exemption ne s'applique pas.

Concrètement, côté code : `POST …/turns` appelle `check_submission_allowed(user_id,
minutes_needed=minutes_for_folder_sources(source_count))` avant d'écrire, puis `_debit` après, sous
le token `f"{conversation_id}:{turn_index}"` — un token qui rend le débit **exactement une fois par
tour**, redélivrance SQS et double tap compris, par le même mécanisme `settled_jobs` que les
artefacts ([quota_usage_db.py:103-134](../../../media_summarizer/utils/quota_usage_db.py#L103)).

### 9.2 La marge, vérifiée dans les deux régimes de cache

| Scénario | Débité | Coût sans cache | Marge | Coût avec cache | Marge |
|---|---|---|---|---|---|
| Média, tour 1 | 1 min = 0,00664 € | 0,00397 € | **×1,67** | 0,00397 € | ×1,67 |
| Média, tour 20 | 1 min = 0,00664 € | 0,00580 € | **×1,15** | 0,00115 € | ×5,8 |
| Média, conversation de 20 tours | 20 min = 0,1328 € | 0,09767 € | **×1,36** | 0,02418 € | ×5,5 |
| Dossier à 25 sources, tour 1 | 5 min = 0,0332 € | 0,02126 € | **×1,56** | 0,02126 € | ×1,56 |
| Dossier à 25 sources, tour 20 | 5 min = 0,0332 € | 0,02309 € | **×1,44** | 0,00288 € | ×11,5 |
| Dossier, conversation de 20 tours | 100 min = 0,664 € | 0,44343 € | **×1,50** | 0,07431 € | ×8,9 |

**La marge est positive dans tous les cas, y compris le pire** (média, tour 20, sans cache : ×1,15).
C'est le point qui rend ce barème déployable sans mesure préalable du taux de cache. Le prix de cette
prudence est une surfacturation de ×5 à ×11 dans le régime favorable, et c'est précisément ce que la
tranche 3 corrige, **une fois le taux mesuré** (§12).

### 9.3 Ce que ça pèse sur le forfait d'un abonné

Grille en vigueur dans le dépôt
([pricing_config_service.py:50-91](../../../media_summarizer/core/services/pricing_config_service.py#L50)) :

| Palier | Prix TTC | Net | Minutes/mois | Tours à portée média | Conversations de 20 tours | Tours sur un dossier de 25 sources |
|---|---|---|---|---|---|---|
| Reader (`text_only`) | 3,00 € | 2,125 € | 60 | **60** | 3 | 12 |
| Mix | 5,00 € | 3,542 € | 300 | **300** | 15 | 60 |
| Audio-Heavy | 9,00 € | 6,375 € | 720 | **720** | 36 | 144 |
| Essai gratuit (30 j, palier `mix`) | — | — | 300 | 300 | 15 | 60 |
| **Régime beta (palier le plus large)** | — | — | **720** | **720** | **36** | **144** |

Deux repères qui disent si c'est tenable :

1. **Ce que les testeurs consomment réellement.** M6 : le maximum observé de `minutes_used` sur une
   période est **112 sur 720**, soit 15,6 %. Le testeur le plus lourd mesuré aurait donc, sans rien
   retirer à ce qu'il transcrit, **608 tours de chat à portée média par mois**.
2. **Ce que vend la concurrence.** Otter Pro, à 16,99 $, donne **50 « AI Chat » par mois**
   (task-287 §4, relevé le 2026-08-18). Le palier Mix à 5,00 € en donnerait **300**. Le barème
   proposé est donc généreux au regard du marché tout en restant margé.

Et le pire cas absolu que le barème autorise, sur le palier le plus large : 720 minutes de tours à
portée média, coût LLM sans cache `720 × 0,00580 = 4,18 €`, contre un net de 6,375 €. Soit **66 %
du net**, mais seulement si l'abonné consacre **100 %** de son allocation au chat et ne transcrit
rien — un usage que la mesure M6 place à 6,4× au-dessus de ce qui a jamais été observé.

### 9.4 Les garde-fous chiffrés

**Côté utilisateur**

| Garde-fou | Valeur | Justification chiffrée | Où elle vit |
|---|---|---|---|
| Longueur d'une question | **1 000 caractères** | La question est la seule partie d'un tour que l'utilisateur contrôle, et elle entre dans l'historique de **tous** les tours suivants. À 20 tours, 20 × 1 000 caractères ≈ 5 000 tokens, soit **4,2 %** du corpus au plafond. À 10 000 caractères, ce serait 50 000 tokens, soit 42 % du corpus — un historique plus gros que la plupart des médias | Constante de code, à côté de `MAX_FOLDER_SOURCES` : elle dérive de la fenêtre du modèle, pas du prix (même raisonnement qu'[artifact_service.py:119-125](../../../media_summarizer/core/services/artifact_service.py#L119)) |
| Longueur d'une réponse | **`max_completion_tokens = 2000`** | La sortie coûte **6,25× l'entrée** (1,25 contre 0,20 $/1M). Mesuré sur `gpt-5.4-nano` : `review_blurb` 81 tokens médians, `notes` 2 045, `quiz` 1 338. 2 000 laisse la place d'une réponse en prose avec sa marge de raisonnement, et borne le cas pathologique que task-316 §2.13 documente sur `gpt-5-nano` (2 678 tokens de sortie médians pour ~300 visibles). **Le dépôt ne pose ce paramètre nulle part aujourd'hui** ([worker.py:151-167](../../../media_summarizer/workers/artifact_generator/worker.py#L151)) : c'est le seul réglage réellement nouveau | Constante de code |
| Tours par conversation | **20, en dur** | À 20 tours l'entrée au plafond dossier vaut 131 100 tokens, soit **48,2 %** de la fenêtre d'entrée de 272 000 — le même ordre de marge que celui sur lequel `MAX_FOLDER_CORPUS_TOKENS` a été choisi (120 000 / 272 000 = 44 %). Ce n'est pas la fenêtre qui borne (elle tiendrait ~270 tours) : c'est le coût et la littérature du long contexte reprise par task-269 §2.7. Le 21ᵉ tour reçoit un **409 `conversation_full`**, et l'app propose d'ouvrir une conversation neuve sur la même portée. C'est le « per-conversation ceiling » que task-287 §4 recommande explicitement de copier à Otter | Constante de code |
| Tours en vol par compte | **1** | Un second tour demandé alors qu'un tour est `queued` ou `generating` sur **n'importe quelle** conversation du compte reçoit un **409 `turn_in_flight`**. Raison : les limites de débit du fournisseur (ci-dessous), et le fait qu'un utilisateur n'attend qu'une réponse à la fois | Lecture de l'item, aucune table nouvelle |
| Conversations simultanées par compte | **non bornées en stockage** | L'item est borné par le plafond de 20 tours (~25 Ko contre 400 Ko de limite DynamoDB), et la liste d'un compte est une `Query` sur la PK. Ce qui est borné est le **travail en vol** (ligne précédente) et le **volume mensuel** (ligne suivante) | — |
| Volume par période et par palier | **= l'allocation en minutes** | 60 / 300 / 720 tours à portée média ; 12 / 60 / 144 tours sur un dossier de 25 sources (§9.3) | `pricing_config.tiers`, ajustable sans déploiement |
| Garde-fou journalier | **`generations_per_day` porté de 50 à 120** | Le compteur `generations` est déjà incrémenté par `_debit` et un tour de chat l'incrémenterait comme une génération : **zéro compteur nouveau**. 50 est trop bas dès que le chat existe — trois conversations de 20 tours plus les cinq types d'artefacts font 65. 120 garde la propriété voulue (*« Every size sits an order of magnitude above the heaviest measured usage »*, [pricing_config_service.py:136-139](../../../media_summarizer/core/services/pricing_config_service.py#L136)) et **ne refuse jamais rien** : il journalise `quota.burst_guard_tripped` pour l'owner | `pricing_config.burst_guards`, ajustable sans déploiement |
| Comportement à la saturation | **le refus existant** | Plus de minutes → `out_of_minutes` 403 avec `minutes_needed`, `minutes_remaining`, `period_end`, `beta_access`, que l'app formule déjà ([quota_enforcer.py:907-918](../../../media_summarizer/core/services/quota_enforcer.py#L907)). Pendant la beta le refus porte `beta_access: true`, ce qui **supprime la route vers le paywall** ([quota_enforcer.py:819-829](../../../media_summarizer/core/services/quota_enforcer.py#L819)) — un chatbot lancé en beta ne doit pas proposer d'acheter ce qui n'est pas en vente | — |

**Côté limites de débit du fournisseur**

`gpt-5.4-nano`, limites par défaut relevées le 2026-10-06 : **palier 1 = 500 RPM / 200 000 TPM**,
palier 2 = 5 000 / 2 000 000.

| Charge | Tokens par minute | Part du palier 1 (200 000 TPM) |
|---|---|---|
| 1 premier tour à portée média (19 947 entrée + 500 sortie) | 20 447 | **10,2 %** |
| 1 premier tour sur un dossier au plafond (120 460 + 500) | 120 960 | **60,5 %** |
| **2 premiers tours concurrents sur un dossier au plafond** | 241 920 | **121 % — dépasse** |
| 10 tours concurrents à portée média (le plafond de concurrence déployé) | 204 470 | **102 % — dépasse de justesse** |

Trois conséquences, et la troisième est la plus importante :

1. **Le plafond global existe déjà** : `scaling_config.maximum_concurrency = 10` sur le mapping SQS
   ([lambda_workers.tf:183-186](../../../infrastructure/terraform/modules/platform/lambda_workers.tf#L183))
   borne la flotte entière à 10 invocations concurrentes. C'est le seul étranglement nécessaire, et
   il n'est pas à écrire.
2. **La règle « un tour en vol par compte » est ce qui rend le palier 1 tenable à 12 testeurs** : il
   faudrait 2 comptes posant simultanément une première question sur un dossier au plafond pour le
   dépasser — ce qui est exactement pourquoi la portée dossier est la tranche 2 et non la tranche 1.
3. **Une hypothèse est assumée** : la documentation des limites de débit ne dit **pas** que les
   tokens d'entrée servis par le cache sont décomptés à tarif réduit du TPM. Faute de source, ils
   sont comptés **plein** dans le tableau ci-dessus. C'est la direction prudente ; si le cache
   réduisait aussi le TPM, les marges ci-dessus seraient meilleures, jamais pires.

**Saturation côté fournisseur, et ce que le dépôt en fait déjà**

| Réponse du fournisseur | Classement | Conséquence | Alarme |
|---|---|---|---|
| 429 avec `Retry-After` | `TRANSIENT` + `rate_limit` | Le message garde ses 3 redélivrances, espacées par `visibility_timeout = 1800` ; au-delà il part au DLQ | `dlq-artifact-generator-non-empty`, seuil 0 |
| 429 nu (ni marqueur, ni `Retry-After`) | **`PERMANENT` + `quota`** ([llm_failure.py:46](../../../media_summarizer/utils/llm_failure.py#L46)) | Le message est **acquitté**, le tour passe `failed` : on ne brûle pas trois appels pour la même réponse | `llm-provider-refused`, **seuil 0** |
| 401/403 (clé) | `PERMANENT` + `authentication` | idem | `llm-provider-refused`, seuil 0 |
| 5xx, timeout socket | `TRANSIENT` | 3 tentatives | DLQ |
| Sortie invalide | `VALIDATION_ERROR` | 3 tentatives puis DLQ | `llm-generation-failures`, seuil 3 en 15 min |

### 9.5 Durée de vie et purge d'une conversation

**Pas de TTL en V1.** Trois raisons :

1. le précédent du dépôt sur un objet voisin — task-269 §12.2 écarte un TTL sur l'historique
   d'artefacts au motif qu'« un TTL serait une péremption, ce que l'owner exclut » ;
2. la croissance est bornée **par item** (20 tours, ~25 Ko) et linéaire en nombre de conversations,
   ce qui à 12 testeurs ne pose aucun problème de volume ;
3. une suppression explicite par l'utilisateur (`DELETE /api/chat/conversations/{id}`) couvre le
   besoin réel, qui est de ranger, pas de péremption.

**Purge à l'effacement de compte : une ligne.** `chat_conversations` est partitionnée par `user_id`,
donc il suffit de l'ajouter à `_USER_PARTITION_TABLES`
([account_deletion_service.py:85-97](../../../media_summarizer/core/services/account_deletion_service.py#L85))
avec `conversation_id` comme clé de tri. C'est exactement ce que le module fait déjà pour sept
tables, et **c'est cette propriété qui disqualifie le modèle à deux tables de C** (§7.3) et le
magasin tiers de D (§7.4).

Si l'owner veut malgré tout un TTL, il coûte un attribut `ttl_epoch` sur l'item et un bloc
`ttl { attribute_name = "ttl_epoch" enabled = true }` dans Terraform : AWS supprime alors les items
expirés « within a few days of their expiration time, without consuming write throughput ». C'est un
choix produit, pas une contrainte technique.

---

## 10. Le coût de construction, fichier par fichier

### 10.1 Architecture B *(recommandée)*

**Backend — étendu**

| Fichier | Ce qu'on y ajoute |
|---|---|
| `media_summarizer/api/main.py` | un `include_router(chat.router, prefix="/api/chat")`, et l'entrée correspondante dans `CRITICAL_ROUTES` si l'owner veut la garde de démarrage ([main.py:142-162](../../../media_summarizer/api/main.py#L142)) |
| `media_summarizer/workers/artifact_generator/worker.py` | la lecture d'un bloc `chat` sur le message, à côté du bloc `translation` ([worker.py:256-258](../../../media_summarizer/workers/artifact_generator/worker.py#L256)) ; une branche `_answer_chat_turn` sur le modèle de `_translate_stored_artifact` ([worker.py:480-591](../../../media_summarizer/workers/artifact_generator/worker.py#L480)) ; `_call_llm` accepte un **tableau** de messages au lieu d'un unique message `user` ([worker.py:151-154](../../../media_summarizer/workers/artifact_generator/worker.py#L151)) et un `max_completion_tokens` |
| `media_summarizer/core/services/account_deletion_service.py` | **une ligne** dans `_USER_PARTITION_TABLES` |
| `media_summarizer/core/services/pricing_config_service.py` | `burst_guards.generations_per_day` de 50 à 120 |
| `media_summarizer/utils/env.py` / `core/config.py` | la lecture de `CHAT_CONVERSATIONS_TABLE` |

**Backend — entièrement neuf**

| Fichier | Rôle |
|---|---|
| `media_summarizer/core/models/chat_conversation.py` | `ChatConversationRecord`, `ChatTurn`, `ChatTurnStatus` (`queued`/`generating`/`ready`/`failed`, la même énumération que les artefacts), `to_dynamodb_item` / `from_dynamodb_item` |
| `media_summarizer/core/services/chat_service.py` | ouverture d'une conversation (résolution du scope par `resolve_scope_sources`, plafonds par `enforce_scope_ceilings`), ajout d'un tour sous écriture conditionnelle, construction du message SQS, bail, scellement du tour |
| `media_summarizer/utils/chat_conversations.py` | la couche d'accès DynamoDB, sur le modèle de `utils/media_artifacts.py` |
| `media_summarizer/api/endpoints/chat.py` | les cinq routes de §8.3 avec leurs refus typés |
| `media_summarizer/workers/artifact_generator/chat.py` | la construction du prompt de tour : `corpus.build_prompt` puis l'historique, et **rien devant le corpus** |

**Terraform — étendu**

| Fichier | Ce qu'on y ajoute |
|---|---|
| `dynamodb_core_tables.tf` | la table `chat_conversations_v1` (PK `user_id`, SK `conversation_id`, `PAY_PER_REQUEST`, PITR, `deletion_protection_enabled`, `prevent_destroy`), sur le modèle de `media_artifacts_v1` ([dynamodb_core_tables.tf:235-281](../../../infrastructure/terraform/modules/platform/dynamodb_core_tables.tf#L235)) |
| `runtime_env.tf` | `CHAT_CONVERSATIONS_TABLE` dans `local.lambda_environment` ([runtime_env.tf:16-36](../../../infrastructure/terraform/modules/platform/runtime_env.tf#L16)) |
| `iam_lambda.tf` | la table dans les ressources DynamoDB autorisées pour les deux rôles |

**Terraform — entièrement neuf** : *rien*. Pas de file, pas de DLQ, pas de Lambda, pas de bucket,
pas de porte d'entrée, pas d'alarme, pas de widget, pas de filtre de métrique.

**Mobile — étendu**

| Fichier | Ce qu'on y ajoute |
|---|---|
| `mobile/src/components/ArtifactsPanel.tsx` | un point d'entrée vers la conversation depuis l'onglet IA — ou, si l'owner préfère, un bouton sur l'en-tête du média. Un seul endroit, puisque ce composant sert les deux écrans ([ArtifactsPanel.tsx:1-23](../../../mobile/src/components/ArtifactsPanel.tsx#L1)) |
| `mobile/src/hooks/useProcessingRefresh.ts` | **rien** : la cadence est réutilisée telle quelle |

**Mobile — entièrement neuf** : `mobile/app/chat/[conversationId].tsx` (l'écran : liste de messages,
saisie multiligne, gestion du clavier), `mobile/src/services/chatService.ts`,
`mobile/src/types/chat.ts`, `mobile/src/components/ChatBubble.tsx`,
`mobile/src/components/ChatComposer.tsx`.

**i18n** : **onze catalogues** (`ar`, `de`, `en`, `es`, `fr`, `hi`, `it`, `ja`, `nl`, `pt`, `zh`) plus
`pseudo.ts`. Une dizaine de clés : titre de l'écran, invite de saisie, états `queued`/`generating`,
`conversation_full`, `turn_in_flight`, `question_too_long`, l'étiquette de la question et de la
réponse pour l'accessibilité, et le libellé du bouton d'ouverture. Les refus de quota, eux, sont
**déjà** traduits (§4.3).

### 10.2 Ce que les trois autres coûtent en plus

| | A | C | D |
|---|---|---|---|
| Backend étendu | comme B, **moins** la branche du worker, **plus** l'appel LLM dans le service appelé par l'API (donc `utils/llm_failure` et le client HTTP importés sur le chemin API) | comme B, **plus** une étape dédiée dans `account_deletion_service` et un `media_purge_service` pour les objets S3 des tours | comme B, **plus** la bascule de `_call_llm` vers la Responses API, qui touche **aussi** les artefacts |
| Backend neuf | comme B, moins `chat.py` du worker | comme B, **plus** `workers/chat_turn/worker.py`, `workers/lambda_handlers.py` (un handler), `api/endpoints/chat_ws.py`, `utils/ws_connections.py` | comme B |
| Terraform neuf | **1 filtre de métrique** sur `aws_cloudwatch_log_group.lambda_api`, plus un arbitrage sur `api_slow_request_threshold_ms` | **~21 objets** : 2 tables de plus, 2 GSI, 1 bucket (+ chiffrement, versioning, blocage public : la disposition de `s3.tf`), 1 file + 1 DLQ, 1 Lambda + son log group + son mapping, 1 API WebSocket + étage + 3 routes + 3 intégrations, 1 politique IAM, 1 `aws_lambda_permission`, 1 filtre de métrique | rien |
| Mobile neuf | comme B | comme B, **plus** un client WebSocket avec reconnexion et un chemin de secours par polling | comme B |
| i18n | comme B | comme B, **plus** un état « connexion perdue » | comme B |

### 10.3 Ce qui resterait à jeter si l'architecture retenue était remplacée plus tard

Rien n'est en magasin : *« nothing is in the wild that we cannot re-issue »* (`CLAUDE.md`). Il n'y a
donc **aucune couche de compatibilité à prévoir**, et le tableau ci-dessous est un volume de
suppression, pas un risque de migration.

| Bascule | Ce qu'on jette | Ce qu'on garde |
|---|---|---|
| **B → A** (passer en synchrone) | la branche `chat` du worker, la construction du message SQS, le bail du tour, les états `queued`/`generating` de l'écran, le poll | **la table, son modèle, les cinq routes, l'écran, le barème de quota, le prompt** — c'est-à-dire l'essentiel |
| **B → C** (passer au streaming et à la portée bibliothèque) | la branche `chat` du worker *(recopiée dans la Lambda dédiée)*, et éventuellement le modèle à un item si l'on veut `chat_turns` séparée | la table *(elle devient `chat_conversations` de C)*, les cinq routes HTTP, l'écran, le barème, le prompt, **et le poll qui devient le chemin de secours obligatoire de C** |
| **B → un autre fournisseur de LLM** | `_call_llm` et la taxonomie d'erreur — **mutualisés avec les artefacts**, donc ce n'est pas un coût du chatbot | tout le reste |
| **Abandon pur et simple du chatbot** | 1 table, 5 routes, 1 écran, 5 fichiers backend, 5 fichiers mobile, ~10 clés × 12 catalogues, 1 branche de worker. **Aucune ressource AWS partagée n'est touchée**, donc la suppression est un `terraform apply` et un commit | — |
| **Abandon de A** | 1 table, 5 routes, 1 écran, 4 fichiers backend, 5 fichiers mobile, ~10 clés × 12 catalogues, **1 filtre de métrique Terraform**, et le seuil `api_slow_request_threshold_ms` à remettre à sa valeur d'origine | — |
| **Abandon de D** | la même chose que pour B, **plus** les conversations déjà créées chez le fournisseur, qu'aucun code du dépôt ne sait énumérer : il faudrait écrire le balayage pour pouvoir les supprimer | — |
| *Pour comparaison*, **abandon de C** | 21 objets AWS, dont une API WebSocket, 2 tables, 1 bucket et 1 file à vider avant suppression, plus une étape d'effacement de compte à retirer **sans casser le reste du module** | — |

**La lecture de ce tableau est le second argument décisif pour B** : la bascule B → C conserve
presque tout, parce que le modèle de données et le contrat HTTP sont les mêmes et que le poll de B
est de toute façon le chemin de secours de C. **B n'est pas une impasse, c'est la première tranche
de C** — tandis que A, elle, est une impasse : son plafond de 30 s est une propriété de la porte
d'entrée, pas du code, et en sortir veut dire remplacer la porte d'entrée.

---

## 11. Articulation avec les décisions déjà validées du dépôt

### 11.1 L'agrégation d'un dossier — task-269, `owner_decision: ok`, `Decision: statégie s1`

La décision est **« passe unique sur le corpus concaténé, avec plafond dur et refus explicite
au-delà, sans troncature, sans étage map-reduce, sans store intermédiaire »**, et elle est incarnée
dans le code par :

- `MAX_FOLDER_SOURCES = 25` et `MAX_FOLDER_CORPUS_TOKENS = 120_000`, avec le commentaire qui dit que
  ce sont des constantes de code et non des paramètres commerciaux parce qu'elles dérivent de la
  fenêtre du modèle
  ([artifact_service.py:119-128](../../../media_summarizer/core/services/artifact_service.py#L119)) ;
- `enforce_scope_ceilings`, qui **refuse plutôt que tronque** : *« A truncated artifact would claim
  to cover sources whose text never reached the model … Same reason there is no "25 most recent"
  auto-selection: that is truncation wearing a hat »*
  ([artifact_service.py:2102-2117](../../../media_summarizer/core/services/artifact_service.py#L2102)) ;
- un dossier couvre **le dossier et tous ses descendants**, pour coller à `GET /api/media?folder_id=`
  et donc à l'onglet Sources que l'utilisateur regarde
  ([artifact_service.py:800-834](../../../media_summarizer/core/services/artifact_service.py#L800),
  [artifact_service.py:906-932](../../../media_summarizer/core/services/artifact_service.py#L906)).

**Comment chaque architecture s'y articule.**

| | A | B | C |
|---|---|---|---|
| Réutilise `resolve_scope_sources` + `enforce_scope_ceilings` tels quels à l'ouverture d'une conversation | oui | **oui** | oui |
| Respecte « refuser plutôt que tronquer » | oui, en refusant `scope_too_large` à l'ouverture | **oui, idem** — et §6.4 ajoute un argument de coût : une fenêtre glissante sur l'historique est une troncature qui coûte **plus cher** que l'absence de troncature | **non** : la récupération *est* une sélection de sous-ensemble. C'est une rupture avec la décision de task-269, assumable pour la portée bibliothèque (où la passe unique est physiquement impossible : le corpus entier de `-dev` vaut 672 515 tokens, soit 2,5× la fenêtre d'entrée — M2) mais pas pour un dossier |
| Transitivité des sous-dossiers | héritée | **héritée** | héritée |

Un point à trancher par l'owner et qui découle directement de task-269 : **l'instantané de sources
d'une conversation est-il figé à l'ouverture ou réévalué à chaque tour ?** La recommandation est
**figé à l'ouverture**, par cohérence avec la nature d'instantané de `ArtifactSource`
([media_artifact.py:137-163](../../../media_summarizer/core/models/media_artifact.py#L137)) : une
conversation dont le corpus change au tour 12 répondrait à la question 12 sur un texte que les
onze réponses précédentes n'avaient pas lu, et **elle casserait le préfixe de cache**, donc
multiplierait le coût du tour par 10. Si les sources du dossier changent, la réponse honnête est
d'ouvrir une conversation neuve — exactement comme un dossier modifié produit une **nouvelle**
entrée d'historique et n'invalide pas les anciennes.

### 11.2 Les prompts d'artefact — task-316, `owner_decision: ok`

Trois décisions de ce benchmark touchent directement le chatbot.

1. **La mise en page corpus-d'abord est protégée.** *« L'ordre corpus-puis-instructions est délibéré
   (cache de prefix OpenAI, task-269 §2.6) et **ne doit pas être inversé** »* (task-316 §1.2), et le
   code porte la même garde
   ([corpus.py:1-21](../../../media_summarizer/workers/artifact_generator/generators/corpus.py#L1)).
   **Un tour de conversation doit donc placer l'historique et la question après les instructions,
   jamais devant le corpus.** §6.4 montre que c'est aussi la décision la moins chère d'un facteur 4
   à 6, donc l'intérêt et la règle pointent dans le même sens.
2. **L'owner a tranché « pas de régénération au niveau d'un média », et il l'a fait *pour* pouvoir
   utiliser le cache** : *« Donc pas de regénération au niveau d'un media, et donc possibliité
   d'utiliser le principe de cache »* (task-316, champ `Decision`). Un chatbot est l'usage où cette
   décision paie le plus : vingt tours sur un même corpus, c'est dix-neuf lectures de cache.
   **Le chatbot ne contredit pas la règle « une génération par média » — il ne génère aucun
   artefact.** Il lit le même corpus et n'écrit rien dans `media_artifacts`, donc rien n'est
   régénéré, rien n'est invalidé, et l'historique d'artefacts reste exactement ce qu'il est.
3. **Les leçons de qualité s'appliquent au prompt de conversation.** `transcript_markers_instruction`
   (les tags `[rires]` ne sont pas du contenu), `dated_facts_instruction` (une mesure datée s'ancre
   à sa date), `subject_matter_instruction` (écrire sur le sujet, pas sur le document) et
   `source_ref_instruction` (une citation porte son `[Sk]`) sont des fragments **partagés** de
   `corpus.py` ([corpus.py:253-373](../../../media_summarizer/workers/artifact_generator/generators/corpus.py#L253))
   et doivent entrer dans le bloc d'instructions du chat **tel quels**. Celui qui compte le plus ici
   est `source_ref_instruction(required=True)` : une réponse de chat qui cite doit dire de quelle
   source, sinon elle est invérifiable — c'est la seule contrainte que task-316 §3.2 relève comme
   *« ce qui marche »*, vérifiée au caractère près sur les sorties de `-dev`.

### 11.3 La mutualisation des générations par contenu — task-394, incarnée dans le code

La règle est : *« an existing artifact is reused as soon as the set of sources behind it is
identical »*, et depuis task-394 **cela traverse les comptes à portée média**, parce que tout ce que
l'`artifact_id` hache sauf `user_id` est déjà de l'identité de contenu
([artifact_service.py:9-49](../../../media_summarizer/core/services/artifact_service.py#L9),
[artifact_service.py:490-544](../../../media_summarizer/core/services/artifact_service.py#L490)).

**Une conversation ne se mutualise pas, et il faut le dire explicitement** parce que c'est le seul
endroit où le chatbot *doit* rompre avec une décision validée :

- une conversation est **adressée par la personne**, pas par le contenu. `mutualizes_generation`
  rend vrai pour toute portée média sur un contenu non account-scoped
  ([artifact_service.py:522-544](../../../media_summarizer/core/services/artifact_service.py#L522)) ;
  appliquer la même règle à un tour de chat voudrait dire que deux comptes posant la même question
  sur le même média partagent la même ligne, dont le `user_id` est « le compte qui a déclenché »
  ([media_artifact.py:182-186](../../../media_summarizer/core/models/media_artifact.py#L182)). C'est
  structurellement une surface de fuite, et c'est la raison pour laquelle **la conversation ne va
  pas dans `media_artifacts`** (§2.1) ;
- ce qui **est** mutualisé, et gratuitement, c'est le corpus : le `prompt_cache_key` d'un tour doit
  être calculé sur le même matériau que celui d'une génération — `(scope, content_scope_id, clés S3
  des transcripts)`, soit `_prompt_cache_key`
  ([artifact_service.py:2090-2099](../../../media_summarizer/core/services/artifact_service.py#L2090)).
  Le cache étant **par organisation** et non par compte (§6.1), **deux comptes conversant sur le
  même contenu se partagent le préfixe en cache sans partager la moindre ligne de données.** C'est
  la mutualisation de task-394 obtenue au niveau où elle est sans risque : chez le fournisseur, sur
  le corpus, et pas sur la réponse.

Conséquence pratique, et elle est agréable : **réutiliser `_prompt_cache_key` tel quel fait que la
première question posée sur un média dont les artefacts viennent d'être générés tombe sur un cache
déjà chaud**, parce que les cinq générations ont écrit le même préfixe sous la même clé.

---

## 12. L'ordre de construction, en tranches livrables

### Tranche 1 — le chatbot à portée média, architecture B *(à faire d'abord, sans condition)*

Le périmètre exact : la table `chat_conversations`, les cinq routes `/api/chat`, le troisième mode du
worker, l'écran, le barème `max(1, ceil(S/5))` minutes par tour (donc **1 minute** à portée média),
le plafond de **20 tours**, la règle **un tour en vol par compte**, la question à **1 000
caractères**, `max_completion_tokens = 2000`, `generations_per_day` porté à 120, la ligne dans
`_USER_PARTITION_TABLES`. **Pas de portée dossier, pas de portée bibliothèque, pas de streaming.**

**Pourquoi la portée média d'abord**, et ce sont quatre faits, pas une préférence :

1. **Le coût.** Un premier tour vaut 0,00397 € contre 0,02126 € au plafond dossier, soit **5,4×**
   (§6.3).
2. **Les limites du fournisseur.** Un premier tour à portée média occupe **10,2 %** du TPM du
   palier 1 ; un premier tour sur un dossier au plafond en occupe **60,5 %**, et deux en parallèle
   le dépassent (§9.4). La portée média est la seule qui tient sans connaître le palier du compte
   OpenAI.
3. **C'est l'usage réel mesuré.** M1 : **145 des 157 lignes d'artefacts de `-dev` sont à portée
   média**, 12 à portée dossier. Et le plus gros prompt jamais envoyé fait 62 601 tokens, soit la
   moitié du plafond.
4. **C'est la tranche qui produit les signaux.** Les quatre tranches suivantes sont déclenchées par
   des chiffres que seule une conversation réelle peut donner, et chacun est lisible dans ce que la
   tranche 1 écrit elle-même : `turn_count` sur l'item, et par tour `llm_usage.prompt_tokens`,
   `llm_usage.cached_tokens`, `created_at` et `completed_at` — les mêmes champs que
   `_read_llm_usage` remplit déjà pour les artefacts
   ([worker.py:216-232](../../../media_summarizer/workers/artifact_generator/worker.py#L216)).

**Comment lire les signaux** : un `aws dynamodb scan --table-name chat_conversations-dev` en lecture
seule, exactement comme M1 l'a fait sur `media_artifacts-dev`. Aucun tableau de bord nouveau n'est
nécessaire pour décider des tranches suivantes.

### Tranche 2 — la portée dossier

**Signal déclencheur, les deux conditions requises :**

- **S2a — taux de cache de prompt ≥ 70 % sur les tours de rang ≥ 2**, calculé comme
  `somme(cached_tokens) / somme(prompt_tokens)` sur **au moins 100 tours** de rang ≥ 2.
  *Pourquoi ce seuil :* en dessous, un tour sur un dossier au plafond coûte 0,0213 € au lieu de
  0,0029 € (**×7,4**), et l'allocation complète d'un abonné Reader (60 minutes) ne paie plus que
  **12 tours** sur un dossier. Au-dessus, une conversation de 20 tours au plafond coûte 0,074 €,
  soit 11,2 minutes-équivalent, pour 100 minutes débitées.
  *Pourquoi il faut le mesurer :* le taux réellement observé sur les artefacts est de **11,9 %**, et
  de **0 %** sur trois types (§6.2). Le régime d'une conversation est plus favorable — séquentiel,
  même préfixe, même clé, et chaque tour rafraîchit la rétention (§6.1) — mais **le dépôt n'en a
  aucune mesure**, et c'est exactement ce que la tranche 1 va produire.
- **S2b — médiane de `turn_count` ≥ 3** sur au moins 30 conversations terminées.
  *Pourquoi :* en dessous, les utilisateurs posent une question et s'en vont ; la relance n'est pas
  l'usage, et élargir la portée avant d'avoir observé la relance serait construire pour un
  comportement non mesuré.

**Si S2b est atteint mais pas S2a**, la portée dossier s'ouvre quand même, mais avec un plafond de
corpus de **40 000 tokens** au lieu de 120 000 : une conversation de 20 tours y coûte alors 0,168 €
sans cache (25,3 minutes-équivalent) au lieu de 0,443 € (66,8), et un premier tour 0,0075 € au lieu
de 0,0213 €. Le plafond vit dans le code comme `MAX_FOLDER_CORPUS_TOKENS`, donc c'est une constante
à poser, pas une architecture à refaire.

### Tranche 3 — assouplir le barème de quota

**Signal déclencheur : taux de cache ≥ 90 % sur les tours de rang ≥ 2**, sur au moins 300 tours.

Alors `chat_turns_per_minute = 2` — **1 minute pour 2 tours à portée média** — ce qui garde une marge
de **×2,4** (2 tours à 90 % de cache coûtent 0,00274 € pour 0,00664 € débités) tout en doublant ce
qu'un abonné peut faire : 120 / 600 / 1 440 tours par mois au lieu de 60 / 300 / 720.

C'est la tranche la moins chère de toutes : la valeur vit dans `pricing_config<suffixe>` en
DynamoDB, donc **un `put-item` de l'owner, aucun build, aucun déploiement**
([pricing_config_service.py:41](../../../media_summarizer/core/services/pricing_config_service.py#L41)).
C'est aussi pour cela qu'elle est séparée : la V1 doit être sûre dans le régime froid, et le
desserrage doit être une décision prise sur une mesure, pas un pari.

### Tranche 4 — la portée bibliothèque

**Signal déclencheur : ≥ 20 % des conversations de la tranche 2 portent un `source_count` ≥ 20**,
sur au moins 50 conversations à portée dossier. Autrement dit : les utilisateurs ouvrent déjà leurs
conversations sur le plus large périmètre que l'app autorise, et le plafond les gêne.

**Cette tranche est bloquée par une décision technologique non prise** et ne doit pas être démarrée
avant : voir §13.1. Le fait qui la rend inévitable est mesuré — M2 : le corpus entier de `-dev` vaut
**672 515 tokens**, soit **2,5× la fenêtre d'entrée de 272 000** du modèle. Une passe unique est
physiquement impossible sur une bibliothèque, donc la portée bibliothèque exige une récupération, et
la récupération rompt avec la décision validée de task-269 (§11.1) **et** fait perdre le cache
(§6.3). Ce n'est pas une extension de la tranche 2, c'est une autre architecture.

### Tranche 5 — le streaming

**Signal déclencheur : p90 de `completed_at − created_at` par tour > 25 s**, sur au moins 200 tours.

*Pourquoi 25 s :* la phase rapide du poll de l'app dure 60 s et son commentaire dit qu'elle couvre
*« the window 94,3 % of processings finish in »*
([useProcessingRefresh.ts:71-72](../../../mobile/src/hooks/useProcessingRefresh.ts#L71)). Le p90
mesuré sur les 128 générations réelles est de **16,9 s** (§5.2). Tant que les tours restent sous
25 s, l'attente est peinte par ce que l'app a déjà et le streaming n'achète que quelques secondes de
ressenti. Au-dessus, il faut arbitrer — et le prix est **≥ 10 objets Terraform** (API REST en mode
`STREAM` + remplacement de Mangum par le Lambda Web Adapter) ou **≥ 11** (API WebSocket), détaillés
en §5.1.

**Ordre et dépendances**

    Tranche 1 (inconditionnelle)
      ├── S2a ≥ 70 % ET S2b ≥ 3  ──> Tranche 2 (portée dossier)
      │     └── ≥ 20 % à source_count ≥ 20 ──> benchmark §13.1 ──> Tranche 4 (bibliothèque)
      ├── cache ≥ 90 %           ──> Tranche 3 (barème, sans déploiement)
      └── p90 > 25 s             ──> Tranche 5 (streaming)

---

## 13. Ce que ce benchmark ne tranche pas, et qui mérite un benchmark distinct

### 13.1 La stratégie de récupération pour la portée bibliothèque

**À créer comme tâche `benchmark` distincte avant la tranche 4.** Le fait qui l'impose est mesuré :
le corpus entier de `-dev` vaut 672 515 tokens (M2), soit **2,5× la fenêtre d'entrée** de 272 000 du
modèle. La question ouverte n'est pas « faut-il récupérer » mais **avec quoi** :

- l'index **Algolia** existe, il est déjà découpé en enregistrements de moins de 10 Ko portant
  `user_id` ([search_indexing.py:1-37](../../../media_summarizer/core/services/search_indexing.py#L1)),
  et il est gratuit au plan actuel (task-53.1, `Decision` : *« algolia car gratuit jusqu'à 130
  users »*). Mais il est **lexical** : il a été choisi pour une barre de recherche, et personne n'a
  mesuré si un classement BM25 sélectionne les bons passages pour une question en langage naturel ;
- un store de vecteurs n'existe pas dans la pile, et task-269 §12.3 avait déjà nommé ce sujet comme
  un benchmark à part entière : *« Le seuil de bascule vers une architecture RAG … ce serait un
  nouveau benchmark, avec le store de vecteurs comme sujet principal. »*

Ce benchmark-ci ne la tranche pas, et il ne doit pas : la trancher demande d'évaluer la qualité de
la récupération sur le corpus du projet, donc des appels LLM payants, que la tâche interdit.

### 13.2 Le modèle du Q&A multi-tours ancré

**À créer comme tâche `benchmark` distincte**, priorité basse : la V1 peut partir sur `gpt-5.4-nano`
par cohérence, et le changer plus tard ne touche qu'une constante.

La raison de l'ouvrir : task-72 a évalué les modèles pour la **génération one-shot** d'artefacts
structurés, et son champ `Decision` ne parle que de types d'artefacts. Un Q&A conversationnel ancré
sur un transcript est une autre tâche : refuser de répondre quand le corpus ne dit rien, citer sa
source, tenir la cohérence sur vingt tours. Deux indices mesurés disent que la question est réelle :

- `gpt-5-nano` brûle **2 678 tokens de sortie médians pour ~300 tokens visibles** sur
  `summary_short`, un écart que task-316 §2.13 n'explique pas (`completion_tokens_details` est jeté
  par `_read_llm_usage`). Si ce comportement se reproduit en conversation, la sortie — à **6,25× le
  prix de l'entrée** — devient un poste de coût réel ;
- `gpt-5.4-mini` est à 0,75 / 0,075 / 4,50 $ (§6.1), soit 3,75× l'entrée de `gpt-5.4-nano`. Sur une
  conversation de 20 tours à portée média avec cache, cela ferait passer le coût de 0,024 € à
  ~0,091 € : **chiffrable, et toujours négligeable** à l'échelle du projet. Le coût n'est donc pas
  l'arbitre ici ; la qualité l'est, et elle n'est pas mesurable sans appels payants.

### 13.3 Deux points de produit à trancher par l'owner, pas par un benchmark

1. **L'instantané de sources est-il figé à l'ouverture de la conversation ?** La recommandation est
   oui (§11.1). Si l'owner veut l'inverse, c'est un multiplicateur de coût d'environ 10 sur le tour
   qui suit le changement, et une conversation dont les onze premières réponses n'ont pas lu le même
   texte que la douzième.
2. **Un TTL sur les conversations ?** La recommandation est non (§9.5), par cohérence avec le refus
   de péremption de task-269. Le coût d'un oui est un attribut et un bloc `ttl` : c'est un choix
   produit, pas une contrainte technique.

---

## 14. Risques, angles morts, et ce qui n'est pas repris

### 14.1 Les angles morts assumés

| Risque | Portée | Ce qui est fait, et ce qui ne l'est pas |
|---|---|---|
| **Le taux de hit du cache n'est pas mesuré en régime conversationnel** | coût ×4 à ×7 par tour | Assumé, et **chiffré dans les deux régimes partout** (§6.3, §9.2). Le barème de la V1 est margé dans le régime froid (×1,15 au pire), et le desserrage est la tranche 3, déclenchée par la mesure |
| **La qualité d'un Q&A ancré sur `gpt-5.4-nano` n'est pas mesurée** | qualité perçue | Impossible sans appels LLM payants, interdits par la tâche. §13.2 le nomme comme benchmark distinct. Atténuation gratuite : reprendre les fragments d'instruction de `corpus.py` validés par task-316 (§11.2) |
| **Le palier OpenAI du compte n'est pas connu** | 429 sous charge | Il n'est pas lisible depuis ce dépôt : il vit dans la console du fournisseur, et aucun identifiant de compte n'a sa place ici. Les tableaux de §9.4 sont donc donnés **par palier**, et la V1 est dimensionnée pour tenir au **palier 1**, le plus bas |
| **Les tokens d'entrée servis par le cache comptent-ils plein dans le TPM ?** | marge sur les limites de débit | La documentation ne le dit pas. Comptés **plein** : direction prudente (§9.4) |
| **Les métriques de la file mélangeront chat et artefacts** | lisibilité du tableau de bord | Assumé : l'alarme qui décide est celle de la **profondeur du DLQ**, qui reste exacte, et le worker multiplexe déjà deux charges depuis task-395 (§2.3). Si la confusion gêne, un `event` distinct dans les logs les sépare sans objet nouveau |
| **`_debit` est best-effort** : une écriture de compteur qui échoue sous-compte un tour | marge | Propriété existante et **délibérée** du dépôt — *« Losing a debit under-counts one item; refusing the item the user already paid for is worse »* ([quota_enforcer.py:1063-1071](../../../media_summarizer/core/services/quota_enforcer.py#L1063)). Le chatbot ne l'aggrave pas, il la partage |
| **Un tour `failed` est-il débité ?** | équité | **Oui**, par le même raisonnement que les artefacts : le débit a lieu à l'acceptation et le token est l'id du tour, donc une reprise ne redébite pas. À trancher par l'owner s'il préfère un remboursement — ce serait un mécanisme nouveau, et le dépôt n'en a aucun : *« Minutes are never refunded »* ([quota_enforcer.py:1358-1362](../../../media_summarizer/core/services/quota_enforcer.py#L1358)) |
| **L'app ne sait pas peindre une saisie de texte libre longue** | mobile | Vrai : il n'y a aujourd'hui que `UrlEntryDialog` et `RenameDialog`. Un composeur multiligne avec gestion du clavier est **entièrement neuf dans les quatre architectures**, et c'est le poste mobile le plus lourd de la tranche 1 |

### 14.2 Ce que la littérature du long contexte impose, et qui est déjà traité

task-269 §2.7 a réuni les références (« Lost in the Middle », context rot, NoLiMa, BooookScore) et en
a tiré la conclusion d'ingénierie : **le plafond est la réponse**. Le chatbot hérite du régime
favorable sans rien ajouter — un média d'une heure vaut 19 487 tokens, soit **7,2 %** de la fenêtre
d'entrée ; un dossier au plafond avec 20 tours d'historique vaut 131 100 tokens, soit **48,2 %**. Et
§6.4 ajoute un argument que task-269 n'avait pas besoin de faire : **toute tentative de condenser
l'historique pour tenir plus loin coûte plus cher que de ne rien condenser**, donc l'incitation
économique et l'incitation de qualité pointent dans la même direction.

### 14.3 Ce qui n'est **pas** repris de task-212 *(benchmark abandonné)*

`docs/research/task-212-llm-serving-architecture-benchmark/README.md` porte
`owner_decision: abandoned`. Il a été lu pour ne pas rechiffrer ce qu'il chiffre, et **aucune de ses
conclusions d'infrastructure n'est reprise** :

- sa recommandation est un **changement de fournisseur** — Azure OpenAI en GlobalStandard
  multi-région, puis Provisioned Throughput, derrière Cloudflare AI Gateway. Ce benchmark-ci ne porte
  pas sur le fournisseur et ne le rouvre pas : il part du fournisseur déployé et du seul chemin
  d'appel LLM qui existe
  ([worker.py:73-75](../../../media_summarizer/workers/artifact_generator/worker.py#L73)) ;
- ses hypothèses de charge sont **100 à 1 000 utilisateurs actifs**, avec « 200 users chatbot
  simultanés × 75k tokens = 15M tokens en une minute ». L'échelle réelle est **une douzaine de
  testeurs beta**, 5 comptes sur `-dev` (M5), et un maximum observé de **112 minutes** consommées
  sur une période de 720 (M6). À cette échelle le TPM du palier 1 suffit (§9.4), et la seule chose à
  borner est la concurrence par compte ;
- ce qui en est **repris**, et uniquement cela : ses URLs de documentation fournisseur, **revérifiées
  à la source le 2026-10-06**, dont les chiffres figurent en §1.4. Les quotas Azure de son annexe A
  ne sont pas utilisés.

---

## 15. Sources

### 15.1 Externes

Toutes consultées le **2026-10-06**. Le tableau de §1.4 dit, ligne par ligne, quel fait vient de
quelle URL.

- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/models/gpt-5.4-nano
- https://developers.openai.com/api/docs/models/gpt-5-nano
- https://developers.openai.com/api/docs/guides/prompt-caching
- https://developers.openai.com/api/docs/guides/rate-limits
- https://developers.openai.com/api/docs/guides/conversation-state
- https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-quotas.html
- https://docs.aws.amazon.com/apigatewayv2/latest/api-reference/apis-apiid-integrations.html
- https://docs.aws.amazon.com/apigateway/latest/api/API_Integration.html
- https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode-lambda.html
- https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
- https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-overview.html
- https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html
- https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html

Deux chiffres sont repris d'un relevé antérieur du dépôt, avec leur date d'origine : les allocations
« AI Chat » d'Otter (20 / 50 / 200 par mois) et la leçon qu'en tire task-287 §4, relevées le
**2026-08-18** sur https://otter.ai/pricing ; et le prix Deepgram Nova-3 derrière
`cost_per_minute_eur = 0.00664`, relevé le **2026-08-18** sur https://deepgram.com/pricing.

### 15.2 Internes

- Code et Terraform : la liste de §1.2, avec les numéros de ligne cités en place dans tout le
  document.
- Recherches : `task-269-collection-artifact-aggregation`, `task-316-artifact-prompts`,
  `task-72-llm-artifact-benchmark`, `task-212-llm-serving-architecture-benchmark` (abandonné, voir
  §14.3), `task-287-consumption-model`, `pricing-challenge`, `task-368-push-delivery`,
  `task-53.1-lexical-search`.
- **Non consultées, délibérément** : `docs/research/task-427-ask-question-vs-chatbot/` dans son
  intégralité, et les fichiers de backlog `task-427` et `task-428` (§1.1).

### 15.3 Mesures

Les douze commandes AWS en lecture seule de §1.3, toutes exécutées le **2026-10-06** sur
l'environnement `-dev` (`eu-west-3`, compte `125313707865`, profil `second-brain-app`).
**Aucun appel LLM payant n'a été émis, et aucun fichier source du dépôt n'a été modifié.** Seuls des
agrégats sont rapportés : aucun identifiant de compte utilisateur, aucun secret et aucune clé d'API
n'apparaît dans ce document.
