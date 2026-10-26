---
id: TASK-539
title: >-
  Remplacer l'icône carte bancaire des cartes mémo par copy-outline sur mobile
  et web
status: To Do
assignee: []
created_date: '2026-10-26 17:09'
updated_date: '2026-10-26 17:09'
labels:
  - mobile
  - web
  - artifacts
  - ui
dependencies:
  - TASK-534
references:
  - mobile-design-mockups/ai_tab_notebooklm/icones_cartes_memo/screen.png
  - mobile-design-mockups/ai_tab_notebooklm/screen.png
  - 'mobile/app/artifacts/[artifactId].tsx'
  - mobile/src/components/ArtifactTile.tsx
  - web/src/components/ai/useAiPane.tsx
  - web/src/components/icons.generated.ts
  - web/scripts/extract_icons.py
priority: low
type: enhancement
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Les cartes mémo (`flashcards`) utilisent l'icône Ionicons `card-outline`, qui se lit comme une carte bancaire. Décision du propriétaire (2026-10-26) : la remplacer par `copy-outline`, deux fiches superposées. Elle est la plus proche d'un paquet de cartes, et l'app ne l'utilise pour rien d'autre. Les options comparées sont dans `mobile-design-mockups/ai_tab_notebooklm/icones_cartes_memo/` ; la maquette de l'onglet utilise déjà la nouvelle icône.

Cette tâche passe après TASK-534, qui refond les tuiles et la liste de l'onglet IA : l'icône est changée dans les composants qui en sortent.

## Périmètre

- **Mobile** : partout où une icône désigne le format cartes mémo, `card-outline` devient `copy-outline`. Aujourd'hui : `KIND_ICON` dans `mobile/app/artifacts/[artifactId].tsx` et la définition de la tuile dans `mobile/src/components/ArtifactTile.tsx`, ou ce qui les remplace après TASK-534.
- **Web** : même remplacement dans `web/src/components/ai/useAiPane.tsx`. Ajouter `copy-outline` à `web/src/components/icons.generated.ts` en relançant `web/scripts/extract_icons.py` (le fichier est généré, on ne l'édite pas à la main).
- **Hors périmètre** : `card-outline` sur `web/src/pages/AccountPage.tsx`. Là, il désigne bien le paiement, il reste.

Note pour le propriétaire : contrôle visuel de l'onglet IA et d'une fiche de cartes mémo, sur mobile et web. Vérification manuelle, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Aucune icône du format cartes mémo n'utilise plus card-outline dans mobile/ ni web/src ; toutes utilisent copy-outline
- [ ] #2 card-outline reste sur la page compte web, où il désigne le paiement
- [ ] #3 npm run typecheck et npm run lint passent dans mobile/, et la vérification de types passe dans web/
- [ ] #4 copy-outline est ajouté à la liste de noms de web/scripts/extract_icons.py, et web/src/components/icons.generated.ts est régénéré par ce script
<!-- AC:END -->
