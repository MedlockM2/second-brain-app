---
id: TASK-628
title: >-
  Recentrer l’alerting AWS sur les incidents produit et supprimer les alarmes
  sans action utile
status: Done
assignee:
  - '@codex'
created_date: '2026-11-13 16:08'
updated_date: '2026-11-13 16:33'
labels:
  - infrastructure
  - observability
dependencies: []
priority: high
ordinal: 227000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audit propriétaire du 13 novembre 2026 : 524 notifications dont 460 dues au p95 de faible trafic ; les 85 alarmes ont été revues une à une. Le propriétaire autorise leur refonte et le retrait des objets sans utilité produit, y compris l’alarme de temps d’ouverture du chat. Utiliser CloudWatch/SNS existants, protéger bibliothèque/suppressions, capacité et parcours réellement bloqués. Ne pas modifier les fixtures RevenueCat ni le code d’envoi des emails. Les achats ne sont pas ouverts dans la bêta ; leur surveillance sera un prérequis du lancement commercial.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les alarmes de latence, erreurs/throttling par worker, signalement de bug, archiveur et indicateurs de coût sans action dédiée sont retirées du module Terraform.
- [x] #2 Les parcours import, génération, chat et recherche disposent de conditions regroupées de blocage ou d’échec ; chaque alarme technique silencieuse possède un consommateur réel.
- [x] #3 Les pertes de bibliothèque, suppressions non honorées, défaillances du contrôle de capacité et contrôles devenus aveugles restent couverts ; les pauses manuelles et limites temporaires ne produisent pas de doublons attendus.
- [x] #4 Les descriptions françaises précisent impact, condition, action et liens ; les compteurs sans preuve de résolution n’envoient pas de retour OK.
- [x] #5 Terraform fmt et validate passent ; un plan dev enregistré ne modifie que les ressources d’observabilité attendues ; la politique et les conditions de lancement commercial sont documentées.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remplacer les alarmes par composant par des conditions de parcours consommées par des composites, avec métriques SQS/API et événements existants. 2. Retirer les métriques sans lecteur, recentrer bibliothèque, capacité et surveillance des audits. 3. Documenter les seuils, limites, triage et prérequis de paiement. 4. Exécuter fmt/validate, valider les patterns et expressions via les API AWS de lecture, inspecter un plan dev enregistré limité à l’observabilité. 5. Livrer le commit dans le worktree ; conformément aux instructions du dépôt, ne pas fusionner/pousser ni appliquer depuis la branche. Le push propriétaire sur main déclenche le déploiement Terraform dev.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Le plan global a été inspecté : seule une réapplication habituelle du champ Apple en écriture seule était hors périmètre. Un plan ciblé sur les ressources CloudWatch existantes et nouvelles isole donc 100 % des mutations à des alarmes et filtres de logs. Résultat prévu : 30 alarmes en dev, 11 notifiantes et 19 conditions avec composites consommateurs. Les 28 patterns distincts sont acceptés par CloudWatch Logs ; fmt, validate et diff --check passent. Aucun changement applicatif ni modification de Cognito/SNS/données/fixtures.

La couverture compilée confirme 19 conditions silencieuses sur 19 consommées par des composites, 11 points de notification, et zéro mutation hors CloudWatch. La configuration ne touche aucun runtime applicatif. Le suivi manuel des signalements ouverts est documenté : l’ancienne réception de mail ne constituera plus le déclencheur de la revue. Les contrôles de dépense eux-mêmes restent appliqués lorsque leur audit de suivi est muet.

Validation finale : fmt et validate passent ; plan isolé sans mutation hors alarmes/composites/filtres CloudWatch ; 30 alarmes compilées, 11 notifiantes, 19 conditions toutes consommées. Les 28 patterns sont acceptés par CloudWatch Logs et les 8 expressions métriques sont acceptées par GetMetricData. La vérification du moteur CloudWatch exclut pause manuelle, 429 de débit, simple titre miroir et review_blurb, et retient refus permanent, état durable et artefact demandé bloqué. Aucun événement publié ni état d’alarme forcé ; aucun mail de vérification envoyé. Aucun test applicatif automatisé ajouté ou exécuté. La refonte reste non appliquée tant que le propriétaire ne fusionne/pousse pas main, conformément au workflow du dépôt.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refonte produit de l’alerting : retrait des alarmes sans action, quatre parcours regroupés, protection bibliothèque/suppression/capacité, 80 % mensuel et deux heartbeats. Descriptions françaises et retours OK limités aux reprises réellement observées. Plan : 84 vers 30 alarmes dev, dont 11 notifiantes ; facturation AWS extérieure préservée. Vérifié par fmt/validate, plan isolé, moteur de patterns et lectures métriques AWS. Code livré en branche ; activation via apply CI après push propriétaire sur main.
<!-- SECTION:FINAL_SUMMARY:END -->
