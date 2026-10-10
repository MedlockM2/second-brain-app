---
id: TASK-444
title: Publier les pages légales et valider les coordonnées de contact de Deepn
status: To Do
assignee:
  - owner
created_date: '2026-10-10 15:13'
labels:
  - v1-launch
  - release
  - owner-only
dependencies:
  - TASK-357
documentation:
  - docs/V1_LAUNCH_PLAN.md
  - docs/compliance/CHECKLIST.md
priority: high
ordinal: 51000
dispatchable: false
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Responsabilité

Owner — approuver les textes, appliquer la décision d’hébergement et publier ; agent — préparer les fichiers selon la décision validée, sans publication autonome.

## Contexte et périmètre

Les textes existent dans docs/compliance/. task-357 porte déjà le benchmark d’hébergement, task-358 le câblage mobile : ne pas les doubler. Lire la Decision autoritative du README de task-357 et prendre en compte les décisions ultérieures de marque/site. La publication légale peut utiliser l’option sans domaine si c’est la décision retenue ; ne pas la bloquer artificiellement sur l’achat du domaine API. Corriger les coordonnées placeholders et faire approuver les textes par l’owner. Vérifier aussi que les déclarations décrivent les données réellement collectées à la sortie.

Source : docs/V1_LAUNCH_PLAN.md, checklist de lancement réconciliée le 2026-10-10. Le plan contient des états de septembre périmés : vérifier les faits avant toute action. Ne pas recréer les fonctionnalités déjà couvertes par les tâches produit. Aucun nouveau test automatisé demandé. Aucun secret, email de compte, identifiant de support, compte reviewer ou donnée personnelle dans les fichiers suivis.

Exécution owner-only : cette tâche inclut une décision, des appareils physiques, une publication ou une opération de release hors du worktree ; dispatchable: false. Les critères portent sur le compte rendu et les décisions documentées, pas sur un déploiement qu’un agent devrait réaliser depuis sa branche.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L’approbation des textes et la décision d’hébergement sont consignées, avec la référence au README autoritatif.
- [ ] #2 Les URLs publiques finales et le compte rendu de leur consultation sans authentification depuis un réseau externe sont documentés.
- [ ] #3 Les contacts publics correspondent au canal approuvé ; aucune adresse de compte cloud ni aucun credential n’apparaît dans les fichiers suivis.
- [ ] #4 La checklist compliance identifie les liens transmis à task-358 et les questionnaires à reporter dans les stores.
<!-- AC:END -->
