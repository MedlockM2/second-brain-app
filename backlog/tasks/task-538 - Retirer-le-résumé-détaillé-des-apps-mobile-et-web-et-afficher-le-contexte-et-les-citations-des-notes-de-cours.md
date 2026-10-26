---
id: TASK-538
title: >-
  Retirer le résumé détaillé des apps mobile et web et afficher le contexte et
  les citations des notes de cours
status: Done
assignee: []
created_date: '2026-10-26 17:00'
updated_date: '2026-10-26 17:24'
labels:
  - mobile
  - web
  - artifacts
  - cleanup
dependencies:
  - TASK-537
references:
  - 'mobile/app/artifacts/[artifactId].tsx'
  - mobile/src/components/ArtifactTile.tsx
  - mobile/src/components/CompletedDetailView.tsx
  - mobile/src/lib/artifactContentBlock.ts
  - packages/core/src/artifacts/content.ts
  - packages/core/src/types/media.ts
  - packages/core/src/i18n/fr.ts
  - web/src/components/ai/ArtifactBody.tsx
  - web/src/components/ai/useAiPane.tsx
priority: high
type: chore
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

TASK-537 supprime `summary_detailed` du backend et ajoute aux notes de cours `context` (2-3 phrases) et `notable_quotes` (`{text, source_ref}`). Les clients doivent suivre : retirer le type, afficher les nouveaux champs. Rien n'est déployé : on supprime sans compatibilité.

## Périmètre

- **Retirer `summary_detailed`** :
  - du type `ArtifactKind`, de `normalizeArtifactKind` et du commentaire de schéma (`packages/core/src/artifacts/content.ts`, `packages/core/src/types/media.ts`) ;
  - de la tuile et de l'état initial des tuiles (`ArtifactTile.tsx`, `CompletedDetailView.tsx`, `app/media/folders/[id].tsx`) ;
  - de `artifactContentBlock.ts` et de l'écran de fiche mobile (`SummaryDetailedBody`, libellé, icône) ;
  - du panneau IA web (`useAiPane.tsx`, `ArtifactBody.tsx`).
  - Les clés i18n propres au résumé détaillé (`artifacts.type.summaryDetailed`, sections `mainTopics`, `context` s'il n'est pas réutilisé, etc.) sont supprimées dans les onze langues si plus rien ne les lit.
- **Notes de cours, mobile et web** :
  - `context` s'affiche en paragraphe d'introduction, sous le titre et avant les objectifs ;
  - `notable_quotes` s'affiche en section « Citations » après les points clés, avec la carte de citation qu'utilisait le résumé détaillé (déplacée, pas dupliquée) ;
  - les deux sont lus avec les lecteurs défensifs de `content.ts` (`pickString`, `pickQuotes`), et un champ absent n'affiche rien.
- **`source_ref`** : l'étiquette s'affiche comme aujourd'hui sous la citation. Sa résolution en titre de source n'est pas dans le périmètre.

Note pour le propriétaire : contrôle visuel de notes de cours générées après TASK-537, sur mobile et web, en clair et en sombre. Vérification manuelle, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 summary_detailed n'apparaît plus dans packages/core, mobile/ ni web/src (types, tuiles, écran de fiche, panneau IA web)
- [x] #2 Les clés i18n devenues inutiles sont supprimées dans les onze langues
- [x] #3 Les notes de cours affichent context en introduction et notable_quotes en section Citations après les points clés, sur mobile et sur web, et n'affichent rien pour un champ absent
- [x] #4 La carte de citation est déplacée vers le rendu des notes, sans copie
- [x] #5 npm run typecheck et npm run lint passent dans mobile/, et la vérification de types passe dans web/ et packages/core
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Fait**
- `packages/core` : `summary_detailed` retiré de `ArtifactKind`, `normalizeArtifactKind` et `ArtifactType`. Le commentaire de schéma de `content.ts` décrit désormais les notes avec `title`, `context` et `notable_quotes`, et précise qu'une section vide n'est pas dessinée.
- i18n : `artifacts.type.summaryDetailed`, `artifact.section.context`, `artifact.section.mainTopics` et `artifact.section.conclusion` supprimées des onze catalogues. `artifact.section.context` n'est pas réutilisée, parce que le contexte des notes est un paragraphe d'introduction sans titre de section. `artifact.section.quotes` est gardée, la section Citations des notes la lit.
- Mobile, écran de fiche (`app/artifacts/[artifactId].tsx`) :
  - `SummaryDetailedBody`, son libellé, son icône et les styles `topicChip*` sont supprimés ;
  - `NotesBody` affiche `context` en premier bloc, sans titre, puis `notable_quotes` en section Citations après les points clés. La carte de citation (`quoteCard`, `quoteMark`, `quoteText`, `quoteSourceRef`) a été déplacée de l'ancien corps vers les notes. L'étiquette `source_ref` s'affiche sous la citation, comme avant.
  - L'écran lit maintenant tout le contenu avec les lecteurs de `@media-summarizer/core/artifacts/content` (`pickString`, `pickQuotes`, etc.). Ses copies locales, identiques, sont supprimées, comme le prévoyait le commentaire de `content.ts`.
- Mobile, tuiles : entrée retirée de `ARTIFACT_TILES`, de l'état initial de `CompletedDetailView` et de `ARTIFACT_TYPES` dans `artifactContentBlock.ts`. `app/media/folders/[id].tsx` construit son état depuis `ARTIFACT_TILES` et n'avait rien à changer. Les commentaires « five tiles » d'`ArtifactTile` et `ArtifactsPanel` disent maintenant « four ».
- Maestro `04_media_detail_progression.yaml` : l'assertion sur la tuile « Detailed summary » est retirée, sinon le flow échouait.
- Web : pilule retirée de `ARTIFACT_PILLS` (`useAiPane.tsx`), `SummaryDetailed` supprimé (`ArtifactBody.tsx`). `Notes` affiche `context` en tête, sous le titre de la fiche que pose `useAiPane`, et les citations après les points clés. Le `blockquote.quote` a été déplacé, pas copié. L'icône `reader-outline`, que seule la pilule utilisait, est retirée de `web/scripts/extract_icons.py`. `icons.generated.ts` a été régénéré par le script : une ligne en moins.
- Champ absent : `pickString` et `pickQuotes` renvoient `null` pour une valeur absente, vide ou mal formée, et le rendu n'affiche alors rien, sur mobile comme sur web.

**Vérifications**
- `npm run typecheck` : propre dans `mobile/`, `web/` et `packages/core` (aucune erreur, avant comme après).
- `npm run lint` : `mobile/` donne 0 erreur et 1 avertissement, antérieur, dans `src/services/purchaseService.ts` (fichier non touché). `web/` et `packages/core` sont propres.
- `grep -rni "summary_detailed\|summaryDetailed\|detailed summar"` sur `packages/core`, `mobile/` et `web/src` (hors `node_modules`) : aucun résultat. Même chose pour `section.context`, `section.mainTopics`, `section.conclusion` et `main_topics`.

**Hors périmètre, signalé**
- Sur mobile, les notes n'affichent pas le titre écrit par le modèle. Le titre du haut de l'écran vient de `pickSourceTitle`, qui lit `payload.source`. Or l'enveloppe ne porte plus que `sources`. Le contexte s'affiche donc juste sous la puce de type. C'était déjà le cas avant cette tâche.
- `docs/store-listing/app-store-connect.md` cite encore les résumés courts et détaillés (lignes 302 et 362). C'est un texte de store, donc une décision du propriétaire.
- L'alias `summary`, plus émis par le backend, reste dans les types clients. Avant de le retirer, vérifier qu'aucune entrée `summary` ne reste dans `media_artifacts-dev`, parce que `normalizeArtifactKind` lit tout type inconnu comme un quiz.
<!-- SECTION:NOTES:END -->
