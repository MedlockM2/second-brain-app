---
id: TASK-456
title: Réconcilier le V1 Launch Plan avec la bêta et les gates de lancement actuels
status: Done
assignee:
  - agent
created_date: '2026-10-10 15:13'
updated_date: '2026-10-10 21:03'
labels:
  - v1-launch
  - release
  - agent
dependencies: []
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - AGENTS.md
  - docs/RELEASE_LOG.md
priority: high
ordinal: 63000
dispatchable: true
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Agent — mettre à jour la documentation depuis les preuves disponibles et les tâches existantes ; owner — confirmer les états externes non attestés.

## Contexte et périmètre

Le plan mêle un audit principal du 3 septembre, des ajouts d’octobre et des contradictions (absence de testeurs, routes /api/v1, tâches mobiles déjà validées). La première synthèse du 2026-10-10 a repris à tort des validations déjà réalisées : task-164 est Done et les quatre parcours de task-165 sont cochés. Réconcilier la vue de lancement avec cette réalité sans déclarer les consoles ou prod validées faute de preuve. task-166 garde la clôture spécifique de Phase 5 et son scope ; cette tâche porte la vue transversale et les liens vers les nouvelles responsabilités.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution par un agent dans son worktree : livrer les fichiers et vérifications locales, sans merge, push, déploiement ni publication. Toute validation déployée relève de la checklist owner, pas des critères du travail en branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le plan distingue la bêta de trois mois, la sortie de bêta, les gates de soumission et le soft launch, avec leurs responsabilités et liens backlog.
- [x] #2 Les validations mobiles déjà prouvées ne sont plus présentées comme entièrement à refaire ; les restes exacts de task-165/166 sont visibles.
- [x] #3 Les affirmations contradictoires sur les testeurs, API et états externes sont corrigées depuis des sources datées ou explicitement marquées à confirmer.
- [x] #4 La checklist différencie livraison en worktree et actions owner de release ; Maestro reste hors des gates tant que la décision de sommeil reste en vigueur.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Réconciliation faite le 2026-10-10 dans `docs/V1_LAUNCH_PLAN.md`, sur l'arbre de travail principal (pas de worktree : la tâche et les tâches 440-455 qu'elle relie n'étaient pas encore commitées), sans commit.

- **AC #1** : nouveau § « Vue de lancement au 2026-10-10 », qui remplace le « chemin critique restant » du 2026-09-03. Quatre étapes (bêta de trois mois, sortie de bêta, gates de soumission, soft launch), chacune en tableau tâche / responsable / dépendances, reliées à task-440 à task-455 et aux tâches stores existantes (180, 186, 260, 357, 358). La section « Phase de beta » renvoie désormais à task-441 et task-442.
- **AC #2** : task-164 présentée `Done` (2026-09-04) et task-165 avec ses AC #1-#4 validées (2026-09-02). Seul reste son AC #5 (partage document/image sur un binaire portant task-345 et task-347). Corrigé dans l'état de vérité, le tableau des bloquants release et la liste « À faire » de la Phase 5, sans marquer la Phase 5 DONE, qui reste du ressort de task-166.
- **AC #3** : « ni TestFlight, ni Internal Testing, zéro utilisateur hors owner » corrigé (TestFlight depuis le 2026-09-02, piste interne depuis le 2026-09-01, testeurs distincts de la bêta). Commits locaux : 0 d'avance mesuré le 2026-10-10 (`origin/main` = `HEAD` = `f05bd7c`), corrigé à six endroits. Portes Play : deux comptes contradictoires ramenés au relevé le plus récent (4/7 au 2026-09-01), marqué à confirmer. Binaire Android de la piste interne, `Mobile Build & Distribute`, prod et domaine listés comme états externes à confirmer. Affirmations API (`/api/` sans `/api/v1/`) vérifiées cohérentes avec le code monté, laissées telles quelles.
- **AC #4** : checklist en deux listes, livraison agent en worktree / actions owner de release ; paragraphe explicite « Maestro n'est pas un gate de lancement » tant que le sommeil (task-254, task-172 verrouillée) tient.

Hors périmètre, relevé : `AGENTS.md` dit encore que le secret runtime prod est vide (peuplé le 2026-09-03 par task-252). `media_summarizer/api/endpoints/follows.py` documente des routes `/api/v1/follows` mais n'est monté nulle part.
<!-- SECTION:NOTES:END -->
