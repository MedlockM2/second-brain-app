---
id: TASK-513
title: Préserver et afficher les tableaux Markdown des extractions
status: Done
assignee:
  - codex
created_date: '2026-10-15 08:41'
updated_date: '2026-10-15 08:56'
labels:
  - mobile
  - backend
  - testflight
dependencies: []
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback AI6-EaM_M6h7liw_P5ktu7k accepté le 15 octobre 2026 : le texte extrait affiche pipes, séparateurs, gras et br littéraux. Préserver la structure des tableaux avant reformatage de prose et afficher des cellules lisibles dans le lecteur et son corps source du chat. Réutiliser le parseur partagé existant ; aucun changement de fournisseur OCR/LLM.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le formatage de contenu préserve les blocs Markdown structurés sans les découper comme de la prose.
- [x] #2 Le parseur partagé et le lecteur mobile prennent en charge les tableaux GFM, les cellules mises en forme et les retours br explicites, avec défilement horizontal local.
- [x] #3 Le rendu des transcriptions ordinaires conserve paragraphes et étiquettes de locuteurs ; aucun HTML arbitraire n’est exécuté.
- [x] #4 Ruff/mypy et typecheck/lint mobile/core ainsi que typecheck web passent ; validation native restante documentée sans tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Vérifier original/traduction S3 en lecture seule. Préserver les documents Markdown structurés dans normalize_transcript_text avant nettoyage/jonction de prose, sans changer le prompt ni régénérer les objets. Étendre le parseur partagé avec tables GFM et br. Déplacer le rendu chat vers MarkdownBody partagé, l’utiliser pour les extractions structurées de TranscriptReader ; garder les transcriptions ordinaires et Speaker. Ruff/mypy backend, types/lint mobile/core, typecheck web et exports iOS/Android ; aucun test automatisé.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lecture seule AWS dev : original 1887 caractères/13 lignes/8 lignes de tableau et traduction française 2117 caractères/12 lignes/8 lignes de tableau, structures intactes. Défaut de normalisation à la lecture puis rendu Text brut confirmé. Pas de mutation S3, de modification de prompt ni de migration. Normaliseur conserve les documents structurés ; parseur GFM avec en-tête, alignements, cellules vides, pipes échappés et br explicites. MarkdownBody mobile factorise ChatAnswer (ancien fichier supprimé), utilisé par TranscriptReader et donc par le corps source-first et le Digest. Les transcriptions ordinaires gardent leur rendu et leurs locuteurs. HTML arbitraire non exécuté. Ruff backend complet et mypy 205 fichiers propres ; types/lint mobile/core et types web propres, exports natifs réussis. Aucun test ajouté/exécuté ; rendu/gestes natifs à confirmer après déploiement backend et distribution.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Les tableaux déjà intacts dans S3 ne sont plus aplatis en prose lors de la lecture et disposent d’un rendu mobile en cellules avec défilement horizontal local. Parseur neutre partagé, rendu commun source/chat, transcriptions ordinaires préservées. Ruff/mypy, types/lint et exports passent ; validation native après distribution restante.
<!-- SECTION:FINAL_SUMMARY:END -->
