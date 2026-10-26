---
id: TASK-541
title: >-
  Refaire le volet IA du web sur le modèle de l'onglet IA mobile (TASK-534) :
  grille « Générer » toujours active, liste unique et ligne de génération animée
status: To Do
assignee: []
created_date: '2026-10-26 19:12'
labels:
  - web
  - artifacts
  - ui
dependencies:
  - TASK-534
references:
  - mobile-design-mockups/ai_tab_notebooklm/README.md
  - web/src/components/ai/useAiPane.tsx
  - web/src/pages/FolderPage.tsx
  - web/src/styles.css
  - mobile/src/components/ArtifactsPanel.tsx
  - mobile/src/constants/theme.ts
priority: medium
type: feature
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

TASK-534 a refait l'onglet IA de l'app mobile sur le modèle du Studio de NotebookLM (maquette `mobile-design-mockups/ai_tab_notebooklm/`). Le volet IA du web (`web/src/components/ai/useAiPane.tsx`) garde l'ancien comportement : des pastilles qui affichent « Généré » et se désactivent, une comparaison des sources du dossier pour décider si l'on peut générer à nouveau, une génération répondue `reused` qui ne s'ouvre pas, et rien qui bouge pendant une génération. Règle « Web parity » d'`AGENTS.md` : le comportement doit être le même sur les deux apps.

Lire d'abord `mobile/src/components/ArtifactsPanel.tsx`, `mobile/src/components/ArtifactRow.tsx`, `mobile/src/components/ArtifactGeneratingRow.tsx` et `mobile/src/hooks/useScopeArtifacts.ts`, qui portent le comportement à reproduire.

## Périmètre

- **Grille « Générer »** : quatre tuiles teintées (Résumé, Notes de cours, Cartes mémo, Quiz), toujours actives. Supprimer l'état « Généré », `generationAvailable`, `scopeMediaIds` et la lecture des instantanés de sources dans `useAiPane` ; `FolderPage` ne passe plus `scopeMediaIds`.
- **Couleurs** : les tokens `artifactSummaryTint`, `artifactSummaryInk`, `artifactNotesTint`, `artifactNotesInk`, `artifactFlashcardsTint`, `artifactFlashcardsInk`, `artifactQuizTint`, `artifactQuizInk` et `primaryInk` de `mobile/src/constants/theme.ts` deviennent des variables de `web/src/styles.css`, en clair et en sombre, avec les mêmes valeurs.
- **Liste unique** sous la grille, sans titre : générations en cours d'abord, puis fiches de la plus récente à la plus ancienne. Une ligne : icône teintée du format, titre écrit par le modèle, « Type · N sources (dossier seulement) · date relative ». Une ligne en échec dit l'échec et relance la génération d'un clic.
- **Réponse `reused`** : ouvrir la fiche existante dans le volet.
- **Ligne de génération animée**, en CSS : reflet ambré de droite à gauche en boucle d'environ 1,8 s, deux étincelles qui scintillent en décalé sur l'icône ; elle ne s'ouvre pas ; sous `prefers-reduced-motion`, ni reflet ni scintillement. Textes : clés `artifacts.status.generating`, `artifacts.row.generatingMeta`, `artifacts.row.failed`, `artifacts.row.a11yRetry`, déjà présentes dans les onze langues (TASK-534).
- **Clé « Généré »** : le web est le dernier lecteur d'`artifacts.status.generated`. La supprimer des onze catalogues de `packages/core/src/i18n`.

Note pour le propriétaire : contrôle visuel du volet IA d'un média et d'un dossier, en clair et en sombre, avec une génération en cours et une génération échouée. Vérification manuelle, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le volet IA du média et du dossier affiche quatre tuiles teintées toujours actives, sans état « Généré », et useAiPane ne compare plus les sources du dossier
- [ ] #2 Une liste unique sans titre suit la grille : générations en cours d'abord, puis fiches par date décroissante ; une ligne en échec relance la génération d'un clic
- [ ] #3 Une génération répondue reused ouvre la fiche existante
- [ ] #4 La ligne en cours est animée en CSS (reflet et étincelles) et reste statique sous prefers-reduced-motion
- [ ] #5 Les teintes et encres de format sont des variables de web/src/styles.css en clair et en sombre, aux valeurs de mobile/src/constants/theme.ts
- [ ] #6 La clé artifacts.status.generated est supprimée des onze catalogues de packages/core/src/i18n
- [ ] #7 npm run typecheck et npm run lint passent dans web/
<!-- AC:END -->
