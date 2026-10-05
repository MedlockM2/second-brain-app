---
id: TASK-429
title: >-
  Pendant la beta, accorder à tous les comptes le palier le plus élevé et
  masquer toutes les entrées vers l'abonnement
status: Done
assignee: []
created_date: '2026-10-04 20:04'
updated_date: '2026-10-05 09:34'
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
- [x] #1 La pricing config déclare un bloc de beta (activé ou non, date de fin facultative) dans les defaults de pricing_config_service.py, et ce bloc est écrit activé sans date de fin dans la table DynamoDB pricing_config-dev, ce que vérifie une lecture par l'AWS CLI.
- [x] #2 Quand la beta est active, quota_enforcer résout pour tout compte, quels que soient sa date de création et son abonnement, l'allocation du palier le plus élevé, choisi par le classement par allocation et non par un identifiant écrit en dur ; le chemin de code existe et est branché sur les vérifications d'envoi et de génération.
- [x] #3 La consommation reste enregistrée dans les compteurs d'usage pendant la beta, par le même chemin qu'en dehors.
- [x] #4 L'endpoint des entitlements expose l'état de beta, et le client mobile le lit.
- [x] #5 Quand la beta est active, le mobile masque account-upgrade-button, ne pousse /paywall ni depuis MinutesWarningBanner ni depuis share-confirmation, et n'affiche aucune mention de l'essai gratuit.
- [x] #6 Toute nouvelle chaîne mobile est une clé présente dans les 11 catalogues de mobile/src/i18n/.
- [x] #7 ruff et mypy sont propres sur les fichiers backend modifiés, et tsc --noEmit est propre dans mobile/.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Le bloc : `beta_access`, activé dans les defaults

```json
{"enabled": true, "ends_at": null}
```

Écrit dans les defaults de `pricing_config_service.py` **et** dans
`pricing_config-dev` (lu en retour par l'AWS CLI, `updated_at`
2026-10-05T09:26:07Z ; la table ne portait que `revenue_model` et
`infra_cost_baseline`, tout le reste venant des defaults par `_merge_defaults`).

`enabled: true` dans les defaults, et non `false` + activation par environnement :
la beta est un état du **produit**, pas d'un déploiement. Un environnement dont la
table n'a pas le bloc (prod aujourd'hui, ou un environnement neuf) doit se
comporter comme la beta, pas se mettre à facturer ; et si la lecture DynamoDB
échoue, `_load_from_db` renvoie les defaults, donc la beta reste ouverte — la
dégradation va dans le sens du testeur. Écrire quand même le bloc en base sert à
pouvoir y poser `ends_at` sans build ni déploiement.

`ends_at` accepte un ISO 8601 avec ou sans fuseau (sans = UTC), `Z` comprise —
`fromisoformat` ne lit `Z` qu'à partir de 3.11 et la cible est 3.10, d'où
`_parse_instant`. Une date illisible **laisse la beta ouverte** et émet
`quota.beta_access_ends_at_unreadable` : une faute de frappe ne doit pas retirer
son allocation à tout le monde en silence.

### Le palier : classé, jamais nommé

`_widest_tier` prend le `max` du catalogue `tiers` selon `_allowance_rank`, une
paire `(minutes_included, max_minutes_per_item)` extraite du classement que
`_active_subscription` appliquait déjà aux lignes d'un même utilisateur — les deux
partagent donc littéralement la même fonction, et « la plus grande allocation »
veut dire la même chose des deux côtés. La clé du palier casse les égalités, pour
un ordre total. Aucun `audio_heavy` écrit en dur : vérifié sur les defaults,
`_widest_tier` répond `audio_heavy` / 720 min / 240 par item, et suivra l'owner
qui déplace une allocation, renomme ou ajoute un palier — y compris quand le
barème passera en crédits.

### Deux branches, et une consommation inchangée

Dans `get_entitlement_snapshot` :

- **avec abonnement** — `paid.raised_by(beta)`, pas l'allocation de beta telle
  quelle : le régime ne peut qu'ajouter, une formule en avance sur un axe garde cet
  axe. La période, elle, reste celle de l'abonnement. L'essai n'est pas consulté du
  tout, ce qui épargne la lecture de la ligne utilisateur que
  `_subscriber_allowance` paie, et `trial_raises_allowance_until` repasse à `None` :
  pendant la beta rien ne redescend à une date.
- **sans abonnement** — l'allocation du palier le plus large sur une période
  calendaire (`%Y-%m`, fin = début du mois suivant), c'est-à-dire la période d'une
  entitlement sans anniversaire propre. Le compteur se vide donc tous les mois et
  l'owner lit un chiffre par mois et par compte. Cette branche passe **avant**
  celle de l'essai, ce qui est exactement ce qui fait qu'un compte dont l'essai a
  expiré en septembre est servi comme un compte créé aujourd'hui.

Un palier d'abonnement absent du catalogue ne dé-entitle plus pendant la beta : le
log `quota.subscription_tier_not_in_pricing_config` reste, mais « tout le monde »
ne peut pas avoir d'exception dont la cause est un catalogue où l'utilisateur n'a
aucune part.

Rien n'a été touché côté compteurs : `_debit` passe par `resolve_period_key`, qui
appelle le même `get_entitlement_snapshot`, donc la ligne écrite est celle que la
jauge affiche, en beta comme en dehors. Les burst guards sont intacts.

### Le refus voyage avec son propre contexte

`evaluate_submission` ajoute `beta_access: true` au corps du refus
`out_of_minutes`, à côté de `has_plan` et `period_end` (`_beta_access_param`, même
forme que `_period_end_param`). `quotaError.ts` choisit alors quatre phrases
identiques aux existantes **moins la clause d'upgrade**. C'est ce qui évite de
faire traverser un état React à `ShareIntentContext` et à `artifactRefusal.ts`,
qui sont des fonctions pures : la phrase est construite à partir des faits qui
l'ont produite, et ne peut pas contredire la vérification. `quota.refusal.noPlan`
n'a pas de variante : pendant la beta tout compte est entitled.

Les entrées vers le paywall, elles, sont une question d'interface et passent par
`isBetaAccess` du `PurchasesContext` — vrai quand le backend l'annonce **et quand
il n'annonce rien**. C'est l'inverse de la règle habituelle (« un plan inconnu ne
doit jamais être rendu comme connu »), et volontairement : la question n'est pas
quoi afficher mais s'il faut proposer un achat impossible. Une requête
d'entitlements en échec n'est pas une raison d'envoyer un testeur sur un paywall.

### Mobile : ce qui disparaît

`account-upgrade-button` (la seule entrée produit), le lien « See plans » du
`MinutesWarningBanner` — le bandeau reste, savoir que l'allocation s'épuise sert
autant à un testeur — et le bouton de `share-confirmation`, exprimé par un
`onOpenPaywall: null` plutôt que par un drapeau de plus. La pastille d'essai de
l'Inbox et le compte à rebours de `SubscriptionStatusCard` tombent d'eux-mêmes :
`is_free_trial` est faux dans les deux branches de beta. La carte dit « Beta
access », garde la jauge, n'affiche aucune pastille de statut, et
`getResetDateLabel` répond « resets » (l'allocation se recharge vraiment) au lieu
du vague « period ends ».

Hors AC mais même cause : `settings/delete-account.tsx` affichait le bloc
« votre abonnement continue d'être facturé » dès que `isSubscribed`, qui est vrai
pour tout le monde en beta. Il est conditionné à `isSubscribed && !isBetaAccess` —
sur le seul écran qui doit être lu au mot, une fausse alerte de paiement n'est pas
acceptable.

Six clés nouvelles dans les 11 catalogues (`account.plan.betaAccess`,
`account.plan.minutesRuleBeta`, et les quatre `quota.refusal.beta*`). Aucune
nouvelle famille de pluriel : les durées passent par `tCount("duration.minutes")`,
déjà en place. Le type `Catalog` fait de l'absence d'une clé une erreur `tsc`,
donc la présence dans les onze est vérifiée par `npm run typecheck`.

### `07_paywall.yaml` : entrée par le deep link, le temps de la beta

Le flow tapait `account-upgrade-button`, qui n'existe plus pendant la beta. Il
entre à nouveau par `media-summarizer://paywall` (la version d'avant `ad76b79`),
parce que ce qu'il garde vaut toujours : les trois produits Test Store appariés
aux trois paliers, et les deux liens légaux exigés par les stores. La fin du flow
attend l'Inbox, puisque `dismiss` retombe sur `/(tabs)` quand il n'y a rien
derrière. À la fin de la beta, la carte d'Account revient et l'entrée par la carte
avec elle.

### Hors de portée depuis le worktree

Aucun AC n'a été laissé non coché. Deux choses restent à l'owner, et elles sont
déjà dans la description : écrire le même bloc dans `pricing_config-prod` (compte
AWS séparé), et vérifier sur device après déploiement qu'Account ne montre plus la
carte d'abonnement et que la jauge annonce 720 min. La procédure complète de la
date de fin est maintenant dans `docs/V1_LAUNCH_PLAN.md` § « Phase de beta », avec
la commande `put-item` et la règle de suppression (une clé retirée des defaults
survit dans la table : il faudra un `delete-item` sur les deux tables).

Aucun test automatisé n'a été ajouté (règle du projet). Les faits vérifiés ici le
sont par lecture AWS CLI, `ruff`/`mypy`, `tsc --noEmit` et ESLint.
<!-- SECTION:NOTES:END -->
