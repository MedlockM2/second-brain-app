---
id: TASK-491
title: Implémenter le paiement web selon le benchmark validé (task-489)
status: To Do
assignee: []
created_date: '2026-10-11 15:59'
labels:
  - web
  - feature
dependencies:
  - TASK-489
  - TASK-484
references:
  - docs/research/task-424-website-and-browser-extension/README.md
  - >-
    docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md
priority: low
type: feature
ordinal: 98000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Cette tâche est l'élément **B-01i** du §3 de `docs/research/task-424-website-and-browser-extension/complement-response-2026-10-11.md`, que le `Decision` du 2026-10-11 du README de task-424 a retenu. C'est la **seule** tâche qui ajoute un paiement web (`Decision` point 3).

Le moteur et l'intégration sont tranchés par le benchmark **task-489**. Lire `docs/research/task-489-*/README.md`, section **Owner Validation** : le champ `Decision` est la décision finale de l'owner, qui **peut différer de la recommandation** du benchmark. Si ce `Decision` renvoie à des fichiers `complement-response-*.md` du même répertoire, les suivre aussi. Implémenter l'architecture que ce `Decision` décrit, et rien d'autre.

## Cadre

- L'entrée vers l'abonnement se place dans la carte de formule de Mon compte (task-484), là où la bêta (task-429) la masque ; la clôture de la bêta relève de task-442.
- Rien n'est déployé : aucune compatibilité, aucun double chemin. Pas de tests automatisés. Aucun secret dans les fichiers suivis. Ne modifier aucun fichier de `mobile/`.
- Documentation et i18n (11 langues) dans la même PR.

## Note à l'owner

Configuration du moteur retenu dans son tableau de bord et dans RevenueCat, puis un achat de test sur `-dev` après déploiement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le paiement web suit le Decision de l'owner dans docs/research/task-489-*/README.md, et l'écart éventuel avec la recommandation du benchmark est suivi du côté du Decision
- [ ] #2 L'entrée vers l'abonnement est câblée dans la carte de formule de Mon compte de l'app web
- [ ] #3 La documentation des droits et du webhook est à jour du moteur retenu
- [ ] #4 Les libellés sont présents dans les 11 langues, le build passe, typecheck et lint sont propres, et ruff et mypy passent sur tout fichier Python modifié
<!-- AC:END -->
