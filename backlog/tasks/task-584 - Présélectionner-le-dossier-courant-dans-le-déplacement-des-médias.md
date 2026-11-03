---
id: TASK-584
title: Présélectionner le dossier courant dans le déplacement des médias
status: Done
assignee:
  - '@codex'
created_date: '2026-11-03 20:23'
updated_date: '2026-11-03 20:27'
labels:
  - mobile
  - web
  - backend
  - testflight
dependencies: []
priority: high
type: bug
ordinal: 187000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Retour TestFlight AE_liWMc_HsXnlNNeKVXbDg, build iOS 25, 2026-11-03 : le déplacement depuis un média rangé affiche Non classé par défaut. La projection canonique du détail omet folder_id, déjà attendu par les deux clients. Le sélecteur mobile traite aussi le dossier par défaut comme null alors que les lignes de bibliothèque portent son identifiant. Corriger la source partagée et la sélection native. Après fusion et déploiement API, vérifier sur appareil le déplacement depuis un média rangé puis non classé, ainsi que la réouverture après déplacement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le contrat canonique du détail expose le folder_id de la ligne user_media et les types partagés rendent ce champ explicite.
- [x] #2 Le sélecteur mobile identifie Non classé par null ou par le dossier is_default, sans écraser le choix effectué dans le sélecteur.
- [x] #3 Les chemins de déplacement mobile et web transmettent le dossier courant du média ; les contrôles de types et lint concernés passent.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Compléter la projection et les contrats API avec le dossier persistant du média. 2. Faire reconnaître le dossier par défaut par le sélecteur mobile et aligner le consommateur web sur le contrat explicite. 3. Vérifier les données dev en lecture seule, exécuter les contrôles statiques et les exports, documenter le retour, committer et fusionner localement sur main selon la demande du propriétaire.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnostic confirmé : MediaItemContract côté Python ne déclarait aucun folder_id et _build_media_item_contract ne le projetait pas, alors que CompletedDetailView et MediaView le lisaient. Le schéma OpenAPI déployé confirme cette absence. Lecture seule DynamoDB dev : 131 médias actifs, 81 dans un dossier nommé, 50 dans un dossier is_default ; aucun média actif sans dossier reconnu. Aucun contenu ni identité de compte enregistré. La présélection mobile conserve son état choisi et compare directement null ou le véritable ID is_default ; aucune synchronisation asynchrone ne remplace une sélection utilisateur. Champ requis nullable dans les contrats Python/TypeScript/OpenAPI et projection unique depuis la ligne user_media, sans fallback client ni changement des écritures. Web : même contrat partagé, dossier transmis directement à MediaActions. Vérifications : types et lint des trois workspaces réussis (seul warning purchaseService.ts préexistant), Ruff propre, mypy propre sur 214 fichiers, build web et exports iOS/Android réussis. Revue manuelle Chrome du composant web réel avec destinations synthétiques en mémoire : Test présélectionné, Non classé reconnu par ID puis par null, changement clavier vers Test confirmé. Prévisualisation temporaire retirée. Aucun test automatisé ajouté, aucune écriture AWS, aucun déploiement ou distribution. Le rendu natif et le flux API complet restent à vérifier après déploiement API et OTA/web ; nouveau binaire non requis pour ce correctif. Avertissements Expo/Sentry de configuration et taille du bundle web préexistants.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le détail canonique transmet maintenant le dossier persistant du média et le sélecteur natif reconnaît son dossier par défaut. Parité web alignée. Contrôles statiques, build web, exports natifs et revue web manuelle réussis ; validation appareil après déploiement restante.
<!-- SECTION:FINAL_SUMMARY:END -->
