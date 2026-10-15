---
id: TASK-512
title: Alléger l’en-tête média et ouvrir l’original depuis le titre
status: Done
assignee:
  - codex
created_date: '2026-10-15 08:41'
updated_date: '2026-10-15 08:56'
labels:
  - mobile
  - testflight
dependencies: []
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback APkn55PhKyb2jltDjMEwx_U accepté le 15 octobre 2026 : supprimer la bande source/date/durée/langue/paragraphes, rendre le titre visiblement cliquable vers l’original, laisser davantage voir l’image à travers son bandeau. Préserver lisibilité et réduction de transparence. Aucun faux lien sur un média sans URL d’origine exploitable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La bande de métadonnées et ses calculs devenus inutiles sont supprimés du lecteur mobile.
- [x] #2 Les titres principal et rétracté proposent le lien original existant lorsqu’il est disponible, avec indication visuelle et accessible.
- [x] #3 Le bandeau de titre utilise un voile plus transparent et un matériau local, sans rendre son conteneur natif semi-opaque ; Réduire la transparence reste respecté.
- [x] #4 Typecheck/lint mobile passent ; limites visuelles et plateforme documentées sans tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Retirer méta-ligne et calculs du détail ; transmettre le lien existant aux titres hero/rétracté avec soulignement, icône externe, rôle et libellé. Remplacer pour ce bandeau seul le verre adaptatif/voile 72% par flou local existant avec voile atténué et contraste calculé, respecter réduction de transparence et Android SDK55. Retirer commentaires obsolètes. Contrôles statiques/export et limites visuelles documentées.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bande et calculs de date/durée/langue/paragraphes retirés. Titre hero et titre rétracté ouvrent origin_url ou original_url HTTP(S), soulignement, icône externe, rôle lien et nom accessible ; aucun faux lien. Nouveau token mediaTitleVeil alpha .64, sans modifier coverTitleVeil du Digest. Flou local expo-blur déjà installé, cible limitée à l’image ; Android SDK31+ flouté, plus ancien teinté pour éviter RenderScript. Réduire la transparence reste opaque. Contraste numérique au pire cas : clair 5,14:1, sombre 4,61:1. Typecheck/lint mobile/core et typecheck web passent, exports iOS/Android réussis. Aucun test ajouté. Photos réelles et comportement natif à valider après distribution ; sources Expo/W3C dans le document de livraison.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le titre remplace le lien de la bande de métadonnées supprimée. Bandeau plus transparent avec flou local et contraste calculé conservé dans les deux thèmes, accessibilité de transparence respectée. Types/lint et exports passent ; inspection visuelle sur appareil restante.
<!-- SECTION:FINAL_SUMMARY:END -->
