---
id: TASK-549
title: Faire passer les traitements fournisseurs par le contrôle budgétaire commun
status: To Do
assignee: []
created_date: '2026-10-26 22:21'
updated_date: '2026-10-28 14:04'
labels:
  - backend
  - feature
dependencies:
  - TASK-548
  - TASK-556
documentation:
  - docs/research/pricing-challenge/README.md
  - docs/research/task-547-beta-budget-control/README.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: high
type: feature
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Un budget fiable ne protège pas la bêta si une transcription, une collecte, un aperçu automatique, une traduction ou une reprise peut encore dépenser en dehors du contrôle commun. Les anciens débits en minutes ne doivent pas s’ajouter au nouveau comptage.

## Décisions acquises

Formule bêta autonome, indépendante des abonnements commerciaux, avec toutes les fonctionnalités actuellement disponibles. Budget de 5 EUR par compte et par mois, sans report, pour les coûts fournisseurs d’usage hors infrastructure fixe. Les 5 EUR sont considérés comme suffisamment permissifs : ne pas rouvrir ce calibrage. Valoriser l’usage réellement mesuré au tarif normal hors crédits promotionnels ; prendre en compte les tarifs de cache réellement appliqués. L’utilisateur voit un pourcentage, sans euros, crédits ni proposition d’achat. Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles lorsque la capacité est épuisée ; un nouveau traitement payant reste soumis au contrôle commun.

Source de vérité : docs/research/pricing-challenge/README.md, Owner Validation et R.1–R.2, décisions du 2026-10-26 et accord de l’owner sur la préparation de la formule bêta autonome.
## Périmètre confirmé

Appliquer la décision de docs/research/task-547-beta-budget-control/README.md et utiliser le socle de TASK-548. Couvrir tous les chemins actuellement accessibles : transcription, collectes, parsing, aperçus, traductions, générations sur média et dossier, chat, nouvelles tentatives et fournisseurs de repli. Reprendre aussi les traitements déclenchés automatiquement ou à la lecture ; une lecture pure sans nouvel appel reste gratuite. Fournir une cartographie des appels, unités, règles d’attribution et points de contrôle. Retirer les anciens débits en minutes remplacés, sans dual-write ni migration de fixtures. Ne pas modifier la logique de génération des quiz, le sync Spotify, la livraison email ou Whisper ; intervenir dans les points de contrôle fournisseurs partagés nécessaires au budget. Les fonctionnalités encore non livrées, dont un éventuel nouvel artefact avec synthèse vocale, ne sont pas à implémenter ici.

## Limites de livraison

Aucune offre commerciale, recharge payante ou facturation à crédits à créer. Aucun changement de fournisseur ou de modèle sans décision validée ; ne pas rouvrir le contrôle du débit de tokens déjà arbitré par task-459. Aucun test automatisé demandé, aucun appel local à FastAPI en guise de preuve, aucune migration de fixtures ni compatibilité avec les anciens débits remplacés. Les vérifications après déploiement et sur appareils relèvent de la checklist propriétaire de task-440, pas d’un critère d’acceptation de cette tâche. Aucun secret, identité de compte ou payload fournisseur brut dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Chaque chemin fournisseur actuellement accessible est relié au contrôle commun avant dépense et au règlement approprié : transcription, collectes, parsing, aperçus, traductions, générations média/dossier et chat ; la cartographie de couverture est documentée.
- [x] #2 Les déclenchements automatiques, reprises et fournisseurs de repli utilisent les règles de la décision validée ; aucun échec de lecture de solde ou coût non bornable ne contourne la protection retenue.
- [x] #3 Les quantités facturées, tarifs de modèle et cache et règles d’attribution sont câblés sans double comptage ; les métriques manquantes, doublons et appels partagés suivent explicitement la décision du benchmark.
- [x] #4 Les anciens débits en minutes remplacés sont retirés des chemins concernés, sans ancien chemin de secours, double écriture ou migration de fixtures ; les opérations sans nouvel appel fournisseur restent hors débit, sauf l'enregistrement par un autre compte d'un contenu déjà traité, débité selon la règle 12 de la décision TASK-547.
- [x] #5 La documentation de couverture et des limites résiduelles est à jour ; Ruff et mypy passent sur les fichiers backend modifiés, sans ajout de tests automatisés ni exigence de vérification après déploiement.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Reprise.** Commencée par un agent arrêté en cours de route (budget épuisé), puis reprise dans le même worktree et sur la même branche. Le plan initial a été suivi ; l'étape « admission de secours » au worker de complétion n'a pas été retenue (voir AC #2).

**AC #1, couverture.** Tout le routage passe par `core/services/budget_guard.py`, au-dessus du registre de TASK-548 (`admit`/`admit_import`, `start`, `BudgetCall.settle`/`release`, `release_held`, `release_open`, `release_unused_acquisition`, `settle_collections`, `precheck`, `charge_content_reuse`). Carte complète dans `docs/BETA_BUDGET_CONTROL.md` §7.1 :
- transcription : admission par `audio_quota_gate` pour tous les producteurs, et dans la requête pour l'upload audio et la recherche de podcasts (`media_submission`). `deepgram_worker` envoie une tentative par requête HTTP ; tenacity est retiré.
- collectes : Apify passe par `apify_orchestration.start_run_for_job`, seul point de départ d'un run ; le post X par `x_ingestion_worker`.
- parsing : `document_measure` (pages PDF via `pypdf`, ajouté à l'extra `worker` et au lock ; frames TIFF ; diapositives PPTX ; feuilles XLSX ; image = 1 ; DOCX toujours au plafond) et `document_parsing_service` (LlamaParse, puis Unstructured comme tentative distincte). Le carrousel Instagram réserve une part par image.
- LLM : aperçu et générations dans `artifact_generator/worker`, chat dans `chat_service` (admission à l'acceptation du tour) et `chat_worker` (une tentative par appel), traduction dans `transcript_translation` avec un payeur explicite (`TranslationPayer`) porté par le message SQS.
- fin d'import : `media_completed_worker._close_import_budget`.
- Hors enveloppe : recherche Algolia, lecture, organisation, digest.

**AC #2, déclenchements, reprises, replis, pannes.** Aperçu et traduction sont réservés avec l'import (règle 10). Une étape qu'aucune admission n'a couverte réserve sa propre tentative au moment de l'appel : aperçu d'une sauvegarde dédupliquée, traduction relancée par `/raw-content` ou par le worker de recherche, chemin `POST /api/podcasts/submit`, imports sans acquisition payante. Chaque reprise et chaque repli est une tentative bornée (règle 6). Toute erreur du registre, ou une configuration tarifaire illisible, refuse (`budget_unavailable`, règle 7). L'ancien « fail open » est supprimé. Un règlement ou une libération qui échoue ne lève jamais d'erreur : le filet de 6 h libère la tentative à sa borne. Je n'ai pas ajouté d'admission « de secours » au worker de complétion pour les imports sans acquisition payante (sous-titres natifs, transcription Podcasting 2.0) : leurs appels réservent déjà eux-mêmes quand ils partent, et une seconde voie aurait dupliqué la règle.

**AC #3, quantités, tarifs, attribution.**
- Bornes LLM : octets UTF-8 de la requête complète, schéma compris (un token BPE couvre au moins un octet), et sortie = `max_completion_tokens` réellement envoyé.
- Traduction : `max_completion_tokens` = 1,5 × l'entrée, plafonné à 128 000 (`LLM_MODEL_MAX_OUTPUT_TOKENS`), envoyé à chaque appel.
- Coûts réglés : `llm_cost` (cache lu ou écrit, à la place du tarif frais, jamais en plus), `transcription_cost` à la seconde, `document_cost` sur les pages facturées, prix fixes Apify et X.
- Attribution : un import est une opération sous sa ligne de bibliothèque ; un artefact est `artifact:<id>`, un tour de chat `chat:<turn_id>`.
- Doublons : un rejeu d'admission est idempotent. Un doublon SQS en cours d'envoi reçoit `BudgetBusyError` ; passé le bail, la tentative est libérée `lost_in_flight`.
- Échecs : statut d'erreur du fournisseur → zéro ; issue inconnue → borne ; réponse inutilisable → son coût mesuré en dépense opérateur.
- Règle 12 : la valeur réglée de la collecte, de la transcription et du parsing est cumulée sur `media_idempotence.budget_value_nano_eur` (ADD atomique), celle de la traduction sur le verrou de traduction (`budget_value_nano_eur`).

**AC #4, retraits.**
- Supprimés : les débits et le règlement en minutes de `quota_enforcer` (il ne garde que l'instantané d'entitlement), `check_submission_allowed` et son fail open, le remboursement de chat en minutes, `record_observed_cost`, les lignes par compte de `user_usage_monthly`, `quota_debited_minutes` et `quota_debit_skipped`, la minute provisoire, `OUT_OF_MINUTES` et `ITEM_TOO_LONG` (remplacés par `BUDGET_EXHAUSTED`, `ITEM_TOO_LARGE` et `BUDGET_UNAVAILABLE`), `minutes_debited` et l'enregistrement du débit de chat (`record_turn_debit`, champs `quota_*`), `cost_per_minute_eur`.
- Lecture, organisation et réenregistrement par le même compte (task-281) restent gratuits.
- Règle 12 : `durable_media_service.charge_reused_content` est appelé à chaque sauvegarde dédupliquée (orchestrateur URL, recherche de podcasts). Si le budget ne suffit pas, la ligne est retirée et la requête renvoie le refus typé.

**AC #5, vérifications.**
- `ruff check .` : All checks passed.
- `mypy media_summarizer` : Success, 212 fichiers.
- `scripts/check_env_example_complete.py` : OK, avec les deux surcharges `LLM_MODEL_MAX_*` ajoutées en commentaire.
- `scripts/check_web_parity.py` : rien signalé.
- `uv lock --check` : OK.
- Terraform non modifié : la table et `BETA_BUDGET_TABLE` sont déjà injectées à toutes les Lambdas, et les droits IAM couvrent `table/*-<env>`.
- Aucun test automatisé ajouté.
- Docs mises à jour : `BETA_BUDGET_CONTROL.md` (§6, §7 carte, retraits, limites résiduelles), `CANONICAL_MEDIA_API_CONTRACT.md` (codes d'échec, tour de chat, refus d'upload), `CANONICAL_MEDIA_API_OPENAPI.yaml` (enum), `CHAT_DATA_MODEL.md`, `INGESTION_WORKERS_PROVIDERS.md`.
- `docs/V1_LAUNCH_PLAN.md` non touché.

**Ce qui reste pour TASK-550 (constaté dans le code)**
- Les clients mobile et web ne connaissent pas encore les trois nouveaux codes d'échec ni les refus `budget_*`. En attendant, ils les affichent comme l'échec générique.
- Encore à retirer du contrat : `minutes_*` de l'entitlements, `unit_conversion` de `/pricing`, `minutes_debited` du type TS du chat, `INSUFFICIENT_MINUTES`.

**Note owner (description, pas un AC)**
- Après déploiement, vérifier sur dev dans `beta_budget-dev` qu'un import crée ses tentatives (`transcription`, `review_blurb`, `translation`), puis qu'il les règle ou les libère.
- Aucun appel du chemin pré-existant ne doit écrire de ligne par compte dans `user_usage_monthly-dev`.
- Les lignes en minutes déjà présentes sur dev ne servent plus à rien. Leur suppression n'est pas nécessaire : l'effacement de compte les balaie.

**Questions pour l'owner (déduites de mon analyse, à valider)**
- Plafond de traduction 1,5 × l'entrée : il compte les tokens de raisonnement, et une traduction courte peut revenir coupée (non mesuré sur Luna). Une sortie coupée (`finish_reason: length`) est stockée et réglée telle quelle, avec un journal (`translation.output_ceiling_reached`). Faut-il au contraire la traiter comme un résultat non livré, ou poser un plancher au plafond ?
- Règle 12 et aperçu : la valeur facturée à un autre compte exclut l'aperçu du premier compte. La nouvelle sauvegarde a son propre aperçu, facturé s'il est généré, gratuit s'il est copié. Sans cela, le compte paierait deux aperçus. Est-ce l'arbitrage voulu ?
- Règle 12 et « watchers » : une sauvegarde faite pendant le traitement pour un autre compte ne paie que la valeur déjà réglée à ce moment-là, souvent nulle. Acceptable ?
- Artefact partagé entre comptes : il ne fait aucun appel fournisseur et n'est donc plus facturé (R.2). Il l'était en minutes avant (task-394). À confirmer.
- Refus asynchrones : pour une URL dont la durée n'est connue que dans le worker (podcast, YouTube, TikTok, Instagram, X), le refus arrive après la sauvegarde, sous forme de tuile en échec, et non à la soumission. La soumission elle-même n'est refusée que si le mois est épuisé.
- `POST /api/podcasts/submit` n'a aucun client dans le dépôt. Faut-il le supprimer (tâche de nettoyage séparée) ?
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Chaque appel payant (Deepgram, Apify, X, LlamaParse et Unstructured, OpenAI pour l'aperçu, les générations, le chat et la traduction) passe désormais par le contrôle budgétaire commun avant d'envoyer quoi que ce soit, via `core/services/budget_guard.py`. Pour un import, une seule admission couvre l'acquisition, l'aperçu et la traduction ; chaque reprise ou repli réserve sa propre tentative. Un résultat livré est réglé sur les métriques du fournisseur ; s'il n'y a pas de résultat, la réservation est rendue au testeur et le coût éventuel est imputé à l'opérateur. Une panne du compteur refuse le traitement. La traduction envoie `max_completion_tokens` = 1,5 × l'entrée (au plus 128 000). La règle 12 est en place : la valeur réglée est conservée avec le contenu et débitée au compte qui enregistre un contenu déjà traité pour un autre. Le système en minutes est retiré : débits, règlement, fail open, remboursement du chat, champs SQS, codes `OUT_OF_MINUTES`/`ITEM_TOO_LONG`, `minutes_debited`. La carte de couverture et les limites résiduelles sont dans `docs/BETA_BUDGET_CONTROL.md` §7. ruff, mypy et les gardes `.env.example` et parité web passent, et aucun test n'a été ajouté. Les clients (nouveaux codes, champs en minutes) relèvent de TASK-550. Six questions sont posées à l'owner dans les notes.
<!-- SECTION:FINAL_SUMMARY:END -->
