---
id: TASK-567
title: >-
  Activer en dev les alertes de dépense et de suspension des fournisseurs avant
  le lancement de la bêta
status: To Do
assignee: []
created_date: '2026-10-29 13:31'
labels:
  - infrastructure
  - terraform
  - v1-launch
dependencies:
  - TASK-566
references:
  - infrastructure/terraform/modules/platform/operator_control_alerts.tf
  - infrastructure/terraform/modules/platform/beta_budget_alerts.tf
  - infrastructure/terraform/modules/platform/pipeline_alerts.tf
  - infrastructure/terraform/envs/dev/main.tf
  - docs/OPERATOR_SPEND_CONTROL.md
  - docs/BETA_BUDGET_CONTROL.md
priority: high
type: chore
ordinal: 173000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

TASK-566 plafonne la dépense de l'opérateur et suspend les fournisseurs défaillants ; TASK-552 surveille les anomalies du registre bêta. Leurs alarmes CloudWatch dépendent toutes de `enable_alarms`, qui vaut `false` en dev pour économiser les ~3,30 $/mois des 43 alarmes du module. Aucun topic SNS n'existe donc sur le compte dev, et l'owner n'apprend une suspension de fournisseur, une réserve de pertes pleine ou un plafond approché que par `scripts/operator_control.py status` ou par un testeur. La dépense est bien coupée automatiquement, mais une fonctionnalité peut rester en panne pour tous les testeurs sans que personne ne le sache. C'est un prérequis du lancement de la bêta (TASK-441).

## Périmètre

- Ajouter au module platform un interrupteur distinct, par exemple `enable_spend_alerts`, qui crée le topic SNS `pipeline-alerts`, son abonnement email optionnel et uniquement les alarmes de dépense : celles de `operator_control_alerts.tf` et celles de `beta_budget_alerts.tf`, dont l'alarme d'audit manquant. Le topic existe dès que `enable_alarms` ou `enable_spend_alerts` est vrai.
- Les autres alarmes du module restent gouvernées par `enable_alarms`, qui reste `false` en dev.
- Activer l'interrupteur en dev. Staging et prod restent comme aujourd'hui, sauf si la lecture du code montre que la bêta tourne sur un autre environnement : le signaler alors dans les notes au lieu de deviner.
- Aucune adresse email dans le dépôt, qui est public : la variable `alert_email` reste vide par défaut.
- Mettre à jour `docs/OPERATOR_SPEND_CONTROL.md` : comment les alertes arrivent, comment s'abonner, le délai attendu (audit toutes les 30 min) et le coût.

## Note à l'owner (hors AC)

Après le merge et le push : `terraform apply` en dev avec `-var alert_email=<votre adresse>`, puis cliquer sur l'email de confirmation d'AWS. Ensuite, vérifier la réception de bout en bout : `aws cloudwatch set-alarm-state` sur une des alarmes opérateur, à l'état `ALARM`, doit produire un email. Le prochain audit la remet à `OK`, ce qui doit produire un second email.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Un interrupteur distinct de `enable_alarms` crée le topic SNS, l'abonnement email optionnel et seulement les alarmes de `operator_control_alerts.tf` et de `beta_budget_alerts.tf` ; il est activé dans `envs/dev/main.tf` et `enable_alarms` y reste `false`.
- [ ] #2 `terraform validate` passe pour dev, staging et prod, et `terraform plan` en dev ne crée que le topic, les alarmes de dépense et éventuellement l'abonnement, sans détruire ni modifier d'autre ressource.
- [ ] #3 Aucune adresse email ni identité de compte dans le diff ; `alert_email` reste vide par défaut.
- [ ] #4 `docs/OPERATOR_SPEND_CONTROL.md` décrit le canal d'alerte, l'abonnement, le délai attendu et le coût mensuel estimé.
<!-- AC:END -->
