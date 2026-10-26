---
id: TASK-541
title: >-
  Refaire le volet IA du web sur le modèle de l'onglet IA mobile (TASK-534) :
  grille « Générer » toujours active, liste unique et ligne de génération animée
status: Done
assignee: []
created_date: '2026-10-26 19:12'
updated_date: '2026-10-26 20:09'
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
- [x] #1 Le volet IA du média et du dossier affiche quatre tuiles teintées toujours actives, sans état « Généré », et useAiPane ne compare plus les sources du dossier
- [x] #2 Une liste unique sans titre suit la grille : générations en cours d'abord, puis fiches par date décroissante ; une ligne en échec relance la génération d'un clic
- [x] #3 Une génération répondue reused ouvre la fiche existante
- [x] #4 La ligne en cours est animée en CSS (reflet et étincelles) et reste statique sous prefers-reduced-motion
- [x] #5 Les teintes et encres de format sont des variables de web/src/styles.css en clair et en sombre, aux valeurs de mobile/src/constants/theme.ts
- [x] #6 La clé artifacts.status.generated est supprimée des onze catalogues de packages/core/src/i18n
- [x] #7 npm run typecheck et npm run lint passent dans web/
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation 2026-10-26 (agent, branche worktree-agent-a7d1b16874d954f72).

- Composants : `web/src/components/ai/useAiPane.tsx` refait sur `ArtifactsPanel` et `useScopeArtifacts` du mobile. Ajoutés : `artifactFormats.ts` (les quatre formats : icône, libellé, classe de teinte ; miroir de `mobile/src/lib/artifactFormats.ts`) et `ArtifactRows.tsx` (`ArtifactRow` pour une fiche prête ou en échec, `ArtifactGeneratingRow`). Supprimés : `ARTIFACT_PILLS`, `pillOf`, `PillStatus`, `HistoryRow`, `latestByType`, la lecture de `/api/artifacts/{id}` pour les instantanés de sources, `sourcesChanged`, `generationAvailable`, la bannière « Les sources ont changé ». `FolderPage` ne calcule ni ne passe plus `scopeMediaIds`.
- Comportement : un clic sur une tuile dessine la ligne de génération tout de suite, et un second clic sur le même format pendant que son POST est en vol est ignoré (garde par ref, comme sur mobile). Une réponse `generation_outcome: reused` ouvre la fiche dans le volet. Une ligne en échec relance la génération d'un clic (le backend répond `retried` sous le même id). La ligne en cours ne s'ouvre pas. Le volet ouvert garde ses états « pas encore prête » et « échec » : une réponse `reused` peut désigner une génération partagée encore en cours.
- Animation : CSS seulement (`.gen-row` dans `styles.css`). Le reflet est un `::before` en dégradé à 100°, déplacé par `transform` de 100 % à -100 % en 1,8 s (ease-in-out), donc de droite à gauche, et en miroir sous `[dir="rtl"]`. Les deux étincelles (`twinkle`, 1,2 s) sont décalées d'une demi-période par un délai négatif. Sous `prefers-reduced-motion: reduce`, pas de reflet et des étincelles fixes, à pleine opacité.
- Couleurs : `--primary-ink`, `--artifact-{summary,notes,flashcards,quiz}-{tint,ink}` en clair et en sombre, aux valeurs de `theme.ts` (comparées une à une par script : les 18 sont égales). Ajout de `--sheen` (le primaire à 0,28, valeur de la maquette). La carte de génération est sur `--surface-container-low`, un cran au-dessus du volet, qui est en `--surface`. Mesure au pic du reflet : `--text-subtle` à 4,61:1 en clair et 5,02:1 en sombre. Les étincelles en `--primary-ink` sont à environ 2,85:1 sur cette carte en clair, contre 3,15:1 sur `surface` côté mobile. Elles sont décoratives : le texte dit ce qui se passe.
- i18n : `artifacts.status.generated` supprimée des onze catalogues de `packages/core/src/i18n`, ainsi que `artifacts.status.queued` et `artifacts.status.failed`. Le volet web était leur dernier lecteur (vérifié par grep sur `mobile/`, `web/`, `extension/` et `packages/core`). Côté web (`web/src/i18n`), suppression de `pane.history` (la liste n'a plus de titre), `ai.wholeFolder` (le titre de la grille est « Générer » seul, comme sur mobile) et `ai.sourcesChanged`.
- Effet de bord corrigé : les anciennes règles `.hist` du volet IA s'appliquaient aussi à la liste des conversations du volet Discussion, qui utilise le même nom de classe (marge intérieure et survol sur toute la liste). Les lignes IA s'appellent désormais `.art-row`.
- Commentaires de `packages/core` corrigés : `types/artifacts.ts` (aucun écran ne compare plus l'instantané des sources) et `artifacts/history.ts` (les tuiles ne lisent plus l'historique).
- Vérifications : `npm run typecheck`, `npm run lint` et `npm run build` passent dans `web/`. `npm run typecheck` et `npm run lint` passent dans `packages/core`, et `npm run typecheck` passe dans `mobile/` avec le `packages/core` de la branche.

À signaler au propriétaire :
- Texte de la ligne en échec : la clé imposée `artifacts.row.failed` dit « toucher pour réessayer » (« tap to retry »), un mot du mobile, qui se lit aussi sur le web.
- `mobile-design-mockups/web_app_owner_direction/README.md` décrit encore, pour le volet IA, des « grandes pastilles « Générer » (les 5 types) et Historique ». Non modifié : c'est la description de cette maquette.
- Icône des cartes mémo : `card-outline` gardée ; TASK-539 la remplace.

Hors de portée de cet agent : le contrôle visuel du volet IA d'un média et d'un dossier, en clair et en sombre, avec une génération en cours et une génération échouée. Seul le backend déployé fonctionne, et la branche n'est pas déployée.
<!-- SECTION:NOTES:END -->
