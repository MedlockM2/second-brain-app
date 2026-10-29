---
id: TASK-567
title: Activer les alarmes CloudWatch en dev avant le lancement de la bêta
status: To Do
assignee: []
created_date: '2026-10-29 13:31'
updated_date: '2026-10-29 13:33'
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
- [ ] #1 `enable_alarms = true` dans `envs/dev/main.tf` ; aucun autre fichier Terraform ne change, à part le commentaire de coût voisin.
- [ ] #2 `terraform validate` passe pour dev, et `terraform plan` en dev ne fait que créer le topic SNS, les alarmes et éventuellement l'abonnement, sans détruire ni modifier d'autre ressource.
- [ ] #3 Aucune adresse email ni identité de compte dans le diff ; `alert_email` reste vide par défaut.
- [ ] #4 `docs/OPERATOR_SPEND_CONTROL.md` décrit le canal d'alerte, l'abonnement et le délai attendu.
<!-- AC:END -->
