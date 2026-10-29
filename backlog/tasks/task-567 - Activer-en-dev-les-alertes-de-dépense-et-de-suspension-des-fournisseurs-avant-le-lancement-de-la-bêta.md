---
id: TASK-567
title: Activer les alarmes CloudWatch en dev avant le lancement de la bêta
status: Done
assignee: []
created_date: '2026-10-29 13:31'
updated_date: '2026-10-29 15:30'
labels:
  - infrastructure
  - terraform
  - v1-launch
dependencies:
  - TASK-566
references:
  - infrastructure/terraform/modules/platform/operator_control_alerts.tf
  - infrastructure/terraform/modules/platform/pipeline_alerts.tf
  - infrastructure/terraform/envs/dev/main.tf
  - docs/OPERATOR_SPEND_CONTROL.md
priority: high
type: chore
ordinal: 173000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Les alarmes du module platform, dont celles de TASK-566 (dépense opérateur, suspension des fournisseurs) et de TASK-552 (anomalies du registre bêta), dépendent de `enable_alarms`, qui vaut `false` en dev pour économiser ~3,30 $/mois. Aucun topic SNS n'existe donc sur le compte dev : l'owner n'apprend une suspension de fournisseur, une réserve de pertes pleine ou un plafond approché que par `scripts/operator_control.py status` ou par un testeur. C'est un prérequis du lancement de la bêta (TASK-441).

## Périmètre

- Passer `enable_alarms = true` dans `infrastructure/terraform/envs/dev/main.tf`, et rien d'autre côté Terraform : le jeu d'alarmes existant tel quel, sans interrupteur supplémentaire ni sous-ensemble. `enable_dashboard` reste inchangé.
- Mettre à jour le commentaire de coût voisin, qui justifie aujourd'hui l'absence d'alarmes en dev.
- Aucune adresse email dans le dépôt, qui est public : la variable `alert_email` reste vide par défaut.
- Mettre à jour `docs/OPERATOR_SPEND_CONTROL.md` : comment les alertes arrivent (topic SNS `pipeline-alerts`, email), comment s'abonner et le délai attendu (audit toutes les 30 min).

## Note à l'owner (hors AC)

Après le merge et le push : `terraform apply` en dev avec `-var alert_email=<votre adresse>`, puis cliquer sur l'email de confirmation d'AWS. Ensuite, vérifier la réception de bout en bout : `aws cloudwatch set-alarm-state` sur une des alarmes opérateur, à l'état `ALARM`, doit produire un email.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `enable_alarms = true` dans `envs/dev/main.tf` ; aucun autre fichier Terraform ne change, à part le commentaire de coût voisin.
- [x] #2 `terraform validate` passe pour dev, et `terraform plan` en dev ne fait que créer le topic SNS, les alarmes et éventuellement l'abonnement, sans détruire ni modifier d'autre ressource.
- [x] #3 Aucune adresse email ni identité de compte dans le diff ; `alert_email` reste vide par défaut.
- [x] #4 `docs/OPERATOR_SPEND_CONTROL.md` décrit le canal d'alerte, l'abonnement et le délai attendu.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
`enable_alarms = true` dans `envs/dev/main.tf`, avec le commentaire de coût voisin réécrit. La description de `alert_email`, dans le même fichier, ne dit plus « Unused while enable_alarms = false ». Aucun autre fichier Terraform ne change. `terraform validate` passe. `terraform plan` en dev (AWS_PROFILE=second-brain-app, valeurs Cognito factices passées en env, jamais écrites) donne 104 to add, 4 to change, 0 to destroy. Les créations sont 1 topic SNS, 80 alarmes, 1 alarme composite et 22 filtres de métriques ; sans `alert_email`, aucun abonnement. Aucune des 4 modifications ne vient de cette tâche : `aws_cognito_identity_provider` google/apple et `GOOGLE_NATIVE_CLIENT_ID` de `aws_lambda_function.api` viennent des valeurs factices ; `aws_iam_role_policy.budget_audit` est la lecture de la partition `operator` de TASK-566, encore à appliquer. `docs/OPERATOR_SPEND_CONTROL.md` § 5 décrit le canal (topic `media-summarizer-pipeline-alerts-dev`, email), l'abonnement et sa confirmation, le délai (environ 30 min pour les alarmes de l'audit, 5 min pour `budget-operator`) et la vérification par `set-alarm-state`. Le diff ne contient ni adresse ni identité de compte.
<!-- SECTION:NOTES:END -->
