---
id: TASK-449
title: Valider la chaîne EAS et produire les binaires finaux de release
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-445
  - TASK-186
  - TASK-180
  - TASK-358
  - TASK-442
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - mobile/MOBILE_CI_CD.md
  - docs/RELEASE_LOG.md
priority: high
ordinal: 56000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — vérifier les variables EAS distantes, déclencher les builds et leur distribution de validation, conserver les accès de signature côté EAS.

## Contexte et périmètre

Le workflow Mobile Build & Distribute n’avait aucun run vert attesté dans le plan de septembre : vérifier son état actuel avant de relancer. Contrôler les clés SDK publiques nécessaires aux deux plateformes sans les copier dans le backlog, notamment la clé Apple signalée manquante à distance. Regrouper rebrand et icônes dans la même livraison native pour éviter des builds inutiles. Après bêta, produire des builds production qui ciblent prod ; un binaire internal cible dev et ne devient pas une release prod par simple promotion. Ne jamais enregistrer une clé de service Play sur disque.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le compte rendu distingue la validation de la chaîne GitHub/EAS des builds de release ; un éventuel échec est documenté avec sa tâche de correction.
- [ ] #2 La présence des variables distantes nécessaires et la destination API sont consignées par environnement sans afficher leurs valeurs sensibles.
- [ ] #3 Les builds finaux iOS/Android sont référencés avec révision, profil, version et environnement cible dans RELEASE_LOG.md.
- [ ] #4 Le rebrand et les icônes sont inclus dans les binaires finaux ; la validation après installation et les limites restantes sont consignées.
<!-- AC:END -->
