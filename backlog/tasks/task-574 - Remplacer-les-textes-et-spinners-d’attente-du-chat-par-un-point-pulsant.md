---
id: TASK-574
title: Remplacer les textes et spinners d’attente du chat par un point pulsant
status: Done
assignee:
  - '@codex'
created_date: '2026-10-30 13:50'
updated_date: '2026-10-30 13:54'
labels:
  - mobile
  - web
  - ui
dependencies: []
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback TestFlight ALkl458ZYZ4VlXhwcHOT3GU du 30 octobre 2026, build 18 : le propriétaire demande un point qui grossit et rétrécit entre l’envoi de la question et les premiers mots générés. La capture montre aussi une question conservée pendant extraction. Couvrir les chats média et dossier sur mobile et web, sans changer le traitement des questions. Validation visuelle sur iPhone après distribution à la charge du propriétaire.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les trois états avant réponse (attente de source, envoi, génération sans texte) utilisent le même point pulsant dans les fils mobile et web, avec annulation de la question en attente conservée.
- [x] #2 Le point cède la place au premier texte, reste statique avec réduction des animations et porte un libellé accessible localisé.
- [x] #3 Typecheck et lint mobile, core et web réussissent ; build web et exports iOS/Android réussissent.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Retrouver le commentaire et la capture TestFlight. 2. Remplacer les trois rendus d’attente par un point animé natif/CSS, avec réduction des animations et libellés existants pour accessibilité. 3. Vérifier types/lints, exports et rendu web ; documenter et fusionner sur main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Retour et capture récupérés directement dans App Store Connect via scripts/testflight_feedback.py (collecte privée ignorée par git). Point 16 pt dans une boîte stable 24 pt, échelle 0,65–1, cycle de 1,2 s, couleur textMain selon thème. Mobile : Animated avec pilote natif, isInteraction false, boucle arrêtée au démontage et sous Reduce Motion ; hook existant réutilisé. Web : animation CSS et media query prefers-reduced-motion. Les trois états utilisent le même composant par plateforme ; les libellés existants restent accessibles et localisés. Aucun service/session/API modifié, aucune dépendance ni test automatisé ajouté. Vérification manuelle dans Safari du vrai composant Thread avec états injectés en mémoire : attente source, envoi, génération vide, premiers mots, passage média/dossier et clair/sombre, activation du callback Annuler. Aperçu et export temporaire supprimés dans cette session. Types et lint des trois workspaces, build web et exports Hermes iOS/Android réussis. Installation propre via npm ci dans le worktree après détection du résolveur ESLint manquant dans les dépendances partagées. Avertissements : any préexistant purchaseService ; taille bundle web ; config Sentry/URL Expo sans variables de distribution. Réduction des animations vérifiée dans les chemins natif/CSS ; rendu natif, bascule système et parcours réseau réel non exercés, à vérifier sur appareil après distribution. OTA possible ; pas de push ni de distribution dans cette demande.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Point pulsant présent dès la question en attente et jusqu’aux premiers mots, sur mobile et web. Annulation et accessibilité conservées, réduction des animations respectée. Vérifications : types/lints mobile/core/web, build web, exports iOS/Android et contrôle manuel du fil dans Safari. Validation iPhone restante après distribution.
<!-- SECTION:FINAL_SUMMARY:END -->
