---
id: TASK-592
title: >-
  Publier les extensions Chrome et Edge et transmettre les paquets distribués à
  la recette agent
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
  - TASK-487
  - TASK-472
  - TASK-591
  - TASK-594
  - TASK-596
  - TASK-597
  - TASK-598
references:
  - extension/README.md
  - web/src/pages/AccountPage.tsx
  - TASK-599
priority: medium
type: task
ordinal: 199000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Responsabilité : propriétaire — comptes développeur, choix/autorisation de publication, fiches, déclarations, soumissions, reviews et mise à disposition du paquet. Les agents exécutent la recette fonctionnelle dans TASK-599. Tâche de publication verrouillée pour le dispatcher (dispatchable: false).

TASK-487 livre le code et le document de publication, pas la disponibilité sur Chrome Web Store et Edge Add-ons. Le propriétaire choisit les comptes développeur et le canal, reconstruit le même paquet Chromium avec les origines réelles, complète les fiches/déclarations puis soumet et suit les reviews. Le paquet local avec localhost n’est pas le paquet à publier ; l’API dev reste cohérente avec la bêta si c’est l’environnement retenu.

Après attribution des IDs publics, les renseigner dans la configuration publique web et publier le paquet web actualisé selon le runbook. Consigner les versions, empreintes/paquets, liens publics et état d’accès utiles à l’agent de recette. La validation fonctionnelle en un clic, sauvegardes, session/révocation et code de secours est retirée de cette tâche et transférée à la recette agent suivante ; un smoke check de publication ne la remplace pas. Ne pas doubler la recette de développement TASK-598.

La recette après distribution est TASK-599 ; elle dépend de cette publication et ne doit jamais en devenir une dépendance inverse. Le go/no-go TASK-441 distingue disponibilité et résultats de recette. Aucun nouveau test automatisé, secret ni identité de compte dans les fichiers suivis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le compte rendu de publication identifie paquet/version Chromium communs, fiches, soumissions et état des reviews pour Chrome et Edge, sans identité de compte ni credential.
- [ ] #2 Les origines réelles et les IDs publics Chrome/Edge utilisés par le web sont consignés avec la configuration web publiée ; la disponibilité effective de chaque canal est distinguée d’un simple dépôt de ZIP.
- [ ] #3 Le dossier de transmission fournit à la recette agent les liens et versions effectivement distribués, l’environnement visé et les limites d’accès ; une review encore en attente n’est pas présentée comme une extension disponible.
<!-- AC:END -->
