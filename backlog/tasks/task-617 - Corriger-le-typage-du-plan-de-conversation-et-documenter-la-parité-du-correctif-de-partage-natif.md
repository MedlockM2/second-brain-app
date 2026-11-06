---
id: TASK-617
title: >-
  Corriger le typage du plan de conversation et documenter la parité du
  correctif de partage natif
status: Done
assignee:
  - '@codex'
created_date: '2026-11-06 21:27'
updated_date: '2026-11-06 21:28'
labels: []
dependencies: []
priority: high
ordinal: 223000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Main Branch Checks échoue sur le type inféré du plan JSON de conversation et sur le trailer Web absent du commit de retry du partage natif déjà poussé. Corriger le type sans changer le comportement, consigner la qualification native du commit historique et conserver le garde de parité sans réécrire main.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le typage du plan JSON admet les durées entières et mypy ainsi que ruff passent sur le backend.
- [x] #2 Le correctif de partage natif 5cb1ad2c est qualifié Web n/a dans les notes et le nouveau commit ; le garde reste inchangé et sa vérification locale passe sur la plage de commits à pousser.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Préciser le type des valeurs du plan JSON. 2. Vérifier mypy et ruff. 3. Consigner rétrospectivement la qualification native du partage sans réécriture historique. 4. Committer, pousser et inspecter Main Branch Checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
mypy passe sur les 216 fichiers backend ; ruff et git diff --check passent. Le commit historique 5cb1ad2c concerne le retry du ShareIntent natif et la sortie de son écran de réception : Web n/a (réception des partages du système iOS/Android, sans équivalent navigateur). Qualification consignée rétrospectivement dans le nouveau commit, sans modifier le commit poussé ni affaiblir check_web_parity.py. Les anciens runs conservent leur résultat historique ; le prochain push contrôle uniquement la nouvelle plage.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Type du plan de conversation précisé sans changement du JSON produit. mypy (216 fichiers), ruff, git diff --check et le garde Web sur origin/main..HEAD passent. Qualification rétrospective du partage natif consignée dans le commit ; historique publié et garde inchangés.
<!-- SECTION:FINAL_SUMMARY:END -->
