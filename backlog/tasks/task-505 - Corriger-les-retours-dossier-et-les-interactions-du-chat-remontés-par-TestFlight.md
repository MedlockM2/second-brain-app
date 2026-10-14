---
id: TASK-505
title: >-
  Corriger les retours dossier et les interactions du chat remontés par
  TestFlight
status: Done
assignee:
  - codex
created_date: '2026-10-14 20:04'
updated_date: '2026-10-14 20:19'
labels:
  - mobile
  - chat
  - testflight
dependencies: []
priority: high
type: bug
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dix retours du 14 octobre demandent des citations activables sans liste Sources finale, retour au même passage du chat, navigation dossier sans spinner, historique simplifié et conservé, ouverture historique au bas, bouton bas, en-tête agrandi et identité visuelle média/dossier. Owner valide aussi extension aux sous-dossiers et historique. Validation appareil après OTA à effectuer par owner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les chargements au focus préservent le contenu dossier et le montage du chat ; les réponses obsolètes sont écartées.
- [x] #2 Les citations inline ouvrent leurs sources et la position de conversation survit au retour ; les intentions historique, nouveau fil et retour source sont distinctes.
- [x] #3 Historique conservé et simplifié, en-têtes agrandis, identité de scope et raccourci vers le bas sont câblés avec traductions.
- [x] #4 Typecheck et lint mobile/core réussissent sans nouveaux tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Préserver les dossiers pendant actualisation et supprimer la route racine sans lecteur. 2. Garder état de présentation et historique dans ChatDock. 3. Rendre les citations accessibles et actives, supprimer la liste finale. 4. Gérer les trois intentions de scroll, bouton bas et en-tête commun. 5. Vérifier les contrôles et consigner les feedbacks sans identités.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Retour dossier : liste et dock gardés pendant actualisation ; erreurs non bloquantes, invalidation des lectures périmées, extension à tous les sous-dossiers. Route racine sans lecteur retirée avec son enregistrement Stack. ChatDock garde position et liste historique au-dessus du modal démonté ; retour citation sans autofocus ni suivi forcé du bas. La sélection historique attend la bonne conversation puis descend après layout ; échecs et sélections obsolètes restent protégés. Liens jaunes avec actions accessibles, liste Sources finale supprimée et source initiale conservée. Historique titre/poubelle, cartes 72, en-tête minimum 56/titre 18/icônes 26, vignette média ou icône dossier. Bouton bas traduit dans 11 langues, relecture manuelle distincte du suivi pendant streaming et Réduire les animations pris en compte. Anciennes traductions sans lecteur supprimées.
Validation : revue des chemins de navigation, typecheck mobile/core/web et lint mobile/core sans erreur ; exports Hermes iOS/Android réussis et diff --check propre. Un warning any préexistant dans purchaseService. Aucun test automatisé ajouté. Gestes, clavier, VoiceOver/TalkBack, retour citation et défilement réel restent à vérifier sur appareil après OTA ; aucun simulateur utilisable. Le décalage flèche/swipe est identifié dans les sources installées : action JS avant transition versus onDismissed après geste natif ; pas de mesure des timings du build utilisateur.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrige navigation dossier sans remplacement par spinner, liens inline et retour au passage du chat, historique conservé/simplifié, ouverture au bas, bouton bas et en-têtes avec identité visuelle. Typecheck/lint mobile/core, typecheck web et export iOS/Android réussis ; vérification appareil explicitement restante.
<!-- SECTION:FINAL_SUMMARY:END -->
