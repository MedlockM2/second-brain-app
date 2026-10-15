---
id: TASK-508
title: Placer le dialogue de nouveau dossier juste au-dessus du clavier
status: Done
assignee:
  - codex
created_date: '2026-10-14 22:29'
updated_date: '2026-10-15 08:04'
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
- [x] #4 Le premier affichage visible de la carte utilise la position finale fournie par le clavier ; aucun KeyboardAvoidingView ou LayoutAnimation ne fait remonter la carte depuis le bas de l’écran.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remplacer l’ancrage haut par une zone clavier unique et un formulaire aligné en bas. 2. Conserver les marges et le défilement. 3. Contrôles locaux, commit, intégration main et push.

Retour owner TestFlight du 2026-10-15 : le placement final est correct mais la carte translate depuis dessous le clavier. Retirer KeyboardAvoidingView, demander le focus après présentation du Modal, récupérer la destination du clavier avant de révéler le formulaire et conserver un seul calcul de zone disponible.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Le retour TestFlight du 2026-10-15 a révélé que KeyboardAvoidingView animait encore la carte depuis le bas : le placement final du premier correctif était correct, mais pas son arrivée. Ce mécanisme est supprimé.

Le champ prend désormais le focus dans Modal.onShow, après enregistrement des événements clavier. La carte reste transparente jusqu'à réception de la destination du clavier, mesure de la fenêtre native et confirmation de la mise en page à cette hauteur. iOS utilise keyboardWillShow avant l'animation système ; Android utilise keyboardDidShow et la fenêtre redimensionnée. Les ajustements automatiques du ScrollView sont désactivés. La fermeture d'un clavier provenant de l'écran sous-jacent ne débloque pas prématurément la première apparition. Les changements de géométrie restent suivis pendant la saisie, sans KeyboardAvoidingView ni LayoutAnimation.

Marge de 16 points, zones sûres, défilement et fond de fermeture conservés. Chaque ouverture remonte un formulaire neuf ; création et renommage partagent ce comportement. Un repli après une seconde rend le formulaire accessible si un clavier matériel ou un IME ne publie aucun événement ; ce délai ne pilote pas l'ouverture normale avec clavier logiciel.

Validation locale le 2026-10-15 : typecheck mobile réussi, lint mobile sans erreur (warning any préexistant dans purchaseService.ts), exports Expo iOS et Android réussis, revue du diff et git diff --check propres. Aucun test automatisé ajouté. Aucun simulateur iOS ni adb disponible sur ce poste : première image visible et fluidité à confirmer sur appareil après OTA. Scénarios restants : nouveau dossier depuis les différents points d'entrée, renommage, recherche avec clavier déjà ouvert, fermeture/réouverture, erreur serveur, changement de clavier/orientation, grandes polices et petites tailles d'écran, clavier matériel, sur iOS et Android.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le dialogue de saisie attend la géométrie finale du clavier et sa mise en page avant sa première apparition, avec marge de 16 points et sans animation de remontée. Focus après présentation du Modal et suppression de KeyboardAvoidingView. Typecheck/lint mobile et exports iOS/Android réussis ; validation visuelle native à confirmer après OTA.
<!-- SECTION:FINAL_SUMMARY:END -->
