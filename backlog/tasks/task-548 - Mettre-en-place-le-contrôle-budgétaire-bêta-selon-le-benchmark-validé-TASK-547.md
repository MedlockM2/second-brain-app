---
id: TASK-548
title: >-
  Mettre en place le contrôle budgétaire bêta selon le benchmark validé
  (TASK-547)
status: To Do
assignee: []
created_date: '2026-10-26 22:21'
updated_date: '2026-10-28 12:00'
labels:
  - backend
  - feature
dependencies:
  - TASK-547
documentation:
  - docs/research/pricing-challenge/README.md
  - docs/research/task-547-beta-budget-control/README.md
  - docs/V1_LAUNCH_PLAN.md
priority: high
type: feature
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L’accès bêta hérite aujourd’hui d’un ancien palier en minutes. Le budget autonome retenu et sa protection financière demandent un socle commun avant de reprendre tous les traitements fournisseurs. Les remboursements de capacité accordés au testeur ne doivent pas effacer les dépenses déjà engagées.

## Décisions acquises

Formule bêta autonome, indépendante des abonnements commerciaux, avec toutes les fonctionnalités actuellement disponibles. Budget de 5 EUR par compte et par mois, sans report, pour les coûts fournisseurs d’usage hors infrastructure fixe. Les 5 EUR sont considérés comme suffisamment permissifs : ne pas rouvrir ce calibrage. Valoriser l’usage réellement mesuré au tarif normal hors crédits promotionnels ; prendre en compte les tarifs de cache réellement appliqués. L’utilisateur voit un pourcentage, sans euros, crédits ni proposition d’achat. Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles lorsque la capacité est épuisée ; un nouveau traitement payant reste soumis au contrôle commun.

Source de vérité : docs/research/pricing-challenge/README.md, Owner Validation et R.1–R.2, décisions du 2026-10-26 et accord de l’owner sur la préparation de la formule bêta autonome.
## Décision technique à appliquer

Lire la décision finale de l’owner dans docs/research/task-547-beta-budget-control/README.md, et non la seule recommandation initiale. Cette tâche est l’implémentation directement associée à TASK-547 ; ne pas démarrer avant sa validation. Livrer le socle commun de budget et de périodes, de réservation et de règlement retenu, ainsi que ses états et règles de reprise. Le branchement exhaustif des traitements est porté par TASK-549 ; l’exposition publique et l’UI sont portées par TASK-550–TASK-551. Inclure la configuration et le cycle de vie des données et permissions requis, sans travail de release depuis le worktree. Actualiser Owner Validation/R.1–R.2 de la référence et la phase bêta du plan de lancement : la bêta n’hérite plus d’une allocation commerciale maximale.

## Limites de livraison

Aucune offre commerciale, recharge payante ou facturation à crédits à créer. Aucun changement de fournisseur ou de modèle sans décision validée ; ne pas rouvrir le contrôle du débit de tokens déjà arbitré par task-459. Aucun test automatisé demandé, aucun appel local à FastAPI en guise de preuve, aucune migration de fixtures ni compatibilité avec les anciens débits remplacés. Les vérifications après déploiement et sur appareils relèvent de la checklist propriétaire de task-440, pas d’un critère d’acceptation de cette tâche. Aucun secret, identité de compte ou payload fournisseur brut dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Le chemin d’attribution bêta est indépendant du catalogue commercial et sa configuration décrit le budget de 5 EUR par compte, les périodes mensuelles et l’absence de report selon la décision validée.
- [x] #2 Le socle de contrôle implémente les réservations, règlements et états de reprise retenus par la décision propriétaire ; les règles de concurrence, de duplication et de passage de période sont documentées et câblées.
- [x] #3 Les dépenses financières engagées ou constatées sont distinguées des remboursements de capacité utilisateur ; les règles de l’étude empêchant une remise à zéro fictive de la dépense sont présentes dans le socle.
- [ ] #4 Les schémas, permissions et règles de cycle de vie nécessaires sont livrés ; la référence pricing et le plan de lancement décrivent la formule autonome et distinguent le socle livré de ses branchements et vérifications de release restants.
- [x] #5 Les vérifications statiques pertinentes passent sur les fichiers modifiés : Ruff/mypy, et terraform validate lorsque l’infrastructure est modifiée ; aucune suite automatisée ou mise en production n’est une condition de livraison.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implémenté le 2026-10-28 dans un worktree isolé, sur sa propre branche, sans merge, push ni déploiement. Source : la décision de l'owner validée le 2026-10-27 (`docs/research/task-547-beta-budget-control/README.md`, Owner Validation et « Décision de l'owner : règles d'implémentation », qui priment sur les sections 1 à 7). Référence technique livrée : `docs/BETA_BUDGET_CONTROL.md`.

**AC #1, chemin d'attribution et configuration.**
- `get_entitlement_snapshot` (`core/services/quota_enforcer.py`) : tant que `beta_access` est ouvert, tout compte est sur la formule bêta, construite à partir de `beta_access` seul. Aucun palier de `tiers`, aucun abonnement, aucune fenêtre d'essai n'est lu. `_widest_tier`, `_is_beta_open`, `_parse_instant` et la fusion `paid.raised_by(beta)` sont supprimés. Le snapshot bêta n'a ni palier ni allocation en minutes (`minutes_included` = 0) ; il porte la limite audio par élément de la formule (240 min) et la période du mois calendaire UTC.
- `evaluate_submission` ne refuse plus un compte bêta sur les minutes ; la limite par élément s'applique toujours. `_beta_access_param` est supprimé : plus aucun refus `out_of_minutes` n'existe sous la bêta.
- Configuration (`pricing_config_service.py`, valeurs par défaut fusionnées clé par clé avec `pricing_config-<env>`) :
  - `beta_access` décrit toute la formule : `monthly_budget_eur: "5"`, `period: "calendar_month_utc"`, `carry_over: false`, `item_limits` (240 min, 100 pages, 30 feuilles), `translation_output_ratio: "1.5"`, estimations 200 tokens/min et 700 tokens/page, `hold_expiry_minutes: 360`. Le nom de la clé et `enabled`/`ends_at` sont conservés, donc la procédure `put-item` du plan de lancement reste valable.
  - Nouvelle clé `eur_usd_rate` (1,1188 publié le 2026-10-26), que TASK-559 mettra à jour.
  - Nouvelle clé `provider_tariffs`, barème versionné `2026-10-28` en USD : Deepgram, LlamaParse page et feuille, Unstructured, Luna court et long, GPT-5-nano, les quatre programmes Apify, l'API X.

**AC #2, réservations, règlements et reprise.** Registre `beta_budget-<env>` (`utils/beta_budget_db.py`, `core/services/beta_budget.py`, modèles dans `core/models/beta_budget.py`). Montants en entiers de nano-euros, valeurs décimales exactes, une seule rondeur vers le haut par montant.
- `reserve` : une seule `TransactWriteItems`. Le compteur du mois est créé avec le budget complet s'il n'existe pas, puis `available -= borne` sous condition de couverture, et chaque tentative est écrite `held` sous condition d'inexistence. Tout ou rien ; idempotent sur l'opération et l'essai.
- `claim_send` : passage `held → sending` avant l'appel HTTP.
- `settle` : régularisation sur le coût réel, au taux de la réservation, dans le mois de la réservation. Le dépassement est accepté et journalisé (`beta_budget.overrun`).
- `release` : toute la réservation rendue au testeur.
- `release_expired` : filet de 6 h, exécuté avant chaque admission, à partir d'un index clairsemé des tentatives ouvertes.
- `charge_reuse` : règle 12, une écriture conditionnelle sans réservation.
- Constructeurs de bornes par type : plafond réservé quand la mesure échoue, `ItemTooLargeError` au-delà des limites, sortie de traduction à 1,5 fois l'entrée. Fonctions de coût mesuré correspondantes.
- Concurrence, doublons, reprises (un nouvel essai réserve à nouveau ; `lost_in_flight` seulement après le bail) et passage de mois : `docs/BETA_BUDGET_CONTROL.md` §3 et §4.
- Une panne du registre refuse (`budget_unavailable`), sans repli permissif. Le nom de table est résolu à l'usage et non à l'import, pour qu'un déploiement d'image antérieur à l'`apply` Terraform ne casse pas le démarrage de toutes les Lambdas.

**AC #3, dépense ou capacité rendue.** Le compteur sépare `consumed` (consommation régularisée du testeur, seule base du pourcentage, règle 13), `held` (engagé), `released` (capacité rendue, trace) et `operator_spend` (coût des échecs, règle 5). Une libération ajoute toujours le coût de la tentative à `operator_spend` : le coût mesuré s'il est fourni, sinon la borne réservée si la requête a pu partir (`cost_basis: bound`), sinon 0 (`not_sent`). Aucune écriture du socle ne diminue `consumed` ni `operator_spend`. Aucune remise de capacité manuelle n'existe (règle 14). Une métrique absente ne devient jamais un coût nul.

**AC #4, schémas, permissions, cycle de vie, documentation : partiellement atteint, laissé non coché.**
- Livré :
  - Terraform : `dynamodb_beta_budget.tf` (PITR, protection, `prevent_destroy`, GSI `open-attempts-index`, TTL `ttl_epoch` posé seulement sur les items terminés, 400 jours) et `BETA_BUDGET_TABLE` dans `runtime_env.tf`. Les rôles API et workers couvrent déjà la table et son index par le motif de suffixe (Put, Update, ConditionCheckItem) : aucune politique à modifier.
  - Cycle de vie : effacement de compte (`_USER_PARTITION_TABLES`), purge e2e, `.env.example`, `docs/DATA_RETENTION.md`.
  - Référence pricing mise à jour : Owner Validation point 3, R.1, R.2.1 et R.2.5 de `docs/research/pricing-challenge/README.md`, avec la formule autonome et la distinction entre le socle livré et ce qui reste à brancher.
- **Non atteint : la phase bêta de `docs/V1_LAUNCH_PLAN.md`.** L'agent de dispatch a interdit de modifier ce fichier, en cours d'édition par l'owner sur `main`. Sa section « Phase de beta » dit encore que tous les comptes « reçoivent l'allocation du palier le plus élevé » et que `quota_enforcer` sert « l'allocation du palier le plus large du catalogue `tiers` ». Texte proposé pour remplacer les puces « Régime pendant la beta » et « Le mécanisme » :
  > - **Régime pendant la beta** (`task-429`, budget `task-548`) : aucun abonnement souscriptible, toutes les entrées vers le paywall sont masquées, et **tous les comptes**, existants comme nouveaux, sont sur la formule bêta autonome : 5 € d'usage fournisseur valorisé au tarif normal, par compte et par mois calendaire UTC, sans report, indépendante du catalogue `tiers` et des abonnements. La bêta n'hérite plus d'aucune allocation commerciale. Socle livré par `task-548` (`docs/BETA_BUDGET_CONTROL.md`) ; branchement des traitements `task-549`, exposition `task-550`, interface `task-551`, suivi `task-552`, taux BCE quotidien `task-559`.
  > - **Le mécanisme** : le bloc `beta_access` de la pricing config porte `enabled`, `ends_at` et la formule (budget, période, limites par élément). Tant qu'il est actif et que `ends_at`, s'il existe, n'est pas passé, `quota_enforcer` attribue la formule bêta à chaque compte sans lire `tiers` ni les abonnements, et l'endpoint des entitlements renvoie `is_beta_access: true`. Un bloc stocké avec seulement `enabled` et `ends_at` reçoit le reste des valeurs par défaut.

  Le tableau « Étape 1 » peut aussi recevoir une ligne « Budget bêta autonome | `task-548` → `task-549` à `task-552`, `task-559` ».

**AC #5, vérifications statiques et plan.**
- `uv run ruff check .` : `All checks passed!`. `uv run mypy media_summarizer` : `no issues found in 210 source files`.
- `terraform fmt -check -recursive` : 0. `terraform validate` : succès sur `modules/platform`, `envs/dev`, `envs/prod` et `envs/staging`.
- `terraform plan` réel sur dev (lecture seule, fichier de plan supprimé ensuite) : `1 to add, 20 to change, 0 to destroy`. La table `beta_budget-dev` est créée ; `user_usage_daily-dev` « will no longer be managed by Terraform, but will not be destroyed » ; les 20 Lambdas reçoivent `BETA_BUDGET_TABLE` et perdent `USER_USAGE_DAILY_TABLE`. Une mise à jour en place du fournisseur Cognito Apple apparaît aussi : dérive préexistante sur un champ sensible, sans rapport avec cette tâche.
- `scripts/tf_plan_guard.sh dev tfplan` : `PASS`. `scripts/check_env_example_complete.py` et `scripts/check_purge_at_writers.py` : OK.
- Lecture directe de `pricing_config-dev`, sans écriture : trois clés seulement. `beta_access` vaut `{"enabled": true, "ends_at": null}` et il n'y a aucune ligne `burst_guards`, donc rien à écrire ni à supprimer en dev.
- Aucun test automatisé ajouté (aucun n'est demandé).

**Règle 16, réglages hérités du système en minutes.** Supprimés : `burst_guards` (valeurs par défaut), `_note_burst_guards`, les compteurs journaliers (`get_daily_usage`, `increment_daily_usage`, `record_submitted_item`, `item_token`, `record_text_file_parse`, `minutes_for_text_file`), `USER_USAGE_DAILY_TABLE` et la table `user_usage_daily` (bloc `removed { destroy = false }`, même procédé que `user_media_submissions_v1`). Les appels de `media.py`, `podcasts.py`, `media_submission.py` et `document_parsing_service.py` sont retirés. `provider_pools` est conservé (TASK-557).

**Hors périmètre, laissé à TASK-549 et suivantes :**
- TASK-549 : aucun traitement n'appelle encore `reserve`. Restent aussi le retrait des débits en minutes et du « fail open » de `check_submission_allowed`, le remboursement de chat en minutes, `llm_pricing.py` et `record_observed_cost`, l'envoi de `max_completion_tokens` sur la traduction, et le stockage de la valeur régularisée avec le contenu (règle 12).
- TASK-550 : l'exposition. Jusque-là, l'endpoint des entitlements renvoie 0 minute pour un compte bêta, et la carte Account affiche « 0 minute ». Rien n'est refusé sur les minutes.
- TASK-552 : rapports et alertes. TASK-559 : taux quotidien.

**Notes à l'owner (hors AC) :**
- Ordre de déploiement : les deux workflows du push se font la course. Si `terraform-dev` applique avant `deploy-lambda`, l'ancienne image, qui exige encore `USER_USAGE_DAILY_TABLE` à l'import, échoue au démarrage à froid jusqu'au déploiement de la nouvelle. Dans l'ordre inverse, l'effacement de compte échoue tant que la table n'existe pas. La fenêtre dure le temps du workflow le plus lent ; relancer si `/api/health/` reste en erreur après les deux.
- Après l'`apply` dev, vérifier `beta_budget-dev` (index, PITR, TTL) avec `aws dynamodb describe-table` et `describe-time-to-live` (profil `second-brain-app`, région `eu-west-3`).
- Supprimer à la main `user_usage_daily-dev`, après `update-table --no-deletion-protection-enabled`. Faire de même en prod à son prochain `apply`.
- `pricing_config-prod` n'a pas été lu : y supprimer une éventuelle ligne `burst_guards`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le socle commun du budget bêta est livré : formule autonome de 5 € par compte et par mois calendaire UTC, sans report, décrite dans `beta_access` ; taux BCE et barème versionné en configuration ; registre DynamoDB `beta_budget-<env>` avec admission en une écriture conditionnelle, envoi revendiqué, régularisation, libération, filet d'expiration et débit de réutilisation entre comptes. Les dépenses de l'opérateur restent séparées de la capacité rendue au testeur. L'attribution de la bêta ne lit plus le catalogue commercial ni les abonnements. Les gardes quotidiennes et leur table sont supprimées.

AC #1, #2, #3 et #5 atteints : ruff et mypy propres, `terraform validate` sur toutes les racines, `plan` dev à 1 ajout, 20 modifications, 0 destruction, garde du plan `PASS`. AC #4 laissé non coché : schémas, permissions, cycle de vie et référence pricing sont livrés, mais `docs/V1_LAUNCH_PLAN.md` n'a pas été modifié sur instruction (édition en cours de l'owner) ; le texte de remplacement est dans les notes. Aucun test automatisé ajouté. Le branchement des traitements (TASK-549), l'exposition (TASK-550), l'interface (TASK-551), le suivi (TASK-552) et le taux quotidien (TASK-559) restent à faire.
<!-- SECTION:FINAL_SUMMARY:END -->
