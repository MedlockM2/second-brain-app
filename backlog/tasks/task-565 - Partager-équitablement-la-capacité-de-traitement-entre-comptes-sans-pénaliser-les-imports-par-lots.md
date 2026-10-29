---
id: TASK-565
title: >-
  Partager équitablement la capacité de traitement entre comptes sans pénaliser
  les imports par lots
status: To Do
assignee: []
created_date: '2026-10-28 16:59'
labels:
  - backend
  - mobile
  - web
  - scalability
  - feature
dependencies:
  - TASK-563
  - TASK-564
references:
  - docs/research/task-563-provider-capacity-fairness-operator-safety/README.md
  - docs/BETA_BUDGET_CONTROL.md
  - >-
    backlog/tasks/task-550 -
    Exposer-la-consommation-les-prévisions-et-les-refus-de-la-formule-bêta.md
  - >-
    backlog/tasks/task-551 -
    Rendre-les-limites-bêta-compréhensibles-sur-mobile-et-web.md
  - >-
    backlog/tasks/task-552 -
    Produire-un-suivi-exploitable-de-l’usage-des-coûts-et-des-refus-bêta.md
  - >-
    backlog/tasks/task-562 -
    Générer-un-nouvel-artefact-à-chaque-demande-sans-réutilisation-aperçu-excepté.md
priority: low
dispatchable: false
type: feature
ordinal: 171000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Un compte qui importe sa bibliothèque ou demande beaucoup de générations peut occuper la capacité partagée et ralentir tous les autres. Cet usage par lots est légitime pour une app de second cerveau : le contrôler ne doit pas revenir à imposer arbitrairement une petite allocation quotidienne.

## Responsabilité

Appliquer la politique d'équité retenue à l'admission et au traitement des opérations de chaque compte, au-dessus du contrôle collectif des fournisseurs. Couvrir les travaux actifs et en attente, les étapes automatiques d'un import, le chat, les annulations et les opérations partagées qui subsistent. Le rattachement d'un appel automatique ou partagé ne doit pas permettre de contourner la règle ni pénaliser tous ses lecteurs. Préserver l'identité du payeur et les règles financières existantes.

Rendre explicite ce qui est accepté puis mis en attente, ce qui est refusé temporairement et ce qui peut être annulé ou relancé ; borner l'accumulation et l'attente selon la décision. Garder les imports par lots utilisables, les échanges interactifs servis et les comptes peu actifs capables d'avancer. Aucune garantie de délai chiffrée n'est inventée ici.

Les éventuels états de file et actions utilisateur doivent être compréhensibles sur mobile et web, sans clics qui recréent une demande déjà acceptée et sans les confondre avec l'épuisement du budget. Coordonner les contrats avec TASK-550/551 ; cette tâche possède les nouveaux comportements d'attente/équité, pas leur jauge de consommation. Réutiliser les événements existants pour le suivi TASK-552.

## Reportée

Décision de l'owner du 2026-10-29 (README du benchmark, Owner Validation, point 1) : la discipline d'équité n'est pas construit à l'échelle actuelle. Le verrou du front-matter se lève quand l'un des déclencheurs de la décision se produit : environ 300 DAU, ou 429 fournisseur persistants hors incident. Ne pas démarrer avant.

## Décision à appliquer

Lire la décision finale de l'owner dans docs/research/task-563-provider-capacity-fairness-operator-safety/README.md, section Owner Validation, champ Decision et sections qu'il cite ; la recommandation seule ne vaut pas validation. Cette tâche dépend de TASK-563 et ne démarre pas avant son acceptation. Les choix de technologie et les paramètres sont ceux de cette décision, pas ceux d'une proposition historique.

## Règles communes

Conserver le budget utilisateur validé et les remboursements de TASK-547, réutiliser les points fournisseurs communs et le registre de TASK-548/549. Respecter TASK-562 : pas de réutilisation des artefacts demandés, aperçu excepté. Ne pas modifier Spotify sync, livraison email, logique de génération des quiz, Whisper ou facturation à crédits. Toute extension des API média/artefacts suit les chemins canoniques, jamais de nouveaux endpoints sous /api/v1/.

Retirer le code remplacé sans compatibilité, double chemin ni migration de fixtures. Pas de tests automatisés, appel local à FastAPI ou exigence de déploiement. Les actions de compte et la vérification AWS après merge/push relèvent d'une checklist owner. Aucun secret, identité de compte ou donnée de testeur dans les fichiers suivis. Tout changement de comportement client couvre mobile et web ; logique neutre dans packages/core, parité Web et contrôles statiques des packages concernés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les règles d’équité, limites de travaux actifs/en attente et attribution des opérations retenues sont configurables et câblées aux chemins concernés, au-dessus du contrôle global fournisseur.
- [ ] #2 Le cycle des travaux attendus, annulés, échoués ou expirés libère la capacité conformément à la décision ; doublons, crashs et traitements automatiques ne conservent pas indéfiniment une place.
- [ ] #3 La politique documente et applique le traitement des imports par lots, du chat et des opérations partagées, ainsi que la prévention de l’accaparement et de la famine ; aucun nouveau quota commercial quotidien n’est ajouté hors décision validée.
- [ ] #4 L’API et les parcours mobile/web distinguent attente, refus temporaire et budget épuisé ; la reprise d’une demande déjà acceptée ne crée pas une nouvelle intention ni une seconde réservation.
- [ ] #5 Les événements et le runbook décrivent attente, capacité occupée et décisions par compte sans données sensibles ; les vérifications statiques des composants modifiés passent, sans tests automatisés ni gate de déploiement.
<!-- AC:END -->
