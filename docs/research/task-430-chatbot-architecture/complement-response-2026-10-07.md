# Complément — task-430, demande du 2026-10-07

Réponse à `complement-request-2026-10-07.md`. **Le `README.md` principal n'est pas modifié** : il
reste la base de preuves, et ce document s'y ajoute. Quand une section du README est invoquée, elle
est citée (`§5.1`, `§6.2`…) plutôt que rechiffrée — sauf là où une consigne demande explicitement un
nouveau calcul.

**Interdiction tenue.** Aucun fichier de `docs/research/task-427-*` n'a été consulté pour ce
complément : ni son `README.md`, ni son `compute.py`, ni aucun autre fichier de ce répertoire, ni les
fichiers de backlog `task-427` et `task-428`. Comme au premier passage, chaque fait porte soit un
fichier et une ligne de ce dépôt, soit une commande AWS en lecture seule avec sa date, soit une URL
avec sa date de consultation.

**Aucun appel LLM payant n'a été émis.** Aucun fichier source du dépôt n'a été modifié : les seuls
fichiers écrits sont ce complément et la note d'implémentation de la tâche.

**Ce que ce complément conclut, en une phrase.** La candidate manquante existe, elle est chiffrable,
et sous la pondération de l'owner **elle gagne nettement** : classement **E 8,15 > B 5,75 >
C 5,50 > D 5,00 > A 4,25**, là où la pondération du §8.2 donnait **B 9,4 > A 7,9 > D 6,8 >
E 6,6 > C 4,8**. Les deux classements se contredisent presque terme à terme, et cette contradiction
*est* l'arbitrage que l'owner est en train de faire. Un seul fait les réconcilie : **B est un
sous-ensemble strict de E**, donc choisir B d'abord ne coûte rien contre E ensuite. Détail en C2.

---

## 0. Base de preuves ajoutée

### 0.1 Mesures AWS nouvelles, en lecture seule

Région `eu-west-3`, compte `125313707865`, profil `second-brain-app` (il n'y a pas de profil
default, et l'API de tarification exige `--region us-east-1`). **Toutes exécutées le 2026-10-07**,
toutes en lecture seule, aucune écriture.

- **M13** — `aws pricing get-attribute-values --service-code AmazonElastiCache --attribute-name
  productFamily` puis `get-products` filtré sur `location = EU (Paris)` et
  `productFamily = ElastiCache Serverless`.
  → **Valkey : 0,098 $ / Go-heure de données stockées et 0,0027 $ par million d'ECPU ;**
  Redis OSS et Memcached : 0,146 $ / Go-heure, 0,0040 $ par million d'ECPU ; sauvegardes
  0,085 $ / Go-mois. (Le tableau régional de la page publique ne se rend pas ; l'API de tarification
  est la source retenue, version du catalogue `20260914063714`.)
- **M14** — `aws pricing get-products --service-code AmazonDynamoDB` filtré sur `EU (Paris)`,
  groupes `DDB-WriteUnits` et `DDB-ReadUnits`.
  → **0,7423 $ par million d'unités d'écriture à la demande, 0,1487 $ par million d'unités de
  lecture.**
- **M15** — `aws pricing get-products --service-code AWSLambda` filtré sur `EU (Paris)`,
  groupe `AWS-Lambda-Duration-ARM`. → **0,0000133334 $ / Go-seconde (palier 1)**, 0,0000120001 $
  (palier 2), 0,0000106667 $ (palier 3).
- **M16** — `aws dynamodb list-tables --region eu-west-3`. → **23 tables**, ce qui confirme M12 ;
  aucune table de contenu durable distincte (le transcript est adressé depuis `processing_jobs-dev`).
- **M17** — `aws dynamodb scan --table-name processing_jobs-dev` projeté sur `user_id`,
  `transcription_s3_key`, `media_item_id`, `media_type`, croisé avec
  `aws s3api list-objects-v2 --bucket media-summarizer-transcripts-125313707865-dev` projeté sur
  `Key` et `Size`. → 105 jobs, **99 clés de transcript distinctes** (3 référencées mais absentes du
  bucket), et la taille du corpus **par compte** :

  | Compte (anonymisé, trié par taille) | Médias | Octets de transcript | Tokens estimés à 3,4 o/token |
  |---|---|---|---|
  | 1 | 37 | 656 554 | **193 104** |
  | 2 | 47 | 244 418 | 71 887 |
  | 3 | 10 | 7 317 | 2 152 |
  | 4 | 1 | 1 948 | 572 |
  | 5 | 1 | 112 | 32 |
  | **Total** | **96** | **910 349** | **267 749** |

  Le bucket entier pèse 2 286 551 octets sur **326 objets**, dont **224 978 octets de variantes
  `.translated.`**. C'est le chiffre que M2 avait rapporté et que le §13.1 a converti en
  672 515 tokens. **Ce n'est pas une bibliothèque** : c'est la somme de cinq comptes, plus les
  traductions, plus les objets qu'aucun job ne référence plus. Conséquence traitée en C4.
- **M18** — `aws lambda get-function-url-config --function-name media-summarizer-api-dev` :
  inchangé depuis M9, **`ResourceNotFoundException`**. Aucune Function URL n'existe encore dans cet
  environnement, donc la candidate E part de zéro et rien n'est à défaire.

Aucun identifiant de compte utilisateur, aucune adresse, aucune clé et aucun secret ne figure
ci-dessus : seuls des agrégats sont rapportés, et les comptes sont numérotés par ordre de taille.

### 0.2 Sources externes nouvelles, consultées le 2026-10-07

| Fait établi | Source |
|---|---|
| `gpt-6-luna` : contexte **1 050 000**, entrée max **922 000**, sortie max **128 000** ; **0,10 / 0,01 / 0,50 $** par 1M (entrée / entrée en cache / sortie), **écriture de cache 0,125 $** ; `reasoning_effort` de `none` à `max`, défaut `medium` ; Chat Completions **et** Responses supportés, la *function calling* sur Chat Completions « only with `reasoning_effort` set to `none` » ; coupure de connaissances 18 mai 2026 | https://developers.openai.com/api/docs/models/gpt-6-luna |
| `gpt-6.1-sol` : mêmes fenêtres (1 050 000 / 922 000 / 128 000) ; **2,00 / 0,10 / 10,00 $** par 1M, écriture de cache **2,50 $** ; `reasoning_effort` de `low` à `max`, défaut `medium`, **`none` non supporté** ; coupure 30 avril 2026 | https://developers.openai.com/api/docs/models/gpt-6.1-sol |
| La falaise, **verbatim** : « *Prompts with more than 272K input tokens are priced at 2x input and cache rates and 1.5x output for the full request.* » Confirmée côté grille par deux colonnes : « *Short context: ≤272K input tokens. Long context: >272K input tokens* » — luna 0,20 / 0,02 / 0,75 $ au-delà, sol 4,00 / 0,20 / 15,00 $, écritures de cache 0,25 $ et 5,00 $ | https://developers.openai.com/api/docs/pricing |
| TPM et cache, **verbatim** : « *Yes. Cached input tokens still count toward tokens-per-minute limits.* » et « *Prompt caching does not change how [rate limits] are calculated.* » | https://developers.openai.com/api/docs/guides/prompt-caching |
| Cache, famille GPT-5.6 et au-delà (donc `gpt-6-luna` et `gpt-6.1-sol`) : préfixe minimal **1 024 tokens visibles** ; `cached_tokens` au **bord exact** et non arrondi à 128 ; **écriture de cache facturée 1,25× le tarif d'entrée non cachée**, lecture 0,1× (**0,05× sur GPT-6.1 Sol**) ; durée de vie par `prompt_cache_options.ttl` dont « *The only supported value, `30m`, is also the default* », réutilisable « *for 30 minutes after its most recent write or reuse* ». `prompt_cache_retention` (`in_memory` / `24h`) ne vaut que pour les modèles antérieurs, et la liste des modèles à rétention étendue s'arrête à gpt-5.5 | https://developers.openai.com/api/docs/guides/prompt-caching |
| Compaction côté fournisseur : `context_management` avec `compact_threshold` est un paramètre de **`POST /responses`** ; `/responses/compact` existe, « *fully stateless and ZDR-friendly* » ; la compaction « *prunes context before continuing inference* » ; le guide de cache dit qu'elle « *can prevent reuse from the first changed token onward* », que « *the first request after compaction may reuse less of the previous cache even when the conversation is logically the same* », et conclut qu'« *fewer input tokens can still save money even when the cache-hit rate falls* » | https://developers.openai.com/api/docs/guides/context-management |
| État côté fournisseur : « *Response objects are saved for 30 days by default* », « *You can disable this behavior by setting `store` to `false` when creating a Response* », « *Conversation objects and items in them are not subject to the 30 day TTL* », « *all previous input tokens for responses in the chain are billed as input tokens in the API* » | https://developers.openai.com/api/docs/guides/conversation-state |
| Chat Completions : `stream` « *If set to true, the model response data will be streamed to the client as it is generated using [server-sent events]* » ; `stream_options.include_usage` « *If set, an additional chunk will be streamed before the `data: [DONE]` message* », dont « *The `usage` field on this chunk shows the token usage statistics for the entire request* » — et un flux interrompu peut ne jamais livrer ce dernier *chunk* | https://developers.openai.com/api/docs/api-reference/chat/create |
| Lambda response streaming, **le fait décisif de ce complément** : « *streamed responses are not interrupted or stopped when the invoking client connection is broken. Customers are billed for the full function duration* » ; 200 Mo de charge utile en flux contre 6 Mo bufferisé ; débit non plafonné sur les 6 premiers Mo puis 2 Mo/s ; Python passe par un *custom runtime* ou le **Lambda Web Adapter** ; une Function URL **ne streame pas dans un VPC** | https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html |
| Function URL, contrôle d'accès : `AuthType` est `AWS_IAM` ou `NONE` ; en `NONE` « *any unauthenticated user with your function URL can invoke your function* » ; **depuis octobre 2025 « *new function URLs will require both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` permissions* »** | https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html |
| Function URL, invocation : en `AWS_IAM` « *you must sign each HTTP request using AWS Signature Version 4 (SigV4)* » ; en `NONE` « *you don't have to sign your requests* » ; format d'événement **payload 2.0**, le même que l'API HTTP déployée | https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html |
| Function URL, configuration : bloc CORS natif (6 en-têtes) ; étranglement **uniquement** par `reserved concurrency` — « *maximum request rate per second (RPS) is equivalent to 10 times the configured reserved concurrency* », et au-delà « *your function URL returns an HTTP `429` status code* » ; « *You can access your function URL through the public Internet only* » | https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html |
| Function URL contre API Gateway : les **noms de domaine personnalisés**, les autorisateurs Lambda/Cognito, l'étranglement par étage, les plans d'usage et **l'intégration WAF** sont des capacités d'API Gateway, pas de Function URL | https://docs.aws.amazon.com/lambda/latest/dg/furls-http-invoke-decision.html |
| Métriques d'une Function URL : `UrlRequestCount`, `Url4xxCount`, `Url5xxCount`, **`UrlRequestLatency`**, dimensionnées par `FunctionName` / `Resource` / `ExecutedVersion`. Mais « *By default, CloudTrail doesn't log `InvokeFunctionUrl` requests, which are considered data events* » — **il n'y a aucun journal d'accès** équivalent à l'`access_log_settings` de l'étage API Gateway | https://docs.aws.amazon.com/lambda/latest/dg/urls-monitoring.html |
| Quotas Lambda : **timeout maximum 900 s** ; charge utile 6 Mo en requête et en réponse synchrone, **200 Mo par réponse streamée** ; **1 000 exécutions concurrentes par région** par défaut | https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html |
| Lambda Web Adapter : une ligne dans l'image — `COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0 /lambda-adapter /opt/extensions/lambda-adapter` ; « *Non-AWS base images may be used since the Runtime Interface Client ships with the Lambda Web Adapter* » ; `AWS_LWA_INVOKE_MODE` = « *Lambda function invoke mode: "buffered" or "response_stream"* », défaut `buffered` ; `AWS_LWA_PORT` défaut 8080, `AWS_LWA_READINESS_CHECK_*`, `AWS_LWA_ASYNC_INIT` ; exemples FastAPI en *response streaming* fournis par le projet | https://github.com/awslabs/aws-lambda-web-adapter |
| Terraform `aws_lambda_function_url` : `authorization_type` et `function_name` requis ; `invoke_mode` — « *How the Lambda function responds to an invocation. Valid values are `BUFFERED` (default) and `RESPONSE_STREAM`.* » ; bloc `cors` (`allow_credentials`, `allow_headers`, `allow_methods`, `allow_origins`, `expose_headers`, `max_age` plafonné à 86 400) ; **en `NONE` les permissions publiques sont attachées automatiquement et persistent même après destruction de la ressource** | documentation du fournisseur AWS, fichier `website/docs/r/lambda_function_url.html.markdown` de `hashicorp/terraform-provider-aws` |
| CloudFront : « *To use a certificate in AWS Certificate Manager (ACM) to require HTTPS between viewers and CloudFront, make sure you request (or import) the certificate in the US East (N. Virginia) Region (`us-east-1`).* » | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html |
| Le patron de reprise publié : « *The `resumable-stream` package — Handles the publisher/subscriber mechanism for streams* », « *Redis to store the UIMessage stream* » ; « *Your persistence layer saves the `activeStreamId` in the chat data* » ; « *When no active stream exists, the GET handler returns a 204 (No Content) status code* » ; « *In a resumable stream setup, client-side aborts are treated as disconnects* » ; « *Do not call the stop endpoint from route cleanup code. Route cleanup is a disconnect, not an explicit stop.* » ; un *endpoint* d'arrêt dédié qui « *persists the partial response, cancels the active work, and clears the active stream* » | https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams |
| La persistance publiée : « *Storing messages is done in the `onEnd` callback* », « *consume the stream to ensure it runs to completion & triggers onEnd // even when the client response is aborted* », « *meaning that the result is stored even when the client has already disconnected* », et sans cela « *the stream from the LLM will be aborted and the conversation may end up in a broken state* ». **Point de méthode : ni cette page ni celle de la reprise ne contient la phrase « WebSockets aren't part of this pattern at all »** — voir C1.0 | https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence |
| DynamoDB, capacité : « *DynamoDB considers the size of the item as it appears before and after the update. The provisioned throughput consumed reflects the larger of these item sizes* » ; 1 unité d'écriture = 1 Ko, 1 unité de lecture forte = 4 Ko (0,5 en lecture éventuelle) | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/read-write-operations.html |
| DynamoDB, TTL : « *If you use any other format, the TTL processes ignore the item* » — donc un item sans attribut TTL numérique n'expire jamais ; et les items expirés sont « *deleted at no cost* » | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/time-to-live-ttl-before-you-start.html |
| Expo : `expo/fetch` « *provides a WinterCG-compliant Fetch API that works consistently across web and mobile environments* », avec l'exemple « *Streaming fetch* » qui fait `const reader = resp.body.getReader();` ; « *Global support for standard web streams is available on native platforms* », `ReadableStream` / `WritableStream` / `TransformStream` et `TextDecoderStream` globaux. **Présent dans la documentation de la SDK 55**, la version du dépôt (`mobile/package.json:23`) | https://docs.expo.dev/versions/v55.0.0/sdk/expo/ |
| ElastiCache, minimum facturé : « *Minimum metered data storage: 100 MB per cache for ElastiCache Serverless for Valkey and 1 GB per cache for ElastiCache for Memcached and ElastiCache for Redis OSS.* » (les tarifs régionaux viennent de M13, la page ne rendant pas ses tableaux) | https://aws.amazon.com/elasticache/pricing/ |
| Contexte long : « *models do not use their context uniformly; instead, their performance grows increasingly unreliable as input length grows* », « *Across all experiments, model performance consistently degrades with increasing input length* », « *NIAH underestimates what most long context tasks require in practice* », « *Even a single distractor reduces performance relative to the baseline* ». Publié le **14 juillet 2025**, 18 modèles. **Les résultats sont présentés en longueur absolue d'entrée, jamais en pourcentage de la fenêtre** | https://www.trychroma.com/research/context-rot |
| NoLiMa (ICML 2025, arXiv:2502.05167, v3 du 9 juillet 2025) : 13 modèles annonçant au moins 128K ; « *At 32K, for instance, 11 models drop below 50% of their strong short-length baselines* » ; GPT-4o « *experiences a reduction from an almost-perfect baseline of 99.3% to 69.7%* » | https://arxiv.org/abs/2502.05167 |

---

## C1 — La cinquième candidate : **E — « B + SSE reprenable sur une Lambda Function URL »**

### C1.0 Une correction préalable, et elle ne change pas la conclusion de l'owner

La demande attribue au patron publié la phrase « *WebSockets aren't part of this pattern at all* ».
**Les deux pages citées ne la contiennent pas** : ni *Chatbot Resume Streams*, ni *Chatbot Message
Persistence* ne mentionnent WebSocket (consultées le 2026-10-07). Le fait à retenir est plus faible
dans la lettre et aussi fort dans la conséquence : **le patron de référence décrit une mécanique
HTTP** — un `POST` qui crée le flux, un `GET /api/chat/[id]/stream` qui s'y rattache, un *endpoint*
d'arrêt, et un magasin de rejeu derrière. **WebSocket n'y figure nulle part**, et la seule
caractérisation du transport côté fournisseur est explicite : `stream: true` fait que la réponse
« *will be streamed to the client as it is generated using server-sent events* ».

Donc : la conclusion de l'owner tient — **le transport canonique du streaming de chat texte est SSE
sur HTTP** — mais elle est établie par l'absence de WebSocket dans le patron et par la présence de
SSE dans l'API du fournisseur, pas par une phrase qui l'affirmerait. Et le reproche fait à
l'architecture C tient lui aussi, dans une formulation plus exacte : **C paie au moins 11 objets
Terraform pour un transport que ni le fournisseur ni le patron de référence n'emploient**, et dont la
documentation AWS impose deux fermetures (10 min d'inactivité, 2 h de durée de vie) qu'aucun des deux
n'a à gérer.

### C1.1 Le fait qui rend E possible, et il est gratuit

> « *Streaming responses incur cost and **streamed responses are not interrupted or stopped when the
> invoking client connection is broken**. Customers are billed for the full function duration* »
> — documentation Lambda, *Response streaming*, consultée le 2026-10-07.

C'est **exactement** la propriété que le patron publié obtient par du code (`consumeStream()` sans
`await`, « *client-side aborts are treated as disconnects* ») : **Lambda la donne par construction**.
Une génération streamée depuis une Lambda ne s'arrête pas parce que le téléphone est passé en
arrière-plan, parce que le réseau est tombé dans le métro ou parce que l'utilisateur a quitté
l'écran. Il n'y a donc **rien à écrire** pour obtenir « la génération tourne jusqu'au bout côté
serveur » : il reste seulement à **persister** et à **rejouer**, qui sont les deux choses que
l'architecture B fait déjà.

Le revers est dans la même phrase : **on paie la durée complète de la fonction**. Un client qui se
déconnecte ne réduit ni la facture Lambda ni la facture LLM. Chiffré en C1.8.

### C1.2 Deux formes de E, et il faut les distinguer avant de compter

La consigne demande « la durabilité de B … plus le transport canonique par-dessus ». Il y a deux
façons de l'écrire, et elles ne coûtent ni ne valent la même chose.

| | **E — relais** *(la candidate demandée, celle qui est notée)* | **E′ — en ligne** *(variante, pas la candidate)* |
|---|---|---|
| Qui appelle le LLM | le worker `artifact_generator` **déjà déployé**, par la file déjà déployée | la Lambda de chat elle-même, derrière la Function URL |
| Qui streame | une Lambda dédiée, en `RESPONSE_STREAM`, qui **relit** les fragments que le worker écrit | la même Lambda, qui relaie directement les *deltas* du fournisseur |
| Durabilité du tour | celle de B : bail 300 s, `visibility_timeout` 1800 s, `maxReceiveCount` 3, DLQ, taxonomie `llm_failure`, 3 redélivrances sur `TRANSIENT` ([sqs.tf:205-227](../../../infrastructure/terraform/modules/platform/sqs.tf#L205), [worker.py:463-475](../../../media_summarizer/workers/artifact_generator/worker.py#L463)) | **celle d'une seule invocation** : pas de redélivrance, pas de DLQ, pas de 3 tentatives. Un recyclage, un OOM ou un dépassement de *timeout* perd le tour |
| `llm_alerts.tf` | **intact** : l'appel LLM reste dans un *log group* déjà listé dans `llm_worker_keys` ([llm_alerts.tf:30](../../../infrastructure/terraform/modules/platform/llm_alerts.tf#L30)) | **1 filtre de métrique nouveau**, et il faut en plus contourner le `for_each` (C1.6) |
| Temps au premier octet | file + démarrage à froid + premier token + 250 ms de relais au plus | démarrage à froid + premier token |
| Objets AWS nouveaux | **8** (C1.9) | 9, dont le filtre de métrique, **et la durabilité en moins** |

**E′ est écartée** et pour la raison même que l'owner met en avant : elle achète un peu de latence en
rendant le tour non rejouable, c'est-à-dire en payant le streaming avec la robustesse. Tout ce qui
suit chiffre **E — relais**.

### C1.3 La Lambda dédiée : image, adaptateur, chaîne de livraison

- **`aws_lambda_function_url`** avec `invoke_mode = "RESPONSE_STREAM"` — « *Valid values are
  `BUFFERED` (default) and `RESPONSE_STREAM`* » — posée sur une fonction nouvelle, pas sur la Lambda
  API (M18 : aucune Function URL n'existe, donc rien à défaire).
- **Lambda Web Adapter à la place de Mangum, sur cette fonction seulement.** Une ligne dans l'image
  (`COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0 /lambda-adapter
  /opt/extensions/lambda-adapter`), `AWS_LWA_INVOKE_MODE=response_stream`, `AWS_LWA_PORT=8080`,
  uvicorn comme processus principal, et une route FastAPI en `StreamingResponse`. La façade HTTP et
  `Mangum(app, lifespan="off")` ([lambda_handler.py:30](../../../media_summarizer/api/lambda_handler.py#L30))
  **ne sont pas touchés**, donc toutes les alarmes et tous les widgets indexés sur
  `local.api_gateway_id` ([pipeline_dashboard.tf:56](../../../infrastructure/terraform/modules/platform/pipeline_dashboard.tf#L56))
  restent exacts. C'est le point que le §5.1 ne pouvait pas obtenir : le remplacement de la façade
  par une API REST en mode `STREAM` imposait de réécrire ces alarmes, une Function URL **à côté** ne
  l'impose pas.
- **Mais ce n'est pas la même image.** Le dépôt a deux `Dockerfile`, et celui de l'API part de
  `public.ecr.aws/lambda/python:3.11-arm64` avec `CMD
  ["media_summarizer.api.lambda_handler.handler"]` (`infrastructure/docker/lambda-api.Dockerfile`) :
  le processus principal est le *Runtime Interface Client*, pas un serveur web. Le patron LWA en
  conteneur veut l'inverse. **Coût réel : un troisième `Dockerfile`**, et dans
  `.github/workflows/deploy-lambda.yml` un troisième travail de construction plus un troisième bloc
  de déploiement — parce que la boucle existante découvre ses cibles par préfixe de nom,
  `awk -F: '$NF ~ /^media-summarizer-worker-/'`
  ([deploy-lambda.yml:198-205](../../../.github/workflows/deploy-lambda.yml#L198)), et qu'une
  fonction nommée autrement n'y entre pas — tandis qu'une fonction nommée `…-worker-chat-…` y
  entrerait et recevrait **l'image des workers**, qui n'a ni l'adaptateur ni le bon processus
  principal. Ce coût n'a **aucune ligne** dans le §8.3 : il est hors AWS. Il est réintroduit en
  C1.9.
- **Budget de temps** : `timeout` jusqu'à **900 s** (quota Lambda), contre 300 s pour le worker et
  **30 s non augmentables** pour l'architecture A. Le plafond cesse d'être un sujet.

### C1.4 L'authentification de cette seconde porte d'entrée — verdict : `NONE` + le JWT de l'application

La consigne demande laquelle des deux, et ce qu'elle coûte en code mobile. La réponse est tranchée
par un fait du dépôt : **le jeton de l'application est un JWT que l'application émet elle-même**, et
l'app ne détient **aucune** identité AWS. `get_current_user` lit un *bearer* via
`OAuth2PasswordBearer` et le valide avec `verify_token`
([auth.py:23-26](../../../media_summarizer/api/dependencies/auth.py#L23),
[auth.py:54-73](../../../media_summarizer/api/dependencies/auth.py#L54)).

| | `authorization_type = "AWS_IAM"` | `authorization_type = "NONE"` |
|---|---|---|
| Ce que le client doit faire | « *you must sign each HTTP request using AWS Signature Version 4 (SigV4)* », donc détenir des **identifiants AWS** | rien de nouveau : l'en-tête `Authorization: Bearer …` qu'il envoie déjà |
| Ce qu'il faut construire pour l'obtenir | un pool d'identités Cognito, le rôle IAM authentifié qui va avec, et un échange depuis un JWT **que Cognito ne connaît pas** (donc *developer authenticated identities* et un appel serveur de plus dans le chemin de connexion) : **au moins 3 objets AWS, 1 route backend, et le SDK AWS dans le bundle mobile** | 2 `aws_lambda_permission` (depuis octobre 2025 « *new function URLs will require both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` permissions* ») |
| Code mobile | signature SigV4 sur chaque requête, donc un client HTTP distinct de celui de l'app, **et la gestion d'identifiants temporaires à rafraîchir** | l'en-tête existant |
| Ce qui garde la porte | IAM **plus** le JWT (vérifié dans l'application de toute façon : la Function URL ne sait rien de `user_id`) | **le JWT seul** |

**Verdict : `NONE`, et la vérification du JWT dans l'application.** Deux raisons, et la seconde est
la vraie : (1) `AWS_IAM` n'enlève pas la vérification du JWT, puisque c'est elle qui établit *quel*
compte parle — IAM n'ajouterait donc qu'une couche de transport, pour le prix d'un pool d'identités
et du SDK AWS côté mobile ; (2) les cinq routes du chat passent déjà par la façade HTTP avec ce même
JWT, donc deux portes d'entrée avec **deux modèles d'authentification différents** seraient deux
surfaces à raisonner au lieu d'une.

**Ce que `NONE` coûte, et il faut l'écrire.** « *When your function URL auth type is `NONE` … any
unauthenticated user with your function URL can invoke your function.* » Trois conséquences
concrètes :

1. **Pas de WAF, pas d'étranglement d'étage.** Les plans d'usage, les autorisateurs et l'intégration
   WAF sont des capacités d'API Gateway. L'étage déployé porte `throttling_burst_limit = 1000` et
   `throttling_rate_limit = 500`
   ([lambda_api.tf:157-160](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L157)) ;
   **cette porte-là n'en aura pas.** Le seul levier est `reserved_concurrent_executions` :
   « *maximum request rate per second (RPS) is equivalent to 10 times the configured reserved
   concurrency* ». À `reserved = 5` on borne à 50 req/s et on garantit que le chat ne mange pas le
   pool de 1 000 exécutions concurrentes de la région, en acceptant qu'un sixième tour simultané
   reçoive un **429**. C'est acceptable : la V1 pose déjà « un tour en vol par compte » (§9.4).
2. **Un appel non authentifié coûte quand même une invocation.** Le JWT est vérifié *dans*
   l'application, donc après le démarrage de la fonction. Un balayage de l'URL facture des
   invocations. À l'échelle du projet c'est du bruit ; c'est une ligne de *runbook*, pas un risque.
3. **Terraform ne reprend pas ce qu'il a donné** : en `NONE`, le fournisseur attache les permissions
   publiques automatiquement et celles-ci persistent même après destruction de la ressource. Une
   suppression de la fonctionnalité laisse une politique de ressource à retirer à la main. À
   inscrire dans le §10.3.

### C1.5 Le domaine personnalisé et CORS

- **CORS : gratuit et au bon endroit.** `aws_lambda_function_url` a un bloc `cors` avec les six mêmes
  champs que la `cors_configuration` de l'API HTTP
  ([lambda_api.tf:138-146](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L138)).
  Mêmes valeurs, **zéro objet nouveau**, et la recommandation AWS est de tout configurer sur la
  Function URL plutôt que d'émettre les en-têtes depuis la fonction (sinon les en-têtes sont
  dupliqués et le navigateur refuse). Note : CORS est une affaire de navigateur ; une application
  React Native n'a pas d'origine, donc ce bloc ne sert qu'au web et aux outils.
- **Domaine personnalisé : non supporté, et c'est le poste le plus cher de C1.** Les noms de domaine
  personnalisés sont une capacité d'API Gateway. Deux voies :

  | Voie | Objets Terraform nouveaux | Objets mobiles nouveaux |
  |---|---|---|
  | **Accepter l'hôte `https://<id>.lambda-url.eu-west-3.on.aws`** | **0** | **1 variable** : un `EXPO_PUBLIC_CHAT_STREAM_URL`, son champ dans `extra` de `app.config.ts`, sa clé dans `Config`, et son réglage dans **chaque** profil de `mobile/eas.json` — à côté d'`API_BASE_URL`, qui n'a **aucun** repli et lève si elle manque ([config.ts:22-37](../../../mobile/src/constants/config.ts#L22)). `scripts/mobile_ota_manifest_check.sh` ne vérifie aujourd'hui qu'`apiBaseUrl` : il faudrait une ligne de plus, sinon une publication OTA sans la variable casse le chat **silencieusement** |
  | **Mettre la Function URL derrière CloudFront sur un sous-domaine** | **au moins 4** : 1 distribution CloudFront, 1 certificat ACM **en `us-east-1`** (« *make sure you request (or import) the certificate in the US East (N. Virginia) Region* »), donc **un alias de fournisseur Terraform nouveau** dans un module qui n'en a aucun, 1 enregistrement Route53, 1 *origin access control* | 0 |

  **Recommandation : accepter l'hôte `on.aws`, et payer la variable mobile.** Le dépôt a déjà la
  mécanique de variable publique et la garde qui va avec ; il n'a **aucun** alias de fournisseur
  multi-région, et en introduire un pour un certificat est une complication permanente de tous les
  `terraform plan` à venir. La contrepartie à accepter : **un hôte supplémentaire** dans ce que l'app
  contacte, et deux hôtes à révoquer si le domaine change.

### C1.6 L'observabilité n'est pas gratuite — et la consigne posait exactement la bonne question

La consigne demande « si cette Lambda entre gratuitement dans les `for_each` de `lambda_error_rate`
et `lambda_throttles` ». **Réponse : non, et le blocage est mécanique.**

Les deux alarmes bouclent sur `local.lambda_workers`
([pipeline_alerts.tf:170](../../../infrastructure/terraform/modules/platform/pipeline_alerts.tf#L170),
[pipeline_alerts.tf:225](../../../infrastructure/terraform/modules/platform/pipeline_alerts.tf#L225)),
et `lambda_workers = keys(local.workers)`
([pipeline_dashboard.tf:54](../../../infrastructure/terraform/modules/platform/pipeline_dashboard.tf#L54)).
Or `local.workers` alimente **trois** `for_each`, et le troisième est
`aws_lambda_event_source_mapping.worker` avec `event_source_arn = each.value.queue_arn`
([lambda_workers.tf:170-173](../../../infrastructure/terraform/modules/platform/lambda_workers.tf#L170)).
**Une Lambda de streaming n'a pas de file.** Lui donner une entrée dans `local.workers` sans
`queue_arn` casse ce mappage ; la seule façon propre est de filtrer le `for_each` du mappage
(`for k, v in local.workers : k => v if v.queue_arn != null`), c'est-à-dire **modifier une ressource
partagée par les quatorze workers déployés** pour y faire entrer un non-worker. Le même raisonnement
vaut pour `aws_cloudwatch_log_group.lambda_worker`
([lambda_workers.tf:113-114](../../../infrastructure/terraform/modules/platform/lambda_workers.tf#L113))
et pour `aws_lambda_function.worker`, dont l'`image_config.command` suppose un *handler*, pas un
serveur web.

Donc, deux options, et la seconde est la bonne :

| Option | Prix | Risque |
|---|---|---|
| Faire entrer la Lambda de chat dans `local.workers` | 1 ligne de filtre sur le mappage, et le reste gratuit (2 alarmes, 1 *log group*, 4 widgets) | On rend conditionnel le mappage SQS de **tous** les workers pour une fonction qui n'en est pas un, et l'image devient une exception dans un `for_each` qui en est aujourd'hui exempt |
| Déclarer la Lambda de chat **à part**, comme `lambda_digest_scheduler.tf` et `lambda_media_lifecycle.tf` le font déjà pour des Lambdas hors file | **1 `aws_cloudwatch_log_group` + 2 `aws_cloudwatch_metric_alarm`** écrits à la main | Aucun. C'est le précédent du dépôt pour exactement ce cas |

**Et il y a une alarme qu'aucune des deux options ne donne** : `api-latency-p95-breach` lit
`AWS/ApiGateway Latency` sur la dimension `ApiId`
([pipeline_alerts.tf:39-63](../../../infrastructure/terraform/modules/platform/pipeline_alerts.tf#L39))
— elle ne voit pas une Function URL. L'équivalent existe (`UrlRequestLatency`, `Url5xxCount`), donc
il est **écrivable**, mais c'est **2 alarmes de plus** si on veut la parité ; et une chose n'existe
pas du tout : **le journal d'accès**. L'étage API Gateway écrit un événement structuré par requête
(`access_log_settings`,
[lambda_api.tf:166-181](../../../infrastructure/terraform/modules/platform/lambda_api.tf#L166)) ;
« *By default, CloudTrail doesn't log `InvokeFunctionUrl` requests, which are considered data
events* ». **Le chat serait la seule porte HTTP du projet sans journal de requêtes**, à moins
d'activer les événements de données CloudTrail — qui sont facturés et dont rien n'existe aujourd'hui
dans ce dépôt. C'est un cas aveugle réel, et il est de même nature que l'API WebSocket de C, mais
plus petit : ici **les métriques existent** et les alarmes sont écrivables, alors que pour une API
WebSocket le §7.3 établit qu'il n'y a « ni alarme, ni widget, ni runbook ».

### C1.7 La couche de reprise, traduite en objets de ce dépôt

Le patron publié, ligne à ligne, et ce que chaque ligne devient ici.

| Le patron publié | Ce que ça devient dans ce dépôt |
|---|---|
| « *the generation keeps running server-side* » et « *client-side aborts are treated as disconnects* » | **Rien à écrire.** Deux fois acquis : la génération vit dans le worker SQS (B), et même le flux n'est pas interrompu par une rupture de connexion (« *streamed responses are not interrupted or stopped when the invoking client connection is broken* ») |
| « *Your persistence layer saves the `activeStreamId` in the chat data* » | **1 attribut** `active_stream_id` sur l'item `chat_conversations`, posé par le `POST …/turns` sous la même écriture conditionnelle `turn_count = :expected` que le §7.2, et effacé au scellement du tour. **0 objet nouveau** |
| « *When no active stream exists, the GET handler returns a 204 (No Content) status code* » | **1 route** `GET /api/chat/conversations/{id}/stream` sur la Function URL : lit l'item, **204** si `active_stream_id` est nul, sinon ouvre le SSE au fragment `seq = 0` et rejoue tout l'existant avant de suivre. C'est le rejeu complet, donc l'app qui revient au premier plan récupère **le texte déjà produit**, pas seulement la suite |
| « *comparing the client-sent value against the stored one prevents clobbering a newer stream* » | Le client renvoie l'`active_stream_id` qu'il connaît ; une valeur périmée reçoit un **409** et l'app repart d'un `GET` de la conversation. Même forme que `turn_in_flight` (§9.4) |
| « *Route cleanup is a disconnect, not an explicit stop* » | **1 route** `POST /api/chat/conversations/{id}/stop`, sur la **façade HTTP existante** et non sur la Function URL (elle ne streame rien) : elle scelle le tour avec le texte partiel déjà en tampon, passe le tour en `ready` avec un marqueur `stopped_by_user`, et efface `active_stream_id` **sous condition d'égalité**. Elle n'annule **pas** l'appel LLM en cours : on l'a payé, et l'arrêter n'économise rien (« *Customers are billed for the full function duration* »). **La V1 ne doit surtout pas l'appeler depuis un `useEffect` de démontage d'écran** — c'est l'erreur que le patron publié nomme explicitement |
| « *The `resumable-stream` package … Redis to store the UIMessage stream* » | Le seul endroit où le patron suppose une infrastructure. Traité en C1.8 |

Au total les cinq routes du §8.3 deviennent **sept** : les cinq inchangées, plus `GET …/stream` (sur
la Function URL) et `POST …/stop` (sur la façade).

### C1.8 Le tampon : Redis, ElastiCache ou DynamoDB — **DynamoDB, et de loin**

La question posée est : « l'item DynamoDB de conversation peut-il porter l'`activeStreamId` et le
texte partiel sans équivalent Redis ? » **L'`active_stream_id` : oui, trivialement. Le texte
partiel : oui, mais pas dans le même item**, et la raison est une règle de facturation :

> « *DynamoDB considers the size of the item as it appears before and after the update. The
> provisioned throughput consumed reflects the larger of these item sizes.* »

Un `UpdateItem` qui concatène un *delta* de 30 octets à un item de 20 Ko consomme **20 unités
d'écriture**, pas une. Écrire le flux *dans* l'item de conversation serait donc quadratique en
unités d'écriture, pour un item déjà borné à ~25 Ko par le plafond de 20 tours (§7.1). **La forme
correcte est un item par fragment**, et elle ne coûte **aucune table** : la table
`chat_conversations` a pour clés `user_id` et `conversation_id`, donc les fragments vivent dans la
même partition sous une clé de tri `"{conversation_id}#frag#{seq:06d}"`. Ils portent un attribut
`ttl_epoch` ; les items de conversation **n'en portent pas**, et « *If you use any other format, the
TTL processes ignore the item* » — donc activer le TTL sur cette table purge les fragments et ne
touche **jamais** une conversation. Les items expirés sont « *deleted at no cost* ».

**Le chiffrage, aux prix de M13, M14 et M15.** Hypothèses : une réponse de 500 tokens (§6.3) soit
~1 700 octets, une vidange toutes les 200 ms sur une génération de 10 s (**50 écritures** d'items
sous 1 Ko, donc 1 unité chacune), et un relais qui interroge la plage de fragments toutes les 250 ms
en lecture forte (**40 lectures** sous 4 Ko, 1 unité chacune).

| Poste | Par tour | Pour 1 200 tours/mois *(12 testeurs × 100)* |
|---|---|---|
| Tampon DynamoDB (50 WRU + 40 RRU) | **0,0000370 €** | 0,044 € |
| Relais Lambda ARM, 512 Mo × 15 s | **0,0000860 €** | 0,103 € |
| **Surcoût d'infrastructure de E** | **0,000123 €** | **0,148 €** |
| *Pour comparaison* : **ElastiCache Serverless Valkey, minimum facturé** (100 Mo × 0,098 $/Go-h × 730 h) | — | **6,15 €** |

Trois lectures de ce tableau, et la troisième est celle qui tranche :

1. Le surcoût par tour de E est **0,000123 €**, soit **11 %** du coût LLM d'un tour de chat caché à
   portée média sur `gpt-5.4-nano` (0,00115 €, §9.2) et **2 %** du même tour froid. Non nul, et sans
   conséquence.
2. **ElastiCache Serverless est le seul poste de ce dossier qui soit un coût fixe mensuel.** Son
   minimum facturé — 100 Mo de stockage, avant le premier ECPU — vaut **6,15 €/mois**, c'est-à-dire
   **44,7× la totalité de la dépense LLM du dépôt depuis sa création** (0,1377 €, §6.2) **par
   mois**, et **138×** ce que le tampon DynamoDB coûte au même volume.
3. Le §8.2 ne pouvait pas voir ça, parce qu'il compte des objets et non des euros — et c'est le seul
   endroit de tout ce dossier où le coût *est* un argument d'architecture : non parce qu'il est
   grand, mais parce qu'il est **fixe**. 6,15 € par mois pour servir 12 testeurs est la seule ligne
   du projet qui ne descendrait pas à zéro si personne n'ouvrait l'app.

**Verdict : pas de Redis, pas d'ElastiCache. Le tampon est une plage de clés de tri dans la table que
B crée déjà, plus un bloc `ttl` sur cette table — zéro objet AWS nouveau.** Le prix à payer est un
relais par interrogation plutôt que par publication/abonnement : **250 ms de retard au plus** sur un
texte qui s'écrit, ce qui est sous le seuil de perception d'un rendu de chat.

### C1.9 Le compte d'objets de E, au format du §8.3

| Objet | A | B | C | D | **E** |
|---|---|---|---|---|---|
| Tables DynamoDB | 1 | 1 | 3 | 1 | **1** *(la même que B ; les fragments y vivent)* |
| Index secondaires | 0 | 0 | 2 | 0 | **0** |
| Buckets S3 | 0 | 0 | 1 | 0 | **0** |
| Files SQS + DLQ | 0 | 0 | 2 | 0 | **0** *(celle de B, réutilisée)* |
| Lambdas (+ leur *log group*) | 0 | 0 | 2 | 0 | **2** *(1 fonction + 1 log group écrit à la main, C1.6)* |
| Portes d'entrée | 0 | 0 | 8 | 0 | **1** *(`aws_lambda_function_url`)* |
| `aws_lambda_permission` | 0 | 0 | 1 | 0 | **2** *(`InvokeFunctionUrl` + `InvokeFunction`, obligatoires depuis 10/2025)* |
| Politiques IAM | 0 | 0 | 1 | 0 | **0** *(rôle `lambda_worker` réutilisé — sur-privilégié, à noter dans le runbook)* |
| Filtres de métrique / alarmes | 1 | 0 | 1 | 0 | **2** *(`lambda_error_rate` et `lambda_throttles` écrites à la main)* |
| **Total AWS, à exploiter et à purger** | **2** | **1** | **21** | **1** | **8** |
| Magasins persistants hors AWS | 0 | 0 | 0 | 1 | **0** |
| Routes HTTP | 5 | 5 | 5 + 3 WS | 5 | **7** *(5 + `GET …/stream` + `POST …/stop`)* |
| Écrans mobiles | 1 | 1 | 1 | 1 | **1** |
| **Lignes que le §8.3 n'avait pas** | | | | | |
| `Dockerfile` et images livrées | = | = | = | = | **+1** *(troisième image, base non-AWS, uvicorn + LWA)* |
| Travaux de CI (`deploy-lambda.yml`) | = | = | = | = | **+2** *(1 construction, 1 déploiement : la boucle existante filtre sur `^media-summarizer-worker-`)* |
| Variables publiques mobiles (× profils EAS) | = | = | = | = | **+1** *(l'hôte `on.aws` ; 0 si CloudFront, qui coûte alors au moins 4 objets AWS)* |
| Parité d'alarmes avec la façade (latence, 5xx) | = | = | — | = | **+2 optionnelles** ; **journal d'accès : inexistant** |

**8 objets AWS**, à comparer à 1 pour B et 21 pour C. E n'est pas un demi-C : elle est **à mi-chemin
plus près de B**, et tout ce qu'elle ajoute a un propriétaire nommé — ce qui est la définition du
§8.1 — **sauf** le journal d'accès, qui n'existe pas.

### C1.10 Le coût de construction de E, au format du §10

Tout le §10.1 reste vrai **tel quel** ; ci-dessous, seulement le delta.

**Backend — étendu, en plus du §10.1**

| Fichier | Ce qu'on y ajoute |
|---|---|
| `media_summarizer/workers/artifact_generator/worker.py` | **le seul changement risqué de E.** `_call_llm` fait aujourd'hui un `await response.json()` unique ([worker.py:211-213](../../../media_summarizer/workers/artifact_generator/worker.py#L211)) sur une session `aiohttp` ([worker.py:169-170](../../../media_summarizer/workers/artifact_generator/worker.py#L169)). Il faut un second mode : `stream: true`, `stream_options: {"include_usage": true}`, une lecture ligne à ligne du SSE du fournisseur, un rappel qui écrit les fragments, et la lecture de l'`usage` sur le *chunk* qui précède `data: [DONE]`. **Ce fichier est le seul chemin d'appel LLM du dépôt**, partagé avec les artefacts et la traduction : le mode bufferisé doit rester le défaut et le mode flux ne doit être pris que sur un bloc `chat` |
| `media_summarizer/api/endpoints/chat.py` | `POST …/stop` : scellement du partiel sous condition d'égalité d'`active_stream_id` |
| `media_summarizer/core/services/chat_service.py` | pose et effacement d'`active_stream_id` ; écriture et relecture des fragments ; `ttl_epoch` sur les fragments |
| `media_summarizer/core/services/llm_pricing.py` | voir C3 : une **fonction en escalier** et un tarif d'écriture de cache |

**Backend — entièrement neuf, en plus du §10.1** : `media_summarizer/api/chat_stream_app.py` (une
application FastAPI minimale, **une seule route**, servie par uvicorn derrière le LWA — et non la
`main.py` complète, dont les `CRITICAL_ROUTES` et le démarrage n'ont rien à faire sur cette
fonction), et `media_summarizer/utils/chat_stream_buffer.py` (la plage de fragments).

**Terraform — entièrement neuf** : les 8 objets de C1.9, plus le bloc `ttl` sur
`chat_conversations_v1` et `reserved_concurrent_executions` sur la Lambda de chat. *Rien d'autre* :
pas de file, pas de bucket, pas d'API Gateway, pas de certificat, pas d'alias de fournisseur.

**Livraison** : `infrastructure/docker/lambda-chat-stream.Dockerfile`, et dans
`.github/workflows/deploy-lambda.yml` un travail `build-chat-stream` plus un bloc de déploiement par
*digest* sur le modèle des deux existants.

**Mobile — en plus du §10.1** : un lecteur de flux par `expo/fetch`
(`resp.body.getReader()` et `TextDecoderStream`, tous deux documentés comme présents en SDK 55, la
version du dépôt), la reprise par `GET …/stream` **sur le retour au premier plan**, la gestion du
**204**, et le repli sur le `GET` de conversation quand le flux ne s'ouvre pas. **Aucune dépendance
npm nouvelle** : c'est le fait mobile le plus favorable de tout ce complément, et il n'allait pas de
soi — une application React Native sans `expo/fetch` n'aurait pas pu lire un flux HTTP du tout.

**i18n** : les clés du §10.1, plus trois : « réponse interrompue », « reprise… », et le libellé du
bouton d'arrêt. **Onze catalogues** plus `pseudo.ts`.

### C1.11 Ce que E casse, et qu'il faut nommer

1. **Le flux supprime la validation après coup.** Aujourd'hui `_call_llm` rend la réponse entière et
   le générateur la **valide** avant de sceller, une sortie invalide valant `VALIDATION_ERROR` et
   trois tentatives (§9.4). **Un texte déjà streamé ne se retire pas.** Pour le chat il n'y a pas de
   schéma à valider, donc l'effet est faible — mais un 5xx du fournisseur au milieu d'un flux laisse
   à l'écran une demi-réponse que l'utilisateur a lue, là où B aurait affiché `failed` et réessayé.
   Atténuation : ne pas vider le tampon avant les 50 premiers tokens environ, et marquer le tour
   `partial_failed` plutôt que de prétendre qu'il est complet.
2. **La comptabilité du coût devient faillible.** L'`usage` arrive dans « *an additional chunk …
   streamed before the `data: [DONE]` message* » ; un flux interrompu côté fournisseur peut ne
   jamais le livrer, et `_read_llm_usage`
   ([worker.py:214-232](../../../media_summarizer/workers/artifact_generator/worker.py#L214))
   écrirait alors des zéros. `record_observed_cost` est de l'observabilité, pas de l'autorisation
   (§4.2), donc rien ne casse — mais le chiffre que l'owner lit pour comparer le modèle de
   consommation à la facture devient **sous-estimé sur les tours interrompus**, et c'est exactement
   le chiffre qui déclenche les tranches 2 et 3 du §12. À corriger par un repli : quand l'`usage`
   manque, estimer `prompt_tokens` par `estimate_tokens` et `completion_tokens` par la longueur du
   texte produit, et poser un marqueur `usage_estimated: true`.
3. **On paie la durée complète de la fonction.** Deux Lambdas vivent pendant la génération : le
   worker qui génère et le relais qui streame. Chiffré en C1.8 : 0,000123 € par tour. À l'échelle du
   projet, du bruit ; à écrire quand même, parce que le §6.3 affirmait que « la dépense LLM est
   identique dans les trois architectures candidates » et que E est la première à ajouter une
   dépense **hors LLM** non nulle.
4. **Un troisième artefact de livraison.** Trois images au lieu de deux, donc une troisième chose
   qui peut dériver. Le `Dockerfile` de l'API porte un commentaire de douze lignes sur la dérive
   qu'une résolution de dépendances non figée a déjà causée : le troisième doit copier la même
   discipline (`uv export --frozen`), et c'est le genre de détail qu'on copie mal.

---

## C2 — Repondération et reclassement des **cinq** candidates

### C2.1 Les deux pondérations, côte à côte

| Axe | §8.2 | **Owner** | Ce que le changement dit |
|---|---|---|---|
| 1. Objets persistants nouveaux | 30 % | **5 %** | Le §6.2 établit que le coût n'arbitre pas (0,1377 € depuis la création) ; l'owner ajoute que la sobriété non plus. L'axe reste, à son poids minimal : un objet créé reste à exploiter |
| 2. Réutilisation du déployé telle quelle | 20 % | **5 %** | Même raison, et c'est le corollaire du premier |
| 3. **Streaming** *(axe 3 du §8.2 redéfini)* | 20 % | **25 %** | Le §8.2 notait « ce que l'utilisateur ressent », où ne pas poller comptait autant que voir le texte s'écrire. **L'axe est redéfini** : le texte s'écrit-il sous les yeux de l'utilisateur, et à quel temps au premier octet. Les notes du §8.2 ne sont donc **pas** réutilisables sur cet axe, et le tableau 1 de C2.4 garde les notes publiées pour que le classement du README reste reproductible |
| 4. Comptage de la dépense | 10 % | **5 %** | Les cinq candidates s'y insèrent de façon voisine, l'axe discrimine peu — le §8.2 le disait déjà |
| 5. Ce qui resterait à jeter | 10 % | **5 %** | Rien n'est en magasin (`CLAUDE.md`) : c'est un volume de suppression, pas un risque |
| 6. Surface d'exploitation | 10 % | **10 %** | Inchangé : ce qui compte est le **cas aveugle**, et la robustesse demandée n'existe pas sans de quoi la constater |
| 7. **Robustesse de la reprise** *(nouveau)* | — | **25 %** | L'axe que la consigne demande, noté sur les scénarios qu'elle énumère (C2.2) |
| 8. **Qualité de génération et d'utilisation du contexte** *(nouveau)* | — | **20 %** | La troisième priorité de l'owner. Elle discrimine moins qu'on croit, et il faut le dire (C2.3) |

Somme : 5 + 5 + 25 + 5 + 5 + 10 + 25 + 20 = **100 %**. Les trois priorités de l'owner pèsent
**70 %**.

### C2.2 Axe 7 — la robustesse de la reprise, notée sur les scénarios de la consigne

| Scénario | **A** synchrone | **B** file *(déployé)* | **C** WebSocket | **D** état fournisseur | **E** B + SSE reprenable |
|---|---|---|---|---|---|
| **L'app passe en arrière-plan au milieu d'un tour** | La requête HTTP meurt avec elle. Rien n'est persisté, le LLM a été payé, **le tour est perdu** | Le *poll* s'arme et se désarme : `nextState !== "active"` donne `stop()`, et au retour `refetch()` puis `arm()` ([useProcessingRefresh.ts:218-228](../../../mobile/src/hooks/useProcessingRefresh.ts#L218)). Le tour s'est terminé côté serveur et est `ready` en base. **Mécanisme déployé, et écrit pour un bug de testeur réel** | La socket meurt ; il faut reconnecter, **plus** gérer les fermetures imposées à 10 min et 2 h, **plus** nettoyer le `connection_id` mort sur `GoneException` | Comme B | Comme B, **et mieux** : la génération ne s'arrête pas (« *not interrupted … when the invoking client connection is broken* »), les fragments sont persistés, et le retour au premier plan fait un `GET …/stream` qui **rejoue le texte déjà produit** |
| **Le flux meurt** (RAZ TCP, NAT opérateur) | Idem : perdu | Pas de flux à perdre | Reconnexion plus repli par *poll* **obligatoire** (§7.3) | Pas de flux | Le `GET …/stream` rejoue depuis `seq = 0` ; **204** si plus rien n'est actif |
| **La Lambda est recyclée, OOM, ou dépasse son timeout** | Perdu, et un dépassement de 30 s rend un **504** sur un tour déjà facturé | Le message est redélivré : `visibility_timeout = 1800` contre `timeout = 300`, `maxReceiveCount = 3`, puis DLQ ; le bail à 300 s empêche deux invocations de se chevaucher ([artifact_service.py:2140-2166](../../../media_summarizer/core/services/artifact_service.py#L2140)) | Comme B (file propre) | Comme B | **Comme B** pour le worker. Le **relais** peut mourir aussi : l'état est en base, donc le client re-`GET`. Aucune perte, une réouverture |
| **Le réseau tombe dans le métro deux minutes** | Perdu | Le budget du *poll* compte les **tentatives** et non les succès : un appareil hors ligne atteint la fin du budget et se pose sur le marqueur immobile, puis se réarme au premier plan ou au *pull-to-refresh* ([useProcessingRefresh.ts:1-54](../../../mobile/src/hooks/useProcessingRefresh.ts#L1)) | Boucle de reconnexion | Comme B | Comme B, plus le rejeu |
| **Le fournisseur rend un 5xx, ou un 429 avec `Retry-After`** | Échec synchrone ; l'utilisateur retape sa question | `TRANSIENT` donne 3 redélivrances ; un 429 nu est `PERMANENT + quota`, acquitté, et allume `llm-provider-refused` au seuil 0 ([llm_failure.py:210-259](../../../media_summarizer/utils/llm_failure.py#L210)) | Comme B | Comme B, **sauf** que `classify_llm_failure` est écrite sur les formes d'erreur de `chat/completions` ([llm_failure.py:113-154](../../../media_summarizer/utils/llm_failure.py#L113)) : un refus de la Responses API peut être **mal classé**, donc ne pas allumer l'alarme | Comme B, **sauf** si l'erreur arrive **après** le début du flux : une demi-réponse est déjà lue (C1.11) |
| **Note** | **1** | **9** | **6** | **5** | **10** |

**Pourquoi E a 10 et B a 9, et pourquoi ce n'est qu'un point.** Sur le *résultat*, les deux sont
équivalentes : aucun tour n'est jamais perdu dans aucun des cinq scénarios. La différence est la
**continuité visible** — E peut se rattacher au milieu d'une réponse et montrer ce qui existe déjà,
B ne peut montrer qu'une réponse finie ou un indicateur sans information, et après cinq minutes un
marqueur immobile sans information non plus. **Et le point de défiance qu'il faut écrire :** les
mécanismes de B sont tous déployés et ont été exercés par 128 générations réelles (§6.2) ; ceux de E
sont **conçus et non exercés** — un `active_stream_id` comparé sous condition, un *endpoint* d'arrêt
qu'il ne faut surtout pas appeler au démontage d'écran, un tampon à purger par TTL. La note mesure
le comportement **voulu**, comme l'axe le demande ; la confiance, elle, va dans l'autre sens.

### C2.3 Axe 8 — la qualité, et où elle discrimine réellement

Il serait facile — et faux — de faire de cet axe l'argument décisif. **À stratégie de contexte
égale, le modèle, le prompt et le corpus sont les mêmes dans A, B, D et E.** Ce que l'axe mesure est
ce que l'**architecture** interdit ou abîme :

| Candidate | Ce que l'architecture fait à la qualité | Note |
|---|---|---|
| **A** | Le plafond de **30 s non augmentable** est une contrainte de qualité déguisée : pour y tenir il faut borner le corpus *et* la sortie. Mesuré : 27,3 s pour 62 601 tokens d'entrée et 4 458 de sortie, 123,6 s au maximum observé (§5.2). Une réponse longue sur un gros corpus n'est pas « lente » : elle est **impossible** | **5** |
| **B** | Corpus complet, historique complet, mise en page corpus-d'abord, fragments d'instruction validés par task-316 (§11.2). Rien n'est retiré, rien n'est condensé — et le §6.4 montre que c'est aussi le moins cher | **10** |
| **C** | La seule qui **remplace le corpus par une récupération**. C'est une sélection de sous-ensemble, donc une rupture avec « refuser plutôt que tronquer » (§11.1), sur un index **lexical** choisi pour une barre de recherche (§13.1). La qualité devient celle du classement BM25, que personne n'a mesurée | **3** |
| **D** | L'historique vit chez le fournisseur ; ce qui est réellement dans la fenêtre dépend de ses décisions (chaînage, compaction). **Le prompt cesse d'être reproductible**, donc une mauvaise réponse cesse d'être diagnosticable | **6** |
| **E** | Celle de B, **moins** la validation après coup et la fiabilité du relevé d'`usage` (C1.11). Pour un texte de chat sans schéma, l'écart est petit — mais réel, et un demi-échec reste lu | **9** |

### C2.4 Les deux classements

**Tableau 1 — la pondération du §8.2, inchangée, étendue à E.** Les notes de A, B, C et D sont
celles du §8.5, reprises à l'identique ; E est notée sur les mêmes axes avec les mêmes définitions
(donc l'axe 3 reste « ce que l'utilisateur ressent », où E est la meilleure des cinq).

| Axe (poids §8.2) | A | B | C | D | **E** |
|---|---|---|---|---|---|
| 1. Objets nouveaux (30 %) | 8 | **10** | 1 | 6 | 4 |
| 2. Réutilisation telle quelle (20 %) | 6 | **10** | 6 | 8 | 7 |
| 3. Ressenti utilisateur (20 %) | 9 | 7 | 10 | 7 | **10** |
| 4. Comptage de la dépense (10 %) | **10** | **10** | 8 | 8 | 8 |
| 5. Ce qui resterait à jeter (10 %) | 9 | **10** | 2 | 5 | 6 |
| 6. Surface d'exploitation (10 %) | 6 | **10** | 3 | 7 | 6 |
| **Score** | **7,9** | **9,4** | **4,8** | **6,8** | **6,6** |
| **Rang** | 2 | **1** | 5 | 3 | 4 |

**Tableau 2 — la pondération de l'owner**, avec l'axe 3 redéfini en « streaming » et les deux axes
nouveaux.

| Axe (poids owner) | A | B | C | D | **E** |
|---|---|---|---|---|---|
| 1. Objets nouveaux (5 %) | 8 | **10** | 1 | 6 | 4 |
| 2. Réutilisation telle quelle (5 %) | 6 | **10** | 6 | 8 | 7 |
| 3. **Streaming** (25 %) | 3 | 2 | 9 | 2 | **8** |
| 4. Comptage de la dépense (5 %) | **10** | **10** | 8 | 8 | 8 |
| 5. Ce qui resterait à jeter (5 %) | 9 | **10** | 2 | 5 | 6 |
| 6. Surface d'exploitation (10 %) | 6 | **10** | 3 | 7 | 6 |
| 7. **Robustesse de la reprise** (25 %) | 1 | 9 | 6 | 5 | **10** |
| 8. **Qualité du contexte** (20 %) | 5 | **10** | 3 | 6 | 9 |
| **Score** | **4,25** | **5,75** | **5,50** | **5,00** | **8,15** |
| **Rang** | 5 | **2** | 3 | 4 | **1** |

**Les notes de l'axe 3, justifiées, parce que c'est celui qui bascule le classement.** A obtient 3 :
pas de flux, le premier octet *est* la réponse entière (médiane 6,3 s, p90 16,9 s sur 128 générations
réelles), et un plafond dur à 30 s. B obtient **2**, la plus basse des cinq, et c'est honnête : à
l'attente du worker s'ajoute la granularité du *poll*, soit **jusqu'à 3 s de plus** avant que quoi
que ce soit apparaisse. D obtient 2 : le §7.4 lui donne le transport de B. C obtient 9 : le texte
s'écrit token par token, mais sur un transport que ni le fournisseur ni le patron de référence
n'emploient, et avec deux fermetures imposées. **E obtient 8** : le texte s'écrit token par token sur
le transport canonique, moins un point pour le saut par la file et le retard de 250 ms au plus du
relais.

**Le temps au premier octet de E, borné par une mesure du dépôt et non par une estimation.** Un
appel LLM payant est interdit ici, donc le temps jusqu'au premier token du fournisseur n'est pas
mesurable. Mais le §5.2 contient la borne : **52 130 tokens d'entrée pour 78 tokens de sortie ont
pris 2,9 s de bout en bout**, file et démarrage à froid compris. Produire 78 tokens est
nécessairement *plus long* que produire le premier : **le premier octet de E arrive donc en moins de
2,9 s sur un corpus de 52 000 tokens.** À comparer aux 6 à 10 s que B met avant d'afficher quoi que
ce soit. **Le prix est connu — 8 objets AWS, une troisième image, une variable mobile — et ce qu'il
achète est connu : 3 à 7 secondes de « rien ne se passe », à chaque tour.**

### C2.5 La conclusion que l'owner a demandé qu'on ne flatte pas

1. **Sous la pondération de l'owner, E gagne, et largement : 8,15 contre 5,75.** Ce n'est pas un
   écart de nuance. E est première ou deuxième sur sept axes sur huit, et sa seule note faible
   (4 sur les objets nouveaux) pèse 5 %.
2. **B ne reste pas devant, et il faut le dire franchement.** Son avance au §8.5 venait d'un axe à
   30 % qui tombe à 5 %, et elle est **la plus mauvaise des cinq sur le streaming**. Un complément
   qui conclurait « B gagne quand même » serait un complément qui a renoté les axes pour retrouver
   sa réponse. B reste néanmoins **la seule candidate dans les deux premiers sous les deux
   pondérations** (1ʳᵉ au §8.2, 2ᵉ ici), et c'est le fait qui organise la suite.
3. **La préférence de l'owner pour le streaming ne valide pas C**, qui était la candidate
   « streaming » du README. C passe de 4,8 à 5,50 et reste **troisième** : son transport n'est pas
   celui que recommandent les bonnes pratiques (C1.0), rien ne le surveille, et sa récupération la
   met dernière sur l'axe de qualité que l'owner vient d'ajouter. **Le streaming ne coûte pas
   21 objets AWS ; il en coûte 8.** C'est le résultat de C1, et il déclasse C sous *toutes* les
   pondérations.

**Et le fait qui réconcilie les deux tableaux : E contient B, strictement.** E, c'est B — même table,
mêmes cinq routes, même file, même worker, même bail, même prompt, même barème — **plus** une Lambda,
une Function URL, deux routes, un tampon dans la table existante et un lecteur de flux côté mobile.
Aucune ligne de B n'est jetée par E ; le `GET` de conversation que B écrit **est** le repli
obligatoire de E, exactement comme le §10.3 l'avait établi pour C. Donc :

> **Recommandation de ce complément : viser E, et la construire en deux tranches dont la première
> est B à l'identique.** La tranche 1 du §12 ne change pas d'une ligne. Ce qui change est la
> tranche 5 : le streaming cesse d'être conditionné à « p90 > 25 s sur 200 tours » — un déclencheur
> de latence mesurée — et devient **la tranche 2, inconditionnelle**, parce que l'owner remplace ce
> déclencheur par un arbitrage produit. Les tranches « portée dossier » et « barème » glissent
> derrière.

La seule chose que l'owner doit trancher est donc : **livrer la tranche 1 sans flux et ajouter le
flux ensuite, ou attendre et livrer les deux ensemble.** Le coût de la première option est de montrer
une fois aux testeurs un chat qui ne streame pas. Son bénéfice est que les signaux chiffrés du §12 —
taux de cache, `turn_count`, latence par tour — existent **avant** qu'on écrive la couche de flux,
donc que son dimensionnement (quelle vidange, quel retard de relais, quel plafond de tours) se décide
sur des mesures et non sur les hypothèses de ce document.

---

## C3 — Rechiffrage sur les modèles à grande fenêtre, et la falaise des 272 000 tokens

### C3.0 Les chiffres de la consigne, revérifiés à la source

Tous confirmés le 2026-10-07 aux URLs de §0.2, **et trois faits s'ajoutent, qui ne sont pas dans la
consigne et qui changent le calcul** :

| | `gpt-5.4-nano` *(déployé)* | `gpt-6-luna` | `gpt-6.1-sol` |
|---|---|---|---|
| Entrée $/1M (≤ 272k) | 0,20 | **0,10** | 2,00 |
| Entrée en cache $/1M | 0,02 | **0,01** | 0,10 *(soit 0,05×, seul modèle dans ce cas)* |
| **Écriture de cache $/1M** | **aucune** *(« No additional cache-write charge » avant 5.6)* | **0,125** *(1,25×)* | **2,50** *(1,25×)* |
| Sortie $/1M | 1,25 | **0,50** | 10,00 |
| Au-delà de 272k | *n'existe pas* : 272 000 est un **plafond dur** | 0,20 / 0,02 / 0,25 / 0,75 | 4,00 / 0,20 / 5,00 / 15,00 |
| Contexte / entrée max / sortie max | 400 000 / **272 000** / 128 000 | 1 050 000 / **922 000** / 128 000 | 1 050 000 / **922 000** / 128 000 |
| Préfixe cachable minimal | « varies by request settings » | **1 024 tokens visibles** | 1 024 |
| `cached_tokens` rapporté | arrondi au multiple de **128** inférieur | **bord exact** | bord exact |
| Durée de vie du cache | `prompt_cache_retention`, défaut **`24h`** hors ZDR | **`prompt_cache_options.ttl`, seule valeur `30m`, qui est aussi le défaut** | `30m` |
| `reasoning_effort` | — | `none` jusqu'à `max`, défaut `medium` | `low` jusqu'à `max`, défaut `medium`, **`none` indisponible** |

**Les trois faits ajoutés, et leur portée.**

1. **`gpt-6-luna` est moins cher que le modèle déployé** : **2× moins** sur l'entrée (0,10 contre
   0,20), **2,5× moins** sur la sortie (0,50 contre 1,25), **2× moins** sur la lecture de cache.
   Passer à Luna **baisse** la facture tout en multipliant la fenêtre d'entrée par **3,4**. C'est le
   résultat le plus contre-intuitif de ce complément : la consigne annonçait « quitte à ce que ça
   coûte cher », et le modèle à grande fenêtre **coûte moins cher**.
2. **La famille 5.6+ facture l'écriture de cache à 1,25×**, là où `gpt-5.4-nano` ne la facture pas.
   Un premier tour froid sur Luna paie donc 0,125 $/1M et non 0,10. Modélisé ci-dessous.
3. **La rétention tombe de `24h` à `30m`, et il n'y a pas d'option.** Le §6.1 s'appuyait
   explicitement sur le défaut `24h` — « une conversation reprise le lendemain repaierait son corpus
   plein tarif » y était écarté parce que le défaut était `24h`. **Sur Luna, c'est le cas général** :
   « *for 30 minutes after its most recent write or reuse* ». Une conversation reprise après le
   déjeuner **repaie son corpus**, au tarif d'écriture de cache. Le §6.4 n'en est pas invalidé — le
   cache reste le seul levier d'un facteur 4 à 6 *à l'intérieur* d'une session — mais sa portée se
   réduit à la session, et le « régime avec cache » devient une **propriété du rythme de l'usage**
   et non de la configuration. À mesurer dans la tranche 1, par la même lecture
   `cached_tokens / prompt_tokens` que le §12 prévoit déjà.

### C3.1 Le modèle de coût du §6.3, rejoué sur Luna et Sol, avec la surcharge en escalier

Mêmes paramètres que le §6.3 : `I = 400`, `Q = 60`, `A = 500`, `USD_EUR = 0.86`, mise en page
corpus-d'abord, **aucune troncature**. Deux ajouts : les tokens frais sont facturés au tarif
**d'écriture de cache** sur la famille 5.6+ (le tarif d'écriture n'est pas additif — « *input tokens
use the uncached-input, cached-input, or cache-write rate* » — c'est l'un des trois), et la surcharge
est une **fonction en escalier** : dès que l'entrée **totale** du tour dépasse 272 000, **toute** la
requête bascule aux tarifs longs.

**Vérification de calibrage** : rejoué sur `gpt-5.4-nano`, le modèle reproduit le §6.3 au centième de
centime près (0,00397 / 0,02081 / 0,04402 / 0,09767 à portée média sans cache ; 0,02126 / 0,10725 /
0,21690 / 0,44343 au plafond dossier ; 0,00580 et 0,02309 pour le 20ᵉ tour du §9.2). Les colonnes
Luna et Sol sont donc directement comparables à celles du README.

| Scénario | Modèle | T1 | 5 tours | 10 tours | **20 tours** |
|---|---|---|---|---|---|
| **Média d'1 h (19 487 tok), froid** | nano | 0,00397 € | 0,02081 € | 0,04402 € | **0,09767 €** |
| | **luna** | **0,00236 €** | 0,01240 € | 0,02630 € | **0,05862 €** |
| | sol | 0,04719 € | 0,24797 € | 0,52604 € | 1,17248 € |
| **Média d'1 h, avec cache** | nano | 0,00397 € | 0,00793 € | 0,01311 € | **0,02418 €** |
| | **luna** | **0,00236 €** | 0,00418 € | 0,00655 € | **0,01167 €** |
| | sol | 0,04719 € | 0,07635 € | 0,11389 € | 0,19259 € |
| **Dossier au plafond (120 000 tok), froid** | nano | 0,02126 € | 0,10725 € | 0,21690 € | **0,44343 €** |
| | **luna** | **0,01316 €** | 0,06642 € | 0,13435 € | **0,27473 €** |
| | sol | 0,26329 € | 1,32849 € | 2,68707 € | 5,49454 € |
| **Dossier au plafond, avec cache** | nano | 0,02126 € | 0,03214 € | 0,04595 € | **0,07431 €** |
| | **luna** | **0,01316 €** | 0,01844 € | 0,02514 € | **0,03890 €** |
| | sol | 0,26329 € | 0,32703 € | 0,40779 € | 0,57293 € |
| **Bibliothèque la plus lourde de `-dev` (193 104 tok, M17), froid** | nano | 0,03383 € | 0,17012 € | 0,34264 € | 0,69491 € |
| | **luna** | **0,02102 €** | 0,10572 € | 0,21294 € | **0,43190 €** |
| | sol | 0,42046 € | 2,11435 € | 4,25881 € | 8,63801 € |
| **Même, avec cache** | nano | 0,03383 € | 0,04974 € | 0,06985 € | 0,11078 € |
| | **luna** | **0,02102 €** | 0,02881 € | 0,03866 € | **0,05870 €** |
| | sol | 0,42046 € | 0,50935 € | 0,62155 € | 0,84956 € |
| **Bucket `-dev` entier (672 515 tok) — *au-delà de la falaise*, froid** | nano | **hors fenêtre** | — | — | — |
| | **luna** | **0,14501 €** | 0,72626 € | 1,45554 € | **2,92312 €** |
| | sol | 2,90024 € | 14,52529 € | 29,11078 € | 58,46237 € |
| **Même, avec cache** | **luna** | 0,14501 € | 0,19314 € | 0,25352 € | **0,37500 €** |
| | sol | 2,90024 € | 3,39926 € | 4,02520 € | 5,28430 € |

Et le coût d'**un** tour de rang 20, qui est ce que le §9.2 compare au débit :

| | nano froid | nano cache | **luna froid** | **luna cache** | sol froid | sol cache |
|---|---|---|---|---|---|---|
| Média d'1 h | 0,00580 € | 0,00115 € | **0,00350 €** | **0,00053 €** | 0,07006 € | 0,00809 € |
| Dossier au plafond | 0,02309 € | 0,00288 € | **0,01431 €** | **0,00140 €** | 0,28617 € | 0,01673 € |

**Trois conclusions.**

1. **Luna améliore toutes les marges du §9.2 sans toucher au barème.** Le pire cas du §9.2 — média,
   tour 20, sans cache, marge ×1,15 — passe à **×1,90** (0,00664 € débité contre 0,00350 € dépensé).
   La prudence que le §9.2 avait dû acheter au prix d'une surfacturation ×5 à ×11 dans le régime
   favorable devient confortable dans **les deux** régimes. Le barème `max(1, ceil(S/5))` reste
   déployable, et la tranche 3 du §12 (desserrage) devient plus facile à atteindre.
2. **Sol est hors de proportion, et pas pour la raison qu'on croit.** 20 tours au plafond dossier
   avec cache : **0,57 €**, soit **4,1× la dépense LLM totale du dépôt depuis sa création**, pour une
   seule conversation. Ce n'est pas disqualifiant en soi — l'owner a écrit « quitte à ce que ça coûte
   cher » — mais Sol n'achète **aucune fenêtre de plus** que Luna (mêmes 922 000) ; il achète de la
   qualité de raisonnement, que ce benchmark **ne peut pas mesurer** sans appels payants. Décider
   Sol serait décider sans mesure, ce que le §13.2 a déjà nommé comme un benchmark distinct.
3. **La falaise est franchissable, et à 673 000 tokens elle coûte 0,145 € le tour sur le modèle le
   moins cher** — plus que tout ce que le dépôt a dépensé en LLM depuis sa création. C'est le seul
   endroit de ce complément où un chiffre de coût mérite d'entrer dans une décision.

### C3.2 Le vrai plafond est le seuil de 272 000, pas la fenêtre — et il est **plus bas** que 272 000

**Oui, et la consigne sous-estime la conséquence.** La surcharge s'applique « *for the full
request* » : elle ne taxe pas les tokens au-delà du seuil, elle **reprice la requête entière**. Le
coût n'est donc pas une pente qui se raidit, c'est une marche.

Mesurée sur Luna, premier tour, froid :

| Corpus `C` | Entrée totale | Coût du tour | En minutes-équivalent (0,00664 €/min) |
|---|---|---|---|
| 250 000 | 250 460 | 0,02714 € | 4,1 min |
| 260 900 | 261 360 | 0,02831 € | 4,3 min |
| **271 540** | **272 000** | **0,02945 €** | 4,4 min |
| **271 541** | **272 001** | **0,05890 €** | **8,9 min** |
| 280 000 | 280 460 | 0,06062 € | 9,1 min |
| 400 000 | 400 460 | 0,08642 € | 13,0 min |
| 672 515 | 672 975 | 0,14501 € | 21,8 min |
| 910 000 *(quasi plafond)* | 910 460 | 0,19607 € | 29,5 min |

**Un token de plus coûte 0,02945 €, c'est-à-dire autant que les 272 000 qui le précèdent.** Il n'y a
aucun régime où il est rationnel de se trouver juste au-dessus du seuil : à 272 001 tokens on paie le
prix de 544 000.

**Et la marche ne se franchit pas seulement en ouvrant la conversation : elle se franchit en
conversant.** L'entrée du tour *k* vaut `C + 400 + (k−1)×560 + 60`. Un corpus posé à 271 000 tokens
est sous le seuil au premier tour et **au-dessus dès le second**. Le plafond économique n'est donc pas
« corpus ≤ 272 000 » mais **« corpus + la croissance de toute la conversation ≤ 272 000 »** :

    plafond de corpus = 272 000 − [ I + 19×(Q+A) + Q ] = 272 000 − 11 100 = 260 900 tokens

C'est une forme de plafond que le dépôt n'a pas encore : **un plafond de corpus qui dépend du plafond
de tours.** Les deux constantes deviennent liées.

**Ce que ça impose à `MAX_FOLDER_CORPUS_TOKENS = 120_000`
([artifact_service.py:126](../../../media_summarizer/core/services/artifact_service.py#L126)).**

La consigne a raison de pointer l'estimateur : `estimate_tokens(byte_length) = byte_length /
BYTES_PER_TOKEN` avec `BYTES_PER_TOKEN = 3.4`
([artifact_service.py:129](../../../media_summarizer/core/services/artifact_service.py#L129),
[artifact_service.py:436-437](../../../media_summarizer/core/services/artifact_service.py#L436)), et
le commentaire du code dit lui-même pourquoi et à quel prix : « *`tiktoken` is not in the Lambda
image, so the corpus is measured in UTF-8 bytes and converted. ±10%, which the 2.3x margin to the
model's window absorbs* »
([artifact_service.py:127-129](../../../media_summarizer/core/services/artifact_service.py#L127)).
**Cette phrase cesse d'être vraie dès qu'on vise la marche**, parce que la marge n'est plus 2,3× mais
zéro : à 260 900 tokens affichés, une sous-estimation de 10 % met le tour réel à 287 000 et déclenche
la surcharge sur tout.

| Valeur | Ce qu'elle vaut | Verdict |
|---|---|---|
| 120 000 *(aujourd'hui)* | Dérivée de « 44 % de la fenêtre de 272 000 ». Sur Luna, 13 % de la fenêtre et 44 % du seuil de prix | **Le commentaire devient faux**, la valeur reste sûre |
| 260 900 | Le maximum exact qui garde le 20ᵉ tour sous la marche | **Trop haut** : aucune marge pour l'erreur de l'estimateur |
| **230 000** | 260 900 ÷ 1,10 (soit 237 181), arrondi à la baisse | **Recommandé.** Sûr sur Luna (le 20ᵉ tour reste sous 272 000 même si l'estimateur sous-estime de 10 %) **et** sur `gpt-5.4-nano`, où 230 000 + 11 100 = 241 100 < 272 000, le plafond dur |

**Mais la recommandation opérationnelle est de ne pas la bouger maintenant, et la raison est
mesurée.** `MAX_FOLDER_SOURCES = 25` est l'autre plafond, et c'est lui qui mord : à la médiane de
task-269 (4 622 tokens par source), 25 sources valent 115 550 tokens, donc 120 000 est atteint
presque exactement quand 25 sources le sont. Déplacer le plafond de tokens à 230 000 ne change donc
rien **sauf** pour un dossier de sources inhabituellement longues — et un dossier de 25 médias d'une
heure vaut 487 175 tokens, donc il reste refusé dans les deux cas. Autrement dit : avec la marche à
272 000 et 20 tours d'historique, 25 sources ne sont atteignables que si elles font **10 414 tokens
en moyenne au plus**, soit environ 32 minutes de parole chacune. Et le plus gros prompt jamais envoyé
sur `-dev` fait **62 601 tokens** (§6.2), soit 52 % du plafond actuel.

Donc, précisément : **changer le commentaire maintenant, la valeur quand le modèle change.** Les
constantes « dérivent de la fenêtre du modèle » dit le code
([artifact_service.py:120-124](../../../media_summarizer/core/services/artifact_service.py#L120)) ;
sur un modèle 5.6+ elles dérivent de la **marche de prix**, qui est plus basse que la fenêtre d'un
facteur 3,4, et d'un plafond de tours. C'est la phrase à écrire dans le code le jour du changement de
modèle, et c'est une tâche d'implémentation, pas une décision d'architecture.

### C3.3 Le §14.1 sur le TPM : l'angle mort est levé, et la direction prudente était la bonne

La ligne du §14.1 disait : « *Les tokens d'entrée servis par le cache comptent-ils plein dans le TPM ?
La documentation ne le dit pas.* » **Elle le dit maintenant**, et sans ambiguïté (consulté le
2026-10-07) :

> « *Yes. Cached input tokens still count toward tokens-per-minute limits.* »
> « *Prompt caching does not change how [rate limits] are calculated.* »

**Conséquence : aucune ligne du §9.4 ne change.** Le tableau comptait les tokens cachés **plein**
« direction prudente, faute de source » ; la source confirme que ce n'était pas de la prudence, c'est
le tarif. Les quatre pourcentages restent exacts : 10,2 % du TPM du palier 1 pour un premier tour à
portée média, 60,5 % pour un dossier au plafond, 121 % pour deux dossiers concurrents, 102 % pour dix
tours concurrents à portée média. Et la troisième conséquence du §9.4 — « une hypothèse est
assumée » — doit être **réécrite en fait établi** le jour où le README sera repris, sans que rien
d'autre bouge.

**Un fait nouveau s'y ajoute, et il va dans le mauvais sens pour la portée bibliothèque.** Un tour
sur la bibliothèque la plus lourde de `-dev` (193 104 tokens, M17) consomme **193 564 tokens
d'entrée**, soit **97 % du TPM d'un palier 1 à 200 000**. Un seul tour. Sur le bucket entier
(672 975 tokens), **336 %** : le tour serait refusé par la limite de débit avant d'être facturé, quel
que soit le modèle. **La portée bibliothèque est donc bornée par le TPM avant de l'être par la
fenêtre ou par le prix**, et les limites par palier ne sont pas lisibles depuis ce dépôt (§14.1).

### C3.4 La compaction côté fournisseur — **non**, et pour une raison que le §6.4 contient déjà

La compaction fait exactement ce que le §6.4 a mesuré et rejeté, mais côté serveur. Le guide de cache
le dit lui-même : elle « *replaces earlier conversation context with a shorter representation* », elle
« *can prevent reuse from the first changed token onward* », et « *the first request after compaction
may reuse less of the previous cache even when the conversation is logically the same* ». C'est la
définition d'une fenêtre glissante, et le §6.4 en a chiffré le prix dans ce dépôt : **+14 %** à
portée média et **+5 %** au plafond dossier, « parce que dès qu'on retire le tour le plus ancien, les
octets qui suivent le corpus changent, le préfixe cachable retombe au corpus seul ».

**Et ici c'est pire, pour une raison structurelle.** La compaction compacte « *earlier conversation
context* ». Dans la mise en page de ce dépôt, le contexte le plus ancien **est le corpus** : il est en
tête, par construction, et c'est ce qui le rend cachable
([corpus.py:111-135](../../../media_summarizer/workers/artifact_generator/generators/corpus.py#L111),
protégé par un commentaire explicite et par la décision de task-316 §1.2). Une compaction mordrait
donc d'abord sur **la seule chose que le projet a décidé de ne jamais tronquer** (task-269 : « *A
truncated artifact would claim to cover sources whose text never reached the model* »).

**L'arithmétique dit la même chose.** À 20 tours au plafond dossier, l'historique vaut 10 700 tokens
sur 131 100, soit **8,2 %** de l'entrée. Supprimer l'historique **en entier** économiserait au plus
8,2 % de l'entrée ; perdre le préfixe de corpus multiplie le terme dominant par **10** sur nano
(0,02 vers 0,20 $/1M) et par **10 à 12,5** sur Luna (0,01 vers 0,10, ou 0,125 au tarif d'écriture).
La phrase que la documentation revendique — « *fewer input tokens can still save money even when the
cache-hit rate falls* » — est vraie en général et **fausse dans ce régime**, parce que le terme
compacté représente 8 % du coût et le terme perdu 78 à 97 % (§6.4).

**Où elle serait vraie :** quand l'entrée dépasse la fenêtre du modèle, c'est-à-dire au-delà de
922 000 tokens sur Luna. Nous sommes à 14,2 % (dossier au plafond plus 20 tours), 20,9 %
(bibliothèque la plus lourde mesurée) et 73,0 % (bucket entier). **C'est un outil pour un régime où
le projet n'est pas**, et il ne faut pas le prendre par anticipation.

**Et ce qu'il coûterait, puisque la consigne le demande : le changement d'API, objection par
objection.** `context_management` et `compact_threshold` sont des paramètres de `POST /responses` ;
`/responses/compact` est un *endpoint* distinct. Le dépôt appelle `…/v1/chat/completions`
([worker.py:73-75](../../../media_summarizer/workers/artifact_generator/worker.py#L73)). Les quatre
objections du §7.4, réexaminées **quand on ne déporte pas l'état de la conversation** :

| Objection du §7.4 | Tient-elle encore ? |
|---|---|
| **1. Aucun gain de coût** — « *all previous input tokens for responses in the chain are billed as input tokens* » | **Non.** Elle vise le **chaînage** par `previous_response_id`. Si l'on envoie soi-même le tableau d'entrée à chaque tour, il n'y a pas de chaîne, et l'objection est hors sujet |
| **2. Des données utilisateur durables hors d'atteinte de l'effacement** — « *Conversation objects and items in them are not subject to the 30 day TTL* » | **Affaiblie, pas annulée.** Elle vise les objets `Conversation`, qu'on n'utiliserait pas. Restent les objets `Response` : « *saved for 30 days by default* », et « *You can disable this behavior by setting `store` to `false`* ». Donc : **tenable, à condition que `store: false` soit posé explicitement** — c'est-à-dire qu'un oubli de paramètre devient un manquement RGPD, ce que l'architecture actuelle ne permet pas |
| **3. Elle oblige à changer d'API, sur le seul chemin d'appel LLM du dépôt, donc sur les artefacts aussi** | **Tient entièrement, et devient la première.** `worker.py` est le seul chemin, partagé par cinq types d'artefacts et la traduction |
| **4. Incapable d'afficher une conversation sans le fournisseur** | **Non.** L'état reste local par hypothèse |
| *(ajoutée par le §7.4 sous « surface d'exploitation »)* **`classify_llm_failure` est écrite sur les formes d'erreur de `chat/completions`** ([llm_failure.py:113-154](../../../media_summarizer/utils/llm_failure.py#L113)) | **Tient, et c'est la plus coûteuse à vérifier** : derrière elle il y a `llm-provider-refused` au seuil 0, l'alarme écrite après l'incident du 2026-09-01 où « *every alarm in this module stayed OK* » ([llm_alerts.tf:1-23](../../../infrastructure/terraform/modules/platform/llm_alerts.tf#L1)). Un refus mal classé est un refus silencieux |

**Verdict : la conclusion du §6.4 ne change pas — pas de troncature, pas de résumé, pas d'étage de
condensation, et pas de compaction côté fournisseur non plus.** Deux des quatre objections à la
Responses API tombent quand l'état reste local, mais les deux qui restent sont les chères, et elles
ne seraient pas payées *pour la compaction*, qui n'apporte rien ici.

**Une nuance pour plus tard, et elle n'est pas de la compaction.** La Responses API redeviendrait un
sujet pour une autre raison : la page de `gpt-6-luna` dit que sur Chat Completions la *function
calling* ne marche « *only with `reasoning_effort` set to `none`* ». Si un jour un tour de chat doit
appeler un outil (chercher dans la bibliothèque, ouvrir un média), ce sera cette contrainte-là qui
forcera la décision, et pas la compaction. À noter dans le §13.2.

---

## C4 — La prémisse du §13.1 sur la portée bibliothèque, rouverte

### C4.1 La prémisse est fausse deux fois, et la correction va dans le sens de l'owner

Le §13.1 écrit : « le corpus entier de `-dev` vaut 672 515 tokens (M2), soit **2,5× la fenêtre
d'entrée** de 272 000 ». **M17 montre que ce chiffre n'est pas une bibliothèque.**

| Ce que mesure le chiffre | Tokens estimés |
|---|---|
| Le **bucket entier** : 326 objets, 2 286 551 octets — ce que M2 a mesuré et ce que le §13.1 a utilisé | 672 515 |
| …dont **variantes `.translated.`** (le même contenu dans une autre langue : un tour de chat n'en enverrait qu'une) | **66 170** |
| …dont objets qu'**aucun job ne référence plus** (99 clés distinctes référencées sur 326 objets présents) | le reste |
| **Les 99 transcripts effectivement référencés, tous comptes confondus** | **267 749** |
| **La bibliothèque du compte le plus lourd** (37 médias) | **193 104** |
| La deuxième (47 médias) | 71 887 |
| Les trois autres | 2 152, 572, 32 |

Donc deux erreurs qui se cumulent : le chiffre additionne **cinq comptes** et **compte deux fois** le
même contenu traduit. Corrigé, **la bibliothèque la plus lourde de `-dev` vaut 193 104 tokens
estimés** — c'est-à-dire :

- **71,0 % de la fenêtre d'entrée de `gpt-5.4-nano`**, le modèle déjà déployé. Elle **tient déjà**,
  sans changer de modèle, et avec de la place pour 20 tours d'historique (193 104 + 11 100 = 204 204,
  soit 75,1 % de 272 000) ;
- **20,9 % de la fenêtre d'entrée de Luna**, et **74 % du seuil de prix de 272 000** — donc **sous la
  marche**, sans surcharge ;
- **2,5× le plafond `MAX_FOLDER_CORPUS_TOKENS` actuel**, ce qui est le seul plafond qu'elle dépasse.

**La question n'est donc plus du tout celle que posait le §13.1.** « Avec quelle récupération » était
une question imposée par une impossibilité physique qui n'existe pas. La question de l'owner —
« récupération ou pas de récupération du tout » — est la bonne, et la réponse de coût est franche.

### C4.2 Le coût d'un tour sur toute la bibliothèque, à froid et en cache, surcharge comprise

| Corpus | Modèle | T1 froid | 20 tours cumulés, froid | 20 tours cumulés, avec cache | Surcharge au-delà de 272k ? |
|---|---|---|---|---|---|
| **193 104** *(bibliothèque la plus lourde, M17)* | **luna** | **0,02102 €** | **0,43190 €** | **0,05870 €** | non |
| | nano | 0,03383 € | 0,69491 € | 0,11078 € | non |
| | sol | 0,42046 € | 8,63801 € | 0,84956 € | non |
| **267 749** *(les 5 comptes de `-dev`, sans les traductions)* | luna | environ 0,0291 € | — | — | **non, mais à 1,6 % de la marche** |
| **672 515** *(le chiffre du §13.1)* | **luna** | **0,14501 €** | **2,92312 €** | **0,37500 €** | **oui : ×2 entrée et cache, ×1,5 sortie, sur toute la requête** |
| | sol | 2,90024 € | 58,46237 € | 5,28430 € | oui |

Trois repères pour lire ce tableau :

1. **Un tour sur la bibliothèque la plus lourde réellement mesurée coûte 0,021 € sur Luna** — soit
   **3,2 minutes-équivalent**, moins qu'un premier tour sur un dossier au plafond sur le modèle
   déployé (0,02126 €, §6.3). **La portée bibliothèque est économiquement accessible dès
   aujourd'hui**, sur le modèle le moins cher des trois.
2. **Un tour sur le chiffre du §13.1 coûte 0,145 €** — **plus que la totalité de la dépense LLM du
   dépôt depuis sa création** (0,1377 €, §6.2), et 21,8 minutes-équivalent, soit **36 % de
   l'allocation mensuelle entière d'un abonné Reader** pour une question.
3. Et la limite qui mord d'abord n'est ni la fenêtre ni le prix : **c'est le TPM** (C3.3). 193 564
   tokens d'entrée, c'est **97 % du TPM d'un palier 1**. Un seul tour de bibliothèque saturerait la
   minute du compte.

### C4.3 La qualité : une position argumentée, et elle ne survit pas à 73 %

La consigne demande une position, pas un chiffre, sur la question : la littérature du §14.2
disqualifie-t-elle le fait de remplir 73 % d'une fenêtre de 922 000 ? **Oui, et pour une raison qui
invalide la façon même de poser la question en pourcentage.**

**Le fait de méthode, et il est décisif.** Le rapport *Context Rot* (Chroma, 14 juillet 2025, 18
modèles) présente ses résultats **en longueur absolue d'entrée** — huit longueurs testées, des
*prompts* LongMemEval d'environ 113 000 tokens, jusqu'à 10 000 mots répétés — et **jamais en
pourcentage de la fenêtre**. Sa conclusion centrale est : « *models do not use their context
uniformly; instead, their performance grows increasingly unreliable as input length grows* », et
« *Across all experiments, model performance consistently degrades with increasing input length.* »
NoLiMa (ICML 2025) chiffre la même chose sur **13 modèles annonçant au moins 128K** : « *At 32K, for
instance, 11 models drop below 50% of their strong short-length baselines* », et GPT-4o « *from an
almost-perfect baseline of 99.3% to 69.7%* ».

**Donc la variable n'est pas le taux de remplissage, c'est le nombre de tokens.** Et dans cette
variable, le régime du §14.2 et celui que la consigne propose ne sont pas comparables :

| Régime | Tokens d'entrée | Ce que le §14.2 en disait | Ce que la littérature dit du nombre |
|---|---|---|---|
| Média d'1 h | 19 487 | « 7,2 % de la fenêtre », régime favorable | Sous les 32K où NoLiMa voit 11 modèles sur 13 passer sous la moitié de leur ligne de base |
| Dossier au plafond plus 20 tours | 131 100 | « 48,2 % », même ordre de marge que `MAX_FOLDER_CORPUS_TOKENS` | **4,1× les 32K.** Déjà dans la zone dégradée |
| Bibliothèque la plus lourde de `-dev` plus 20 tours | 204 204 | — | 6,4× les 32K |
| Bucket entier | 672 975 | « 73 % d'une fenêtre de 922 000 » | **21× les 32K**, et au-delà de toute longueur publiée |

**La conclusion du §14.2 — « le plafond est la réponse » — survit, mais son fondement change.** Elle
était justifiée par « on remplit peu la fenêtre » ; elle doit l'être par « on reste près du régime où
les modèles sont fiables ». Et le plafond qu'elle impose n'est **pas** 73 % de 922 000 : c'est un
nombre de tokens, et aucune publication ne donne ce nombre pour les modèles de 2026 — les deux
sources ci-dessus mesurent des modèles d'une génération antérieure. **Ce qui est établi est la forme
de la courbe (monotone décroissante en longueur absolue), pas sa position pour Luna.**

**Position, donc, en trois propositions.**

1. **Remplir 73 % d'une fenêtre de 922 000 n'est pas justifiable aujourd'hui.** Non parce que c'est
   trop en proportion, mais parce que 673 000 tokens est 21× la seule longueur pour laquelle on
   dispose d'un chiffre de dégradation, et que ce chiffre est « 11 modèles sur 13 sous la moitié de
   leur ligne de base ». Monter là sans mesure, c'est acheter une réponse plausible et
   invérifiable — et le §11.2 rappelle que la seule contrainte de qualité que task-316 a trouvée
   « qui marche » est `source_ref_instruction(required=True)`, c'est-à-dire **la vérifiabilité**.
   Une réponse tirée de 673 000 tokens est précisément celle dont on ne peut pas vérifier la source.
2. **Remplir 193 000 tokens — la bibliothèque la plus lourde réellement mesurée — est défendable,
   et testable.** C'est 1,6× ce que le dossier au plafond fait déjà avec 20 tours d'historique
   (131 100 tokens), régime que le projet s'apprête à servir. L'écart n'est pas un saut de nature.
3. **Le plafond à poser est donc un plafond de tokens, et le candidat est déjà dérivé en C3.2 :
   230 000.** Il a l'élégance d'avoir **deux** justifications indépendantes qui donnent le même
   ordre : la marche de prix à 272 000 moins la croissance de 20 tours moins 10 % d'erreur
   d'estimateur, et la volonté de ne pas s'éloigner davantage du régime mesuré de la littérature. Et
   il a une propriété que 120 000 n'a plus : **il est le même plafond pour un dossier et pour une
   bibliothèque**, donc la portée bibliothèque cesse d'être une architecture et devient une
   **troisième valeur d'`ArtifactScope`** sous le même plafond — ce que le §2.4 désignait comme le
   seul coût de cette portée.

### C4.4 Le benchmark distinct du §13.1 : **encore nécessaire, mais ce n'est plus le même**

**Il reste nécessaire**, et pour une raison qui a changé de camp. Le §13.1 le déclarait obligatoire
parce qu'« une passe unique est physiquement impossible sur une bibliothèque » : **cette raison est
tombée** (C4.1). Celle qui le rend nécessaire maintenant est l'inverse : la passe unique est
possible, elle est bon marché, et **personne ne sait à partir de quelle longueur elle cesse de
répondre correctement sur le corpus de ce projet**. C'est une question de qualité, elle ne se tranche
pas par de l'arithmétique, et le §13.1 avait déjà la bonne raison de ne pas la trancher : la mesurer
exige des appels LLM payants, que la tâche interdit.

**La question reformulée, telle qu'elle devrait figurer dans la tâche à créer :**

> **À partir de quelle longueur d'entrée, sur le corpus réel de ce projet, une réponse de chat ancrée
> sur le corpus complet cesse-t-elle d'être meilleure qu'une réponse ancrée sur un sous-ensemble
> récupéré — et une récupération est-elle alors nécessaire ?**

Ce n'est plus « quelle récupération ». Quatre conséquences pour le benchmark à venir, et la troisième
est celle qui change l'ordre des tranches du §12 :

1. **La première branche à évaluer est celle qui n'existait pas** : corpus complet sur un modèle à
   grande fenêtre, sans aucune récupération. C'est la branche la moins chère à construire — zéro
   objet nouveau, zéro index — et elle **garde le cache**, que la récupération détruit (§6.3 :
   0,10752 € contre 0,07431 € à 20 tours). Elle doit être la référence contre laquelle toute
   récupération se justifie, et non l'inverse.
2. **Le store de vecteurs n'est plus le sujet principal.** task-269 §12.3 l'avait nommé ainsi, et le
   §13.1 l'avait repris. Il redevient une option à comparer, à égalité avec « ne rien récupérer » et
   avec l'index Algolia lexical qui existe déjà et qui est gratuit au plan actuel.
3. **La portée bibliothèque n'a plus besoin d'attendre ce benchmark pour la tranche où elle est
   sûre.** Le §12 bloquait la tranche 4 derrière le §13.1. M17 montre que **les cinq bibliothèques
   de `-dev` tiennent sous 230 000 tokens**, y compris la plus lourde à 193 104. **La portée
   bibliothèque sous plafond de corpus — refus explicite au-delà, exactement comme un dossier
   (task-269, stratégie s1) — n'est plus une architecture nouvelle : c'est une troisième valeur
   d'`ArtifactScope` et une constante.** Ce qui reste bloqué derrière le benchmark est la
   bibliothèque **au-delà** du plafond, c'est-à-dire le seul cas qui exige une récupération.
4. **Et le déclencheur de la tranche 4 doit changer.** Le §12 le posait comme « ≥ 20 % des
   conversations de la tranche 2 portent un `source_count` ≥ 20 ». Le signal pertinent devient :
   **combien de comptes ont une bibliothèque au-dessus du plafond de corpus**, qui est une requête
   en lecture seule sur `processing_jobs` et le bucket de transcripts — exactement M17, rejouée. Sur
   `-dev` aujourd'hui : **zéro compte sur cinq.**

---

## 5. Ce que ce complément propose à l'owner de décider

Rien ici n'est une décision : le `README.md` reste la référence et son `owner_decision` est à
l'owner. Les quatre points qu'il peut maintenant trancher, et ce qui change selon le sens :

1. **L'architecture cible.** Sous sa pondération, **E — « B + SSE reprenable sur une Lambda Function
   URL » — gagne à 8,15 contre 5,75 pour B**, et C reste troisième malgré le poids donné au stream.
   S'il retient E, la conséquence pratique est petite : **la tranche 1 du §12 ne change pas d'une
   ligne**, parce que B est un sous-ensemble strict de E ; ce qui change est que **la tranche 5
   (streaming) devient la tranche 2 et cesse d'être conditionnelle**.
2. **Le modèle.** `gpt-6-luna` est **2× moins cher sur l'entrée et 2,5× moins sur la sortie** que
   `gpt-5.4-nano`, avec une fenêtre d'entrée **3,4× plus grande**, et il améliore toutes les marges
   du §9.2 (pire cas de ×1,15 à ×1,90). Deux contreparties à accepter explicitement : l'écriture de
   cache facturée 1,25× et **la rétention du cache qui tombe à 30 minutes sans option**, donc une
   conversation reprise plus tard repaie son corpus. Et `llm_pricing.py` doit devenir une **fonction
   en escalier** : aujourd'hui c'est un triplet plat par modèle, incapable d'exprimer la marche des
   272 000, et son repli est « le modèle le plus cher de la table »
   ([llm_pricing.py:22-34](../../../media_summarizer/core/services/llm_pricing.py#L22)) — donc y
   ajouter Sol déplacerait aussi le coût rapporté de tout modèle non listé.
3. **Les plafonds.** `MAX_FOLDER_CORPUS_TOKENS` devrait valoir **230 000** le jour où le modèle
   change — dérivé, non choisi : 272 000 moins la croissance de 20 tours moins 10 % d'erreur de
   l'estimateur à `byte_length / 3.4`. D'ici là, **seul le commentaire est à corriger** : la valeur
   de 120 000 reste sûre et c'est `MAX_FOLDER_SOURCES = 25` qui mord.
4. **La portée bibliothèque.** La prémisse du §13.1 est fausse : le corpus du compte le plus lourd de
   `-dev` vaut **193 104 tokens** et non 672 515, donc il **tient déjà** dans le modèle déployé. Le
   benchmark distinct reste nécessaire, mais sa question est désormais « corpus complet contre
   récupération sur un modèle à grande fenêtre », et la portée bibliothèque **sous plafond de
   corpus** n'a plus besoin de l'attendre.

**Ce que ce complément ne tranche pas, et qu'il ne faut pas lui faire dire.** Le temps réel jusqu'au
premier token du fournisseur (seule une borne supérieure mesurée est donnée, C2.4), la qualité
comparée de Luna et de Sol sur un Q&A ancré (§13.2 reste ouvert), le taux de hit du cache en régime
conversationnel sur une rétention de 30 minutes, et la longueur d'entrée à laquelle la qualité
décroche sur ce corpus (C4.4). Les quatre exigent des appels LLM payants, que la tâche interdit.

---

## 6. Sources de ce complément

**Externes**, toutes consultées le **2026-10-07** et détaillées ligne par ligne en §0.2 :

- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/guides/prompt-caching
- https://developers.openai.com/api/docs/guides/context-management
- https://developers.openai.com/api/docs/guides/conversation-state
- https://developers.openai.com/api/docs/api-reference/chat/create
- https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html
- https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html
- https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html
- https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html
- https://docs.aws.amazon.com/lambda/latest/dg/urls-monitoring.html
- https://docs.aws.amazon.com/lambda/latest/dg/furls-http-invoke-decision.html
- https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/read-write-operations.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/time-to-live-ttl-before-you-start.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html
- https://github.com/awslabs/aws-lambda-web-adapter
- la documentation du fournisseur Terraform AWS pour `aws_lambda_function_url`
  (fichier `website/docs/r/lambda_function_url.html.markdown` du dépôt `hashicorp/terraform-provider-aws`)
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- https://docs.expo.dev/versions/v55.0.0/sdk/expo/
- https://aws.amazon.com/elasticache/pricing/
- https://www.trychroma.com/research/context-rot *(publié le 14 juillet 2025)*
- https://arxiv.org/abs/2502.05167 *(NoLiMa, ICML 2025, v3 du 9 juillet 2025)*

**Internes** : le code et le Terraform cités ligne à ligne ci-dessus — `lambda_workers.tf`,
`lambda_api.tf`, `pipeline_alerts.tf`, `pipeline_dashboard.tf`, `llm_alerts.tf`, `sqs.tf`,
`worker.py`, `artifact_service.py`, `llm_pricing.py`, `llm_failure.py`,
`api/dependencies/auth.py`, `api/lambda_handler.py`, `generators/corpus.py`,
`infrastructure/docker/lambda-api.Dockerfile`, `.github/workflows/deploy-lambda.yml`,
`mobile/src/hooks/useProcessingRefresh.ts`, `mobile/src/constants/config.ts`,
`mobile/package.json`. Plus le `README.md` de ce répertoire, cité par section.

**Non consultées, délibérément** : `docs/research/task-427-ask-question-vs-chatbot/` dans son
intégralité, et les fichiers de backlog `task-427` et `task-428`.

**Mesures** : les six commandes AWS en lecture seule M13 à M18 de §0.1, toutes exécutées le
**2026-10-07** (`eu-west-3` pour les données, `us-east-1` pour l'API de tarification, profil
`second-brain-app`). **Aucun appel LLM payant n'a été émis, et aucun fichier source du dépôt n'a été
modifié.** Seuls des agrégats sont rapportés : aucun identifiant de compte utilisateur, aucune
adresse, aucun secret et aucune clé d'API n'apparaît dans ce document.
