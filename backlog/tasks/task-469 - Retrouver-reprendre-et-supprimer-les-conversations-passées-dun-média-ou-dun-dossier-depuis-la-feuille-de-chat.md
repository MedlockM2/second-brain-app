---
id: TASK-469
title: >-
  Retrouver, reprendre et supprimer les conversations passées d'un média ou d'un
  dossier depuis la feuille de chat
status: To Do
assignee: []
created_date: '2026-10-10 18:01'
labels:
  - mobile
  - chat
  - ui
  - feature
dependencies:
  - TASK-468
references:
  - docs/research/task-430-chatbot-architecture/README.md
  - docs/research/task-434-chatbot-integration-ui/README.md
  - >-
    mobile-design-mockups/chatbot_integration_ui/direction_f_composeur_persistant/code.html
  - mobile-design-mockups/my_design_system/DESIGN.md
priority: medium
type: feature
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Pourquoi

L'architecture du chat, décidée dans `docs/research/task-430-chatbot-architecture/README.md` (section **Owner Validation**, `Decision` du 2026-10-10, source de vérité), fixe au point 1 un « chat multi-tours à portée média et dossier, **avec historique retrouvable** ». L'intégration UI, décidée dans `docs/research/task-434-chatbot-integration-ui/README.md` (Owner Validation, `Decision`), est la direction F : un composeur persistant dans l'onglet Lecture d'un média et l'onglet Sources d'un dossier, qui s'ouvre en feuille de conversation (tâche précédente).

Cette tâche ajoute à cette feuille l'accès aux conversations passées de la **même portée** : un média ou un dossier a plusieurs conversations dans le temps — ne serait-ce que parce que la conversation pleine (plafond de tours) ou un changement des sources du dossier (instantané figé à l'ouverture, README task-430 §11.1) obligent à en ouvrir une nouvelle.

Maquettes de référence : `mobile-design-mockups/chatbot_integration_ui/direction_f_composeur_persistant/` (en-tête de feuille, état « conversation pleine » qui propose une conversation neuve). La maquette ne dessine pas de liste d'historique : la dessiner dans le langage de la feuille et du design system « Amber Clarity » (`mobile-design-mockups/my_design_system/DESIGN.md`), sans nouvel onglet ni nouvelle destination — ce que la décision UI exclut.

## Ce que la tâche livre

- Depuis la feuille : la liste des conversations de la portée courante (plus récentes d'abord, première question ou titre, date, nombre de tours, état du dernier tour), lue par `chatService` (route de liste par portée).
- Reprendre une conversation passée : son fil se recharge, et si une génération y est encore active, le contrôleur reprend son flux.
- Démarrer une nouvelle conversation sur la même portée, y compris depuis l'état « conversation pleine ».
- Supprimer une conversation, avec confirmation, par la route de suppression.
- i18n dans la même tâche : onze catalogues de `mobile/src/i18n/` et `pseudo.ts`. Accessibilité : rôles de liste et de bouton, cibles d'au moins 48 pt, thèmes clair et sombre par `ThemeContext`.

## Règles

Rien n'est déployé : pas de compatibilité. Pas de tests automatisés ; aucune suite Maestro en critère.

## Note à l'owner

Vérification visuelle sur appareil, sur un build de dev pointant l'API dev : plusieurs conversations sur un même média, reprise, suppression, nouvelle conversation après une conversation pleine.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La feuille de chat donne accès à la liste des conversations de la portée courante, plus récentes d'abord, avec première question ou titre, date, nombre de tours et état du dernier tour
- [ ] #2 Choisir une conversation passée recharge son fil et reprend le flux si une génération y est active
- [ ] #3 Une nouvelle conversation peut être ouverte sur la même portée, y compris depuis l'état conversation pleine
- [ ] #4 Une conversation peut être supprimée après confirmation par la route de suppression
- [ ] #5 Aucun nouvel onglet ni nouvelle destination n'est ajouté ; les chaînes nouvelles existent dans les onze catalogues et pseudo.ts, et les cibles tactiles font au moins 48 pt
- [ ] #6 npx tsc --noEmit et le lint du projet mobile passent
<!-- AC:END -->
