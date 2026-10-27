---
id: TASK-441
title: >-
  Fixer et lancer la bêta autonome de trois mois avec un budget de 5 EUR par
  compte et par mois
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
updated_date: '2026-10-26 22:24'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-429
  - TASK-440
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/research/pricing-challenge/README.md
  - docs/research/task-547-beta-budget-control/README.md
priority: high
ordinal: 48000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — décider de la date de début et de fin, coordonner les testeurs, appliquer la configuration validée et consigner les observations. Aucune date de lancement ne peut être choisie par un agent.

## Pourquoi et périmètre

La bêta officielle n’a pas commencé du seul fait de l’ouverture de TestFlight. La décision antérieure d’accorder le palier commercial maximal est remplacée par la formule bêta autonome approuvée le 2026-10-26. task-429 reste l’historique terminé du mécanisme initial ; elle ne prouve pas que le nouveau contrôle financier est déjà livré. Le lancement attend les dépendances techniques et la validation propriétaire de task-440.

## Décisions acquises

Formule bêta autonome, indépendante des abonnements commerciaux, avec toutes les fonctionnalités actuellement disponibles. Budget de 5 EUR par compte et par mois, sans report, pour les coûts fournisseurs d’usage hors infrastructure fixe. Les 5 EUR sont considérés comme suffisamment permissifs : ne pas rouvrir ce calibrage. Valoriser l’usage réellement mesuré au tarif normal hors crédits promotionnels ; prendre en compte les tarifs de cache réellement appliqués. L’utilisateur voit un pourcentage, sans euros, crédits ni proposition d’achat. Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles lorsque la capacité est épuisée ; un nouveau traitement payant reste soumis au contrôle commun.

Source de vérité : docs/research/pricing-challenge/README.md, Owner Validation et R.1–R.2, décisions du 2026-10-26 et accord de l’owner sur la préparation de la formule bêta autonome.
## Lancement à documenter

Conserver une durée de trois mois, début fixé par l’owner et fin trois mois plus tard, avec fuseau explicite. Appliquer la configuration bêta et le budget retenus par le benchmark validé et l’implémentation, sans recopier une allocation en minutes ou déduire le budget d’un abonnement. Préparer et relire les environnements concernés sans exposer le reste de leur configuration. Un lancement sur dev n’exige pas le réveil de prod ; préparer prod ne vaut pas ouverture de prod. Le compte rendu doit dire explicitement quel environnement est ouvert et quel contrôle y a été vérifié.

Vérifier sur comptes nouveaux et existants l’accès aux fonctionnalités, le budget autonome, la recharge, le masquage des achats, les limites annoncées et la collecte d’usage. Décrire les modalités d’accès, de retour et de bilan de consommation sans identité de testeur. Les offres commerciales, le prix du palier haut et leur allocation restent ouverts ; aucun lien automatique entre ces offres et les 5 EUR de la bêta n’est à établir.

## Exécution propriétaire et limites

Exécution owner-only, dispatchable: false : les dates, opérations de configuration distante, appareils et release appartiennent à l’owner. Les critères portent sur le compte rendu et les décisions documentées ; ils ne deviennent pas des gates de déploiement pour les agents d’implémentation. Aucun nouveau test automatisé, aucune migration de fixtures, aucune compatibilité avec l’ancien comptage remplacé et aucune facturation commerciale à crédits. Ne pas toucher au sync Spotify, à la livraison email, à la logique de génération des quiz ou à Whisper. Aucun secret, identité de compte, identifiant de support ou payload brut dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le début décidé par l’owner et la fin trois mois plus tard sont consignés avec un fuseau explicite, sans utiliser la date d’ouverture de TestFlight comme début implicite.
- [ ] #2 Le compte rendu décrit la configuration et les environnements relus ou ouverts, avec la formule autonome à 5 EUR/compte/mois sans report et la référence au contrôle validé ; aucune identité de compte ni autre contenu de configuration n’est publié.
- [ ] #3 Les observations sur comptes nouveaux et existants décrivent accès aux fonctionnalités, pourcentage et recharge, refus lisibles, masquage des achats, accès aux contenus disponibles et collecte de consommation, après la validation de task-440.
- [ ] #4 Les modalités d’accès des testeurs, la collecte des retours et le bilan d’usage attendu en fin de bêta sont documentés sans identité de testeur ; les 5 EUR sont assumés suffisants pour cette phase sans nouvelle calibration des offres commerciales.
<!-- AC:END -->
