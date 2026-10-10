---
id: TASK-451
title: Finaliser le branding Google OAuth et ouvrir son audience de production
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
  - TASK-443
documentation:
  - docs/V1_LAUNCH_PLAN.md
priority: high
ordinal: 58000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — approuver l’identité publique et publier l’audience dans Google Auth Platform.

## Contexte et périmètre

Phase 10 : le nom choisi est Deepn ; le branding OAuth et le mode Test ne sont pas automatiquement mis à jour par le rebrand mobile. Vérifier les scopes réellement demandés, les domaines/URLs et le statut des clients existants. Publier l’audience au moment approprié avant l’ouverture publique. Si les exigences courantes imposent une vérification, la suivre ; ne pas supposer que la publication est immédiate à partir du texte ancien du plan.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le branding, les contacts publics et les domaines/URLs autorisés retenus sont consignés sans identité de login privée.
- [ ] #2 Les scopes réellement utilisés et les éventuelles exigences de vérification affichées sont documentés.
- [ ] #3 Le compte rendu décrit le statut de publication et le résultat d’une connexion avec un compte hors liste de test, sans identifier ce compte.
<!-- AC:END -->
