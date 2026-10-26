---
id: TASK-538
title: >-
  Retirer le résumé détaillé des apps mobile et web et afficher le contexte et
  les citations des notes de cours
status: To Do
assignee: []
created_date: '2026-10-26 17:00'
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
- [ ] #1 summary_detailed n'apparaît plus dans packages/core, mobile/ ni web/src (types, tuiles, écran de fiche, panneau IA web)
- [ ] #2 Les clés i18n devenues inutiles sont supprimées dans les onze langues
- [ ] #3 Les notes de cours affichent context en introduction et notable_quotes en section Citations après les points clés, sur mobile et sur web, et n'affichent rien pour un champ absent
- [ ] #4 La carte de citation est déplacée vers le rendu des notes, sans copie
- [ ] #5 npm run typecheck et npm run lint passent dans mobile/, et la vérification de types passe dans web/ et packages/core
<!-- AC:END -->
