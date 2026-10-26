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
- [x] #1 Aucune icône du format cartes mémo n'utilise plus card-outline dans mobile/ ni web/src ; toutes utilisent copy-outline
- [x] #2 card-outline reste sur la page compte web, où il désigne le paiement
- [x] #3 npm run typecheck et npm run lint passent dans mobile/, et la vérification de types passe dans web/
- [x] #4 copy-outline est ajouté à la liste de noms de web/scripts/extract_icons.py, et web/src/components/icons.generated.ts est régénéré par ce script
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation 2026-10-26 (agent, branche worktree-agent-a7b0215a5ff1cd909).

- Emplacements après TASK-534 et TASK-541 (`ArtifactTile.tsx` et la liste de `useAiPane.tsx` n'existent plus) : mobile, `ARTIFACT_FORMATS` de `mobile/src/lib/artifactFormats.ts` (tuile de la grille « Générer » et icône des lignes de la liste) et `KIND_ICON` de `mobile/app/artifacts/[artifactId].tsx` (en-tête de la fiche) ; web, `ARTIFACT_FORMATS` de `web/src/components/ai/artifactFormats.ts`, seule définition côté web, lue par la grille, les lignes et la fiche du volet IA. Les trois passent de `card-outline` à `copy-outline`.
- `web/scripts/extract_icons.py` : `card-outline` y figurait deux fois. La seconde occurrence, à côté de `book-outline`, servait aux cartes mémo : elle devient `copy-outline`. La première reste pour `web/src/pages/AccountPage.tsx` (ligne « Plan », le paiement), donc `card-outline` reste aussi dans `icons.generated.ts`.
- `icons.generated.ts` régénéré par `python3 web/scripts/extract_icons.py` (66 -> 67 icônes). Le diff ne contient que l'ajout de `copy-outline` : toutes les autres entrées sont identiques à l'octet près, le script reproduit donc le fichier versionné.
- Vérifications : grep `card-outline` sur `mobile/app`, `mobile/src`, `mobile/.maestro`, `packages`, `web/src` et `web/scripts` : il ne reste que `AccountPage.tsx`, la ligne 21 de `extract_icons.py` et l'entrée générée correspondante. `npm run typecheck` et `npm run lint` passent dans `mobile/` (0 erreur, un avertissement préexistant dans `purchaseService.ts`, non touché). `npm run typecheck` et `npm run lint` passent dans `web/`.
- Hors périmètre, non modifiés : les maquettes et recherches antérieures (`mobile-design-mockups/`, `docs/research/task-424-*`) qui dessinent encore `card-outline`. Ce sont des archives de maquettes, pas du code de l'app.

Hors de portée de cet agent : le contrôle visuel de l'onglet IA et d'une fiche de cartes mémo sur mobile et web, que la description laisse au propriétaire. Seul le backend déployé fonctionne, et la branche n'est pas déployée.
<!-- SECTION:NOTES:END -->
