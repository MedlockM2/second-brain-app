---
id: TASK-549
title: Faire passer les traitements fournisseurs par le contrôle budgétaire commun
status: To Do
assignee: []
created_date: '2026-10-26 22:21'
updated_date: '2026-10-26 22:22'
labels:
  - backend
  - feature
dependencies:
  - TASK-548
documentation:
  - docs/research/pricing-challenge/README.md
  - docs/research/task-547-beta-budget-control/README.md
  - docs/CANONICAL_MEDIA_API_CONTRACT.md
priority: high
type: feature
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

Un budget fiable ne protège pas la bêta si une transcription, une collecte, un aperçu automatique, une traduction ou une reprise peut encore dépenser en dehors du contrôle commun. Les anciens débits en minutes ne doivent pas s’ajouter au nouveau comptage.

## Décisions acquises

Formule bêta autonome, indépendante des abonnements commerciaux, avec toutes les fonctionnalités actuellement disponibles. Budget de 5 EUR par compte et par mois, sans report, pour les coûts fournisseurs d’usage hors infrastructure fixe. Les 5 EUR sont considérés comme suffisamment permissifs : ne pas rouvrir ce calibrage. Valoriser l’usage réellement mesuré au tarif normal hors crédits promotionnels ; prendre en compte les tarifs de cache réellement appliqués. L’utilisateur voit un pourcentage, sans euros, crédits ni proposition d’achat. Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles lorsque la capacité est épuisée ; un nouveau traitement payant reste soumis au contrôle commun.

Source de vérité : docs/research/pricing-challenge/README.md, Owner Validation et R.1–R.2, décisions du 2026-10-26 et accord de l’owner sur la préparation de la formule bêta autonome.
## Périmètre confirmé

Appliquer la décision de docs/research/task-547-beta-budget-control/README.md et utiliser le socle de TASK-548. Couvrir tous les chemins actuellement accessibles : transcription, collectes, parsing, aperçus, traductions, générations sur média et dossier, chat, nouvelles tentatives et fournisseurs de repli. Reprendre aussi les traitements déclenchés automatiquement ou à la lecture ; une lecture pure sans nouvel appel reste gratuite. Fournir une cartographie des appels, unités, règles d’attribution et points de contrôle. Retirer les anciens débits en minutes remplacés, sans dual-write ni migration de fixtures. Ne pas modifier la logique de génération des quiz, le sync Spotify, la livraison email ou Whisper ; intervenir dans les points de contrôle fournisseurs partagés nécessaires au budget. Les fonctionnalités encore non livrées, dont un éventuel nouvel artefact avec synthèse vocale, ne sont pas à implémenter ici.

## Limites de livraison

Aucune offre commerciale, recharge payante ou facturation à crédits à créer. Aucun changement de fournisseur ou de modèle sans décision validée ; ne pas rouvrir le contrôle du débit de tokens déjà arbitré par task-459. Aucun test automatisé demandé, aucun appel local à FastAPI en guise de preuve, aucune migration de fixtures ni compatibilité avec les anciens débits remplacés. Les vérifications après déploiement et sur appareils relèvent de la checklist propriétaire de task-440, pas d’un critère d’acceptation de cette tâche. Aucun secret, identité de compte ou payload fournisseur brut dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Chaque chemin fournisseur actuellement accessible est relié au contrôle commun avant dépense et au règlement approprié : transcription, collectes, parsing, aperçus, traductions, générations média/dossier et chat ; la cartographie de couverture est documentée.
- [ ] #2 Les déclenchements automatiques, reprises et fournisseurs de repli utilisent les règles de la décision validée ; aucun échec de lecture de solde ou coût non bornable ne contourne la protection retenue.
- [ ] #3 Les quantités facturées, tarifs de modèle et cache et règles d’attribution sont câblés sans double comptage ; les métriques manquantes, doublons et appels partagés suivent explicitement la décision du benchmark.
- [ ] #4 Les anciens débits en minutes remplacés sont retirés des chemins concernés, sans ancien chemin de secours, double écriture ou migration de fixtures ; les opérations sans nouvel appel fournisseur restent hors débit.
- [ ] #5 La documentation de couverture et des limites résiduelles est à jour ; Ruff et mypy passent sur les fichiers backend modifiés, sans ajout de tests automatisés ni exigence de vérification après déploiement.
<!-- AC:END -->
