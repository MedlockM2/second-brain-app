---
id: TASK-575
title: Afficher le Digest de la journée et de la semaine en cours hors notification
status: Done
assignee:
  - '@codex'
created_date: '2026-10-30 14:41'
updated_date: '2026-10-30 14:52'
labels:
  - backend
  - mobile
  - web
dependencies: []
modified_files:
  - media_summarizer/api/endpoints/digest.py
  - media_summarizer/core/services/digest_service.py
  - media_summarizer/utils/digest_db.py
  - mobile/src/services/digestService.ts
  - packages/core/src/types/digest.ts
  - docs/MOBILE_RESOURCE_CACHE.md
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
  - web/src/i18n/de.ts
  - web/src/i18n/ar.ts
  - web/src/i18n/it.ts
  - web/src/i18n/es.ts
  - web/src/i18n/en.ts
  - web/src/i18n/zh.ts
  - web/src/i18n/hi.ts
  - web/src/i18n/fr.ts
  - web/src/i18n/nl.ts
  - web/src/i18n/pt.ts
  - web/src/i18n/ja.ts
  - docs/TESTFLIGHT_2026_10_30_NEW_FEEDBACK.md
  - docs/testflight-feedback-log.md
priority: high
type: bug
ordinal: 181000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Feedback TestFlight ALHsTSDwD6sjpkheHJIHHlA (build 18, 29 octobre) : les deux cartes restent vides hors du moment de notification. Le propriétaire demande un Digest de chaque période en cours disponible à toute ouverture, sans recalcul complet à chaque visite. La nouvelle demande remplace pour la consultation le choix historique de TASK-366, qui exposait uniquement la dernière période notifiée. Préserver les notifications et ne générer aucun artefact automatiquement. Mobile et web doivent montrer la même période.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La consultation quotidienne porte sur la journée locale en cours et la consultation hebdomadaire sur la semaine locale en cours, en ordre chronologique.
- [x] #2 Les compositions sont réutilisées côté serveur entre les ouvertures avec une fraîcheur bornée documentée, y compris les périodes vides ; aucun appel fournisseur ni génération automatique.
- [x] #3 Les médias supprimés restent exclus, les notifications conservent leur calendrier et leur idempotence, et la documentation décrit les périodes et les limites de fraîcheur.
- [x] #4 Ruff/mypy backend et types/lint mobile/core/web passent ; les vérifications après déploiement sont documentées comme suivi propriétaire.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ajouter une composition consultable de la journée locale et semaine ISO en cours dans digest_service, distincte des captures notifiées. Réutiliser DynamoDB pendant cinq minutes, vides inclus, avec une clé stable par type et fuseau (remplacée au changement de période, sans accumulation de caches). 2. Garder les fenêtres et claims du scheduler ; conserver le filtrage de visibilité des endpoints. 3. Aligner commentaires, onze langues et documentation mobile/web. 4. Vérifier Ruff/mypy/types/lint, build web, exports natifs et lecture réelle DynamoDB dev sans envoi ni génération ; documenter suivi après déploiement.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Preuve réelle -dev avec fixtures temporaires : cache vide réutilisé ; après vieillissement de sa ligne DynamoDB, quotidien = 2 médias du jour, hebdomadaire = 3 de la semaine, ordre chronologique ; seconde lecture réutilise le cache rempli. Visibilité après suppression = 1 média quotidien ; ancienne clé de période rejetée ; Pacific/Kiritimati passe au 31 octobre quand Paris reste au 30. Quatre médias et trois caches de fixture nettoyés. Aucun envoi, fournisseur ou artefact. Scheduler et claims non modifiés ; clés current distinctes. Préférences contrôlent les notifications, plus l’accès lecture. Types/lint mobile/core/web, Ruff/mypy 213 fichiers, build web et exports iOS/Android réussis. Revue Safari des libellés FR/EN et états vides réels avec données en mémoire. Warning any préexistant de purchaseService, avertissements Expo/Sentry locaux et taille du bundle web. Documentation : docs/TESTFLIGHT_2026_10_30_NEW_FEEDBACK.md et docs/MOBILE_RESOURCE_CACHE.md. Pas de preuve appareil ni endpoint déployé : suivi après fusion uniquement.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le Digest consultable suit désormais la journée et la semaine ISO locales courantes avec un cache DynamoDB partagé cinq minutes, vides inclus, sans génération ni recalcul à chaque ouverture. Les captures et horaires des notifications restent distincts, et les suppressions sont filtrées. Onze langues mobile/web alignées ; preuves dev et contrôles locaux réussis. API puis OTA/web à distribuer, vérification appareil restante.
<!-- SECTION:FINAL_SUMMARY:END -->
