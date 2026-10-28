---
id: TASK-560
title: Empêcher les doubles notifications push du Digest
status: Done
assignee:
  - '@codex'
created_date: '2026-10-28 11:21'
updated_date: '2026-10-28 11:27'
labels:
  - bug
  - backend
dependencies: []
priority: high
type: bug
ordinal: 166000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TestFlight AO959Z8xpdHnqClkFQFQz5g, build 17, iPhone iOS 26.6.2 : deux notifications identiques du Digest quotidien visibles dans le centre de notifications le 27 octobre. Examiner les émissions et la livraison AWS dev, corriger la cause établie et documenter les limites. Aucun envoi réel ni déploiement pendant cette intervention.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Chaque jeton push possède un seul compte destinataire faisant autorité ; la lecture du consommateur ignore les anciennes inscriptions sous un autre compte.
- [x] #2 La désinscription, la purge des jetons périmés et la suppression du compte retirent aussi sa propriété du jeton sans retirer celle dun autre compte.
- [x] #3 Ruff et mypy passent ; les opérations de propriété et de transfert sont vérifiées sur des fixtures AWS dev sans envoi de push.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Diagnostic AWS confirmé : deux comptes notifiés à 17:30 UTC partagent le même jeton iOS ; aucune réémission du scheduler ni erreur de receipt. 2. Ajouter une ligne de propriété par jeton dans la table existante et écrire atomiquement inscription/propriété ; filtrer les destinataires par cette propriété en lecture cohérente. 3. Adapter désinscription, purge et effacement du compte ; les anciennes inscriptions sans propriétaire ne sont plus destinataires. 4. Vérifier avec des fixtures dev isolées sans push, Ruff/mypy, documenter et committer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnostic CloudWatch dev : un envoi pour chacun de deux comptes à 17:30 UTC le 27 octobre ; le même jeton iOS est enregistré sous les deux comptes. Trois tickets acceptés et receipts sans erreur. Pas de réémission du scheduler. Propriété unique par jeton écrite atomiquement avec son inscription ; lecture cohérente avant livraison. Effacement du compte utilise delete_all_for_user pour libérer conditionnellement les propriétaires. Vérification réelle sur fixtures DynamoDB dev : deux appareils A, transfert à B, DELETE tardif A, retour A et purge B, renouvellement conservé, ancien enregistrement sans propriétaire exclu, purge complète des inscriptions/propriétés. Balayage réel de péremption vérifié avec seuil excluant toutes les inscriptions réelles. Fixtures nettoyées, aucun push envoyé. Ruff, mypy 207 fichiers, garde des TTL et diff --check passent. Aucun test automatisé ajouté. Documentation : docs/TESTFLIGHT_2026_10_28_DUPLICATE_DIGEST.md. Déploiement API/workers et validation iPhone restent propriétaire ; prochain lancement authentifié nécessaire pour les inscriptions existantes, sans migration ni fallback.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Double destination du Digest causée par le même jeton inscrit sous deux comptes. Propriété exclusive transactionnelle et vérification cohérente des destinataires ; désinscription, purge et effacement du compte adaptés. Validé par opérations DynamoDB dev isolées sans push, Ruff/mypy et garde TTL. Backend iOS/Android ; aucun binaire ou OTA requis. Distribution et vérification native restent à faire.
<!-- SECTION:FINAL_SUMMARY:END -->
