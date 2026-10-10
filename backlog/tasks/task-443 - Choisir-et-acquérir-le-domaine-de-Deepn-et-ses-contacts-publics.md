---
id: TASK-443
title: Choisir et acquérir le domaine de Deepn et ses contacts publics
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies: []
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/BRAND_IDENTITY.md
priority: high
ordinal: 50000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — choisir et acheter le domaine, conserver la preuve de propriété hors dépôt et définir les contacts support/confidentialité.

## Contexte et périmètre

Le choix Deepn ne prouve aucun achat. Cette tâche couvre la propriété du domaine destiné à l’API et aux surfaces publiques, ainsi que le canal de contact réellement opérationnel. Le choix d’hébergement légal relève déjà de task-357 ; ne pas imposer un hébergeur ni créer un benchmark concurrent. Une résolution DNS ne constitue jamais une preuve de propriété. Le site et Stripe restent dans task-424/425.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le domaine effectivement acquis et la répartition API/site/légal/support sont consignés ; la preuve d’achat reste hors dépôt.
- [ ] #2 Le canal support et le canal confidentialité sont définis et leur fonctionnement est consigné sans publier d’identité de connexion de compte.
- [ ] #3 Les entrées des consoles et documents à remplacer sont recensées ; aucun domaine tiers n’est présenté comme appartenant au projet.
<!-- AC:END -->
