---
id: TASK-504
title: >-
  Corriger la bibliothèque, les couvertures et le dialogue dossier remontés par
  TestFlight
status: Done
assignee:
  - codex
created_date: '2026-10-14 20:04'
updated_date: '2026-10-14 20:19'
labels:
  - mobile
  - testflight
dependencies: []
priority: high
type: bug
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Retours du 14 octobre 2026 : couverture Accueil bloquée après erreur (AK0MY3U0ch3FF0QcgFd6kf0), bibliothèque limitée à 20 (AIapqbu1QDh54HIl_gaS14g), dialogue de création qui se déplace avec le clavier (ABi74wGPiXhCvA48oHHTxiA). Correctifs validés par owner, iOS et Android. Validation visuelle sur appareil après OTA relève de la checklist owner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le service et la liste bibliothèque exploitent les curseurs canoniques sans perdre les pages au rafraîchissement.
- [x] #2 Les couvertures peuvent récupérer après un échec transitoire et le dialogue utilise un placement stable indépendant du centrage clavier.
- [x] #3 Typecheck et lint mobile/core passent sans ajout de tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ajouter pagination avec verrou et protection des résultats obsolètes. 2. Remplacer le verrou permanent image par une reprise bornée par URL et visibilité. 3. Ancrer le dialogue dans la safe area avec contenu défilable. 4. Vérifier statiquement et documenter la validation appareil restante.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation revue : listMedia transporte le curseur canonique ; FlatList charge la suite, déduplique et conserve sa fenêtre lors des lectures au focus/polling. total provient de total_filtered (avant pagination). Mutations locales invalident les résultats anciens. useRecoverableImage rattache l’erreur à une tentative/URL/snapshot, reprend sur focus et premier plan, garde la clé de cache stable ; appliqué aussi aux cartes détail et Digest après recherche des mêmes verrous. Dialogue ancré sous safe area avec scroll et insets clavier, animation de recentrage retirée.
Validation : typecheck mobile/core/web et lint mobile/core sans erreur, export Expo iOS/Android (Hermes) réussi, diff --check propre. Un warning any préexistant dans purchaseService reste inchangé. Aucun test automatisé ni instrumentation ajoutés. La couverture signalée a été lue sur S3 sans écriture et décodée lors du diagnostic ; le premier incident réseau reste inconnu. Validation appareil (panne image, plus de 20 éléments, clavier et grandes polices) non effectuée : simctl indisponible. Owner l’effectue après distribution OTA.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrige pagination complète de bibliothèque, reprise des couvertures et dialogue dossier stable. Vérifié par typecheck/lint mobile et core, typecheck web et export des bundles iOS/Android ; validation native restant à faire après OTA.
<!-- SECTION:FINAL_SUMMARY:END -->
