---
id: TASK-593
title: >-
  Soumettre l’extension Firefox à AMO et transmettre le paquet signé à la
  recette agent
status: To Do
assignee:
  - owner
created_date: '2026-11-04 19:12'
updated_date: '2026-11-04 19:27'
labels:
  - web
  - v1-launch
  - release
  - extension
  - owner-only
dependencies:
  - TASK-488
  - TASK-472
  - TASK-591
  - TASK-594
  - TASK-595
  - TASK-596
  - TASK-597
  - TASK-598
references:
  - extension/README.md
  - web/src/pages/AccountPage.tsx
  - TASK-600
priority: medium
type: task
ordinal: 200000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : propriétaire — comptes développeur, choix/autorisation de publication, fiches, déclarations, soumissions, reviews et mise à disposition du paquet. Les agents exécutent la recette fonctionnelle dans TASK-600. Tâche de publication verrouillée pour le dispatcher (dispatchable: false).

TASK-488 livre la cible Firefox et la génération de l’archive de sources ; il reste les opérations de distribution AMO. Le propriétaire reconstruit avec les origines retenues, vérifie la reconstruction de l’archive, renseigne fiche/déclarations et joint les sources au paquet lors de la soumission. Suivre la review, obtenir le paquet signé puis consigner version, lien public et canal réellement disponible. Les comptes développeur et engagements de publication restent au propriétaire.

La vérification interactive Firefox installé, code de secours, sauvegardes, session après redémarrage et révocation est retirée de cette tâche et transférée à la recette agent suivante. Ne pas confondre la disponibilité du paquet signé avec la réussite fonctionnelle de ce parcours. Renseigner le lien public d’installation du site lorsqu’il est disponible, sans promettre d’appairage Chromium ni rouvrir le périmètre de capture intégrale abandonné.

La recette après distribution est TASK-600 ; elle dépend de cette publication et ne doit jamais en devenir une dépendance inverse. Le go/no-go TASK-441 distingue disponibilité et résultats de recette. Aucun nouveau test automatisé, secret ni identité de compte dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le rapport consigne version/paquet, archive de sources correspondante et contrôle de reconstruction, soumission et état de review/signature AMO sans credential ni identité de compte.
- [ ] #2 Le lien et le canal effectivement disponibles du paquet Firefox signé, ainsi que le lien d’installation du site, sont consignés ; une soumission en attente n’est pas présentée comme une distribution.
- [ ] #3 Le dossier de transmission fournit à la recette agent la version signée, les origines et l’environnement visés ainsi que les limites d’accès ; la validation interactive est explicitement réservée à cette recette.
<!-- AC:END -->
