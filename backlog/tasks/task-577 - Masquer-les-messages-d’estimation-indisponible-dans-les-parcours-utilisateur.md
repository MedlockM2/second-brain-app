---
id: TASK-577
title: Masquer les messages d’estimation indisponible dans les parcours utilisateur
status: Done
assignee:
  - '@codex'
created_date: '2026-10-30 14:41'
updated_date: '2026-10-30 14:52'
labels:
  - mobile
  - web
dependencies: []
modified_files:
  - packages/core/src/budget/presentation.ts
  - mobile/src/components/BudgetForecastNotice.tsx
  - web/src/components/BudgetForecastNotice.tsx
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
  - packages/core/src/i18n/de.ts
  - packages/core/src/i18n/ar.ts
  - packages/core/src/i18n/it.ts
  - packages/core/src/i18n/es.ts
  - packages/core/src/i18n/en.ts
  - packages/core/src/i18n/zh.ts
  - packages/core/src/i18n/hi.ts
  - packages/core/src/i18n/fr.ts
  - packages/core/src/i18n/nl.ts
  - packages/core/src/i18n/pt.ts
  - packages/core/src/i18n/ja.ts
  - docs/TESTFLIGHT_2026_10_30_NEW_FEEDBACK.md
  - docs/testflight-feedback-log.md
priority: medium
type: bug
ordinal: 183000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback TestFlight AIsMzMKckUduufn3CFikm2g (build 18, 29 octobre) : dans un premier brouillon de chat dossier, « Estimation indisponible » apparaît au-dessus du composeur. Le propriétaire demande pourquoi et demande de supprimer tout message UI de ce type. Les prévisions disponibles et les vrais refus doivent conserver leur rôle ; la suppression vaut aussi pour les autres surfaces et le web.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une prévision absente, en attente ou indisponible n’affiche aucun message ni espace réservé sur mobile et web.
- [x] #2 Les estimations disponibles et refus explicites restent affichés ; les brouillons et la vérification de capacité lors de la soumission sont préservés.
- [x] #3 Le diagnostic de la capture et les limites de preuve sont documentés ; types/lint mobile/core/web passent.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Retourner null depuis forecastLine pour absence/attente/indisponibilité ; les deux composants retournent null sans nœud vide. 2. Supprimer les onze traductions sans lecteur et aligner le contrat documentaire. 3. Vérifier rendu manuel navigateur des états, types/lint et documenter la cause normale du premier chat sans conversation (aucune requête de forecast), sans prétendre avoir reproduit la session du testeur.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
forecastLine retourne null pour absence/attente/indisponibilité ; composants mobile/web ne rendent alors aucun nœud. Onze clés forecastUnavailable sans lecteur supprimées, contrat documentaire aligné. Capture : premier chat sans conversation => requête nulle, donc aucune prévision demandée ; un échec de réservation ne peut être déduit de ce message. État réseau historique non prouvé. Revue manuelle du vrai composant web dans Safari avec transport alimenté en mémoire : absence, unavailable et erreur HTTP sans message ; petite estimation et refus explicite toujours affichés ; brouillon conservé. Types/lint core/mobile/web et exports iOS/Android réussis. Aucun changement de l’admission serveur ni test automatisé. Documentation et registre renseignés ; vérification appareil après distribution restante.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Les prévisions absentes ou indisponibles deviennent silencieuses sur mobile et web, sans espace réservé. Estimations disponibles et vrais refus conservés. Le diagnostic distingue absence de prévision et réservation ; types/lint, exports et revue Safari réussis. OTA/web à distribuer.
<!-- SECTION:FINAL_SUMMARY:END -->
