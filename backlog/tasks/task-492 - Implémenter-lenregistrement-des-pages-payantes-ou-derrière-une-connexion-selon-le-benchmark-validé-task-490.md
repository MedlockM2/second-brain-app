---
id: TASK-492
title: >-
  Implémenter l'enregistrement des pages payantes ou derrière une connexion
  selon le benchmark validé (task-490)
status: To Do
assignee: []
created_date: '2026-10-11 16:00'
labels:
  - extension
  - feature
dependencies:
  - TASK-490
  - TASK-487
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
priority: medium
type: feature
ordinal: 99000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Cette tâche est l'élément **B-02i** du §3 de `docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md`, que le `Decision` du 2026-10-11 du README de task-424 a retenu.

La voie d'enregistrement des pages payantes ou derrière une connexion est tranchée par le benchmark **task-490**. Lire `docs/research/task-490-*/README.md`, section **Owner Validation** : le champ `Decision` est la décision finale de l'owner, qui **peut différer de la recommandation** du benchmark. Si ce `Decision` renvoie à des fichiers `complement-response-*.md` du même répertoire, les suivre aussi. Implémenter l'architecture que ce `Decision` décrit, et rien d'autre.

## Cadre

- Elle part de l'extension Chrome et Edge livrée par task-487.
- La règle d'identité du complément §10 s'impose : un texte envoyé par le client ne prend jamais l'identité de l'adresse seule.
- Si le `Decision` étend le travail au partage depuis Safari sur iPhone, donc à `mobile/`, **ne pas modifier `mobile/` dans cette tâche** : le dire dans la note de fin pour que l'owner crée la tâche `mobile` correspondante.
- Rien n'est déployé : aucune compatibilité, aucun double chemin. Pas de tests automatisés. Aucun secret dans les fichiers suivis. Documentation et i18n (11 langues) dans la même PR.

## Note à l'owner

Vérification sur une page payante réelle depuis l'extension chargée contre `-dev`, après déploiement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L'enregistrement suit le Decision de l'owner dans docs/research/task-490-*/README.md, et l'écart éventuel avec la recommandation du benchmark est suivi du côté du Decision
- [ ] #2 Un texte envoyé par le client ne prend jamais l'identité de l'adresse seule
- [ ] #3 Le contrat d'API touché est décrit dans docs/CANONICAL_MEDIA_API_CONTRACT.md
- [ ] #4 Le build de l'extension passe, typecheck et lint sont propres, ruff et mypy passent sur tout fichier Python modifié, et aucun fichier de mobile/ n'est modifié
<!-- AC:END -->
