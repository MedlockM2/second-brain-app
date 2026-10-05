---
id: TASK-425
title: >-
  Implémenter le site web avec paiement Stripe et l'extension navigateur selon
  le benchmark validé (task-424)
status: To Do
assignee: []
created_date: '2026-10-04 16:22'
updated_date: '2026-10-04 17:50'
labels:
  - feature
  - web
dependencies:
  - TASK-424
references:
  - docs/research/task-357-legal-pages-hosting/README.md
  - docs/AUTHENTICATION_SETUP.md
  - media_summarizer/api/endpoints/media.py
priority: medium
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Construire le site web de l'app, avec son paiement Stripe, et l'extension navigateur qui enregistre une page dans le second cerveau.

**Avant d'écrire une ligne, lire `docs/research/task-424-*/README.md`** : la section `Owner Validation` porte la décision de l'owner (périmètre du site, proposition de design retenue parmi les maquettes `mobile-design-mockups/website_direction_*/`, intégration du paiement Stripe, framework d'extension, navigateurs cibles, méthode d'authentification, ce que la première version capture) et l'architecture à suivre. Si le champ `Decision` renvoie à un `complement-response-*.md`, le lire aussi. La décision de l'owner prime sur la recommandation initiale du README.

Si le README découpe l'implémentation en plusieurs lots, ne réaliser que le premier, puis créer les tâches des lots suivants dans le backlog, chacune dépendant de celle-ci.

L'hébergement du site suit le README task-424. Si **task-357** (pages légales) est déjà tranchée, réutiliser cet hébergement plutôt que d'en ouvrir un second.

## Notes pour l'owner (non vérifiables par l'agent)

- **Publication** : la soumission au Chrome Web Store, à Firefox Add-ons, et à Safari si retenu, ainsi que la mise en ligne du site, se font par l'owner, après le merge.
- **Nom marketing** : une fiche de store et un domaine portent le nom du produit, encore provisoire (task-186). Publier sous « Media Summarizer » puis renommer coûte une nouvelle soumission.
- **Stripe** : créer le compte Stripe, activer le mode live, configurer la TVA et, si l'option RevenueCat est retenue, connecter Stripe à RevenueCat, sont des actions de l'owner. Le développement se fait en mode test, avec des clés lues depuis Secrets Manager, jamais commitées (le dépôt est public).
- **Test manuel** : charger l'extension non empaquetée dans Chrome contre l'API `-dev`, enregistrer une page, et vérifier qu'elle apparaît dans l'app mobile. Les changements backend, s'il y en a, ne sont actifs qu'après le déploiement par push sur `main`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le périmètre de la décision owner du README task-424 (ou de son premier lot) est implémenté, rien au-delà
- [ ] #2 Le build de l'extension et celui du site passent sans erreur avec les commandes documentées dans le dépôt
- [ ] #3 Le chemin d'enregistrement de l'extension est câblé jusqu'à l'endpoint retenu par le README, avec la méthode d'authentification retenue
- [ ] #4 Si le backend est modifié : ruff et mypy passent, et docs/AUTHENTICATION_SETUP.md ou docs/CANONICAL_MEDIA_API_CONTRACT.md décrit le nouveau contrat
- [ ] #5 Un document du dépôt décrit comment builder l'extension, la charger en mode développeur contre l'API -dev, et la publier sur chaque store retenu
- [ ] #6 Si le README prévoit d'autres lots, chacun a sa tâche dans le backlog, qui dépend de celle-ci
- [ ] #7 Si le paiement fait partie du lot réalisé : le parcours Stripe retenu par le README est câblé de bout en bout dans le code : du site jusqu'à la mise à jour des droits de l'utilisateur, en mode test. docs/REVENUECAT_ENTITLEMENTS.md décrit le nouveau canal, et aucune clé Stripe n'est commitée
<!-- AC:END -->
