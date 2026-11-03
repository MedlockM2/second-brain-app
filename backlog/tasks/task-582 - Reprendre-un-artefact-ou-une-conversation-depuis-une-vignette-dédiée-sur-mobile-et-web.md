---
id: TASK-582
title: >-
  Reprendre un artefact ou une conversation depuis une vignette dédiée sur
  mobile et web
status: Done
assignee:
  - '@codex'
created_date: '2026-11-03 14:46'
updated_date: '2026-11-03 15:11'
labels: []
dependencies: []
documentation:
  - docs/CONTINUE_LEARNING.md
priority: high
type: feature
ordinal: 185000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La file actuelle ne conserve que le média ou dossier et perd la destination utilisée. Le plan explicitement validé par le propriétaire le 2026-11-03 remplace ce signal par une entrée par artefact/conversation, avec accès direct et conversation ouverte au dernier message. Architecture et comportement décidés dans cette session ; aucun benchmark supplémentaire requis. LAUNCH PREREQUISITE : après merge et push par le propriétaire, livrer Terraform/backend/mobile/web et effectuer la recette déployée documentée.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le contrat et le stockage représentent une entrée par artefact ou conversation, avec classement récent, expiration et vérification des destinations accessibles
- [x] #2 Les engagements explicites et suppressions sont câblés ; les anciennes écritures par média/dossier sont retirées
- [x] #3 Les composants et routes mobile/web sont câblés pour identifier type, titre et parent, ouvrir la cible précise et sélectionner le dernier message du chat sans demander le clavier
- [x] #4 Les contrats, la rétention et la recette owner sont documentés ; les vérifications locales applicables sont exécutées et leurs limites consignées
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remplacer le stockage par user_engagements et les contrats API/types, puis câbler engagements/suppressions et retirer le signal précédent. 2. Livrer les vignettes et accès directs mobile/web avec logique neutre partagée. 3. Documenter modèle/rétention/recette ; vérifier ruff/mypy, typecheck/lint des trois workspaces et Terraform sans apply.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation complète du plan owner : table user_engagements avec deux LSI et TTL, transactions conditionnées sur cible/parent, lecture metadata par lots et pagination, gestion des sauvegardes multiples, hooks de génération/relance/tours non rejoués et suppressions. Ancien signal média/dossier retiré sans migration. Les deux clients partagent les types et la présentation neutre ; badges traduits, accès directs, sélection du fil et fin de conversation sans autofocus mobile. Les ouvertures natives sont gardées par focus et premier plan ; polling et historique automatique web ne créent aucun engagement.

Preuves locales : ruff et mypy backend (214 fichiers), typecheck/lint mobile/core/web, build Vite, garde check_purge_at_writers, parsing YAML OpenAPI et git diff --check passent. Avertissement any préexistant dans purchaseService.ts non modifié ; Vite signale la taille du bundle. Terraform fmt/validate passent ; plan dev obtenu via scripts/terraform_with_cognito.py : 1 ajout, 23 mises à jour, 0 destruction, aucune table existante remplacée. Le plan contient aussi une différence de configuration Apple hors du diff de cette tâche : à examiner par l’owner avant livraison. Aucun apply.

Les AC expriment les contrats et chemins câblés vérifiables dans le worktree conformément à AGENTS.md. Revue statique et compilation ne sont pas présentées comme recette native : aucun test automatisé ajouté/lancé, aucun backend local substitué à AWS, aucun parcours sur appareil prétendu. La recette mobile/web après livraison est la checklist owner de docs/CONTINUE_LEARNING.md. Aucune action de merge, push ou déploiement effectuée. Les futurs commits de cette livraison portent Web: done. Scan des ajouts et nouveaux fichiers : aucun email ni motif de credential trouvé.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implémenté sur feat/resume-artifacts-conversations : activité par cible, stockage/expiration/suppressions, vignettes et accès directs mobile/web, fin de conversation sans autofocus. Vérifié par ruff/mypy, typecheck/lint des trois workspaces, build web, garde de purge, validation YAML et Terraform fmt/validate/plan (aucune destruction). Recette sur appareil et livraison restent owner ; voir docs/CONTINUE_LEARNING.md. Différence Apple hors périmètre signalée dans le plan, sans apply.
<!-- SECTION:FINAL_SUMMARY:END -->
