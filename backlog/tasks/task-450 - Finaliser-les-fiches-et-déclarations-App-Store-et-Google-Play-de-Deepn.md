---
id: TASK-450
title: Finaliser les fiches et déclarations App Store et Google Play de Deepn
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-186
  - TASK-180
  - TASK-444
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/store-listing/QA-CHECKLIST.md
  - docs/compliance/CHECKLIST.md
priority: high
ordinal: 57000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — capturer l’UI finale, approuver les textes et déclarations, renseigner les consoles et créer les comptes reviewers hors dépôt ; agent — préparer les fichiers de support.

## Contexte et périmètre

task-44 a préparé les assets et métadonnées, sans attester les consoles actuelles. Finaliser à partir de docs/store-listing/ : nom Deepn, icônes, screenshots de l’UI finale, descriptions/localisations, pays, catégories/classification, App Privacy/Data Safety, contacts, URLs et notes reviewers. Compléter les métadonnées des abonnements iOS, localisations et capture de review selon le catalogue finalement validé. Relever les exigences affichées par les consoles au moment de l’action, sans reprendre les tailles ou délais de septembre comme règles actuelles. Aucun mot de passe reviewer dans le dépôt.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les checklists store-listing/compliance reflètent les champs saisis, localisations, assets actuels et éventuels éléments manquants dans chaque console.
- [ ] #2 Les screenshots correspondent à la version finale et les textes/identités visibles portent Deepn avec les URLs légales publiées.
- [ ] #3 Les déclarations de données et métadonnées des abonnements sont approuvées et leur état de soumission consigné.
- [ ] #4 Les comptes reviewers et instructions d’accès sont disponibles dans les consoles ; aucun credential ni identité de compte privé n’est suivi.
<!-- AC:END -->
