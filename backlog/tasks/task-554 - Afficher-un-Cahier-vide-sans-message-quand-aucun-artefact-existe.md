---
id: TASK-554
title: Afficher un Cahier vide sans message quand aucun artefact existe
status: Done
assignee:
  - codex
created_date: '2026-10-27 10:17'
updated_date: '2026-10-27 10:20'
labels:
  - mobile
  - web
  - testflight
dependencies: []
modified_files:
  - mobile/src/components/ArtifactsPanel.tsx
  - web/src/components/ai/useAiPane.tsx
  - packages/core/src/i18n/ar.ts
  - packages/core/src/i18n/de.ts
  - packages/core/src/i18n/en.ts
  - packages/core/src/i18n/es.ts
  - packages/core/src/i18n/fr.ts
  - packages/core/src/i18n/hi.ts
  - packages/core/src/i18n/it.ts
  - packages/core/src/i18n/ja.ts
  - packages/core/src/i18n/nl.ts
  - packages/core/src/i18n/pt.ts
  - packages/core/src/i18n/zh.ts
priority: high
type: bug
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nouveau retour TestFlight AFfz26_1tCelQwKB2y5KiVk du 27 octobre 2026, build 17 (dernier build), iPhone 11 / iOS 26.6.2 : « Quand aucun artefact n’a encore été il ne faut rien afficher, actuellement on affiche un message d’erreur et un bouton Ressayer… ». La capture montre la grille de génération puis une erreur de chargement. Distinguer une liste vide chargée et une vraie panne ; diagnostiquer la cause du message observé. Appliquer le comportement aux médias et dossiers, mobile et web. Validation sur appareil après distribution à effectuer par le propriétaire.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les panneaux mobile et web ne rendent aucun message ni bouton sous la grille pour un historique chargé vide.
- [x] #2 Les vraies erreurs de lecture restent signalées et réessayables ; les générations en cours et les artefacts existants restent rendus.
- [x] #3 Le diagnostic de la capture et les limites de validation sont documentés sans identité de testeur.
- [x] #4 Typecheck et lint mobile, packages/core et web passent sans nouvelle erreur.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Relier la capture aux erreurs CloudWatch de la lecture des artefacts et inspecter uniquement les métadonnées utiles sur DynamoDB dev.
2. Supprimer les fixtures dev du type retiré summary_detailed qui font échouer la désérialisation ; conserver le modèle strict sans réintroduire de compatibilité ni migration. Vérifier la liste réelle après nettoyage.
3. Supprimer le rendu du message de liste vide dans ArtifactsPanel (médias et dossiers) et useAiPane (web), ainsi que la clé de traduction devenue sans lecteur. Conserver erreurs réelles, chargement et générations.
4. Exécuter les typechecks/lints mobile/core/web sans ajouter ni lancer de tests automatisés ; documenter diagnostic, nettoyage et validation appareil restante ; commit avec Feedback-Id et Web: done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Collecte App Store Connect le 27/10/2026 sur 720 h : 65 signalements retournés, un nouveau après déduplication par le registre et les branches feedback/*. Capture locale examinée ; build 17, dernier build disponible. Trois branches de propositions antérieures ont été exclues de cette nouvelle intervention.

Diagnostic CloudWatch /aws/lambda/media-summarizer-api-dev : artifact.list.failed, ValueError: summary_detailed is not a valid MediaArtifactType. Le type a été retiré par 282bc692 ; deux anciennes lignes ready subsistaient dans media_artifacts-dev et faisaient tomber toute leur liste avant le filtrage des types internes. Ce défaut est distinct du texte d’état vide. Nettoyage ponctuel des deux fixtures obsolètes sur dev, avec condition sur le type, sans shim, migration ni modification backend. Scan cohérent après suppression : zéro ligne summary_detailed. Lecture réelle de list_artifacts_by_scope contre DynamoDB dev : historique concerné désérialisé, deux lignes dont un review_blurb interne et un summary_short visible. Ce média conserve donc un résumé existant, il n’est pas vide après réparation.

Implémentation : mobile/src/components/ArtifactsPanel.tsx et web/src/components/ai/useAiPane.tsx ne rendent rien pour une liste chargée sans entrée terminée. Les lignes en cours restent dans leur bloc distinct ; chargement, vraie erreur avec Ressayer et refus de génération sont conservés. Le composant mobile est commun aux médias/dossiers et à iOS/Android ; le panneau web est commun aux médias/dossiers/Digest. Clé artifacts.panel.empty supprimée des onze catalogues car sans lecteur.

Vérifications : typecheck et lint mobile/core/web passent ; seul warning préexistant purchaseService.ts:136 (no-explicit-any) côté mobile. git diff --check propre. Relecture des branches de rendu : après chargement, liste vide = null ; erreurs de lecture et lignes de génération inchangées. Aucun test automatisé ajouté ou lancé, aucune instrumentation ajoutée. Aucun rendu/appareil validé : comparaison sur iOS/Android et navigateur après distribution reste à faire par le propriétaire. Le nettoyage dev prend effet immédiatement au prochain rechargement ; le changement de présentation JS/TS est compatible OTA, sans nouveau binaire natif ni déploiement backend requis. Branche feedback/cahier-vide, mémoire de déduplication via Feedback-Id du commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Un Cahier chargé vide laisse seulement la grille de génération, sur mobile et web ; le texte devenu inutile est retiré des onze catalogues. La vraie erreur du signalement venait de deux fixtures dev summary_detailed après retrait du type : supprimées, lecture DynamoDB réelle rétablie sans compatibilité. Les erreurs réelles et les générations restent affichées. Typecheck/lint mobile/core/web réussis (warning mobile préexistant), sans tests automatisés. Rendu sur appareil et navigateur à confirmer après distribution OTA ; aucun nouveau binaire ni changement backend.
<!-- SECTION:FINAL_SUMMARY:END -->
