---
id: TASK-447
title: Exercer les alertes et le rollback API et workers avant ouverture de prod
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-446
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/API_LAMBDA_RUNTIME.md
priority: high
ordinal: 54000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — organiser les exercices opérationnels et confirmer la réception des alertes ; agent — aider au diagnostic sans déploiement autonome.

## Contexte et périmètre

Phases 7/8 : le provisioning ne prouve ni une alerte reçue ni un rollback utilisable. Exercer CloudWatch → SNS → réception sur dev avant prod ; vérifier les logs structurés et le tableau de bord. Documenter un retour arrière avec images API et workers immuables, puis un rétablissement de la release. Le réveil de prod précède les contrôles prod ; la partie dev peut être préparée auparavant. Ne pas ajouter d’instrumentation temporaire persistante ni écrire d’adresse de destinataire dans le dépôt.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le compte rendu de l’exercice d’alerte indique le signal utilisé, ses transitions et la réception confirmée, sans identité du destinataire.
- [ ] #2 Les observations du dashboard et des logs structurés ainsi que les éventuels angles morts sont documentés.
- [ ] #3 L’exercice de rollback puis de rétablissement API/workers est documenté avec références d’images immuables et résultat observé.
- [ ] #4 Les runbooks précisent les responsabilités et les conditions d’escalade ; les anomalies bloquantes ont une tâche liée.
<!-- AC:END -->
