---
id: TASK-559
title: >-
  Mettre à jour chaque jour le taux EUR/USD de la BCE utilisé par le contrôle
  budgétaire bêta
status: To Do
assignee: []
created_date: '2026-10-28 11:16'
labels:
  - backend
  - infrastructure
  - pricing
dependencies:
  - TASK-548
references:
  - docs/research/task-547-beta-budget-control/README.md
  - media_summarizer/core/services/pricing_config_service.py
priority: medium
type: feature
ordinal: 165000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Le contrôle budgétaire bêta (décision docs/research/task-547-beta-budget-control/README.md, règle 15) convertit les tarifs fournisseurs, en dollars, vers le budget de 5 EUR par testeur. L'owner veut un taux proche du réel, mis à jour sans intervention. TASK-548 pose le taux dans la configuration (`pricing_config`) avec une valeur de départ ; cette tâche le tient à jour.

## Périmètre

- Une tâche planifiée quotidienne (règle EventBridge + Lambda, dans le Terraform existant, environnements dev et prod) lit le fichier public de la BCE `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml` (sans clé), extrait le taux USD et l'écrit avec sa date de publication dans la clé de taux de `pricing_config` créée par TASK-548. Planifier après la publication BCE (vers 16 h CET, jours ouvrés).
- En cas d'échec (week-end, jour férié, fichier indisponible ou illisible) : ne rien écrire, garder le dernier taux enregistré et journaliser l'échec. Jamais de refus de traitement à cause du taux.
- Écriture idempotente : relancer la tâche le même jour ne change rien.
- Rien n'est déployé : pas de compatibilité avec un autre mécanisme de taux.

## Note owner

Le passage effectif de la tâche planifiée se constate après le déploiement sur `main` (taux et date mis à jour dans `pricing_config-dev` le jour ouvré suivant) : vérification owner, pas un critère d'acceptation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La tâche planifiée et sa Lambda sont décrites dans le Terraform pour dev et prod, avec les permissions minimales d'écriture sur la clé de taux de `pricing_config` ; `terraform validate` passe.
- [ ] #2 La Lambda lit le fichier quotidien de la BCE, écrit le taux USD et sa date de publication, et n'écrit rien en cas d'échec en conservant le dernier taux.
- [ ] #3 Une invocation directe de la Lambda déjà déployée n'est pas exigée ; le chemin de code est câblé et `ruff` et `mypy` passent sur les fichiers backend modifiés.
<!-- AC:END -->
