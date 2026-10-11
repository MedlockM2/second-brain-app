---
id: TASK-465
title: >-
  Implémenter le relais de l'outbox du chat et la récupération des tours bloqués
  selon le benchmark validé (task-458)
status: To Do
assignee: []
created_date: '2026-10-10 18:00'
updated_date: '2026-10-10 18:01'
labels:
  - backend
  - chat
  - feature
dependencies:
  - TASK-458
  - TASK-462
  - TASK-463
references:
  - docs/research/task-430-chatbot-architecture/README.md
priority: medium
type: feature
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat est décidée par l'owner dans `docs/research/task-430-chatbot-architecture/README.md`, section **Owner Validation**, champ `Decision` du 2026-10-10. Son point 4 impose qu'une **outbox** expédie vers la file de chat, de façon idempotente, l'intention d'envoi enregistrée atomiquement avec le tour accepté, et qu'on récupère les intentions non expédiées et les tentatives dont le bail a expiré. Le mécanisme d'expédition est tranché par le benchmark task-458.

**Lire `docs/research/task-458-*/README.md`, section Owner Validation, champ `Decision`** : c'est la décision finale de l'owner, qui peut différer de la recommandation du benchmark. Si le `Decision` renvoie à des fichiers `complement-response-*.md` du même répertoire, les suivre aussi. Le périmètre de cette tâche est ce `Decision`.

## Ce qui existe quand cette tâche démarre

- La table chat et son item d'intention d'envoi (task-457), avec leur schéma documenté.
- La route d'envoi d'un tour (task-462), qui écrit tour, tentative et intention dans une transaction et, à sa livraison, n'envoie rien vers SQS. Si le mécanisme retenu prévoit un envoi depuis l'API, c'est cette tâche qui l'y ajoute.
- La file SQS de chat et son worker (task-463), qui claim la tentative sous bail et acquitte les doublons.

## Ce que cette tâche livre

Le mécanisme retenu, sa récupération des intentions non expédiées et des tentatives au bail expiré, et ce qu'il impose à la table (flux DynamoDB, index…) et au Terraform, avec ses alarmes. Une livraison dupliquée ne doit créer ni deuxième réponse visible ni deuxième débit (Decision point 4). Quand la récupération renonce définitivement à un tour (intention jamais expédiable, tentatives épuisées, message parti en DLQ sans scellement), elle le scelle en échec et, s'il n'a produit aucun texte visible, appelle l'opération de remboursement de task-462 (décision de l'owner du 2026-10-10 : « On rembourse »). La récupération respecte les contraintes de visibilité Lambda/SQS, et la visibilité de 1 800 s des artefacts n'est pas la politique de reprise du chat (Decision point 2).

## Règles

Rien n'est déployé : pas de compatibilité ni de double chemin d'expédition. Pas de tests automatisés. Documenter le mécanisme et son exploitation dans `docs/INGESTION_WORKERS_PROVIDERS.md` (ou le document de schéma du chat créé par task-457).

## Note à l'owner

Cette tâche ferme la chaîne serveur : après merge et déploiement, un tour envoyé par l'API dev doit partir dans la file, être généré par le worker et apparaître en fragments puis en message final dans la table chat. Pour vérifier la récupération, interrompre une génération (par exemple en limitant la concurrence du worker à 0 un moment) et observer la reprise.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le mécanisme d'expédition retenu par le Decision de docs/research/task-458-chat-outbox-relay/README.md est implémenté et achemine chaque intention d'envoi vers la file SQS de chat
- [ ] #2 Les intentions non expédiées et les tentatives au bail expiré sans état terminal sont récupérées par le mécanisme décrit dans ce Decision
- [ ] #3 Une intention expédiée deux fois ne produit ni seconde réponse visible ni second débit, par les conditions de la table chat et le claim du worker
- [ ] #4 Les ressources et alarmes que le mécanisme exige, s'il en exige, sont déclarées en Terraform, et terraform validate passe
- [ ] #5 Le mécanisme et son exploitation sont documentés dans docs/ ; ruff check et mypy passent sur les fichiers Python modifiés
- [ ] #6 Un tour auquel la récupération renonce est scellé en échec et, s'il n'a produit aucun texte visible, remboursé par l'opération de task-462
<!-- AC:END -->
