---
id: TASK-441
title: Fixer et lancer la bêta de trois mois avec les allocations maximales
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-429
  - TASK-440
documentation:
  - docs/V1_LAUNCH_PLAN.md
priority: high
ordinal: 48000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — décider de la date de début, coordonner les testeurs et configurer les dates ; aucune date ne peut être choisie par un agent.

## Contexte et périmètre

La bêta officielle n’a pas commencé du seul fait de TestFlight. Décision du 2026-10-04 : trois mois sans abonnement souscriptible, allocation maximale pour tous et consommation mesurée. task-429 livre déjà le mécanisme. Écrire le bloc beta_access dans pricing_config-prod et poser ends_at dans les deux environnements au démarrage. Le lancement de la bêta sur dev ne nécessite pas d’attendre le réveil de prod ; y préparer la configuration ne vaut pas ouverture de prod.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le début décidé par l’owner et la fin trois mois plus tard sont consignés avec un fuseau explicite, sans utiliser la date d’ouverture de TestFlight comme début implicite.
- [ ] #2 Le compte rendu décrit la configuration beta_access retenue et relue dans dev et prod, sans exposer d’autre contenu des tables.
- [ ] #3 Le compte rendu des vérifications sur comptes nouveaux et existants décrit allocation, masquage du paywall et conservation de la mesure de consommation.
- [ ] #4 Les modalités d’accès des testeurs, la collecte des retours et le bilan d’usage attendu en fin de bêta sont documentés sans identité de testeur.
<!-- AC:END -->
