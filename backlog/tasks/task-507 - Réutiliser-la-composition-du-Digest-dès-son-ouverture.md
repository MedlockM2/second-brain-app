---
id: TASK-507
title: Réutiliser la composition du Digest dès son ouverture
status: Done
assignee:
  - codex
created_date: '2026-10-14 22:15'
updated_date: '2026-10-14 22:22'
labels:
  - mobile
  - performance
dependencies: []
references:
  - task-506
priority: high
type: bug
ordinal: 114000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Retour owner après TASK-506 : un spinner bloque encore chaque ouverture du carrousel depuis l’onglet Digest. Les médias sont partagés mais la composition du Digest est relue séparément dans les deux écrans. Partager la réponse de composition en mémoire, réutiliser celle déjà obtenue par l’onglet, revalider sur le réseau et conserver la période/l’ordre capturés pendant la consultation. Aucun changement backend, aucun test automatisé.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L’onglet et le carrousel lisent la même ressource de composition ; une réponse conservée initialise immédiatement le carrousel, y compris un Digest vide.
- [x] #2 La revalidation ne remplace pas la période consultée ni l’ordre de ses médias ; les suppressions connues se répercutent et une erreur réseau conserve la lecture.
- [x] #3 Les contrôles locaux mobile/core et les exports Expo iOS/Android réussissent ; les limites du cache et la validation appareil à effectuer sont documentées.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Câbler les compositions dans le cache de session et les suppressions. 2. Réutiliser les snapshots dans l’onglet et capturer la période du carrousel. 3. Vérifier les contrôles locaux et exports, documenter puis intégrer/pousser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause confirmée : DigestChoiceScreen récupérait les compositions sans les partager, tandis que DigestCarousel initialisait toujours digest à null et attendait une nouvelle requête. Correctif : compositions daily/weekly dans le cache de session, avec une ressource latest et une ressource par period_key capturé ; snapshots partagés avec l’onglet ; revalidation au focus sans changer la période ni l’ordre en cours. Les suppressions locales restent exclues lors des nouvelles lectures de la capture immuable du serveur ; le pager conserve son ancrage après un retrait. Une erreur transitoire garde le carrousel ou l’état vide visible. Un premier accès sans composition ou sans détail média conservé garde son chargement légitime. Contrôles locaux le 2026-10-15 : typecheck/lint mobile et core, typecheck web, exports Expo iOS/Android et revue du diff réussis ; seul avertissement mobile préexistant dans purchaseService.ts. Aucun test automatisé ajouté. Documentation et scénarios appareil ajoutés à docs/MOBILE_RESOURCE_CACHE.md ; validation native à effectuer après distribution interne.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
L’ouverture du Digest réutilise immédiatement la composition déjà lue par l’onglet, avec revalidation réseau discrète et période capturée stable. Contrôles locaux et exports des deux plateformes réussis ; validation native séparée.
<!-- SECTION:FINAL_SUMMARY:END -->
