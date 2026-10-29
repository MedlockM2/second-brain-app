---
id: TASK-566
title: >-
  Protéger la dépense opérateur et suspendre les appels lors d’incidents
  fournisseurs selon le benchmark validé
status: To Do
assignee: []
created_date: '2026-10-28 17:00'
labels:
  - backend
  - observability
  - pricing
  - feature
dependencies:
  - TASK-563
  - TASK-549
references:
  - docs/research/task-563-provider-capacity-fairness-operator-safety/README.md
  - docs/BETA_BUDGET_CONTROL.md
  - >-
    backlog/tasks/task-547 -
    Benchmarker-le-contrôle-permettant-de-respecter-le-budget-fournisseur-de-la-bêta.md
  - >-
    backlog/tasks/task-552 -
    Produire-un-suivi-exploitable-de-l’usage-des-coûts-et-des-refus-bêta.md
  - >-
    backlog/tasks/task-557 -
    Benchmarker-lusage-des-volumes-gratuits-puis-la-bascule-automatique-sur-un-crédit-provisionné-pour-chaque-fournisseur.md
  - >-
    backlog/tasks/task-558 -
    Mettre-en-place-la-bascule-des-volumes-gratuits-vers-le-crédit-provisionné-selon-le-benchmark-validé-TASK-557.md
priority: high
type: feature
ordinal: 172000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'enveloppe de 5 EUR par compte ne borne pas la facture totale : les coûts des échecs sont remboursés au testeur mais restent payés par l'opérateur, de nouvelles opérations peuvent répéter ces échecs et certains coûts variables sont hors enveloppe. Une recharge automatique ou un volume gratuit ne constitue pas nécessairement un plafond financier fiable. Les reprises limitées d'une seule opération ne suffisent pas à contenir un incident collectif.

## Responsabilité

Livrer les protections de dépense et de suspension/reprise validées : périmètres, périodes, engagements en cours, dépenses réussies et dépenses d'échec, limites côté application et checklist des limites côté fournisseur. Une suspension doit viser les nouvelles dépenses concernées et préserver bibliothèque, lecture, organisation et résultats existants. Traiter les appels déjà partis et leur règlement sans leur attribuer une coupure rétroactive impossible.

Réutiliser le registre financier commun, les coûts mesurés ou bornés et les événements des contrôles de capacité ; ne pas créer une source financière indépendante qui recompte les mêmes appels. Distinguer consommation valorisée, réutilisation sans appel, gratuit/crédit promotionnel et trésorerie effectivement facturée. Un remboursement utilisateur ne diminue pas la dépense opérateur. La conduite à tenir quand la mesure ou le contrôle manque suit la décision, sans transformer une inconnue en zéro.

Cette tâche possède les mécanismes actifs de protection, leurs événements/alertes opérationnels et le runbook de suspension/reprise. TASK-552 reste propriétaire du rapport général d'usage/coûts et de ses indicateurs ; fournir les données sans construire un second reporting. TASK-557/558 restent propriétaires de la bascule gratuit/payant, des plans, recharges, crédits et du sort de provider_pools : ne pas réintroduire une coupure arbitraire à 90 % du gratuit sous prétexte de protéger la facture. Articuler les seuils retenus avec leur décision finale ; les actions réelles de compte/paiement sont une checklist owner.

Ne pas modifier la règle de remboursement sans résultat ni l'enveloppe utilisateur. Tout plafond sur la facture réellement garantie et toute limite résiduelle doivent être expliqués honnêtement, y compris coûts hors enveloppe et appels en vol.

## Indépendante de TASK-564

TASK-564 est reportée (décision de l'owner du 2026-10-29). Les garde-fous de cette tâche se raccordent donc à `reserve` et à la transition `held → sending` existantes de `beta_budget_db`, sans permis ni epoch de capacité. Ils doivent rester réutilisables par TASK-564 lorsqu'elle reprendra. Périmètre ajouté : l'alerte de dépense opérateur par compte actif. Valeurs de `C_m` et des pertes : Owner Validation, points 3 et 4.

## Crédit épuisé

Chaque fournisseur utilisé doit distinguer « crédit épuisé » d'une panne ou d'un rate limit, comme `utils/llm_failure.py` le fait déjà pour OpenAI et `apify_payment_required` pour Apify. À ajouter, d'après le relevé de code du 2026-10-29 :
- Deepgram : un 402 tombe dans une erreur générique (`DeepgramRefusedError`).
- LlamaParse et Unstructured (`infrastructure/resolvers/`) : un 429 est réessayable et tout autre 4xx, dont un 402, est non réessayable sans être nommé crédit épuisé.
- Tout autre fournisseur payant sans cas dédié.

Pour chacun, lire dans la documentation du fournisseur par quel code et quel corps il signale un crédit épuisé, et vérifier qu'un crédit épuisé annoncé par un 429 ne soit pas réessayé comme un rate limit passager. LlamaParse retombe déjà sur Unstructured quelle que soit l'erreur. Cette distinction décide du réessai : un crédit épuisé n'est jamais réessayé (le même appel aura la même réponse tant que personne n'a rechargé), alors qu'un timeout, une 5xx ou un rate limit passager gardent leurs reprises bornées. Un seul refus de crédit suspend les nouvelles dépenses chez ce fournisseur (circuit), sans seuil à pourcentage du gratuit, jusqu'au renouvellement ou à la reprise retenue.

## Décision à appliquer

Lire la décision finale de l'owner dans docs/research/task-563-provider-capacity-fairness-operator-safety/README.md, section Owner Validation, champ Decision et sections qu'il cite ; la recommandation seule ne vaut pas validation. Cette tâche dépend de TASK-563 et ne démarre pas avant son acceptation. Les choix de technologie et les paramètres sont ceux de cette décision, pas ceux d'une proposition historique.

## Règles communes

Conserver le budget utilisateur validé et les remboursements de TASK-547, réutiliser les points fournisseurs communs et le registre de TASK-548/549. Respecter TASK-562 : pas de réutilisation des artefacts demandés, aperçu excepté. Ne pas modifier Spotify sync, livraison email, logique de génération des quiz, Whisper ou facturation à crédits. Toute extension des API média/artefacts suit les chemins canoniques, jamais de nouveaux endpoints sous /api/v1/.

Retirer le code remplacé sans compatibilité, double chemin ni migration de fixtures. Pas de tests automatisés, appel local à FastAPI ou exigence de déploiement. Les actions de compte et la vérification AWS après merge/push relèvent d'une checklist owner. Aucun secret, identité de compte ou donnée de testeur dans les fichiers suivis. Tout changement de comportement client couvre mobile et web ; logique neutre dans packages/core, parité Web et contrôles statiques des packages concernés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les protections financières et règles de suspension/reprise retenues sont configurées et câblées aux nouvelles dépenses du périmètre validé, y compris reprises, replis et coûts hors enveloppe explicitement retenus.
- [ ] #2 Le suivi des engagements et dépenses réutilise la source comptable commune ; remboursements, métriques manquantes, réutilisations sans appel et dépenses d’échec suivent la décision sans double comptage ni coût inconnu enregistré comme nul.
- [ ] #3 Les états de suspension et reprise, leur portée et le sort des appels déjà partis sont câblés ; lecture, organisation et résultats disponibles restent accessibles et les tentatives concurrentes de reprise sont traitées selon la décision.
- [ ] #4 Les événements et alertes opérationnels alimentent le suivi TASK-552 ; le runbook décrit seuils, garanties et dépassements résiduels, diagnostic, reprise et checklist de console en cohérence avec TASK-557/558.
- [ ] #5 Les refus nouveaux ont un contrat et un affichage cohérents sur mobile/web ; Ruff/mypy, terraform validate si nécessaire et les contrôles statiques des packages modifiés passent, sans tests automatisés, paiement ou déploiement requis.
- [ ] #6 Chaque fournisseur payant reconnaît un crédit épuisé comme un état distinct, non réessayé, tandis que les erreurs passagères restent réessayées (Deepgram ajouté ; OpenAI, Apify et X vérifiés) et un seul refus de ce type ouvre le circuit de ce fournisseur.
<!-- AC:END -->
