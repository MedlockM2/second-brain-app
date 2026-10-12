---
id: TASK-502
title: Intégrer le chat aux pages selon la décision du benchmark task-501
status: To Do
assignee: []
created_date: '2026-10-12 09:42'
labels:
  - mobile
  - chat
  - testflight
dependencies:
  - TASK-501
documentation:
  - docs/research/task-501-chat-inline/README.md
  - docs/research/task-434-chatbot-integration-ui/README.md
  - AGENTS.md
type: feature
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lire la décision finale de l'owner dans docs/research/task-501-chat-inline/README.md. Le retour AD9M_CsdhTTaHMyX0_NSuig demande une conversation sous le transcript, sans modal, et des commandes d'historique/nouvelle conversation dans l'en-tête. Appliquer le parcours retenu pour médias et dossiers en conservant streaming, arrêt, reprise et historique. Supprimer les surfaces remplacées dans la même passe ; aucune coexistence héritée. Validation appareil après distribution dans la checklist owner, sans AC dépendant d'un déploiement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les parcours média et dossier appliquent la décision owner du README de task-501, avec commandes et défilement cohérents.
- [ ] #2 La conversation conserve le streaming, l'arrêt, la reprise et l'historique ; les anciennes surfaces remplacées sont supprimées.
- [ ] #3 Accessibilité, traductions et contrôles typecheck/lint mobile/core sont couverts sans ajout de tests automatisés.
<!-- AC:END -->
