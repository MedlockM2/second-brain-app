---
id: TASK-454
title: Soumettre les releases iOS et Android et suivre les reviews stores
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
updated_date: '2026-10-30 15:00'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-449
  - TASK-450
  - TASK-451
  - TASK-452
  - TASK-453
  - TASK-447
  - TASK-166
  - TASK-443
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/PRODUCTION_RELEASE_RUNBOOK.md
  - docs/RELEASE_LOG.md
priority: high
ordinal: 61000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — donner le go de soumission, sélectionner les bons binaires, envoyer les dossiers et traiter les retours des stores.

## Contexte et périmètre

La release publique reste Pre-release dans RELEASE_LOG.md. task-45 a livré un runbook mais son statut Done ne constitue pas une preuve de publication. Soumettre les binaires production validés après la bêta ; ne pas promouvoir ceux qui ciblent dev. Vérifier les gates et consigner toute dérogation explicite de l’owner. Prévoir la maîtrise de la date de disponibilité avant le soft launch ; ne pas annoncer un délai de review garanti.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.

## Gate : basculer les pages légales vers le domaine avant de soumettre

Décision owner du 2026-10-30 : pour la review pré-bêta, les pages légales sont servies sur le domaine par défaut de CloudFront (`https://<id>.cloudfront.net/...`) avec une adresse de contact gratuite dédiée (task-444, amendement du README de task-357). Une fois le domaine acheté (task-443), et **avant** de soumettre la version 1.0 en production :

- associer `www.<domaine>` à la même distribution CloudFront (alias + certificat ACM en `us-east-1`, enregistrement Route 53), et garder l'adresse CloudFront fonctionnelle pendant la bascule ;
- remplacer les adresses provisoires dans `mobile/src/constants/legal.ts` (OTA possible), dans App Store Connect (Privacy Policy URL, Support URL) et dans la Play Console (politique de confidentialité, URL de suppression de compte) ;
- remplacer l'adresse de contact provisoire par l'adresse sur le domaine : texte des pages, `legal.ts`, consoles, formulaire commerçant DSA d'Apple ;
- vérifier qu'App Store Connect accepte encore la modification de Privacy Policy URL avant la soumission de la 1.0 (déduction non documentée par Apple, cf. README de task-357).
## Décision du 2026-10-30 : pas d'écran de consentement IA

Apple 5.1.2(i) demande une permission explicite avant d'envoyer des données personnelles à une IA tierce. L'owner a choisi de soumettre **sans écran de consentement** : Readwise Reader et Recall, deux apps de la même catégorie avec l'IA au cœur, passent leurs mises à jour sans un tel écran depuis l'ajout de la règle (novembre 2025). Le risque restant porte sur une première review. La politique de confidentialité ne promet donc aucun consentement : elle annonce les fournisseurs d'IA (section 4.1) et rattache leur traitement au contrat (section 12).

**Si un rejet cite 5.1.2(i)** : écran après le choix de la langue, gardé comme celui-ci dans `app/(tabs)/_layout.tsx`, qui nomme OpenAI, Deepgram, LlamaParse et Unstructured avec ce que chacun reçoit et signale la conservation possible de l'audio par Deepgram ; boutons « Allow » / « Not now » ; accord enregistré sur le compte ; retrait depuis l'onglet Account (5.1.1(ii)) ; politique 4.1 et 8 à remettre à jour ; compte de démo sans accord, et phrase dans les notes de review. Maquette d'abord.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La checklist pré-soumission identifie les décisions go/no-go et les preuves des gates mobile, prod, légal, OAuth, billing et Play.
- [ ] #2 RELEASE_LOG.md consigne les versions/builds et dates de soumission de chaque plateforme, sans credentials reviewers.
- [ ] #3 Les retours et états de review, corrections demandées et décisions de disponibilité sont documentés jusqu’à approbation ou report explicite.
- [ ] #4 Avant la soumission en production, les pages légales, la page de suppression de compte et l'adresse de contact sont sur le domaine de Deepn dans l'app et dans les deux consoles ; plus aucune adresse `cloudfront.net` ni boîte provisoire n'y figure, et le compte rendu le consigne.
<!-- AC:END -->
