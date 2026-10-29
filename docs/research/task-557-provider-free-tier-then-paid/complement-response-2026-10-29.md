# Complement response — 2026-10-29

Réponse à `complement-request-2026-10-29.md` : quels fournisseurs rechargent eux-mêmes le compte en débitant le moyen de paiement de l'owner, pour que l'alerte sur le pourcentage du plafond ne serve **que** chez ceux où il faut recharger à la main.

Toutes les pages ont été consultées le **2026-10-29**. Le `README.md` reste la base ; ce complément ne le modifie pas.

## Réponse courte

Aucun fournisseur ne documente de **prélèvement bancaire** (SEPA, ACH) pour son API. Tous débitent une **carte enregistrée**. Pour le reste, les six fournisseurs se rangent en trois régimes :

| Régime | Fournisseurs | Faut-il une alerte « % du plafond » ? |
|---|---|---|
| **A. Prépayé avec recharge automatique** : un solde, rechargé sur la carte sous un seuil | OpenAI, Deepgram, API X | **Non**, si la recharge est activée et bien réglée. Il reste à surveiller l'**échec** de la recharge (voir § 3) |
| **B. Facturé à l'usage** : pas de solde, l'usage est facturé après coup sur la carte, jusqu'à une limite de dépense que l'owner fixe | Unstructured (carte), LlamaParse Starter, Apify Starter | **Non** pour la recharge, qui n'existe pas. Le seul arrêt est la limite de dépense que l'owner a fixée. Une alerte avant cette limite reste utile, mais c'est un choix de budget, pas de recharge |
| **C. Aucun paiement possible au-delà du gratuit** : blocage jusqu'au cycle suivant | LlamaParse **Free**, Apify **Free** | **Oui**, et rien à recharger : seul le passage au plan payant (régime B) supprime le blocage |

**L'alerte « % du plafond » n'est donc indispensable que pour le régime C**, c'est-à-dire tant que LlamaParse et Apify restent en Free. C'est aujourd'hui le rôle de `provider_pools` (alerte à 60 %, coupure à 90 %). Une fois ces deux comptes en Starter, plus aucun fournisseur n'exige de recharge manuelle.

## 1. Par fournisseur

### OpenAI — régime A

- « Auto recharge adds credits when your balance falls below the threshold you set », minimum 5 USD. Elle est « turned on by default during setup » ; le montant maximum dépend du *trust tier* ([Prepaid billing](https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing)).
- Limite mensuelle de recharge, optionnelle : une fois atteinte, « automatic recharges will not add more credits until the next month ». C'est le seul cas où une recharge manuelle redevient nécessaire, et l'owner le provoque lui-même s'il fixe une limite.
- Échec : « If a recharge payment fails, you receive an email », puis « API usage stops when the available balance is exhausted ».
- Moyen de paiement : la page ne liste que l'étape « payment information ». Les crédits API ne s'achètent qu'en USD ([Multi-currency billing](https://help.openai.com/en/articles/10421635-multicurrency-billing)). Aucun prélèvement SEPA documenté pour l'API.

### Deepgram — régime A

- Conditions générales, § 5.3(a) : par défaut, le plan Pay As You Go se recharge automatiquement « each time your Credit balance drops below a specific threshold », par exemple « autoreloading a $100 Subscription Fee when your balance dips below $10 ». § 5.4 : « you must be enrolled in auto-load or purchase additional Credits to continue using the Services » ([Terms](https://deepgram.com/terms)).
- Débit en USD sur le « Payment Method » enregistré (§ 5.2). Sans fonds : `402` ([Pricing](https://deepgram.com/pricing)).
- Changement depuis le README : la page tarifaire ne mentionne plus la recharge ; elle ne figure plus que dans les conditions générales. Le plan Growth (prépayé annuel, à partir de 4 000 USD) facture le dépassement chaque semaine sur une carte « on file ». Il est sans objet ici.
- **Vérification owner** : dans la console Deepgram (Billing), que l'auto-load est actif et sur quelle carte. Le crédit offert de 200 USD n'en exige aucune.

### API X — régime A, avec deux pièges

- « Auto-recharge activates when your balance falls below this amount » et « requires a saved payment method set as your default » ([Pricing](https://docs.x.com/x-api/getting-started/pricing)).
- **Elle ne se déclenche pas à solde nul ou négatif** : « You must add credits manually to resume ». Elle tourne au plus une fois toutes les 5 minutes. Un pic qui vide le solde en 5 minutes coupe donc le service et exige une recharge manuelle.
- Réglage : un seuil assez haut, et un montant de recharge supérieur à la consommation de pointe sur 5 minutes. Au solde actuel (4,95 USD le 2026-10-28), l'auto-recharge doit être activée **avant** que le solde n'atteigne zéro.
- Plafond de dépense par cycle : une fois atteint, « API requests will be blocked until the next billing cycle ».

### Unstructured — régime B

- Paiement par carte enregistrée : Account Settings → Billing → Manage Payment → Save card ([Billing](https://docs.unstructured.io/ui/account/billing.md)). 0,015 USD par page après les 10 000 pages offertes ([Pricing](https://unstructured.io/pricing)).
- Pas de solde, donc pas de recharge. Ni la fréquence de facturation ni une limite de dépense ne sont documentées : **vérification owner** dans l'onglet Billing.

### LlamaParse — régime C en Free, B en Starter

- Free : `402` à l'épuisement jusqu'au cycle suivant, sans moyen de payer au-delà (README § 2.3).
- Starter : « pay-as-you-go is enabled out of the box » à 1,25 USD / 1 000 crédits. La limite de dépense est réglée sous *When credits run out* ; au-delà, `402`. La facture, avec ses statuts Draft, Issued et Paid, et les moyens de paiement se gèrent sous Settings → Billing ([Billing](https://developers.llamaindex.ai/llamaparse/general/billing/index.md)). Ni prépayé ni recharge.
- Le mode de débit (carte automatique ou facture à régler) n'est pas décrit : **vérification owner**.

### Apify — régime C en Free, B en Starter

- Free : « you can't use the platform until the next billing cycle » ; « Pay-as-you-go is available only on paid plans » ([Subscriptions](https://docs.apify.com/account/subscriptions)).
- Starter : « All usage past your prepaid usage is charged as overage on a pay-as-you-go basis ». Le dépassement est facturé immédiatement dès 20 USD sur Starter (200 USD au-dessus), sinon il s'ajoute à la facture suivante. Il est borné par la *usage limit* : par défaut égale à l'usage inclus, au maximum 100 USD sur Starter. Apify prévient à l'approche des limites ([Billing](https://docs.apify.com/account/billing)). Ce point tranche l'écart 20 / 50 USD que le README (§ 5) laissait ouvert : les deux pages disent aujourd'hui 20 USD.
- Le mode de débit et le comportement en cas d'échec de paiement ne sont pas documentés : **vérification owner**.

## 2. Ce qui change dans la recommandation du README

1. **Alertes `alarm_pct` (§ 4 du README, point 4)** : il n'en faut ni pour OpenAI, ni pour Deepgram, ni pour X (régime A), ni pour Unstructured, ni pour LlamaParse et Apify une fois en Starter (régime B). L'alerte de pool n'a de sens que pour LlamaParse et Apify **tant qu'ils restent en Free**. La recommandation de retirer `provider_pools` après le passage en Starter est donc confirmée. S'ils restent en Free, le pool et son alerte à 60 % restent la seule protection, et doivent être conservés pour eux seuls.
2. **Réglages à ajouter aux actions owner (§ 3 du README)** :
   - OpenAI : ne pas fixer de limite mensuelle de recharge inférieure à la dépense attendue, sinon elle recrée une recharge manuelle.
   - API X : régler un seuil et un montant de recharge au-dessus de la consommation de pointe sur 5 minutes, et activer la recharge avant que le solde n'atteigne zéro.
   - Deepgram : confirmer en console que l'auto-load est actif et lié à une carte.
3. **Prélèvement bancaire** : aucun fournisseur n'en propose pour l'API. La « recharge sur coordonnées bancaires » passe partout par une carte enregistrée, à garder valide (expiration, plafond de la carte).

## 3. Le cas qui reste : la recharge qui échoue

Même en régime A ou B, une carte refusée, expirée ou à son plafond arrête le fournisseur. Ce cas ne se prévoit pas par un pourcentage : il se constate au premier refus. Le code le couvre déjà depuis TASK-566 : un compte « credit exhausted or refused » suspend le fournisseur au premier refus (`operator_guard`), avec une alarme. Celle-ci n'est active en dev qu'après TASK-567 (`enable_alarms = true`). OpenAI envoie en plus un email quand une recharge échoue ; les autres fournisseurs n'en documentent pas.

Aucun réglage d'alerte supplémentaire n'est donc nécessaire pour les régimes A et B, au-delà de cette alarme de suspension.

## 4. Non vérifiable sans console

- Deepgram : auto-load actif, montant et carte liée.
- LlamaParse Starter, Apify Starter et Unstructured : le dépassement est-il débité automatiquement sur la carte, ou facturé à régler ?
- Comportement de chaque fournisseur en cas d'échec de paiement (sauf OpenAI : email, puis arrêt à solde nul).

Recherche documentaire uniquement : aucun compte, paiement ni code n'a été modifié.
