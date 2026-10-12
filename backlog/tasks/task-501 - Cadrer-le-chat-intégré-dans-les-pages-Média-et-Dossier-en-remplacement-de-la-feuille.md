---
id: TASK-501
title: >-
  Cadrer le chat intégré dans les pages Média et Dossier en remplacement de la
  feuille
status: To Do
assignee: []
created_date: '2026-10-12 09:41'
updated_date: '2026-10-12 09:42'
labels:
  - benchmark
  - mobile
  - chat
  - testflight
dependencies: []
documentation:
  - docs/research/task-434-chatbot-integration-ui/README.md
  - AGENTS.md
type: spike
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seconde partie du retour AD9M_CsdhTTaHMyX0_NSuig : afficher le clavier directement sur la page, conserver le transcript puis ajouter questions/réponses dessous, déplacer historique et nouvelle conversation dans l'en-tête. Cela révise la direction F validée dans task-434. Comparer les options de navigation et de défilement pour un long transcript, la page dossier, l'historique et l'onglet IA. Produire docs/research/task-501-chat-inline/README.md avec Owner Validation et owner_decision: pending ; attendre la décision owner avant l'implémentation dépendante.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Le README compare les parcours média et dossier, le défilement de longs contenus, le clavier et les conversations passées, avec recherche internet et recommandation justifiée.
- [ ] #2 Des maquettes couvrent les états lecture, rédaction, génération et historique dans le design system de l'app.
- [ ] #3 Le README porte owner_decision: pending et un champ Decision destiné à l'owner ; les conséquences sur task-434 sont explicites.
<!-- AC:END -->
