---
owner_decision: pending   # pending | ok | abandoned | redo | more
---

# Benchmark : relais de l'outbox du chat et récupération des tours bloqués

## Owner Validation

**Decision**: _(à remplir par l'owner après relecture — texte libre décrivant la décision finale : accept recommandation X, reject parce que Y, accept with modifications Z, OU, si redo, les consignes précises de correction à intégrer au prochain passage)_
**Validated at**: _(date ISO à remplir par l'owner)_

---

## Recommendation

**Option A : envoi SQS direct par l'API juste après la transaction d'acceptation, plus un
balayeur planifié chaque minute qui rattrape les intentions restées `pending` et remplace les
tentatives au bail expiré.** Pas de flux DynamoDB, pas de Lambda de relais, pas de Pipe.

Pourquoi A plutôt qu'un relais par flux DynamoDB (B ou C) :

1. **Latence au premier octet.** A ajoute un `SendMessage` (quelques dizaines de ms) dans une
   requête API déjà ouverte et chaude. B et C ajoutent le délai de sondage du flux (4 sondages
   par seconde par shard, donc ~125 ms en moyenne, 250 ms au pire), la propagation du flux, et
   pour B l'invocation, voire le démarrage à froid, d'une Lambda de relais. AWS documente en
   plus des pics de plusieurs secondes de l'âge d'itérateur à chaque rotation ou division de
   shard (§3.2). Le Decision fait du streaming une priorité : c'est le critère qui tranche.
2. **Le balayeur est nécessaire dans toutes les options.** Les tentatives au bail expiré
   (Decision point 4) ne produisent aucune écriture : aucun flux ne les signale. Il faut donc
   un processus planifié qui les cherche, quelle que soit l'option d'expédition. Une fois ce
   balayeur en place, il couvre aussi l'unique trou de A (crash de l'API entre le commit et
   l'envoi). B et C ajoutent un second mécanisme sans retirer le balayeur.
3. **Moins d'objets AWS.** A : une Lambda de balayage, une règle planifiée, un index global
   secondaire épars, deux alarmes. B ajoute un flux sur la table, une Lambda de relais, son
   mapping de source et ses alarmes. C ajoute un flux, une Pipe, son rôle IAM et
   vraisemblablement un coût de lecture du flux (§3.3).
4. **Le consommateur est déjà idempotent.** `claim_attempt` (task-457) refuse une deuxième
   réclamation de la même tentative et une réclamation d'une tentative remplacée. Une
   livraison en double, quelle que soit sa source, ne produit ni deuxième réponse ni deuxième
   débit (§4).

Le cas défavorable de A est rare et borné : si l'API meurt entre le commit et l'envoi, le tour
démarre au passage suivant du balayeur, soit entre ~15 s et ~75 s plus tard avec les paramètres
proposés (§5.2). Le mobile voit pendant ce temps un tour `accepted` sans fragment ; il ne perd
rien.

**Réserve :** aucune latence n'a été mesurée sur `-dev` pour ce benchmark (lecture seule
imposée). Les chiffres de latence sont ceux de la documentation AWS et de mesures publiées par
des tiers. Les valeurs de bail et de cadence (§5.2) sont des paramètres à confirmer à
l'implémentation (task-465) puis par les tests E2E de l'owner.

Ce que la recommandation impose à la table et au Terraform : §6.

---

## 1. Point de départ

- **Décision de l'owner** (`docs/research/task-430-chatbot-architecture/README.md`, Owner
  Validation, 2026-10-10), point 4 : le tour accepté et son intention d'envoi sont enregistrés
  atomiquement, puis une outbox expédie l'intention vers la file de chat de façon idempotente ;
  prévoir la récupération des intentions non expédiées et des tentatives au bail expiré ; pas
  de deuxième réponse visible ni de deuxième débit ; pas de promesse « exactement une fois »
  côté LLM. Point 2 : la visibilité de 1 800 s des artefacts ne doit pas devenir la politique
  de reprise interactive du chat.
- **Socle livré par task-457** (`docs/CHAT_DATA_MODEL.md`) :
  - `accept_turn` écrit en une transaction la conversation, la question, la réponse vide, la
    tentative `queued` et l'intention `dispatch_intent` (`pending`), clé
    `CONV#<cid>#OUT#<attempt_id>`, sous la partition `user_id` du compte ;
  - `claim_attempt` fait passer la tentative de `queued` à `generating` avec un bail, et
    renvoie `False` sur une livraison en double ou une tentative remplacée ;
  - `replace_attempt` remplace une tentative `queued`, ou `generating` au bail expiré, par une
    nouvelle tentative **et une nouvelle intention** dans la même transaction ;
  - `seal_turn` accepte une tentative `queued` (« tour abandonné par le relais ») ;
  - `mark_intent_dispatched` fait passer l'intention de `pending` à `dispatched`.
  - Il n'y a **aucun index transverse aux comptes** : la clé de partition est `user_id`.
    Trouver « toutes les intentions en attente » ou « toutes les tentatives en cours » demande
    aujourd'hui un `Scan` complet.
- **Patterns déjà présents dans le dépôt** :
  - flux DynamoDB → Lambda : `lambda_media_lifecycle.tf` (`user_media`, `ReportBatchItemFailures`,
    `bisect_batch_on_function_error`, `maximum_record_age_in_seconds = 86400`) doublé d'une
    réconciliation quotidienne par règle EventBridge ;
  - balayeur planifié : `lambda_digest_scheduler.tf` (`aws_cloudwatch_event_rule` en `cron`) ;
  - alarmes : `pipeline_alerts.tf` (`dlq_depth` pour chaque DLQ de `local.queue_dlq_map`,
    `lambda_error_rate`, `lambda_throttles`, filtres de métriques sur les journaux).
- **Région** : `eu-west-3`. Les tarifs AWS publics ci-dessous sont ceux de `us-east-1` quand la
  page ne donne pas d'autre région ; l'écart avec Paris est de l'ordre de quelques pour cent et
  ne change aucune conclusion, tous les montants étant sous le dollar par mois.

## 2. Options comparées

| | Mécanisme d'expédition | Rattrapage des intentions non expédiées | Récupération des baux expirés |
|---|---|---|---|
| **A** | L'API envoie `SendMessage` juste après le commit de `accept_turn`, puis `mark_intent_dispatched` | Balayeur planifié (1 min) sur un index épars des intentions `pending` plus vieilles qu'un seuil | Même balayeur, sur les tentatives en cours |
| **B** | Flux DynamoDB → Lambda de relais (filtre `INSERT` de `kind = dispatch_intent`) → `SendMessage` → `mark_intent_dispatched` | Réessais du mapping (jusqu'à 24 h), puis balayeur | Balayeur (le flux ne voit pas un bail qui expire) |
| **C** | Flux DynamoDB → EventBridge Pipes → SQS (sans code) | Réessais de la Pipe, puis balayeur ; l'intention ne peut pas être marquée `dispatched` par la Pipe (pas de code) : c'est le worker qui la marque à la réclamation | Balayeur |
| **D** | Flux DynamoDB → Kinesis Data Streams for DynamoDB → consommateur | Comme B | Balayeur |
| **E** | API avec file FIFO et `MessageDeduplicationId = attempt_id` | Balayeur | Balayeur |

D et E sont écartées tôt (§3.4, §3.5) ; le comparatif détaillé porte sur A, B et C.

## 3. Faits par option

Sources consultées le 2026-10-10.

### 3.1 Option A — envoi direct + balayeur

- **Latence ajoutée** : un appel `SendMessage` après le commit, dans la Lambda API déjà
  chaude. Le dépôt envoie déjà vers SQS depuis l'API (`media_summarizer/utils/sqs.py`,
  utilisé par `artifact_service.py`, `media_submission.py`…), donc sans nouveau client ni
  nouvelle permission de principe. Ordre de grandeur : quelques dizaines de millisecondes
  pour un appel SQS dans la même région (non mesuré ici, lecture seule imposée sur `-dev`).
  Le message est ensuite reçu par le mapping SQS → Lambda du worker de chat, commun à toutes
  les options.
- **Objets AWS nouveaux** : une Lambda de balayage (zip ou image workers), une règle planifiée,
  un GSI épars sur la table `chat`, une permission `sqs:SendMessage` sur la file de chat pour
  le rôle API et le rôle du balayeur, deux alarmes.
- **Coût fixe mensuel** : la règle planifiée tourne 43 200 fois par mois (1/min). EventBridge
  Scheduler offre 14 millions d'invocations gratuites par mois puis 1 $/million
  ([tarifs EventBridge](https://aws.amazon.com/eventbridge/pricing/)), donc 0 $ à ce volume ;
  le dépôt utilise aujourd'hui des règles `aws_cloudwatch_event_rule` (la page de tarifs ne
  les chiffre pas séparément, et le dépôt en déclenche déjà 96 par jour pour le digest sans
  coût notable). 43 200 invocations
  Lambda de ~0,3 s à 256 Mo font ~3 200 Go-s, sous le palier gratuit Lambda. Les requêtes
  `Query` du balayeur sur un GSI presque vide coûtent ~43 200 unités de lecture par mois,
  soit quelques centimes. **Coût fixe : de l'ordre de 0 à 0,10 $ par mois.**
- **Garantie** : au moins une fois. L'intention est durable avant tout envoi ; si l'envoi
  échoue ou n'a pas lieu, elle reste `pending` et le balayeur la reprend.
- **Ordre** : sans objet. Une conversation n'a qu'une génération active
  (`attribute_not_exists(active_attempt_id)` dans `accept_turn`).

### 3.2 Option B — flux DynamoDB → Lambda de relais

- **Sondage** : « Lambda polls shards in your DynamoDB stream for records at a base rate of 4
  times per second » ; par défaut la fonction est invoquée dès que des enregistrements sont
  disponibles ([Lambda + DynamoDB](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html)).
  Délai de sondage : ~125 ms en moyenne, 250 ms au pire, avant toute invocation.
- **Pics documentés** : « shard rollovers and splits can introduce increased iterator-age
  latency due to the time required for Lambda to perform shard discovery […] a process that
  can take several seconds » ([AWS Database Blog](https://aws.amazon.com/blogs/database/build-scalable-event-driven-architectures-with-amazon-dynamodb-and-aws-lambda)).
  Un expert AWS sur re:Post attribue des pics intermittents à une rotation des shards toutes
  les quatre heures, atténués depuis le `ShardFilter`
  ([re:Post](https://repost.aws/questions/QUl1rOSJHZT1SF3uL-rfw24A/dynamodb-streams-iterator-age-spikes-despite-healthy-lambda-shard-rebalancing-issue)).
  Kraken rapporte un âge d'itérateur moyen par minute dépassant souvent 50 s sur deux jours
  ([Kraken Engineering, 2024-05-13](https://engineering.kraken.tech/news/2024/05/13/stream-consumer-performance.html)).
  Aucun benchmark rigoureux publié ne donne de P50/P99 de bout en bout.
- **Démarrage à froid** : la Lambda de relais n'est invoquée qu'à chaque tour ; à faible trafic
  elle sera souvent froide. Une image conteneur (comme les workers du dépôt) démarre plus
  lentement qu'un zip ; un relais en zip minimal limite ce coût mais ajoute un artefact de
  déploiement différent de ceux du dépôt.
- **Garanties** : chaque enregistrement apparaît exactement une fois dans le flux, dans l'ordre
  des modifications par élément ([DynamoDB Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html)) ;
  mais le mapping traite « each event at least once, and duplicate processing of records can
  occur » ([Lambda + DynamoDB](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html)).
  Rétention 24 h. Au-delà, l'enregistrement est perdu pour le relais : le balayeur reste
  indispensable.
- **Démarrage du mapping** : à la création ou la mise à jour, le sondage peut mettre plusieurs
  minutes à démarrer ; avec `LATEST`, des événements peuvent être manqués
  ([Lambda + DynamoDB](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html)). Le mapping
  du dépôt (`media_lifecycle_stream`) est en `LATEST`.
- **Coût** : « GetRecords calls made through DynamoDB triggers on AWS Lambda aren't charged »
  ([tarifs DynamoDB on-demand](https://aws.amazon.com/dynamodb/pricing/on-demand/)). Coût fixe
  ≈ 0 $ ; coût variable : une invocation Lambda par écriture filtrée.
- **Effet sur la table** : activer un flux (`stream_enabled`, `NEW_IMAGE`). Toutes les écritures
  de la table — y compris chaque fragment de réponse en flux — passent dans le flux ; le filtre
  du mapping écarte celles qui ne sont pas des intentions, mais le flux les porte. Désactiver
  puis réactiver un flux crée un nouvel ARN.
- **Objets AWS nouveaux** : flux, Lambda de relais, mapping, journaux, alarmes — **en plus** du
  balayeur.

### 3.3 Option C — flux DynamoDB → EventBridge Pipes → SQS

- **Sondage** : « EventBridge polls shards in your DynamoDB stream for records at a base rate of
  four times per second » ; même comportement de lot que Lambda
  ([Pipes + DynamoDB](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-dynamodb.html)).
  Pas d'invocation Lambda, donc pas de démarrage à froid côté relais ; les pics de découverte
  de shards du flux s'appliquent de la même façon.
- **Mesure publiée** : un benchmark AppSync → DynamoDB → flux → EventBridge → SQS mesure
  ~211 ms de moyenne côté serveur et ~288 ms de bout en bout, en moyenne seulement, sans
  percentile ([DEV Community, 2024-05-10](https://dev.to/aws-builders/evaluating-performance-a-benchmark-study-of-serverless-solutions-for-message-delivery-to-1c8k)).
- **Garantie** : « The pipe will deliver the stream records from DynamoDB to Amazon SQS at least
  once » ; AWS recommande une politique de réessai à âge maximal inférieur à la rétention de
  24 h ([Pipes + DynamoDB](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-dynamodb.html)).
- **Fragilité opérationnelle** : « Disabling a DynamoDB stream that is the source of a pipe
  results in that pipe becoming unusable, even if you then re-enable the stream »
  ([même page](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-dynamodb.html)).
- **Coût** : 0,40 $ par million de requêtes après filtrage, chaque tranche de 64 Ko comptant
  pour une requête ([tarifs EventBridge](https://aws.amazon.com/eventbridge/pricing/)).
  La gratuité des `GetRecords` n'est écrite que pour les déclencheurs Lambda
  ([tarifs DynamoDB](https://aws.amazon.com/dynamodb/pricing/on-demand/)) ; pour une Pipe, la
  documentation ne dit rien. **Hypothèse défavorable non confirmée** : si les sondages de la
  Pipe sont facturés au tarif des lectures de flux (0,02 $ par 100 000, 2,5 millions gratuits
  par mois), 4 sondages/s sur un shard font ~10,4 millions de lectures par mois, soit ~1,6 $
  par mois et par shard, à vide.
- **Limite fonctionnelle** : la Pipe n'exécute pas de code, elle ne peut pas appeler
  `mark_intent_dispatched`. L'intention resterait `pending` jusqu'à ce que le worker la marque
  à la réclamation, ce qui brouille la distinction « jamais expédiée » / « expédiée mais pas
  encore réclamée » dont le balayeur a besoin.
- **Objets AWS nouveaux** : flux, Pipe, rôle IAM de la Pipe, journaux de la Pipe, alarmes sur
  ses métriques (`ExecutionFailed`, `TargetStageFailed`…) — **en plus** du balayeur.

### 3.4 Option D — Kinesis Data Streams for DynamoDB (écartée)

Le guide prescriptif AWS montre l'outbox par CDC via un flux Kinesis
([Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)).
Un flux Kinesis coûte 0,015 $ par shard-heure en provisionné (~11 $/mois pour un shard) ou
0,04 $ par flux-heure en on-demand (~29 $/mois)
([tarifs Kinesis](https://aws.amazon.com/kinesis/data-streams/pricing/)), pour une latence qui
n'est pas meilleure que celle de DynamoDB Streams. Le complément C1.8 de task-430 a établi
qu'à cette échelle seul le coût fixe compte : écartée.

### 3.5 Option E — file FIFO avec déduplication (écartée)

Une file FIFO déduplique les envois de même `MessageDeduplicationId` pendant 5 minutes
([SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/using-messagededuplicationid-property.html)),
ce qui absorberait un double envoi API + balayeur. Mais la fenêtre est de 5 minutes seulement,
les files FIFO ne supportent pas les délais par message
([minuteurs SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-message-timers.html)),
le lot maximal du mapping est de 10 et l'ordre par groupe n'apporte rien (une seule génération
active par conversation). Surtout, la déduplication par le consommateur existe déjà
(`claim_attempt`) et elle est nécessaire de toute façon pour les redélivrances SQS après crash.
Écartée : file standard, comme les autres files du dépôt.

## 4. Points de crash et ce que fait le consommateur

Le consommateur est le worker de chat (task-463). Pour toutes les options, sa première écriture
est `claim_attempt(attempt_id)`. Elle échoue (renvoie `False`) si la tentative n'est plus
`queued` : déjà réclamée (doublon), remplacée (`superseded`) ou scellée. Dans ce cas le worker
acquitte le message **sans appeler le fournisseur**. Le débit de quota est porté par le tour à
son acceptation (task-462, un débit par tour logique) : ni la redélivrance, ni le remplacement
d'une tentative ne débitent.

| Point de crash | A | B | C |
|---|---|---|---|
| Transaction refusée ou annulée | Rien n'est envoyé : l'envoi suit le commit | Pas d'écriture, pas d'enregistrement de flux | Idem B |
| Après le commit, avant l'envoi | L'intention reste `pending` ; le balayeur l'envoie au passage suivant | Le flux porte l'enregistrement ; le relais l'envoie | La Pipe l'envoie |
| Après l'envoi, avant `mark_intent_dispatched` | Le balayeur peut renvoyer : doublon absorbé par `claim_attempt` | Le mapping réessaie le lot : doublon absorbé | Sans objet (pas de marquage) |
| Relais ou flux en panne prolongée | Sans objet | Réessais jusqu'à 24 h, puis le balayeur rattrape | Idem B ; une Pipe dont le flux est désactivé est perdue |
| Message SQS reçu, worker mort avant `claim_attempt` | Redélivrance après la visibilité ; entre-temps, le balayeur voit une tentative `queued` dont l'intention est expédiée depuis trop longtemps et la remplace | Idem | Idem, mais le balayeur ne peut pas distinguer « expédiée » de « jamais expédiée » |
| Worker mort pendant la génération (après `claim_attempt`) | Le bail expire ; le balayeur appelle `replace_attempt` (nouvelle tentative, nouvelle intention, réponse vide) ; la redélivrance SQS ultérieure de l'ancien message trouve une tentative `superseded` et s'acquitte | Idem | Idem |
| Redélivrance SQS d'un message déjà traité | `claim_attempt` refuse ; acquittement | Idem | Idem |

Ce qui reste possible, conformément au Decision : un crash après l'appel au fournisseur suivi
d'un remplacement produit un **nouvel appel LLM**. Il n'y a pas de deuxième réponse visible
(les fragments de l'ancienne tentative sont rangés sous son `attempt_id` et ne sont plus
servis ; ses écritures échouent sur la clôture `status = generating`), ni de deuxième débit de
quota, mais il y a un deuxième coût fournisseur.

## 5. Récupération des tentatives au bail expiré

### 5.1 Pourquoi ce n'est pas la redélivrance SQS

AWS recommande une visibilité de file au moins six fois supérieure au délai de la fonction
([Lambda + SQS](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html)).
Une génération longue (jusqu'à 32 000 tokens de sortie) impose un délai de fonction de
plusieurs minutes, donc une visibilité de l'ordre de la demi-heure : exactement ce que le
Decision point 2 interdit comme politique de reprise interactive. La reprise passe donc par le
**bail** porté par la tentative (`lease_expires_at`, renouvelé par `renew_attempt_lease`), et
c'est le balayeur qui agit. La redélivrance SQS n'est qu'un filet ; quand elle arrive, la
tentative est déjà remplacée et le message est acquitté.

### 5.2 Le balayeur

- **Déclencheur** : règle planifiée toutes les minutes (granularité minimale des planifications
  EventBridge, qui invoquent leur cible « with 60 second precision »,
  [Scheduler](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html)).
  Pour descendre sous la minute, deux options documentées sans coût fixe notable : boucler
  dans une même invocation (par exemple quatre passages espacés de 15 s), ou s'appuyer sur un
  message SQS différé (minuteur jusqu'à 15 minutes,
  [minuteurs SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-message-timers.html))
  posé au moment de la réclamation. **Recommandé pour commencer : une passe par minute** ; le
  cas nominal (pas de crash) n'en dépend pas.
- **Ce qu'il cherche**, via un GSI épars (§6) :
  1. les intentions `pending` plus vieilles que **15 s** (seuil qui laisse à l'API le temps
     d'envoyer elle-même et évite la course API/balayeur dans le cas nominal) → `SendMessage`
     puis `mark_intent_dispatched` ;
  2. les tentatives `queued` dont l'intention est `dispatched` depuis plus de **60 s** sans
     réclamation (message perdu dans la DLQ, worker étranglé) → `replace_attempt` ;
  3. les tentatives `generating` dont `lease_expires_at < now` → `replace_attempt`.
- **Borne** : au-delà de N tentatives par tour (proposition : 3, soit `attempt_count`), le
  balayeur scelle le tour en `failed` avec `seal_turn` au lieu de le remplacer. Une tentative
  qui avait déjà émis du texte relève de `interrupted` / `provider_error` selon les règles de
  task-457 ; le choix exact entre « remplacer » et « sceller interrompu » quand des fragments
  existent appartient à task-463/465 (Decision point 6 : un partiel reste identifiable, une
  nouvelle tentative ne s'y concatène jamais).
- **Valeurs de bail proposées** (à confirmer par task-463/465) : bail de 30 s renouvelé toutes
  les 10 s. Délai de reprise dans le pire cas ≈ bail restant + jusqu'à 60 s d'attente du
  balayeur + démarrage de la nouvelle tentative, soit ~1 à 1,5 min ; contre ~30 min avec la
  visibilité des artefacts.
- **Concurrence** : la règle peut se chevaucher si une passe dépasse la minute ; chaque action
  du balayeur est une écriture conditionnelle de task-457 (`replace_attempt` exige
  `queued` ou un bail expiré, `mark_intent_dispatched` exige `pending`), donc deux passes
  concurrentes ne font jamais deux remplacements. Une concurrence réservée à 1 évite même la
  course.

## 6. Ce que la recommandation impose

### 6.1 Table `chat`

- **Un GSI épars** (ajoutable sans recréer la table, contrairement au LSI) :
  - nom proposé `chat-recovery-index` ;
  - clé de partition `recovery_bucket` (une valeur constante, par exemple `"due"` ; à cette
    échelle une seule partition d'index suffit largement, et la valeur peut être fragmentée
    plus tard) ;
  - clé de tri `recovery_due_at` (ISO-8601 UTC, même format que le reste de la table) ;
  - projection `KEYS_ONLY` : le balayeur relit chaque candidat en lecture fortement cohérente
    sur la table de base (un GSI est à cohérence éventuelle), et le renouvellement du bail ne
    réécrit pas l'index tant que `recovery_due_at` ne bouge pas.
- **Qui porte ces attributs** :
  - intention : posés par `accept_turn` / `replace_attempt` (`recovery_due_at = created_at +
    15 s`), **retirés** par `mark_intent_dispatched` ;
  - tentative : posés à la création (`queued`, échéance = `created_at + 60 s`), déplacés par
    `claim_attempt` vers l'échéance du bail, **retirés** par `seal_turn` et par le passage à
    `superseded`. Option à trancher à l'implémentation : déplacer l'échéance à chaque
    renouvellement (deux écritures d'index par renouvellement, coût négligeable) ou laisser
    une échéance grossière et filtrer sur `lease_expires_at` après relecture.
- `replace_attempt`, `claim_attempt`, `seal_turn` et `mark_intent_dispatched` sont dans
  `utils/chat_db.py` : les attributs s'y ajoutent sans changer leurs conditions.
- **Pas de flux DynamoDB** sur la table.

### 6.2 Terraform

- `dynamodb_chat_tables.tf` : attributs `recovery_bucket` / `recovery_due_at` et le
  `global_secondary_index`.
- Une Lambda de balayage (image workers, sur le modèle de `lambda_digest_scheduler.tf`), sa
  règle `aws_cloudwatch_event_rule` en `rate(1 minute)`, sa cible et sa permission, son groupe
  de journaux, une concurrence réservée de 1.
- IAM : `sqs:SendMessage` sur la file de chat pour le rôle de l'API et pour celui du balayeur ;
  `dynamodb:Query` sur l'index ; les écritures conditionnelles déjà accordées par task-457.
- Alarmes, sur le modèle de `pipeline_alerts.tf` :
  - la DLQ de chat entre dans `local.queue_dlq_map` (alarme `dlq_depth` existante) ;
  - `lambda_error_rate` et `lambda_throttles` couvrent la Lambda de balayage si elle est
    déclarée comme les autres ;
  - deux métriques émises par le balayeur, chacune avec une alarme à seuil > 0 sur 5 min :
    `ChatIntentsRecovered` (une intention que l'API n'a pas envoyée : signe d'un crash ou d'une
    erreur SQS côté API) et `ChatAttemptsReplaced` (bail expiré ou tentative jamais réclamée).
    Une troisième, `ChatTurnsAbandoned` (borne de tentatives atteinte), en sévérité haute.

## 7. Comparatif final

| Critère | A — direct + balayeur | B — flux + Lambda | C — flux + Pipe |
|---|---|---|---|
| Latence ajoutée, cas nominal | ~1 appel SQS (dizaines de ms) | sondage ~125 ms moyen + invocation (+ démarrage à froid) | sondage ~125 ms moyen ; ~288 ms de bout en bout mesurés par un tiers (moyenne) |
| Latence, queue de distribution | Crash API seulement : 15 à 75 s | Pics de plusieurs secondes à la découverte de shards | Idem B |
| Objets AWS nouveaux | GSI, Lambda de balayage, règle, 2-3 alarmes | A **+** flux, Lambda de relais, mapping | A **+** flux, Pipe, rôle IAM |
| Coût fixe mensuel | ~0 à 0,10 $ | ~0 à 0,10 $ (lectures de flux gratuites pour Lambda) | ~0 à 0,10 $, plus ~1,6 $/shard si les sondages de la Pipe sont facturés (non confirmé) |
| Doublons | Absorbés par `claim_attempt` | Idem | Idem |
| Marquage `dispatched` | Oui (API et balayeur) | Oui (relais) | Non (pas de code) |
| Observabilité | Métriques du balayeur, DLQ | + âge d'itérateur, erreurs du relais | + métriques de la Pipe |
| Effet sur la table | GSI épars | GSI épars + flux | GSI épars + flux |

## 8. Sources

Consultées le 2026-10-10.

- AWS Prescriptive Guidance, *Transactional outbox pattern* —
  https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html
- Amazon DynamoDB, *Change data capture for DynamoDB Streams* —
  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html
- Amazon DynamoDB, *Using time to live (TTL)* (suppression « within a few days », donc inutilisable comme minuterie) —
  https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/howitworks-ttl.html
- AWS Lambda, *Using AWS Lambda with Amazon DynamoDB* —
  https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html
- AWS Lambda, *Creating and configuring an Amazon SQS event source mapping* —
  https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html
- Amazon EventBridge, *Amazon DynamoDB stream as a source for EventBridge Pipes* —
  https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes-dynamodb.html
- Amazon EventBridge Scheduler, *Schedule types* —
  https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html
- Amazon SQS, *Message timers* —
  https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-message-timers.html
- Amazon SQS, *Using the message deduplication ID* —
  https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/using-messagededuplicationid-property.html
- Tarifs : https://aws.amazon.com/dynamodb/pricing/on-demand/,
  https://aws.amazon.com/eventbridge/pricing/, https://aws.amazon.com/sqs/pricing/,
  https://aws.amazon.com/kinesis/data-streams/pricing/
- AWS Database Blog, *Build scalable, event-driven architectures with Amazon DynamoDB and AWS Lambda* —
  https://aws.amazon.com/blogs/database/build-scalable-event-driven-architectures-with-amazon-dynamodb-and-aws-lambda
- re:Post, *DynamoDB Streams iterator age spikes despite healthy Lambda* —
  https://repost.aws/questions/QUl1rOSJHZT1SF3uL-rfw24A/dynamodb-streams-iterator-age-spikes-despite-healthy-lambda-shard-rebalancing-issue
- Kraken Engineering, *Stream consumer performance* (2024-05-13) —
  https://engineering.kraken.tech/news/2024/05/13/stream-consumer-performance.html
- DEV Community / AWS Builders, *Evaluating performance: a benchmark study of serverless solutions for message delivery* (2024-05-10) —
  https://dev.to/aws-builders/evaluating-performance-a-benchmark-study-of-serverless-solutions-for-message-delivery-to-1c8k
- Dépôt : `docs/CHAT_DATA_MODEL.md`, `media_summarizer/utils/chat_db.py`,
  `infrastructure/terraform/modules/platform/{dynamodb_chat_tables,lambda_media_lifecycle,lambda_digest_scheduler,pipeline_alerts,sqs}.tf`,
  `docs/research/task-430-chatbot-architecture/{README,complement-response-2026-10-07}.md`.
