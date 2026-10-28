---
id: TASK-564
title: >-
  Réguler les appels fournisseurs partagés selon le benchmark validé pour
  plusieurs centaines d’utilisateurs quotidiens
status: To Do
assignee: []
created_date: '2026-10-28 16:59'
labels:
  - backend
  - scalability
  - feature
dependencies:
  - TASK-563
  - TASK-549
  - TASK-562
references:
  - docs/research/task-563-provider-capacity-fairness-operator-safety/README.md
  - docs/BETA_BUDGET_CONTROL.md
  - docs/INGESTION_WORKERS_PROVIDERS.md
  - >-
    backlog/tasks/task-459 -
    Benchmark-du-contrôle-du-débit-de-tokens-par-minute-partagé-entre-le-chat-et-les-artefacts-sur-le-fournisseur-LLM.md
  - >-
    backlog/tasks/task-466 -
    Implémenter-le-contrôle-du-débit-de-tokens-partagé-entre-le-chat-et-les-artefacts-selon-le-benchmark-validé-task-459.md
  - >-
    backlog/tasks/task-552 -
    Produire-un-suivi-exploitable-de-l’usage-des-coûts-et-des-refus-bêta.md
priority: high
type: feature
ordinal: 170000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Le cumul des appels de comptes pourtant dans leur budget peut dépasser les limites d'un fournisseur. Les plafonds de concurrence des workers et les 429 réactifs ne garantissent pas toutes les limites de requêtes, tokens ou jobs. La séparation des files chat/artefacts ne sépare pas nécessairement le compte fournisseur.

## Responsabilité

Livrer le contrôle collectif de capacité retenu : périmètres fournisseurs réellement partagés, unités et paramètres, intégration de tous les chemins applicables, traitement de l'attente et des signaux du fournisseur. Couvrir appels automatiques, retries, replis et polling selon la décision ; justifier les appels exclus. Cette tâche porte le socle et les points d'intégration de capacité utilisés par les deux tâches suivantes ; elle ne choisit pas leur politique d'équité ou de dépense.

Distinguer saturation de débit, indisponibilité et épuisement financier. Les temporisations ne doivent ni consommer les reprises comme des appels échoués ni provoquer un second envoi de la même tentative. L'articulation des réservations financières pendant l'attente suit la décision commune. Préserver consultation et résultats déjà disponibles ; le chat garde le comportement interactif borné retenu.

Émettre les événements utiles à TASK-552 et documenter la configuration et le diagnostic ; les limites propres aux comptes qui exigent une console restent dans la checklist owner. Ne pas acheter de capacité ni changer les moyens de paiement de TASK-558.

## Décision à appliquer

Lire la décision finale de l'owner dans docs/research/task-563-provider-capacity-fairness-operator-safety/README.md, section Owner Validation, champ Decision et sections qu'il cite ; la recommandation seule ne vaut pas validation. Cette tâche dépend de TASK-563 et ne démarre pas avant son acceptation. Les choix de technologie et les paramètres sont ceux de cette décision, pas ceux d'une proposition historique.

## Règles communes

Conserver le budget utilisateur validé et les remboursements de TASK-547, réutiliser les points fournisseurs communs et le registre de TASK-548/549. Respecter TASK-562 : pas de réutilisation des artefacts demandés, aperçu excepté. Ne pas modifier Spotify sync, livraison email, logique de génération des quiz, Whisper ou facturation à crédits. Toute extension des API média/artefacts suit les chemins canoniques, jamais de nouveaux endpoints sous /api/v1/.

Retirer le code remplacé sans compatibilité, double chemin ni migration de fixtures. Pas de tests automatisés, appel local à FastAPI ou exigence de déploiement. Les actions de compte et la vérification AWS après merge/push relèvent d'une checklist owner. Aucun secret, identité de compte ou donnée de testeur dans les fichiers suivis. Tout changement de comportement client couvre mobile et web ; logique neutre dans packages/core, parité Web et contrôles statiques des packages concernés.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La politique de capacité validée est câblée sur les appels fournisseurs retenus, avec unités et portées partagées documentées ; les anciens limiteurs remplacés ou insuffisants sont retirés selon la décision.
- [ ] #2 Le chemin d’attente, de report ou de refus applique les contrats retenus pour le chat et les travaux de fond ; ses transitions sont raccordées au budget et au droit d’envoi sans appel compté à tort comme une dépense.
- [ ] #3 Les nouvelles tentatives, replis, déclenchements automatiques et polling applicables empruntent le contrôle retenu ; la gestion des doublons, crashs et pannes du contrôle est documentée et câblée.
- [ ] #4 Les événements de saturation, admission, attente et configuration alimentent l’observabilité existante ; les paramètres, portées de partage et actions de compte sont décrits dans un runbook sans données sensibles.
- [ ] #5 Les contrats et éventuels états clients sont cohérents sur mobile et web ; Ruff/mypy, terraform validate si nécessaire et les contrôles statiques des packages modifiés passent, sans ajout de tests automatisés.
<!-- AC:END -->
