---
id: TASK-440
title: Valider sur AWS dev les parcours V1 et le digest avant la bêta
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
updated_date: '2026-11-04 19:30'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-551
  - TASK-552
  - TASK-440.1
  - TASK-440.2
  - TASK-440.3
  - TASK-440.4
references:
  - TASK-601
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - tests/e2e/README.md
  - docs/research/pricing-challenge/README.md
  - docs/research/task-547-beta-budget-control/README.md
priority: high
ordinal: 47000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Propriétaire — déclencher la suite E2E backend existante, vérifier le digest et le contrôle financier, consolider les constats et décider du go/no-go. Agents — exécuter les recettes web TASK-440.1 à TASK-440.4 avec navigateur contrôlé/API-AWS complémentaires et ouvrir les corrections dédiées ; ces sous-tâches sont autonomes et dispatchables après leurs prérequis.

## Contexte et périmètre

Phase 4 : aucune preuve de run complet depuis juin dans le plan. Rejouer la suite existante sur le backend réellement déployé, sans écrire de tests ni importer FastAPI en guise de validation. Compléter par le digest journalier hors couverture actuelle. Ne pas toucher à la livraison email. Si un scénario est périmé, documenter cet écart et faire arbitrer sa correction plutôt que déclarer le produit validé.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.

## Complément : formule bêta autonome

## Décisions acquises

Formule bêta autonome, indépendante des abonnements commerciaux, avec toutes les fonctionnalités actuellement disponibles. Budget de 5 EUR par compte et par mois, sans report, pour les coûts fournisseurs d’usage hors infrastructure fixe. Les 5 EUR sont considérés comme suffisamment permissifs : ne pas rouvrir ce calibrage. Valoriser l’usage réellement mesuré au tarif normal hors crédits promotionnels ; prendre en compte les tarifs de cache réellement appliqués. L’utilisateur voit un pourcentage, sans euros, crédits ni proposition d’achat. Lecture, organisation et consultation des contenus et résultats déjà disponibles restent accessibles lorsque la capacité est épuisée ; un nouveau traitement payant reste soumis au contrôle commun.

Source de vérité : docs/research/pricing-challenge/README.md, Owner Validation et R.1–R.2, décisions du 2026-10-26 et accord de l’owner sur la préparation de la formule bêta autonome.
## Checklist propriétaire après intégration et déploiement

Cette checklist ne demande ni nouveau test automatisé ni déploiement depuis un worktree d’implémentation. Le propriétaire exécute les contrôles backend/financiers contre AWS dev après livraison des dépendances, en suivant la décision validée du benchmark ; pour les observations d’interface web, il intègre les rapports des agents de recette au lieu de refaire leurs parcours. Ne pas conclure à une garantie plus forte que celle démontrée par cette décision.

- Vérifier la couverture des imports, traitements automatiques, générations sur média et dossier, chat et fournisseurs de repli actuellement accessibles.
- Lancer des actions concurrentes près du plafond et rapprocher les montants engagés, réservés et constatés ; vérifier que la même disponibilité ne peut pas être dépensée plusieurs fois.
- Examiner une interruption et un worker perdu : règlement ou conservation des réservations, coût effectivement engagé et éventuel remboursement de capacité utilisateur.
- Examiner doublon, reprise et nouvelle tentative : absence de double comptage d’un même événement ; les appels réellement facturés plusieurs fois ne doivent pas disparaître du suivi financier.
- Examiner un échec facturé et un remboursement utilisateur : la dépense financière reste suivie et n’est pas effacée par le remboursement de capacité.
- Examiner une réservation abandonnée, un coût non bornable, une métrique manquante et une indisponibilité de lecture du budget ; aucun nouveau coût ne doit être engagé sans la couverture requise par le modèle validé.
- Vérifier le changement de mois et les actions encore en cours selon les règles de période du benchmark, sans report de solde.
- Pour le mobile, vérifier jauge, date de recharge, prévision et ses limites, avertissements, refus distincts, conservation des brouillons, masquage des achats et accès aux contenus disponibles après épuisement. Pour le web, exploiter les observations des recettes agent TASK-440.1 à TASK-440.4, sans les réexécuter par défaut.
- Produire le rapport interne, contrôler la distinction cohorte/fixtures et la présence des refus et anomalies ; consigner ce qui reste non reproduit ou non observable sans inventer de résultat.

Consigner révision, environnement, date, observations et limites sans identité de testeur, secret ni payload brut. Chaque anomalie bloquante alimente une tâche de correction ; documenter explicitement le go/no-go pour la bêta.

## Volets web issus de l’audit du 2026-11-04

Les recettes agent TASK-440.1 (auth/session), TASK-440.2 (sources/lecture/Digest), TASK-440.3 (IA/chat/capacité) et TASK-440.4 (navigateurs/clavier/rendu) alimentent ce go/no-go. Leur mise en service dépend du domaine et des configurations app/api/auth. Elles complètent la preuve financière et le digest journalier déjà portés ici ; ne pas refaire ces rapports sous un autre nom. Une validation web non effectuée reste non vérifiée et bloque le go/no-go du périmètre mobile + web. Les corrections agent et la mise en service propriétaire sont des tâches distinctes.

## Répartition après autorisation de recette autonome

Le propriétaire ne réexécute pas automatiquement les scénarios déjà démontrés par les rapports agent. Il traite les limites nécessitant son accès, les décisions et le go/no-go. Les recettes agents ne sont pas des demandes de déployer depuis un worktree ni de créer une suite automatisée. Chaque rapport distingue constat réel, échec et non vérifié ; une impossibilité d’accès n’est pas une validation et ne transforme pas toute la recette en tâche propriétaire.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le compte rendu consigne la date, la révision déployée, les parcours couverts et le résultat de la suite E2E existante contre AWS dev, sans données personnelles.
- [ ] #2 Le déclenchement et le résultat observé du digest journalier sont documentés séparément, avec les limites de couverture.
- [ ] #3 Chaque anomalie bloquante est reliée à une tâche de correction et à son état ; la décision de validation ou de report de Phase 4 est explicite.
- [ ] #4 Le compte rendu renseigne les scénarios budgétaires de la checklist propriétaire, avec observations ou limites explicites sur concurrence, interruption, doublon, échec facturé, réservation abandonnée, métrique absente et changement de mois.
- [ ] #5 Le compte rendu décrit les constats de compréhension sur mobile et web et l’obtention du rapport d’usage, avec accès aux contenus disponibles, absence d’achat et distinction cohorte/fixtures ; les écarts sont qualifiés avant le go/no-go bêta.
- [ ] #6 Le go/no-go référence les quatre comptes rendus web (auth/session, sources/lecture, IA/chat/capacité, navigateurs/rendu), leurs limites et corrections ; aucun volet non exécuté n’est présenté comme validé.
<!-- AC:END -->
