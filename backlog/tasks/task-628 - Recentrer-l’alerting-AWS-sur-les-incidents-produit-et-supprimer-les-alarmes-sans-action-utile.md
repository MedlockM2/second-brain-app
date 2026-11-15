---
id: TASK-628
title: >-
  Recentrer l’alerting AWS sur les incidents produit et supprimer les alarmes
  sans action utile
status: Done
assignee:
  - '@codex'
created_date: '2026-11-13 16:08'
updated_date: '2026-11-15 12:19'
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
1. Remplacer les alarmes par composant par des conditions de parcours consommées par des composites, avec métriques SQS/API et événements existants.
2. Retirer les métriques sans lecteur, recentrer bibliothèque, capacité et surveillance des audits.
3. Documenter les seuils, limites, triage et prérequis de paiement.
4. Exécuter fmt/validate, valider les patterns et expressions via les API AWS de lecture, inspecter un plan dev enregistré limité à l’observabilité.
5. Après l’autorisation explicite du propriétaire du 15 novembre 2026 (« vas y »), fusionner sur main, pousser et laisser la CI Terraform dev appliquer ; vérifier ensuite les alarmes, les filtres et l’abonnement SNS dans AWS.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Le plan global a été inspecté : seule une réapplication habituelle du champ Apple en écriture seule était hors périmètre. Un plan ciblé sur les ressources CloudWatch existantes et nouvelles isole donc 100 % des mutations à des alarmes et filtres de logs. Résultat prévu : 30 alarmes en dev, 11 notifiantes et 19 conditions avec composites consommateurs. Les 28 patterns distincts sont acceptés par CloudWatch Logs ; fmt, validate et diff --check passent. Aucun changement applicatif ni modification de Cognito/SNS/données/fixtures.

La couverture compilée confirme 19 conditions silencieuses sur 19 consommées par des composites, 11 points de notification, et zéro mutation hors CloudWatch. La configuration ne touche aucun runtime applicatif. Le suivi manuel des signalements ouverts est documenté : l’ancienne réception de mail ne constituera plus le déclencheur de la revue. Les contrôles de dépense eux-mêmes restent appliqués lorsque leur audit de suivi est muet.

Validation finale : fmt et validate passent ; plan isolé sans mutation hors alarmes/composites/filtres CloudWatch ; 30 alarmes compilées, 11 notifiantes, 19 conditions toutes consommées. Les 28 patterns sont acceptés par CloudWatch Logs et les 8 expressions métriques sont acceptées par GetMetricData. La vérification du moteur CloudWatch exclut pause manuelle, 429 de débit, simple titre miroir et review_blurb, et retient refus permanent, état durable et artefact demandé bloqué. Aucun événement publié ni état d’alarme forcé ; aucun mail de vérification envoyé. Aucun test applicatif automatisé ajouté ou exécuté. La refonte reste non appliquée tant que le propriétaire ne fusionne/pousse pas main, conformément au workflow du dépôt.

Déploiement réalisé le 15 novembre 2026 après autorisation explicite du propriétaire (« vas y »). Branche feat/product-alerting fusionnée sur main (bd426814), puis poussée. Workflow Terraform dev réussi : https://github.com/MedlockM2/second-brain-app/actions/runs/43712691601 . fmt et validate réussis avant le push. Vérification AWS après application : exactement les 30 alarmes attendues, dont 11 notifiantes ; aucune ancienne alarme de latence ; aucune alerte notifiante active au contrôle. Les 103 filtres de logs gérés par Terraform sont présents et leurs patterns et transformations correspondent à l’état appliqué. Abonnement SNS email confirmé, sans enregistrer son adresse. Au contrôle, 29 alarmes sont OK et une condition attend encore ses données ; aucun état forcé ni email de test envoyé. Cette activation remplace la réserve de non-déploiement des notes du 13 novembre.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refonte de l’alerting déployée sur dev le 15 novembre 2026 : 84 → 30 alarmes, dont 11 notifiantes et 19 conditions consommées par des composites. Retrait des alarmes sans action produit, regroupement par parcours, protection bibliothèque/suppression/capacité, seuil mensuel 80 % et deux contrôles de présence des audits. Descriptions françaises et retours OK limités aux reprises observées ; facturation AWS extérieure préservée. Fusion et push autorisés par le propriétaire, application Terraform CI réussie. Vérification AWS : inventaire conforme, 103 filtres conformes, abonnement email SNS confirmé et aucune alerte notifiante active au contrôle. Détails : docs/PRODUCT_ALERTING.md ; déploiement : https://github.com/MedlockM2/second-brain-app/actions/runs/43712691601 .
<!-- SECTION:FINAL_SUMMARY:END -->
