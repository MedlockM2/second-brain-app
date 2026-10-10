---
id: TASK-458
title: >-
  Benchmark du relais de l'outbox du chat et de la récupération des tours non
  expédiés ou au bail expiré
status: To Do
assignee: []
created_date: '2026-10-10 17:56'
updated_date: '2026-10-10 22:00'
labels:
  - benchmark
  - chat
  - backend
dependencies: []
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - >-
    docs/research/task-430-chatbot-architecture/complement-response-2026-10-07.md
  - infrastructure/terraform/modules/platform/sqs.tf
  - infrastructure/terraform/modules/platform/lambda_digest_scheduler.tf
  - infrastructure/terraform/modules/platform/pipeline_alerts.tf
  - >-
    https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html
priority: medium
type: spike
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi ce benchmark existe

L'architecture du chat est décidée par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10 (source de vérité ; il prime sur la Recommendation et sur le complément). Son point 4 impose : « Le tour accepté et son intention d'envoi sont enregistrés atomiquement en DynamoDB, puis **une outbox expédie cette intention vers la file de chat de façon idempotente**. Prévoir la récupération des intentions non expédiées et des tentatives dont le bail a expiré. » Son point 9 ajoute : « Les choix encore ouverts, **notamment les détails d'outbox**, suivent la convention benchmark / implémentation du dépôt lorsque leur résolution exige un arbitrage technologique supplémentaire. »

Le mécanisme d'expédition n'est pas tranché, et il y a plusieurs options viables qui n'ont ni le même coût, ni la même latence de lancement, ni les mêmes objets AWS. C'est donc un benchmark, pas une implémentation.

## La question

Par quel mécanisme une intention d'envoi écrite dans la table DynamoDB du chat (créée par la tâche de socle de données du chat) part-elle vers la file SQS du chat, avec quelle garantie d'expédition au moins une fois et d'idempotence côté consommateur, et comment récupère-t-on (a) les intentions jamais expédiées et (b) les tentatives dont le bail a expiré sans état terminal ?

Candidates au minimum, à compléter par la recherche : DynamoDB Streams relayé par EventBridge Pipes vers SQS ; DynamoDB Streams relayé par une Lambda ; envoi SQS direct par l'API juste après l'écriture transactionnelle, plus un balayeur planifié (EventBridge Scheduler, sur le modèle de `lambda_digest_scheduler.tf`) qui rattrape les intentions restées non expédiées ; toute autre option documentée par AWS (guide prescriptif *Transactional outbox*, cité dans le Decision).

## Critères que le benchmark doit chiffrer

- **Latence ajoutée entre l'acceptation du tour et le début de génération** : c'est le temps au premier octet du chat, et le Decision fait du streaming une priorité.
- Objets AWS nouveaux et coût fixe mensuel (le complément C1.8 a montré qu'un coût fixe est le seul coût qui compte à cette échelle).
- Comportement en cas de crash à chaque étape (après écriture, avant envoi ; après envoi, avant marquage ; redélivrance SQS) et ce que le consommateur doit faire pour qu'une livraison dupliquée ne crée ni deuxième réponse visible ni deuxième débit (Decision point 4).
- Récupération des tentatives au bail expiré : qui la déclenche, à quelle cadence, et comment elle respecte les contraintes de visibilité Lambda/SQS (Decision point 2 : « la visibilité actuelle de 1 800 s des artefacts ne doit pas devenir la politique de reprise interactive du chat »).
- Observabilité et alarmes nécessaires, sur le modèle de `pipeline_alerts.tf`.
- Ce que l'option impose à la table (flux DynamoDB, index épars des intentions en attente…).

## Garde-fous

Benchmark seulement : aucune implémentation, aucun fichier source modifié. Recherche internet exhaustive, chaque fait daté et sourcé. Lecture seule sur AWS `-dev` (profil `second-brain-app`). Aucun secret ni identité de compte dans le README. Livrable : `docs/research/task-458-chat-outbox-relay/README.md` avec `owner_decision: pending`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs/research/task-458-chat-outbox-relay/README.md existe avec owner_decision: pending et une section Owner Validation à remplir
- [x] #2 Au moins trois mécanismes d'expédition sont comparés sur la latence ajoutée au lancement, les objets AWS nouveaux, le coût fixe mensuel, le comportement à chaque point de crash et l'observabilité, chaque fait portant sa source et sa date de consultation
- [x] #3 Le README décrit pour chaque option la récupération des intentions non expédiées et des tentatives au bail expiré, et ce que le consommateur doit faire pour qu'une livraison dupliquée ne crée ni deuxième réponse ni deuxième débit
- [x] #4 Le README se termine par une recommandation argumentée et la liste de ce qu'elle impose à la table du chat et au Terraform
- [x] #5 Aucun fichier hors du répertoire de recherche n'est modifié
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-11 — Mode initial. Livrable : docs/research/task-458-chat-outbox-relay/README.md (owner_decision: pending). Compare cinq mécanismes (A envoi SQS direct par l'API + balayeur, B flux DynamoDB → Lambda, C flux → EventBridge Pipes, D Kinesis, E FIFO) sur la latence au lancement, les objets AWS, le coût fixe, les points de crash et l'observabilité. Recommandation : A, avec un balayeur planifié chaque minute sur un GSI épars `chat-recovery-index` qui rattrape les intentions pending et remplace les tentatives au bail expiré. Aucune mesure de latence sur -dev (lecture seule) : chiffres issus de la documentation AWS et de mesures tierces. **La recommandation attend la validation de l'owner.**
<!-- SECTION:NOTES:END -->
