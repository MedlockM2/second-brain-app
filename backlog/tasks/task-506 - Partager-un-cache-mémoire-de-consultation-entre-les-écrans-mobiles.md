---
id: TASK-506
title: Partager un cache mémoire de consultation entre les écrans mobiles
status: Done
assignee:
  - codex
created_date: '2026-10-14 21:38'
updated_date: '2026-10-14 22:04'
labels:
  - mobile
  - core
  - performance
dependencies: []
priority: high
type: feature
ordinal: 113000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan explicitement validé par owner : réouverture immédiate des dossiers/sélecteur, détail et texte média, artefacts prêts et historique du chat ; réutilisation dans Digest. Cache mémoire par compte, langue et requête ; revalidation réseau et mutations cohérentes. Limites des entrées inactives : 100 et 8 Mio estimés, corps de plus de 2 Mio non retenus après fermeture. Aucun changement backend ni dépendance supplémentaire. Validation native après distribution sur checklist owner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le moteur neutre et la liaison de session exposent des snapshots réactifs, dédupliquent les lectures et écartent les résultats invalidés.
- [x] #2 Les lectures des dossiers, médias/textes, artefacts et historique utilisent le cache partagé ; les accès sans cache gardent leur chargement initial et les polls restent réels.
- [x] #3 Les mutations et changements de langue/compte actualisent ou invalident les ressources concernées ; les erreurs transitoires ne masquent pas les données disponibles.
- [x] #4 Typecheck/lint mobile et core, typecheck web et exports iOS/Android réussissent sans ajout de tests automatisés ; documentation des limites et vérifications appareil présente.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Moteur neutre LRU et snapshots, cache de session et hooks React. 2. Câbler les lectures typées et effets des mutations, session et langue. 3. Adapter dossiers/sélecteur, lecteur/Digest, artefacts et historique. 4. Revue des courses réseau et limites mémoire ; contrôles locaux, documentation et livraison sur main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémentation : moteur neutre ResourceCache dans packages/core ; snapshots React au-dessus de la navigation ; ressources typées par compte, langue, filtre et page ; déduplication et révisions pour écarter les lectures invalidées. Intégration dossiers et sélecteurs, détail média/textes, métadonnées et corps IA, fenêtres paginées de bibliothèque/historique ; Digest conserve son rayon de montage et son ordre. Mutations centralisées, purge immédiate à la déconnexion, reprise après erreur et revalidation au focus/premier plan. Documentation et checklist native : docs/MOBILE_RESOURCE_CACHE.md. Validation locale le 2026-10-15 : typecheck mobile/core/web et lint mobile/core réussis ; seul avertissement préexistant dans purchaseService.ts ; exports Expo iOS et Android réussis ; revue du diff effectuée. Aucun test automatisé ajouté. Validation sur appareil non effectuée : à réaliser après distribution interne via le workflow existant Mobile OTA or Build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cache mémoire de session livré pour tous les écrans du plan validé. Les réponses conservées restent visibles pendant les revalidations ; mutations, langues et comptes sont isolés des lectures anciennes. Contrôles locaux et exports des deux plateformes réussis. Validation native séparée après distribution ; checklist documentée.
<!-- SECTION:FINAL_SUMMARY:END -->
