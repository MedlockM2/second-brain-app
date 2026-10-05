---
id: TASK-429
title: >-
  Pendant la beta, accorder à tous les comptes le palier le plus élevé et
  masquer toutes les entrées vers l'abonnement
status: To Do
assignee: []
created_date: '2026-10-04 20:04'
labels:
  - feature
  - mobile
  - pricing
dependencies: []
references:
  - media_summarizer/core/services/quota_enforcer.py
  - media_summarizer/core/services/pricing_config_service.py
  - media_summarizer/api/endpoints/entitlements.py
  - mobile/app/(tabs)/account.tsx
  - mobile/src/components/MinutesWarningBanner.tsx
  - mobile/app/share-confirmation.tsx
  - mobile/src/components/SubscriptionStatusCard.tsx
  - mobile/src/lib/subscriptionDisplay.ts
  - docs/V1_LAUNCH_PLAN.md
  - docs/research/pricing-challenge/README.md
priority: high
type: feature
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Le besoin

Pendant la phase de beta, avant la publication sur les stores, les testeurs ne peuvent pas souscrire d'abonnement. L'owner veut qu'ils consomment le plus possible gratuitement, pour mesurer l'usage réel de l'app. Ces statistiques serviront à fixer les allocations du nouveau barème (`docs/research/pricing-challenge/README.md`, question 5).

Deux décisions de l'owner, prises le 2026-10-04 :

- **Tous les comptes** reçoivent le palier le plus élevé pendant la beta, les testeurs déjà inscrits comme les nouveaux. L'essai actuel ne suffit pas : il dure 30 jours à partir de la création du compte (`_free_trial_window`, `media_summarizer/core/services/quota_enforcer.py:448`), donc les testeurs inscrits début septembre l'ont déjà perdu.
- **La beta dure trois mois**, mais **sa date de début n'est pas encore fixée** : la V1 est encore en construction et l'owner l'annoncera. Le mécanisme doit donc fonctionner sans date de fin connue. La date de fin s'ajoute plus tard par configuration, sans nouveau build ni nouveau déploiement de code (procédure dans `docs/V1_LAUNCH_PLAN.md`, § « Phase de beta »).

## Le comportement attendu

**Côté backend** :
- La pricing config porte un bloc de beta : activé ou non, avec une date de fin facultative. Tant qu'il est actif et que la date de fin, si elle existe, n'est pas passée, **tout compte reçoit l'allocation du palier le plus élevé**, quels que soient sa date de création et son abonnement. Le palier est déterminé par le même classement par allocation que `_active_subscription`, pas par un identifiant écrit en dur. Ce classement reste juste quand le barème en crédits remplacera les minutes.
- **La consommation continue d'être comptée** normalement, période par période. C'est la raison d'être de la beta : les compteurs d'usage doivent rester exploitables pour les statistiques.
- L'état de beta est exposé au mobile par l'endpoint des entitlements (`media_summarizer/api/endpoints/entitlements.py`), à côté de `is_free_trial`.
- Le bloc est activé dans `pricing_config-dev` sans date de fin. Pour `pricing_config-prod`, compte AWS séparé, voir la note à l'owner. Le docstring de `_merge_defaults` rappelle qu'une clé absente des defaults reste dans la table. Le bloc doit donc être écrit dans la table, pas seulement ajouté aux defaults du code.

**Côté mobile**, quand la beta est active :
- La carte d'entrée vers l'abonnement d'Account est masquée (`account-upgrade-button`, `mobile/app/(tabs)/account.tsx:198-226`, qui pousse `/paywall`).
- Aucun autre chemin ne mène au paywall : `MinutesWarningBanner` (`mobile/src/components/MinutesWarningBanner.tsx:78`, `reason=running_low`) et le refus de quota dans `mobile/app/share-confirmation.tsx:174` (`reason=out_of_minutes`). Un refus de quota reste lisible, mais il ne propose pas de souscrire.
- Le compte à rebours et les mentions de l'essai gratuit (task-301 : `SubscriptionStatusCard`, la pastille de l'Inbox, `subscriptionDisplay.ts`) ne s'affichent pas : pendant la beta, il n'y a pas d'essai qui se termine. La carte d'état dit simplement que le compte a un accès beta au palier le plus élevé, avec sa jauge de consommation.
- Toute nouvelle chaîne passe par une clé i18n présente dans les 11 catalogues, avec les familles de pluriel si un nombre est affiché.

## Ce qui n'est pas dans le périmètre

- **La fin de la beta.** Quand elle se termine, le bloc et tout le code qui le lit sont **supprimés**, pas désactivés (règle « Nothing is deployed yet » du `CLAUDE.md`). Ce sera une tâche à part, créée au moment où la date de fin sera connue.
- **Le nouveau barème en crédits** de `docs/research/pricing-challenge/README.md`. Il n'est pas encore validé (`owner_decision: pending`). Cette tâche s'appuie sur les paliers actuels.
- Le contenu de l'écran `/paywall`. Il reste dans l'app, simplement inaccessible.

## Note à l'owner (hors AC)

Écrire le même bloc, activé et sans date de fin, dans `pricing_config-prod` (compte `866874944541`), puisque l'agent n'y a pas forcément accès.

Après le push sur `main` et le déploiement : sur un compte de test dont l'essai a expiré, vérifier dans l'app qu'Account n'affiche plus la carte d'abonnement et que la jauge annonce l'allocation du palier le plus élevé. Faire de même dans un build TestFlight, qui doit passer par l'OTA (task-340) ou par un nouveau build.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La pricing config déclare un bloc de beta (activé ou non, date de fin facultative) dans les defaults de pricing_config_service.py, et ce bloc est écrit activé sans date de fin dans la table DynamoDB pricing_config-dev, ce que vérifie une lecture par l'AWS CLI.
- [ ] #2 Quand la beta est active, quota_enforcer résout pour tout compte, quels que soient sa date de création et son abonnement, l'allocation du palier le plus élevé, choisi par le classement par allocation et non par un identifiant écrit en dur ; le chemin de code existe et est branché sur les vérifications d'envoi et de génération.
- [ ] #3 La consommation reste enregistrée dans les compteurs d'usage pendant la beta, par le même chemin qu'en dehors.
- [ ] #4 L'endpoint des entitlements expose l'état de beta, et le client mobile le lit.
- [ ] #5 Quand la beta est active, le mobile masque account-upgrade-button, ne pousse /paywall ni depuis MinutesWarningBanner ni depuis share-confirmation, et n'affiche aucune mention de l'essai gratuit.
- [ ] #6 Toute nouvelle chaîne mobile est une clé présente dans les 11 catalogues de mobile/src/i18n/.
- [ ] #7 ruff et mypy sont propres sur les fichiers backend modifiés, et tsc --noEmit est propre dans mobile/.
<!-- AC:END -->
