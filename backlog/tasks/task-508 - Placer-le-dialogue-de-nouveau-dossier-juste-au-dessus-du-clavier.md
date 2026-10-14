---
id: TASK-508
title: Placer le dialogue de nouveau dossier juste au-dessus du clavier
status: Done
assignee:
  - codex
created_date: '2026-10-14 22:29'
updated_date: '2026-10-14 22:31'
labels:
  - mobile
  - ux
dependencies: []
references:
  - task-504
priority: medium
type: bug
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ajustement demandé par owner après validation du correctif TestFlight : remplacer l’ancrage haut du dialogue de nouveau dossier par un placement juste au-dessus du clavier. Le composant de saisie est partagé avec les renommages. Conserver une petite marge, les zones sûres, le défilement pour grands textes et les actions accessibles. Aucun changement natif ni dépendance supplémentaire.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le dialogue partagé de saisie est aligné au bas de la zone disponible au-dessus du clavier, avec une marge, sans centrage vertical.
- [x] #2 Le fond de fermeture couvre le modal, le contenu reste défilable et les ajustements clavier ne se cumulent pas sur iOS/Android.
- [x] #3 Typecheck/lint mobile et exports Expo iOS/Android réussissent sans ajout de tests ; les vérifications appareil restantes sont documentées.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remplacer l’ancrage haut par une zone clavier unique et un formulaire aligné en bas. 2. Conserver les marges et le défilement. 3. Contrôles locaux, commit, intégration main et push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RenameDialog aligne maintenant sa carte en bas de la zone disponible, à Spacing.md (16 points) du clavier. KeyboardAvoidingView gère uniquement le padding iOS ; Android conserve le redimensionnement natif du Modal. Les insets clavier automatiques du ScrollView sont désactivés pour éviter le double décalage. Le formulaire reste défilable ; la marge de sécurité basse ne s’ajoute que lorsque le clavier est fermé. Son suivi clavier est monté uniquement avec le dialogue visible. Le fond assombri couvre la totalité du Modal et la zone transparente autour de la carte conserve la fermeture au toucher. Composant partagé : création et renommage ont le même placement. Validation locale le 2026-10-15 : typecheck et lint mobile sans erreur (seul warning any préexistant dans purchaseService.ts), exports Expo iOS/Android réussis et revue du diff propre. Aucun test automatisé ajouté. Validation native restante après OTA : ouverture depuis le bouton plus et le menu média, clavier déjà ouvert depuis la recherche, fermeture/réouverture, message d’erreur, petites tailles d’écran et grande police, sur iOS et Android.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dialogue de saisie placé juste au-dessus du clavier avec marge de 16 points, zone sûre et défilement conservés. Contrôles locaux et exports réussis ; validation visuelle sur appareil à confirmer après OTA.
<!-- SECTION:FINAL_SUMMARY:END -->
