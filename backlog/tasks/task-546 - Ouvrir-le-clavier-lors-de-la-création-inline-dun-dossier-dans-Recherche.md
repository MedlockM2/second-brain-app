---
id: TASK-546
title: Afficher le clavier pour les nouveaux dossiers de Recherche
status: Done
assignee:
  - '@codex'
created_date: '2026-10-26 22:16'
updated_date: '2026-10-26 22:20'
labels:
  - mobile
  - android
dependencies: []
references:
  - mobile/app/(tabs)/search.tsx
documentation:
  - docs/ANDROID_KEYBOARD_FIX_2026_10_26.md
priority: high
type: bug
ordinal: 152000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Capture Android du 26 octobre 2026 : après Nouveau dossier dans Recherche, le champ de nom est affiché avec son texte sélectionné mais le clavier logiciel est absent. Symptôme distinct des modales recouvertes de TASK-544 : ici le dossier est édité directement dans la grille. Le code demande le focus depuis un effet React sans synchronisation avec le premier layout du TextInput, et passe la FlatList en keyboardShouldPersistTaps never pendant cette édition. Conserver la création optimiste et la clé de champ stable introduites par TASK-517. La cause native exacte ne peut pas être prouvée par la capture seule ; corriger les fragilités du chemin de focus et documenter une recette sur appareil, sans publication.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le premier focus de création inline est demandé après le layout du champ, avec invalidation des demandes périmées ; la réconciliation de lid serveur ne redemande pas le focus ni ne remonte le champ.
- [x] #2 Les taps sur le champ inline ne sont plus interceptés par une FlatList en mode never ; les chemins de validation au clavier, par perte de focus et par actions extérieures restent câblés.
- [x] #3 Typecheck et lint mobile ainsi que les exports Android et iOS passent ; la recette de création et ses limites de validation native sont documentées, sans nouveaux tests automatisés.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Synchroniser le focus initial du champ inline avec son layout natif et une frame de présentation, en conservant son identité de création pendant la réconciliation serveur. 2. Limiter les demandes de focus au montage, à une reprise de focus écran ou à la révision après erreur ; invalider les callbacks périmés et conserver la validation existante. 3. Garder keyboardShouldPersistTaps handled pendant la saisie, vérifier types/lint et exports Hermes natifs, puis compléter la recette manuelle sans publier.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Capture examinée : champ inline sélectionné dans la grille, sans clavier. Le symptôme est distinct du recouvrement par IME des modales de TASK-544 ; absence de reproduction native, donc mécanisme exact sur le téléphone non établi. Correctif ciblé de search.tsx : focus conditionné au premier layout de taille positive du TextInput puis demandé à la frame suivante ; invalidation synchrone au commit et au démontage ; une demande par champ, identité de création et révision après erreur. Le passage de l’identité locale à celle du serveur conserve la clé de montage et ne refocalise pas un champ déjà traité. Les layouts ultérieurs ne rouvrent pas un clavier volontairement fermé. FlatList conserve handled pendant la saisie afin de transmettre directement les taps au champ ; validation par Terminé, perte de focus et handlers extérieurs conservée. Aucun changement de logique métier, dépendance ou code partagé.

Vérifications : typecheck et lint mobile terminés avec code 0, seul avertissement any préexistant de purchaseService ; exports Hermes Android et iOS terminés avec code 0 dans /tmp/deepn-task546-android et /tmp/deepn-task546-ios ; revue du diff, espaces et chaînes sensibles propres. Les AC 1 et 2 portent sur les chemins de code et leur câblage, pas sur une recette native accomplie. Aucun test automatisé ajouté ou exécuté. Recette ciblée ajoutée à docs/ANDROID_KEYBOARD_FIX_2026_10_26.md : grilles ouverte/repliée/longue, clavier déjà ouvert, réponse réseau rapide/lente, Retour et refocus, validation, erreur et changement d’onglet. Résolution sur le téléphone de la capture encore à confirmer après distribution. Web: n/a (synchronisation du focus et du clavier natifs Android). Patch local, aucun commit, push ni distribution.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Chemin de focus inline synchronisé avec le layout du champ et stabilisé sur son identité de création ; taps directs conservés pendant la saisie. Typecheck/lint mobile et exports Android/iOS réussis. Correction candidate de TASK-546 documentée avec recette sur appareil encore à effectuer. Aucun test automatisé ni publication.
<!-- SECTION:FINAL_SUMMARY:END -->
