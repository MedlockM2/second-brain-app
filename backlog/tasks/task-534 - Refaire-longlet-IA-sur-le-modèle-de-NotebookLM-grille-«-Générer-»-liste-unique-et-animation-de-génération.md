---
id: TASK-534
title: >-
  Refaire l'onglet IA sur le modèle de NotebookLM : grille « Générer » de quatre
  formats, liste unique et animation de génération
status: To Do
assignee: []
created_date: '2026-10-26 16:47'
updated_date: '2026-10-26 17:01'
labels:
  - mobile
  - artifacts
  - ui
dependencies:
  - TASK-538
references:
  - mobile-design-mockups/ai_tab_notebooklm/README.md
  - mobile-design-mockups/ai_tab_notebooklm/code.html
  - mobile-design-mockups/ai_tab_notebooklm/screen.png
  - mobile/src/components/ArtifactsPanel.tsx
  - mobile/src/components/ArtifactTile.tsx
  - mobile/src/components/ArtifactHistoryRow.tsx
  - mobile/src/components/CompletedDetailView.tsx
  - 'mobile/app/media/folders/[id].tsx'
  - mobile/src/constants/theme.ts
  - packages/core/src/i18n/fr.ts
  - mobile/docs/DARK_THEME_CONTRAST.md
priority: high
type: feature
ordinal: 141000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'onglet IA d'un média et d'un dossier (`ArtifactsPanel`) superpose deux listes, « Générer » et « Généré ». Le même mot y joue deux rôles, et rien ne bouge pendant une génération. Le propriétaire veut que la page ressemble à l'onglet Studio de NotebookLM. La maquette validée est `mobile-design-mockups/ai_tab_notebooklm/` ; lire son README et `screen.png` avant de commencer.

Cette tâche passe après TASK-538, qui retire le résumé détaillé des apps. Il reste quatre formats : Résumé, Notes de cours, Cartes mémo, Quiz.

## Périmètre

- **Grille « Générer »**
  - Quatre tuiles sur deux colonnes, une par format, chacune avec sa teinte et la couleur de son icône.
  - Les huit couleurs (teinte et icône de chaque format) entrent dans `theme.ts`, en clair et en sombre. Le contraste en sombre est vérifié selon `mobile/docs/DARK_THEME_CONTRAST.md`.
  - Les tuiles sont toujours actives. Supprimer l'état « Généré » de la tuile et l'usage de `generationAvailable` pour la griser.
  - Dans cette tâche, toucher une tuile lance la génération avec les options par défaut, comme aujourd'hui. L'écran « Personnaliser » s'intercale ensuite (TASK-535).
- **Liste unique** sous la grille, sans titre :
  - d'abord les générations en cours (`queued` et `generating`), puis les fiches, de la plus récente à la plus ancienne ;
  - une ligne montre l'icône teintée du format, le titre écrit par le modèle, puis « Type · N sources (dossier seulement) · date relative » ;
  - une ligne `failed` dit l'échec et relance la génération d'un appui ;
  - fusionner `ArtifactTile` et `ArtifactHistoryRow` comme il convient, et supprimer ce qui ne sert plus. Rien n'est déployé : pas de couche de compatibilité.
- **Réponse `reused`** : quand la génération demandée existe déjà (`generation_outcome: reused`), ouvrir la fiche existante.
- **Ligne de génération animée**, sur le modèle de la maquette :
  - un reflet ambré la traverse de droite à gauche en boucle d'environ 1,8 s, et deux étincelles scintillent en décalé sur l'icône du format ;
  - textes : « Génération… », puis « <Format> · Quelques secondes · vous pouvez quitter l'écran » ;
  - la ligne ne s'ouvre pas ;
  - avec l'API `Animated` et le pilote natif, sans nouvelle dépendance native : pas de `expo-linear-gradient`, qui imposerait une nouvelle build ;
  - avec « Réduire les animations » (`AccessibilityInfo`), ni reflet ni scintillement : des étincelles fixes.
- Même composant sur l'écran média et sur l'écran dossier. Les textes sont dans les onze langues de `packages/core/src/i18n`. « Généré » (`artifacts.panel.generatedHeading`, `artifacts.status.generated`) est supprimé s'il ne sert plus ailleurs.

Note pour le propriétaire : contrôle visuel sur simulateur, en clair et en sombre, avec une génération en cours, une génération échouée et un dossier. Vérification manuelle, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L'onglet IA du média et du dossier affiche la grille « Générer » de quatre tuiles teintées (Résumé, Notes de cours, Cartes mémo, Quiz), toujours actives, sans état « Généré »
- [ ] #2 Une liste unique sans titre suit la grille : générations en cours d'abord, puis fiches par date décroissante, une ligne en échec relançant la génération d'un appui
- [ ] #3 Une génération répondue reused ouvre la fiche existante
- [ ] #4 La ligne en cours est animée (reflet et étincelles) avec Animated, sans nouvelle dépendance native, et reste statique quand Réduire les animations est activé
- [ ] #5 Les teintes de format sont des tokens de theme.ts en clair et en sombre
- [ ] #6 Les composants et clés i18n devenus inutiles (tuile « Généré », titre « Généré ») sont supprimés, et les nouveaux textes existent dans les onze langues
- [ ] #7 npm run typecheck et npm run lint passent dans mobile/
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Mise à jour 2026-10-26 : le résumé détaillé est supprimé (TASK-537, TASK-538). La grille compte **quatre** tuiles : Résumé, Notes de cours, Cartes mémo, Quiz, donc huit couleurs dans theme.ts au lieu de dix. Partout où la description dit « cinq », lire « quatre ». Cette tâche passe après TASK-538, qui retire déjà le type des tuiles.
<!-- SECTION:NOTES:END -->
