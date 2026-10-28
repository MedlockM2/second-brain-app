---
owner_decision: pending
---

# Benchmark : consommer le volume gratuit, puis basculer sans coupure sur un crédit provisionné

## Owner Validation

**Decision**: *(à remplir par l'owner)*
**Validated at**: *(date)*

## Recommendation

Le comportement voulu, « gratuit d'abord, puis payant sans interruption, financé par un crédit que l'owner a provisionné », est **obtenu par la configuration des comptes** chez quatre fournisseurs sur six. Il demande en plus **deux changements de code**, sans lesquels l'application coupe elle-même le service avant que le fournisseur ne le fasse.

| Fournisseur | Bascule automatique gratuit → payant | Comment l'obtenir | Plafond côté fournisseur |
|---|---|---|---|
| **OpenAI** | Oui. Les crédits gratuits éventuels sont consommés d'abord, puis le solde prépayé | Prépayé et **recharge automatique** (seuil + montant, minimum 5 USD, limite mensuelle de recharge optionnelle) | Alerte de dépense et plafond de dépense dur (`429`) |
| **Deepgram** | Oui. Le crédit offert (200 USD, sans échéance) puis le pay-as-you-go | Carte enregistrée et **auto-reload** (par défaut : +100 USD quand le solde passe sous 10 USD) | Aucun plafond de dépense documenté. Seul le montant de recharge borne la dépense |
| **LlamaParse** | **Non sur Free** : `402` à l'épuisement, jusqu'au cycle suivant | Passer en **Starter (50 USD/mois, 40 000 crédits inclus)**, où le pay-as-you-go est actif par défaut (1,25 USD / 1 000 crédits) | « When credits run out » : pause, ou continuer avec une limite mensuelle en dollars |
| **Unstructured** | Oui, si une carte est enregistrée (pay-as-you-go à 0,015 USD/page après les pages offertes) | Enregistrer une carte (Billing → Manage Payment → Save card) | Aucun plafond documenté |
| **Apify** | **Non sur Free** : accès bloqué jusqu'au cycle suivant, aucun dépassement possible | Passer **un compte** en Starter (19 USD/mois d'usage inclus), relever la *usage limit* pour autoriser le dépassement, et regrouper les trois acteurs sur ce compte | *Usage limit* par compte (jusqu'à 100 USD sur Starter) |
| **API X** | Sans objet : pas de volume gratuit récurrent, prépayé seul | Crédit prépayé et **auto-recharge** (seuil + montant) | Plafond de dépense par cycle, qui bloque les requêtes |

**Changements de code recommandés (non exécutés ici, à scoper en tâche d'implémentation après validation)** :

1. **Supprimer `provider_pools` et `provider_pool_guard`**, ou au minimum la coupure `stop_pct`. Aujourd'hui le garde **refuse les runs Apify à 90 % du volume gratuit** (`apify_adapter.start_actor_run` → `spend_allowed`, erreur `apify_pool_exhausted`). Il compte aussi des **pages** LlamaParse alors que le fournisseur facture des **crédits** (3 par page en mode Cost-effective), et il ne bloque rien côté LlamaParse (`record_spend` seul). Une fois les comptes basculés sur un crédit provisionné, ce garde est exactement l'interruption que l'owner veut éviter. La protection financière de l'opérateur passe aux plafonds fournisseurs du tableau. Celle du testeur est le budget bêta (TASK-547/548/549), indépendant du gratuit.
2. **Repli LlamaParse → Unstructured sur `402`** : le garder comme repli de panne, mais il cesse d'être le régime normal une fois LlamaParse en Starter. Une réponse `402` (crédits ou plafond épuisés) reste traitée comme un échec sans facturation, ce qui libère la tentative à zéro (TASK-549) avant le repli. Rien à changer de ce côté. Seul le commentaire « free tier » de `document_parsing_service` serait à mettre à jour.
3. **Comptes Apify** : réduire à **un seul compte payant** pour les trois acteurs (`APIFY_*` tokens dans le secret runtime, `apify_adapter._actor_configuration`). Trois comptes Free étanches, c'est trois blocages indépendants et trois tableaux de bord. Aucun code à changer : `apify_adapter._actor_configuration` lit un token par plateforme (`APIFY_YOUTUBE_API_TOKEN`, `APIFY_TIKTOK_API_TOKEN`, `APIFY_INSTAGRAM_API_TOKEN`). Il suffit de donner aux trois la même valeur dans le secret runtime.
4. **Alertes** : remplacer les seuils `alarm_pct` (60 %) par les alertes natives de chaque fournisseur (OpenAI spend alert, Apify usage limit, LlamaParse spending limit, X spending limit). Ce sont des réglages de console, sans code.

**Actions de compte, à faire par l'owner (consoles, paiement)** : voir § 3.

## 1. Constat dans le code (worktree du 2026-10-28, `main` à `7b644846`)

- `pricing_config_service.DEFAULT_PRICING_CONFIG["provider_pools"]` : `apify` 1 160 « results », `llamaparse` 10 000 « pages », `alarm_pct` 60, `stop_pct` 90.
- `provider_pool_guard.spend_allowed` n'est appelé **que** par `infrastructure/apify_adapter.py:214`. À 90 %, un nouveau run Apify est refusé (`apify_pool_exhausted`, retryable, mappé `PROVIDER_CREDITS_DEPLETED`).
- `provider_pool_guard.record_spend` est appelé par `apify_adapter.py:303` et par `document_parsing_service.record_document_consumption` (LlamaParse). Pour LlamaParse, le pool compte donc mais ne bloque jamais. À l'épuisement réel, le `402` du fournisseur devient un `ParseError` et déclenche le repli Unstructured.
- Les autres fournisseurs (OpenAI, Deepgram, Unstructured, X) n'ont pas de pool. Un `402` d'OpenAI est classé échec permanent (`llm_failure.py:282`, `REFUSAL_QUOTA`), et un `402` de l'API X donne `PROVIDER_CREDITS_DEPLETED` (`x_ingestion_worker.py:199`).
- État connu des comptes (sources du dépôt) : trois comptes Apify Free distincts, un par acteur (`docs/research/pricing-challenge/README.md`, correction 7) ; LlamaParse Free (10 000 crédits/mois) ; API X prépayée, solde de 4,95 USD le 2026-10-28 (`docs/research/task-547-beta-budget-control/README.md`). OpenAI est en tier *Build*, donc au moins 5 USD d'achats déjà faits (`docs/INGESTION_WORKERS_PROVIDERS.md`). Le mode de paiement Deepgram et Unstructured n'est pas connu dans le dépôt : **vérification owner**.

Le budget de 5 EUR par testeur n'est pas concerné. Il valorise l'usage au tarif normal, qu'il soit gratuit ou non (TASK-547, R.2).

## 2. Par fournisseur

Toutes les pages ont été consultées le **2026-10-28**. Les valeurs propres à un compte (plan, solde, cycle) ne se lisent que dans les consoles : elles sont signalées comme vérifications owner.

### 2.1 OpenAI (Luna)

- **Gratuit** : aucun volume gratuit récurrent pour l'API. « If your account has free credits, those are used before purchased credits » ([Prepaid billing](https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing)). Le tier *Free* n'est qu'une limite d'usage (100 USD/mois), pas un crédit ([Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)).
- **À l'épuisement** : « When a prepaid account runs out of credits, API requests begin returning a billing error » (`credit_balance_exhausted`). L'accès peut continuer brièvement, et le solde négatif est alors déduit de l'achat suivant.
- **Payer au-delà** : crédit prépayé. Recharge automatique « when your balance falls below the threshold you set », minimum 5 USD, avec une limite mensuelle de recharge optionnelle (« not an API usage limit »). Les crédits achetés expirent au bout d'un an.
- **Limites** : alerte de dépense (le trafic continue) et plafond dur (les requêtes reçoivent `429`) ([Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)).
- **Bascule automatique** : **oui**, avec la recharge automatique activée. Sans elle, l'arrêt survient à solde nul.

### 2.2 Deepgram

- **Gratuit** : « Every new account receives $200 in free credit », « available until you use it up ». Le crédit est unique, sans renouvellement ([Pricing](https://deepgram.com/pricing)).
- **À l'épuisement** : « then pay-as-you-go ». Sans fonds, une transcription renvoie `402 Payment Required` ([Errors](https://developers.deepgram.com/docs/errors)).
- **Payer au-delà** : pay-as-you-go par achat de crédits. « By default, your account is set to reload with $100 when remaining credit is $10 », désactivable ([Pricing](https://deepgram.com/pricing)).
- **Limites** : aucun plafond de dépense documenté. La page ne décrit que des limites de concurrence.
- **Bascule automatique** : **oui**, avec une carte et l'auto-reload. **Vérification owner** : moyen de paiement enregistré et réglage de l'auto-reload dans la console.

### 2.3 LlamaParse (LlamaCloud)

- **Gratuit** : plan Free à 10 000 crédits par mois. « Credits reset at the start of your next billing cycle » ([Billing](https://developers.llamaindex.ai/llamaparse/general/billing/index.md), [Pricing](https://www.llamaindex.ai/pricing)).
- **À l'épuisement (Free)** : « You've exceeded the maximum number of credits for your plan », `402`, jusqu'au cycle suivant. Le plan Free ne propose pas de dépassement : « Upgrade to starter for Pay-as-you-go credits ».
- **Payer au-delà** : Starter à 50 USD/mois (40 000 crédits inclus), Pro à 500 USD/mois (400 000 crédits). « Pay-as-you-go usage is enabled by default » à 1,25 USD / 1 000 crédits, jusqu'à 500 USD/mois sur Starter.
- **Limites** : Settings → Organization → Plan & Credits → *When credits run out* : « Pause jobs » ou continuer avec une limite mensuelle en dollars. Les jobs déjà lancés se terminent et sont facturés, donc la facture peut dépasser la limite.
- **Bascule automatique** : **non sur Free**. Sur Starter, oui : le volume inclus d'abord, puis le pay-as-you-go. L'alternative la plus proche sans abonnement est le statu quo : Free, puis repli Unstructured sur `402`.
- Coût à 3 crédits/page (mode Cost-effective, barème de TASK-548) : 10 000 crédits = 3 333 pages par mois. Starter apporte 13 333 pages incluses ; au-delà, chaque page coûte 0,00375 USD.

### 2.4 Unstructured

- **Gratuit** : « Start processing your data with 10,000 free pages » ([Pricing](https://unstructured.io/pricing)). **Unique ou mensuel : non tranché par les sources.** La page tarifaire ne le dit pas. La doc *Transform billing* parle encore de « 15,000 pages during the current month ». Des suivis tiers datent du 2026-08-28 un retour à 10 000 pages uniques à l'inscription. **Vérification owner** dans l'onglet Billing.
- **À l'épuisement** : non documenté pour le plan gratuit.
- **Payer au-delà** : « Pay only $0.015 a page after your first 10,000 free pages » ; carte enregistrée via Account Settings → Billing → Manage Payment → Save card ([Billing](https://docs.unstructured.io/ui/account/billing.md)).
- **Limites** : aucune documentée.
- **Bascule automatique** : **oui, si une carte est enregistrée** (pay-as-you-go après les pages offertes). Un crédit « provisionné » n'existe pas : c'est du paiement à l'usage sur carte.

### 2.5 Apify (YouTube, TikTok, Instagram)

- **Gratuit** : plan Free avec 5 USD d'usage inclus par mois ([Pricing](https://apify.com/pricing)).
- **À l'épuisement (Free)** : « your access to Apify's services will be blocked until the beginning of the next monthly cycle ». Le dépassement n'existe pas sur Free ([Subscriptions](https://docs.apify.com/account/subscriptions)).
- **Payer au-delà** : Starter à 19 USD/mois (19 USD d'usage inclus), Scale à 199 USD, Business à 999 USD. Les crédits inclus ne se reportent pas. Le dépassement est facturé « until you reach the usage limit configured in the billing ». Il est facturé immédiatement au-delà d'un seuil : 20 USD ou 50 USD selon la page sur Starter, 200 USD au-dessus ([Billing](https://docs.apify.com/account/billing), [Subscriptions](https://docs.apify.com/account/subscriptions)).
- **Limites** : Billing → Limits → *Custom usage limit*. Par défaut, elle égale le prépayé ; le maximum est de 100 USD sur Starter. Au-delà, les services sont suspendus.
- **Bascule automatique** : **non sur Free** (blocage). Sur un plan payant, oui : l'inclus d'abord, puis le dépassement facturé jusqu'à la *usage limit*. Les programmes de la boutique facturés au résultat sont débités sur l'usage du compte qui les lance.
- **Trois comptes Free** : ce sont trois blocages indépendants de 5 USD chacun. Les regrouper sur un compte Starter rend le dépassement possible et ne laisse qu'un seul plafond à régler.

### 2.6 API X

- **Gratuit** : aucun volume récurrent. Seule existe une promotion unique : « Earn $20 in free X API credits when you save your first eligible payment card and complete your first credit purchase », et la première auto-recharge est doublée jusqu'à 50 USD ([Pricing](https://docs.x.com/x-api/getting-started/pricing)).
- **À l'épuisement** : « API requests will be blocked until you add credits ». La page ne donne pas de code HTTP ; le code de l'application traite `402` comme des crédits épuisés.
- **Payer au-delà** : crédit prépayé et auto-recharge (montant et seuil). Elle exige un moyen de paiement par défaut, se déclenche au plus une fois par 5 minutes et **ne se déclenche pas si le solde est nul ou négatif**.
- **Limites** : plafond de dépense par cycle. Une fois atteint, les requêtes sont bloquées jusqu'au cycle suivant. Les posts lus sont plafonnés à 3 millions par cycle.
- **Bascule automatique** : sans objet (pas de gratuit). **La continuité dépend de l'auto-recharge** et d'un seuil assez haut pour qu'elle se déclenche avant que le solde n'atteigne zéro. Au solde actuel de 4,95 USD, une recharge manuelle ou l'activation de l'auto-recharge est nécessaire.

## 3. Actions de compte pour l'owner (aucune exécutée)

| Fournisseur | Action |
|---|---|
| OpenAI | Organisation de la clé de prod/dev → Billing : vérifier que l'auto-recharge est activée, fixer seuil et montant, éventuellement une limite mensuelle de recharge. Poser une spend alert. Le plafond dur ne vaut que s'il est voulu, car il coupe avec `429` |
| Deepgram | Console → Billing : carte enregistrée, auto-reload (par défaut 100 USD sous 10 USD) à confirmer ou ajuster, solde du crédit offert à relever |
| LlamaParse | Décider Free + repli Unstructured (statu quo) **ou** Starter (50 USD/mois). Si Starter : moyen de paiement, puis *When credits run out* → continuer avec une limite mensuelle |
| Unstructured | Billing : relever l'allocation gratuite (unique ou mensuelle) et enregistrer une carte |
| Apify | Choisir un compte unique et le passer en Starter (ou plus), régler la *Custom usage limit* et y reporter les tokens des trois acteurs. Clore ou laisser dormir les deux autres comptes Free |
| API X | Developer Console : moyen de paiement, auto-recharge (seuil > 0, montant), plafond de dépense par cycle |

## 4. Changements de code, à scoper après validation

| Changement | Fichiers | Condition |
|---|---|---|
| Retirer la coupure du pool Apify, puis `provider_pools` et `provider_pool_guard` entiers (compteur `__provider_pools__` de `user_usage_monthly` compris), une fois les comptes passés au payant | `pricing_config_service.py`, `provider_pool_guard.py`, `apify_adapter.py`, `document_parsing_service.py`, `utils/quota_usage_db.py` | Comptes Apify et LlamaParse configurés pour le dépassement |
| Si LlamaParse reste en Free : garder le repli sur `402`, et retirer quand même le pool, qui compte des pages au lieu des crédits et ne bloque rien | `document_parsing_service.py` | Décision statu quo LlamaParse |
| Un seul token Apify pour les trois acteurs : configuration seule, la même valeur dans `APIFY_YOUTUBE_API_TOKEN`, `APIFY_TIKTOK_API_TOKEN` et `APIFY_INSTAGRAM_API_TOKEN` | secret runtime (aucun code) | Compte unique retenu |
| Barème Apify « plan effectivement souscrit » (Starter : 2,30 USD / 1 000 pour Instagram) | `provider_tariffs.apify` (TASK-547, prix au plan Free) | Passage d'un compte en Starter |

## 5. Ce que je n'ai pas pu vérifier

- Plan, solde, moyen de paiement et réglages de recharge de chaque compte : consoles, owner seulement.
- Unstructured : allocation gratuite unique ou mensuelle ; comportement à l'épuisement sans carte.
- API X : code HTTP renvoyé à solde nul.
- Apify : seuil de facturation immédiate sur Starter (20 USD ou 50 USD selon la page).
- Deepgram : existence d'un plafond de dépense en console.

Recherche documentaire uniquement : aucun compte, paiement ni code n'a été modifié, aucun secret n'a été lu.
