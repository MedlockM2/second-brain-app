---
id: TASK-559
title: >-
  Mettre à jour chaque jour le taux EUR/USD de la BCE utilisé par le contrôle
  budgétaire bêta
status: Done
assignee: []
created_date: '2026-10-28 11:16'
updated_date: '2026-10-28 16:43'
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
- [x] #1 La tâche planifiée et sa Lambda sont décrites dans le Terraform pour dev et prod, avec les permissions minimales d'écriture sur la clé de taux de `pricing_config` ; `terraform validate` passe.
- [x] #2 La Lambda lit le fichier quotidien de la BCE, écrit le taux USD et sa date de publication, et n'écrit rien en cas d'échec en conservant le dernier taux.
- [x] #3 Une invocation directe de la Lambda déjà déployée n'est pas exigée ; le chemin de code est câblé et `ruff` et `mypy` passent sur les fichiers backend modifiés.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**AC #1.** `infrastructure/terraform/modules/platform/lambda_ecb_rate.tf` (module partagé, donc dev, staging et prod) : la Lambda `media-summarizer-worker-ecb-rate<suffix>` (image worker, 256 Mo, 60 s), la règle EventBridge `cron(30 15 ? * MON-FRI *)` (15 h 30 UTC, soit après la publication BCE de 16 h CET, en hiver comme en été), la cible et la permission. Le rôle IAM est propre à la Lambda : logs de son groupe, plus `dynamodb:UpdateItem` sur `pricing_config` avec la condition `dynamodb:LeadingKeys = [eur_usd_rate]`. Pas de secret runtime ; une seule variable, `PRICING_CONFIG_TABLE`. `terraform fmt -check` OK ; `terraform validate` OK sur envs/dev et envs/prod (init -backend=false). Le déploiement de l'image la découvre par le tag Environment et le préfixe `media-summarizer-worker-`.

**AC #2.** `media_summarizer/workers/ecb_rate_refresh.py` : GET de `eurofxref-daily.xml` (timeout 20 s, 64 Ko maximum), extraction du taux USD et de `time`, contrôle de plausibilité (0,5 à 2,5), puis écriture de `config_value` = {usd_per_eur, published_on, source} sous la forme semée par TASK-548. L'écriture est conditionnelle (`published_on` en attribut de premier niveau, qui doit avancer) : une relance le même jour, un week-end ou un jour férié ne change rien. Tout échec (réseau, HTTP, XML, taux absent ou aberrant, table non configurée) n'écrit rien, journalise `fx.ecb_refresh_failed` et se termine sans erreur, de sorte que le dernier taux reste en place. Le module n'importe pas la couche DynamoDB de l'application. Contrôle ponctuel du 2026-10-28, sans écriture : import réussi avec la seule variable de table, et lecture du fichier réel → 1,1150 au 2026-10-27.

**AC #3.** Handler `lambda_handlers.ecb_rate_refresh_handler`. `ruff` OK ; `mypy media_summarizer` OK (211 fichiers) ; garde `.env.example` OK. Aucun test automatisé ajouté.

Doc : `docs/BETA_BUDGET_CONTROL.md` §1 et la docstring de `beta_budget.fx_rate`. La table du §6 (« Daily refresh… TASK-559 ») n'est pas modifiée ici, pour ne pas entrer en conflit avec la branche task-549, qui réécrit cette section.

**Note owner (pas un AC)** : après `terraform apply` et le déploiement, vérifier le jour ouvré suivant que la ligne `eur_usd_rate` de `pricing_config-dev` porte la date BCE du jour et un attribut `published_on`. Un taux modifié à la main doit aussi mettre à jour cet attribut.

**Correctif après déploiement (2026-10-28).** La première invocation sur dev a échoué à l'import : `media_summarizer/utils/__init__.py` charge la couche DynamoDB, qui exige tous les noms de tables. La Lambda reçoit désormais les noms partagés (`local.lambda_environment`), sauf `RUNTIME_SECRET_NAME` : son démarrage ne lit donc aucun secret, et son rôle reste limité à la ligne `eur_usd_rate`. Le contrôle local initial était trompeur, faute d'un environnement réellement vide. Rien n'avait été écrit : le taux par défaut est resté en place.
<!-- SECTION:NOTES:END -->
